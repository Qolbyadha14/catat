import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, ArrowUpDown } from 'lucide-react';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';

export interface BalanceHeroCardProps {
  netBalance: number;
  totalAssets: number;
  totalLiabilities: number;
  hasLiabilities: boolean;
  monthIncome: number;
  monthExpense: number;
  netCashflow: { isSurplus: boolean; formatted: string };
  selectedMonthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  dailyBalances?: { date: string; label: string; balance: number }[];
}

export const BalanceHeroCard: React.FC<BalanceHeroCardProps> = ({
  netBalance,
  totalAssets,
  totalLiabilities,
  hasLiabilities,
  monthIncome,
  monthExpense,
  netCashflow,
  selectedMonthLabel,
  onPrevMonth,
  onNextMonth,
  dailyBalances = [],
}) => {
  // Generate synthetic points if dailyBalances has fewer than 2 points
  const pointsData = dailyBalances.length >= 2 ? dailyBalances : [
    { date: '1', label: '01', balance: netBalance * 0.92 },
    { date: '5', label: '05', balance: netBalance * 0.94 },
    { date: '10', label: '10', balance: netBalance * 0.91 },
    { date: '15', label: '15', balance: netBalance * 0.96 },
    { date: '20', label: '20', balance: netBalance * 0.98 },
    { date: '25', label: '25', balance: netBalance },
  ];

  const [activePointIndex, setActivePointIndex] = useState<number | null>(pointsData.length - 1);

  // SVG dimensions
  const width = 340;
  const height = 85;
  const paddingX = 12;
  const paddingY = 16;

  const values = pointsData.map((d) => d.balance);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = pointsData.map((d, index) => {
    const x = paddingX + (index / (pointsData.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((d.balance - minVal) / range) * (height - 2 * paddingY);
    return { x, y, data: d };
  });

  // Cubic bezier path
  const pathD = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const prev = arr[i - 1];
    if (!prev) return acc;
    const cp1x = prev.x + (point.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (point.x - prev.x) / 2;
    const cp2y = point.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`;
  }, '');

  const areaD = `${pathD} L ${width - paddingX},${height} L ${paddingX},${height} Z`;

  const highlightedData = activePointIndex !== null && points[activePointIndex]
    ? points[activePointIndex]
    : points[points.length - 1];

  return (
    <div className="px-5 mb-5">
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1244d3] via-[#1a56ea] to-[#0c319e] p-5 text-white shadow-xl shadow-blue-600/30">
        {/* Glow ambient background accents */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-cyan-400/25 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-400/20 rounded-full blur-xl pointer-events-none" />

        {/* Top Header inside Card */}
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <span className="text-[11px] font-medium text-blue-200/90 tracking-wide uppercase">
              {hasLiabilities ? 'Saldo Bersih (Net Worth)' : 'Total Saldo'}
            </span>
            <div className="text-2xl sm:text-[28px] font-extrabold tracking-tight mt-0.5 text-white">
              {formatIdr(netBalance)}
            </div>
            {totalLiabilities > 0 && (
              <div className="text-[11px] text-blue-200/80 mt-1 flex items-center gap-2">
                <span>💰 Aset: {formatIdr(totalAssets)}</span>
                <span>•</span>
                <span className="text-rose-200 font-bold">💳 Hutang: {formatIdr(totalLiabilities)}</span>
              </div>
            )}
          </div>

          {/* Month Navigator Controls */}
          <div className="flex items-center gap-1 bg-white/15 backdrop-blur-md rounded-full px-1.5 py-1 border border-white/20">
            <button
              type="button"
              onClick={() => {
                playHapticSound('click');
                onPrevMonth();
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Bulan Sebelumnya"
              aria-label="Bulan Sebelumnya"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-bold text-white px-1 whitespace-nowrap">
              {selectedMonthLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                playHapticSound('click');
                onNextMonth();
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Bulan Berikutnya"
              aria-label="Bulan Berikutnya"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Interactive Wave Chart */}
        <div className="relative my-3 h-[90px] w-full">
          {highlightedData && (
            <div
              className="absolute z-20 -top-2 transition-all duration-200 pointer-events-none -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${(highlightedData.x / width) * 100}%` }}
            >
              <div className="bg-slate-900/95 border border-white/25 backdrop-blur-md px-2.5 py-1 rounded-xl text-center shadow-lg">
                <span className="text-[10px] text-cyan-200 font-medium block leading-none mb-0.5">
                  {highlightedData.data.label}
                </span>
                <span className="text-xs font-bold text-white tracking-tight leading-none">
                  {formatIdr(highlightedData.data.balance)}
                </span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-white/25" />
            </div>
          )}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="balanceWaveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gradient Fill under Curve */}
            <path d={areaD} fill="url(#balanceWaveGrad)" />

            {/* Glowing Stroke Curve */}
            <path
              d={pathD}
              fill="none"
              stroke="#67e8f9"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Points */}
            {points.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={activePointIndex === idx ? 5.5 : 3.5}
                className="fill-white stroke-blue-700 stroke-2 cursor-pointer transition-all hover:scale-125"
                onMouseEnter={() => {
                  playHapticSound('tap');
                  setActivePointIndex(idx);
                }}
                onClick={() => {
                  playHapticSound('tap');
                  setActivePointIndex(idx);
                }}
              />
            ))}
          </svg>
        </div>

        {/* Sub-bar Statistics */}
        <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-white/15 pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-blue-200/80 font-medium leading-none mb-1">Pemasukan</span>
            <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-0.5">
              <ArrowDownLeft size={11} strokeWidth={3} />
              +{formatIdr(monthIncome)}
            </span>
          </div>

          <div className="flex flex-col border-x border-white/10 px-2">
            <span className="text-[10px] text-blue-200/80 font-medium leading-none mb-1">Pengeluaran</span>
            <span className="text-xs font-extrabold text-rose-300 flex items-center gap-0.5">
              <ArrowUpRight size={11} strokeWidth={3} />
              -{formatIdr(monthExpense)}
            </span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-[10px] text-blue-200/80 font-medium leading-none mb-1">Arus Kas</span>
            <span
              className={`text-xs font-extrabold flex items-center justify-end gap-0.5 ${
                netCashflow.isSurplus ? 'text-cyan-200' : 'text-amber-300'
              }`}
            >
              <ArrowUpDown size={11} strokeWidth={2.5} />
              {netCashflow.formatted}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
