import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';

export interface ParsedTransaction {
  date: string;
  time?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  currency?: string;
  originalDescription: string;
}

export interface ParserResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors: Array<{ row: number; error: string }>;
}

export interface ColumnMapping {
  date: number;
  description: number;
  amount?: number;
  income?: number;
  expense?: number;
  time?: number;
}

export interface FileData {
  headers: string[];
  rows: any[][];
}

export function parseAmount(amountStr: string | number): number {
  if (amountStr === null || amountStr === undefined) return 0;

  if (typeof amountStr === 'number') return amountStr;

  const cleaned = amountStr
    .toString()
    .replace(/[$,\s]/g, '')
    .replace(/[()]/g, '-')
    .trim();

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

export function parseDate(dateStr: string | number): string | null {
  if (!dateStr) return null;

  if (typeof dateStr === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(dateStr);
    if (excelDate) {
      const year = excelDate.y;
      const month = String(excelDate.m).padStart(2, '0');
      const day = String(excelDate.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const cleanDate = dateStr.toString().trim();

  const monthMap: { [key: string]: string } = {
    'ene': '01', 'enero': '01', 'jan': '01', 'january': '01',
    'feb': '02', 'febrero': '02', 'february': '02',
    'mar': '03', 'marzo': '03', 'march': '03',
    'abr': '04', 'abril': '04', 'apr': '04', 'april': '04',
    'may': '05', 'mayo': '05',
    'jun': '06', 'junio': '06', 'june': '06',
    'jul': '07', 'julio': '07', 'july': '07',
    'ago': '08', 'agosto': '08', 'aug': '08', 'august': '08',
    'sep': '09', 'sept': '09', 'septiembre': '09', 'september': '09',
    'oct': '10', 'octubre': '10', 'october': '10',
    'nov': '11', 'noviembre': '11', 'november': '11',
    'dic': '12', 'diciembre': '12', 'dec': '12', 'december': '12',
  };

  const textMonthMatch = cleanDate.match(/(\d{1,2})[\/\-\s](ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sept?|septiembre|oct|octubre|nov|noviembre|dic|diciembre|jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)[\/\-\s](\d{2,4})/i);

  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0');
    const month = monthMap[textMonthMatch[2].toLowerCase()];
    let year = textMonthMatch[3];

    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = (century + parseInt(year)).toString();
    }

    return `${year}-${month}-${day}`;
  }

  const numericMatch = cleanDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (numericMatch) {
    const day = numericMatch[1].padStart(2, '0');
    const month = numericMatch[2].padStart(2, '0');
    let year = numericMatch[3];

    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = (century + parseInt(year)).toString();
    }

    return `${year}-${month}-${day}`;
  }

  const isoMatch = cleanDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function parseTime(timeStr: string | number): string | null {
  if (!timeStr) return null;

  const timeString = timeStr.toString().trim();

  const match = timeString.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    const seconds = match[3] || '00';
    return `${hours}:${minutes}:${seconds}`;
  }

  return null;
}

export function mapRowToTransaction(
  row: any[],
  mapping: ColumnMapping,
  rowNumber: number
): { transaction: ParsedTransaction | null; error: string | null } {
  try {
    const dateStr = row[mapping.date];
    const date = parseDate(dateStr);

    if (!date) {
      return {
        transaction: null,
        error: `Fecha inválida en fila ${rowNumber}: ${dateStr}`
      };
    }

    const description = row[mapping.description]?.toString().trim() || 'Sin descripción';

    const time = mapping.time !== undefined ? parseTime(row[mapping.time]) : null;

    let amount = 0;
    let type: 'income' | 'expense' = 'expense';

    if (mapping.amount !== undefined) {
      const parsedAmount = parseAmount(row[mapping.amount]);

      if (parsedAmount === 0) {
        return {
          transaction: null,
          error: `Monto inválido en fila ${rowNumber}`
        };
      }

      amount = Math.abs(parsedAmount);
      type = parsedAmount >= 0 ? 'income' : 'expense';
    } else if (mapping.income !== undefined && mapping.expense !== undefined) {
      const incomeAmount = parseAmount(row[mapping.income]);
      const expenseAmount = parseAmount(row[mapping.expense]);

      if (incomeAmount > 0) {
        amount = incomeAmount;
        type = 'income';
      } else if (expenseAmount > 0) {
        amount = expenseAmount;
        type = 'expense';
      } else {
        return {
          transaction: null,
          error: `Sin monto válido en fila ${rowNumber}`
        };
      }
    } else {
      return {
        transaction: null,
        error: `Configuración de columnas incompleta para fila ${rowNumber}`
      };
    }

    const transaction: ParsedTransaction = {
      date,
      time: time || undefined,
      description,
      amount,
      type,
      currency: 'MXN',
      originalDescription: description,
    };

    return { transaction, error: null };
  } catch (error) {
    return {
      transaction: null,
      error: `Error al procesar fila ${rowNumber}: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}

export function parseFileWithMapping(
  data: FileData,
  mapping: ColumnMapping,
  startRow: number = 1
): ParserResult {
  const result: ParserResult = {
    success: false,
    transactions: [],
    errors: [],
  };

  if (!data.rows || data.rows.length < startRow + 1) {
    result.errors.push({ row: 0, error: 'Archivo vacío o sin datos' });
    return result;
  }

  for (let i = startRow; i < data.rows.length; i++) {
    const row = data.rows[i];

    if (!row || row.length === 0 || !row[mapping.date]) {
      continue;
    }

    const { transaction, error } = mapRowToTransaction(row, mapping, i + 1);

    if (error) {
      result.errors.push({ row: i + 1, error });
    } else if (transaction) {
      result.transactions.push(transaction);
    }
  }

  result.success = result.transactions.length > 0;
  return result;
}

export function parseExcelFile(file: File): Promise<FileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });

        const rows = jsonData as any[][];
        const headers = rows.length > 0 ? rows[0].map((h: any) => h?.toString().trim() || '') : [];

        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsBinaryString(file);
  });
}

export function parseCSVFile(file: File): Promise<FileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const rows = lines.map(line => {
          const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
          const values: string[] = [];
          let match;

          while ((match = regex.exec(line)) !== null) {
            values.push((match[1] || match[2] || '').trim());
          }

          return values;
        });

        const headers = rows.length > 0 ? rows[0] : [];

        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

export async function parseFile(file: File): Promise<FileData> {
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    return await parseExcelFile(file);
  } else if (file.name.endsWith('.csv')) {
    return await parseCSVFile(file);
  } else {
    throw new Error('Formato de archivo no soportado. Use .xlsx, .xls o .csv');
  }
}

export function detectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  const mapping: Partial<ColumnMapping> = {};

  const dateKeywords = ['fecha', 'date', 'dia', 'day'];
  const descriptionKeywords = ['descripcion', 'description', 'concepto', 'concept', 'detalle', 'detail'];
  const amountKeywords = ['monto', 'amount', 'importe', 'total'];
  const incomeKeywords = ['ingreso', 'income', 'deposito', 'deposit', 'abono', 'credit', 'cargo a favor'];
  const expenseKeywords = ['egreso', 'expense', 'retiro', 'withdraw', 'gasto', 'debito', 'debit', 'cargo'];
  const timeKeywords = ['hora', 'time'];

  normalizedHeaders.forEach((header, index) => {
    if (dateKeywords.some(keyword => header.includes(keyword))) {
      mapping.date = index;
    }
    if (descriptionKeywords.some(keyword => header.includes(keyword))) {
      mapping.description = index;
    }
    if (amountKeywords.some(keyword => header.includes(keyword)) && !mapping.amount) {
      mapping.amount = index;
    }
    if (incomeKeywords.some(keyword => header.includes(keyword))) {
      mapping.income = index;
    }
    if (expenseKeywords.some(keyword => header.includes(keyword))) {
      mapping.expense = index;
    }
    if (timeKeywords.some(keyword => header.includes(keyword))) {
      mapping.time = index;
    }
  });

  return mapping;
}
