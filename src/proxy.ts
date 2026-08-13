import { NextRequest, NextResponse } from "next/server";

// /verify es el destino del QR impreso en cada gift card: lo escanea el cliente,
// que no tiene sesion. Si no estuviera aca, el gate lo mandaria a /login.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/verify"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("session")?.value;
  const secret = process.env.SESSION_SECRET;

  if (!session || session !== secret) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
