import React, { useMemo } from 'react';
import { TrendingUp, AlertCircle, Percent, BarChart, CheckCircle2, XCircle } from 'lucide-react';
import { Position } from '../types';

interface StatsPanelProps {
  closedTrades: Position[];
  initialBalance: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ closedTrades, initialBalance }) => {
  // Compute analytics dynamically from closedTrades list
  const stats = useMemo(() => {
    const total = closedTrades.length;
    if (total === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        wins: 0,
        losses: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        expectancy: 0,
        netProfit: 0,
        equityCurve: [initialBalance]
      };
    }

    const winsList = closedTrades.filter((t) => (t.pnl || 0) > 0);
    const lossesList = closedTrades.filter((t) => (t.pnl || 0) <= 0);

    const winCount = winsList.length;
    const lossCount = lossesList.length;
    const winRate = (winCount / total) * 100;

    const sumPnL = closedTrades.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
    const totalGrossWins = winsList.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
    const totalGrossLosses = Math.abs(lossesList.reduce((acc, curr) => acc + (curr.pnl || 0), 0));

    const avgWin = winCount > 0 ? totalGrossWins / winCount : 0;
    const avgLoss = lossCount > 0 ? totalGrossLosses / lossCount : 0;

    const profitFactor = totalGrossLosses > 0 ? totalGrossWins / totalGrossLosses : totalGrossWins > 0 ? 99.9 : 0;
    const expectancy = sumPnL / total;

    const largestWin = winsList.length > 0 ? Math.max(...winsList.map((t) => t.pnl || 0)) : 0;
    const largestLoss = lossesList.length > 0 ? Math.min(...lossesList.map((t) => t.pnl || 0)) : 0;

    // Build incremental cumulative balance points
    let currentBal = initialBalance;
    const equityPoints = [initialBalance];
    closedTrades.forEach((t) => {
      currentBal += t.pnl || 0;
      equityPoints.push(currentBal);
    });

    return {
      totalTrades: total,
      winRate,
      wins: winCount,
      losses: lossCount,
      avgWin,
      avgLoss,
      profitFactor,
      largestWin,
      largestLoss,
      expectancy,
      netProfit: sumPnL,
      equityCurve: equityPoints
    };
  }, [closedTrades, initialBalance]);

  // Compute points for a miniature visual equity area map in SVG
  const svgPathData = useMemo(() => {
    const curve = stats.equityCurve;
    if (curve.length < 2) return '';
    const maxVal = Math.max(...curve);
    const minVal = Math.min(...curve);
    const valRange = maxVal - minVal || 1;

    const width = 360;
    const height = 45;
    
    const points = curve.map((val, idx) => {
      const x = (idx / (curve.length - 1)) * width;
      const y = height - ((val - minVal) / valRange) * height + 2; // offset padding
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(' L ')}`;
  }, [stats.equityCurve]);

  return (
    <div className="bg-[#171b26] border border-[#2a2e39] rounded-xl p-4.5 space-y-4">
      <div className="flex items-center gap-1.5 border-b border-[#2a2e39] pb-2.5">
        <TrendingUp className="w-4 h-4 text-blue-500" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">STATISTICAL METRICS</h3>
      </div>

      {closedTrades.length === 0 ? (
        <div className="py-4 text-center text-gray-550 text-xs flex flex-col items-center justify-center gap-1.5">
          <BarChart className="w-8 h-8 text-gray-700 animate-pulse" />
          <span>No closed trades in current logs.</span>
          <span className="text-[10px] text-gray-655 font-mono">Fill custom positions to see metrics.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Net Profit Indicator grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#131722] border border-[#202431] rounded p-2.5">
              <span className="text-[10px] font-semibold text-gray-400 block uppercase font-mono">NET REVENUE</span>
              <span className={`text-lg font-bold font-mono ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="bg-[#131722] border border-[#202431] rounded p-2.5">
              <span className="text-[10px] font-semibold text-gray-400 block uppercase font-mono">WIN PERCENT</span>
              <span className="text-lg font-bold font-mono text-blue-400 flex items-center gap-1">
                {stats.winRate.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Miniature SVG Equity area plot */}
          <div className="bg-[#10131d] border border-gray-850/50 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-[9px] uppercase font-mono text-gray-500 mb-1.5 block">EQUITY DRIFT TIMELINE ($)</span>
            {stats.equityCurve.length >= 2 ? (
              <div className="relative h-12 w-full mt-1">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Fill slope */}
                  {svgPathData && (
                    <>
                      <path
                        d={`${svgPathData} L 360,60 L 0,60 Z`}
                        fill="url(#curveGrad)"
                      />
                      <path
                        d={svgPathData}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </svg>
              </div>
            ) : null}
            <div className="flex justify-between text-[8px] text-gray-600 font-mono mt-1 pt-1 border-t border-gray-900">
              <span>WORTH: ${initialBalance}</span>
              <span>CURR: ${stats.equityCurve[stats.equityCurve.length - 1].toFixed(1)}</span>
            </div>
          </div>

          {/* Stats matrix grid details */}
          <div className="bg-[#131722] border border-[#1e222e] rounded p-3 space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-gray-840/20 pb-1">
              <span className="text-gray-400 font-sans">Total Closed:</span>
              <span className="font-bold text-gray-200">{stats.totalTrades}</span>
            </div>
            <div className="flex justify-between border-b border-gray-840/20 pb-1">
              <span className="text-gray-400 font-sans">Profit Factor:</span>
              <span className={`font-bold ${stats.profitFactor >= 1.5 ? 'text-green-400 animate-pulse' : stats.profitFactor >= 1.0 ? 'text-gray-200' : 'text-amber-500'}`}>
                {stats.profitFactor.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-840/20 pb-1">
              <span className="text-gray-400 font-sans">Avg Win / Loss:</span>
              <span className="font-bold text-gray-200">
                <span className="text-emerald-400">+${stats.avgWin.toFixed(1)}</span>
                <span className="text-gray-500 font-sans"> / </span>
                <span className="text-rose-450">-${stats.avgLoss.toFixed(1)}</span>
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-840/20 pb-1">
              <span className="text-gray-400 font-sans">Expectancy:</span>
              <span className={`font-bold ${stats.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-840/20 pb-1">
              <span className="text-gray-400 font-sans">Largest Win:</span>
              <span className="font-bold text-emerald-450">+${stats.largestWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-sans">Largest Loss:</span>
              <span className="font-bold text-rose-455">-${Math.abs(stats.largestLoss).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
