import React, { useState, useEffect, useRef } from 'react';
import { Search, Globe, ChevronRight, Hash, Clock, X } from 'lucide-react';
import { POPULAR_SYMBOLS } from '../utils/dataGenerator';
import { Timeframe } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
  onSelectTimeframe: (timeframe: Timeframe) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
  onSelectTimeframe,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle outside click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter systems
  const filteredSymbols = POPULAR_SYMBOLS.filter((sym) => {
    const combined = `${sym.symbol} ${sym.name} ${sym.category}`.toLowerCase();
    return combined.includes(query.toLowerCase());
  });

  const timeframes: { value: Timeframe; label: string }[] = [
    { value: '1s', label: '1 Second' },
    { value: '5s', label: '5 Seconds' },
    { value: '1m', label: '1 Minute' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' },
    { value: '1w', label: '1 Week' },
  ];

  const filteredTimeframes = timeframes.filter((tf) =>
    tf.label.toLowerCase().includes(query.toLowerCase()) || tf.value.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = filteredSymbols.length + filteredTimeframes.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      triggerSelection(selectedIndex);
    }
  };

  const triggerSelection = (index: number) => {
    if (index < filteredSymbols.length) {
      onSelectSymbol(filteredSymbols[index].symbol);
    } else {
      const tfIndex = index - filteredSymbols.length;
      if (filteredTimeframes[tfIndex]) {
        onSelectTimeframe(filteredTimeframes[tfIndex].value);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-55 flex items-start justify-center p-4 sm:p-10 backdrop-blur-xs">
      <div 
        className="bg-[#171b26] border border-[#2a2e39] w-full max-w-xl rounded-xl shadow-2xl overflow-hidden mt-10 md:mt-20 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Search header bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#2a2e39]">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a symbol, category or timeframe (e.g. BTC, EURUSD, 5m)..."
            className="bg-transparent w-full text-sm outline-none border-none text-gray-100 placeholder-gray-500"
          />
          <kbd className="hidden sm:block text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 font-mono">
            ESC
          </kbd>
          <button onClick={onClose} className="p-0.5 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results items scrolling view */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2 space-y-1 divide-y divide-[#202431]/20">
          {totalItems === 0 ? (
            <div className="p-6 text-center text-gray-500 text-xs">No matching tickers or timeframes found.</div>
          ) : (
            <>
              {/* Symbols */}
              {filteredSymbols.length > 0 && (
                <div className="py-1">
                  <div className="text-[10px] text-gray-500 uppercase font-mono px-3 py-1 tracking-wider font-semibold">TICKER SYMBOLS</div>
                  {filteredSymbols.map((sym, idx) => {
                    const isSel = idx === selectedIndex;
                    return (
                      <button
                        key={`sym-${sym.symbol}`}
                        onClick={() => {
                          onSelectSymbol(sym.symbol);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSel ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Globe className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-blue-400'}`} />
                          <div>
                            <span className="font-bold tracking-wide">{sym.symbol}</span>
                            <span className={`mx-2 text-[10px] ${isSel ? 'text-blue-100' : 'text-gray-400'}`}>{sym.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isSel ? 'bg-blue-700 text-white' : 'bg-gray-850 text-gray-400'}`}>
                            {sym.category}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Timeframes */}
              {filteredTimeframes.length > 0 && (
                <div className="py-1">
                  <div className="text-[10px] text-gray-500 uppercase font-mono px-3 py-1 tracking-wider font-semibold">TIMEFRAME PRESETS</div>
                  {filteredTimeframes.map((tf, idx) => {
                    const correctedIdx = idx + filteredSymbols.length;
                    const isSel = correctedIdx === selectedIndex;
                    return (
                      <button
                        key={`tf-${tf.value}`}
                        onClick={() => {
                          onSelectTimeframe(tf.value);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSel ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Clock className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-amber-400'}`} />
                          <span className="font-bold tracking-wide">{tf.value}</span>
                          <span className={`text-[10px] ${isSel ? 'text-blue-100' : 'text-gray-400'}`}>{tf.label}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Help footer */}
        <div className="bg-[#131722] border-t border-[#2a2e39] px-4 py-2 flex items-center justify-between text-[10px] text-gray-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>ENTER to select</span>
          </div>
          <span>Total items: {totalItems}</span>
        </div>
      </div>
    </div>
  );
};
