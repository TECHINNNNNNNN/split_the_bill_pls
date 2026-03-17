import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Intercept LINE LIFF redirects.
 *
 * After LINE Login, LINE redirects to the LIFF endpoint URL (our root)
 * with ?liff.state=/original/path. The root page.tsx does a server-side
 * redirect("/login") which strips this param. Middleware runs before
 * page rendering, so we can catch it and redirect to the correct path.
 */
export function middleware(request: NextRequest) {
  const liffState = request.nextUrl.searchParams.get("liff.state");

  if (liffState && liffState.startsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = liffState;
    url.searchParams.delete("liff.state");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
