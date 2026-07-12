import { NextRequest } from "next/server";

/**
 * Extract user's country from Cloudflare headers (free, built-in).
 * Falls back to "unknown" if not available.
 */
export function getCountry(req: NextRequest): string {
  // Cloudflare provides this header automatically on all proxied requests
  const cfCountry = req.headers.get("cf-ipcountry");
  if (cfCountry && cfCountry !== "XX") return cfCountry;

  return "unknown";
}

/**
 * Detect device type from User-Agent (simple heuristic).
 */
export function getDevice(req: NextRequest): string {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (ua.includes("mobi") || ua.includes("android")) return "mobile";
  if (ua.includes("tablet") || ua.includes("ipad")) return "tablet";
  return "desktop";
}
