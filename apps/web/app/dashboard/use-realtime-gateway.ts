"use client";

import { useEffect } from "react";

import { useDashboardStore } from "../../lib/dashboard-store";
import { getRealtimeWebSocketUrl } from "../../lib/realtime-url";
import type { RealtimeEvent } from "@rdat/types";

export function useRealtimeGateway() {
  const ingestRealtimeEvent = useDashboardStore((state) => state.ingestRealtimeEvent);
  const setGatewayStatus = useDashboardStore((state) => state.setGatewayStatus);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldReconnect = true;

    const connect = () => {
      setGatewayStatus("connecting");
      socket = new WebSocket(getRealtimeWebSocketUrl());

      socket.addEventListener("open", () => {
        setGatewayStatus("online");
        socket?.send(
          JSON.stringify({
            type: "subscribe",
            channels: ["trades", "ticker", "candles", "whaleAlerts", "system"]
          })
        );
      });

      socket.addEventListener("message", (event) => {
        void handleMessageData(event.data, ingestRealtimeEvent);
      });

      socket.addEventListener("close", () => {
        setGatewayStatus("offline");

        if (shouldReconnect) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      });

      socket.addEventListener("error", () => {
        setGatewayStatus("error");
      });
    };

    connect();

    return () => {
      shouldReconnect = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      socket?.close();
    };
  }, [ingestRealtimeEvent, setGatewayStatus]);
}

async function handleMessageData(
  data: MessageEvent["data"],
  ingestRealtimeEvent: (event: RealtimeEvent) => void
) {
  try {
    const message = await readMessageData(data);
    ingestRealtimeEvent(JSON.parse(message) as RealtimeEvent);
  } catch {
    ingestRealtimeEvent({
      type: "system",
      payload: {
        event: "invalid_gateway_payload"
      }
    });
  }
}

async function readMessageData(data: MessageEvent["data"]) {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof Blob) {
    return data.text();
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }

  return String(data);
}
