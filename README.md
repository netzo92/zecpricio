# ZEC Price & Shielded Supply Tracker

A premium, glassmorphism-themed dashboard for tracking Zcash (ZEC) price and shielded supply in real-time.

## Features

- **Real-time Price Tracking**: Live ZEC price updates via Binance WebSockets and CoinMarketCap.
- **Shielded Supply Monitoring**: Track the amount of ZEC in shielded pools.
- **Premium UI**: Modern glassmorphism design with Zcash-themed radial gradients and smooth animations.
- **Currency Toggle**: Switch between **USD** and **BTC** views instantly.
- **24h Market Stats**: View 24h High, Low, and Trading Volume.
- **Historical Charts**: Interactive price and shielded supply history.
- **LocalStorage Caching**: Instant load times by caching the last known price and user preferences.

## Tech Stack

- **Frontend**: Vanilla JS, CSS, HTML, Chart.js.
- **Backend/API Proxy**: Netlify Functions.
- **Data Sources**:
  - CoinMarketCap (Price, Supply, Stats)
  - CoinGecko (Historical Chart Data)
  - Binance (Live Price WebSocket)

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   CMC_API_KEY=your_coinmarketcap_api_key
   COINGECKO_API_KEY=your_coingecko_pro_key (optional)
   ```

3. **Start the development server**:
   Running with Netlify CLI ensures functions and API proxies work correctly:
   ```bash
   npm start
   ```

## Deployment

This app is optimized for deployment on **Netlify**.
- Connect your GitHub repository.
- Configure `CMC_API_KEY` in Netlify's Environment Variables.
- Build settings are automatically handled by `netlify.toml`.

