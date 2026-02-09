export interface CategoryKeyword {
  category: string;
  keywords: string[];
  icon?: string;
}

export const CATEGORY_KEYWORDS: CategoryKeyword[] = [
  {
    category: 'Compras en línea',
    keywords: ['amazon', 'mercadolibre', 'mercado libre', 'ebay', 'aliexpress', 'wish', 'shein'],
  },
  {
    category: 'Supermercado',
    keywords: ['walmart', 'soriana', 'chedraui', 'superama', 'heb', 'costco', 'sams', 'oxxo', '7-eleven', '7eleven', 'circle k'],
  },
  {
    category: 'Restaurantes',
    keywords: ['mcdonalds', 'burguer', 'burger', 'pizza', 'dominos', 'kfc', 'subway', 'starbucks', 'restaurante', 'taqueria', 'comida'],
  },
  {
    category: 'Transporte',
    keywords: ['uber', 'didi', 'cabify', 'beat', 'gasolina', 'pemex', 'taxi', 'metro', 'metrobus'],
  },
  {
    category: 'Entretenimiento',
    keywords: ['netflix', 'spotify', 'disney', 'hbo', 'prime video', 'youtube', 'apple music', 'deezer', 'cinepolis', 'cinemex'],
  },
  {
    category: 'Servicios',
    keywords: ['cfe', 'telmex', 'totalplay', 'izzi', 'megacable', 'axtel', 'dish', 'sky', 'agua', 'gas'],
  },
  {
    category: 'Salud',
    keywords: ['farmacia', 'hospital', 'clinica', 'medico', 'doctor', 'guadalajara', 'similares', 'del ahorro', 'benavides'],
  },
  {
    category: 'Educación',
    keywords: ['escuela', 'universidad', 'colegio', 'udemy', 'coursera', 'platzi', 'libro', 'libreria'],
  },
  {
    category: 'Transferencias',
    keywords: ['transferencia', 'spei', 'traspaso', 'envio', 'retiro cajero', 'retiro atm'],
  },
  {
    category: 'Pagos',
    keywords: ['pago', 'paypal', 'mercado pago', 'tarjeta', 'credito', 'abono'],
  },
  {
    category: 'Ropa y Calzado',
    keywords: ['zara', 'h&m', 'coppel', 'liverpool', 'palacio', 'nike', 'adidas', 'zapateria'],
  },
  {
    category: 'Hogar',
    keywords: ['home depot', 'elektra', 'muebles', 'decoracion', 'ferreteria'],
  },
  {
    category: 'Tecnología',
    keywords: ['apple', 'microsoft', 'google', 'samsung', 'best buy', 'office depot', 'computadora', 'celular'],
  },
  {
    category: 'Seguros',
    keywords: ['seguro', 'axa', 'gnp', 'metlife', 'mapfre', 'zurich'],
  },
  {
    category: 'Viajes',
    keywords: ['aeromexico', 'volaris', 'viva aerobus', 'hotel', 'airbnb', 'booking', 'despegar'],
  },
  {
    category: 'Inversiones',
    keywords: ['inversion', 'gbm', 'kuspit', 'cetesdirecto', 'bitso', 'crypto'],
  },
  {
    category: 'Ahorro',
    keywords: ['ahorro', 'piggo', 'cetes', 'fondo', 'plazo'],
  },
  {
    category: 'Suscripciones',
    keywords: ['suscripcion', 'membresia', 'mensualidad', 'anualidad'],
  },
];

export function categorizeTransaction(description: string): string | null {
  const normalizedDesc = description.toLowerCase().trim();

  for (const categoryGroup of CATEGORY_KEYWORDS) {
    for (const keyword of categoryGroup.keywords) {
      if (normalizedDesc.includes(keyword.toLowerCase())) {
        return categoryGroup.category;
      }
    }
  }

  if (normalizedDesc.includes('abono') || normalizedDesc.includes('deposito')) {
    return 'Ingreso';
  }

  return null;
}

export function categorizeTransactions<T extends { description: string; category?: string | null }>(transactions: T[]): T[] {
  return transactions.map(transaction => ({
    ...transaction,
    category: transaction.category || categorizeTransaction(transaction.description) || 'Sin categorizar',
  }));
}
