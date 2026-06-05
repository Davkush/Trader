import { CandleData, SmartSignalOutput, IndicatorSettings } from '../types';

/**
 * Executes a quick backtest on a set of SmartSignal parameters.
 * Returns win‑rate, win/loss counts, average RR and a short textual suggestion.
 */
export function runBacktest(
  data: CandleData[],
  params: IndicatorSettings['smartSignalParams']
): {
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  suggestion: string;
} {
  // Generate signals using the existing engine (calcSmartSignals)
  // We need to import it, but to avoid circular dependencies we copy the minimal logic here.
  // For brevity we simulate the same logic as calcSmartSignals but expose the resulting signals.
  // In a real project we would call the shared calcSmartSignals function.
  // -----------------------------------------------------------------------
  // Minimal reproduction of calcSmartSignals' signal generation (approx.)
  // -----------------------------------------------------------------------
  if (data.length < 60) return { totalSignals: 0, wins: 0, losses: 0, winRate: 0, avgRR: 0, suggestion: 'Insufficient data for backtest.' };

  const {
    emaFast = 20,
    emaMed = 50,
    emaSlow = 80,
    rsiLength = 14,
    rsiBuyMin = 40,
    rsiBuyMax = 65,
    rsiSellMin = 35,
    rsiSellMax = 60,
    volRatio = 1.1,
  } = params || {};

  // Simple EMA helper
  function calcEMA(arr: CandleData[], period: number): { time: number; value: number }[] {
    if (arr.length < period) return [];
    const k = 2 / (period + 1);
    const out: { time: number; value: number }[] = [];
    let currentEma = arr.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
    out.push({ time: arr[period - 1].time as number, value: +currentEma.toFixed(4) });
    for (let i = period; i < arr.length; i++) {
      currentEma = arr[i].close * k + currentEma * (1 - k);
      out.push({ time: arr[i].time as number, value: +currentEma.toFixed(4) });
    }
    return out;
  }

  // Simple RSI helper
  function calcRSI(arr: CandleData[], period: number): { time: number; value: number }[] {
    if (arr.length <= period) return [];
    const gains: number[] = [], losses: number[] = [];
    for (let i = 1; i <= period; i++) {
      const diff = arr[i].close - arr[i - 1].close;
      diff > 0 ? gains.push(diff) : losses.push(-diff);
    }
    let avgGain = gains.reduce((s, v) => s + v, 0) / period;
    let avgLoss = losses.reduce((s, v) => s + v, 0) / period;
    const out: { time: number; value: number }[] = [{ time: arr[period].time as number, value: 0 }];
    for (let i = period; i < arr.length; i++) {
      const diff = arr[i].close - arr[i - 1].close;
      avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out.push({ time: arr[i].time as number, value: 100 - 100 / (1 + rs) });
    }
    return out;
  }

  // Simple ATR helper
  function calcATR(arr: CandleData[], period: number): number[] {
    if (arr.length < 2) return [];
    const atr: number[] = [];
    for (let i = 1; i < arr.length; i++) {
      const tr = Math.max(
        arr[i].high - arr[i].low,
        Math.abs(arr[i].high - arr[i - 1].close),
        Math.abs(arr[i].low - arr[i - 1].close)
      );
      if (i === 1) atr.push(tr);
      else atr.push(atr[atr.length - 1] * (period - 1) / period + tr / period);
    }
    return atr;
  }

  // Helper to detect higher‑high / lower‑low fractal (simplified)
  function detectFractals(arr: CandleData[]) {
    const highs: { time: number; price: number }[] = [];
    const lows: { time: number; price: number }[] = [];
    for (let i = 2; i < arr.length - 2; i++) {
      if (!arr[i] || !arr[i - 1] || !arr[i - 2] || !arr[i + 1] || !arr[i + 2]) continue;
      if (arr[i].high > arr[i - 1].high && arr[i].high > arr[i - 2].high && arr[i].high > arr[i + 1].high && arr[i].high > arr[i + 2].high) {
        highs.push({ time: arr[i].time as number, price: arr[i].high });
      }
      if (arr[i].low < arr[i - 1].low && arr[i].low < arr[i - 2].low && arr[i].low < arr[i + 1].low && arr[i].low < arr[i + 2].low) {
        lows.push({ time: arr[i].time as number, price: arr[i].low });
      }
    }
    return { highs, lows };
  }

  // -----------------------------------------------------------------------
  // Build the minimal signal set needed for the backtest
  // -----------------------------------------------------------------------
  const dataDup = data.slice();
  const emaFastArr = calcEMA(dataDup, emaFast);
  const emaMedArr = calcEMA(dataDup, emaMed);
  const emaSlowArr = calcEMA(dataDup, emaSlow);
  const rsiArr = calcRSI(dataDup, rsiLength);
  const { highs, lows } = detectFractals(dataDup);
  const atrArr = calcATR(dataDup, 14);
  const volSMA: number[] = [];
  for (let i = 19; i < dataDup.length; i++) {
    const chunk = dataDup.slice(i - 19, i + 1);
    volSMA.push(chunk.reduce((s, c) => s + c.volume, 0) / Math.max(chunk.length, 1));
  }

  const signals: SmartSignalOutput[] = [];
  const fracHighSet = new Set(highs.map(h => h.time));
  const fracLowSet = new Set(lows.map(l => l.time));
  const offsetFast = emaFastArr.length;
  const offsetMed = emaMedArr.length;
  const offsetSlow = emaSlowArr.length;
  const offsetRsi = rsiArr.length;
  const lastSignalBar = -50;

  for (let i = 80; i < dataDup.length - 1; i++) {
    if (!dataDup[i] || !dataDup[i - 1]) continue;
    if (i - lastSignalBar < 5) continue;
    const e20 = emaFastArr[i - offsetFast]?.value;
    const e50 = emaMedArr[i - offsetMed]?.value;
    const e80 = emaSlowArr[i - offsetSlow]?.value;
    const rsi = rsiArr[i - offsetRsi]?.value;
    const curATR = atrArr[i - 1] ?? 0;
    const volIdx = i - (dataDup.length - volSMA.length - 19);
    const volRatio = volIdx >= 0 && volSMA[volIdx] ? dataDup[i].volume / volSMA[volIdx] : 1;
    if (!e20 || !e50 || !e80 || !rsi) continue;

    const price = dataDup[i].close;
    const bullTrend = e20 > e50 && e50 > e80 && price > e20;
    const bearTrend = e20 < e50 && e50 < e80 && price < e20;
    const isVolatile = curATR / price > 0.015;
    const bbSlice = dataDup.slice(Math.max(0, i - 19), i + 1);
    const bbMid = bbSlice.reduce((s, c) => s + c.close, 0) / bbSlice.length;
    const bbStd = Math.sqrt(
      bbSlice.reduce((s, c) => s + (c.close - bbMid) ** 2, 0) / bbSlice.length
    );
    const bbWidth = (bbStd * 4) / bbMid;
    const isSqueeze = bbWidth < 0.02;

    const isFracLow = fracLowSet.has(dataDup[i].time as number);
    const buySetup = bullTrend && rsi > rsiBuyMin && rsi < rsiBuyMax && (isFracLow || isSqueeze) && volRatio > volRatio && dataDup[i].close > dataDup[i].open && !isVolatile;
    const isFracHigh = fracHighSet.has(dataDup[i].time as number);
    const sellSetup = bearTrend && rsi > rsiSellMin && rsi < rsiSellMax && (isFracHigh || isSqueeze) && volRatio > volRatio && dataDup[i].close < dataDup[i].open && !isVolatile;

    if (buySetup) {
      const entry = price;
      const sl = Math.min(dataDup[i].low, dataDup[i - 1].low) - curATR * 0.5;
      const risk = entry - sl;
      if (risk <= 0) continue;
      const tp = entry + risk * 1.6; // target RR 1.6
      const rr = Math.round(((tp - entry) / risk) * 100) / 100;
      const conf = Math.min(99, Math.round(40 + (rsi < 55 ? 15 : 5) + (volRatio > 1.5 ? 20 : volRatio > 1.2 ? 12 : 5) + (isFracLow ? 15 : 0) + (isSqueeze ? 10 : 0)));
      signals.push({ time: dataDup[i].time as number, signal: 'BUY', entry, tp, sl, rr, confidence: conf, regime: 'ACTIVE' });
      lastSignalBar = i;
    } else if (sellSetup) {
      const entry = price;
      const sl = Math.max(dataDup[i].high, dataDup[i - 1].high) + curATR * 0.5;
      const risk = sl - entry;
      if (risk <= 0) continue;
      const tp = entry - risk * 1.6;
      const rr = Math.round(((entry - tp) / risk) * 100) / 100;
      const conf = Math.min(99, Math.round(40 + (rsi > 45 ? 15 : 5) + (volRatio > 1.5 ? 20 : volRatio > 1.2 ? 12 : 5) + (isFracHigh ? 15 : 0) + (isSqueeze ? 10 : 0)));
      signals.push({ time: dataDup[i].time as number, signal: 'SELL', entry, tp, sl, rr, confidence: conf, regime: 'ACTIVE' });
      lastSignalBar = i;
    }
  }

  // -----------------------------------------------------------------------
  // Evaluate outcomes against the full historic data set
  // -----------------------------------------------------------------------
  let wins = 0,
    losses = 0,
    totalSignals = signals.length;
  let sumRR = 0;
  const mockFuturePriceMap = new Map<number, number>(); // time -> simulated future price at +1 bar (for outcome check)

  // Build a map of next‑bar close for quick lookup
  for (let i = 0; i < dataDup.length - 1; i++) {
    mockFuturePriceMap.set(dataDup[i].time as number, dataDup[i + 1].close);
  }

  signals.forEach(sig => {
    const nextClose = mockFuturePriceMap.get(sig.time);
    if (nextClose == null) return;
    if (sig.signal === 'BUY') {
      if (nextClose >= sig.tp) wins++;
      else if (nextClose <= sig.sl) losses++;
      sumRR += sig.rr;
    } else if (sig.signal === 'SELL') {
      if (nextClose <= sig.tp) wins++;
      else if (nextClose >= sig.sl) losses++;
      sumRR += sig.rr;
    }
  });

  const winRate = totalSignals === 0 ? 0 : Math.round((wins / totalSignals) * 100);
  const avgRR = totalSignals === 0 ? 0 : Math.round((sumRR / totalSignals) * 100) / 100;

  let suggestion = '';
  if (winRate >= 75) {
    suggestion = 'Performance is strong – consider scaling exposure or tightening risk parameters.';
  } else if (winRate >= 60) {
    suggestion = 'Solid baseline – experiment with slightly wider stops or higher volatility filters.';
  } else if (winRate >= 45) {
    suggestion = 'Below average – try adjusting momentum thresholds or add a volatility filter.';
  } else {
    suggestion = 'Significant improvement needed – investigate entry‑condition logic or add additional filters.';
  }

  return {
    totalSignals,
    wins,
    losses,
    winRate,
    avgRR,
    suggestion,
  };
}