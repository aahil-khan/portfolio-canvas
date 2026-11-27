import type { Field } from '../../lib/edit/schema.ts'
import { ENDING_KINDS, KINDS, type Kind } from '../../lib/lab/types.ts'

/**
 * What each field of the Lab's data is and means: `content/data/lab*.json`, `studies/*.json`,
 * and the demo set's mirror of them. Contract: `content/lab/API.md` §1; `lib/lab/types.ts` is the
 * TypeScript copy, and these `help` lines are what `/edit` (PR 14) shows under each field.
 *
 * In the same vocabulary as `content/schema/index.ts`, so `/edit` renders it with no new field
 * kinds. Two shapes that vocabulary has no word for are handled by `validateLab`
 * (`lib/lab/rules.ts`), which runs these: keyed records (an entry's `refs`, the figures and
 * unfurls files) are checked value by value, and an entry is checked against the fields of its
 * own `kind`. A draft's `published` is `null`, which `validateLab` allows only on a draft.
 */

const id = (label: string, help: string): Field => ({ kind: 'str', label, help, max: 64 })
const date = (label: string, help: string, optional = false): Field => ({ kind: 'str', label, help, optional, max: 10 })
const text = (label: string, help: string, optional = false): Field => ({ kind: 'rich', label, help, optional })

export const imageField: Field = {
  kind: 'obj',
  label: 'Image',
  fields: {
    src: { kind: 'str', label: 'File', help: 'A path under public/, like /lab/<entry>/one.webp.' },
    w: { kind: 'num', label: 'Width', int: true, min: 1, help: 'In pixels, so nothing shifts as it loads.' },
    h: { kind: 'num', label: 'Height', int: true, min: 1 },
    alt: { kind: 'str', label: 'Description', help: 'What the picture shows, for anyone who cannot see it.' },
    caption: text('Caption', 'Under the picture.', true),
  },
}
const demoField: Field = {
  kind: 'obj',
  label: 'Demo',
  help: 'A looping animated WebP, with a still poster for reduced motion and JavaScript off.',
  fields: { ...(imageField as Extract<Field, { kind: 'obj' }>).fields, poster: { kind: 'str', label: 'Poster', help: 'A still, under public/.' } },
}

export const refField: Field = {
  kind: 'obj',
  label: 'Reference',
  help: 'Cited in the body as [^key]; numbered by first use.',
  fields: {
    title: { kind: 'str', label: 'Title' },
    site: { kind: 'str', label: 'Where and when', help: 'Publisher and date as one line, e.g. "Anthropic Engineering · 9 Jan 2026".' },
    line: text('Why it is cited', 'A quote or one plain line. Its card falls back to this when the site has no unfurl.', true),
    url: { kind: 'url', label: 'URL', optional: true, help: 'Leave out (null) for a source that is not published; its card says so.' },
  },
}

const leadField: Field = {
  kind: 'obj',
  label: 'Lead',
  optional: true,
  help: 'What leads the page. Which of these count depends on the kind; the kind falls back through its chain.',
  fields: {
    instrument: { kind: 'str', label: 'Instrument', optional: true, help: 'An interactive lead from the instrument registry.' },
    figure: { kind: 'str', label: 'Figure', optional: true, help: 'A figure instrument, its data in the figures file.' },
    of: { kind: 'str', label: 'Data key', optional: true, help: 'Where the figure data is, when not under this entry’s id.' },
    demo: { ...demoField, optional: true },
    images: { kind: 'list', label: 'Screens', optional: true, of: imageField, help: 'One is a frame, several a carousel.' },
    cover: { ...imageField, label: 'Cover', optional: true },
  },
}

