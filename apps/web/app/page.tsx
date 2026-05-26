import { Activity, Bell, CandlestickChart, Radio } from "lucide-react";

const panels = [
  { title: "Live Trades", icon: Activity, value: "Waiting for stream" },
  { title: "Candles", icon: CandlestickChart, value: "1m / 5m / 15m" },
  { title: "Whale Alerts", icon: Bell, value: "SSE ready" },
  { title: "Gateway", icon: Radio, value: "WebSocket planned" }
];

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wider text-emerald-300">Base Sepolia</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Realtime DEX Activity Terminal</h1>
          </div>
          <div className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">
            Phase 1 foundation
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="min-h-[420px] rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-lg font-medium">Market Chart</h2>
              <span className="text-sm text-neutral-400">No live data yet</span>
            </div>
            <div className="grid h-full min-h-[320px] place-items-center text-center text-neutral-400">
              <div>
                <CandlestickChart className="mx-auto h-12 w-12 text-emerald-300" aria-hidden="true" />
                <p className="mt-3 text-sm">Chart surface is ready for phase 5 aggregation.</p>
              </div>
            </div>
          </section>

          <aside className="grid gap-4">
            {panels.map(({ title, icon: Icon, value }) => (
              <section key={title} className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                  <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-300">{title}</h2>
                </div>
                <p className="mt-4 text-xl font-semibold">{value}</p>
              </section>
            ))}
          </aside>
        </div>
      </section>
    </main>
  );
}
