export default {
  async fetch(request) {
    const url = new URL(request.url);
    const symbols = url.searchParams.get('symbols') || '';
    const endpoint = url.searchParams.get('endpoint'); // 'chart' ou null

    let yahooUrl;

    if (endpoint === 'chart') {
      // Historique OHLCV
      const interval = url.searchParams.get('interval') || '1d';
      const range    = url.searchParams.get('range')    || '1y';
      yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbols}?interval=${interval}&range=${range}`;
    } else {
      // Prix live (comportement actuel)
      yahooUrl = `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${symbols}&fields=regularMarketPrice,postMarketPrice,preMarketPrice,previousClose`;
    }

    const res = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });

    return new Response(await res.text(), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}