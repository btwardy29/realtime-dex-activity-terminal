"use client";

import {
  Activity,
  Bell,
  CandlestickChart,
  CircleDot,
  Radio,
  Search,
  ShieldCheck,
  TrendingUp,
  Waves
} from "lucide-react";
import { useMemo } from "react";

import { compactAddress, formatNumber, formatUsd, relativeTime, toNumber } from "../../lib/format";
import { useDashboardStore, type GatewayStatus } from "../../lib/dashboard-store";
import { useRealtimeGateway } from "./use-realtime-gateway";
import type { Candle, TradeEvent } from "@rdat/types";

type TrendRow = {
  pairAddress: string;
  swaps: number;
  wallets: number;
  volume: number;
  velocity: number;
};

const chartFallback = [42, 46, 44, 51, 49, 57, 55, 62, 58, 66, 64, 71, 69, 76, 73, 79];

export function Dashboard() {
  useRealtimeGateway();

  const gatewayStatus = useDashboardStore((state) => state.gatewayStatus);
  const lastEventAt = useDashboardStore((state) => state.lastEventAt);
  const trades = useDashboardStore((state) => state.trades);
  const candles = useDashboardStore((state) => state.candles);
  const whaleAlerts = useDashboardStore((state) => state.whaleAlerts);
  const systemEvents = useDashboardStore((state) => state.systemEvents);

  const stats = useMemo(() => buildStats(trades), [trades]);
  const trends = useMemo(() => buildTrends(trades), [trades]);
  const chartPoints = useMemo(() => buildChartPoints(candles, trades), [candles, trades]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px] flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6">
        <header className="flex flex-col gap-4 border-b border-neutral-800 pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10">
              <Waves className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Base Sepolia</p>
              <h1 className="mt-1 truncate text-2xl font-semibold sm:text-3xl">
                Realtime DEX Activity Terminal
              </h1>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[560px]">
            <Metric label="Gateway" value={readableStatus(gatewayStatus)} tone={statusTone(gatewayStatus)} />
            <Metric label="24h swaps" value={formatNumber(stats.swapCount)} />
            <Metric label="Live volume" value={formatUsd(stats.volume)} />
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]">
          <div className="grid gap-4">
            <MarketToolbar gatewayStatus={gatewayStatus} lastEventAt={lastEventAt} />
            <MarketChart points={chartPoints} trades={trades} candles={candles} />
            <LiveTrades trades={trades} />
          </div>

          <aside className="grid gap-4">
            <MarketStats stats={stats} />
            <TrendingPairs trends={trends} />
            <WhaleAlerts alerts={whaleAlerts} />
            <SystemEvents events={systemEvents} />
          </aside>
        </section>
      </div>
    </main>
  );
}

function MarketToolbar({
  gatewayStatus,
  lastEventAt
}: {
  gatewayStatus: GatewayStatus;
  lastEventAt: string | null;
}) {
  return (
    <section className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-900/80 p-3 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <StatusDot status={gatewayStatus} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-100">Realtime stream</p>
          <p className="truncate text-xs text-neutral-400">
            {lastEventAt ? `Last event ${relativeTime(lastEventAt)} ago` : "Awaiting gateway activity"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-400">
        <Search className="h-4 w-4 text-neutral-500" aria-hidden="true" />
        <span className="min-w-0 truncate">All monitored pools</span>
      </div>
    </section>
  );
}

function MarketChart({ points, trades, candles }: { points: number[]; trades: TradeEvent[]; candles: Candle[] }) {
  const path = buildSparklinePath(points, 760, 260);
  const latest = trades[0];
  const latestCandle = candles.find((candle) => candle.interval === "1m");
  const latestRatio = latest ? toNumber(latest.amountOut) / Math.max(toNumber(latest.amountIn), 1e-9) : null;

  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col gap-3 border-b border-neutral-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CandlestickChart className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold">Market Chart</h2>
            <p className="text-xs text-neutral-400">1m server-side OHLC candles</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <Ticker
            label="Last"
            value={
              latestCandle
                ? formatNumber(toNumber(latestCandle.close), { maximumFractionDigits: 6 })
                : latestRatio
                  ? formatNumber(latestRatio, { maximumFractionDigits: 6 })
                  : "-"
            }
          />
          <Ticker label="Trades" value={formatNumber(trades.length)} />
          <Ticker label="Candles" value={formatNumber(candles.filter((candle) => candle.interval === "1m").length)} />
        </div>
      </div>

      <div className="mt-4 h-[320px] overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
        <svg viewBox="0 0 760 260" role="img" aria-label="Live market activity chart" className="h-full w-full">
          <defs>
            <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {Array.from({ length: 8 }).map((_, index) => (
            <line
              key={`grid-y-${index}`}
              x1="0"
              x2="760"
              y1={index * 36}
              y2={index * 36}
              stroke="#262626"
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 12 }).map((_, index) => (
            <line
              key={`grid-x-${index}`}
              x1={index * 69}
              x2={index * 69}
              y1="0"
              y2="260"
              stroke="#171717"
              strokeWidth="1"
            />
          ))}
          <path d={`${path} L 760 260 L 0 260 Z`} fill="url(#activity-fill)" />
          <path d={path} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </section>
  );
}

