import { NextResponse, type NextRequest } from "next/server";

/**
 * Sin la cookie de sesión, cualquier página lleva a /login (recordando a dónde iba). Es solo una revisión rápida:
 * quien valida la sesión y el rol es la API; si la cookie venció, la primera llamada a la API da 401 y también
 * lleva a /login (lib/api.ts).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("kromatica_sesion")) return NextResponse.next();
  const destino = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") destino.searchParams.set("siguiente", pathname + search);
  return NextResponse.redirect(destino);
}

export const config = {
  // Todo menos la API (la protege NestJS), /login y los archivos estáticos.
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
