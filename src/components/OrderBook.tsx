import React, { useMemo } from 'react';
import { generate20LevelDepth } from '../utils/dataGenerator';

interface OrderBookProps {
  midPrice: number;
  symbol: string;
}

export const OrderBook: React.FC<OrderBookProps> = ({ midPrice, symbol }) => {
  // Generate levels based on active mid price
  const depth = useMemo(() => {
    return generate20LevelDepth(midPrice);
  }, [midPrice]);

  // Compute maximum sizes for drawing vertical visual bars
  const maxBidSize = useMemo(() => Math.max(...depth.bids.map(b => b.size), 1), [depth.bids]);
  const maxAskSize = useMemo(() => Math.max(...depth.asks.map(a => a.size), 1), [depth.asks]);

  return (
    <div className="bg-[#171b26] p-3 rounded-lg border border-[#2a2e39] font-mono text-xs text-gray-300 shadow-xl overflow-hidden h-full flex flex-col select-none">
      <div className="flex items-center justify-between border-b border-[#2a2e39] pb-2 mb-2">
        <span className="font-semibold text-gray-400">L2 ORDER BOOK (20 Levels)</span>
        <span className="text-[10px] uppercase text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded">{symbol}</span>
      </div>

      {/* Grid of Bids and Asks */}
      <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto max-h-[300px]">
        {/* Bids Column - Green */}
        <div className="flex flex-col gap-0.5">
          <div className="grid grid-cols-2 text-gray-500 text-[10px] pb-1 border-b border-[#222632]">
            <span>BID PRICE</span>
            <span className="text-right">SIZE</span>
          </div>
          {depth.bids.map((bid, i) => {
            const barWidth = (bid.size / maxBidSize) * 100;
            return (
              <div 
                key={`bid-${i}`} 
                id={`bid-row-${i}`}
                className="grid grid-cols-2 py-[2px] px-1 relative items-center hover:bg-[#1f222e]"
              >
                {/* Visual Depth Bar */}
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-emerald-950/45 transition-all duration-300"
                  style={{ width: `${barWidth}%`, pointerEvents: 'none' }}
                />
                <span className="text-emerald-400 font-medium z-10">{bid.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-right text-gray-400 z-10">{bid.size.toFixed(3)}</span>
              </div>
            );
          })}
        </div>

        {/* Asks Column - Red */}
        <div className="flex flex-col gap-0.5">
          <div className="grid grid-cols-2 text-gray-500 text-[10px] pb-1 border-b border-[#222632]">
            <span>ASK PRICE</span>
            <span className="text-right">SIZE</span>
          </div>
          {depth.asks.map((ask, i) => {
            const barWidth = (ask.size / maxAskSize) * 100;
            return (
              <div 
                key={`ask-${i}`} 
                id={`ask-row-${i}`}
                className="grid grid-cols-2 py-[2px] px-1 relative items-center hover:bg-[#1f222e]"
              >
                {/* Visual Depth Bar */}
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-rose-950/45 transition-all duration-300"
                  style={{ width: `${barWidth}%`, pointerEvents: 'none' }}
                />
                <span className="text-rose-400 font-medium z-10">{ask.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-right text-gray-400 z-10">{ask.size.toFixed(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Spread Indicator */}
      <div className="mt-2 text-[10px] text-gray-500 text-center border-t border-[#2a2e39] pt-2">
        Spread: <span className="text-gray-400 font-sans">
          {Number(Math.abs(depth.asks[0].price - depth.bids[0].price).toFixed(2))} (
          {((Math.abs(depth.asks[0].price - depth.bids[0].price) / midPrice) * 100).toFixed(4)}%)
        </span>
      </div>
    </div>
  );
};
