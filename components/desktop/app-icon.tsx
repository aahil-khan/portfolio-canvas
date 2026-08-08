import { type ReactElement, type SVGProps, cloneElement } from 'react'

/**
 * Dock and card-header icons.
 *
 * These replace the Unicode glyphs the prototype used (`◆ ▦ ⚙ ◑ ⌥`), which came from different
 * type designers at different optical weights and looked accidental next to real vendor logos.
 * One geometry for all of them: 24×24, 2px strokes, round joins, `currentColor`.
 */

const S = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const ICONS: Record<string, ReactElement<SVGProps<SVGSVGElement>>> = {
  // a cabinet with a joystick: the arcade
  arcade: (
    <svg {...S}>
      <rect x="4" y="3" width="16" height="13" rx="2" />
      <path d="M8 19h8M10 16v3M14 16v3" />
      <circle cx="12" cy="8" r="1.6" />
      <path d="M12 9.6V12" />
    </svg>
  ),
  // a pinned note: the notes wall
  notes: (
    <svg {...S}>
      <path d="M5 4h14v11l-4 5H5V4Z" />
      <path d="M19 15h-4v5" />
      <path d="M8.5 9h7M8.5 12.5h4" />
    </svg>
  ),
  // a grid of squares: the contribution calendar
  graph: (
    <svg {...S}>
      <rect x="3" y="4" width="5" height="5" rx="1" />
      <rect x="10" y="4" width="5" height="5" rx="1" />
      <rect x="3" y="11" width="5" height="5" rx="1" />
      <rect x="17" y="11" width="4" height="5" rx="1" />
      <rect x="10" y="11" width="5" height="5" rx="1" />
      <rect x="3" y="18" width="12" height="2.5" rx="1" />
    </svg>
  ),
  // a pointer with motion trails: how to drive the thing
  tutorial: (
    <svg {...S}>
      <path d="M5.5 3.5 12 20l2.2-5.8L20 12 5.5 3.5Z" />
      <path d="M3.6 9.3 2 8.8M4.6 6.2 3.4 5M8.8 4.6 8.3 3" />
    </svg>
  ),
  // rising bars: the visitor chart
  visitors: (
    <svg {...S}>
      <path d="M4 20V13.5M9.33 20V9M14.67 20v-8M20 20V4.5" />
    </svg>
  ),
  // a person: about
  about: (
    <svg {...S}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  ),
  // stacked panels: selected work
  work: (
    <svg {...S}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M7 8V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V8" />
    </svg>
  ),
  // timeline: experience
  experience: (
    <svg {...S}>
      <path d="M6 4v16" />
      <circle cx="6" cy="8" r="2" />
      <circle cx="6" cy="16" r="2" />
      <path d="M11 8h8M11 16h6" />
    </svg>
  ),
  // layers: the stack
  stack: (
    <svg {...S}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="m3 12.5 9 4.5 9-4.5" />
      <path d="m3 17 9 4.5L21 17" />
    </svg>
  ),
  // pen: writing
  writing: (
    <svg {...S}>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  ),
  // document: résumé
  resume: (
    <svg {...S}>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
  // half-filled circle: themes
  themes: (
    <svg {...S}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17V3.5Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  // envelope: contact
  contact: (
    <svg {...S}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  // a box of kept things
  archive: (
    <svg {...S}>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 13h4" />
    </svg>
  ),
  // arrow out of a box: external links
  external: (
    <svg {...S}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.94 8.5v11.5H3.5V8.5h3.44Zm.23-3.35a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20.5 14.2V20h-3.43v-5.4c0-1.36-.49-2.28-1.7-2.28-.93 0-1.48.62-1.72 1.22-.09.22-.11.52-.11.82V20H10.1s.05-10.42 0-11.5h3.44v1.63c.45-.7 1.27-1.7 3.1-1.7 2.26 0 3.96 1.48 3.96 4.66Z" />
    </svg>
  ),
  // diamond: a single project
  project: (
    <svg {...S}>
      <path d="M12 3 21 12l-9 9-9-9 9-9Z" />
    </svg>
  ),
  // framed picture: a screenshot card
  shot: (
    <svg {...S}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 5-4.5 4.5 4 3-2.5L21 18" />
    </svg>
  ),
}

/** Real vendor marks stay as their shipped assets rather than being redrawn from memory. */
const ASSETS: Record<string, string> = {
  github: '/logos/github-original.svg',
}

export function AppIcon({ name, size = 21 }: { name: string; size?: number }) {
  const asset = ASSETS[name]
  if (asset)
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size inline mark
    return <img src={asset} alt="" width={size} height={size} style={{ display: 'block' }} />

  const icon = ICONS[name] ?? ICONS.external
  return cloneElement(icon, { width: size, height: size, 'aria-hidden': true })
}
