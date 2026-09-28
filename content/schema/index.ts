import type { Field } from '../../lib/edit/schema.ts'
import { siteSchema } from './site.ts'

/**
 * What each editable file in `content/data/` holds, and what each field means.
 *
 * The `help` lines are the doc comments that used to sit above these fields in the `.ts` files —
 * they show under the field in `/edit`, which is where someone editing actually needs them.
 * `types.ts` stays the TypeScript source of truth; `rules.ts` runs this schema over the same data
 * at build, so the two cannot disagree without the build saying so.
 */

export type FileId = 'profile' | 'projects' | 'experience' | 'archive' | 'now' | 'writing' | 'stack' | 'site'
export type ContentSet = Record<FileId, unknown>

export const FILES: readonly { id: FileId; label: string; path: `content/data/${string}.json` }[] = [
  { id: 'profile', label: 'Profile', path: 'content/data/profile.json' },
  { id: 'projects', label: 'Projects', path: 'content/data/projects.json' },
  { id: 'experience', label: 'Experience', path: 'content/data/experience.json' },
  { id: 'archive', label: 'Archive', path: 'content/data/archive.json' },
  { id: 'now', label: 'Now', path: 'content/data/now.json' },
  { id: 'writing', label: 'Writing', path: 'content/data/writing.json' },
  { id: 'stack', label: 'Stack', path: 'content/data/stack.json' },
  { id: 'site', label: 'Front page', path: 'content/data/site.json' },
]

export const KINDS = ['Product', 'System', 'Research', 'Writing'] as const
export const ARCHIVE_KIND_IDS = ['built', 'watching', 'reading', 'listening', 'tinkering', 'found', 'random', 'note'] as const
/** Stats a headline number can be computed from instead of typed. */
export const DERIVED_STATS = ['wins'] as const

const link: Field = {
  kind: 'obj',
  label: 'Link',
  fields: {
    label: { kind: 'str', label: 'Label' },
    href: { kind: 'url', label: 'URL' },
  },
}
const links = (help?: string, optional = false): Field => ({
  kind: 'list', label: 'Links', help, optional, of: link, titleKey: 'label',
})
const highlights: Field = {
  kind: 'list',
  label: 'Highlights',
  help: 'Bullets on the detail card. **bold** and *italic* work.',
  of: { kind: 'rich', label: 'Bullet' },
}
const stack: Field = {
  kind: 'list',
  label: 'Stack',
  help: 'Each must be a tool on the Stack shelf — that is where its logo comes from.',
  of: { kind: 'ref', label: 'Tool', to: 'tool' },
}
const images = (dir: 'work'): Field => ({
  kind: 'list',
  label: 'Screenshots',
  optional: true,
  help: 'In order. One is a plain frame, several become a carousel. The first sets the frame\'s shape.',
  of: { kind: 'file', label: 'Screenshot', accept: 'image', dir },
})

const profile: Field = {
  kind: 'obj',
  label: 'Profile',
  fields: {
    profile: {
      kind: 'obj',
      label: 'You',
      fields: {
        name: { kind: 'str', label: 'Name' },
        initials: { kind: 'str', label: 'Initials', max: 3, help: 'For the avatar. Two characters looks best.' },
        role: {
          kind: 'obj',
          label: 'Role',
          help: 'Shown under the name. The emphasis part gets the highlight marker.',
          fields: {
            prefix: { kind: 'str', label: 'Prefix' },
            emphasis: { kind: 'str', label: 'Emphasis' },
          },
        },
        location: { kind: 'str', label: 'Location' },
        availability: { kind: 'str', label: 'Availability', optional: true, help: 'Small line under the role, e.g. "open to work". Empty hides it.' },
        email: { kind: 'email', label: 'Email' },
        intro: { kind: 'rich', label: 'Intro', help: 'One or two sentences — the lede of the About card.' },
        notes: {
          kind: 'list',
          label: 'About paragraphs',
          optional: true,
          help: 'Further paragraphs of About, one each.',
          of: { kind: 'text', label: 'Paragraph' },
        },
        deskWelcome: { kind: 'text', label: 'Canvas welcome line', optional: true, help: 'Closing line of the canvas About card only.' },
        links: links(),
        portrait: { kind: 'file', label: 'Portrait', optional: true, accept: 'image', dir: 'pfp', help: '4:5 photo for the front page About section.' },
        portraitHidden: { kind: 'file', label: 'Hidden portrait', optional: true, accept: 'image', dir: 'pfp', help: 'Revealed by the portrait easter egg.' },
        resumePdf: { kind: 'file', label: 'Résumé PDF', optional: true, accept: 'pdf', dir: '', help: 'Without one, the download links stay hidden.' },
      },
    },
    headlineStats: {
      kind: 'list',
      label: 'Headline numbers',
      help: 'The stat strip. Keep it to three. Set "Computed from" to count it automatically.',
      itemLabel: 'Number',
      titleKey: 'label',
      of: {
        kind: 'obj',
        label: 'Number',
        fields: {
          value: { kind: 'str', label: 'Value', optional: true },
          derived: { kind: 'enum', label: 'Computed from', optional: true, options: DERIVED_STATS, help: '"wins" counts your Awards.' },
          label: { kind: 'str', label: 'Label' },
        },
      },
    },
  },
}

