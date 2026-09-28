# Content editor (`/edit`) — design

**Status:** approved in conversation 2026-09-28, awaiting spec review.

## Why

Updating the site means hand-editing several TypeScript files for one fact, then rebuilding and
redeploying from the laptop. The SOP Opera win (`6b54815`) touched four files. Aahil wants to
make those edits himself, from any device, in a form — without an assistant or an editor.

## Decisions

| Question | Decision |
|---|---|
| How does a save go live? | Commit to `main` on GitHub → the server notices and rebuilds. ~2–3 min. |
| Sign-in | GitHub App, installed on this repo only, allowlisted to one numeric user ID. |
| Editable | Core facts (profile, projects, experience, archive, now, writing), stack, front-page copy (`site.ts`), image and résumé uploads. |
| Not editable | Themes, tutorial, eggs, arcade, props, apps (dock), mobile, notes, visitors, contributions. They stay in code. |
| Live preview | Not in v1. "View on site" after deploy, plus Revert. |

## 1. Content format

The editable content moves out of TypeScript literals into JSON under `content/data/`:

```
content/data/profile.json   projects.json   experience.json   archive.json
             now.json       writing.json    stack.json        site.json
```

Each existing `content/<name>.ts` becomes a thin wrapper that imports its JSON and re-exports
it under the **same name and type** as today. No component, page or `content/index.ts` import
changes. Derived values stay in the wrappers (e.g. `stack.ts`'s tool lookup map).

**One schema per file**, in `content/schema/`, written in a small hand-rolled schema vocabulary
(`str`, `text`, `rich`, `enum`, `num`, `bool`, `list`, `obj`, `ref`, `file`; each with `label`,
`help`, `optional`, `max`). The schema is the single description of the content, and it drives
three things:

1. **Types** — `types.ts` stays the TypeScript source of truth. Each schema carries a
   compile-time assertion that its inferred type and the matching `types.ts` type are mutually
   assignable, so the two can't drift.
2. **Validation** — `content/validate.ts` runs the schema check first, then its existing
   cross-file rules (duplicate slugs, stack refs, image paths, the two known typos). The same
   function runs at build time (module scope in `app/page.tsx`, as now) and on every save.
3. **Forms** — the editor renders fields from the schema. The doc comments in today's files
   become each field's `help` text, so the guidance appears next to the field it describes.

No runtime dependency is added (no zod): the schema vocabulary is ~150 lines, which keeps the
"Next and React only" rule intact for the canvas.

**Derived stat:** the `wins` headline stat is computed from `awards.length` instead of typed.
A new award is one edit, not two.

The migration is mechanical and verified by a snapshot: before the migration, serialise every
export in `content/index.ts` to JSON; after it, the same serialisation must match
byte-for-byte.

## 2. Architecture

```
browser ── /edit (client UI, own chunk)
            │
            ├─ /api/edit/auth/{login,callback,logout}   GitHub App user-to-server OAuth
            ├─ /api/edit/content/[file]  GET → JSON + blob sha   PUT → validate → commit
            ├─ /api/edit/upload          POST → sniff/limit → commit to public/…
            ├─ /api/edit/history         GET  → recent commits touching content/data, public/work
            └─ /api/edit/revert          POST → revert one of those commits
                          │
                          ▼  GitHub REST (contents / git data API), with the user's token
                    github.com/aahil-khan/portfolio-canvas  main
                          ▲
aahil-server: systemd timer, every 60s ─ git fetch; if origin/main moved:
              reset checkout → stagectl deploy portfolio-redesign → prune this app's
              dangling images only
```

- **`/api/version`** returns the commit SHA baked in at build time (`BUILD_SHA` build arg). The
  editor polls it after a save to show *Saved → Building → Live*.
- **Multi-file commits** (a save plus its uploads, or a revert) use the git data API
  (blobs → tree → commit → update ref), so each action is exactly one commit.
- **Concurrency:** a PUT carries the blob SHA the editor loaded. If `main` has a different SHA
  for that file, the API returns 409 and the UI says "changed elsewhere — reload".
- **Bundle isolation:** `/edit` and its API routes import nothing from `components/site/*` or
  `components/desktop/*`, and neither `/` nor `/canvas` imports anything from `app/edit` or
  `lib/edit/*`. The existing gsap check in CLAUDE.md gets a sibling that asserts `/` and
  `/canvas` don't reference the editor's chunks.

### Deploy change

The server's app directory (`~/staging/apps/portfolio-redesign`) becomes a git checkout of
`main` instead of an rsync target. `.env.local` stays untracked in it. **Code changes deploy by
`git push`** from now on. Running `stage deploy` from the laptop would overwrite edits made in
the browser, so the README says not to, and the watcher script refuses to run if the checkout
has local changes.

The watcher (`deploy/watch.sh` + a systemd user unit and timer, in this repo) is the only new
thing on the server. It doesn't touch any other container, and it prunes only
`stage-portfolio-redesign`'s dangling images. `docker build` runs while the old container still
serves, so a failed build leaves the live site untouched; the failure is written to the
watcher's log, and the editor shows "build failed" once `/api/version` hasn't changed for
10 minutes.

## 3. Security

- **GitHub App**, not an OAuth App: installed on this one repo with `contents: write` and nothing
  else. User tokens expire after 8h. A stolen token can't reach other repos or account settings.
- **Allowlist by numeric user ID** (`EDIT_ALLOWED_USER_ID`), checked at callback and on every
  API call. Anyone else gets a 403 with no editor rendered.
- **OAuth flow:** `state` and a PKCE verifier stored in a short-lived signed `__Host-` cookie,
  checked on callback. Callback rate-limited via the existing Redis store.
- **Session:** the GitHub user token, user ID and expiry are encrypted with AES-256-GCM (Web
  Crypto, key `EDIT_SESSION_SECRET`) into a `__Host-edit` cookie: HttpOnly, Secure,
  SameSite=Strict, Path=/. Nothing is stored server-side. Revoking the App on GitHub ends every
  session, because every call uses the token.
- **Mutations** (PUT, POST) also require the `Origin` header to match the site's own origin.
- **Server-side validation** on every write: schema + cross-file rules on the full content set
  with the change applied. The client check is for convenience only.
- **Uploads:** PNG, JPEG, WebP, PDF only, identified by magic bytes. SVG refused. Caps: 5 MB
  per image, 10 MB for the PDF. The server generates the path (`public/work/<slug>-<n>.<ext>`,
  `public/resume.pdf`); the client filename is never used.
- **`/edit` headers:** `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, a nonce-based CSP
  (Next's own inline scripts get the nonce; nothing else runs), `Cache-Control: no-store`. Disallowed in `robots.ts`, absent from the sitemap.
- **Fail closed:** if any of `EDIT_GITHUB_APP_CLIENT_ID`, `EDIT_GITHUB_APP_CLIENT_SECRET`,
  `EDIT_SESSION_SECRET`, `EDIT_ALLOWED_USER_ID` is missing, `/edit` and `/api/edit/*` return
  404, same as `/stats`.
- **Rendering:** content reaches the page only as React text through `lib/rich.tsx`, which
  already has no HTML path. No new `dangerouslySetInnerHTML`.

## 4. Editor UI

Designed static-first: an HTML mockup under `prototype/edit.html`, approved before any React.
It uses the DIRECTION.md tokens (cream theme, hard borders and shadows, Space Grotesk) and
works at phone width.

- **Section list** (sidebar on desktop, menu on phone): Profile, Projects, Experience, Archive,
  Now, Writing, Stack, Front page, Files, History.
- **Fields from the schema:** `str` → input, `text`/`rich` → auto-growing textarea (with a
  `**bold**` / `*italic*` hint for `rich`), `enum` → select, `ref` → picker (e.g. a project's
  stack from the tool shelf), `file` → picker from uploaded files plus an upload button.
- **Lists:** add, remove (confirmation inline, no browser dialogs), move up/down, duplicate.
- **Errors** show inline as you type. Save stays disabled while any exist, and the button says
  how many.
- **Save:** one commit per section, with an optional message (default `Edit <section>: <first
  changed item>`). Unsaved changes are marked on the section and guarded on navigation.
- **Status strip:** Saved → Building → Live (or Build failed), then "View on site".
- **History:** the last 20 editor or content commits, each with Revert. A revert whose files
  changed in a later commit is refused with a message naming that commit, never merged blindly.

## 5. Testing

- **Unit (node:test, no new deps):** schema validator (every kind, optional/max, error paths),
  session seal/unseal and tamper rejection, magic-byte sniffing, upload path generation,
  commit-payload building.
- **Migration snapshot:** byte-identical export serialisation before and after (section 1).
- **API routes:** the GitHub client behind an interface, so tests run against a fake and cover
  403 for another user, 409 on a stale SHA, 422 on invalid content, 404 when unconfigured, and
  a rejected Origin.
- **Build gates:** `npm run build`, `npm run check`, the gsap-chunk check, the new editor-chunk
  check.
- **Manual end-to-end** on a throwaway branch before switching to `main`: sign in, edit, upload,
  watch the deploy, revert. Screenshots of `/edit` at desktop and phone width.

## Setup Aahil does once

1. Create the GitHub App (the plan will give exact field values), install it on this repo only.
2. Add the four `EDIT_*` values to `.env.local` on the server.
3. Turn the server's app directory into a checkout and enable the timer (a script in `deploy/`
   does it; it will be shown before it's run).

## Out of scope

Live preview, drafts, multi-user access, editing themes/tutorial/eggs/dock, image
cropping/resizing, scheduled publishing.
