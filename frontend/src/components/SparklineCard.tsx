import React from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export interface SparklineCardProps {
  title: string;
  value: number;
  percentageChange: number;
  chartData: { value: number }[];
  icon?: React.ReactNode;
}

export default function SparklineCard({
  title,
  value,
  percentageChange,
  chartData,
  icon
}: SparklineCardProps) {
  const isPositive = percentageChange >= 0;
  const gradientId = `color-${title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
  
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative">
      <div className="p-5 pb-2 flex justify-between items-start z-10">
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formattedValue}</p>
          <div className="flex items-center gap-1 mt-2">
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                isPositive
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {Math.abs(percentageChange)}%
            </span>
            <span className="text-xs text-gray-400 ml-1">vs mês anterior</span>
          </div>
        </div>
        <div className="text-gray-400">
          {icon || <Activity className="w-5 h-5" />}
        </div>
      </div>

      <div className="mt-auto">
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
