/** Shared response helpers for the editor's routes. Nothing here is cached, ever. */

export const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

export const notFound = () => new Response('Not found', { status: 404, headers: NO_STORE })

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE })
