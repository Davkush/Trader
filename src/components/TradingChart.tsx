import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart, IChartApi, UTCTimestamp,
  CandlestickSeries, LineSeries, HistogramSeries, BaselineSeries
} from 'lightweight-charts';
import {
  Play, Pause, ChevronRight, RefreshCw, PenTool, Type, AlignJustify,
  Trash, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { ChartPaneState, CandleData, Position, Timeframe, SmartSignalOutput, IndicatorSettings } from '../types';
import { hyperliquidWS } from '../services/hyperliquidWS';
import { PromptModal } from './PromptModal';

// ─── Props ────────────────────────────────────────────────────────────────────
interface TradingChartProps {
  pane: ChartPaneState;
  paneIndex?: number;
  isActive: boolean;
  onSelectPane: () => void;
  onUpdatePane: (fields: Partial<ChartPaneState>) => void;
  historicData: CandleData[];
  activePosition: Position | null;
  onSignal?: (signal: SmartSignalOutput) => void;
  onUpdatePosition: (fields: Partial<Position>) => void;
  onCloseTrade: (pnl: number, exitPrice: number) => void;
}

const PANE_THEMES: Record<number, { bg: string; text: string; border: string; shadow: string; ring: string }> = {
  1: { bg: 'bg-blue-600', text: 'text-blue-100', border: 'border-blue-600', shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.2)]', ring: 'ring-blue-500' },
  2: { bg: 'bg-red-600', text: 'text-red-100', border: 'border-red-600', shadow: 'shadow-[0_0_20px_rgba(220,38,38,0.2)]', ring: 'ring-red-500' },
  3: { bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-600', shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]', ring: 'ring-emerald-500' },
  4: { bg: 'bg-amber-600', text: 'text-amber-100', border: 'border-amber-600', shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]', ring: 'ring-amber-500' },
  5: { bg: 'bg-violet-600', text: 'text-violet-100', border: 'border-violet-600', shadow: 'shadow-[0_0_20px_rgba(139,92,246,0.2)]', ring: 'ring-violet-500' },
  6: { bg: 'bg-pink-600', text: 'text-pink-100', border: 'border-pink-600', shadow: 'shadow-[0_0_20px_rgba(236,72,153,0.2)]', ring: 'ring-pink-500' },
  7: { bg: 'bg-cyan-600', text: 'text-cyan-100', border: 'border-cyan-600', shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.2)]', ring: 'ring-cyan-500' },
  8: { bg: 'bg-orange-600', text: 'text-orange-100', border: 'border-orange-600', shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)]', ring: 'ring-orange-500' },
};

// ─── Timeframe → seconds ─────────────────────────────────────────────────────
function tfToSeconds(tf: string): number {
  const map: Record<string, number> = {
    '1s': 1, '5s': 5, '1m': 60, '5m': 300,
    '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
  };
  return map[tf] ?? 86400;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────
function calcEMA(d: CandleData[], period: number): { time: UTCTimestamp; value: number }[] {
  const data = d.filter(Boolean);
  if (data.length < period) return [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let prev = sum / period;
  const k = 2 / (period + 1);
  const out = [{ time: data[period - 1].time as UTCTimestamp, value: prev }];
  for (let i = period; i < data.length; i++) {
    prev = data[i].close * k + prev * (1 - k);
    out.push({ time: data[i].time as UTCTimestamp, value: prev });
  }
  return out;
}

function calcRSI(d: CandleData[], period = 14): { time: UTCTimestamp; value: number }[] {
  const data = d.filter(Boolean);
  if (data.length < period + 1) return [];
  const out: { time: UTCTimestamp; value: number }[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push({ time: data[i].time as UTCTimestamp, value: Number((100 - 100 / (1 + rs)).toFixed(2)) });
  }
  return out;
}

function calcMACD(d: CandleData[], fast = 12, slow = 26, sigPeriod = 9): {
  macd: { time: UTCTimestamp; value: number }[];
  signal: { time: UTCTimestamp; value: number }[];
  hist: { time: UTCTimestamp; value: number; color: string }[];
} {
  const data = d.filter(Boolean);
  const ema12 = calcEMA(data, fast);
  const ema26 = calcEMA(data, slow);
  const offset12 = data.length - ema12.length;
  const offset26 = data.length - ema26.length;
  const macdLine: { time: UTCTimestamp; value: number }[] = [];
  const startIdx = Math.max(offset12, offset26);
  for (let i = startIdx; i < data.length; i++) {
    const e12 = ema12[i - offset12];
    const e26 = ema26[i - offset26];
    if (e12 && e26) macdLine.push({ time: data[i].time as UTCTimestamp, value: e12.value - e26.value });
  }
  const sigLine: { time: UTCTimestamp; value: number }[] = [];
  if (macdLine.length >= sigPeriod) {
    let prev = macdLine.slice(0, sigPeriod).reduce((s, v) => s + v.value, 0) / sigPeriod;
    sigLine.push({ time: macdLine[sigPeriod - 1].time, value: prev });
    const k = 2 / (sigPeriod + 1);
    for (let i = sigPeriod; i < macdLine.length; i++) {
      prev = macdLine[i].value * k + prev * (1 - k);
      sigLine.push({ time: macdLine[i].time, value: prev });
    }
  }
  const hist = sigLine.map((s, i) => {
    const m = macdLine[i + (macdLine.length - sigLine.length)];
    const v = m ? m.value - s.value : 0;
    return { time: s.time, value: v, color: v >= 0 ? '#089981' : '#f23645' };
  });
  return { macd: macdLine, signal: sigLine, hist };
}

function calcVWAP(d: CandleData[]): { time: UTCTimestamp; value: number }[] {
  let cpv = 0, cv = 0;
  return d.filter(Boolean).map(d => {
    const tp = (d.high + d.low + d.close) / 3;
    cpv += tp * d.volume; cv += d.volume;
    return { time: d.time as UTCTimestamp, value: Number((cpv / (cv || 1)).toFixed(4)) };
  });
}

function calcCVD(d: CandleData[]): { time: UTCTimestamp; value: number; color: string }[] {
  let cvd = 0;
  return d.filter(Boolean).map(d => {
    const range = d.high - d.low;
    let delta = 0;
    if (range > 0) {
      delta = ((d.close - d.open) / range) * d.volume * 0.8; 
    }
    cvd += delta;
    return { time: d.time as UTCTimestamp, value: cvd, color: delta >= 0 ? '#089981' : '#f23645' };
  });
}

function calcSMC(d: CandleData[]) {
  const data = d.filter(Boolean);
  const orderBlocks: { type: 'BULL' | 'BEAR', top: number, bottom: number, startIndex: number, time: number }[] = [];
  const sweeps: { type: 'BULL' | 'BEAR', price: number, time: number }[] = [];
  
  if (data.length < 10) return { orderBlocks, sweeps };

  let atrSum = 0;
  for(let i=1; i<=14 && i<data.length; i++) {
    atrSum += Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i-1].close), Math.abs(data[i].low - data[i-1].close));
  }
  let atr = atrSum / 14;

  for (let i = 1; i < data.length - 2; i++) {
    const c1 = data[i];
    const c2 = data[i+1];
    const c3 = data[i+2];
    
    // Bullish OB
    if (c1.close < c1.open && c2.close > c2.open && c3.close > c3.open) {
      const move = c3.close - c1.low;
      if (move > atr * 1.5) {
        orderBlocks.push({ type: 'BULL', top: c1.high, bottom: c1.low, startIndex: i, time: c1.time as number });
      }
    }
    // Bearish OB
    if (c1.close > c1.open && c2.close < c2.open && c3.close < c3.open) {
      const move = c1.high - c3.close;
      if (move > atr * 1.5) {
        orderBlocks.push({ type: 'BEAR', top: c1.high, bottom: c1.low, startIndex: i, time: c1.time as number });
      }
    }
    
    // Liquidity Sweeps
    if (c1.high > data[i-1].high && c1.close < data[i-1].high) {
      sweeps.push({ type: 'BEAR', price: c1.high, time: c1.time as number });
    }
    if (c1.low < data[i-1].low && c1.close > data[i-1].low) {
      sweeps.push({ type: 'BULL', price: c1.low, time: c1.time as number });
    }
  }
  
  return { orderBlocks, sweeps };
}

function calcBB(d: CandleData[], p = 20, mult = 2) {
  const data = d.filter(Boolean);
  if (data.length < p) return [];
  return data.slice(p - 1).map((_, idx) => {
    const i = idx + p - 1;
    const slice = data.slice(i - p + 1, i + 1);
    const mid = slice.reduce((s, c) => s + c.close, 0) / p;
    const std = Math.sqrt(slice.reduce((s, c) => s + (c.close - mid) ** 2, 0) / p);
    return { time: data[i].time, mid: Number(mid.toFixed(4)), upper: Number((mid + std * mult).toFixed(4)), lower: Number((mid - std * mult).toFixed(4)) };
  });
}

// Ichimoku Cloud
function calcIchimoku(d: CandleData[]) {
  const data = d.filter(Boolean);
  const high = (arr: CandleData[]) => Math.max(...arr.map(c => c.high));
  const low  = (arr: CandleData[]) => Math.min(...arr.map(c => c.low));
  const tenkan: { time: UTCTimestamp; value: number }[]  = [];
  const kijun:  { time: UTCTimestamp; value: number }[]  = [];
  const senkouA: { time: UTCTimestamp; value: number }[] = [];
  const senkouB: { time: UTCTimestamp; value: number }[] = [];
  const chikou:  { time: UTCTimestamp; value: number }[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i >= 8) {
      const t = (high(data.slice(i - 8, i + 1)) + low(data.slice(i - 8, i + 1))) / 2;
      tenkan.push({ time: data[i].time as UTCTimestamp, value: Number(t.toFixed(4)) });
    }
    if (i >= 25) {
      const k = (high(data.slice(i - 25, i + 1)) + low(data.slice(i - 25, i + 1))) / 2;
      kijun.push({ time: data[i].time as UTCTimestamp, value: Number(k.toFixed(4)) });
    }
    // Senkou A: avg of tenkan + kijun shifted +26
    if (i >= 25) {
      const tV = tenkan.find(x => x.time === (data[i].time as UTCTimestamp))?.value ?? 0;
      const kV = kijun.find(x => x.time === (data[i].time as UTCTimestamp))?.value ?? 0;
      if (tV && kV) senkouA.push({ time: data[i].time as UTCTimestamp, value: (tV + kV) / 2 });
    }
    if (i >= 51) {
      const s = (high(data.slice(i - 51, i + 1)) + low(data.slice(i - 51, i + 1))) / 2;
      senkouB.push({ time: data[i].time as UTCTimestamp, value: Number(s.toFixed(4)) });
    }
    if (i >= 26) {
      chikou.push({ time: data[i - 26].time as UTCTimestamp, value: data[i].close });
    }
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// Williams Fractal — marks local high/low over 5-bar window
function calcFractals(d: CandleData[]): { highs: { time: UTCTimestamp; price: number }[]; lows: { time: UTCTimestamp; price: number }[] } {
  const data = d.filter(Boolean);
  const highs: { time: UTCTimestamp; price: number }[] = [];
  const lows:  { time: UTCTimestamp; price: number }[] = [];
  for (let i = 2; i < data.length - 2; i++) {
    if (!data[i] || !data[i-1] || !data[i-2] || !data[i+1] || !data[i+2]) continue;
    const h = data[i].high;
    if (h > data[i-1].high && h > data[i-2].high && h > data[i+1].high && h > data[i+2].high) {
      highs.push({ time: data[i].time as UTCTimestamp, price: h });
    }
    const l = data[i].low;
    if (l < data[i-1].low && l < data[i-2].low && l < data[i+1].low && l < data[i+2].low) {
      lows.push({ time: data[i].time as UTCTimestamp, price: l });
    }
  }
  return { highs, lows };
}

// ─── SmartSignal Engine (ML-style, RR ≥ 1.5) ──────────────────────────────────
// Uses: trend regime detection (EMA stack), momentum (RSI), volatility (ATR),
// structure (BB squeeze), volume confirmation, fractal pivot entries.
// Only emits signal when expected RR ≥ 1.5.
export function calcSmartSignals(d: CandleData[], params?: IndicatorSettings['smartSignalParams']): SmartSignalOutput[] {
  const data = d.filter(Boolean);
  if (data.length < 60) return [];

  const p = params || {
    emaFast: 20, emaMed: 50, emaSlow: 80,
    rsiLength: 14,
    rsiBuyMin: 40, rsiBuyMax: 65,
    rsiSellMin: 35, rsiSellMax: 60,
    volRatio: 1.1
  };

  const emaFast = calcEMA(data, p.emaFast);
  const emaMed = calcEMA(data, p.emaMed);
  const emaSlow = calcEMA(data, p.emaSlow);
  const rsiArr = calcRSI(data, p.rsiLength);
  const { highs: fracHigh, lows: fracLow } = calcFractals(data);

  // ATR-14
  const atr: number[] = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i] || !data[i-1]) {
      atr.push(atr[atr.length - 1] ?? 0);
      continue;
    }
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low  - data[i - 1].close)
    );
    if (i === 1) { atr.push(tr); continue; }
    atr.push(atr[atr.length - 1] * 13 / 14 + tr / 14);
  }

  // Volume SMA-20
  const volSMA: number[] = [];
  for (let i = 19; i < data.length; i++) {
    const chunk = data.slice(i - 19, i + 1).filter(c => !!c);
    volSMA.push(chunk.reduce((s, c) => s + c.volume, 0) / Math.max(chunk.length, 1));
  }

  const signals: SmartSignalOutput[] = [];
  const fracHighSet = new Set(fracHigh.map(f => f.time));
  const fracLowSet  = new Set(fracLow.map(f  => f.time));
  const offset20 = data.length - emaFast.length;
  const offset50 = data.length - emaMed.length;
  const offset80 = data.length - emaSlow.length;

  let lastSignalBar = -50; // cooldown: min 5 bars between signals

  for (let i = 80; i < data.length - 1; i++) {
    if (!data[i] || !data[i - 1]) continue;
    if (i - lastSignalBar < 5) continue;

    const e20 = emaFast[i - offset20]?.value;
    const e50 = emaMed[i - offset50]?.value;
    const e80 = emaSlow[i - offset80]?.value;
    const rsi = rsiArr[i - (data.length - rsiArr.length)]?.value;
    const curATR = atr[i - 1] ?? atr[atr.length - 1];
    const volIdx = i - (data.length - volSMA.length - 19);
    const volRatio = volIdx >= 0 && volSMA[volIdx] ? data[i].volume / volSMA[volIdx] : 1;

    if (!e20 || !e50 || !e80 || !rsi) continue;

    const price = data[i].close;

    // Regime detection
    const bullTrend = e20 > e50 && e50 > e80 && price > e20;
    const bearTrend = e20 < e50 && e50 < e80 && price < e20;
    const isVolatile = curATR / price > 0.015;
    const regime: SmartSignalOutput['regime'] = isVolatile ? 'VOLATILE'
      : (bullTrend || bearTrend) ? 'TREND' : 'RANGE';

    // BB squeeze as low-volatility setup detector
    const bbSlice = data.slice(Math.max(0, i - 19), i + 1);
    const bbMid = bbSlice.reduce((s, c) => s + c.close, 0) / bbSlice.length;
    const bbStd = Math.sqrt(bbSlice.reduce((s, c) => s + (c.close - bbMid) ** 2, 0) / bbSlice.length);
    const bbWidth = (bbStd * 4) / bbMid; // normalized band width
    const isSqueeze = bbWidth < 0.02;

    // ── BUY signal conditions ──────────────────────────────────────────────
    const isFracLow = fracLowSet.has(data[i].time as UTCTimestamp);
    const buySetup = bullTrend
      && rsi > p.rsiBuyMin && rsi < p.rsiBuyMax                  // momentum not overbought
      && (isFracLow || isSqueeze)               // structure: fractal low or squeeze break
      && volRatio > p.volRatio                         // volume confirmation
      && data[i].close > data[i].open          // bullish bar
      && !isVolatile;

    // ── SELL signal conditions ─────────────────────────────────────────────
    const isFracHigh = fracHighSet.has(data[i].time as UTCTimestamp);
    const sellSetup = bearTrend
      && rsi > p.rsiSellMin && rsi < p.rsiSellMax
      && (isFracHigh || isSqueeze)
      && volRatio > p.volRatio
      && data[i].close < data[i].open          // bearish bar
      && !isVolatile;

    if (buySetup) {
      const entry = price;
      const sl    = Math.min(data[i].low, data[i - 1].low) - curATR * 0.5;
      const risk  = entry - sl;
      if (risk <= 0) continue;
      const tp    = entry + risk * 1.6;         // RR = 1.6 (≥ 1.5)
      const rr    = (tp - entry) / risk;
      // Confidence: composite score
      const conf  = Math.min(99, Math.round(
        40 + (rsi < 55 ? 15 : 5)
           + (volRatio > 1.5 ? 20 : volRatio > 1.2 ? 12 : 5)
           + (isFracLow ? 15 : 0)
           + (isSqueeze ? 10 : 0)
      ));
      signals.push({ time: data[i].time, signal: 'BUY', entry, tp, sl, rr: Number(rr.toFixed(2)), confidence: conf, regime });
      lastSignalBar = i;
    } else if (sellSetup) {
      const entry = price;
      const sl    = Math.max(data[i].high, data[i - 1].high) + curATR * 0.5;
      const risk  = sl - entry;
      if (risk <= 0) continue;
      const tp    = entry - risk * 1.6;
      const rr    = (entry - tp) / risk;
      const conf  = Math.min(99, Math.round(
        40 + (rsi > 45 ? 15 : 5)
           + (volRatio > 1.5 ? 20 : volRatio > 1.2 ? 12 : 5)
           + (isFracHigh ? 15 : 0)
           + (isSqueeze ? 10 : 0)
      ));
      signals.push({ time: data[i].time, signal: 'SELL', entry, tp, sl, rr: Number(rr.toFixed(2)), confidence: conf, regime });
      lastSignalBar = i;
    }
  }

  // Inject EXIT signals: when RSI crosses back to neutral after a signal
  return signals;
}

