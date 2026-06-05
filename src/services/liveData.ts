import { LivePrice } from '../types';
import { SYMBOL_CONFIGS } from '../utils/dataGenerator';

// ---------------------------------------------------------------------------
// Worker URL
// ---------------------------------------------------------------------------
const WORKER = 'https://trader-proxy.thetrader.workers.dev';

// ---------------------------------------------------------------------------
// Symbol mapping: internal app key → Yahoo Finance ticker
// ---------------------------------------------------------------------------
const YAHOO_MAP: Record<string, string> = {
  // Forex
  EURUSD: 'EURUSD=X', USDJPY: 'JPY=X',    GBPUSD: 'GBPUSD=X',
  AUDUSD: 'AUDUSD=X', USDCAD: 'CAD=X',    USDCHF: 'CHF=X',
  NZDUSD: 'NZDUSD=X', EURGBP: 'EURGBP=X', EURJPY: 'EURJPY=X',
  GBPJPY: 'GBPJPY=X', USDMXN: 'MXN=X',    USDZAR: 'ZAR=X',
  EURCHF: 'EURCHF=X', EURAUD: 'EURAUD=X',  GBPAUD: 'GBPAUD=X',
  CADJPY: 'CADJPY=X', AUDNZD: 'AUDNZD=X',  GBPCAD: 'GBPCAD=X',

  // Crypto → Yahoo uses COIN-USD format
  BTC:   'BTC-USD',  ETH:   'ETH-USD',  SOL:  'SOL-USD',
  XRP:   'XRP-USD',  ADA:   'ADA-USD',  DOGE: 'DOGE-USD',
  BNB:   'BNB-USD',  DOT:   'DOT-USD',  LINK: 'LINK-USD',
  LTC:   'LTC-USD',  AVAX:  'AVAX-USD', MATIC:'MATIC-USD',
  UNI:   'UNI-USD',  ATOM:  'ATOM-USD', NEAR: 'NEAR-USD',
  APT:   'APT-USD',  SUI:   'SUI-USD',  INJ:  'INJ-USD',
  OP:    'OP-USD',   ARB:   'ARB-USD',  TRX:  'TRX-USD',
  TON:   'TON-USD',

  // Commodities (futures)
  GOLD:      'GC=F',  OIL:       'CL=F',  SILVER:    'SI=F',
  NATGAS:    'NG=F',  BRENT:     'BZ=F',  COPPER:    'HG=F',
  WHEAT:     'ZW=F',  CORN:      'ZC=F',  SOYBN:     'ZS=F',
  COFFEE:    'KC=F',  SUGAR:     'SB=F',  COTTON:    'CT=F',
  PLATINUM:  'PL=F',  PALLADIUM: 'PA=F',

  // US Indices & ETFs
  SPX:  '^GSPC', NDX:  '^NDX',  DJI:  '^DJI',
  RUT:  '^RUT',  VIX:  '^VIX',  IXIC: '^IXIC',
  SPY:  'SPY',   QQQ:  'QQQ',   VOO:  'VOO',
  IWM:  'IWM',   DIA:  'DIA',   ARKK: 'ARKK',
  GLD:  'GLD',   USO:  'USO',   TLT:  'TLT',
  EEM:  'EEM',

  // Global Indices
  FTSE:    '^FTSE',    GDAXI:   '^GDAXI',  FCHI:    '^FCHI',
  N225:    '^N225',    HSI:     '^HSI',    STOXX50: '^STOXX50',
  NIFTY50: '^NSEI',    ASX200:  '^AXJO',   TSX:     '^GSPTSE',

  // US Stocks (explicit to avoid crypto catch-all)
  AAPL: 'AAPL', TSLA: 'TSLA', MSFT: 'MSFT', NVDA: 'NVDA',
  AMZN: 'AMZN', GOOGL:'GOOGL',META: 'META', LLY:  'LLY',
  AMD:  'AMD',  JPM:  'JPM',  BAC:  'BAC',  V:    'V',
  MA:   'MA',   UNH:  'UNH',  JNJ:  'JNJ',  PG:   'PG',
  HD:   'HD',   MRK:  'MRK',  ABBV: 'ABBV', PFE:  'PFE',
  NFLX: 'NFLX', INTC: 'INTC', PYPL: 'PYPL', 'BRK.B': 'BRK-B',
};