const base: Record<string, Field> = {
  id: id('Id', 'Unique across the Lab; links say [[id|words]]. Lowercase and dashes. Never index, tags, glossary, demo or fixture.'),
  slug: id('URL segment', 'Unique within its section, or within its parent for a chapter or note.'),
  section: { kind: 'str', label: 'Section', help: 'A section id.' },
  kind: { kind: 'enum', label: 'Kind', options: KINDS },
  title: { kind: 'str', label: 'Title' },
  lede: text('Lede', 'One or two sentences under the title, and on every list row.', true),
  published: date('Published', 'YYYY-MM-DD. Empty only while it is a draft.', true),
  updated: date('Updated', 'YYYY-MM-DD, when it last changed.', true),
  draft: { kind: 'bool', label: 'Draft', optional: true, help: 'Listed as "later"; no page of its own.' },
  tags: { kind: 'list', label: 'Tags', optional: true, of: { kind: 'str', label: 'Tag' } },
  mentions: { kind: 'list', label: 'Mentions', optional: true, of: { kind: 'str', label: 'Entry' }, help: 'Entries this one names in data rather than in its body; they count as links.' },
  refs: { kind: 'obj', label: 'References', optional: true, fields: {}, help: 'By the key the body cites.' },
  pull: { kind: 'str', label: 'Pull-quote', optional: true, help: 'A sentence of the body, word for word. Long entries need one.' },
  leadIntro: { kind: 'str', label: 'Lead intro', optional: true, help: 'The bold line over an interactive lead.' },
  lead: leadField,
}
const ending: Record<string, Field> = {
  ending: { kind: 'obj', label: 'What I’d do now', fields: { text: text('Text', 'Dated as of the last update, so it never reads stale.') } },
  endingKind: { kind: 'enum', label: 'Framed as', options: ENDING_KINDS, help: 'do: what I would do next; use: how to use it now; measure: what I would measure.' },
}

/** The fields of an entry of each kind: the shared ones plus the kind's own. */
export const ENTRY_FIELDS: Record<Kind, Field> = {
  study: { kind: 'obj', label: 'Study', fields: { ...base, log: { kind: 'list', label: 'Log', optional: true, of: { kind: 'obj', label: 'Line', fields: { date: date('Date', 'YYYY-MM-DD'), did: { kind: 'str', label: 'What was done' }, topic: { kind: 'str', label: 'Topic', optional: true, help: 'The board topic it worked on, e.g. T02.' } } } } } },
  series: { kind: 'obj', label: 'Series', fields: { ...base, study: { kind: 'str', label: 'Study', optional: true }, premise: { kind: 'str', label: 'Premise', optional: true, help: 'The lead before any chapter is out.' } } },
  chapter: { kind: 'obj', label: 'Chapter', fields: { ...base, parent: { kind: 'str', label: 'Series' }, order: { kind: 'num', label: 'Number', int: true, min: 1 }, keyLine: text('Key line', 'The lead when there is no instrument.', true) } },
  note: { kind: 'obj', label: 'Note', fields: { ...base, parent: { kind: 'str', label: 'Study', optional: true }, topic: { kind: 'str', label: 'Topic', optional: true, help: 'The study topic it writes up, e.g. T02.' }, keyLine: text('Key line', 'The lead when there is no instrument.', true) } },
  build: {
    kind: 'obj',
    label: 'Build',
    fields: {
      ...base,
      install: { kind: 'str', label: 'Install line', optional: true },
      repo: { kind: 'url', label: 'Source', optional: true },
      live: { kind: 'url', label: 'Live site', optional: true },
      result: { kind: 'obj', label: 'Result', optional: true, fields: { value: { kind: 'str', label: 'Value' }, baseline: { kind: 'str', label: 'Baseline', optional: true } } },
      ...ending,
    },
  },
  experiment: {
    kind: 'obj',
    label: 'Experiment',
    fields: {
      ...base,
      result: {
        kind: 'obj',
        label: 'Result',
        fields: { question: { kind: 'str', label: 'Question' }, setup: { kind: 'str', label: 'Setup' }, value: { kind: 'str', label: 'Value' }, baseline: { kind: 'str', label: 'Baseline', optional: true } },
      },
      ...ending,
    },
  },
  essay: { kind: 'obj', label: 'Essay', fields: { ...base, opening: text('Opening', 'The first paragraph, set large as the lead.'), canonical: { kind: 'url', label: 'First ran at', optional: true } } },
}

