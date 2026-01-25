import { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ImportCSVModalProps {
  accounts: Array<{ id: string; name: string; bank_name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportCSVModal({ accounts, onClose, onSuccess }: ImportCSVModalProps) {
  const { user } = useAuth();
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Por favor selecciona un archivo CSV');
      return;
    }

    setFile(selectedFile);
    setError('');

    const text = await selectedFile.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());

    const previewData = lines
      .slice(1, 6)
      .filter((line) => line.trim())
      .map((line) => {
        const values = line.split(',').map((v) => v.trim());
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index];
          return obj;
        }, {} as any);
      });

    setPreview(previewData);
  };

  const handleImport = async () => {
    if (!file || !selectedAccount || !user) return;

    setLoading(true);
    setError('');

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const dateIndex = headers.findIndex((h) =>
        h.includes('fecha') || h.includes('date')
      );
      const descIndex = headers.findIndex((h) =>
        h.includes('descripcion') || h.includes('description') || h.includes('concepto')
      );
      const amountIndex = headers.findIndex((h) =>
        h.includes('monto') || h.includes('amount') || h.includes('importe')
      );

      if (dateIndex === -1 || descIndex === -1 || amountIndex === -1) {
        setError(
          'El archivo CSV debe contener columnas de Fecha, Descripción y Monto'
        );
        setLoading(false);
        return;
      }

      const transactions = lines
        .slice(1)
        .filter((line) => line.trim())
        .map((line) => {
          const values = line.split(',').map((v) => v.trim());
          const amount = parseFloat(
            values[amountIndex].replace(/[^0-9.-]/g, '')
          );

          return {
            user_id: user.id,
            account_id: selectedAccount,
            type: amount >= 0 ? 'income' : 'expense',
            amount: Math.abs(amount),
            description: values[descIndex] || 'Importado',
            transaction_date: values[dateIndex],
          };
        })
        .filter((t) => !isNaN(t.amount));

      const { error: dbError } = await supabase
        .from('transactions')
        .insert(transactions);

      if (dbError) {
        setError(dbError.message);
        setLoading(false);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Error al procesar el archivo CSV');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Importar Movimientos CSV</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Formato esperado:</strong> El archivo CSV debe contener columnas
              con Fecha, Descripción y Monto. Los montos negativos se considerarán gastos
              y los positivos como ingresos.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cuenta Destino
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecciona una cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivo CSV
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file"
              />
              <label
                htmlFor="csv-file"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Haz clic para seleccionar un archivo CSV'}
                </span>
              </label>
            </div>
          </div>

          {preview.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Vista previa (primeras 5 filas)
              </h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, i) => (
                          <td
                            key={i}
                            className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap"
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={loading || !file || !selectedAccount}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
