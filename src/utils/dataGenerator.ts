import { CandleData } from '../types';

// Supported default symbols list
export interface SymbolInfo {
  symbol: string;
  name: string;
  category: 'Forex' | 'Commodities' | 'Stocks' | 'Funds / ETFs' | 'Indices' | 'Cryptos';
  isCrypto?: boolean;
}

export const POPULAR_SYMBOLS: SymbolInfo[] = [
  // Forex
  { symbol: 'EURUSD', name: 'EUR/USD (Euro / US Dollar)', category: 'Forex' },
  { symbol: 'USDJPY', name: 'USD/JPY (US Dollar / Japanese Yen)', category: 'Forex' },
  { symbol: 'GBPUSD', name: 'GBP/USD (British Pound / US Dollar)', category: 'Forex' },
  { symbol: 'AUDUSD', name: 'AUD/USD (Australian Dollar / US Dollar)', category: 'Forex' },
  { symbol: 'USDCAD', name: 'USD/CAD (US Dollar / Canadian Dollar)', category: 'Forex' },
  { symbol: 'USDCHF', name: 'USD/CHF (US Dollar / Swiss Franc)', category: 'Forex' },
  { symbol: 'NZDUSD', name: 'NZD/USD (New Zealand Dollar / US Dollar)', category: 'Forex' },
  { symbol: 'EURGBP', name: 'EUR/GBP (Euro / British Pound)', category: 'Forex' },
  { symbol: 'EURJPY', name: 'EUR/JPY (Euro / Japanese Yen)', category: 'Forex' },
  { symbol: 'GBPJPY', name: 'GBP/JPY (British Pound / Japanese Yen)', category: 'Forex' },

  // Commodities
  { symbol: 'GOLD', name: 'Gold (XAU/USD Spot)', category: 'Commodities' },
  { symbol: 'OIL', name: 'Crude Oil WTI', category: 'Commodities' },
  { symbol: 'SILVER', name: 'Silver (XAG/USD Spot)', category: 'Commodities' },
  { symbol: 'NATGAS', name: 'Natural Gas Futures', category: 'Commodities' },
  { symbol: 'BRENT', name: 'Brent Crude Oil', category: 'Commodities' },
  { symbol: 'COPPER', name: 'Copper Futures', category: 'Commodities' },
  { symbol: 'WHEAT', name: 'Wheat Futures', category: 'Commodities' },
  { symbol: 'CORN', name: 'Corn Futures', category: 'Commodities' },
  { symbol: 'SOYBN', name: 'Soybean Futures', category: 'Commodities' },
  { symbol: 'COFFEE', name: 'Coffee Futures', category: 'Commodities' },

  // Stocks
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'Stocks' },
  { symbol: 'TSLA', name: 'Tesla Inc.', category: 'Stocks' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'Stocks' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'Stocks' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', category: 'Stocks' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)', category: 'Stocks' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', category: 'Stocks' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', category: 'Stocks' },
  { symbol: 'LLY', name: 'Eli Lilly & Co.', category: 'Stocks' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'Stocks' },

  // Funds / ETFs
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', category: 'Funds / ETFs' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', category: 'Funds / ETFs' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', category: 'Funds / ETFs' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', category: 'Funds / ETFs' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', category: 'Funds / ETFs' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF', category: 'Funds / ETFs' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', category: 'Funds / ETFs' },
  { symbol: 'USO', name: 'United States Oil Fund', category: 'Funds / ETFs' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', category: 'Funds / ETFs' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', category: 'Funds / ETFs' },

  // Indices
  { symbol: 'SPX', name: 'S&P 550 Index', category: 'Indices' },
  { symbol: 'IXIC', name: 'Nasdaq Composite', category: 'Indices' },
  { symbol: 'DJI', name: 'Dow Jones Industrial Average', category: 'Indices' },
  { symbol: 'FTSE', name: 'FTSE 100 Index (London)', category: 'Indices' },
  { symbol: 'GDAXI', name: 'DAX 30 Index (Frankfurt)', category: 'Indices' },
  { symbol: 'N225', name: 'Nikkei 225 Index (Tokyo)', category: 'Indices' },
  { symbol: 'NIFTY50', name: 'Nifty 50 Index (India)', category: 'Indices' },
  { symbol: 'FCHI', name: 'CAC 40 Index (Paris)', category: 'Indices' },
  { symbol: 'HSI', name: 'Hang Seng Index (Hong Kong)', category: 'Indices' },
  { symbol: 'STOXX50', name: 'Euro Stoxx 50 Index', category: 'Indices' },

  // Cryptos
  { symbol: 'BTC', name: 'Bitcoin (Hyperliquid WS)', category: 'Cryptos', isCrypto: true },
  { symbol: 'ETH', name: 'Ethereum (Hyperliquid WS)', category: 'Cryptos', isCrypto: true },
  { symbol: 'SOL', name: 'Solana (Hyperliquid WS)', category: 'Cryptos', isCrypto: true },
  { symbol: 'XRP', name: 'Ripple', category: 'Cryptos', isCrypto: true },
  { symbol: 'ADA', name: 'Cardano', category: 'Cryptos', isCrypto: true },
  { symbol: 'DOGE', name: 'Dogecoin', category: 'Cryptos', isCrypto: true },
  { symbol: 'BNB', name: 'Binance Coin', category: 'Cryptos', isCrypto: true },
  { symbol: 'DOT', name: 'Polkadot', category: 'Cryptos', isCrypto: true },
  { symbol: 'LINK', name: 'Chainlink', category: 'Cryptos', isCrypto: true },
  { symbol: 'LTC', name: 'Litecoin', category: 'Cryptos', isCrypto: true }
];

