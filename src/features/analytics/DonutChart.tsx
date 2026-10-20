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

  let accumulatedPercent = 0;
  const slices = data.map((item) => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += item.percentage;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
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
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
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
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {highlightedItem ? highlightedItem.name : 'Total Pengeluaran'}
          </span>
          <span className="text-base font-black text-slate-900 tracking-tight leading-tight mt-0.5">
            {highlightedItem ? formatIdr(highlightedItem.amount) : formatIdr(totalAmount)}
          </span>
          {highlightedItem && (
            <span className="text-[10px] font-bold text-blue-600 mt-0.5">
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              selectedId === item.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate max-w-[100px]">{item.name}</span>
            <span className="text-[10px] opacity-75">{item.percentage.toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
};
