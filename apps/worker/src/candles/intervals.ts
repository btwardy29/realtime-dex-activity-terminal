import { supportedCandleIntervals } from "@rdat/shared";
import type { SupportedCandleInterval } from "@rdat/types";

const intervalMilliseconds = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000
} satisfies Record<SupportedCandleInterval, number>;

export const candleIntervals = supportedCandleIntervals;

export function floorToCandleTimestamp(timestamp: string, interval: SupportedCandleInterval) {
  const date = new Date(timestamp);
  const time = date.getTime();

  if (!Number.isFinite(time)) {
    throw new Error(`Invalid candle timestamp: ${timestamp}`);
  }

  const bucketSize = intervalMilliseconds[interval];
  return new Date(Math.floor(time / bucketSize) * bucketSize).toISOString();
}