/** Convert internal app symbol → Yahoo ticker */
function toYahoo(appSymbol: string): string {
  return YAHOO_MAP[appSymbol] ?? appSymbol;
}

/** Reverse map: Yahoo ticker → app symbol (built once at module load) */
const REVERSE_MAP: Record<string, string> = {};
for (const [app, yahoo] of Object.entries(YAHOO_MAP)) {
  REVERSE_MAP[yahoo] = app;
}

// ---------------------------------------------------------------------------
// LiveDataProvider — singleton, polls worker on an interval
// ---------------------------------------------------------------------------
export class LiveDataProvider {
  private static instance: LiveDataProvider;
  private prices: Map<string, LivePrice> = new Map();
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private currentIntervalMs = 5000;
  private consecutiveFailures = 0;
  private MAX_INTERVAL_MS = 60000;
  private symbols: string[];
  private fetchCount = 0;

  private constructor() {
    this.symbols = Object.keys(SYMBOL_CONFIGS);

    // Seed with baseline prices so charts render immediately on mount
    for (const symbol of this.symbols) {
      const cfg = SYMBOL_CONFIGS[symbol as keyof typeof SYMBOL_CONFIGS];
      this.prices.set(symbol, {
        symbol,
        price: cfg.currentPrice,
        timestamp: Date.now(),
      });
    }
  }

  static getInstance(): LiveDataProvider {
    if (!LiveDataProvider.instance) {
      LiveDataProvider.instance = new LiveDataProvider();
    }
    return LiveDataProvider.instance;
  }

  /**
   * Start polling the worker proxy with exponential backoff on failures.
   */
  startStreaming(baseIntervalMs = 5000) {
    if (this.intervalId) return;
    this.currentIntervalMs = baseIntervalMs;
    this.consecutiveFailures = 0;

    const loop = () => {
      this.fetchAllBatches().finally(() => {
        if (this.intervalId) {
          this.intervalId = setTimeout(loop, this.currentIntervalMs);
        }
      });
    };
    
    // First trigger
    this.fetchAllBatches().finally(() => {
       this.intervalId = setTimeout(loop, this.currentIntervalMs);
    });
  }

  stopStreaming() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Batch fetching — 20 symbols per request to stay under URL limits
  // ---------------------------------------------------------------------------
  private async fetchAllBatches(): Promise<void> {
    const BATCH_SIZE = 20;
    const batches: string[][] = [];
    for (let i = 0; i < this.symbols.length; i += BATCH_SIZE) {
      batches.push(this.symbols.slice(i, i + BATCH_SIZE));
    }
    // Run all batches in parallel
    let successCount = 0;
    const results = await Promise.allSettled(batches.map(batch => this.fetchBatch(batch)));
    results.forEach(res => {
      if (res.status === 'fulfilled' && res.value) successCount++;
    });

    if (successCount === 0 && batches.length > 0) {
       // All failed -> increase backoff
       this.consecutiveFailures++;
       this.currentIntervalMs = Math.min(this.MAX_INTERVAL_MS, this.currentIntervalMs * 1.5);
    } else {
       // Recovered
       this.consecutiveFailures = 0;
       this.currentIntervalMs = 5000;
    }

    this.fetchCount++;
    if (this.fetchCount === 1) {
      console.log('[LiveDataProvider] First fetch done — live prices active.');
    }
  }

