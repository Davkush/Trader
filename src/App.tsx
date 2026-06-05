import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart2, Search, Sliders, Play, Settings, Share2, Sparkles, 
  Trash2, X, ChevronDown, ChevronUp, Check, Info, Bell, AlertTriangle,
  ShoppingCart, Activity, BookOpen, Newspaper, BrainCircuit, Target, LineChart, Terminal
} from 'lucide-react';
import { 
  ChartPaneState, CandleData, Position, SystemPreferences, Timeframe, IndicatorSettings, SmartSignalOutput 
} from './types';
import { POPULAR_SYMBOLS, generateHistoricCandles } from './utils/dataGenerator';
import { TradingChart } from './components/TradingChart';
import { TradingPanel } from './components/TradingPanel';
import { StatsPanel } from './components/StatsPanel';
import { TradeHistory } from './components/TradeHistory';
import { CommandPalette } from './components/CommandPalette';
import { SettingsDrawer } from './components/SettingsDrawer';
import { AiQuantPanel } from './components/AiQuantPanel';
import { ClaudeTerminalPanel } from './components/ClaudeTerminalPanel';
import { fetchRealHistoricCandles, LiveDataProvider } from './services/liveData';
import { loadDrawings, saveDrawings } from './services/db';

export const PANE_THEMES: Record<number, { bg: string; text: string; border: string; shadow: string; ring: string }> = {
  1: { bg: 'bg-blue-600', text: 'text-blue-100', border: 'border-blue-600', shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.2)]', ring: 'ring-blue-500' },
  2: { bg: 'bg-red-600', text: 'text-red-100', border: 'border-red-600', shadow: 'shadow-[0_0_20px_rgba(220,38,38,0.2)]', ring: 'ring-red-500' },
  3: { bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-600', shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]', ring: 'ring-emerald-500' },
  4: { bg: 'bg-amber-600', text: 'text-amber-100', border: 'border-amber-600', shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]', ring: 'ring-amber-500' },
  5: { bg: 'bg-violet-600', text: 'text-violet-100', border: 'border-violet-600', shadow: 'shadow-[0_0_20px_rgba(139,92,246,0.2)]', ring: 'ring-violet-500' },
  6: { bg: 'bg-pink-600', text: 'text-pink-100', border: 'border-pink-600', shadow: 'shadow-[0_0_20px_rgba(236,72,153,0.2)]', ring: 'ring-pink-500' },
  7: { bg: 'bg-cyan-600', text: 'text-cyan-100', border: 'border-cyan-600', shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.2)]', ring: 'ring-cyan-500' },
  8: { bg: 'bg-orange-600', text: 'text-orange-100', border: 'border-orange-600', shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)]', ring: 'ring-orange-500' },
};

// Group popular symbols by category statically
const symbolsByCategory = (() => {
  const groups: Record<string, typeof POPULAR_SYMBOLS> = {};
  POPULAR_SYMBOLS.forEach(sym => {
    const cat = sym.category;
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(sym);
  });
  return groups;
})();

// Seed default indicators setup
const INITIAL_INDICATORS: IndicatorSettings = {
  ema20: true,
  ema50: false,
  ema80: false,
  ema200: false,
  vwap: false,
  bollingerBands: false,
  ichimoku: false,
  fvg: false,
  volumeProfile: true, // Enabled as requested
  macd: false,
  rsi: false,
  fractal: false,
  smartSignal: true,
  orderFlow: true,
  smcOrderBlocks: true,
  smcLiquiditySweeps: true,
  cvd: true,
  emaPeriods: [20, 50, 80, 200],
  rsiLength: 14,
  macdParams: [12, 26, 9],
  volumeProfileBins: 40,
  smartSignalParams: {
    emaFast: 20,
    emaMed: 50,
    emaSlow: 80,
    rsiLength: 14,
    rsiBuyMin: 40,
    rsiBuyMax: 65,
    rsiSellMin: 35,
    rsiSellMax: 60,
    volRatio: 1.1
  }
};

// Seed default panes state
function initializeDefaultPanes(count: number): ChartPaneState[] {
  const defaultSymbols = [
    'BTC', 'EURUSD', 'GOLD', 'AAPL', 
    'SPY', 'SPX', 'ETH', 'OIL'
  ];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `pane-${i + 1}`,
    symbol: defaultSymbols[i % defaultSymbols.length],
    timeframe: '1d',
    chartType: 'candlestick',
    isReplayMode: false,
    replayStartIndex: null,
    replayCurrentIndex: null,
    replaySpeed: 1,
    isPlaying: false,
    bookmarks: [],
    drawings: [],
    indicators: { ...INITIAL_INDICATORS },
    activeDrawingType: null,
    selectedElementForDeletion: null,
    l2depth: { bids: [], asks: [] }
  }));
}

