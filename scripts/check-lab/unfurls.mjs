/**
 * Rule O: links out. Lane module for scripts/check-lab.mjs (API.md §11); PR 7.
 *
 *   O  every link out has an unfurl or a stated fallback, and every unfurl image is a same-origin
 *      file: `validateLab`'s rule O issues, over both sets and the active set with the fixture.
 *      The demo set is strict. In the real set a link with no unfurl is a warning, reported here
 *      as a note: Aahil adds links at /edit, which cannot run scripts/lab-unfurl.mjs, and the page
 *      shows a text card until a card exists.
 *      And what the script promises about its files: each set's images live in its own unfurl
 *      directory, OG images are 640×336 WebP, favicons 32×32 PNG, the sizes a card declares are
 *      the file's, and no file sits there that no card names.
 */
import fs from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

import { loadSet, SET_PATHS } from '../../lib/lab/content.ts'
import { DEMO_PUBLIC } from '../../lib/lab/visibility.ts'
import { formatLabIssue } from '../../lib/lab/validate-sets.ts'
import { issues } from './content.mjs'

/** Where scripts/lab-unfurl.mjs writes each set's images, as a public URL prefix. */
const UNFURL_DIR = { real: '/lab/unfurl', demo: `${DEMO_PUBLIC}/unfurl` }

const linksOut = {
  id: 'O',
  title: 'Every link out has an unfurl or a stated fallback; unfurl images are same-origin files of the right shape',
  needs: [],
  async run(ctx) {
    const all = issues(ctx).filter((i) => i.rule === 'O')
    const fail = all.filter((i) => !i.warning).map(formatLabIssue)
    const notes = all.filter((i) => i.warning).map((i) => `warning: ${formatLabIssue(i)}`)

    for (const name of Object.keys(SET_PATHS)) {
      const { lab } = loadSet(name, { root: ctx.root })
      const dir = UNFURL_DIR[name]
      const file = SET_PATHS[name].unfurls
      const named = new Set()
      const local = (p, at) => {
        if (typeof p !== 'string' || !p.startsWith(`${dir}/`) || p.slice(dir.length + 1).includes('/')) {
          fail.push(`${file}: ${at}: ${p} is not in ${dir}/, where the script writes the ${name} set's images`)
          return null
        }
        named.add(p.slice(dir.length + 1))
        const f = path.join(ctx.root, 'public', p.slice(1))
        return fs.existsSync(f) ? f : null // a missing file is rule L's (validateLab, rule I)
      }
      for (const [url, u] of Object.entries(lab.unfurls)) {
        if (u.img) {
          const f = local(u.img.src, `${url} img`)
          if (u.img.w !== 640 || u.img.h !== 336) fail.push(`${file}: ${url}: the image declares ${u.img.w}×${u.img.h}, not 640×336`)
          if (f) {
            const m = await sharp(f).metadata()
            if (m.format !== 'webp' || m.width !== 640 || m.height !== 336) fail.push(`${u.img.src}: ${m.format} ${m.width}×${m.height}, not a 640×336 WebP`)
          }
        }
        if (u.icon) {
          const f = local(u.icon, `${url} icon`)
          if (f) {
            const m = await sharp(f).metadata()
            if (m.format !== 'png' || m.width !== 32 || m.height !== 32) fail.push(`${u.icon}: ${m.format} ${m.width}×${m.height}, not a 32px PNG`)
          }
        }
      }
      const onDisk = path.join(ctx.root, 'public', dir.slice(1))
      const files = fs.existsSync(onDisk) ? fs.readdirSync(onDisk) : []
      for (const f of files) if (!named.has(f)) fail.push(`public${dir}/${f}: no card in ${file} names it (run scripts/lab-unfurl.mjs --set ${name})`)
      const cards = Object.values(lab.unfurls)
      notes.push(
        `${name}: ${cards.length} cards (${cards.filter((u) => u.img).length} with an image, ${cards.filter((u) => u.standIn).length} stand-ins), ${files.length} files in public${dir}/`,
      )
    }
    return { fail, notes }
  },
}
export default linksOut
