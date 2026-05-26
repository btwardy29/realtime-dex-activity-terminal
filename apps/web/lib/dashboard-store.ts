"use client";

import { create } from "zustand";

import type { RealtimeEvent, TradeEvent, WhaleAlert } from "@rdat/types";

export type GatewayStatus = "connecting" | "online" | "offline" | "error";

type SystemEvent = {
  event: string;
  timestamp: string;
};

type DashboardState = {
  gatewayStatus: GatewayStatus;
  lastEventAt: string | null;
  trades: TradeEvent[];
  whaleAlerts: WhaleAlert[];
  systemEvents: SystemEvent[];
  setGatewayStatus: (status: GatewayStatus) => void;
  ingestRealtimeEvent: (event: RealtimeEvent) => void;
  reset: () => void;
};

const maxTrades = 80;
const maxSystemEvents = 20;
const maxWhaleAlerts = 40;

export const useDashboardStore = create<DashboardState>((set) => ({
  gatewayStatus: "connecting",
  lastEventAt: null,
  trades: [],
  whaleAlerts: [],
  systemEvents: [],
  setGatewayStatus: (gatewayStatus) => set({ gatewayStatus }),
  ingestRealtimeEvent: (event) =>
    set((state) => {
      const now = new Date().toISOString();

      if (event.type === "trade" && isTradeEvent(event.payload)) {
        return {
          lastEventAt: now,
          trades: [event.payload, ...state.trades].slice(0, maxTrades)
        };
      }

      if (event.type === "whale_alert" && isWhaleAlert(event.payload)) {
        return {
          lastEventAt: now,
          whaleAlerts: [event.payload, ...state.whaleAlerts].slice(0, maxWhaleAlerts)
        };
      }

      if (event.type === "system") {
        return {
          lastEventAt: now,
          systemEvents: [
            {
              event: readSystemEventName(event.payload),
              timestamp: now
            },
            ...state.systemEvents
          ].slice(0, maxSystemEvents)
        };
      }

      return {
        lastEventAt: now
      };
    }),
  reset: () =>
    set({
      gatewayStatus: "connecting",
      lastEventAt: null,
      trades: [],
      whaleAlerts: [],
      systemEvents: []
    })
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTradeEvent(value: unknown): value is TradeEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.txHash === "string" &&
    typeof value.pairAddress === "string" &&
    typeof value.tokenIn === "string" &&
    typeof value.tokenOut === "string" &&
    typeof value.amountIn === "string" &&
    typeof value.amountOut === "string" &&
    typeof value.walletAddress === "string" &&
    typeof value.timestamp === "string"
  );
}

function isWhaleAlert(value: unknown): value is WhaleAlert {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradeId === "string" &&
    typeof value.threshold === "string" &&
    typeof value.createdAt === "string"
  );
}

function readSystemEventName(payload: unknown) {
  if (!isRecord(payload) || typeof payload.event !== "string") {
    return "system_event";
  }

  return payload.event;
}
