import type { FastifyReply, FastifyRequest } from "fastify";

const sessionCookieName = "rdat_session";

export function readSessionCookie(request: FastifyRequest) {
  const cookie = request.headers.cookie;
  if (!cookie) {
    return null;
  }

  for (const part of cookie.split(";")) {
    const [name, ...rawValue] = part.trim().split("=");
    if (name === sessionCookieName) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export function setSessionCookie(reply: FastifyReply, token: string, maxAgeSeconds: number) {
  reply.header(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.header("Set-Cookie", `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
