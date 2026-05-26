export const redisChannels = {
  trades: "dex:trades",
  ticker: "dex:ticker",
  candles: "dex:candles",
  whaleAlerts: "dex:whale-alerts",
  system: "dex:system"
} as const;

export const queueNames = {
  candleAggregation: "candle-aggregation",
  trendingCalculation: "trending-calculation",
  ingestionRetry: "ingestion-retry",
  cleanup: "cleanup"
} as const;

export const supportedCandleIntervals = ["1m", "5m", "15m"] as const;

export const baseSepolia = {
  chainId: 84532,
  name: "Base Sepolia"
} as const;

export const redisKeyPrefixes = {
  ingestionDedup: "dex:ingestion:dedup",
  recentTrades: "dex:recent-trades"
} as const;
