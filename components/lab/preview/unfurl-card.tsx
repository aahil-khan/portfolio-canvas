import type { Unfurl } from '@/lib/lab/types'

/**
 * A link out, unfurled the way a chat app does it (decision 9; DIRECTION "Windows, cards and the
 * sheet"): the page's own image across the top (640×336 WebP), its favicon (a 32px file drawn at
 * 16px) and domain, a two-line title and a three-line description. A site with no image gets the
 * same card without it. Every file is same-origin, committed by `scripts/lab-unfurl.mjs`: a hover
 * makes no cross-origin request.
 */
export function UnfurlCard({ u }: { u: Unfurl }) {
  return (
    <div className="lab-pv-unfurl" data-unfurl={u.img ? 'image' : 'text'}>
      {u.img ? (
        // eslint-disable-next-line @next/next/no-img-element -- a committed 640×336 file, already sized; next/image would add a request through the optimiser
        <img className="lab-pv-uf-img" src={u.img.src} width={u.img.w} height={u.img.h} alt={u.img.alt} decoding="async" data-unfurl-img />
      ) : null}
      <p className="lab-pv-uf-site" data-unfurl-site>
        {u.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 32px favicon file
          <img className="lab-pv-uf-icon" src={u.icon} width={16} height={16} alt="" decoding="async" data-unfurl-icon />
        ) : null}
        <span>{u.domain}</span>
      </p>
      <h3 className="lab-pv-uf-title" data-unfurl-title>
        {u.title}
      </h3>
      {u.description ? (
        <p className="lab-pv-uf-desc" data-unfurl-desc>
          {u.description}
        </p>
      ) : null}
    </div>
  )
}
