---
name: update-content
description: Change what the portfolio site says — projects, jobs, awards, profile, archive, now, writing, the tool shelf, front-page copy, screenshots, the résumé. Use whenever the user reports news ("I won X", "new job at Y", "add this project", "update my bio") or asks to edit site content. Same path as the /edit editor, so both stay interchangeable.
---

# Updating site content

The site's content is data in `content/data/*.json`, described field by field in
`content/schema/index.ts`. The `/edit` page on the live site edits these same files, validates
them with the same rules (`lib/edit/rules.ts`), and commits to `main`; the server deploys `main`
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
   shows the live commit. Never run `stage deploy` — the server deploys from `main` itself.

## Don't

- Don't hand-edit files on the server; its checkout refuses to deploy with local changes.
- Don't add keys the schema doesn't know — `content:check` rejects them, and so does `/edit`.
- Don't write copy into `components/` — it belongs in content (see CLAUDE.md).
