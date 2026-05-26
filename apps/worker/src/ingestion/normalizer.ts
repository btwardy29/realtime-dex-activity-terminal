import { formatUnits, getAddress, type Address } from "viem";

import type { DexProtocol, MonitoredPool } from "@rdat/types";

type BaseNormalizeInput = {
  pool: MonitoredPool;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  timestamp: string;
  walletAddress: Address;
};

type V2SwapArgs = {
  sender?: Address;
  amount0In?: bigint;
  amount1In?: bigint;
  amount0Out?: bigint;
  amount1Out?: bigint;
  to?: Address;
};

type V3SwapArgs = {
  sender?: Address;
  recipient?: Address;
  amount0?: bigint;
  amount1?: bigint;
};

export type NormalizedTradeInput = BaseNormalizeInput & {
  protocol: DexProtocol;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
  usdValue: string | null;
};

export function normalizeV2Swap(input: BaseNormalizeInput, args: V2SwapArgs) {
  const amount0In = args.amount0In ?? 0n;
  const amount1In = args.amount1In ?? 0n;
  const amount0Out = args.amount0Out ?? 0n;
  const amount1Out = args.amount1Out ?? 0n;

  if (amount0In > 0n && amount1Out > 0n) {
    return buildTrade(input, "uniswap-v2", input.pool.token0, input.pool.token1, amount0In, amount1Out);
  }

  if (amount1In > 0n && amount0Out > 0n) {
    return buildTrade(input, "uniswap-v2", input.pool.token1, input.pool.token0, amount1In, amount0Out);
  }

  return null;
}

export function normalizeV3Swap(input: BaseNormalizeInput, args: V3SwapArgs) {
  const amount0 = args.amount0 ?? 0n;
  const amount1 = args.amount1 ?? 0n;

  if (amount0 > 0n && amount1 < 0n) {
    return buildTrade(input, "uniswap-v3", input.pool.token0, input.pool.token1, amount0, abs(amount1));
  }

  if (amount1 > 0n && amount0 < 0n) {
    return buildTrade(input, "uniswap-v3", input.pool.token1, input.pool.token0, amount1, abs(amount0));
  }

  return null;
}

function buildTrade(
  input: BaseNormalizeInput,
  protocol: DexProtocol,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  amountOut: bigint
): NormalizedTradeInput {
  const tokenInDecimals = tokenIn.toLowerCase() === input.pool.token0.toLowerCase()
    ? input.pool.token0Decimals
    : input.pool.token1Decimals;
  const tokenOutDecimals = tokenOut.toLowerCase() === input.pool.token0.toLowerCase()
    ? input.pool.token0Decimals
    : input.pool.token1Decimals;

  return {
    ...input,
    protocol,
    tokenIn: getAddress(tokenIn),
    tokenOut: getAddress(tokenOut),
    amountIn: formatUnits(amountIn, tokenInDecimals ?? 18),
    amountOut: formatUnits(amountOut, tokenOutDecimals ?? 18),
    usdValue: null
  };
}

function abs(value: bigint) {
  return value < 0n ? -value : value;
}