const projects: Field = {
  kind: 'list',
  label: 'Projects',
  help: 'Order here does not matter — the Work card sorts by year, newest first.',
  itemLabel: 'Project',
  titleKey: 'name',
  of: {
    kind: 'obj',
    label: 'Project',
    fields: {
      slug: { kind: 'str', label: 'Slug', max: 40, help: 'url-safe id, used in /work/<slug>. Changing it breaks shared links.' },
      name: { kind: 'str', label: 'Name' },
      tagline: { kind: 'str', label: 'Tagline', help: 'One line under the name in the Work list.' },
      year: { kind: 'num', label: 'Year', int: true, min: 2000, max: 2100 },
      kind: { kind: 'enum', label: 'Kind', options: KINDS },
      tag: { kind: 'str', label: 'Tag', optional: true, help: 'Replaces Kind as the row tag, e.g. "Award".' },
      award: { kind: 'str', label: 'Award', optional: true, help: 'A badge at the top of the detail card.' },
      meta: { kind: 'str', label: 'Meta line', optional: true, help: 'Small grey line at the top of the detail card.' },
      lede: { kind: 'rich', label: 'Lede', help: 'Opening sentence of the detail card.' },
      highlights,
      stack,
      images: images('work'),
      links: links('Demo, repo, release — chips at the foot of the card.', true),
    },
  },
}

const experience: Field = {
  kind: 'obj',
  label: 'Experience',
  fields: {
    jobs: {
      kind: 'list',
      label: 'Roles',
      help: 'Sorted by year, newest first.',
      itemLabel: 'Role',
      titleKey: 'company',
      of: {
        kind: 'obj',
        label: 'Role',
        fields: {
          slug: { kind: 'str', label: 'Slug', max: 40 },
          role: { kind: 'str', label: 'Title' },
          company: { kind: 'str', label: 'Company' },
          period: { kind: 'str', label: 'Period', help: 'e.g. "Mar – Jul 2025".' },
          year: { kind: 'num', label: 'Year', int: true, min: 2000, max: 2100, help: 'Sort key.' },
          meta: { kind: 'str', label: 'Meta line', optional: true },
          lede: { kind: 'rich', label: 'Lede' },
          highlights,
          stack,
          images: images('work'),
        },
      },
    },
    education: {
      kind: 'list',
      label: 'Education',
      itemLabel: 'School',
      titleKey: 'institution',
      of: {
        kind: 'obj',
        label: 'School',
        fields: {
          institution: { kind: 'str', label: 'Institution' },
          degree: { kind: 'str', label: 'Degree' },
          detail: { kind: 'str', label: 'Detail', help: 'e.g. "CGPA 9.16 · Aug 2023 – present".' },
        },
      },
    },
    awards: {
      kind: 'list',
      label: 'Awards',
      help: 'Standalone awards. Each one counts towards the "wins" number.',
      itemLabel: 'Award',
      titleKey: 'event',
      of: {
        kind: 'obj',
        label: 'Award',
        fields: {
          title: { kind: 'str', label: 'Title', help: 'e.g. "Winner".' },
          event: { kind: 'str', label: 'Event' },
        },
      },
    },
  },
}

