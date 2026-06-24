import { headers } from "next/headers";

/** Server-side: read x-is-bot header set by proxy.ts */
export async function isBot(): Promise<boolean> {
  const hdrs = await headers();
  return hdrs.get("x-is-bot") === "1";
}
