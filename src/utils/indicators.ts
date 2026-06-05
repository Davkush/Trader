import { CandleData } from '../types';

export interface BBValue {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDValue {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface FVGValue {
  time1: number;
  time2: number;
  top: number;
  bottom: number;
  direction: 'BULLISH' | 'BEARISH';
}

export interface VolumeProfileBin {
  price: number;
  volume: number;
  isHighVolumeNode: boolean;
}

// EMA calculation
export function calculateEMA(data: CandleData[], period: number): { time: number; value: number }[] {
  if (data.length < period) return [];
  const emaValues: { time: number; value: number }[] = [];
  const k = 2 / (period + 1);

  // Simple moving average for the first point
  let currentEma = data.slice(0, period).reduce((sum, bar) => sum + bar.close, 0) / period;
  emaValues.push({ time: data[period - 1].time, value: Number(currentEma.toFixed(2)) });

  for (let i = period; i < data.length; i++) {
    currentEma = data[i].close * k + currentEma * (1 - k);
    emaValues.push({ time: data[i].time, value: Number(currentEma.toFixed(2)) });
  }

  return emaValues;
}

// VWAP calculation
export function calculateVWAP(data: CandleData[]): { time: number; value: number }[] {
  const vwapValues: { time: number; value: number }[] = [];
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativePV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;

    if (cumulativeVolume === 0) {
      vwapValues.push({ time: bar.time, value: bar.close });
    } else {
      vwapValues.push({ time: bar.time, value: Number((cumulativePV / cumulativeVolume).toFixed(2)) });
    }
  }

