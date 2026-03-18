import { hc } from "hono/client";
import type { AppType } from "@pladuk/server/src/app.js";

// Use same-origin requests (proxied via Next.js rewrites in next.config.ts).
// This avoids cross-origin CORS/cookie issues in LIFF WebView (WKWebView).
export const api = hc<AppType>("", {
  init: {
    credentials: "include",
  },
});
