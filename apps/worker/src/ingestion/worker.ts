import type Redis from "ioredis";
import type { Queue } from "bullmq";
import type { Logger } from "pino";
import type { Pool } from "pg";
import {
  createPublicClient,
  getAddress,
  http,
  webSocket,
  type Abi,
  type Address,
  type Hex
} from "viem";
import { baseSepolia as viemBaseSepolia } from "viem/chains";

import { baseSepolia, queueNames, redisChannels } from "@rdat/shared";
import type { CandleAggregationJob, MonitoredPool, TradeEvent } from "@rdat/types";

import { config } from "../config";
import { detectWhaleAlert } from "../alerts/detector";
import { publishWhaleAlert } from "../alerts/publisher";
import { ensureWhaleAlertSchema, insertWhaleAlert } from "../alerts/repository";
import { uniswapV2PairAbi, uniswapV3PoolAbi } from "./abis";
import { acquireEventLock } from "./dedup";
import { normalizeV2Swap, normalizeV3Swap } from "./normalizer";
import { publishTrade } from "./publisher";
import { ensureIngestionSchema, insertTrade } from "./repository";

type SwapLog = {
  address: Address;
  args?: Record<string, unknown>;
  blockNumber?: bigint | null;
  logIndex?: number | null;
  transactionHash?: Hex | null;
};

type V2SwapArgs = Parameters<typeof normalizeV2Swap>[1];
type V3SwapArgs = Parameters<typeof normalizeV3Swap>[1];

export class IngestionWorker {
  private readonly blockTimestampCache = new Map<string, string>();
  private readonly unwatchers: Array<() => void> = [];
  private client: ReturnType<typeof createIngestionClient> | null = null;

  constructor(
    private readonly db: Pool,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly candleAggregationQueue: Queue<CandleAggregationJob> | null = null
  ) {}

  async start() {
    await ensureIngestionSchema(this.db);
    await ensureWhaleAlertSchema(this.db);

    if (!config.INGESTION_ENABLED) {
      this.logger.info("Blockchain ingestion disabled");
      return;
    }

    if (config.MONITORED_POOLS.length === 0) {
      this.logger.warn("Blockchain ingestion enabled without monitored pools");
      await this.publishSystemEvent("ingestion_no_pools");
      return;
    }

    this.client = createIngestionClient();
    const client = this.client;

    for (const pool of config.MONITORED_POOLS) {
      const unwatch = client.watchContractEvent({
        address: pool.address,
        abi: getSwapAbi(pool.protocol),
        eventName: "Swap",
        pollingInterval: config.INGESTION_POLLING_INTERVAL_MS,
        onLogs: (logs) => {
          void this.handleLogs(pool, logs as unknown as SwapLog[]).catch((error: unknown) => {
            this.logger.error({ error, pool: pool.address }, "Failed to process swap logs");
          });
        },
        onError: (error) => {
          this.logger.error({ error, pool: pool.address }, "Swap watcher error");
          void this.publishSystemEvent("ingestion_watcher_error", {
            pool: pool.address,
            message: error.message
          });
        }
      });

      this.unwatchers.push(unwatch);
      this.logger.info({ pool }, "Started swap watcher");
    }

    await this.publishSystemEvent("ingestion_started", {
      chainId: baseSepolia.chainId,
      pools: config.MONITORED_POOLS.length
    });
  }

  async stop() {
    for (const unwatch of this.unwatchers.splice(0)) {
      unwatch();
    }

    await this.publishSystemEvent("ingestion_stopped");
  }

  private async handleLogs(pool: MonitoredPool, logs: SwapLog[]) {
    for (const log of logs) {
      await this.handleLog(pool, log);
    }
  }

