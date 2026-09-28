import data from './data/site.json' with { type: 'json' }

/*
 * The data lives in `content/data/site.json` — edit it at /edit, or by hand. Field help is in
 * `content/schema/index.ts`. This file only gives it a type.
 */

/**
 * Copy for the scrolling front page at `/`.
 *
 * Only what this surface needs and no other has. Every fact — roles, projects, tools, awards —
 * still comes from the other content files, so the front page and the canvas can never disagree
 * about anything true. Per CLAUDE.md, nothing in `components/site/` contains a sentence.
 */
export const site = data
