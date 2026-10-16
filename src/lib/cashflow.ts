import { formatIdr } from './formatters';

export interface NetCashflowResult {
  net: number;
  isSurplus: boolean;
  formatted: string;
}

export function calculateNetCashflow(income: number, expense: number): NetCashflowResult {
  const net = income - expense;
  const isSurplus = net >= 0;
  const prefix = isSurplus ? '+' : '-';
  return {
    net,
    isSurplus,
    formatted: `${prefix}${formatIdr(Math.abs(net))}`,
  };
}