// ─── Volume Profile helper ─────────────────────────────────────────────────────
function calcVolumeProfile(data: CandleData[], bins = 40) {
  if (!data.length) return { profile: [], step: 0 };
  let min = Infinity, max = -Infinity;
  for (let d of data) {
    if (d.low < min) min = d.low;
    if (d.high > max) max = d.high;
  }
  const step = (max - min) / bins;
  const profile = new Array(bins).fill(0);
  for (let d of data) {
    const avg = (d.high + d.low + d.close) / 3;
    let idx = Math.floor((avg - min) / step);
    if (idx >= bins) idx = bins - 1;
    profile[idx] += d.volume;
  }
  return { profile: profile.map((vol, i) => ({ price: min + step * (i + 0.5), vol })), step };
}

// ─── DragHandle for Resizable Panes ──────────────────────────────────────────
const DragHandle = ({ onDrag }: { onDrag: (dy: number) => void }) => {
  return (
    <div 
      className="h-1 bg-[#2a2e39] cursor-row-resize hover:bg-blue-500 z-10 transition-colors"
      onPointerDown={(e) => {
        let lastY = e.clientY;
        const onMove = (ev: PointerEvent) => {
          onDrag(ev.clientY - lastY);
          lastY = ev.clientY;
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      }}
    />
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export const TradingChart: React.FC<TradingChartProps> = ({
  pane, paneIndex, isActive, onSelectPane, onUpdatePane,
  historicData, activePosition, onUpdatePosition, onCloseTrade, onSignal
}) => {
  const chartContainerRef  = useRef<HTMLDivElement>(null);
  const rsiContainerRef    = useRef<HTMLDivElement>(null);
  const macdContainerRef   = useRef<HTMLDivElement>(null);
  const cvdContainerRef    = useRef<HTMLDivElement>(null);
  const drawingCanvasRef   = useRef<HTMLCanvasElement>(null);
  const chartRef           = useRef<IChartApi | null>(null);
  const rsiChartRef        = useRef<IChartApi | null>(null);
  const macdChartRef       = useRef<IChartApi | null>(null);
  const cvdChartRef        = useRef<IChartApi | null>(null);
  const candleSeriesRef    = useRef<any>(null);
  const [currentLivePrice, setCurrentLivePrice] = useState<number | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number; price: number; time: number }[]>([]);
  const [latestSignal, setLatestSignal] = useState<SmartSignalOutput | null>(null);
  const previousSignalRef  = useRef<string | null>(null);

  const [rsiHeight, setRsiHeight] = useState(120);
  const [macdHeight, setMacdHeight] = useState(120);

  const [cvdHeight, setCvdHeight] = useState(120);
  
  const [promptConfig, setPromptConfig] = useState<{isOpen: boolean; title: string; defaultVal: string; onConfirm: (v:string)=>void} | null>(null);

  // Sub-pane heights: RSI + MACD rendered below main chart
  const showRSI  = pane.indicators.rsi;
  const showMACD = pane.indicators.macd;
  const showCVD  = pane.indicators.cvd;
  const subPaneCount = (showRSI ? 1 : 0) + (showMACD ? 1 : 0) + (showCVD ? 1 : 0);

  const visibleData = useMemo(() => {
    if (!pane.isReplayMode || pane.replayCurrentIndex === null) return historicData;
    return historicData.slice(0, pane.replayCurrentIndex + 1);
  }, [historicData, pane.isReplayMode, pane.replayCurrentIndex]);

  const lastPriceValue = useMemo(() => {
    if (pane.isReplayMode && pane.replayCurrentIndex !== null && historicData[pane.replayCurrentIndex]) {
      return historicData[pane.replayCurrentIndex].close;
    }
    return currentLivePrice ?? (historicData.length > 0 ? historicData[historicData.length - 1].close : 100);
  }, [historicData, pane.isReplayMode, pane.replayCurrentIndex, currentLivePrice]);

  // Smart signals computed from historicData to preserve accurate indicator context
  const smartSignals = useMemo(() => {
    if (!pane.indicators.smartSignal) return [];
    return calcSmartSignals(historicData, pane.indicators.smartSignalParams);
  }, [historicData, pane.indicators.smartSignal, pane.indicators.smartSignalParams]);

  // SMC data computed from visibleData
  const smcData = useMemo(() => {
    if (!pane.indicators.smcOrderBlocks && !pane.indicators.smcLiquiditySweeps) return { orderBlocks: [], sweeps: [] };
    return calcSMC(visibleData);
  }, [visibleData, pane.indicators.smcOrderBlocks, pane.indicators.smcLiquiditySweeps]);

  // Update latest signal state for the badge and emit event
  useEffect(() => {
    if (smartSignals.length > 0) {
      const latest = smartSignals[smartSignals.length - 1];
      setLatestSignal(latest);
      
      const sigId = `${latest.time}-${latest.type}`;
      if (previousSignalRef.current !== sigId) {
        previousSignalRef.current = sigId;
        if (onSignal) onSignal(latest);
      }
    }
  }, [smartSignals, onSignal]);

  // ── Live price subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (pane.isReplayMode) return;
    const unsub = hyperliquidWS.subscribe(pane.symbol, (price) => {
      setCurrentLivePrice(price);
      if (activePosition?.status === 'OPEN') {
        const { direction, entryPrice, slPrice, tpPrice, quantity } = activePosition;
        let isClosed = false;
        let pnl = direction === 'BUY' ? (price - entryPrice) * quantity : (entryPrice - price) * quantity;
        if (direction === 'BUY') {
          if (tpPrice && price >= tpPrice) isClosed = true;
          if (slPrice && price <= slPrice) isClosed = true;
        } else {
          if (tpPrice && price <= tpPrice) isClosed = true;
          if (slPrice && price >= slPrice) isClosed = true;
        }
        if (isClosed) onCloseTrade(pnl, price);
      }
      if (candleSeriesRef.current && historicData.length > 0) {
        const tfSecs = tfToSeconds(pane.timeframe);
        const nowSec = Math.floor(Date.now() / 1000);
        const last = historicData[historicData.length - 1];
        if (!last) return;
        
        // Ensure we handle non-modular origins by maintaining the time phase of the historical source
        const offset = last.time % tfSecs;
        
        // Find the most recent strictly aligned interval boundary containing nowSec
        let alignedNowSec = Math.floor(nowSec / tfSecs) * tfSecs + offset;
        if (alignedNowSec > nowSec) {
           alignedNowSec -= tfSecs;
        }

        if (alignedNowSec <= last.time) {
          last.high = Math.max(last.high, price);
          last.low  = Math.min(last.low,  price);
          last.close = price;
          candleSeriesRef.current.update(last as any);
        } else {
          // Cross-boundary execution
          // Fill gaps if there are any (e.g. websocket disconnects)
          for (let missedTime = last.time + tfSecs; missedTime < alignedNowSec; missedTime += tfSecs) {
            const gapBar: CandleData = { time: missedTime, open: last.close, high: last.close, low: last.close, close: last.close, volume: 0 };
            historicData.push(gapBar);
            candleSeriesRef.current.update(gapBar as any);
          }
          
          const bar: CandleData = { time: alignedNowSec, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price, volume: 100 };
          historicData.push(bar);
          if (historicData.length > 1500) {
            historicData.splice(0, historicData.length - 1500);
          }
          candleSeriesRef.current.update(bar as any);
        }
      }
    });
    return () => unsub();
  }, [pane.symbol, pane.isReplayMode, pane.timeframe, historicData, activePosition, onCloseTrade]);

  // ── Replay timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pane.isReplayMode || !pane.isPlaying || pane.replayCurrentIndex === null) return;
    const speeds: Record<number, number> = { 0.1: 10000, 0.3: 3000, 0.5: 2000, 1: 1000, 3: 330, 10: 100 };
    const timer = setInterval(() => {
      const next = pane.replayCurrentIndex! + 1;
      if (next >= historicData.length) { onUpdatePane({ isPlaying: false }); return; }
      onUpdatePane({ replayCurrentIndex: next });
      if (activePosition) {
        const c = historicData[next];
        const { direction, entryPrice, slPrice, tpPrice, quantity } = activePosition;
        let hit: number | null = null;
        if (direction === 'BUY') {
          if (tpPrice && c.high >= tpPrice) hit = tpPrice;
          else if (slPrice && c.low <= slPrice) hit = slPrice;
        } else {
          if (tpPrice && c.low <= tpPrice) hit = tpPrice;
          else if (slPrice && c.high >= slPrice) hit = slPrice;
        }
        if (hit !== null) {
          const pnl = direction === 'BUY' ? (hit - entryPrice) * quantity : (entryPrice - hit) * quantity;
          onCloseTrade(pnl, hit);
        }
      }
    }, speeds[pane.replaySpeed] ?? 1000);
    return () => clearInterval(timer);
  }, [pane.isReplayMode, pane.isPlaying, pane.replayCurrentIndex, pane.replaySpeed, historicData, activePosition, onCloseTrade]);

  // ── Main chart build ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width:  chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 340,
      layout: { background: { color: '#090b10' }, textColor: '#d1d4dc', fontFamily: 'Inter, system-ui, sans-serif' },
      grid:   { vertLines: { color: 'rgba(42,46,57,0.06)' }, horzLines: { color: 'rgba(42,46,57,0.06)' } },
      timeScale: { borderColor: '#1e222e', timeVisible: true, secondsVisible: ['1s','5s'].includes(pane.timeframe) },
      rightPriceScale: { borderColor: '#1e222e', minimumWidth: 80 },
      crosshair: { vertLine: { color: '#5a6a8a', width: 1, style: 3 }, horzLine: { color: '#5a6a8a', width: 1, style: 3 } },
    }) as any;
    chartRef.current = chart;

    const cSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#089981', downColor: '#f23645',
      borderVisible: false, wickUpColor: '#089981', wickDownColor: '#f23645',
    });
    candleSeriesRef.current = cSeries;
    if (visibleData.length > 0) cSeries.setData(visibleData as any);

    const ind = pane.indicators;

    // EMA overlays
    const addEMA = (period: number, color: string) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1.2, title: `EMA${period}`, priceLineVisible: false, lastValueVisible: false });
      s.setData(calcEMA(visibleData, period) as any);
    };
    if (ind.ema20)  addEMA(ind.emaPeriods?.[0] || 20,  '#f59e0b');
    if (ind.ema50)  addEMA(ind.emaPeriods?.[1] || 50,  '#3b82f6');
    if (ind.ema80)  addEMA(ind.emaPeriods?.[2] || 80,  '#a78bfa');
    if (ind.ema200) addEMA(ind.emaPeriods?.[3] || 200, '#ec4899');

    // VWAP
    if (ind.vwap) {
      const s = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1.2, title: 'VWAP', priceLineVisible: false, lastValueVisible: false });
      s.setData(calcVWAP(visibleData) as any);
    }

    // Bollinger Bands
    if (ind.bollingerBands) {
      const bb = calcBB(visibleData);
      const opt = { lineWidth: 0.8, priceLineVisible: false, lastValueVisible: false };
      const mid = chart.addSeries(LineSeries, { ...opt, color: '#22c55e', title: 'BB Mid' });
      const up  = chart.addSeries(LineSeries, { ...opt, color: '#4ade8088', lineStyle: 2, title: 'BB Up' });
      const dn  = chart.addSeries(LineSeries, { ...opt, color: '#4ade8088', lineStyle: 2, title: 'BB Lo' });
      mid.setData(bb.map(b => ({ time: b.time, value: b.mid })) as any);
      up.setData(bb.map(b => ({ time: b.time, value: b.upper })) as any);
      dn.setData(bb.map(b => ({ time: b.time, value: b.lower })) as any);
    }

    // Ichimoku Cloud
    if (ind.ichimoku) {
      const ich = calcIchimoku(visibleData);
      const lineOpts = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false };
      chart.addSeries(LineSeries, { ...lineOpts, color: '#f97316', title: 'Tenkan' }).setData(ich.tenkan as any);
      chart.addSeries(LineSeries, { ...lineOpts, color: '#60a5fa', title: 'Kijun' }).setData(ich.kijun as any);
      chart.addSeries(LineSeries, { ...lineOpts, color: '#34d39944', title: 'Senkou A' }).setData(ich.senkouA as any);
      chart.addSeries(LineSeries, { ...lineOpts, color: '#f8717144', title: 'Senkou B' }).setData(ich.senkouB as any);
      chart.addSeries(LineSeries, { ...lineOpts, color: '#a3a3a388', lineStyle: 2, title: 'Chikou' }).setData(ich.chikou as any);
    }

    // Horizontal Sync
    chart.timeScale().subscribeVisibleTimeRangeChange((range: any) => {
      drawUserOverlay();
      if (range) {
        try { if (rsiChartRef.current) (rsiChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (macdChartRef.current) (macdChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (cvdChartRef.current) (cvdChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
      }
    });

    const resizer = new ResizeObserver(entries => {
      for (const e of entries) {
        if (chartRef.current) {
          try { chartRef.current.resize(e.contentRect.width, e.contentRect.height); } catch {}
          drawUserOverlay();
        }
      }
    });
    resizer.observe(chartContainerRef.current);

    const timerId = setTimeout(() => { try { chart.timeScale().fitContent(); drawUserOverlay(); } catch {} }, 150);

    return () => {
      clearTimeout(timerId);
      resizer.disconnect();
      try { chart.remove(); } catch {}
      chartRef.current = null;
    };
  }, [visibleData, pane.indicators, pane.symbol, pane.timeframe]);

  // ── RSI sub-chart ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showRSI || !rsiContainerRef.current) return;
    const chart = createChart(rsiContainerRef.current, {
      width: rsiContainerRef.current.clientWidth, height: rsiContainerRef.current.clientHeight || 80,
      layout: { background: { color: '#090b10' }, textColor: '#6b7280', fontFamily: 'Inter, system-ui, sans-serif' },
      grid: { vertLines: { color: 'rgba(42,46,57,0.04)' }, horzLines: { color: 'rgba(42,46,57,0.04)' } },
      timeScale: { visible: false },
      rightPriceScale: { borderColor: '#1e222e', scaleMargins: { top: 0.05, bottom: 0.05 }, minimumWidth: 80 },
    }) as any;
    rsiChartRef.current = chart;
    const rsiLength = pane.indicators.rsiLength || 14;
    const rsiData = calcRSI(visibleData, rsiLength);
    const s = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true, title: 'RSI' });
    s.setData(rsiData as any);
    // Overbought/oversold lines
    const ob = chart.addSeries(LineSeries, { color: '#f2364560', lineWidth: 0.8, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    const os = chart.addSeries(LineSeries, { color: '#08998160', lineWidth: 0.8, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    ob.setData(rsiData.map(d => ({ time: d.time, value: 70 })) as any);
    os.setData(rsiData.map(d => ({ time: d.time, value: 30 })) as any);

    // Sync time scale with main chart
    if (chartRef.current) {
      const range = (chartRef.current as any).timeScale().getVisibleRange();
      if (range) chart.timeScale().setVisibleRange(range);
    }
    chart.timeScale().subscribeVisibleTimeRangeChange((range: any) => {
      if (range) {
        try { if (chartRef.current) (chartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (macdChartRef.current) (macdChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (cvdChartRef.current) (cvdChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
      }
    });
    const resizer = new ResizeObserver(e => { for (const en of e) { try { if (rsiChartRef.current) rsiChartRef.current.resize(en.contentRect.width, en.contentRect.height); } catch {} } });
    resizer.observe(rsiContainerRef.current);
    return () => { resizer.disconnect(); try { chart.remove(); } catch {} rsiChartRef.current = null; };
  }, [visibleData, showRSI]);

  // ── MACD sub-chart ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showMACD || !macdContainerRef.current) return;
    const chart = createChart(macdContainerRef.current, {
      width: macdContainerRef.current.clientWidth, height: macdContainerRef.current.clientHeight || 80,
      layout: { background: { color: '#090b10' }, textColor: '#6b7280', fontFamily: 'Inter, system-ui, sans-serif' },
      grid: { vertLines: { color: 'rgba(42,46,57,0.04)' }, horzLines: { color: 'rgba(42,46,57,0.04)' } },
      timeScale: { visible: false },
      rightPriceScale: { borderColor: '#1e222e', scaleMargins: { top: 0.1, bottom: 0.1 }, minimumWidth: 80 },
    }) as any;
    macdChartRef.current = chart;
    const pFast = pane.indicators.macdParams?.[0] || 12;
    const pSlow = pane.indicators.macdParams?.[1] || 26;
    const pSig  = pane.indicators.macdParams?.[2] || 9;
    const { macd, signal, hist } = calcMACD(visibleData, pFast, pSlow, pSig);
    chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }).setData(hist as any);
    chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1.2, priceLineVisible: false, lastValueVisible: false, title: 'MACD' }).setData(macd as any);
    chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1.0, priceLineVisible: false, lastValueVisible: false, title: 'Signal' }).setData(signal as any);
    
    // Sync time scale with main chart
    if (chartRef.current) {
      const range = (chartRef.current as any).timeScale().getVisibleRange();
      if (range) chart.timeScale().setVisibleRange(range);
    }
    chart.timeScale().subscribeVisibleTimeRangeChange((range: any) => {
      if (range) {
        try { if (chartRef.current) (chartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (rsiChartRef.current) (rsiChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (cvdChartRef.current) (cvdChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
      }
    });

    const resizer = new ResizeObserver(e => { for (const en of e) { try { if (macdChartRef.current) macdChartRef.current.resize(en.contentRect.width, en.contentRect.height); } catch {} } });
    resizer.observe(macdContainerRef.current);
    return () => { resizer.disconnect(); try { chart.remove(); } catch {} macdChartRef.current = null; };
  }, [visibleData, showMACD]);

  // ── CVD sub-chart ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showCVD || !cvdContainerRef.current) return;
    const chart = createChart(cvdContainerRef.current, {
      width: cvdContainerRef.current.clientWidth, height: cvdContainerRef.current.clientHeight || 120,
      layout: { background: { color: '#090b10' }, textColor: '#6b7280', fontFamily: 'Inter, system-ui, sans-serif' },
      grid: { vertLines: { color: 'rgba(42,46,57,0.04)' }, horzLines: { color: 'rgba(42,46,57,0.04)' } },
      timeScale: { visible: false },
      rightPriceScale: { borderColor: '#1e222e', scaleMargins: { top: 0.1, bottom: 0.1 }, minimumWidth: 80 },
    }) as any;
    cvdChartRef.current = chart;
    const cvdData = calcCVD(visibleData);
    chart.addSeries(HistogramSeries, { 
      priceLineVisible: false, 
      lastValueVisible: false, 
      color: '#34d399', 
      title: 'CVD' 
    }).setData(cvdData as any);
    
    // Sync time scale with main chart
    if (chartRef.current) {
      const range = (chartRef.current as any).timeScale().getVisibleRange();
      if (range) chart.timeScale().setVisibleRange(range);
    }
    chart.timeScale().subscribeVisibleTimeRangeChange((range: any) => {
      if (range) {
        try { if (chartRef.current) (chartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (rsiChartRef.current) (rsiChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
        try { if (macdChartRef.current) (macdChartRef.current as any).timeScale().setVisibleRange(range); } catch {}
      }
    });

    const resizer = new ResizeObserver(e => { for (const en of e) { try { if (cvdChartRef.current) cvdChartRef.current.resize(en.contentRect.width, en.contentRect.height); } catch {} } });
    resizer.observe(cvdContainerRef.current);
    return () => { resizer.disconnect(); try { chart.remove(); } catch {} cvdChartRef.current = null; };
  }, [visibleData, showCVD]);

  // ── Canvas overlay (drawings + positions + smart signals + fractals) ──────
  useEffect(() => { drawUserOverlay(); }, [pane.drawings, activePosition, lastPriceValue, smartSignals, smcData, pane.indicators]);

  const drawUserOverlay = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    const chart  = chartRef.current;
    const cSeries = candleSeriesRef.current;
    if (!canvas || !chart || !cSeries) return;

    try {
      const ts = chart.timeScale();
      const ps = cSeries.priceScale();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
    canvas.width  = canvas.parentElement?.clientWidth  || 0;
    canvas.height = canvas.parentElement?.clientHeight || 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const priceScale = (chart as any).priceScale('right');
    const timeScale  = (chart as any).timeScale();

    // SMC Order Blocks
    if (pane.indicators.smcOrderBlocks) {
      smcData.orderBlocks.forEach(ob => {
        const topY = cSeries.priceToCoordinate(ob.top);
        const bottomY = cSeries.priceToCoordinate(ob.bottom);
        const startX = timeScale.timeToCoordinate(ob.time);
        if (topY !== null && bottomY !== null && startX !== null) {
          ctx.fillStyle = ob.type === 'BULL' ? 'rgba(8, 153, 129, 0.1)' : 'rgba(242, 54, 69, 0.1)';
          ctx.fillRect(startX, topY, canvas.width - startX, bottomY - topY);
          
          ctx.fillStyle = ob.type === 'BULL' ? 'rgba(8, 153, 129, 0.8)' : 'rgba(242, 54, 69, 0.8)';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillText(`+OB`, startX + 5, bottomY - 5);
        }
      });
    }

    // SMC Liquidity Sweeps
    if (pane.indicators.smcLiquiditySweeps) {
      smcData.sweeps.forEach(sw => {
        const y = cSeries.priceToCoordinate(sw.price);
        const x = timeScale.timeToCoordinate(sw.time);
        if (y !== null && x !== null) {
          ctx.strokeStyle = sw.type === 'BULL' ? '#089981' : '#f23645';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x - 5, y);
          ctx.lineTo(x + 5, y);
          ctx.stroke();
          
          ctx.fillStyle = sw.type === 'BULL' ? '#089981' : '#f23645';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`x`, x - 3, y - 5);
        }
      });
    }

    // Position lines
    if (activePosition?.status === 'OPEN') {
      const toY = (p: number) => cSeries.priceToCoordinate(p);
      const entryY = toY(activePosition.entryPrice);

      const isBuy = activePosition.direction === 'BUY';
      const livePrice = lastPriceValue;
      const amount = activePosition.amount || 1000;
      const leverage = activePosition.leverage || 1;
      const positionSize = amount * leverage; 
      const priceDiffRatio = isBuy 
        ? (livePrice - activePosition.entryPrice) / activePosition.entryPrice 
        : (activePosition.entryPrice - livePrice) / activePosition.entryPrice;
      const unrealizedPnL = positionSize * priceDiffRatio;
      const pnLColor = unrealizedPnL >= 0 ? '#10b981' : '#ef4444';
      const pnlText = `${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)} (${(priceDiffRatio * 100).toFixed(2)}%)`;

      if (entryY !== null) {
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, entryY); ctx.lineTo(canvas.width - 60, entryY); ctx.stroke();
        
        ctx.fillStyle = '#1e3a8a'; ctx.fillRect(5, entryY - 10, 85, 20);
        ctx.fillStyle = '#93c5fd'; ctx.font = 'bold 9px monospace';
        ctx.fillText(`ENTRY $${activePosition.entryPrice}`, 9, entryY + 3);

        ctx.fillStyle = `${pnLColor}22`; 
        ctx.fillRect(95, entryY - 10, 110, 20);
        ctx.strokeStyle = pnLColor; ctx.setLineDash([]); ctx.strokeRect(95, entryY - 10, 110, 20);
        ctx.fillStyle = pnLColor; ctx.font = 'bold 9px monospace';
        ctx.fillText(pnlText, 99, entryY + 3);
      }
      if (activePosition.slPrice) {
        const slY = toY(activePosition.slPrice);
        if (slY !== null && slY >= 0 && slY <= canvas.height) {
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(0, slY); ctx.lineTo(canvas.width - 60, slY); ctx.stroke();
          ctx.fillStyle = '#991b1b'; ctx.fillRect(canvas.width - 145, slY - 10, 90, 20);
          ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 9px monospace';
          ctx.fillText(`SL $${activePosition.slPrice}`, canvas.width - 141, slY + 3);
        }
      }
      if (activePosition.tpPrice) {
        const tpY = toY(activePosition.tpPrice);
        if (tpY !== null && tpY >= 0 && tpY <= canvas.height) {
          ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(0, tpY); ctx.lineTo(canvas.width - 60, tpY); ctx.stroke();
          ctx.fillStyle = '#065f46'; ctx.fillRect(canvas.width - 145, tpY - 10, 90, 20);
          ctx.fillStyle = '#a7f3d0'; ctx.font = 'bold 9px monospace';
          ctx.fillText(`TP $${activePosition.tpPrice}`, canvas.width - 141, tpY + 3);
        }
      }
    }

    // Manual drawings
    ctx.setLineDash([]);
    pane.drawings.forEach(line => {
      const x1 = timeScale.timeToCoordinate(line.point1.time as any);
      const y1 = cSeries.priceToCoordinate(line.point1.price);
      if (line.type === 'horizontal' && y1 !== null && y1 >= 0 && y1 <= canvas.height) {
        ctx.strokeStyle = line.color || '#3b82f6'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(canvas.width - 60, y1); ctx.stroke();
      } else if (line.type === 'trend' && line.point2) {
        const x2 = timeScale.timeToCoordinate(line.point2.time as any);
        const y2 = cSeries.priceToCoordinate(line.point2.price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          ctx.strokeStyle = line.color || '#f59e0b'; ctx.lineWidth = 2.0;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, Math.PI * 2); ctx.arc(x2, y2, 3.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (line.type === 'fibonacci' && line.point2) {
        const x2 = timeScale.timeToCoordinate(line.point2.time as any);
        const y2 = cSeries.priceToCoordinate(line.point2.price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          const minX = Math.min(x1, x2);
          const maxX = canvas.width - 60; // extend to price scale
          const h = line.point1.price;
          const l = line.point2.price;
          const levels = [
            { ratio: 0, color: '#f23645' },
            { ratio: 0.236, color: '#f59e0b' },
            { ratio: 0.382, color: '#eab308' },
            { ratio: 0.5, color: '#089981' },
            { ratio: 0.618, color: '#0ea5e9' },
            { ratio: 0.786, color: '#6366f1' },
            { ratio: 1, color: '#9333ea' }
          ];
          
          levels.forEach(lvl => {
            const price = h - (h - l) * lvl.ratio;
            const y = cSeries.priceToCoordinate(price);
            if (y !== null) {
              ctx.strokeStyle = lvl.color; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
              ctx.fillStyle = lvl.color; ctx.font = '10px monospace';
              ctx.fillText(`${lvl.ratio} (${price.toFixed(2)})`, minX + 5, y - 4);
            }
          });
          
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // Fractals on canvas
    if (pane.indicators.fractal) {
      const fractals = calcFractals(visibleData);
      ctx.font = 'bold 10px monospace';
      fractals.highs.forEach(f => {
        const x = timeScale.timeToCoordinate(f.time as any);
        const y = cSeries.priceToCoordinate(f.price);
        if (x !== null && y !== null && y >= 0 && y <= canvas.height) {
          ctx.fillStyle = '#f23645';
          ctx.fillText('▼', x - 5, y - 6);
        }
      });
      fractals.lows.forEach(f => {
        const x = timeScale.timeToCoordinate(f.time as any);
        const y = cSeries.priceToCoordinate(f.price);
        if (x !== null && y !== null && y >= 0 && y <= canvas.height) {
          ctx.fillStyle = '#089981';
          ctx.fillText('▲', x - 5, y + 14);
        }
      });
    }

    // Smart Signals on canvas
    if (pane.indicators.smartSignal) {
      smartSignals.forEach(sig => {
        const x = timeScale.timeToCoordinate(sig.time as any);
        const y = cSeries.priceToCoordinate(sig.entry);
        if (x === null || y === null) return;

        const isBuy = sig.signal === 'BUY';
        const color = isBuy ? '#089981' : '#f23645';
        const arrow = isBuy ? '▲' : '▼';
        const offsetY = isBuy ? 14 : -6;

        // Arrow
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = color;
        ctx.fillText(arrow, x - 6, y + offsetY);

        // TP/SL dashed projections
        const tpY = cSeries.priceToCoordinate(sig.tp);
        const slY = cSeries.priceToCoordinate(sig.sl);
        ctx.setLineDash([2, 4]);
        if (tpY !== null && tpY >= 0 && tpY <= canvas.height) {
          ctx.strokeStyle = '#089981'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, tpY); ctx.stroke();
        }
        if (slY !== null && slY >= 0 && slY <= canvas.height) {
          ctx.strokeStyle = '#f23645'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, slY); ctx.stroke();
        }
        ctx.setLineDash([]);

        // Confidence badge
        if (sig.confidence >= 70) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + 4, y - 18, 32, 13);
          ctx.fillStyle = color;
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`${sig.confidence}%`, x + 6, y - 8);
        }
      });
    }

    // Volume Profile
    if (pane.indicators.volumeProfile) {
      const { profile: vp, step } = calcVolumeProfile(visibleData, pane.indicators.volumeProfileBins || 40);
      let maxVol = 1;
      for(let b of vp) if(b.vol > maxVol) maxVol = b.vol;
      const maxWidth = canvas.width * 0.15;
      
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      vp.forEach(b => {
        const yTop = cSeries.priceToCoordinate(b.price + step / 2);
        const yBottom = cSeries.priceToCoordinate(b.price - step / 2);
        
        if (yTop !== null && yBottom !== null) {
          const y = Math.min(yTop, yBottom);
          const h = Math.abs(yBottom - yTop) * 0.85; // 85% of bin height for padding
          const w = (b.vol / maxVol) * maxWidth;
          
          if (y >= 0 && y <= canvas.height || (y + h) >= 0 && (y + h) <= canvas.height) {
            ctx.fillRect(canvas.width - 55 - w, y, w, h);
          }
        }
      });
    }

    // Drawing preview anchor
    if (drawingPoints.length > 0) {
      const anchor = drawingPoints[0];
      const aX = timeScale.timeToCoordinate(anchor.time as any);
      const aY = cSeries.priceToCoordinate(anchor.price);
      if (aX !== null && aY !== null) {
        ctx.fillStyle = '#f59e0b'; ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.arc(aX, aY, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    } catch {}
  }, [pane.drawings, activePosition, lastPriceValue, smartSignals, visibleData, drawingPoints, pane.indicators]);

  // ── Canvas click handler ──────────────────────────────────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onSelectPane();
    if (!pane.activeDrawingType || !chartRef.current || !candleSeriesRef.current) return;
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const logTime = (chartRef.current as any).timeScale().coordinateToTime(x);
    const price   = candleSeriesRef.current.coordinateToPrice(y);
    if (logTime === null || price === null) return;
    const timeNum = typeof logTime === 'object' ? (logTime as any).time || Date.now() / 1000 : Number(logTime);

    if (pane.activeDrawingType === 'horizontal') {
      onUpdatePane({ drawings: [...pane.drawings, { id: Math.random().toString(), type: 'horizontal', point1: { time: timeNum, price }, color: '#3b82f6' }], activeDrawingType: null });
      setDrawingPoints([]);
    } else if (pane.activeDrawingType === 'trend') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([{ x, y, price, time: timeNum }]);
      } else {
        const fp = drawingPoints[0];
        onUpdatePane({ drawings: [...pane.drawings, { id: Math.random().toString(), type: 'trend', point1: { time: fp.time, price: fp.price }, point2: { time: timeNum, price }, color: '#f59e0b' }], activeDrawingType: null });
        setDrawingPoints([]);
      }
    }
  };

  const cycleReplaySpeed = () => {
    const list = [0.1, 0.3, 0.5, 1, 3, 10];
    const idx = list.indexOf(pane.replaySpeed);
    onUpdatePane({ replaySpeed: list[(idx + 1) % list.length] });
  };

  const ind = pane.indicators;

  // Indicator toggle helper
  const toggleInd = (key: keyof typeof ind) => {
    onUpdatePane({ indicators: { ...ind, [key]: !ind[key] } });
  };

  // All indicator options for the dropdown
  const indOptions: { key: keyof typeof ind; label: string }[] = [
    { key: 'ema20',        label: 'EMA 20'         },
    { key: 'ema50',        label: 'EMA 50'         },
    { key: 'ema80',        label: 'EMA 80'         },
    { key: 'ema200',       label: 'EMA 200'        },
    { key: 'vwap',         label: 'VWAP'           },
    { key: 'bollingerBands', label: 'Bollinger BB' },
    { key: 'ichimoku',     label: 'Ichimoku Cloud' },
    { key: 'rsi',          label: 'RSI (14)'       },
    { key: 'macd',         label: 'MACD'           },
    { key: 'cvd',          label: 'Cumulative Delta' },
    { key: 'fractal',      label: 'Fractals'       },
    { key: 'smartSignal',  label: '🤖 SmartSignal' },
    { key: 'smcOrderBlocks', label: 'Order Blocks (SMC)' },
    { key: 'smcLiquiditySweeps', label: 'Liquidity (SMC)' },
    { key: 'volumeProfile', label: 'Volume Profile' },
    { key: 'fvg',          label: 'Fair Value Gap' },
  ];

  const theme = PANE_THEMES[paneIndex || 1] || PANE_THEMES[1];

  return (
    <div
      className={`h-full flex flex-col bg-[#090b10] border-2 rounded-xl overflow-hidden transition-all duration-150 relative ${
        isActive ? `${theme.border} ${theme.shadow}` : 'border-[#1e222e] opacity-90'
      }`}
      onClick={onSelectPane}
    >
      {/* ── Title bar ─────────────────────────────────────────────────── */}
      <div className="bg-[#0b0e14]/90 backdrop-blur-sm border-b border-[#1e222e] py-2 px-3 flex items-center justify-between gap-1 text-xs select-none flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? `${theme.bg} animate-ping` : 'bg-gray-600'}`} />
          <span className={`font-bold text-[10px] ${theme.bg} ${theme.text} px-1.5 py-0.5 rounded shadow-sm flex items-center justify-center mr-1`}>{paneIndex || 1}</span>
          <span className="font-bold tracking-wide text-gray-200 uppercase truncate">{pane.symbol}</span>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-900 border border-gray-800 px-1 py-0.5 rounded uppercase">{pane.timeframe}</span>
          <span className="font-mono text-[10px] text-gray-300 font-bold ml-1">${lastPriceValue.toFixed(4)}</span>
        </div>

        {/* Active indicator badges */}
        <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink">
          {ind.ema20  && (
            <span onClick={() => setPromptConfig({ title: 'EMA1 Period:', defaultVal: String(ind.emaPeriods?.[0] || 20), onConfirm: (v) => onUpdatePane({ indicators: { ...ind, emaPeriods: [parseInt(v) || 20, ind.emaPeriods?.[1]||50, ind.emaPeriods?.[2]||80, ind.emaPeriods?.[3]||200] } }) })} className="text-[8px] bg-amber-500/10 text-amber-400 px-1 rounded border border-amber-500/20 cursor-pointer hover:bg-amber-500/20">
              EMA{ind.emaPeriods?.[0]||20}
            </span>
          )}
          {ind.ema50  && (
            <span onClick={() => setPromptConfig({ title: 'EMA2 Period:', defaultVal: String(ind.emaPeriods?.[1] || 50), onConfirm: (v) => onUpdatePane({ indicators: { ...ind, emaPeriods: [ind.emaPeriods?.[0]||20, parseInt(v) || 50, ind.emaPeriods?.[2]||80, ind.emaPeriods?.[3]||200] } }) })} className="text-[8px] bg-blue-500/10 text-blue-400 px-1 rounded border border-blue-500/20 cursor-pointer hover:bg-blue-500/20">
              EMA{ind.emaPeriods?.[1]||50}
            </span>
          )}
          {ind.ema80  && (
            <span onClick={() => setPromptConfig({ title: 'EMA3 Period:', defaultVal: String(ind.emaPeriods?.[2] || 80), onConfirm: (v) => onUpdatePane({ indicators: { ...ind, emaPeriods: [ind.emaPeriods?.[0]||20, ind.emaPeriods?.[1]||50, parseInt(v) || 80, ind.emaPeriods?.[3]||200] } }) })} className="text-[8px] bg-violet-500/10 text-violet-400 px-1 rounded border border-violet-500/20 cursor-pointer hover:bg-violet-500/20">
              EMA{ind.emaPeriods?.[2]||80}
            </span>
          )}
          {ind.ema200 && (
            <span onClick={() => setPromptConfig({ title: 'EMA4 Period:', defaultVal: String(ind.emaPeriods?.[3] || 200), onConfirm: (v) => onUpdatePane({ indicators: { ...ind, emaPeriods: [ind.emaPeriods?.[0]||20, ind.emaPeriods?.[1]||50, ind.emaPeriods?.[2]||80, parseInt(v) || 200] } }) })} className="text-[8px] bg-pink-500/10 text-pink-400 px-1 rounded border border-pink-500/20 cursor-pointer hover:bg-pink-500/20">
              EMA{ind.emaPeriods?.[3]||200}
            </span>
          )}
          {ind.vwap   && <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1 rounded border border-purple-500/20">VWAP</span>}
          {ind.bollingerBands && <span className="text-[8px] bg-green-500/10 text-green-400 px-1 rounded border border-green-500/20">BB</span>}
          {ind.ichimoku && <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1 rounded border border-orange-500/20">ICH</span>}
          {ind.fractal  && <span className="text-[8px] bg-red-500/10 text-red-400 px-1 rounded border border-red-500/20">FRAC</span>}
          {ind.smartSignal && <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20 animate-pulse">🤖 SIG</span>}
          {ind.volumeProfile && (
             <span onClick={() => setPromptConfig({ title: 'Volume Bins:', defaultVal: String(ind.volumeProfileBins || 40), onConfirm: (v) => onUpdatePane({ indicators: { ...ind, volumeProfileBins: parseInt(v) || 40 } }) })} className="text-[8px] bg-blue-500/10 text-blue-400 px-1 rounded border border-transparent cursor-pointer hover:bg-blue-500/20">
               VP({ind.volumeProfileBins || 40})
             </span>
          )}
          {ind.smcOrderBlocks && <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1 rounded border border-indigo-500/20">OB</span>}
          {ind.smcLiquiditySweeps && <span className="text-[8px] bg-teal-500/10 text-teal-400 px-1 rounded border border-teal-500/20">SWP</span>}
          {ind.cvd && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded border border-emerald-500/20">CVD</span>}
          {ind.rsi  && (
            <span onClick={() => setPromptConfig({ title: 'RSI Length:', defaultVal: String(ind.rsiLength || 14), onConfirm: (v) => onUpdatePane({ indicators: { ...ind, rsiLength: parseInt(v) || 14 } }) })} className="text-[8px] bg-yellow-500/10 text-yellow-400 px-1 rounded border border-yellow-500/20 cursor-pointer hover:bg-yellow-500/20">
              RSI({ind.rsiLength || 14})
            </span>
          )}
          {ind.macd && (
            <span onClick={() => setPromptConfig({ title: 'MACD Params (Fast,Slow,Sig):', defaultVal: ind.macdParams?.join(',') || '12,26,9', onConfirm: (v) => { const pts = v.split(',').map(s => parseInt(s.trim())); if(pts.length === 3 && pts.every(x => !isNaN(x))) onUpdatePane({ indicators: { ...ind, macdParams: [pts[0], pts[1], pts[2]] } }); } })} className="text-[8px] bg-blue-500/10 text-blue-400 px-1 rounded border border-blue-500/20 cursor-pointer hover:bg-blue-500/20">
              MACD({ind.macdParams?.join('/') || '12/26/9'})
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Replay */}
          {pane.isReplayMode ? (
            <div className="flex items-center bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 gap-1.5 font-mono text-[9px] text-gray-400">
              <span className="text-[8px] text-rose-400 uppercase animate-pulse">REPLAY</span>
              <button onClick={e => { e.stopPropagation(); onUpdatePane({ isPlaying: !pane.isPlaying }); }} className="p-0.5 rounded hover:bg-gray-800 cursor-pointer">
                {pane.isPlaying ? <Pause className="w-3 h-3 text-amber-500" /> : <Play className="w-3 h-3 text-emerald-400" />}
              </button>
              <button onClick={e => { e.stopPropagation(); const c = pane.replayCurrentIndex || 0; if (c < historicData.length - 1) onUpdatePane({ replayCurrentIndex: c + 1 }); }} className="p-0.5 rounded hover:bg-gray-800 cursor-pointer">
                <ChevronRight className="w-3 h-3" />
              </button>
              <button onClick={e => { e.stopPropagation(); cycleReplaySpeed(); }} className="hover:text-blue-400 font-sans text-[8px] cursor-pointer uppercase">{pane.replaySpeed}x</button>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); const half = Math.floor(historicData.length / 2); onUpdatePane({ isReplayMode: true, replayStartIndex: half, replayCurrentIndex: half, isPlaying: false }); }}
              className="text-[9px] bg-rose-500/5 text-rose-300 border border-rose-900/30 font-bold font-mono px-2 py-0.5 rounded-md hover:bg-rose-900/40 cursor-pointer transition-colors">
              REPLAY
            </button>
          )}

          {/* Drawing tools */}
          <div className="flex items-center bg-gray-900 rounded p-0.5 border border-gray-800">
            <button onClick={e => { e.stopPropagation(); onUpdatePane({ activeDrawingType: pane.activeDrawingType === 'trend' ? null : 'trend' }); setDrawingPoints([]); }}
              className={`p-1 rounded cursor-pointer ${pane.activeDrawingType === 'trend' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-gray-200'}`} title="Trend line">
              <PenTool className="w-3 h-3" />
            </button>
            <button onClick={e => { e.stopPropagation(); onUpdatePane({ activeDrawingType: pane.activeDrawingType === 'horizontal' ? null : 'horizontal' }); setDrawingPoints([]); }}
              className={`p-1 rounded cursor-pointer ${pane.activeDrawingType === 'horizontal' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`} title="Horizontal line">
              <Minus className="w-3 h-3" />
            </button>
            <button onClick={e => { e.stopPropagation(); onUpdatePane({ activeDrawingType: pane.activeDrawingType === 'fibonacci' ? null : 'fibonacci' }); setDrawingPoints([]); }}
              className={`p-1 rounded cursor-pointer ${pane.activeDrawingType === 'fibonacci' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-gray-200'}`} title="Fibonacci Retracement">
              <AlignJustify className="w-3 h-3" />
            </button>
            {pane.drawings.length > 0 && (
              <button onClick={e => { e.stopPropagation(); onUpdatePane({ drawings: [] }); }} className="p-1 hover:bg-gray-800 rounded text-rose-400 cursor-pointer" title="Clear drawings">
                <Trash className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Indicator selector */}
          <select
            onClick={e => e.stopPropagation()}
            onChange={e => { const k = e.target.value as keyof typeof ind; if (k) toggleInd(k); e.target.value = ''; }}
            className="bg-gray-900 border border-gray-800 text-gray-400 text-[10px] rounded cursor-pointer px-1 py-0.5"
            title="Toggle indicators"
          >
            <option value="">+IND</option>
            {indOptions.map(o => (
              <option key={o.key} value={o.key}>{ind[o.key] ? '● ' : '○ '}{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── SmartSignal badge ─────────────────────────────────────────── */}
      {ind.smartSignal && latestSignal && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border-b flex-shrink-0 ${
          latestSignal.signal === 'BUY'
            ? 'bg-emerald-950/60 border-emerald-800/40 text-emerald-300'
            : latestSignal.signal === 'SELL'
              ? 'bg-rose-950/60 border-rose-800/40 text-rose-300'
              : 'bg-gray-900/60 border-gray-800 text-gray-400'
        }`}>
          <span className="font-bold tracking-wider">
            {latestSignal.signal === 'BUY' ? '▲ BUY' : latestSignal.signal === 'SELL' ? '▼ SELL' : '● EXIT'}
          </span>
          <span className="text-gray-500">|</span>
          <span>Entry <strong>${latestSignal.entry.toFixed(4)}</strong></span>
          <span className="text-emerald-400">TP ${latestSignal.tp.toFixed(4)}</span>
          <span className="text-rose-400">SL ${latestSignal.sl.toFixed(4)}</span>
          <span className="text-amber-400">RR {latestSignal.rr}:1</span>
          <span className="ml-auto text-gray-500">{latestSignal.confidence}% conf · {latestSignal.regime}</span>
        </div>
      )}

      {/* ── Main chart ────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-[#090b10] min-h-0" style={{ minHeight: '200px' }}>
        <div ref={chartContainerRef} className="absolute inset-0 pointer-events-auto" />
        <canvas
          ref={drawingCanvasRef}
          onClick={handleCanvasClick}
          className={`absolute inset-0 z-20 ${pane.activeDrawingType ? 'cursor-crosshair' : 'cursor-default pointer-events-none'}`}
        />
        {historicData.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gray-950/40 text-xs text-gray-500">
            <RefreshCw className="w-8 h-8 mb-2 animate-spin text-gray-700" />
            <span>Loading chart data…</span>
          </div>
        )}
        {pane.activeDrawingType && (
          <div className="absolute top-2 left-2 bg-blue-600/90 border border-blue-400 font-bold font-mono text-[9px] px-2 py-1 text-white rounded shadow z-30 animate-pulse pointer-events-none">
            {pane.activeDrawingType === 'trend' ? 'Click pt 1 → Click pt 2 to draw line' : pane.activeDrawingType === 'fibonacci' ? 'Click High/Low → Click Low/High for Fibo' : 'Click to place horizontal line'}
          </div>
        )}
      </div>

      {/* ── RSI sub-pane ─────────────────────────────────────────────── */}
      {showRSI && (
        <div className="flex-shrink-0 flex flex-col border-t border-[#1e222e]" style={{ height: `${rsiHeight}px` }}>
          <DragHandle onDrag={(dy) => setRsiHeight(h => Math.max(50, Math.min(400, h - dy)))} />
          <div className="text-[8px] font-mono text-gray-600 px-2 flex-shrink-0 bg-[#090b10] flex justify-between items-center">
            <span>RSI ({pane.indicators.rsiLength || 14})</span>
          </div>
          <div ref={rsiContainerRef} className="w-full flex-1 min-h-0" />
        </div>
      )}

      {/* ── MACD sub-pane ─────────────────────────────────────────────── */}
      {showMACD && (
        <div className="flex-shrink-0 flex flex-col border-t border-[#1e222e]" style={{ height: `${macdHeight}px` }}>
          <DragHandle onDrag={(dy) => setMacdHeight(h => Math.max(50, Math.min(400, h - dy)))} />
          <div className="text-[8px] font-mono text-gray-600 px-2 flex-shrink-0 bg-[#090b10] flex justify-between items-center">
            <span>MACD ({pane.indicators.macdParams?.join('/') || '12/26/9'})</span>
          </div>
          <div ref={macdContainerRef} className="w-full flex-1 min-h-0" />
        </div>
      )}

      {/* ── CVD sub-pane ─────────────────────────────────────────────── */}
      {showCVD && (
        <div className="flex-shrink-0 flex flex-col border-t border-[#1e222e]" style={{ height: `${cvdHeight}px` }}>
          <DragHandle onDrag={(dy) => setCvdHeight(h => Math.max(50, Math.min(400, h - dy)))} />
          <div className="text-[8px] font-mono text-gray-600 px-2 flex-shrink-0 bg-[#090b10] flex justify-between items-center">
            <span>Cumulative Volume Delta (CVD)</span>
          </div>
          <div ref={cvdContainerRef} className="w-full flex-1 min-h-0" />
        </div>
      )}

      {promptConfig && (
        <PromptModal 
          isOpen={true}
          title={promptConfig.title}
          defaultValue={promptConfig.defaultVal}
          onConfirm={(val) => {
             promptConfig.onConfirm(val);
             setPromptConfig(null);
          }}
          onCancel={() => setPromptConfig(null)}
        />
      )}
    </div>
  );
};
