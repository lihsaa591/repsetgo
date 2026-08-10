import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/server/auth/session";

const publicRoutes = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);
  const isAdminRoute = path.startsWith("/admin");

  const token = req.cookies.get("session")?.value;
  const session = await decrypt(token);

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (isAdminRoute && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon.ico|manifest\\.webmanifest$|sw\\.js$|.*\\.png$).*)",
  ],
};
