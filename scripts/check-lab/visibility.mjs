/**
 * Rule I: the hidden-until-done switch, and the demo marker beside it. Lane module for
 * scripts/check-lab.mjs (API.md §11; "Visibility" and "Demo mode").
 *
 * Hidden (`public: false`):
 *   - every /lab response carries `X-Robots-Tag: noindex`, a 404 included (the header is what
 *     covers OG images, .md twins and paths that do not exist);
 *   - every Lab page that answers 200 has `<meta name="robots" content="noindex, nofollow">`;
 *   - sitemap.xml, feed.xml and llms.txt name no /lab URL;
 *   - neither `/` nor `/canvas` links to /lab;
 *   - robots.txt has no /lab Disallow (it would publish the path and hide the noindex).
 * Public: the reverse of the first three, and the sitemap lists every Lab route. (Doors are rule DR.)
 *
 * Demo: the marker (`[data-demo-marker]`, text from `copy.demoMarker`) shows on every Lab page that
 * answers 200 exactly when `demo` is true, and on no page at all when it is false.
 */
import fs from 'node:fs'
import path from 'node:path'

import { LAB_ROBOTS_HIDDEN, LAB_X_ROBOTS_HIDDEN } from '../../lib/lab/visibility.ts'

/** A path under /lab that no route will ever take: the header must cover it too. */
const PROBE = '/lab/__nothing-here__'
const LAB_HREF = /href="(?:https?:\/\/[^"/]+)?\/lab(?:[/"?#])/
const LAB_URL = /(?:https?:\/\/[^\s<"]+)?\/lab(?:[/<\s"?#]|$)/m

const robotsMeta = (html) =>
  [...html.matchAll(/<meta[^>]+name="robots"[^>]*>/g)].map((m) => m[0].match(/content="([^"]*)"/)?.[1] ?? '')
const markers = (html) => [...html.matchAll(/<[^>]+data-demo-marker[^>]*>([\s\S]*?)<\//g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())

const visibility = {
  id: 'I',
  title: 'Visibility: hidden means noindex everywhere, listed nowhere, linked from nowhere; the demo marker',
  needs: ['server'],
  async run(ctx) {
    const fail = []
    const notes = []
    const { labPublic, labDemo } = ctx.visibility
    const copy = JSON.parse(fs.readFileSync(path.join(ctx.root, 'content/data/lab.json'), 'utf8')).copy ?? {}

    const paths = [...new Set(['/lab', ...ctx.lab.routes.map((r) => r.path), PROBE])]
    if (!ctx.lab.built) notes.push('no loaders yet (PR 2): checking /lab and a path that does not exist')
    const pages = []
    for (const p of paths) {
      const res = await ctx.get(p)
      const header = res.headers.get('x-robots-tag') ?? ''
      const hasHeader = header.split(',').map((s) => s.trim()).includes(LAB_X_ROBOTS_HIDDEN)
      if (!labPublic && !hasHeader) fail.push(`${p} (${res.status}) has no X-Robots-Tag: ${LAB_X_ROBOTS_HIDDEN}`)
      if (labPublic && hasHeader) fail.push(`${p} is still noindex by header, but the Lab is public`)
      if (res.status !== 200 || !/^text\/html/.test(res.headers.get('content-type') ?? '')) continue
      pages.push({ path: p, html: res.text })
      const metas = robotsMeta(res.text)
      const hidden = metas.some((c) => c.replace(/\s/g, '') === LAB_ROBOTS_HIDDEN.replace(/\s/g, ''))
      if (!labPublic && !hidden) fail.push(`${p} has no <meta name="robots" content="${LAB_ROBOTS_HIDDEN}"> (found: ${metas.join(' | ') || 'none'})`)
      if (labPublic && metas.some((c) => /noindex/.test(c))) fail.push(`${p} is still noindex by meta, but the Lab is public`)
    }
    if (!pages.length) notes.push('no Lab page answers 200 yet (PR 6), so the robots meta and the demo marker wait')

    // the demo marker: exactly when demo is on
    for (const p of pages) {
      const m = markers(p.html)
      if (labDemo && m.length !== 1) fail.push(`${p.path} shows ${m.length} demo markers; demo is on, so exactly one`)
      else if (labDemo && m[0] !== copy.demoMarker) fail.push(`${p.path}'s demo marker says "${m[0]}", not copy.demoMarker ("${copy.demoMarker}")`)
      if (!labDemo && m.length) fail.push(`${p.path} shows the demo marker, but demo is off`)
    }
    if (labDemo && typeof copy.demoMarker !== 'string') fail.push('demo is on, but lab.json has no copy.demoMarker')

    // where a Lab URL may be listed
    const sitemap = await ctx.get('/sitemap.xml')
    if (sitemap.status !== 200) fail.push(`/sitemap.xml answered ${sitemap.status}`)
    else if (!labPublic && LAB_URL.test(sitemap.text)) fail.push('the sitemap lists a /lab URL while the Lab is hidden')
    else if (labPublic)
      for (const r of ctx.lab.routes) if (!sitemap.text.includes(`${r.path}</loc>`)) fail.push(`the sitemap leaves out ${r.path}`)
    for (const p of ['/feed.xml', '/llms.txt']) {
      const res = await ctx.get(p)
      if (res.status === 404) {
        notes.push(`${p} does not exist yet, so it lists nothing`)
        continue
      }
      if (res.status !== 200) fail.push(`${p} answered ${res.status}`)
      else if (!labPublic && LAB_URL.test(res.text)) fail.push(`${p} names a /lab URL while the Lab is hidden`)
      else if (labPublic && !LAB_URL.test(res.text)) fail.push(`${p} lists no Lab URL, but the Lab is public`)
    }

    // no door while hidden (public doors are rule DR)
    if (!labPublic)
      for (const p of ['/', '/canvas']) {
        const res = await ctx.get(p)
        if (res.status !== 200) fail.push(`${p} answered ${res.status}`)
        else if (LAB_HREF.test(res.text)) fail.push(`${p} links to /lab while the Lab is hidden`)
      }

    // no robots.txt Disallow, in either state
    const robots = await ctx.get('/robots.txt')
    if (/^\s*disallow:\s*\/lab/im.test(robots.text)) fail.push('robots.txt disallows /lab, which publishes the path and hides the noindex from crawlers')

    return { fail, notes }
  },
}

export default visibility