  return vwapValues;
}

// Bollinger Bands calculation
export function calculateBollingerBands(data: CandleData[], period: number = 20, multiplier: number = 2): BBValue[] {
  if (data.length < period) return [];
  const bbValues: BBValue[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const subset = data.slice(i - period + 1, i + 1);
    const middle = subset.reduce((sum, bar) => sum + bar.close, 0) / period;
    
    // Variance calculation
    const variance = subset.reduce((sum, bar) => sum + Math.pow(bar.close - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    bbValues.push({
      time: data[i].time,
      upper: Number((middle + multiplier * stdDev).toFixed(2)),
      middle: Number(middle.toFixed(2)),
      lower: Number((middle - multiplier * stdDev).toFixed(2))
    });
  }

  return bbValues;
}

// RSI (14) calculation
export function calculateRSI(data: CandleData[], period: number = 14): { time: number; value: number }[] {
  if (data.length <= period) return [];
  const rsiValues: { time: number; value: number }[] = [];

  let gains = 0;
  let losses = 0;

  // First RSI block
  for (let i = 1; i <= period; i++) {
    const difference = data[i].close - data[i - 1].close;
    if (difference > 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  rsiValues.push({ time: data[period].time, value: Number(rsi.toFixed(2)) });

  for (let i = period + 1; i < data.length; i++) {
    const difference = data[i].close - data[i - 1].close;
    const gain = difference > 0 ? difference : 0;
    const loss = difference < 0 ? -difference : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    rsiValues.push({ time: data[i].time, value: Number(rsi.toFixed(2)) });
  }

  return rsiValues;
}

// MACD calculation
export function calculateMACD(
  data: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDValue[] {
  if (data.length < slowPeriod) return [];

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  // Align Fast and Slow EMA values
  const macdLinePoints: { time: number; value: number }[] = [];
  
  fastEMA.forEach(f => {
    const s = slowEMA.find(x => x.time === f.time);
    if (s) {
      macdLinePoints.push({
        time: f.time,
        value: Number((f.value - s.value).toFixed(2))
      });
    }
  });

  if (macdLinePoints.length < signalPeriod) return [];

  // Signal line is the EMA of MACD Line
  const k = 2 / (signalPeriod + 1);
  let currentSignal = macdLinePoints.slice(0, signalPeriod).reduce((sum, bar) => sum + bar.value, 0) / signalPeriod;
  
  const macdValues: MACDValue[] = [];
  macdValues.push({
    time: macdLinePoints[signalPeriod - 1].time,
    macd: macdLinePoints[signalPeriod - 1].value,
    signal: Number(currentSignal.toFixed(2)),
    histogram: Number((macdLinePoints[signalPeriod - 1].value - currentSignal).toFixed(2))
  });

  for (let i = signalPeriod; i < macdLinePoints.length; i++) {
    const macdVal = macdLinePoints[i].value;
    currentSignal = macdVal * k + currentSignal * (1 - k);
    
    macdValues.push({
      time: macdLinePoints[i].time,
      macd: Number(macdVal.toFixed(2)),
      signal: Number(currentSignal.toFixed(2)),
      histogram: Number((macdVal - currentSignal).toFixed(2))
    });
  }

  return macdValues;
}

// Fair Value Gaps (FVG) Detector
// Highlight market imbalances between Candle i-1 (High/Low) and Candle i+1 (Low/High)
export function detectFairValueGaps(data: CandleData[]): FVGValue[] {
  if (data.length < 3) return [];
  const gvgs: FVGValue[] = [];

  for (let i = 1; i < data.length - 1; i++) {
    const prev = data[i - 1]; // Candle 1
    const curr = data[i];     // Candle 2 (large momentum expansion candle)
    const next = data[i + 1]; // Candle 3

    // Bullish FVG: Candle 3 Low is greater than Candle 1 High
    if (next.low > prev.high && curr.close > curr.open) {
      gvgs.push({
        time1: prev.time,
        time2: next.time,
        top: next.low,
        bottom: prev.high,
        direction: 'BULLISH'
      });
    }
    // Bearish FVG: Candle 3 High is lower than Candle 1 Low
    else if (next.high < prev.low && curr.close < curr.open) {
      gvgs.push({
        time1: prev.time,
        time2: next.time,
        top: prev.low,
        bottom: next.high,
        direction: 'BEARISH'
      });
    }
  }

  return gvgs;
}

// Volume Profile Session calculator (Bins the price vertical axis and aggregates volume counts)
export function calculateVolumeProfile(data: CandleData[], binCount: number = 24): VolumeProfileBin[] {
  if (data.length === 0) return [];
  
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    if (bar.low < minPrice) minPrice = bar.low;
    if (bar.high > maxPrice) maxPrice = bar.high;
  }

  const priceRange = maxPrice - minPrice;
  if (priceRange === 0) return [];

  const binSize = priceRange / binCount;
  const bins: VolumeProfileBin[] = Array.from({ length: binCount }, (_, index) => ({
    price: Number((minPrice + index * binSize + binSize / 2).toFixed(2)),
    volume: 0,
    isHighVolumeNode: false
  }));

  // Map each candle volume to bins based on Close price
  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    const binIndex = Math.min(
      Math.floor((bar.close - minPrice) / binSize),
      binCount - 1
    );
    if (binIndex >= 0 && binIndex < binCount) {
      bins[binIndex].volume += bar.volume;
    }
  }

  // Find Peak Node (Point of Control - POC)
  let maxVolume = 0;
  for (let i = 0; i < binCount; i++) {
    if (bins[i].volume > maxVolume) {
      maxVolume = bins[i].volume;
    }
  }

  // Designate upper volume nodes
  if (maxVolume > 0) {
    for (let i = 0; i < binCount; i++) {
      if (bins[i].volume >= maxVolume * 0.75) {
        bins[i].isHighVolumeNode = true;
      }
    }
  }

  return bins;
}

// Find key Swing Support and Resistance levels
export function detectSupportAndResistance(data: CandleData[]): number[] {
  if (data.length < 50) return [];
  const lines: number[] = [];
  const peaks: { price: number, strength: number }[] = [];

  // 1. Identify pivots in past 150 bars
  const window = 5;
  const startIdx = Math.max(0, data.length - 150);

  for (let i = startIdx + window; i < data.length - window; i++) {
    const curr = data[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= window; j++) {
      if (data[i - j].high >= curr.high || data[i + j].high >= curr.high) {
        isSwingHigh = false;
      }
      if (data[i - j].low <= curr.low || data[i + j].low <= curr.low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      peaks.push({ price: curr.high, strength: 1 });
    }
    if (isSwingLow) {
      peaks.push({ price: curr.low, strength: 1 });
    }
  }

  // 2. Cluster peaks that are within 0.75% of each other
  const clusters: { centerPrice: number, count: number }[] = [];
  
  peaks.forEach(peak => {
    let matched = false;
    for (let i = 0; i < clusters.length; i++) {
      const dist = Math.abs(clusters[i].centerPrice - peak.price) / clusters[i].centerPrice;
      if (dist < 0.0075) {
        clusters[i].centerPrice = (clusters[i].centerPrice * clusters[i].count + peak.price) / (clusters[i].count + 1);
        clusters[i].count += 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ centerPrice: peak.price, count: 1 });
    }
  });

  // 3. Take clusters with count >= 2 or higher, sorted by occurrences
  clusters.sort((a, b) => b.count - a.count);
  const selectedLines = clusters.slice(0, 6).map(c => Number(c.centerPrice.toFixed(2)));

  return selectedLines;
}
