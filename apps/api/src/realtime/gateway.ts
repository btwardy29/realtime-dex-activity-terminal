import websocketPlugin from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  realtimeChannelNames,
  realtimeChannelToRedisChannel,
  type redisChannels
} from "@rdat/shared";
import type { RealtimeChannel, RealtimeEvent, WebSocketClientMessage } from "@rdat/types";

const socketOpenState = 1;

const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    channels: z.array(z.enum(realtimeChannelNames)).min(1)
  }),
  z.object({
    type: z.literal("unsubscribe"),
    channels: z.array(z.enum(realtimeChannelNames)).min(1)
  }),
  z.object({
    type: z.literal("ping")
  })
]);

type WebSocketLike = {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  ping(): void;
  on(event: "message", listener: (message: Buffer) => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "pong", listener: () => void): void;
};

type GatewayClient = {
  id: string;
  socket: WebSocketLike;
  channels: Set<RealtimeChannel>;
  isAlive: boolean;
  connectedAt: Date;
};

type RealtimeGatewayOptions = {
  redisSubscriber: Redis;
  heartbeatIntervalMs: number;
  maxClients: number;
};

type RedisChannel = (typeof redisChannels)[keyof typeof redisChannels];

const redisChannelToRealtimeChannel = new Map<RedisChannel, RealtimeChannel>(
  Object.entries(realtimeChannelToRedisChannel).map(([channel, redisChannel]) => [
    redisChannel,
    channel as RealtimeChannel
  ])
);

export async function registerRealtimeGateway(
  app: FastifyInstance,
  options: RealtimeGatewayOptions
) {
  await app.register(websocketPlugin, {
    options: {
      maxPayload: 64 * 1024
    }
  });

  const gateway = new RealtimeGateway(app, options);
  await gateway.start();

  app.get("/ws", { websocket: true }, (socket, request) => {
    gateway.handleConnection(socket as WebSocketLike, request);
  });

  app.get("/api/realtime/health", async () => gateway.getSnapshot());

  app.addHook("onClose", async () => {
    await gateway.close();
  });
}

class RealtimeGateway {
  private readonly clients = new Map<string, GatewayClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly app: FastifyInstance,
    private readonly options: RealtimeGatewayOptions
  ) {}

  async start() {
    const redisChannelsToSubscribe = Object.values(realtimeChannelToRedisChannel);

    this.options.redisSubscriber.on("message", (redisChannel, message) => {
      this.broadcast(redisChannel as RedisChannel, message);
    });

    await this.options.redisSubscriber.subscribe(...redisChannelsToSubscribe);

    this.heartbeatTimer = setInterval(() => {
      this.runHeartbeat();
    }, this.options.heartbeatIntervalMs);

    this.app.log.info(
      {
        channels: redisChannelsToSubscribe,
        heartbeatIntervalMs: this.options.heartbeatIntervalMs,
        maxClients: this.options.maxClients
      },
      "Realtime gateway started"
    );
  }

  async close() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const client of this.clients.values()) {
      client.socket.close(1001, "server shutdown");
    }

    this.clients.clear();
    await this.options.redisSubscriber.unsubscribe();
  }

  handleConnection(socket: WebSocketLike, request: FastifyRequest) {
    if (this.clients.size >= this.options.maxClients) {
      socket.close(1013, "server busy");
      return;
    }

    const client: GatewayClient = {
      id: randomUUID(),
      socket,
      channels: new Set(["trades", "ticker", "candles"]),
      isAlive: true,
      connectedAt: new Date()
    };

    this.clients.set(client.id, client);

    socket.on("message", (message) => {
      this.handleClientMessage(client, message);
    });

    socket.on("pong", () => {
      client.isAlive = true;
    });

    socket.on("close", () => {
      this.clients.delete(client.id);
    });

    socket.on("error", (error) => {
      this.app.log.warn({ error, clientId: client.id, ip: request.ip }, "WebSocket client error");
      this.clients.delete(client.id);
    });

    this.send(client, {
      type: "system",
      payload: {
        event: "connected",
        clientId: client.id,
        channels: [...client.channels],
        timestamp: client.connectedAt.toISOString()
      }
    });
  }

  getSnapshot() {
    const channelClientCounts = Object.fromEntries(
      realtimeChannelNames.map((channel) => [
        channel,
        [...this.clients.values()].filter((client) => client.channels.has(channel)).length
      ])
    );

    return {
      ok: true,
      clients: this.clients.size,
      channelClientCounts,
      timestamp: new Date().toISOString()
    };
  }

  private handleClientMessage(client: GatewayClient, message: Buffer) {
    let parsed: WebSocketClientMessage;

    try {
      parsed = clientMessageSchema.parse(JSON.parse(message.toString()));
    } catch {
      this.send(client, {
        type: "system",
        payload: {
          event: "invalid_message"
        }
      });
      return;
    }

    if (parsed.type === "ping") {
      this.send(client, {
        type: "system",
        payload: {
          event: "pong",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (parsed.type === "subscribe") {
      for (const channel of parsed.channels) {
        client.channels.add(channel);
      }
    }

    if (parsed.type === "unsubscribe") {
      for (const channel of parsed.channels) {
        client.channels.delete(channel);
      }
    }

    this.send(client, {
      type: "system",
      payload: {
        event: "subscription_updated",
        channels: [...client.channels]
      }
    });
  }

  private broadcast(redisChannel: RedisChannel, message: string) {
    const channel = redisChannelToRealtimeChannel.get(redisChannel);
    if (!channel) {
      return;
    }

    for (const client of this.clients.values()) {
      if (!client.channels.has(channel)) {
        continue;
      }

      this.sendRaw(client, message);
    }
  }

  private runHeartbeat() {
    for (const client of this.clients.values()) {
      if (!client.isAlive) {
        client.socket.close(1001, "heartbeat timeout");
        this.clients.delete(client.id);
        continue;
      }

      client.isAlive = false;
      client.socket.ping();
    }
  }

  private send(client: GatewayClient, event: RealtimeEvent) {
    this.sendRaw(client, JSON.stringify(event));
  }

  private sendRaw(client: GatewayClient, message: string) {
    if (client.socket.readyState !== socketOpenState) {
      this.clients.delete(client.id);
      return;
    }

    client.socket.send(message);
  }
}
