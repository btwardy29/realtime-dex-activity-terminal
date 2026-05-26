export function getApiUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:4000";
}
