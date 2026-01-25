import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, AlertCircle, CheckCircle, FileSpreadsheet, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  parseFile,
  parseFileWithMapping,
  detectColumnMapping,
  FileData,
  ColumnMapping,
  ParsedTransaction,
  ParserResult
} from '../../utils/importParsers';
import { categorizeTransactions } from '../../utils/categorization';
import { batchCheckForDuplicates, DuplicateCheckResult } from '../../utils/duplicateDetection';

interface ImportTransactionsModalProps {
  accounts: Array<{ id: string; name: string; bank_name: string; type: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'success';
type AmountType = 'single' | 'split';

export function ImportTransactionsModal({ accounts, onClose, onSuccess }: ImportTransactionsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('upload');

  const [amountType, setAmountType] = useState<AmountType>('single');
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [headerRow, setHeaderRow] = useState(0);
  const [dataStartRow, setDataStartRow] = useState(1);

  const [parseResult, setParseResult] = useState<ParserResult | null>(null);
  const [duplicates, setDuplicates] = useState<Map<number, DuplicateCheckResult>>(new Map());
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExtension = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

    if (!hasValidExtension) {
      setError('Por favor selecciona un archivo CSV o Excel (.xlsx, .xls)');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');
    setLoading(true);

    try {
      const data = await parseFile(selectedFile);
      setFileData(data);

      const detectedMapping = detectColumnMapping(data.headers);
      setColumnMapping(detectedMapping);

      if (detectedMapping.income !== undefined && detectedMapping.expense !== undefined) {
        setAmountType('split');
      } else if (detectedMapping.amount !== undefined) {
        setAmountType('single');
      }

      setLoading(false);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al leer el archivo');
      setLoading(false);
    }
  };

  const handleColumnChange = (field: keyof ColumnMapping, value: string) => {
    const index = value === '' ? undefined : parseInt(value);
    setColumnMapping(prev => ({
      ...prev,
      [field]: index
    }));
  };

  const handleAmountTypeChange = (type: AmountType) => {
    setAmountType(type);
    if (type === 'single') {
      setColumnMapping(prev => ({
        ...prev,
        income: undefined,
        expense: undefined
      }));
    } else {
      setColumnMapping(prev => ({
        ...prev,
        amount: undefined
      }));
    }
  };

  const isMappingValid = (): boolean => {
    if (columnMapping.date === undefined || columnMapping.description === undefined) {
      return false;
    }

    if (amountType === 'single') {
      return columnMapping.amount !== undefined;
    } else {
      return columnMapping.income !== undefined && columnMapping.expense !== undefined;
    }
  };

  const handleProcessFile = async () => {
    if (!fileData || !isMappingValid()) {
      setError('Debes seleccionar todas las columnas requeridas');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const mapping: ColumnMapping = {
        date: columnMapping.date!,
        description: columnMapping.description!,
        time: columnMapping.time,
        ...(amountType === 'single'
          ? { amount: columnMapping.amount! }
          : { income: columnMapping.income!, expense: columnMapping.expense! }
        )
      };

      const result = parseFileWithMapping(fileData, mapping, dataStartRow);
      setParseResult(result);

      if (result.success && user && selectedAccount) {
        const duplicateChecks = await batchCheckForDuplicates(
          result.transactions,
          user.id,
          selectedAccount
        );
        setDuplicates(duplicateChecks);
      }

      setLoading(false);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult || !user || !selectedAccount) return;

    setLoading(true);
    setStep('importing');

    try {
      let transactionsToImport = parseResult.transactions;

      if (skipDuplicates && duplicates.size > 0) {
        transactionsToImport = transactionsToImport.filter((_, index) => {
          const dupCheck = duplicates.get(index);
          return !dupCheck || !dupCheck.isDuplicate;
        });
      }

      if (transactionsToImport.length === 0) {
        setError('No hay transacciones para importar');
        setLoading(false);
        setStep('preview');
        return;
      }

      const categorizedTransactions = categorizeTransactions(transactionsToImport);

      const transactionsForDB = categorizedTransactions.map(t => ({
        user_id: user.id,
        account_id: selectedAccount,
        type: t.type,
        amount: t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount),
        description: t.description,
        transaction_date: t.date,
        transaction_time: t.time || null,
        category: t.category || null,
        source: 'import',
        is_recurring: false,
      }));

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsForDB);

      if (insertError) {
        throw new Error(insertError.message);
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });

      setLoading(false);
      setStep('success');

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar transacciones');
      setLoading(false);
      setStep('preview');
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div className="p-4 bg-[#23482f] border border-primary/30 rounded-lg">
        <p className="text-sm text-gray-300">
          <strong className="text-primary">Paso 1:</strong> Sube tu archivo CSV o Excel con los movimientos bancarios.
          En el siguiente paso podrás indicar qué columnas corresponden a cada campo.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Cuenta Destino *
        </label>
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} - {account.bank_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Archivo (CSV, XLSX, XLS) *
        </label>
        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-primary/50 transition">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="transaction-file"
            disabled={loading}
          />
          <label
            htmlFor="transaction-file"
            className="cursor-pointer flex flex-col items-center gap-3"
          >
            <Upload className="w-12 h-12 text-gray-500" />
            <span className="text-sm text-gray-300">
              {file ? file.name : 'Haz clic para seleccionar un archivo'}
            </span>
            <span className="text-xs text-gray-500">
              CSV, Excel (.xlsx, .xls) - Máximo 10MB
            </span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderMappingStep = () => {
    if (!fileData) return null;

    const previewRows = fileData.rows.slice(0, 5);

    return (
      <div className="space-y-4">
        <div className="p-4 bg-[#23482f] border border-primary/30 rounded-lg">
          <p className="text-sm text-gray-300">
            <strong className="text-primary">Paso 2:</strong> Indica qué columna de tu archivo corresponde a cada campo.
            Hemos intentado detectarlas automáticamente.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fila de Encabezados
            </label>
            <input
              type="number"
              min="0"
              value={headerRow}
              onChange={(e) => {
                const newHeader = parseInt(e.target.value);
                setHeaderRow(newHeader);
                setDataStartRow(newHeader + 1);
              }}
              className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Datos Comienzan en Fila
            </label>
            <input
              type="number"
              min="1"
              value={dataStartRow}
              onChange={(e) => setDataStartRow(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Columna de Fecha *
            </label>
            <select
              value={columnMapping.date !== undefined ? columnMapping.date : ''}
              onChange={(e) => handleColumnChange('date', e.target.value)}
              className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
            >
              <option value="">Seleccionar columna...</option>
              {fileData.headers.map((header, index) => (
                <option key={index} value={index}>
                  {index}: {header || `(Columna ${index})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Columna de Descripción *
            </label>
            <select
              value={columnMapping.description !== undefined ? columnMapping.description : ''}
              onChange={(e) => handleColumnChange('description', e.target.value)}
              className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
            >
              <option value="">Seleccionar columna...</option>
              {fileData.headers.map((header, index) => (
                <option key={index} value={index}>
                  {index}: {header || `(Columna ${index})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Columna de Hora (opcional)
            </label>
            <select
              value={columnMapping.time !== undefined ? columnMapping.time : ''}
              onChange={(e) => handleColumnChange('time', e.target.value)}
              className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
            >
              <option value="">Sin hora</option>
              {fileData.headers.map((header, index) => (
                <option key={index} value={index}>
                  {index}: {header || `(Columna ${index})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Montos *
            </label>
            <select
              value={amountType}
              onChange={(e) => handleAmountTypeChange(e.target.value as AmountType)}
              className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
            >
              <option value="single">Una columna (+ o -)</option>
              <option value="split">Dos columnas (Ingresos y Gastos)</option>
            </select>
          </div>
        </div>

        {amountType === 'single' ? (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Columna de Monto * <span className="text-xs text-gray-500">(+ ingresos, - gastos)</span>
            </label>
            <select
              value={columnMapping.amount !== undefined ? columnMapping.amount : ''}
              onChange={(e) => handleColumnChange('amount', e.target.value)}
              className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
            >
              <option value="">Seleccionar columna...</option>
              {fileData.headers.map((header, index) => (
                <option key={index} value={index}>
                  {index}: {header || `(Columna ${index})`}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Columna de Ingresos *
              </label>
              <select
                value={columnMapping.income !== undefined ? columnMapping.income : ''}
                onChange={(e) => handleColumnChange('income', e.target.value)}
                className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleccionar columna...</option>
                {fileData.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {index}: {header || `(Columna ${index})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Columna de Gastos *
              </label>
              <select
                value={columnMapping.expense !== undefined ? columnMapping.expense : ''}
                onChange={(e) => handleColumnChange('expense', e.target.value)}
                className="w-full px-4 py-2 bg-[#1a2f23] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleccionar columna...</option>
                {fileData.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {index}: {header || `(Columna ${index})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Vista Previa (primeras 5 filas)
          </h4>
          <div className="overflow-x-auto border border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-[#1a2f23]">
                <tr>
                  {fileData.headers.map((header, index) => (
                    <th
                      key={index}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase"
                    >
                      {index}: {header || `Col ${index}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-[#112217] divide-y divide-gray-700">
                {previewRows.slice(1).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell: any, cellIndex: number) => (
                      <td
                        key={cellIndex}
                        className="px-4 py-2 text-sm text-gray-300 whitespace-nowrap"
                      >
                        {cell?.toString() || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={() => setStep('upload')}
            className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 font-medium rounded-lg hover:bg-[#1a2f23] transition"
          >
            Atrás
          </button>
          <button
            onClick={handleProcessFile}
            disabled={loading || !isMappingValid()}
            className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-[#112217] font-medium rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Procesando...' : 'Procesar Archivo'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderPreviewStep = () => {
    if (!parseResult) return null;

    const duplicateCount = Array.from(duplicates.values()).filter(d => d.isDuplicate).length;
    const willImport = skipDuplicates
      ? parseResult.transactions.length - duplicateCount
      : parseResult.transactions.length;

    return (
      <div className="space-y-4">
        {parseResult.errors.length > 0 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-500">
                  {parseResult.errors.length} error(es) encontrados
                </p>
                <ul className="mt-2 text-xs text-yellow-500/80 list-disc list-inside">
                  {parseResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>Fila {err.row}: {err.error}</li>
                  ))}
                  {parseResult.errors.length > 5 && (
                    <li>... y {parseResult.errors.length - 5} errores más</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 bg-[#23482f] border border-primary/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                {parseResult.transactions.length} transacciones detectadas
              </p>
              {duplicateCount > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {duplicateCount} posibles duplicados encontrados
                </p>
              )}
            </div>
            <FileSpreadsheet className="w-8 h-8 text-primary" />
          </div>
        </div>

        {duplicateCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-[#1a2f23] border border-gray-700 rounded-lg">
            <input
              type="checkbox"
              id="skip-duplicates"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="w-4 h-4 text-primary bg-[#112217] border-gray-600 rounded focus:ring-primary"
            />
            <label htmlFor="skip-duplicates" className="text-sm text-gray-300">
              Omitir duplicados ({duplicateCount} transacciones)
            </label>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Resumen de Importación
          </h4>
          <div className="space-y-2 text-sm text-gray-300">
            <p>• Se importarán <strong className="text-primary">{willImport}</strong> transacciones</p>
            <p>• Cuenta destino: <strong>{accounts.find(a => a.id === selectedAccount)?.name}</strong></p>
            {skipDuplicates && duplicateCount > 0 && (
              <p>• Se omitirán {duplicateCount} duplicados</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={() => setStep('mapping')}
            className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 font-medium rounded-lg hover:bg-[#1a2f23] transition"
          >
            Atrás
          </button>
          <button
            onClick={handleImport}
            disabled={loading || willImport === 0}
            className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-[#112217] font-medium rounded-lg transition disabled:opacity-50"
          >
            Importar {willImport} Transacciones
          </button>
        </div>
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-gray-300">Importando transacciones...</p>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center py-8">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <p className="text-white text-lg font-medium">¡Importación completada!</p>
      <p className="text-gray-400 text-sm mt-2">Las transacciones han sido importadas correctamente</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
      <div className="bg-[#112217] border border-gray-800 rounded-xl max-w-4xl w-full p-4 sm:p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Importar Movimientos</h3>
            <p className="text-sm text-gray-400 mt-1">
              {step === 'upload' && 'Paso 1: Selecciona el archivo'}
              {step === 'mapping' && 'Paso 2: Mapea las columnas'}
              {step === 'preview' && 'Paso 3: Revisa y confirma'}
              {step === 'importing' && 'Importando...'}
              {step === 'success' && 'Completado'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {step === 'upload' && renderUploadStep()}
        {step === 'mapping' && renderMappingStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'success' && renderSuccessStep()}
      </div>
    </div>
  );
}
