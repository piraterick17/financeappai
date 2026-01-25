import { supabase } from '../lib/supabase';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType?: 'exact' | 'similar';
  matchedTransaction?: any;
  similarity?: number;
}

export async function checkForDuplicates(
  userId: string,
  accountId: string,
  date: string,
  amount: number,
  description: string
): Promise<DuplicateCheckResult> {
  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('transaction_date', date)
    .eq('amount', amount);

  if (existingTransactions && existingTransactions.length > 0) {
    return {
      isDuplicate: true,
      matchType: 'exact',
      matchedTransaction: existingTransactions[0],
    };
  }

  const { data: similarTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('transaction_date', date)
    .gte('amount', amount * 0.95)
    .lte('amount', amount * 1.05);

  if (similarTransactions && similarTransactions.length > 0) {
    for (const transaction of similarTransactions) {
      const similarity = calculateStringSimilarity(
        description.toLowerCase(),
        transaction.description.toLowerCase()
      );

      if (similarity > 0.8) {
        return {
          isDuplicate: true,
          matchType: 'similar',
          matchedTransaction: transaction,
          similarity,
        };
      }
    }
  }

  return { isDuplicate: false };
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export async function batchCheckForDuplicates(
  userId: string,
  accountId: string,
  transactions: Array<{ date: string; amount: number; description: string }>
): Promise<Map<number, DuplicateCheckResult>> {
  const results = new Map<number, DuplicateCheckResult>();

  const dates = [...new Set(transactions.map(t => t.date))];

  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .in('transaction_date', dates);

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];

    const exactMatch = existingTransactions?.find(
      et =>
        et.transaction_date === transaction.date &&
        Math.abs(parseFloat(et.amount) - transaction.amount) < 0.01
    );

    if (exactMatch) {
      results.set(i, {
        isDuplicate: true,
        matchType: 'exact',
        matchedTransaction: exactMatch,
      });
      continue;
    }

    const similarMatches = existingTransactions?.filter(
      et =>
        et.transaction_date === transaction.date &&
        parseFloat(et.amount) >= transaction.amount * 0.95 &&
        parseFloat(et.amount) <= transaction.amount * 1.05
    );

    if (similarMatches && similarMatches.length > 0) {
      let bestMatch = null;
      let bestSimilarity = 0;

      for (const match of similarMatches) {
        const similarity = calculateStringSimilarity(
          transaction.description.toLowerCase(),
          match.description.toLowerCase()
        );

        if (similarity > bestSimilarity && similarity > 0.8) {
          bestSimilarity = similarity;
          bestMatch = match;
        }
      }

      if (bestMatch) {
        results.set(i, {
          isDuplicate: true,
          matchType: 'similar',
          matchedTransaction: bestMatch,
          similarity: bestSimilarity,
        });
        continue;
      }
    }

    results.set(i, { isDuplicate: false });
  }

  return results;
}
