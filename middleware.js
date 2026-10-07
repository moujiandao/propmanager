import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { isPublicPath, resolveUser, gateDecision } from './lib/auth/session-gate.js'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname, search } = request.nextUrl
  if (isPublicPath(pathname)) return supabaseResponse

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session and writes updated cookies to the response.
  // Do not add any logic between createServerClient and this call.
  const session = await resolveUser(() => supabase.auth.getUser())
  const decision = gateDecision(pathname, session)

  if (decision === 'unavailable') {
    return new NextResponse('The sign-in service is not responding. Please try again in a minute.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '30', 'cache-control': 'no-store' },
    })
  }

  // Bounce unauthenticated requests for app paths, carrying the ACTUAL requested
  // path in `next`. This lives here rather than in the (app) layout because a
  // server layout cannot see the pathname — it used to hardcode
  // `?next=/dashboard`, which was harmless when the app had one URL and became a
  // real bug the moment it had twenty: every deep link sent you to the dashboard
  // after login instead of where you asked for. The layout's own check stays as
  // the authoritative one; this is the optimistic redirect that keeps `next`
  // honest. The user is already resolved above, so this costs nothing extra.
  if (decision === 'login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
