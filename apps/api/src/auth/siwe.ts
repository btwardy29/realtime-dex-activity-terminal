import { randomBytes } from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "viem";

export function createNonce() {
  return randomBytes(16).toString("hex");
}

export function createSiweMessage({
  domain,
  uri,
  walletAddress,
  nonce,
  issuedAt,
  chainId
}: {
  domain: string;
  uri: string;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  chainId: number;
}) {
  return `${domain} wants you to sign in with your Ethereum account:
${walletAddress}

Sign in to Realtime DEX Activity Terminal.

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

export async function verifySiweMessage({
  message,
  signature,
  expectedNonce
}: {
  message: string;
  signature: `0x${string}`;
  expectedNonce: string;
}) {
  const parsed = parseSiweMessage(message);
  if (!parsed || parsed.nonce !== expectedNonce) {
    return null;
  }

  const valid = await verifyMessage({
    address: parsed.walletAddress,
    message,
    signature
  });

  return valid ? parsed : null;
}

export function parseSiweMessage(message: string) {
  const lines = message.split(/\r?\n/);
  const walletAddress = lines[1];
  const nonce = readField(message, "Nonce");
  const chainId = readField(message, "Chain ID");

  if (!walletAddress || !isAddress(walletAddress) || !nonce || !chainId) {
    return null;
  }

  return {
    walletAddress: getAddress(walletAddress),
    nonce,
    chainId: Number(chainId)
  };
}

function readField(message: string, field: string) {
  const prefix = `${field}: `;
  const line = message.split(/\r?\n/).find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : null;
}
