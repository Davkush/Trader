import React, { useState } from 'react';
import { BrainCircuit, Target, Activity } from 'lucide-react';
import { CandleData, ChartPaneState } from '../types';
import { calcSmartSignals } from './TradingChart';

interface AiQuantPanelProps {
  symbol: string;
  timeframe: string;
  data: CandleData[];
  autoTradeEnabled: boolean;
  setAutoTradeEnabled: (val: boolean) => void;
  mode: 'backtest' | 'autotrade';
  pane: ChartPaneState;
}

export const AiQuantPanel: React.FC<AiQuantPanelProps> = ({ symbol, timeframe, data, autoTradeEnabled, setAutoTradeEnabled, mode, pane }) => {
  const [btResult, setBtResult] = useState<{ 
    total: number; wins: number; rateStr: string; suggestion: string; 
    lastSignalTime?: string; lastSignalOutcome?: string; lastSignalType?: string;
    rateVal: number; prevRateVal?: number;
  } | null>(null);

  const runBacktest = () => {
    if (data.length < 100) return;
    const signals = calcSmartSignals(data, pane.indicators.smartSignalParams);
    if (!signals.length) return;

    let wins = 0;
    let losses = 0;
    let pending = 0;

    signals.forEach((sig) => {
      const idx = data.findIndex(d => d?.time === sig.time);
      if (idx === -1 || idx === data.length - 1) return;

      let resolved = false;
      for (let i = idx + 1; i < data.length; i++) {
        const c = data[i];
        if (!c) continue;
        if (sig.signal === 'BUY') {
          if (c.high >= sig.tp) { wins++; resolved = true; break; }
          if (c.low <= sig.sl) { losses++; resolved = true; break; }
        } else if (sig.signal === 'SELL') {
          if (c.low <= sig.tp) { wins++; resolved = true; break; }
          if (c.high >= sig.sl) { losses++; resolved = true; break; }
        }
      }
      if (!resolved) pending++;
    });

    const totalResolved = wins + losses;
    const total = signals.length;
    if (total === 0) return;

    const winRateVal = totalResolved > 0 ? (wins / totalResolved) : 0;
    const rateStr = (winRateVal * 100).toFixed(1) + "%";

    let suggestion = "";
    if (winRateVal >= 0.90) {
      suggestion = "Excellent! Win ratio is >= 90%. Backtester confirms these parameters are highly effective and correct.";
    } else if (winRateVal >= 0.75) {
       suggestion = "Moderate Performance. The Quant Assistant recommends evaluating new volatility/momentum parameters to push the win rate above 90%.";
    } else {
       suggestion = "Sub-optimal Performance (< 75%). The Quant Assistant suggests building or training a totally new strategy / parameter set for this asset.";
    }

    if (signals.length === 0) {
      setBtResult(null);
      return;
    }

    const lastSignalObj = signals[signals.length - 1];
    let lastSignalOutcome = "RUNNING";
    const date = new Date(lastSignalObj.time * 1000);
    const lastSignalTime = date.toLocaleTimeString();

    const lastIdx = data.findIndex(d => d?.time === lastSignalObj.time);
    if (lastIdx > -1 && lastIdx < data.length - 1) {
       for(let i = lastIdx + 1; i < data.length; i++) {
         const c = data[i];
         if (!c) continue;
         if (lastSignalObj.signal === 'BUY') {
            if (c.high >= lastSignalObj.tp) { lastSignalOutcome = "WIN"; break; }
            if (c.low <= lastSignalObj.sl) { lastSignalOutcome = "LOSS"; break; }
         } else {
            if (c.low <= lastSignalObj.tp) { lastSignalOutcome = "WIN"; break; }
            if (c.high >= lastSignalObj.sl) { lastSignalOutcome = "LOSS"; break; }
         }
       }
    }

    if (lastSignalOutcome === "RUNNING") {
      lastSignalOutcome = `PROBABILITY: ${rateStr}`;
    }

    setBtResult(prev => ({ 
      total, wins, rateStr, suggestion, lastSignalTime, lastSignalOutcome, lastSignalType: lastSignalObj.signal,
      rateVal: winRateVal, prevRateVal: prev ? prev.rateVal : undefined
    }));
  };

  return (
    <div className="flex flex-col h-full text-sm">
      <div className="flex flex-col items-center justify-center py-6 border-b border-[#2e3242] bg-[#121620]">
        {mode === 'backtest' ? (
          <Activity className="w-10 h-10 text-blue-400 mb-3" />
        ) : (
          <Target className="w-10 h-10 text-emerald-400 mb-3" />
        )}
        <h3 className="font-bold text-gray-100 tracking-wide">QUANT ASSISTANT</h3>
        <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-wider">
          {mode === 'backtest' ? 'Strategy Backtester' : 'Auto-Trading Module'}
        </p>
      </div>

      <div className="p-4 flex-1 flex flex-col overflow-y-auto">
        <div className="flex-1 space-y-6">
          
          {/* Backtester Section */}
          {mode === 'backtest' && (
          <div className="bg-[#121620] border border-[#2e3242] rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h4 className="text-[11px] text-gray-400 font-mono uppercase mb-4 flex items-center gap-2">
               <Activity className="w-4 h-4 text-blue-400" />
               Strategy Backtester
            </h4>
            <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">
              Evaluate the performance of the SmartSignals algorithm over historical data for {symbol} ({timeframe}) to measure the projected win-rate and identify optimal parameters.
            </p>
            <button 
              onClick={runBacktest}
              className="w-full mb-3 flex items-center justify-center py-2.5 rounded text-xs font-bold font-sans tracking-wide cursor-pointer text-gray-300 border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              Run Quick Backtest
            </button>

            {btResult && (
              <div className="mt-4 bg-[#0d1017] border border-[#2e3242] rounded-lg p-3 animate-in fade-in duration-300">
                <h5 className="text-[11px] font-bold text-gray-200 mb-3 border-b border-[#2e3242] pb-2">Historical Results (Smart Signals)</h5>
                <div className="grid grid-cols-2 gap-2 text-[10px] mb-4">
                  <div className="bg-[#1a1e29] p-2.5 rounded border border-[#2e3242]">
                    <div className="text-gray-500 mb-1 font-mono uppercase">Total Signals</div>
                    <div className="text-gray-200 font-mono text-sm">{btResult.total}</div>
                  </div>
                  <div className="bg-[#1a1e29] p-2.5 rounded border border-[#2e3242] flex flex-col justify-between">
                    <div className="text-gray-500 mb-1 font-mono uppercase">Win Rate</div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm font-bold ${parseFloat(btResult.rateStr as string) >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {btResult.rateStr}
                      </span>
                      {btResult.prevRateVal !== undefined && btResult.prevRateVal !== btResult.rateVal && (
                        <div className={`text-[9px] font-mono font-bold px-1 rounded ${btResult.rateVal > btResult.prevRateVal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {btResult.rateVal > btResult.prevRateVal ? '▲' : '▼'} {Math.abs((btResult.rateVal - btResult.prevRateVal) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[#1a1e29] p-2.5 rounded border border-[#2e3242] mb-4">
                  <div className="text-gray-500 mb-2 font-mono uppercase text-[10px]">Latest Signal ({btResult.lastSignalType})</div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-mono text-[10px]">{btResult.lastSignalTime}</span>
                    <span className={`font-bold font-mono text-[10px] ${
                      btResult.lastSignalOutcome === 'WIN' ? 'text-emerald-400' :
                      btResult.lastSignalOutcome === 'LOSS' ? 'text-rose-400' :
                      'text-blue-400'
                    }`}>
                      {btResult.lastSignalOutcome}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded text-[10.5px] text-blue-200 leading-relaxed font-sans">
                   <span className="font-bold text-blue-400">Quant AI:</span> {btResult.suggestion}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Auto Trade Section */}
          {mode === 'autotrade' && (
          <div className="bg-[#121620] border border-[#2e3242] rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h4 className="text-[11px] text-gray-400 font-mono uppercase mb-4 flex items-center gap-2">
               <Target className="w-4 h-4 text-emerald-400" />
               Auto-Trade Execution
            </h4>
            <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">
              When active, the Auto-Trader will automatically execute market orders when SmartSignals (Fractal Breakouts) trigger on any open chart pane.
            </p>
            <div
              onClick={() => setAutoTradeEnabled(!autoTradeEnabled)}
              className={`w-full py-3 rounded text-xs font-bold font-sans uppercase tracking-wide cursor-pointer transition-all border select-none ${
                  autoTradeEnabled 
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-600/30' 
                  : 'bg-[#1a1e29] text-gray-400 border-[#2e3242] hover:bg-[#252a36]'
              }`}
            >
                <div className="flex items-center justify-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${autoTradeEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
                  {autoTradeEnabled ? 'Auto-Trading Active' : 'Enable Auto-Trading'}
                </div>
            </div>
          </div>
          )}
          
        </div>
      </div>
    </div>
  );
};