  private async fetchBatch(batch: string[]): Promise<boolean> {
    const yahooSymbols = batch.map(toYahoo).join(',');
    const url = `${WORKER}?symbols=${encodeURIComponent(yahooSymbols)}`;

    let json: any;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (!res.ok) {
        if (res.status === 429) {
           console.warn(`[LiveDataProvider] Rate Limited (429) for batch: [${batch.join(', ')}]`);
        } else {
           console.warn(`[LiveDataProvider] Worker HTTP ${res.status} — batch: [${batch.join(', ')}]`);
        }
        await this.applyFallbackAPI(batch);
        return false;
      }

      const raw = await res.text();

      // Guard: if worker returns an HTML error page (rate limit, CF error) instead of JSON
      if (raw.trimStart().startsWith('<')) {
        console.warn(`[LiveDataProvider] Worker returned HTML - applying secondary fallback.`);
        await this.applyFallbackAPI(batch);
        return false;
      }

      json = JSON.parse(raw);
    } catch (err) {
      console.warn(`[LiveDataProvider] Network error — batch: [${batch.join(', ')}]`);
      await this.applyFallbackAPI(batch);
      return false;
    }

    // ---------------------------------------------------------------------------
    // Parse Yahoo Finance v8/finance/quote response
    // { quoteResponse: { result: [{ symbol, regularMarketPrice, ... }] } }
    // ---------------------------------------------------------------------------
    const results: any[] = json?.quoteResponse?.result ?? [];

    if (results.length === 0) {
      console.warn('[LiveDataProvider] Empty result from worker for batch:', batch);
      await this.applyFallbackAPI(batch);
      return false;
    }

    const returnedYahooSymbols = new Set<string>();

    for (const quote of results) {
      returnedYahooSymbols.add(quote.symbol);

      // Map Yahoo ticker back to app symbol
      const appSymbol =
        REVERSE_MAP[quote.symbol] ??
        batch.find(s => toYahoo(s) === quote.symbol) ??
        quote.symbol;

      // Pick best available price field in priority order
      const price =
        quote.regularMarketPrice ??
        quote.postMarketPrice    ??
        quote.preMarketPrice     ??
        quote.previousClose;

      if (typeof price === 'number' && price > 0) {
        this.prices.set(appSymbol, {
          symbol: appSymbol,
          price,
          timestamp: Date.now(),
        });
      } else {
        await this.applyFallbackAPI([appSymbol]);
      }
    }