const archive: Field = {
  kind: 'list',
  label: 'Archive',
  help: 'A scrapbook. Order is the order shown — newest first. Pinned entries go to "Right now".',
  itemLabel: 'Entry',
  titleKey: 'title',
  of: {
    kind: 'obj',
    label: 'Entry',
    fields: {
      id: { kind: 'str', label: 'Id', max: 60, help: 'Unique and url-safe.' },
      kind: { kind: 'enum', label: 'Kind', options: ARCHIVE_KIND_IDS },
      title: { kind: 'str', label: 'Title' },
      when: { kind: 'str', label: 'When', help: 'Free text: "Aug 2026", "right now", "ongoing".' },
      meta: { kind: 'str', label: 'Meta line', optional: true, help: 'e.g. "S2E4", "412 pages".' },
      note: { kind: 'text', label: 'Note', optional: true, help: 'The "why I kept it" line. Any length.' },
      href: { kind: 'url', label: 'Link', optional: true, help: 'Makes the title a link.' },
      image: { kind: 'file', label: 'Picture', optional: true, accept: 'image', dir: 'archive' },
      caption: { kind: 'str', label: 'Caption', optional: true, help: 'A line under the single picture.' },
      images: {
        kind: 'list',
        label: 'Pictures',
        optional: true,
        help: 'Several pictures, paged as a carousel. Wins over the single picture.',
        of: { kind: 'shot', label: 'Picture', dir: 'archive' },
      },
      fullscreen: { kind: 'bool', label: 'Open in big viewer', optional: true },
      pinned: { kind: 'bool', label: 'Pinned to "Right now"', optional: true },
    },
  },
}

const now: Field = {
  kind: 'obj',
  label: 'Now',
  fields: {
    updated: { kind: 'str', label: 'Updated', max: 7, help: 'YYYY-MM. Shown as a month — keep it current.' },
    lede: { kind: 'text', label: 'Lede' },
    items: {
      kind: 'list',
      label: 'Items',
      itemLabel: 'Item',
      titleKey: 'label',
      of: {
        kind: 'obj',
        label: 'Item',
        fields: {
          label: { kind: 'str', label: 'Label', help: 'Two or three words.' },
          what: { kind: 'text', label: 'What' },
        },
      },
    },
    foot: { kind: 'text', label: 'Footnote', optional: true, help: 'Empty hides the line.' },
  },
}

const writing: Field = {
  kind: 'list',
  label: 'Writing',
  help: 'Sorted by year, newest first.',
  itemLabel: 'Post',
  titleKey: 'title',
  of: {
    kind: 'obj',
    label: 'Post',
    fields: {
      slug: { kind: 'str', label: 'Slug', max: 60 },
      title: { kind: 'str', label: 'Title' },
      blurb: { kind: 'str', label: 'Blurb' },
      year: { kind: 'num', label: 'Year', int: true, min: 2000, max: 2100 },
      readingTime: { kind: 'str', label: 'Reading time', help: 'e.g. "6 min".' },
      href: { kind: 'url', label: 'URL' },
    },
  },
}

const stackShelf: Field = {
  kind: 'list',
  label: 'Stack',
  help: 'The tool shelf, in groups. Projects and roles name tools from here.',
  itemLabel: 'Group',
  titleKey: 'label',
  of: {
    kind: 'obj',
    label: 'Group',
    fields: {
      label: { kind: 'str', label: 'Group name' },
      tools: {
        kind: 'list',
        label: 'Tools',
        itemLabel: 'Tool',
        titleKey: 'name',
        of: {
          kind: 'obj',
          label: 'Tool',
          fields: {
            name: { kind: 'str', label: 'Name' },
            logo: { kind: 'file', label: 'Logo', optional: true, accept: 'image', dir: 'logos', help: 'Omit and the tile shows the name alone.' },
            invert: { kind: 'bool', label: 'Invert on light', optional: true, help: 'For white-on-transparent logos.' },
          },
        },
      },
    },
  },
}

export const SCHEMAS: Record<FileId, Field> = {
  profile,
  projects,
  experience,
  archive,
  now,
  writing,
  stack: stackShelf,
  site: siteSchema,
}