  private async handleLog(pool: MonitoredPool, log: SwapLog) {
    if (!this.client || !log.transactionHash || log.blockNumber === null || log.blockNumber === undefined) {
      return;
    }

    const logIndex = log.logIndex;
    if (logIndex === null || logIndex === undefined) {
      return;
    }

    const locked = await acquireEventLock(
      this.redis,
      {
        chainId: baseSepolia.chainId,
        txHash: log.transactionHash,
        logIndex
      },
      config.INGESTION_DEDUP_TTL_SECONDS
    );

    if (!locked) {
      return;
    }

    const [blockTimestamp, transaction] = await Promise.all([
      this.getBlockTimestamp(log.blockNumber),
      this.client.getTransaction({ hash: log.transactionHash })
    ]);

    const baseInput = {
      pool,
      txHash: log.transactionHash,
      logIndex,
      blockNumber: Number(log.blockNumber),
      timestamp: blockTimestamp,
      walletAddress: getAddress(transaction.from)
    };

    const normalized =
      pool.protocol === "uniswap-v2"
        ? normalizeV2Swap(baseInput, (log.args ?? {}) as V2SwapArgs)
        : normalizeV3Swap(baseInput, (log.args ?? {}) as V3SwapArgs);

    if (!normalized) {
      this.logger.warn({ txHash: log.transactionHash, logIndex, pool }, "Ignored unsupported swap shape");
      return;
    }

    const inserted = await insertTrade(this.db, {
      txHash: normalized.txHash,
      logIndex: normalized.logIndex,
      chainId: baseSepolia.chainId,
      protocol: normalized.protocol,
      pairAddress: getAddress(normalized.pool.address),
      tokenIn: normalized.tokenIn,
      tokenOut: normalized.tokenOut,
      amountIn: normalized.amountIn,
      amountOut: normalized.amountOut,
      usdValue: normalized.usdValue,
      walletAddress: normalized.walletAddress,
      blockNumber: normalized.blockNumber,
      timestamp: normalized.timestamp
    });

    if (!inserted) {
      return;
    }

    await publishTrade(this.redis, inserted);
    await this.enqueueCandleAggregation(inserted);
    await this.handleWhaleAlert(inserted);
    this.logger.info(
      {
        txHash: inserted.txHash,
        logIndex: inserted.logIndex,
        pairAddress: inserted.pairAddress,
        amountIn: inserted.amountIn,
        amountOut: inserted.amountOut
      },
      "Ingested swap"
    );
  }

  private async getBlockTimestamp(blockNumber: bigint) {
    const cacheKey = blockNumber.toString();
    const cached = this.blockTimestampCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.client) {
      throw new Error("RPC client is not initialized");
    }

    const block = await this.client.getBlock({ blockNumber });
    const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();

    this.blockTimestampCache.set(cacheKey, timestamp);
    if (this.blockTimestampCache.size > 256) {
      const oldestKey = this.blockTimestampCache.keys().next().value;
      if (oldestKey) {
        this.blockTimestampCache.delete(oldestKey);
      }
    }

    return timestamp;
  }

  private async publishSystemEvent(type: string, payload: Record<string, unknown> = {}) {
    await this.redis.publish(
      redisChannels.system,
      JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString()
      })
    );
  }

  private async enqueueCandleAggregation(trade: TradeEvent) {
    if (!this.candleAggregationQueue) {
      return;
    }

    const price = calculateTradePrice(trade.amountIn, trade.amountOut);
    if (!price) {
      this.logger.warn({ tradeId: trade.id, txHash: trade.txHash }, "Skipped candle aggregation without price");
      return;
    }

    const volume = calculateCandleVolume(trade);
    if (!volume) {
      this.logger.warn({ tradeId: trade.id, txHash: trade.txHash }, "Skipped candle aggregation without volume");
      return;
    }

    await this.candleAggregationQueue.add(
      "aggregate-trade-candles",
      {
        tradeId: trade.id,
        pairAddress: trade.pairAddress,
        price,
        volume,
        timestamp: trade.timestamp
      },
      {
        jobId: `${trade.id}-candles`
      }
    );

    this.logger.debug(
      {
        queue: queueNames.candleAggregation,
        tradeId: trade.id,
        pairAddress: trade.pairAddress
      },
      "Queued candle aggregation"
    );
  }

  private async handleWhaleAlert(trade: TradeEvent) {
    const detection = detectWhaleAlert(trade, config.WHALE_ALERT_THRESHOLD_USD);
    if (!detection) {
      return;
    }

    const alert = await insertWhaleAlert(this.db, trade.id, detection.threshold);
    if (!alert) {
      return;
    }

    await publishWhaleAlert(this.redis, alert);
    this.logger.info(
      {
        tradeId: trade.id,
        txHash: trade.txHash,
        usdValue: alert.usdValue,
        threshold: alert.threshold
      },
      "Published whale alert"
    );
  }
}

function getSwapAbi(protocol: MonitoredPool["protocol"]): Abi {
  return protocol === "uniswap-v2" ? uniswapV2PairAbi : uniswapV3PoolAbi;
}

function createIngestionClient() {
  return createPublicClient({
    chain: viemBaseSepolia,
    transport: config.BASE_SEPOLIA_RPC_WS_URL
      ? webSocket(config.BASE_SEPOLIA_RPC_WS_URL)
      : http(config.BASE_SEPOLIA_RPC_HTTP_URL)
  });
}

function calculateTradePrice(amountIn: string, amountOut: string) {
  const input = Number(amountIn);
  const output = Number(amountOut);

  if (!Number.isFinite(input) || !Number.isFinite(output) || input <= 0 || output <= 0) {
    return null;
  }

  return (output / input).toString();
}

function calculateCandleVolume(trade: TradeEvent) {
  const value = Number(trade.usdValue ?? trade.amountIn);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value.toString();
}