export const SYMBOL_CONFIGS: Record<string, { currentPrice: number; stepPct: number; volBase: number }> = {
  // Forex
  EURUSD: { currentPrice: 1.0825, stepPct: 0.0003, volBase: 80000 },
  USDJPY: { currentPrice: 156.42, stepPct: 0.0004, volBase: 60000 },
  GBPUSD: { currentPrice: 1.2715, stepPct: 0.0003, volBase: 50000 },
  AUDUSD: { currentPrice: 0.6650, stepPct: 0.0004, volBase: 45000 },
  USDCAD: { currentPrice: 1.3680, stepPct: 0.0003, volBase: 40000 },
  USDCHF: { currentPrice: 0.9025, stepPct: 0.0003, volBase: 38000 },
  NZDUSD: { currentPrice: 0.6110, stepPct: 0.0004, volBase: 35000 },
  EURGBP: { currentPrice: 0.8512, stepPct: 0.0002, volBase: 30000 },
  EURJPY: { currentPrice: 168.95, stepPct: 0.0004, volBase: 42000 },
  GBPJPY: { currentPrice: 198.80, stepPct: 0.0005, volBase: 48000 },

  // Commodities
  GOLD: { currentPrice: 2335.50, stepPct: 0.0008, volBase: 12000 },
  OIL: { currentPrice: 78.30, stepPct: 0.0016, volBase: 35000 },
  SILVER: { currentPrice: 30.25, stepPct: 0.0018, volBase: 22000 },
  NATGAS: { currentPrice: 2.62, stepPct: 0.0030, volBase: 60000 },
  BRENT: { currentPrice: 82.50, stepPct: 0.0015, volBase: 30000 },
  COPPER: { currentPrice: 4.60, stepPct: 0.0012, volBase: 15000 },
  WHEAT: { currentPrice: 680.00, stepPct: 0.0013, volBase: 18000 },
  CORN: { currentPrice: 460.00, stepPct: 0.0012, volBase: 25000 },
  SOYBN: { currentPrice: 1210.00, stepPct: 0.0010, volBase: 14000 },
  COFFEE: { currentPrice: 220.00, stepPct: 0.0020, volBase: 9000 },

  // Stocks
  AAPL: { currentPrice: 190.40, stepPct: 0.0011, volBase: 52000 },
  TSLA: { currentPrice: 178.60, stepPct: 0.0022, volBase: 85000 },
  MSFT: { currentPrice: 420.20, stepPct: 0.0009, volBase: 23000 },
  NVDA: { currentPrice: 950.50, stepPct: 0.0028, volBase: 98000 },
  AMZN: { currentPrice: 180.80, stepPct: 0.0013, volBase: 42000 },
  GOOGL: { currentPrice: 175.20, stepPct: 0.0012, volBase: 31000 },
  META: { currentPrice: 475.60, stepPct: 0.0018, volBase: 33000 },
  'BRK.B': { currentPrice: 410.15, stepPct: 0.0006, volBase: 12000 },
  LLY: { currentPrice: 820.40, stepPct: 0.0015, volBase: 11000 },
  AMD: { currentPrice: 165.30, stepPct: 0.0020, volBase: 49000 },

  // Funds / ETFs
  SPY: { currentPrice: 525.40, stepPct: 0.0005, volBase: 75000 },
  QQQ: { currentPrice: 450.80, stepPct: 0.0007, volBase: 60000 },
  VOO: { currentPrice: 480.20, stepPct: 0.0005, volBase: 15000 },
  IWM: { currentPrice: 205.10, stepPct: 0.0008, volBase: 38000 },
  DIA: { currentPrice: 390.60, stepPct: 0.0004, volBase: 12000 },
  ARKK: { currentPrice: 42.15, stepPct: 0.0018, volBase: 24000 },
  GLD: { currentPrice: 216.50, stepPct: 0.0007, volBase: 11000 },
  USO: { currentPrice: 75.25, stepPct: 0.0014, volBase: 16000 },
  TLT: { currentPrice: 91.30, stepPct: 0.0006, volBase: 28000 },
  EEM: { currentPrice: 41.20, stepPct: 0.0008, volBase: 35000 },

  // Indices
  SPX: { currentPrice: 5250.00, stepPct: 0.0005, volBase: 150000 },
  IXIC: { currentPrice: 16600.00, stepPct: 0.0007, volBase: 180000 },
  DJI: { currentPrice: 39000.00, stepPct: 0.0004, volBase: 120000 },
  FTSE: { currentPrice: 8200.00, stepPct: 0.0005, volBase: 90000 },
  GDAXI: { currentPrice: 18400.00, stepPct: 0.0006, volBase: 70000 },
  N225: { currentPrice: 38500.00, stepPct: 0.0007, volBase: 85000 },
  NIFTY50: { currentPrice: 22500.00, stepPct: 0.0006, volBase: 105000 },
  FCHI: { currentPrice: 7900.00, stepPct: 0.0006, volBase: 45000 },
  HSI: { currentPrice: 18000.00, stepPct: 0.0010, volBase: 65000 },
  STOXX50: { currentPrice: 5000.00, stepPct: 0.0005, volBase: 55000 },

  // Cryptos
  BTC: { currentPrice: 67500.00, stepPct: 0.0022, volBase: 500 },
  ETH: { currentPrice: 3500.00, stepPct: 0.0025, volBase: 2500 },
  SOL: { currentPrice: 165.00, stepPct: 0.0035, volBase: 12000 },
  XRP: { currentPrice: 0.5220, stepPct: 0.0025, volBase: 150000 },
  ADA: { currentPrice: 0.4550, stepPct: 0.0028, volBase: 110000 },
  DOGE: { currentPrice: 0.1520, stepPct: 0.0042, volBase: 2400000 },
  BNB: { currentPrice: 590.00, stepPct: 0.0022, volBase: 800 },
  DOT: { currentPrice: 6.50, stepPct: 0.0030, volBase: 25000 },
  LINK: { currentPrice: 17.20, stepPct: 0.0032, volBase: 18000 },
  LTC: { currentPrice: 82.00, stepPct: 0.0025, volBase: 8500 }
};

