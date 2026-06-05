import { LiveDataProvider } from './liveData';

export type PriceCallback = (price: number) => void;

const HYPERLIQUID_CRYPTOS = new Set([
  'BTC','ETH','SOL','XRP','ADA','DOGE','BNB','DOT','LINK','LTC',
  'AVAX','MATIC','UNI','ATOM','NEAR','APT','SUI','INJ','OP','ARB',
]);

class HyperliquidWSService {
  private ws: WebSocket | null = null;
  private subs = new Map<string, Set<PriceCallback>>();
  private simulatedIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private lastPrices = new Map<string, number>();
  private reconnectDelay = 2000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.connect();
    // Start background Yahoo Finance polling
    LiveDataProvider.getInstance().startStreaming(3000);
  }

  // -------------------------------------------------------------------------
  // WebSocket lifecycle
  // -------------------------------------------------------------------------
  private connect() {
    try {
      this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

      this.ws.onopen = () => {
        console.log('[HyperliquidWS] Connected');
        this.reconnectDelay = 2000; // reset backoff on success

        // Resubscribe to all crypto symbols that were active
        this.subs.forEach((_, symbol) => {
          if (this.isHyperliquidCrypto(symbol)) {
            this.sendSubscribe(symbol);
          }
        });

        // Heartbeat: Hyperliquid closes idle connections after ~30s
        this.heartbeatInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, 20_000);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          if (message.channel === 'trades' && Array.isArray(message.data) && message.data.length > 0) {
            const trade = message.data[0];
            const symbol: string = trade.coin;
            const price = parseFloat(trade.px);
            if (symbol && !isNaN(price) && price > 0) {
              this.lastPrices.set(symbol, price);
              this.subs.get(symbol)?.forEach((cb) => cb(price));
            }
          }
        } catch {
          // ignore parse errors (ping/pong frames, etc.)
        }
      };

      this.ws.onerror = (e) => {
        console.warn('[HyperliquidWS] Error:', e);
      };

      this.ws.onclose = () => {
        console.warn(`[HyperliquidWS] Closed — reconnecting in ${this.reconnectDelay}ms`);
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
        setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000); // cap at 30s
          this.connect();
        }, this.reconnectDelay);
      };
    } catch (e) {
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private isHyperliquidCrypto(symbol: string): boolean {
    return HYPERLIQUID_CRYPTOS.has(symbol);
  }

  private sendSubscribe(symbol: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'trades', coin: symbol },
      }));
    }
  }

  private sendUnsubscribe(symbol: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        subscription: { type: 'trades', coin: symbol },
      }));
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  public subscribe(symbol: string, callback: PriceCallback): () => void {
    if (!this.subs.has(symbol)) {
      this.subs.set(symbol, new Set());
    }
    this.subs.get(symbol)!.add(callback);

    if (this.isHyperliquidCrypto(symbol)) {
      this.sendSubscribe(symbol);
    } else {
      this.startSimulation(symbol);
    }

    // Return unsubscribe function
    return () => {
      const set = this.subs.get(symbol);
      if (!set) return;
      set.delete(callback);
      if (set.size === 0) {
        this.subs.delete(symbol);
        if (this.isHyperliquidCrypto(symbol)) {
          this.sendUnsubscribe(symbol);
        } else {
          this.stopSimulation(symbol);
        }
      }
    };
  }

  // -------------------------------------------------------------------------
  // Simulation for non-crypto symbols (stocks, forex, commodities)
  // Drifts toward real Yahoo price when available, otherwise micro-fluctuates
  // -------------------------------------------------------------------------
  private startSimulation(symbol: string) {
    if (this.simulatedIntervals.has(symbol)) return;

    let lastSentTimestamp = 0;
    
    const interval = setInterval(() => {
      const liveObj = LiveDataProvider.getInstance().getLatestPrice(symbol);

      if (liveObj?.price && liveObj.price > 0 && liveObj.timestamp !== lastSentTimestamp) {
        lastSentTimestamp = liveObj.timestamp;
        this.lastPrices.set(symbol, liveObj.price);
        this.subs.get(symbol)?.forEach((cb) => cb(liveObj.price));
      }
    }, 1000);

    this.simulatedIntervals.set(symbol, interval);
  }

  private stopSimulation(symbol: string) {
    const iv = this.simulatedIntervals.get(symbol);
    if (iv) {
      clearInterval(iv);
      this.simulatedIntervals.delete(symbol);
    }
  }

  private baselinePrice(symbol: string): number {
    const defaults: Record<string, number> = {
      EURUSD: 1.082, USDJPY: 149.5, GBPUSD: 1.265, AUDUSD: 0.653,
      GOLD: 2330, SILVER: 27.5, OIL: 78.5, BRENT: 82.0, NATGAS: 2.1,
      AAPL: 190, TSLA: 178, NVDA: 870, MSFT: 415, AMZN: 185,
      SPY: 520, SPX: 5200, QQQ: 440, NDX: 18000, VIX: 14,
      BTC: 65000, ETH: 3400, SOL: 160,
    };
    return defaults[symbol] ?? 100;
  }

  private volatilityFor(symbol: string): number {
    if (['TSLA','NVDA','AMD','MSTR'].includes(symbol)) return 0.00085;
    if (['GOLD','OIL','BRENT','SILVER','NATGAS'].includes(symbol)) return 0.00045;
    if (['EURUSD','USDJPY','GBPUSD','AUDUSD'].includes(symbol)) return 0.000085;
    return 0.00015;
  }
}

export const hyperliquidWS = new HyperliquidWSService();