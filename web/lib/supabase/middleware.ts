import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/registro",
  "/brigada",
  "/jefe",
  "/api/health",
  "/api/public",
  "/aviso",
  "/mockup-whatsapp.html",
];

const BRIGADA_PREFIXES = ["/ruta", "/inspeccion", "/mis-registros", "/perfil"];
const JEFE_PREFIXES = ["/panel", "/mapa", "/cola", "/equipo", "/avisos"];

function matchesPrefix(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

function isPublic(path: string) {
  return path === "/" || matchesPrefix(path, PUBLIC_PREFIXES);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    if (matchesPrefix(path, BRIGADA_PREFIXES)) {
      url.pathname = "/brigada";
    } else if (matchesPrefix(path, JEFE_PREFIXES)) {
      url.pathname = "/jefe";
    } else {
      url.pathname = "/";
    }
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/registro")) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = perfil?.rol === "jefe" ? "/panel" : "/ruta";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