function LiveTrades({ trades }: { trades: TradeEvent[] }) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-900">
      <PanelHeader icon={Activity} title="Live Trades" value={`${trades.length} buffered`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-neutral-800 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pair</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Amount In</th>
              <th className="px-4 py-3 font-medium">Amount Out</th>
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">
                  No swaps in the local buffer
                </td>
              </tr>
            ) : (
              trades.slice(0, 12).map((trade) => (
                <tr key={`${trade.txHash}-${trade.logIndex}`} className="border-b border-neutral-800/70">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                    {compactAddress(trade.pairAddress)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200">
                      swap
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-200">{formatNumber(toNumber(trade.amountIn))}</td>
                  <td className="px-4 py-3 text-neutral-200">{formatNumber(toNumber(trade.amountOut))}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                    {compactAddress(trade.walletAddress)}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{relativeTime(trade.timestamp)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MarketStats({ stats }: { stats: ReturnType<typeof buildStats> }) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-900">
      <PanelHeader icon={ShieldCheck} title="Market Statistics" value="session" />
      <div className="grid grid-cols-2 gap-px bg-neutral-800">
        <StatCell label="Volume" value={formatUsd(stats.volume)} />
        <StatCell label="Swaps" value={formatNumber(stats.swapCount)} />
        <StatCell label="Wallets" value={formatNumber(stats.wallets)} />
        <StatCell label="Pairs" value={formatNumber(stats.pairs)} />
      </div>
    </section>
  );
}

function TrendingPairs({ trends }: { trends: TrendRow[] }) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-900">
      <PanelHeader icon={TrendingUp} title="Trending Pairs" value={`${trends.length} ranked`} />
      <div className="divide-y divide-neutral-800">
        {trends.length === 0 ? (
          <EmptyPanel label="No ranked pairs" />
        ) : (
          trends.map((trend, index) => (
            <div key={trend.pairAddress} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
              <span className="text-xs text-neutral-500">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-neutral-200">{compactAddress(trend.pairAddress)}</p>
                <p className="text-xs text-neutral-500">
                  {trend.swaps} swaps / {trend.wallets} wallets
                </p>
              </div>
              <span className="text-sm font-medium text-emerald-300">{formatNumber(trend.velocity)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function WhaleAlerts({ alerts }: { alerts: ReturnType<typeof useDashboardStore.getState>["whaleAlerts"] }) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-900">
      <PanelHeader icon={Bell} title="Whale Alerts" value={`${alerts.length} active`} />
      <div className="divide-y divide-neutral-800">
        {alerts.length === 0 ? (
          <EmptyPanel label="No whale alerts" />
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-200">{formatUsd(toNumber(alert.usdValue))}</p>
                  <p className="mt-1 truncate font-mono text-xs text-neutral-500">
                    {compactAddress(alert.pairAddress)} / {compactAddress(alert.walletAddress)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-neutral-500">{relativeTime(alert.createdAt)} ago</span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">Threshold {formatUsd(toNumber(alert.threshold))}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SystemEvents({ events }: { events: ReturnType<typeof useDashboardStore.getState>["systemEvents"] }) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-900">
      <PanelHeader icon={Radio} title="System Stream" value={`${events.length} events`} />
      <div className="divide-y divide-neutral-800">
        {events.length === 0 ? (
          <EmptyPanel label="No system events" />
        ) : (
          events.slice(0, 5).map((event) => (
            <div key={`${event.event}-${event.timestamp}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="truncate text-sm text-neutral-300">{event.event}</span>
              <span className="shrink-0 text-xs text-neutral-500">{relativeTime(event.timestamp)} ago</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  const valueClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-neutral-100";

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
      <p className="text-xs uppercase text-neutral-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function Ticker({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
      <p className="text-neutral-500">{label}</p>
      <p className="mt-1 font-mono text-neutral-200">{value}</p>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  value
}: {
  icon: typeof Activity;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
        <h2 className="truncate text-sm font-semibold">{title}</h2>
      </div>
      <span className="shrink-0 text-xs text-neutral-500">{value}</span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-900 px-4 py-4">
      <p className="text-xs uppercase text-neutral-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="grid min-h-24 place-items-center px-4 py-6 text-center text-sm text-neutral-500">
      {label}
    </div>
  );
}

function StatusDot({ status }: { status: GatewayStatus }) {
  const className =
    status === "online"
      ? "text-emerald-300"
      : status === "connecting"
        ? "text-amber-300"
        : "text-rose-300";

  return <CircleDot className={`h-5 w-5 shrink-0 ${className}`} aria-hidden="true" />;
}

function readableStatus(status: GatewayStatus) {
  if (status === "online") {
    return "Online";
  }

  if (status === "connecting") {
    return "Connecting";
  }

  if (status === "error") {
    return "Error";
  }

  return "Offline";
}

function statusTone(status: GatewayStatus): "neutral" | "good" | "warn" {
  if (status === "online") {
    return "good";
  }

  if (status === "connecting") {
    return "warn";
  }

  return "neutral";
}

function buildStats(trades: TradeEvent[]) {
  return {
    volume: trades.reduce((sum, trade) => sum + toNumber(trade.usdValue), 0),
    swapCount: trades.length,
    wallets: new Set(trades.map((trade) => trade.walletAddress)).size,
    pairs: new Set(trades.map((trade) => trade.pairAddress)).size
  };
}

function buildTrends(trades: TradeEvent[]): TrendRow[] {
  const trendMap = new Map<string, { swaps: number; wallets: Set<string>; volume: number }>();

  for (const trade of trades) {
    const existing = trendMap.get(trade.pairAddress) ?? {
      swaps: 0,
      wallets: new Set<string>(),
      volume: 0
    };

    existing.swaps += 1;
    existing.wallets.add(trade.walletAddress);
    existing.volume += toNumber(trade.usdValue);
    trendMap.set(trade.pairAddress, existing);
  }

  return [...trendMap.entries()]
    .map(([pairAddress, trend]) => ({
      pairAddress,
      swaps: trend.swaps,
      wallets: trend.wallets.size,
      volume: trend.volume,
      velocity: trend.swaps * 2 + trend.wallets.size + trend.volume / 10000
    }))
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 6);
}

function buildChartPoints(candles: Candle[], trades: TradeEvent[]) {
  const candlePoints = candles
    .filter((candle) => candle.interval === "1m")
    .slice(0, 32)
    .reverse()
    .map((candle) => toNumber(candle.close))
    .filter((point) => Number.isFinite(point) && point > 0);

  if (candlePoints.length >= 2) {
    return candlePoints;
  }

  if (trades.length === 0) {
    return chartFallback;
  }

  const values = trades
    .slice(0, 24)
    .reverse()
    .map((trade, index) => toNumber(trade.usdValue) || toNumber(trade.amountOut) + index);

  return values.length >= 2 ? values : chartFallback;
}

function buildSparklinePath(points: number[], width: number, height: number) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const step = width / Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point - min) / range) * (height - 28) - 14;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
