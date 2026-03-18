import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PWA_START_COOKIE = "pladuk_start";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Root page handling ───
  if (pathname === "/") {
    // 1. LIFF redirect: LINE Login lands here with ?liff.state=/original/path
    const liffState = request.nextUrl.searchParams.get("liff.state");
    if (liffState && liffState.startsWith("/")) {
      const url = request.nextUrl.clone();
      // liff.state may include query params (e.g., /path?liff.hback=2).
      // Separate pathname from query to avoid encoding '?' as '%3F' in the path.
      const qIndex = liffState.indexOf("?");
      if (qIndex >= 0) {
        url.pathname = liffState.slice(0, qIndex);
        const extra = new URLSearchParams(liffState.slice(qIndex + 1));
        extra.forEach((v, k) => url.searchParams.set(k, v));
      } else {
        url.pathname = liffState;
      }
      url.searchParams.delete("liff.state");
      return NextResponse.redirect(url);
    }

    // 2. PWA start: when opened from home screen, redirect to last tracking page.
    //    Only trigger when ?pwa=1 is in the URL (set by the service worker).
    const isPwaNav = request.nextUrl.searchParams.has("pwa");
    const pwaStart = request.cookies.get(PWA_START_COOKIE)?.value;
    if (isPwaNav && pwaStart && pwaStart.startsWith("/quick-split/")) {
      const url = request.nextUrl.clone();
      url.pathname = pwaStart;
      url.searchParams.delete("pwa");
      return NextResponse.redirect(url);
    }
  }

  // ─── Tracking pages: save path in cookie for PWA start_url ───
  if (pathname.match(/^\/quick-split\/[^/]+\/tracking$/)) {
    const response = NextResponse.next();
    response.cookies.set(PWA_START_COOKIE, pathname, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/quick-split/:code/tracking"],
};
