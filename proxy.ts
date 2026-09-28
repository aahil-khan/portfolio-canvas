import { NextResponse, type NextRequest } from 'next/server'

/*
 * Security headers for the content editor, and only for it.
 *
 * The matcher is the whole scope: `/`, `/canvas` and everything else never pass through here and
 * stay static. `/edit` gets a per-request nonce, so the only scripts that run are the ones Next
 * itself rendered for this response.
 *
 * The root layout's two tiny inline boot scripts (saved theme, phone flag) carry no nonce and are
 * blocked here. On purpose: the editor styles itself and needs neither, and a CSP with an
 * exception for inline script is barely a CSP.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const dev = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self' https://github.com",
    "frame-ancestors 'none'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export const config = { matcher: ['/edit', '/edit/:path*'] }