export const sectionField: Field = {
  kind: 'obj',
  label: 'Section',
  fields: {
    id: id('Id', 'Its URL: /lab/<id>.'),
    title: { kind: 'str', label: 'Title' },
    thesis: { kind: 'str', label: 'Thesis', help: 'One or two sentences under the title and on its home band.' },
    hero: { kind: 'str', label: 'Hero', optional: true, help: 'An entry id to lead the section page.' },
  },
}
export const tagField: Field = {
  kind: 'obj',
  label: 'Tag',
  fields: { id: id('Id', 'Its URL: /lab/tags/<id>.'), title: { kind: 'str', label: 'Title' }, about: { kind: 'str', label: 'About', optional: true } },
}
export const termField: Field = {
  kind: 'obj',
  label: 'Term',
  fields: {
    id: id('Id', 'Written [[t:<id>|words]] in a body.'),
    name: { kind: 'str', label: 'Name', help: 'As its card’s title.' },
    def: { kind: 'str', label: 'Meaning', help: 'One plain line.' },
    link: { kind: 'str', label: 'Links on to', optional: true, help: 'An entry id, or an https:// URL.' },
    source: { kind: 'str', label: 'Source', help: 'Where the definition comes from. Never shown; kept for review.' },
  },
}
export const figureField: Field = {
  kind: 'obj',
  label: 'Figure',
  fields: {
    instrument: { kind: 'str', label: 'Instrument' },
    caption: text('Caption', 'Under the figure.', true),
    data: { kind: 'obj', label: 'Data', fields: {}, help: 'Shaped by the instrument (its schema in lib/lab/instruments/schemas.ts).' },
  },
}
export const unfurlField: Field = {
  kind: 'obj',
  label: 'Link card',
  fields: {
    title: { kind: 'str', label: 'Title' },
    description: { kind: 'str', label: 'Description', optional: true },
    site: { kind: 'str', label: 'Site' },
    domain: { kind: 'str', label: 'Domain' },
    img: {
      kind: 'obj',
      label: 'Image',
      optional: true,
      fields: { ...(imageField as Extract<Field, { kind: 'obj' }>).fields, alt: { kind: 'str', label: 'Description', empty: true } },
    },
    icon: { kind: 'str', label: 'Favicon', optional: true },
    standIn: { kind: 'bool', label: 'Stand-in', optional: true, help: 'Built by hand from his own copy, because the site refuses scripts.' },
  },
}
export const STUDY_STATUSES = ['done', 'doing', 'todo', 'parked', 'later'] as const
export const studyField: Field = {
  kind: 'obj',
  label: 'Study board',
  fields: {
    id: id('Id', 'The study entry’s id.'),
    tracks: { kind: 'list', label: 'Tracks', of: { kind: 'str', label: 'Track' } },
    topics: {
      kind: 'list',
      label: 'Topics',
      titleKey: 'topic',
      of: {
        kind: 'obj',
        label: 'Topic',
        fields: {
          id: { kind: 'str', label: 'Id', help: 'T01, T02, …' },
          track: { kind: 'str', label: 'Track' },
          topic: { kind: 'str', label: 'Topic' },
          phase: { kind: 'str', label: 'Phase' },
          est: { kind: 'num', label: 'Estimate', min: 0 },
          spent: { kind: 'num', label: 'Spent', min: 0 },
          status: { kind: 'enum', label: 'Status', options: STUDY_STATUSES },
          finished: date('Finished', 'YYYY-MM-DD, or empty.', true),
          learn: { kind: 'str', label: 'What it teaches', optional: true },
        },
      },
    },
  },
}
