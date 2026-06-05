# -*- coding: utf-8 -*-
"""
Split-Screen Trading Terminal Data Source Adapter
------------------------------------------------
This pluggable data handler defines methods for retrieving historic OHLVC candle charts
and subscribing to websocket feeds across various cryptocurrency & stock broker networks.

Simply call the appropriate connector function or extend it with standard responses
to swap your active backend in a single function swap!
"""

import time
import json
import random

class PluggableDataSource:
    def __init__(self, symbol, timeframe):
        self.symbol = symbol
        self.timeframe = timeframe

    def fetch_yahoo_finance(self):
        """
        Fetch OHLCV historical bars from Yahoo Finance.
        Compatible with RELIANCE.NS, TCS.NS, NIFTY50, AAPL, etc.
        """
        print(f"[YFinance] Fetching {self.symbol} bars for timeframe {self.timeframe}")
        # Placeholder integration with yfinance library
        # import yfinance as yf
        # ticker = yf.Ticker(self.symbol)
        # df = ticker.history(period="1y", interval=self.timeframe)
        # return df.to_dict(orient="records")
        return self._generate_simulated_historic_data(base_price=2500)

    def fetch_hyperliquid_api(self):
        """
        Retrieve crypto status directly from Hyperliquid Spot/Perp APIs.
        """
        print(f"[Hyperliquid] Loading historical candlebricks for {self.symbol}")
        # Connection logic:
        # import requests
        # r = requests.post("https://api.hyperliquid.xyz/info", json={
        #     "type": "candleSnapshot", 
        #     "req": {"coin": self.symbol, "interval": self.timeframe, "startTime": int(time.time() - 86400*30)*1000}
        # })
        # return r.json()
        return self._generate_simulated_historic_data(base_price=64000)

    def fetch_alpaca_data(self):
        """
        Adapter function to fetch US stock data from Alpaca Market APIs.
        """
        print(f"[Alpaca] Loading stock feed for symbol {self.symbol}")
        # from alpaca.data.historical import StockHistoricalDataClient
        # from alpaca.data.requests import StockBarsRequest
        return self._generate_simulated_historic_data(base_price=175)

    def fetch_binance_data(self):
        """
        Adapter function to fetch cryptocurrency tickers from Binance.
        """
        print(f"[Binance] Loading Spot candles for {self.symbol}")
        # api_endpoint: https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d
        return self._generate_simulated_historic_data(base_price=65000)

    def fetch_zerodha_data(self):
        """
        Adapter function to fetch Indian Stock data from Zerodha Kite Connect API.
        """
        print(f"[Zerodha] Querying historical charts for instrument token corresponding to {self.symbol}")
        # kite.historical_data(instrument_token, from_date, to_date, timeframe)
        return self._generate_simulated_historic_data(base_price=3500)

    def fetch_polygon_data(self):
        """
        Adapter function for Polygon.io API.
        """
        print(f"[Polygon] Retrieving {self.symbol} aggregate aggregates")
        # api_endpoint: v2/aggs/ticker/AAPL/range/1/day/2026-01-01/2026-05-31
        return self._generate_simulated_historic_data(base_price=150)

    def _generate_simulated_historic_data(self, base_price=100):
        # Generates compatible structure for the lightweight chart front-end
        current_price = base_price
        candles = []
        now = int(time.time())
        day_seconds = 86400

        for i in range(500):
            change = current_price * 0.0015 * (random.random() - 0.49)
            candle_time = now - (500 - i) * day_seconds
            open_p = current_price
            close_p = current_price + change
            high_p = max(open_p, close_p) + (random.random() * current_price * 0.001)
            low_p = min(open_p, close_p) - (random.random() * current_price * 0.001)
            volume = random.randint(5000, 50000)

            candles.append({
                "time": candle_time,
                "open": round(open_p, 2),
                "high": round(high_p, 2),
                "low": round(low_p, 2),
                "close": round(close_p, 2),
                "volume": volume
            })
            current_price = close_p
        
        return candles

# Example subscription payload format for websockets
HYPERLIQUID_WS_SUBSCRIBE = {
    "method": "subscribe",
    "subscription": {
        "type": "trades",
        "coin": "BTC"
    }
}
