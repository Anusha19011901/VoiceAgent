import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Set on the request first so subsequent middleware/auth reads see them
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Recreate the response with the mutated request
          response = NextResponse.next({ request });

          // Mirror cookies onto the response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Touch the session so Supabase can refresh cookies if needed
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/auth", "/connect-google", "/app", "/api/:path*"],
};
