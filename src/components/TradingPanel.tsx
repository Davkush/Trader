import React, { useState, useEffect } from 'react';
import { ShoppingBag, Landmark, ArrowUpRight, ArrowDownRight, Calculator, RefreshCw, Layers } from 'lucide-react';
import { SystemPreferences } from '../types';

interface TradingPanelProps {
  symbol: string;
  currentPrice: number;
  accountBalance: number;
  riskPercent: number;
  onSetPreferences: (prefChanges: Partial<SystemPreferences>) => void;
  onExecuteTrade: (direction: 'BUY' | 'SELL', quantity: number, slDistance: number, tpDistance: number) => void;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({
  symbol,
  currentPrice,
  accountBalance,
  riskPercent,
  onSetPreferences,
  onExecuteTrade,
}) => {
  // Local state inputs
  const [slPoints, setSlPoints] = useState<number>(30);
  const [tpPoints, setTpPoints] = useState<number>(90);
  const [manualQuantity, setManualQuantity] = useState<string>('');
  const [isAutoSized, setIsAutoSized] = useState<boolean>(true);

  // Maximum allowed dollar loss per transaction based on guidelines
  const maxCapRiskAmount = accountBalance * (riskPercent / 100);

  // Suggested mathematical volume quantity: maxRiskAmount / slPoints
  const suggestedQuantity = Math.max(0.01, Number((maxCapRiskAmount / (slPoints === 0 ? 1 : slPoints)).toFixed(2)));

  const activeQty = isAutoSized 
    ? suggestedQuantity 
    : Math.max(0.01, parseFloat(manualQuantity) || 1);

  // Reward-to-Risk ratio representation
  const riskRewardRatio = slPoints > 0 ? (tpPoints / slPoints).toFixed(1) : '0';

  // Handle auto-sizers updating local manuals when auto toggled
  useEffect(() => {
    if (isAutoSized) {
      setManualQuantity(suggestedQuantity.toString());
    }
  }, [suggestedQuantity, isAutoSized]);

  return (
    <div className="bg-[#171b26] border border-[#2a2e39] rounded-xl p-4.5 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#2a2e39] pb-2.5">
        <div className="flex items-center gap-1.5 animate-pulse">
          <ShoppingBag className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">ORDER EXECUTION CMD</h3>
        </div>
        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/25 ml-auto uppercase font-bold tracking-wide">
          {symbol}
        </span>
      </div>

      {/* Symbol Spot Price display bar */}
      <div className="bg-[#10131d] border border-gray-850/50 rounded-lg p-3 flex justify-between items-center">
        <div>
          <span className="text-[9px] uppercase font-mono text-gray-500 block">MARKET TICK PRICE</span>
          <span className="text-xl font-bold font-mono text-gray-100">${currentPrice.toFixed(4)}</span>
        </div>
        <div className="text-right">
          <span className="text-[9px] uppercase font-mono text-gray-500 block">ALLOWABLE RISK</span>
          <span className="text-xs font-bold font-mono text-emerald-450">${maxCapRiskAmount.toFixed(1)} <span className="text-[9px] text-gray-500">({riskPercent}%)</span></span>
        </div>
      </div>

      {/* Target execution inputs */}
      <div className="space-y-3.5">
        
        {/* Stop Loss & Take Profit limits input */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-mono text-rose-400 block tracking-wide">STOP LOSS (PTS)</span>
            <input
              type="number"
              min="1"
              value={slPoints}
              onChange={(e) => setSlPoints(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1.5 text-xs font-mono font-bold outline-none text-rose-300 focus:border-rose-800"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-mono text-emerald-450 block tracking-wide">TAKE PROFIT (PTS)</span>
            <input
              type="number"
              min="1"
              value={tpPoints}
              onChange={(e) => setTpPoints(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1.5 text-xs font-mono font-bold outline-none text-emerald-300 focus:border-emerald-800"
            />
          </div>
        </div>

        {/* Leverage / Position Sizing Selection */}
        <div className="space-y-2 bg-[#131722] p-3 rounded-lg border border-gray-850/60 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-gray-400 block">POSITION SIZING MODE</span>
            <button
              onClick={() => setIsAutoSized(!isAutoSized)}
              className={`p-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer transition-colors ${
                isAutoSized ? 'bg-blue-600/20 text-blue-450 border border-blue-500/20' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {isAutoSized ? 'AUTO-MATH SIZES' : 'MANUAL OVERRIDE'}
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1.5">
            <Layers className="w-3.5 h-3.5 text-gray-500" />
            {isAutoSized ? (
              <div className="flex-1 flex justify-between items-center">
                <span className="text-gray-450 text-[10px]">Calculated Volume:</span>
                <span className="font-mono font-bold text-gray-200 text-sm bg-[#171b26] border border-gray-850 px-2 py-0.5 rounded">{suggestedQuantity} units</span>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={manualQuantity}
                  onChange={(e) => setManualQuantity(e.target.value)}
                  placeholder="Quantity..."
                  className="w-full bg-[#171b26] border border-[#2a2e39] rounded px-2 py-1 text-xs font-mono font-bold text-gray-100 outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Execution keys */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => onExecuteTrade('BUY', activeQty, slPoints, tpPoints)}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold py-2.5 px-3.5 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all shadow-md group border-b-2 border-emerald-800"
          >
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-xs uppercase tracking-wider font-extrabold">BUY LONG</span>
            </div>
            <span className="text-[9px] text-emerald-200 mt-0.5 font-mono font-normal">Est SL: -${(activeQty * slPoints).toFixed(1)}</span>
          </button>

          <button
            onClick={() => onExecuteTrade('SELL', activeQty, slPoints, tpPoints)}
            className="bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-bold py-2.5 px-3.5 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all shadow-md group border-b-2 border-rose-800"
          >
            <div className="flex items-center gap-1">
              <ArrowDownRight className="w-4 h-4 text-rose-100 group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
              <span className="text-xs uppercase tracking-wider font-extrabold">SELL SHORT</span>
            </div>
            <span className="text-[9px] text-rose-200 mt-0.5 font-mono font-normal">Est SL: -${(activeQty * slPoints).toFixed(1)}</span>
          </button>
        </div>

        {/* Dynamic ratio check metrics */}
        <div className="bg-[#131722]/50 rounded-lg p-2.5 text-[10px] text-gray-500 font-mono flex items-center justify-between border border-gray-850/40">
          <span>R:R RATIO TARGET: <strong className="text-blue-400">{riskRewardRatio}</strong> (reward is {riskRewardRatio}x risk)</span>
          <Calculator className="w-3.5 h-3.5 text-gray-600" />
        </div>

      </div>
    </div>
  );
};
