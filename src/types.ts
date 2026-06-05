export type Timeframe = '1s' | '5s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export type ChartType = 'candlestick' | 'renko';

export interface Point {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  type: 'trend' | 'horizontal' | 'fibonacci';
  point1: Point;
  point2?: Point;
  color: string;
}

export interface IndicatorSettings {
  ema20: boolean;
  ema50: boolean;
  ema80: boolean;
  ema200: boolean;
  vwap: boolean;
  bollingerBands: boolean;
  ichimoku: boolean;
  fvg: boolean;
  volumeProfile: boolean;
  macd: boolean;
  rsi: boolean;
  fractal: boolean;
  smartSignal: boolean;
  orderFlow: boolean;
  smcOrderBlocks: boolean;
  smcLiquiditySweeps: boolean;
  cvd: boolean;
  
  // Custom Parameters
  emaPeriods: [number, number, number, number];
  rsiLength: number;
  macdParams: [number, number, number];
  volumeProfileBins: number;
  
  smartSignalParams: {
    emaFast: number;
    emaMed: number;
    emaSlow: number;
    rsiLength: number;
    rsiBuyMin: number;
    rsiBuyMax: number;
    rsiSellMin: number;
    rsiSellMax: number;
    volRatio: number;
  };
}


export interface ChartPaneState {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
  isReplayMode: boolean;
  replayStartIndex: number | null;
  replayCurrentIndex: number | null;
  replaySpeed: number;
  isPlaying: boolean;
  bookmarks: number[];
  drawings: Drawing[];
  indicators: IndicatorSettings;
  activeDrawingType: 'trend' | 'horizontal' | 'fibonacci' | null;
  selectedElementForDeletion: { id: string, type: 'drawing' | 'position' } | null;
  l2depth: { bids: { price: number; size: number }[]; asks: { price: number; size: number }[] };
}

export interface LivePrice {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface Position {
  id: string;
  paneId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  entryTime: number;
  quantity: number;
  tpPrice: number | null;
  slPrice: number | null;
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitTime?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface BacktestStats {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  expectancy: number;
}

export interface SystemPreferences {
  chartCount: number;
  soundEnabled: boolean;
  hotkeysEnabled: boolean;
  themeAccent: string;
  accountBalance: number;
  riskPercent: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SmartSignalOutput {
  time: number;
  signal: 'BUY' | 'SELL' | 'EXIT' | null;
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  confidence: number;
  regime: 'TREND' | 'RANGE' | 'VOLATILE';
}