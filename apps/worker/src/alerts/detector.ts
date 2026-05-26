import type { TradeEvent } from "@rdat/types";

export function detectWhaleAlert(trade: TradeEvent, thresholdUsd: number) {
  const usdValue = Number(trade.usdValue);

  if (!Number.isFinite(usdValue) || usdValue < thresholdUsd) {
    return null;
  }

  return {
    threshold: thresholdUsd.toString()
  };
}
