import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Redis from "ioredis";
import type { Pool } from "pg";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

import type { AuthSession } from "@rdat/types";

import { config } from "../config";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "./cookies";
import { addWatchlistItem, deleteWatchlistItem, getWatchlist, upsertUserByWallet } from "./repository";
import { createNonce, createSiweMessage, verifySiweMessage } from "./siwe";
import { signSession, verifySessionToken } from "./token";

const nonceBodySchema = z.object({
  walletAddress: z
    .string()
    .refine(isAddress, "Expected an EVM wallet address")
    .transform((address) => getAddress(address))
});

const verifyBodySchema = z.object({
  message: z.string().min(1),
  signature: z.custom<`0x${string}`>((value) => typeof value === "string" && value.startsWith("0x"))
});

const watchlistBodySchema = z.object({
  pairAddress: z
    .string()
    .refine(isAddress, "Expected an EVM pair address")
    .transform((address) => getAddress(address))
});

const watchlistParamsSchema = z.object({
  id: z.string().uuid()
});

type AuthRouteOptions = {
  db: Pool;
  redis: Redis;
};

export async function registerAuthRoutes(app: FastifyInstance, { db, redis }: AuthRouteOptions) {
  app.post("/api/auth/nonce", async (request, reply) => {
    const parsed = nonceBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_wallet_address",
        details: parsed.error.flatten().fieldErrors
      });
    }

    const nonce = createNonce();
    const domain = request.headers.host ?? "localhost";
    const uri = `${request.protocol}://${domain}`;
    const message = createSiweMessage({
      domain,
      uri,
      walletAddress: parsed.data.walletAddress,
      nonce,
      issuedAt: new Date().toISOString(),
      chainId: 84532
    });

    await redis.set(nonceKey(nonce), parsed.data.walletAddress, "EX", config.AUTH_NONCE_TTL_SECONDS);

    return {
      nonce,
      message,
      expiresIn: config.AUTH_NONCE_TTL_SECONDS
    };
  });

  app.post("/api/auth/verify", async (request, reply) => {
    const parsed = verifyBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_signature_payload",
        details: parsed.error.flatten().fieldErrors
      });
    }

    const nonce = readNonce(parsed.data.message);
    if (!nonce) {
      return reply.status(400).send({ error: "invalid_siwe_message" });
    }

    const expectedWallet = await redis.get(nonceKey(nonce));
    if (!expectedWallet) {
      return reply.status(401).send({ error: "expired_nonce" });
    }

    const verified = await verifySiweMessage({
      message: parsed.data.message,
      signature: parsed.data.signature,
      expectedNonce: nonce
    });

    if (!verified || verified.walletAddress !== expectedWallet) {
      return reply.status(401).send({ error: "invalid_signature" });
    }

    await redis.del(nonceKey(nonce));

    const user = await upsertUserByWallet(db, verified.walletAddress);
    if (!user) {
      return reply.status(500).send({ error: "user_session_failed" });
    }

    const session: AuthSession = {
      userId: user.id,
      walletAddress: user.wallet_address,
      expiresAt: new Date(Date.now() + config.AUTH_SESSION_TTL_SECONDS * 1000).toISOString()
    };

    setSessionCookie(reply, signSession(session, config.AUTH_JWT_SECRET), config.AUTH_SESSION_TTL_SECONDS);

    return {
      session
    };
  });

  app.get("/api/auth/session", async (request, reply) => {
    const session = getAuthSession(request);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    return { session };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/api/watchlist", async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) {
      return;
    }

    return {
      items: await getWatchlist(db, session.userId)
    };
  });

  app.post("/api/watchlist", async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) {
      return;
    }

    const parsed = watchlistBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_watchlist_pair",
        details: parsed.error.flatten().fieldErrors
      });
    }

    return {
      item: await addWatchlistItem(db, session.userId, parsed.data.pairAddress)
    };
  });

  app.delete("/api/watchlist/:id", async (request, reply) => {
    const session = requireAuth(request, reply);
    if (!session) {
      return;
    }

    const parsed = watchlistParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_watchlist_id" });
    }

    const deleted = await deleteWatchlistItem(db, session.userId, parsed.data.id);
    if (!deleted) {
      return reply.status(404).send({ error: "watchlist_item_not_found" });
    }

    return { ok: true };
  });
}

function getAuthSession(request: FastifyRequest) {
  const token = readSessionCookie(request);
  return token ? verifySessionToken(token, config.AUTH_JWT_SECRET) : null;
}

function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = getAuthSession(request);
  if (!session) {
    void reply.status(401).send({ error: "unauthorized" });
    return null;
  }

  return session;
}

function nonceKey(nonce: string) {
  return `auth:nonce:${nonce}`;
}

function readNonce(message: string) {
  const line = message.split(/\r?\n/).find((item) => item.startsWith("Nonce: "));
  return line ? line.slice("Nonce: ".length).trim() : null;
}
