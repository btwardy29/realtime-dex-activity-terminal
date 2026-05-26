export type SupportedCandleInterval = "1m" | "5m" | "15m";

export type TradeEvent = {
  id: string;
  txHash: string;
  pairAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  usdValue: string | null;
  walletAddress: string;
  blockNumber: number;
  timestamp: string;
};

export type Candle = {
  pairAddress: string;
  interval: SupportedCandleInterval;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  timestamp: string;
};

export type WhaleAlert = {
  id: string;
  tradeId: string;
  threshold: string;
  createdAt: string;
};