export default function App() {
  // 1. System preferences
  const [prefs, setPrefs] = useState<SystemPreferences>(() => {
    const saved = localStorage.getItem('terminal_preferences');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return {
      chartCount: 2, // 1, 2, 4, 6, 8
      soundEnabled: true,
      hotkeysEnabled: true,
      themeAccent: 'blue',
      accountBalance: 10000,
      riskPercent: 1.0
    };
  });

  // Save preferences on update
  useEffect(() => {
    localStorage.setItem('terminal_preferences', JSON.stringify(prefs));
  }, [prefs]);

  // 1.5. Toggleable watch visibility state for each of the 8 windows
  const [visiblePaneIds, setVisiblePaneIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('terminal_visible_pane_ids');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ['pane-1', 'pane-2']; // default to 2 visible panes
  });

  useEffect(() => {
    localStorage.setItem('terminal_visible_pane_ids', JSON.stringify(visiblePaneIds));
  }, [visiblePaneIds]);

  // 2. Active Chart and trade parameters
  const [panes, setPanes] = useState<ChartPaneState[]>(() => {
    const saved = localStorage.getItem('terminal_panes_config');
    if (saved) {
      try {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list.length > 0) return list;
      } catch (e) {}
    }
    return initializeDefaultPanes(8);
  });

  const [focusedPaneId, setFocusedPaneId] = useState<string>('pane-1');

  // Auto-shift focus to a visible pane if current one gets hidden
  useEffect(() => {
    if (visiblePaneIds.length > 0 && !visiblePaneIds.includes(focusedPaneId)) {
      setFocusedPaneId(visiblePaneIds[0]);
    }
  }, [visiblePaneIds, focusedPaneId]);

  // Trade management
  const [positions, setPositions] = useState<Position[]>(() => {
    const saved = localStorage.getItem('terminal_positions_active');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [closedTrades, setClosedTrades] = useState<Position[]>(() => {
    const saved = localStorage.getItem('terminal_trades_history');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Keep state collections saved in localStorage
  useEffect(() => {
    // Strip drawings to keep localStorage lightweight, store drawings in IndexedDB instead
    const panesWithoutDrawings = panes.map(p => ({ ...p, drawings: [] }));
    localStorage.setItem('terminal_panes_config', JSON.stringify(panesWithoutDrawings));

    panes.forEach(p => {
       saveDrawings(p.id, p.drawings).catch(console.error);
    });
  }, [panes]);

  // Load drawings from IndexedDB on initial mount
  useEffect(() => {
    let mounted = true;
    (async () => {
       const copies = [...panes];
       let changed = false;
       for (const pane of copies) {
          try {
            const drawings = await loadDrawings(pane.id);
            if (drawings && drawings.length > 0) {
               pane.drawings = drawings;
               changed = true;
            }
          } catch(e) {}
       }
       if (mounted && changed) {
          setPanes(copies);
       }
    })();
    return () => { mounted = false };
  }, []); // run only once on mount

  useEffect(() => {
    localStorage.setItem('terminal_positions_active', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('terminal_trades_history', JSON.stringify(closedTrades));
  }, [closedTrades]);

  // Dynamic Historical Candle cash database
  const [historicDataCache, setHistoricDataCache] = useState<Record<string, CandleData[]>>({});

  // Trigger cache fetch on pane modifications
  useEffect(() => {
    panes.forEach(p => {
      const cacheKey = `${p.symbol}-${p.timeframe}`;
      if (!historicDataCache[cacheKey]) {
        // Optimistically set an empty array to prevent re-fetching
        setHistoricDataCache(prev => ({ ...prev, [cacheKey]: [] }));
        
        fetchRealHistoricCandles(p.symbol, p.timeframe, 600).then(rawBars => {
           if (rawBars.length === 0) {
             setHistoricDataCache(prev => ({ ...prev, [cacheKey]: generateHistoricCandles(p.symbol, p.timeframe, 600) }));
           } else {
             setHistoricDataCache(prev => ({ ...prev, [cacheKey]: rawBars }));
           }
        });
      }
    });
  }, [panes]);

  const alignedKeys = useRef<Set<string>>(new Set());

  // Sync historicDataCache with real Yahoo Finance prices when they are fetched
  useEffect(() => {
    const timer = setInterval(() => {
      setHistoricDataCache(currentCache => {
        let cacheUpdated = false;
        const newCache = { ...currentCache };

        Object.keys(newCache).forEach(cacheKey => {
          if (alignedKeys.current.has(cacheKey)) return; // Only align once

          const [symbol, timeframe] = cacheKey.split('-');
          const livePriceObj = LiveDataProvider.getInstance().getLatestPrice(symbol);
          
          if (livePriceObj && livePriceObj.price) {
            const candles = newCache[cacheKey];
            if (candles && candles.length > 0) {
              const lastCandle = candles[candles.length - 1];
              const diff = livePriceObj.price - lastCandle.close;
              
              // Shift the series to match Yahoo live price if they deviate notable
              // 0.2% block deviation to trigger alignment nicely
              if (Math.abs(diff) > lastCandle.close * 0.002) {
                const multiplier = livePriceObj.price / lastCandle.close;
                newCache[cacheKey] = candles.map(c => ({
                  ...c,
                  open: Number((c.open * multiplier).toFixed(4)),
                  high: Number((c.high * multiplier).toFixed(4)),
                  low: Math.max(0.0001, Number((c.low * multiplier).toFixed(4))),
                  close: Number((c.close * multiplier).toFixed(4))
                }));
                cacheUpdated = true;
                console.log(`Aligned ${cacheKey} candles by multiplier ${multiplier.toFixed(4)} to match Yahoo Live price: ${livePriceObj.price}`);
              }
              // Mark as aligned regardless, so we don't fight with the WebSocket
              alignedKeys.current.add(cacheKey);
            }
          }
        });

        return cacheUpdated ? newCache : currentCache;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Clear or wipe storage cache
  const handleWipeData = () => {
    localStorage.removeItem('terminal_panes_config');
    localStorage.removeItem('terminal_positions_active');
    localStorage.removeItem('terminal_trades_history');
    localStorage.removeItem('terminal_preferences');
    setPanes(initializeDefaultPanes(8));
    setPositions([]);
    setClosedTrades([]);
    setPrefs({
      chartCount: 2,
      soundEnabled: true,
      hotkeysEnabled: true,
      themeAccent: 'blue',
      accountBalance: 10000,
      riskPercent: 1.0
    });
    addToast('SUCCESS', 'All cached terminal settings wiped successfully.');
  };

  // 3. Modals and menus
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeRightPanel, setActiveRightPanel] = useState<'order' | 'stats' | 'history' | 'backtest' | 'autotrade' | 'terminal' | null>(null);
  const [toasts, setToasts] = useState<{ id: string; type: 'INFO' | 'SUCCESS' | 'WARN'; message: string }[]>([]);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);

  // Sound triggering helper using Web Audio API
  const playBeep = (frequency = 600, duration = 0.12) => {
    if (!prefs.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // audio context blocked by browser
    }
  };

  // Notification slide alert handler
  const addToast = (type: 'INFO' | 'SUCCESS' | 'WARN', message: string) => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Find active focused pane parameters
  const focusedPane = useMemo(() => {
    return panes.find(p => p.id === focusedPaneId) || panes[0];
  }, [panes, focusedPaneId]);

  const focusedCacheKey = `${focusedPane.symbol}-${focusedPane.timeframe}`;
  const focusedData = historicDataCache[focusedCacheKey] || [];
  const focusedLastCandle = focusedData[focusedData.length - 1] || null;
  const focusedPrice = focusedLastCandle ? focusedLastCandle.close : 100;

  // Active open order selector for focused symbol
  const activePosition = useMemo(() => {
    return positions.find(pos => pos.paneId === focusedPane.id && pos.status === 'OPEN') || null;
  }, [positions, focusedPane.id]);

  // Helper to split panes by active visibility selections
  const visiblePanes = useMemo(() => {
    return panes.filter(p => visiblePaneIds.includes(p.id));
  }, [panes, visiblePaneIds]);

  // Support responsive grid margins based on the number of currently active charts visible
  const gridLayoutClass = useMemo(() => {
    const visibleCount = visiblePanes.length;
    switch (visibleCount) {
      case 1: return 'grid-cols-1 md:grid-cols-1 h-full';
      case 2: return 'grid-cols-1 md:grid-cols-2 h-full gap-4';
      case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 h-full gap-3';
      case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 h-full gap-3';
      case 5:
      case 6: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 h-full gap-3';
      case 7:
      case 8: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 h-full gap-2';
      default: return 'grid-cols-1 md:grid-cols-2 h-full gap-4';
    }
  }, [visiblePanes.length]);

  // 4. Update individual pane helper function
  const handleUpdatePane = (paneId: string, updatedFields: Partial<ChartPaneState>) => {
    setPanes(prev => prev.map(p => {
      if (p.id === paneId) {
        return { ...p, ...updatedFields };
      }
      return p;
    }));
  };

  // Execute Market orders
  const handleExecuteTrade = (
    direction: 'BUY' | 'SELL',
    quantity: number,
    slDistance: number,
    tpDistance: number
  ) => {
    // Prevent overriding existing open positions
    if (activePosition) {
      addToast('WARN', `Already have an open trade for ${focusedPane.symbol} on this panel! Close it first.`);
      return;
    }

    const price = focusedPrice;
    const time = focusedLastCandle ? focusedLastCandle.time : Math.floor(Date.now() / 1000);

    const tpPrice = direction === 'BUY' ? price + tpDistance : price - tpDistance;
    const slPrice = direction === 'BUY' ? price - slDistance : price + slDistance;

    const newPos: Position = {
      id: Math.random().toString(),
      paneId: focusedPane.id,
      symbol: focusedPane.symbol,
      direction,
      entryPrice: Number(price.toFixed(2)),
      entryTime: time,
      quantity,
      tpPrice: Number(tpPrice.toFixed(2)),
      slPrice: Number(slPrice.toFixed(2)),
      status: 'OPEN'
    };

    setPositions(prev => [...prev, newPos]);
    playBeep(880, 0.15); // soft high pitch order fill alert
    addToast('SUCCESS', `${direction} order entry filled: ${quantity} units at $${price}`);
  };

  // Close trade manually or on SL/TP crossing hits
  const handleCloseTrade = (paneId: string, positionId: string, pnl: number, exitPrice: number) => {
    const pos = positions.find(p => p.id === positionId);
    if (!pos) return;

    // Calculate percentage change
    const grossVal = pos.entryPrice * pos.quantity;
    const pnlPercent = (pnl / grossVal) * 100;

    const closedPos: Position = {
      ...pos,
      status: 'CLOSED',
      exitPrice: Number(exitPrice.toFixed(2)),
      exitTime: Math.floor(Date.now() / 1000),
      pnl: Number(pnl.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2))
    };

    // Remove from active list
    setPositions(prev => prev.filter(p => p.id !== positionId));
    
    // Only push to history if it doesn't already exist to prevent duplicate keys
    setClosedTrades(prev => {
      if (prev.some(t => t.id === positionId)) return prev;
      return [...prev, closedPos];
    });

    // Update account balance
    setPrefs(prev => ({
      ...prev,
      accountBalance: Number((prev.accountBalance + pnl).toFixed(2))
    }));

    // Trigger audio beeps
    const isWin = pnl > 0;
    if (isWin) {
      playBeep(1200, 0.22); // triumphant high beep
      addToast('SUCCESS', `Win Trade! TP Hit on ${pos.symbol}: +$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    } else {
      playBeep(400, 0.25); // low buzz loss beep
      addToast('WARN', `Loss Trade! SL Hit on ${pos.symbol}: -$${Math.abs(pnl).toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    }
  };

  // Manual update of position limits (TP, SL line updates from chart dragging)
  const handleUpdatePositionPrice = (positionId: string, fields: Partial<Position>) => {
    setPositions(prev => prev.map(p => {
      if (p.id === positionId) {
        return { ...p, ...fields };
      }
      return p;
    }));
  };

  const handleChartSignal = (paneId: string, signal: SmartSignalOutput) => {
    if (!autoTradeEnabled) return;
    const existing = positions.find(pos => pos.paneId === paneId && pos.status === 'OPEN');
    if (existing) return; // avoid duplicates

    // find the pane
    const p = panes.find(x => x.id === paneId);
    if (!p) return;
    
    const direction = signal.signal === 'BUY' ? 'BUY' : 'SELL';
    
    const time = Math.floor(Date.now() / 1000);
    const tpPrice = signal.tp;
    const slPrice = signal.sl;

    const newPos: Position = {
      id: Math.random().toString(),
      paneId: p.id,
      symbol: p.symbol,
      direction,
      quantity: prefs.accountBalance * (prefs.riskPercent / 100) / signal.entry,
      entryPrice: signal.entry,
      tpPrice,
      slPrice,
      entryTime: time,
      status: 'OPEN'
    };

    setPositions(prev => [...prev, newPos]);
    addToast('SUCCESS', `AI AutoTrade: ${direction} Triggered on ${p.symbol}`);
    playBeep(direction === 'BUY' ? 800 : 300, 0.1);
  };

  // Recover shared links parameters inside the active URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (session) {
      try {
        const decoded = JSON.parse(atob(session));
        if (decoded && Array.isArray(decoded.panes)) {
          setPanes(prev => {
            const copy = [...prev];
            decoded.panes.forEach((sharedPane: any, i: number) => {
              if (copy[i]) {
                copy[i] = { ...copy[i], ...sharedPane };
              }
            });
            return copy;
          });
          if (decoded.visiblePaneIds && Array.isArray(decoded.visiblePaneIds)) {
            setVisiblePaneIds(decoded.visiblePaneIds);
          } else if (decoded.chartCount) {
            setVisiblePaneIds(Array.from({ length: decoded.chartCount }, (_, i) => `pane-${i + 1}`));
          }
          setPrefs(prev => ({ ...prev, chartCount: decoded.chartCount || prev.chartCount }));
          addToast('SUCCESS', 'Shared multi-chart session parameters imported successfully.');
        }
      } catch (e) {
        addToast('WARN', 'Shared session URL had illegal formats or parsing fails');
      }
    }
  }, []);

  // Encode setups and serialize URL parameters
  const handleCopySessionURL = () => {
    try {
      const payload = {
        chartCount: prefs.chartCount,
        visiblePaneIds,
        panes: panes.filter(p => visiblePaneIds.includes(p.id)).map(p => ({
          symbol: p.symbol,
          timeframe: p.timeframe,
          isReplayMode: p.isReplayMode,
          replayStartIndex: p.replayStartIndex,
          bookmarks: p.bookmarks
        }))
      };

      const base64 = btoa(JSON.stringify(payload));
      const shareUrl = `${window.location.origin}${window.location.pathname}?session=${base64}`;

      navigator.clipboard.writeText(shareUrl);
      playBeep(1000, 0.1);
      addToast('SUCCESS', 'Share URL encoded & copied to clipboard!');
    } catch (e) {
      addToast('WARN', 'Sharing failed on base64 translation bounds.');
    }
  };

  // 5. Setup active keyboard Hotkey hooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!prefs.hotkeysEnabled) return;
      
      // Ensure the user isn't filing/editing values inside interactive text boxes
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      // Hotkey maps
      switch (e.code) {
        // B (Buy Long)
        case 'KeyB':
          e.preventDefault();
          const p = 10; // default points
          const maxLossLoss = prefs.accountBalance * (prefs.riskPercent / 100);
          const autoQty = maxLossLoss / (p || 1);
          handleExecuteTrade('BUY', Math.max(0.1, Number(autoQty.toFixed(1))), p, p * 2);
          break;

        // S (Sell Short)
        case 'KeyS':
          e.preventDefault();
          const spLimit = 10;
          const maxLossLossS = prefs.accountBalance * (prefs.riskPercent / 100);
          const autoQtyS = maxLossLossS / (spLimit || 1);
          handleExecuteTrade('SELL', Math.max(0.1, Number(autoQtyS.toFixed(1))), spLimit, spLimit * 2);
          break;

        // Space (Replay Play/Pause)
        case 'Space':
          e.preventDefault();
          handleUpdatePane(focusedPane.id, { isPlaying: !focusedPane.isPlaying });
          break;

        // Right Arrow (Step Forward)
        case 'ArrowRight':
          e.preventDefault();
          if (focusedPane.isReplayMode && focusedPane.replayCurrentIndex !== null && focusedPane.replayCurrentIndex < focusedData.length - 1) {
            handleUpdatePane(focusedPane.id, { replayCurrentIndex: focusedPane.replayCurrentIndex + 1 });
          }
          break;

        // Left Arrow (Step Backward)
        case 'ArrowLeft':
          e.preventDefault();
          if (focusedPane.isReplayMode && focusedPane.replayCurrentIndex !== null && focusedPane.replayCurrentIndex > (focusedPane.replayStartIndex || 0)) {
            handleUpdatePane(focusedPane.id, { replayCurrentIndex: focusedPane.replayCurrentIndex - 1 });
          }
          break;

        // R (Toggle Replay)
        case 'KeyR':
          e.preventDefault();
          handleUpdatePane(focusedPane.id, { 
            isReplayMode: !focusedPane.isReplayMode,
            replayStartIndex: null,
            replayCurrentIndex: null,
            isPlaying: false 
          });
          break;

        // Escape (Cancel overlays)
        case 'Escape':
          e.preventDefault();
          handleUpdatePane(focusedPane.id, { activeDrawingType: null });
          break;

        // '=' or '+' to increase replay speed
        case 'Equal':
        case 'NumpadAdd':
          e.preventDefault();
          const sIndexList = [0.1, 0.3, 0.5, 1, 3, 10];
          const currSIndex = sIndexList.indexOf(focusedPane.replaySpeed);
          if (currSIndex >= 0 && currSIndex < sIndexList.length - 1) {
            handleUpdatePane(focusedPane.id, { replaySpeed: sIndexList[currSIndex + 1] });
          }
          break;

        // '-' to decrease replay speed
        case 'Minus':
        case 'NumpadSubtract':
          e.preventDefault();
          const sIndices = [0.1, 0.3, 0.5, 1, 3, 10];
          const currSIdx = sIndices.indexOf(focusedPane.replaySpeed);
          if (currSIdx > 0) {
            handleUpdatePane(focusedPane.id, { replaySpeed: sIndices[currSIdx - 1] });
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedPane, prefs, positions, focusedPrice, focusedLastCandle]);

  // Global Delete drawing element interceptor
  useEffect(() => {
    const handleDel = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (focusedPane.selectedElementForDeletion?.type === 'drawing') {
          handleUpdatePane(focusedPane.id, {
            drawings: focusedPane.drawings.filter(d => d.id !== focusedPane.selectedElementForDeletion?.id),
            selectedElementForDeletion: null
          });
          addToast('INFO', 'Drawing line removed.');
        }
      }
    };
    window.addEventListener('keydown', handleDel);
    return () => window.removeEventListener('keydown', handleDel);
  }, [focusedPane]);

  // Trigger Cmd/Ctrl-K search
  useEffect(() => {
    const handleCommandPaletteShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleCommandPaletteShortcut);
    return () => window.removeEventListener('keydown', handleCommandPaletteShortcut);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090c] flex flex-col font-sans select-none overflow-x-hidden text-gray-200">
      
      {/* 1. Global Navigation header */}
      <header className="bg-[#0b0e14]/80 backdrop-blur border-b border-[#171a25] py-3 px-5 flex flex-col lg:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="relative">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            <div className="absolute inset-0 bg-blue-500 blur-md opacity-40"></div>
          </div>
          <h1 className="font-bold tracking-tight text-sm uppercase text-white flex items-center gap-2">
            <span>SPLIT-SCREEN TERMINAL</span>
            <span className="text-[10px] font-mono select-none px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">v4.6</span>
          </h1>
        </div>

        {/* Dynamic selector controls */}
        <div className="flex flex-wrap items-center gap-3.5">
          {/* Chart counts selector */}
          <div className="flex items-center bg-[#131722] border border-[#2a2e39] rounded px-3 py-1.5 text-xs gap-1.5 font-mono">
            <span className="text-gray-400 font-sans text-[11px] uppercase mr-1">Active Windows:</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
              const id = `pane-${num}`;
              const isVisible = visiblePaneIds.includes(id);
              const theme = PANE_THEMES[num] || PANE_THEMES[1];
              return (
                <button
                  key={num}
                  onClick={() => {
                    setVisiblePaneIds(prev => {
                      if (prev.includes(id)) {
                        return prev.filter(pId => pId !== id);
                      } else {
                        return [...prev, id];
                      }
                    });
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] cursor-pointer font-bold transition-all ${
                    isVisible 
                      ? `${theme.bg} ${theme.text} font-extrabold scale-110 shadow-md` 
                      : 'bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                  title={`${isVisible ? 'Hide' : 'Show'} Chart Window ${num}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {/* Focused Ticker fast selectors */}
          <div className="flex items-center gap-1">
            <select
              value={focusedPane.symbol}
              onChange={(e) => handleUpdatePane(focusedPane.id, { symbol: e.target.value })}
              className="bg-[#131722] border border-[#2a2e39] rounded text-xs py-1.5 px-2.5 font-sans font-medium hover:border-gray-500 transition-colors cursor-pointer text-gray-200"
            >
              {Object.entries(symbolsByCategory).map(([category, items]) => (
                <optgroup key={category} label={category.toUpperCase()} className="bg-[#171b26] text-gray-400 font-mono text-[9px] tracking-wider font-semibold">
                  {items.map(item => (
                    <option key={item.symbol} value={item.symbol} className="bg-[#131722] text-gray-200 font-sans text-xs font-semibold normal-case">
                      {item.symbol} – {item.name.replace(/ \(Hyperliquid WS\)/g, '').replace(/ \(YFinance\)/g, '').replace(/ \(US Stock\)/g, '')}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Timeframe selector */}
            <select
              value={focusedPane.timeframe}
              onChange={(e) => handleUpdatePane(focusedPane.id, { timeframe: e.target.value as Timeframe })}
              className="bg-[#131722] border border-[#2a2e39] rounded text-xs py-1.5 px-2.5 font-sans font-medium hover:border-gray-500 transition-colors cursor-pointer"
            >
              {['1s', '5s', '1m', '5m', '15m', '1h', '4h', '1d', '1w'].map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>

          {/* Exit replay mode toggles */}
          {focusedPane.isReplayMode && (
            <button
              onClick={() => handleUpdatePane(focusedPane.id, { isReplayMode: false, replayStartIndex: null, replayCurrentIndex: null, isPlaying: false })}
              className="bg-rose-950/40 hover:bg-rose-900 border border-rose-900 text-rose-300 text-xs py-1.5 px-3 rounded-md font-medium cursor-pointer transition-colors"
            >
              Exit Replay Mode
            </button>
          )}

          {/* Settings / Commands Buttons */}
          <div className="flex items-center gap-2 border-l border-gray-700/50 pl-3">
            <button
              title="Search and Hotkeys Palette"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-1.5 rounded hover:bg-[#121620] border border-transparent hover:border-gray-700/30 text-gray-400 cursor-pointer transitions flex items-center justify-center"
            >
              <Search className="w-4 h-4 text-gray-300" />
            </button>
            <button
              title="Copy encoded Session URl"
              onClick={handleCopySessionURL}
              className="p-1.5 rounded hover:bg-[#121620] border border-transparent hover:border-gray-700/30 text-gray-400 cursor-pointer transitions flex items-center justify-center"
            >
              <Share2 className="w-4 h-4 text-gray-300" />
            </button>
            <button
              title="Preferences panel"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded hover:bg-[#121620] border border-transparent hover:border-gray-700/30 text-gray-400 cursor-pointer transitions flex items-center justify-center animate-spin-hover"
            >
              <Settings className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Primary layout body viewports */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left column split screens grid map (Grid of up to 8 responsive charts) */}
        <div className="flex-1 p-5 h-full overflow-hidden flex flex-col justify-between">
          <div className="flex flex-col justify-between h-full bg-[#121620]/45 border border-[#1e222e]/45 p-4 rounded-xl">
            {visiblePanes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 min-h-[440px] bg-[#121620]/65 rounded-lg border border-[#2a2e39]/50">
                <BarChart2 className="w-12 h-12 text-gray-600 mb-3 animate-pulse" />
                <h3 className="text-gray-300 font-semibold mb-1 text-sm">All Chart Windows Are Hidden</h3>
                <p className="text-gray-505 text-xs max-w-sm">
                  Click any of the active chart indicators <strong className="text-blue-450 text-xs font-mono">1 – 8</strong> in the top header menu to toggle windows visible on screen.
                </p>
              </div>
            ) : (
              <div className={`grid ${gridLayoutClass}`}>
                {visiblePanes.map((pane) => {
                  const isActive = pane.id === focusedPaneId;
                  const cacheKey = `${pane.symbol}-${pane.timeframe}`;
                  const data = historicDataCache[cacheKey] || [];
                  const panePosition = positions.find(p => p.paneId === pane.id && p.status === 'OPEN') || null;

                  return (
                    <div key={pane.id} className="min-h-[440px] flex-1">
                      <TradingChart
                        pane={pane}
                        paneIndex={parseInt(pane.id.split('-')[1])}
                        isActive={isActive}
                        onSelectPane={() => setFocusedPaneId(pane.id)}
                        onUpdatePane={(f) => handleUpdatePane(pane.id, f)}
                        historicData={data}
                        activePosition={panePosition}
                        onSignal={(signal) => handleChartSignal(pane.id, signal)}
                        onUpdatePosition={(p) => {
                          if (panePosition) {
                            handleUpdatePositionPrice(panePosition.id, p);
                          }
                        }}
                        onCloseTrade={(pnl, exitPrice) => {
                          if (panePosition) {
                            handleCloseTrade(pane.id, panePosition.id, pnl, exitPrice);
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick interactive hotkeys guide overlay at bottom */}
            {prefs.hotkeysEnabled && (
              <div className="bg-[#171b26]/80 border border-[#2a2e39] rounded-lg p-2.5 mt-4 text-[10px] text-gray-400 font-mono flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
                <div className="flex items-center gap-1.5 text-gray-500 uppercase font-sans">
                  <Sliders className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Hotkey Quick Legend:</span>
                </div>
                <div><kbd className="bg-[#121620] border border-[#252a36] px-1 rounded text-gray-200">B</kbd> BUY Long</div>
                <div><kbd className="bg-[#121620] border border-[#252a36] px-1 rounded text-gray-200">S</kbd> SELL Short</div>
                <div><kbd className="bg-[#121620] border border-[#252a36] px-1 rounded text-gray-200">Space</kbd> Play/Pause Replay</div>
                <div><kbd className="bg-[#121620] border border-[#252a36] px-1 rounded text-gray-200">← / →</kbd> Step Candle</div>
                <div><kbd className="bg-[#121620] border border-[#252a36] px-1 rounded text-gray-200">R</kbd> Toggle Replay Mode</div>
                <div><kbd className="bg-[#121620] border border-[#252a36] px-1 rounded text-gray-200">Esc</kbd> Cancel Line Tools</div>
                <div><kbd className="bg-[#121620] border border-[#252a36] px-1 rounded text-gray-200">+/-</kbd> Replay Speed</div>
              </div>
            )}
          </div>
        </div>

        {/* Right side operational Control sidebar panel */}
        <div className="flex h-full border-l border-[#2e3242]">
          
          {/* Expanded Panel Area */}
          {activeRightPanel && (
            <div className="w-80 bg-[#171b26] border-r border-[#2e3242] flex flex-col h-full overflow-y-auto scrollbar-thin">
              <div className="p-4 border-b border-[#2e3242] flex items-center justify-between sticky top-0 bg-[#171b26] z-10">
                <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
                  {activeRightPanel === 'order' && 'Order Execution'}
                  {activeRightPanel === 'stats' && 'Statistical Metrics'}
                  {activeRightPanel === 'history' && 'Trade Journal'}
                  {activeRightPanel === 'backtest' && 'Strategy Backtester'}
                  {activeRightPanel === 'autotrade' && 'Auto-Trade Execution'}
                  {activeRightPanel === 'terminal' && 'AI Quant Terminal'}
                </h2>
                <button 
                  onClick={() => setActiveRightPanel(null)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-0 flex-1 flex flex-col">
                {activeRightPanel === 'order' && (
                  <div className="p-4">
                    <TradingPanel
                      symbol={focusedPane.symbol}
                      currentPrice={focusedPrice}
                      accountBalance={prefs.accountBalance}
                      riskPercent={prefs.riskPercent}
                      onSetPreferences={(prefChanges) => setPrefs(prev => ({ ...prev, ...prefChanges }))}
                      onExecuteTrade={handleExecuteTrade}
                    />
                  </div>
                )}

                {activeRightPanel === 'stats' && (
                  <div className="p-4">
                    <StatsPanel
                      closedTrades={closedTrades}
                      initialBalance={10000}
                    />
                  </div>
                )}

                {activeRightPanel === 'history' && (
                  <div className="p-4">
                    <TradeHistory
                      closedTrades={closedTrades}
                      onClearHistory={() => {
                        setClosedTrades([]);
                        addToast('INFO', 'Historical trade logs cleared.');
                      }}
                    />
                  </div>
                )}

                {activeRightPanel === 'backtest' && (
                  <AiQuantPanel
                    symbol={focusedPane.symbol}
                    timeframe={focusedPane.timeframe}
                    data={focusedData}
                    autoTradeEnabled={autoTradeEnabled}
                    setAutoTradeEnabled={setAutoTradeEnabled}
                    mode="backtest"
                    pane={focusedPane}
                  />
                )}

                {activeRightPanel === 'autotrade' && (
                  <AiQuantPanel
                    symbol={focusedPane.symbol}
                    timeframe={focusedPane.timeframe}
                    data={focusedData}
                    autoTradeEnabled={autoTradeEnabled}
                    setAutoTradeEnabled={setAutoTradeEnabled}
                    mode="autotrade"
                    pane={focusedPane}
                  />
                )}

                {activeRightPanel === 'terminal' && (
                  <ClaudeTerminalPanel
                    pane={focusedPane}
                    data={focusedData}
                    onUpdatePane={(changes) => handleUpdatePane(focusedPane.id, changes)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Narrow Icon Strip */}
          <div className="w-14 shrink-0 bg-[#121620] flex flex-col items-center py-4 gap-4 z-20">
            <button
              onClick={() => setActiveRightPanel(prev => prev === 'backtest' ? null : 'backtest')}
              className={`p-2.5 rounded-lg cursor-pointer transition-colors ${activeRightPanel === 'backtest' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-[#1e2235] hover:text-blue-200'}`}
              title="Strategy Backtester"
            >
              <Activity className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveRightPanel(prev => prev === 'autotrade' ? null : 'autotrade')}
              className={`p-2.5 rounded-lg cursor-pointer transition-colors ${activeRightPanel === 'autotrade' ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:bg-[#1e2235] hover:text-emerald-200'}`}
              title="Auto-Trade Execution"
            >
              <Target className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveRightPanel(prev => prev === 'terminal' ? null : 'terminal')}
              className={`p-2.5 rounded-lg cursor-pointer transition-colors ${activeRightPanel === 'terminal' ? 'bg-violet-600/20 text-violet-400' : 'text-gray-400 hover:bg-[#1e2235] hover:text-violet-200'}`}
              title="AI Quant Terminal (Claude/OpenRouter)"
            >
              <Terminal className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveRightPanel(prev => prev === 'order' ? null : 'order')}
              className={`p-2.5 rounded-lg cursor-pointer transition-colors ${activeRightPanel === 'order' ? 'bg-blue-600/20 text-blue-500' : 'text-gray-400 hover:bg-[#1e2235] hover:text-gray-200'}`}
              title="Order Execution"
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveRightPanel(prev => prev === 'stats' ? null : 'stats')}
              className={`p-2.5 rounded-lg cursor-pointer transition-colors ${activeRightPanel === 'stats' ? 'bg-blue-600/20 text-blue-500' : 'text-gray-400 hover:bg-[#1e2235] hover:text-gray-200'}`}
              title="Statistical Metrics"
            >
              <LineChart className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveRightPanel(prev => prev === 'history' ? null : 'history')}
              className={`p-2.5 rounded-lg cursor-pointer transition-colors ${activeRightPanel === 'history' ? 'bg-blue-600/20 text-blue-500' : 'text-gray-400 hover:bg-[#1e2235] hover:text-gray-200'}`}
              title="Trade Journal"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            
            <div className="w-6 border-b border-gray-700/50 my-2"></div>

            <button
              className="p-2.5 rounded-lg cursor-not-allowed text-gray-600 transition-colors"
              title="News (Coming Soon)"
            >
              <Newspaper className="w-5 h-5 opacity-50" />
            </button>
          </div>
        </div>
      </main>

      {/* 4. Command Palette search overlay */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectSymbol={(symbol) => handleUpdatePane(focusedPane.id, { symbol })}
        onSelectTimeframe={(timeframe) => handleUpdatePane(focusedPane.id, { timeframe })}
      />

      {/* 5. Terminal Options Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        prefs={prefs}
        onUpdatePrefs={(up) => setPrefs(prev => ({ ...prev, ...up }))}
        onWipeData={handleWipeData}
      />

    </div>
  );
}
