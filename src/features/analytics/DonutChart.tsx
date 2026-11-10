import React, { useState } from 'react';
import { formatIdr } from '../../lib/formatters';
import { playHapticSound } from '../../lib/haptic';

export interface DonutSlice {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon?: string;
}

export interface DonutChartProps {
  data: DonutSlice[];
  totalAmount: number;
  selectedMonthLabel?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  totalAmount,
  selectedMonthLabel = 'Bulan Ini',
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(data[0]?.id || null);

  const size = 190;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Offset tiap irisan = jumlah persentase irisan sebelumnya (dihitung tanpa variabel yang di-reassign saat render)
  const slices = data.map((item, index) => {
    const precedingPercent = data.slice(0, index).reduce((sum, prev) => sum + prev.percentage, 0);
    return {
      ...item,
      strokeDasharray: `${(item.percentage / 100) * circumference} ${circumference}`,
      strokeDashoffset: -((precedingPercent / 100) * circumference),
    };
  });

  const highlightedItem = selectedId ? data.find((d) => d.id === selectedId) : null;

  return (
    <div className="flex flex-col items-center">
      {/* Donut SVG with Center Metric */}
      <div className="relative w-[190px] h-[190px] flex items-center justify-center my-1">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full -rotate-90 overflow-visible"
        >
          {/* Base Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-slate-100 dark:stroke-slate-700"
          />

          {/* Slices */}
          {slices.map((slice) => {
            const isSelected = selectedId === slice.id;
            return (
              <circle
                key={slice.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer hover:opacity-90"
                onClick={() => {
                  playHapticSound('tap');
                  setSelectedId(slice.id);
                }}
              />
            );
          })}
        </svg>

        {/* Center Cutout Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
            {highlightedItem ? highlightedItem.name : selectedMonthLabel}
          </span>
          <span className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight mt-0.5">
            {highlightedItem ? formatIdr(highlightedItem.amount) : formatIdr(totalAmount)}
          </span>
          {highlightedItem && (
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 mt-0.5">
              {highlightedItem.percentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Legend Pills below chart */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-sm">
        {data.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              playHapticSound('tap');
              setSelectedId(item.id);
            }}
            aria-pressed={selectedId === item.id}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              selectedId === item.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate max-w-[100px]">{item.name}</span>
            <span className="opacity-80">{item.percentage.toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
};