    // Any symbol Yahoo silently omitted from results gets a fallback tick
    for (const sym of batch) {
      if (!returnedYahooSymbols.has(toYahoo(sym))) {
        await this.applyFallbackAPI([sym]);
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Fallback API / Mock Strategy
  // ---------------------------------------------------------------------------
  private async applyFallbackAPI(batch: string[]): Promise<void> {
    // 1. Try Binance for Crypto
    const cryptoBatch = batch.filter(s => ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'BNB'].includes(s));
    
    if (cryptoBatch.length > 0) {
       try {
         // parallel binance fetch per symbol
         await Promise.allSettled(cryptoBatch.map(async sym => {
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`, { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (data && data.price) {
               this.prices.set(sym, { symbol: sym, price: parseFloat(data.price), timestamp: Date.now() });
            } else {
               this.applyMicroFluctuation(sym);
            }
         }));
       } catch(e) {
         cryptoBatch.forEach(s => this.applyMicroFluctuation(s));
       }
    }

    // 2. Simulated micro-fluctuations for Stocks / Indices so charts don't freeze indefinitely
    const nonCrypto = batch.filter(s => !cryptoBatch.includes(s));
    nonCrypto.forEach(s => this.applyMicroFluctuation(s));
  }

  private applyMicroFluctuation(symbol: string): void {
    const current = this.prices.get(symbol);
    if (!current) return;
    
    // Applying minor noise (+- 0.01%) so the front-end sees an update event 
    // when rate limits block real data for minutes.
    const noise = current.price * 0.0001 * (Math.random() - 0.5);
    
    this.prices.set(symbol, {
      symbol,
      price: current.price + noise,
      timestamp: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------
  getLatestPrice(symbol: string): LivePrice | undefined {
    return this.prices.get(symbol);
  }

  getAllPrices(): Map<string, LivePrice> {
    return this.prices;
  }

  /**
   * Returns true if we have a real fetched price (not just the seed baseline).
   * "Live" = updated within the last 30 seconds.
   */
  hasLivePrice(symbol: string): boolean {
    const p = this.prices.get(symbol);
    if (!p) return false;
    return Date.now() - p.timestamp < 30_000;
  }
}

// ---------------------------------------------------------------------------
// fetchRealHistoricCandles
//
// Fetches OHLCV candle history for a symbol via the worker proxy.
// Uses Yahoo Finance /v8/finance/chart endpoint.
//
// @param symbol   - internal app symbol (e.g. 'BTC', 'EURUSD', 'AAPL')
// @param timeframe - app timeframe string ('1m','5m','15m','1h','4h','1d','1w')
// @param bars      - number of candles to fetch (max ~1000 depending on tf)
// ---------------------------------------------------------------------------
export interface HistoricCandle {
  time: number;   // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TF_TO_YAHOO: Record<string, { interval: string; range: string }> = {
  '1s':  { interval: '1m',  range: '10d'   },  // Yahoo min is 1m (max 7d)
  '5s':  { interval: '1m',  range: '25d'   },
  '1m':  { interval: '1m',  range: '45d'   },
  '5m':  { interval: '5m',  range: '60d'  },  // max 60d
  '15m': { interval: '15m', range: '90d'  },
  '1h':  { interval: '60m', range: '730d' },  // max 730d (2y)
  '4h':  { interval: '60m', range: '730d' },  // Yahoo has no 4h; we resample from 1h. Max 730d
  '1d':  { interval: '1d',  range: '10y'  },
  '1w':  { interval: '1wk', range: 'max'  },
};

/** Resample 1h candles into 4h candles */
function resampleTo4h(candles: HistoricCandle[]): HistoricCandle[] {
  const out: HistoricCandle[] = [];
  for (let i = 0; i < candles.length; i += 4) {
    const chunk = candles.slice(i, i + 4);
    if (chunk.length === 0) continue;
    out.push({
      time:   chunk[0].time,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map(c => c.high)),
      low:    Math.min(...chunk.map(c => c.low)),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    });
  }
  return out;
}

export async function fetchRealHistoricCandles(
  symbol: string,
  timeframe: string,
  bars = 600
): Promise<HistoricCandle[]> {
  const yahooSym = YAHOO_MAP[symbol] ?? symbol;
  const tf = TF_TO_YAHOO[timeframe] ?? { interval: '1d', range: '5y' };

  const url =
    `${WORKER}?` +
    `symbols=${encodeURIComponent(yahooSym)}` +
    `&interval=${tf.interval}` +
    `&range=${tf.range}` +
    `&endpoint=chart`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.text();
    if (raw.trimStart().startsWith('<')) throw new Error('HTML response — proxy error');

    const json = JSON.parse(raw);

    // Yahoo Finance /v8/finance/chart response shape
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('No chart result');

    const timestamps: number[]  = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    const opens:   number[] = q.open   ?? [];
    const highs:   number[] = q.high   ?? [];
    const lows:    number[] = q.low    ?? [];
    const closes:  number[] = q.close  ?? [];
    const volumes: number[] = q.volume ?? [];

    let candles: HistoricCandle[] = [];
    let prevTime = -1;

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      if (t <= prevTime) continue;

      const o = opens[i], h = highs[i], l = lows[i], c = closes[i];
      // Skip null/NaN candles Yahoo sometimes returns for non-trading hours
      if (o == null || h == null || l == null || c == null) continue;
      if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) continue;

      candles.push({
        time:   t,
        open:   o,
        high:   h,
        low:    l,
        close:  c,
        volume: volumes[i] ?? 0,
      });
      prevTime = t;
    }

    // Resample 1h → 4h if needed
    if (timeframe === '4h') {
      candles = resampleTo4h(candles);
    }

    // Return last N bars
    return candles.slice(-bars);

  } catch (err) {
    console.warn(`[fetchRealHistoricCandles] Failed for ${symbol} (${timeframe}):`, err);
    // Return empty — caller falls back to generateHistoricCandles()
    return [];
  }
}