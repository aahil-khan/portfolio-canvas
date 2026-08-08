/**
 * Content shapes.
 *
 * Everything on the site is generated from the files in this folder. No copy lives in a
 * component. To change what the site says, edit content — never `components/`.
 *
 * Each file uses `satisfies`, so TypeScript checks the shape without widening the types:
 * a typo in a field name is a red squiggle, and `npm run check` additionally verifies the
 * things types can't (missing images, duplicate slugs, unknown tool names).
 */

/** A stable url-safe id. Used for image paths and card ids, so changing one is a rename. */
export type Slug = string

/** How a piece of work is categorised. Shows as the tag on the right of a row. */
export type Kind = 'Product' | 'System' | 'Research' | 'Writing'

export interface Profile {
  name: string
  /** Shown under the name. The part in `emphasis` gets the highlight marker. */
  role: { prefix: string; emphasis: string }
  location: string
  /** Small line under the role, e.g. "open to work". Set to '' to hide. */
  availability: string
  email: string
  /** One or two sentences. This is the lede of the About card. */
  intro: string
  /** Further paragraphs of the About card, one string each. Omit to hide. */
  notes?: string[]
  links: { label: string; href: string }[]
  /** Initials for the avatar. Two characters looks best. */
  initials: string
  /** Path under `public/` to the résumé PDF. Omit and the download links stay hidden. */
  resumePdf?: string
}

export interface Stat {
  value: string
  label: string
}

export interface Project {
  slug: Slug
  name: string
  /** One line, shown in the Work list under the name. */
  tagline: string
  year: number
  kind: Kind
  /** Replaces `kind` as the row tag when set, e.g. 'Award'. */
  tag?: string
  /** Opening line of the detail card. Keep it to one sentence. */
  lede: string
  /** Detail card bullets. `**bold**` is supported. */
  highlights: string[]
  /** Tool names — must match a name in `stack.ts`, which `npm run check` enforces. */
  stack: string[]
  /** Rendered as a badge at the top of the detail card. */
  award?: string
  /**
   * Screenshots, in the order they should appear. Drop files in `public/work/` and list their
   * paths. One image is fine; more than one becomes a carousel. The first image sets the frame's
   * shape, and the rest are letterboxed into it rather than cropped. Omit for a placeholder.
   */
  images?: string[]
  /** Small grey line at the top of the detail card. */
  meta?: string
  /** Demo, repo, release. Rendered as link chips at the foot of the detail card. */
  links?: { label: string; href: string }[]
}

export interface Job {
  slug: Slug
  role: string
  company: string
  /** Shown in the Experience list, e.g. 'Mar – Jul 2025'. */
  period: string
  /** Sort key and the year shown in the list. */
  year: number
  lede: string
  highlights: string[]
  stack: string[]
  /** Screenshots, in order. See `Project.images`. */
  images?: string[]
  meta?: string
}

export interface Education {
  institution: string
  degree: string
  detail: string
}

export interface Post {
  slug: Slug
  title: string
  /** Shown under the title. */
  blurb: string
  year: number
  readingTime: string
  href: string
}

export interface Tool {
  name: string
  /** Path under `public/`. Omit and the tile shows a coloured initial instead. */
  logo?: string
  /** Set when the asset is white-on-transparent, so it needs inverting on a light surface. */
  invert?: boolean
}

export interface ToolGroup {
  label: string
  tools: Tool[]
}

/** A card that can be opened from the dock. */
export interface AppDef {
  id: string
  label: string
  /** Key into the icon set in `components/desktop/app-icon.tsx`. */
  icon: string
  /** Dock tile and card header colour. */
  colour: string
  /** Tinted variant of `colour`, used for chips and hover states. */
  tint: string
  /** Card width in canvas pixels. Height is measured from the content at runtime. */
  width: number
  /** Degrees of tilt, roughly -1.2 to 1.2. Keep dense grid cards near 0. */
  rotate: number
  /** External links open in a new tab instead of opening a card. */
  href?: string
}
