import { getApiUrl } from "./api-url";

export function getRealtimeWebSocketUrl() {
  const apiUrl = getApiUrl();
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}