// Simple LCG random generator for absolute determinism using seed
function makeSeededRandom(seedString: string) {
  let mask = 0xffffffff;
  let m_w = (123456789 + seedString.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) & mask;
  let m_z = (987654321 - seedString.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) & mask;

  return function() {
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    let result = ((m_z << 16) + m_w) & mask;
    // Ensure positive value
    result = (result >>> 0) / 4294967300;
    return result; // returning 0 to 1
  };
}

export function generateHistoricCandles(symbol: string, timeframe: string, count: number): CandleData[] {
  const rand = makeSeededRandom(symbol + timeframe);
  
  let currentPrice = 100;
  let stepPct = 0.0015;
  let volBase = 10000;

  const config = SYMBOL_CONFIGS[symbol];
  if (config) {
    currentPrice = config.currentPrice;
    stepPct = config.stepPct;
    volBase = config.volBase;
  }

  // Timeframe multiplier in seconds
  let tfSeconds = 86450;
  switch (timeframe) {
    case '1s': tfSeconds = 1; break;
    case '5s': tfSeconds = 5; break;
    case '1m': tfSeconds = 60; break;
    case '5m': tfSeconds = 300; break;
    case '15m': tfSeconds = 900; break;
    case '1h': tfSeconds = 3600; break;
    case '4h': tfSeconds = 14400; break;
    case '1d': tfSeconds = 86400; break;
    case '1w': tfSeconds = 604800; break;
  }

  const candles: CandleData[] = [];
  const baseTime = Math.floor(Date.now() / 1000) - count * tfSeconds;

  for (let i = 0; i < count; i++) {
    const o = currentPrice;
    const change = currentPrice * stepPct * (rand() - 0.495);
    const c = o + change;

    const h = Math.max(o, c) + currentPrice * stepPct * rand() * 0.55;
    const l = Math.min(o, c) - currentPrice * stepPct * rand() * 0.55;

    const vol = Math.floor(volBase * (0.4 + rand() * 1.2));

    candles.push({
      time: baseTime + i * tfSeconds,
      open: Number(o.toFixed(4)),
      high: Number(h.toFixed(4)),
      low: Number(l.toFixed(4)),
      close: Number(c.toFixed(4)),
      volume: vol
    });

    currentPrice = c;
  }

  return candles;
}

export function generate20LevelDepth(midPrice: number) {
  const bids = [];
  const asks = [];
  for (let i = 0; i < 20; i++) {
    bids.push({
      price: midPrice * (1 - (i + 1) * 0.0005),
      size: Math.floor(Math.random() * 10) + 1
    });
    asks.push({
      price: midPrice * (1 + (i + 1) * 0.0005),
      size: Math.floor(Math.random() * 10) + 1
    });
  }
  return { bids, asks };
}
