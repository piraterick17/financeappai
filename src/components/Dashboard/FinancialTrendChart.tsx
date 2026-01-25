import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { MonthlyData, formatCurrency } from '../../utils/financialDataProcessing';

interface FinancialTrendChartProps {
  data: MonthlyData[];
  loading?: boolean;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
        <p className="text-text-main font-semibold mb-2">{payload[0].payload.name}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-bold" style={{ color: entry.color }}>
              {formatCurrency(entry.value as number)}
            </span>
          </div>
        ))}
        {payload[0].payload.neto !== undefined && (
          <div className="border-t border-border mt-2 pt-2 flex items-center justify-between gap-4">
            <span className="text-text-muted font-medium">Neto:</span>
            <span
              className={`font-bold ${
                payload[0].payload.neto >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatCurrency(payload[0].payload.neto)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function FinancialTrendChart({ data, loading }: FinancialTrendChartProps) {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="h-4 bg-surface/50 rounded w-48 mb-4 animate-pulse"></div>
        <div className="h-64 sm:h-80 bg-surface/50 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-base sm:text-lg font-semibold text-text-main mb-3 sm:mb-4">
          Tendencia Financiera (últimos 6 meses)
        </h3>
        <div className="h-64 sm:h-80 flex items-center justify-center">
          <p className="text-text-muted">No hay datos disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm">
      <h3 className="text-base sm:text-lg font-semibold text-text-main mb-3 sm:mb-4">
        Tendencia Financiera (últimos 6 meses)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          barGap={8}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="name"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            axisLine={{ stroke: '#4B5563' }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            axisLine={{ stroke: '#4B5563' }}
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `$${(value / 1000).toFixed(0)}k`;
              }
              return `$${value}`;
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
            formatter={(value) => (
              <span className="text-gray-300 text-sm">{value}</span>
            )}
          />
          <Bar
            dataKey="ingresos"
            name="Ingresos"
            fill="#11d452"
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
          />
          <Bar
            dataKey="gastos"
            name="Gastos"
            fill="#f97316"
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
