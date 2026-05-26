export type SupportedCandleInterval = "1m" | "5m" | "15m";

export type DexProtocol = "uniswap-v2" | "uniswap-v3";

export type MonitoredPool = {
  address: `0x${string}`;
  protocol: DexProtocol;
  token0: `0x${string}`;
  token1: `0x${string}`;
  token0Symbol?: string | undefined;
  token1Symbol?: string | undefined;
  token0Decimals?: number | undefined;
  token1Decimals?: number | undefined;
};

export type TradeEvent = {
  id: string;
  txHash: string;
  logIndex: number;
  chainId: number;
  protocol: DexProtocol;
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

export type CandleAggregationJob = {
  tradeId: string;
  pairAddress: string;
  price: string;
  volume: string;
  timestamp: string;
};

export type WhaleAlert = {
  id: string;
  tradeId: string;
  threshold: string;
  createdAt: string;
};

export type RealtimeEventType = "trade" | "ticker_update" | "candle_update" | "whale_alert" | "system";

export type RealtimeEvent<TPayload = unknown> = {
  type: RealtimeEventType;
  payload: TPayload;
};

export type RealtimeChannel = "trades" | "ticker" | "candles" | "whaleAlerts" | "system";

export type WebSocketClientMessage =
  | {
      type: "subscribe";
      channels: RealtimeChannel[];
    }
  | {
      type: "unsubscribe";
      channels: RealtimeChannel[];
    }
  | {
      type: "ping";
    };
