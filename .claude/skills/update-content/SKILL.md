---
name: update-content
description: Change what the portfolio site says — projects, jobs, awards, profile, archive, now, writing, the tool shelf, front-page copy, screenshots, the résumé. Use whenever the user reports news ("I won X", "new job at Y", "add this project", "update my bio") or asks to edit site content. Same path as the /edit editor, so both stay interchangeable.
---

# Updating site content

The site's content is data in `content/data/*.json`, described field by field in
`content/schema/index.ts`. The `/edit` page on the live site edits these same files, validates
them with the same rules (`lib/edit/rules.ts`), and commits to `main`; Vercel deploys `main`
within a few minutes. This skill is that path, done from the repo.

## Where things live

| Change | File | Notes |
|---|---|---|
| Name, bio, links, email, portrait, résumé path, headline numbers | `content/data/profile.json` | The "wins" number is `{"derived":"wins"}` — it counts `awards`. Never type it. |
| Projects | `content/data/projects.json` | `stack` names must exist in `stack.json`. `slug` is a URL — don't rename casually. |
| Jobs, education, awards | `content/data/experience.json` | A new award bumps "wins" by itself. |
| Archive (scrapbook) | `content/data/archive.json` | Newest first; order is display order. |
| Now card | `content/data/now.json` | Bump `updated` (YYYY-MM) whenever you touch it. |
| Writing | `content/data/writing.json` | |
| Tool shelf | `content/data/stack.json` | |
| Front page copy | `content/data/site.json` | Change strings only; adding a key needs a component change. |
| Screenshots | `public/work/<slug>-<n>.webp` (roles/projects), `public/archive/…` | PNG/JPEG/WebP only, ≤ 5 MB. Never SVG. |

Never edit the `content/*.ts` wrappers to change content — they only type the JSON.

## Steps

1. **Read before writing.** Open the JSON you are changing and the field's entry in
   `content/schema/index.ts` (its `help` says what the field is for). One piece of news often
   touches several files — a hackathon win is an `award` on the project, an entry in
   `experience.awards`, and maybe an archive note. Say which files you will change.
2. **Edit the JSON.** Keep 2-space indentation and a trailing newline (`JSON.stringify(x, null, 2)`
   plus `\n`) — the editor writes the same format, so diffs stay clean. Omit an optional field
   rather than setting it to `""`.
3. **Validate:** `npm run content:check`. It must print `8 files valid`. Fix every issue it lists.
4. **Build and look:** `npm run build`, then screenshot the page that shows the change (e.g.
   `/`, `/work/<slug>`) with `shot` and look at it. Don't report a visible change you haven't seen.
5. **Commit** on the current branch with a message that says what changed, ending with the
   trailer line `Edited-via: claude` (after a blank line, before Co-Authored-By).
6. **Publish only when the user asked to.** Publishing = the commit reaching `main` on GitHub
   (push, or merge the PR). Then tell them: live in ~3 minutes, and `curl -s <site>/api/version`
   shows the live commit (the site is https://www.aahil-khan.xyz). Vercel deploys `main` by itself.

## The Lab (`/lab`)

The Lab's content is data too, but not in `/edit` yet (that is the Lab's editor PR). Its contract
is `content/lab/API.md`; read it before a Lab change. Validation is `validateLab`
(`lib/lab/rules.ts`), run by `npm run content:check` and the build over **both** sets below.

**Two sets, one switch.** `content/data/lab.json` → `"demo"` picks which one every Lab page shows:

- **The real set** is Aahil's own, and starts **empty** on purpose: he writes everything himself.
  Never seed it with the demo's content, the mockup's, or anything he hasn't given you.
- **The demo set** (`content/lab/demo/`, images in `public/lab/demo/`) is pre-populated demo content
  so he can judge the look and feel on prod. It is **temporary**: while `"demo": true` every Lab page
  says "Demo content" in its bar, and at the end it is deleted (API.md, "Demo mode", lists the one
  clean-up PR). Don't edit it to say real things, and don't link to it from anything real.
- `copy` (the Lab's chrome words) is in `content/data/lab.json` and is real in both modes.

How his real content slots in. Ids are lowercase with dashes and never `index`, `tags`, `glossary`,
`demo` or `fixture`.

| To add | Write | Notes |
|---|---|---|
| a section | `content/data/lab.json` → `sections[]`: `{ id, title, thesis }` | it shows once it holds a top-level entry |
| a tag | `lab.json` → `tags[]`: `{ id, title }` | at most 8 in the whole Lab |
| an entry | `lab.json` → `entries[]`, fields by kind in `content/schema/lab.ts` | `published` is a `YYYY-MM-DD` day; a draft has `"draft": true, "published": null` |
| its body | `content/lab/<section>/<slug>.md`, or `content/lab/<section>/<parent-slug>/<slug>.md` for a chapter or a study's note | Markdown, no HTML: `[[id\|words]]`, `[[t:id\|words]]`, `[[tag:id\|words]]`, `[^key]`, `::figure{of="id"}`, `:::side[Heading]` … `:::`, `![alt](/lab/<id>/x.webp "w=1200 h=675 \| caption")` |
| a reference | the entry's `refs`: `{ key: { title, site, line, url } }` | cite it `[^key]` in the body; every one must be cited; give a `line` when the site has no unfurl |
| a glossary term | `content/data/lab-terms.json`: `{ id, name, def, link?, source }` | |
| figure data | `content/data/lab-figures.json`: `{ id: { instrument, caption?, data } }` | |
| a link card | `content/data/lab-unfurls.json`, by URL | written by the unfurl script, not by hand |
| a study's board | `node --experimental-strip-types scripts/lab-import-study.ts --id=<study>` | reads the tracker by a column allowlist; never paste tracker columns by hand |
| images | `public/lab/<entry-id>/*.webp` | sizes declared wherever they're used |

The rules that refuse a save are in `lib/lab/rules.ts`: every link and reference resolves, a long
entry has a `pull` that is a sentence of its body word for word, a build or experiment ends with
`ending`, every link out has a card, and the **privacy denylist** (companies, the hiring track, the
tracker's private phases) holds over every Lab file. Run `npm run content:check` after any change.

## Don't

- Don't add keys the schema doesn't know — `content:check` rejects them, and so does `/edit`.
- Don't write copy into `components/` — it belongs in content (see CLAUDE.md).
