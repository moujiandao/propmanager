import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request })

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
  const { data: { user } } = await supabase.auth.getUser()

  // Bounce unauthenticated requests for app paths, carrying the ACTUAL requested
  // path in `next`. This lives here rather than in the (app) layout because a
  // server layout cannot see the pathname — it used to hardcode
  // `?next=/dashboard`, which was harmless when the app had one URL and became a
  // real bug the moment it had twenty: every deep link sent you to the dashboard
  // after login instead of where you asked for. The layout's own check stays as
  // the authoritative one; this is the optimistic redirect that keeps `next`
  // honest. getUser() is already called above, so this costs nothing extra.
  const { pathname, search } = request.nextUrl
  const isAppPath = APP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!user && isAppPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Top-level segments owned by the authenticated surface. Route groups don't
// appear in URLs, so this cannot be derived from the directory layout — adding
// an app route means adding its first segment here.
const APP_PREFIXES = [
  '/dashboard', '/properties', '/tenants', '/payments', '/maintenance',
  '/parking', '/leases', '/renewals', '/documents', '/email', '/settings',
  '/portal',
]

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
