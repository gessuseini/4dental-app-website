import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

function hostKind(host: string): "admin" | "api" | "www" {
  const h = host.toLowerCase().split(":")[0];
  if (h.startsWith("admin.")) return "admin";
  if (h.startsWith("api.")) return "api";
  return "www";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "localhost";
  const kind = hostKind(host);

  // Subdomain rewrites (production hosts)
  if (kind === "admin" && !pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (kind === "api" && !pathname.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = `/api${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Effective admin path after rewrite or direct /admin on localhost
  const isAdminPath =
    pathname.startsWith("/admin") ||
    (kind === "admin" && !pathname.startsWith("/api"));

  if (!isAdminPath && kind !== "admin") {
    return NextResponse.next();
  }

  const adminPath =
    kind === "admin" && !pathname.startsWith("/admin")
      ? pathname === "/"
        ? "/admin"
        : `/admin${pathname}`
      : pathname;

  const isLogin = adminPath === "/admin/login" || adminPath.startsWith("/admin/login/");
  const isPublicAsset =
    adminPath.startsWith("/admin/_next") ||
    adminPath.includes(".");

  if (isLogin || isPublicAsset) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const res = NextResponse.redirect(new URL("/admin/login", request.url));
    res.cookies.delete(AUTH_COOKIE);
    return res;
  }

  if (
    session.mustChangePassword &&
    adminPath !== "/admin/change-password" &&
    !adminPath.startsWith("/api/admin/account")
  ) {
    return NextResponse.redirect(new URL("/admin/change-password", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
