# Content Editor (`/edit`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GitHub-authenticated `/edit` page where Aahil edits the site's content in forms; every save is one commit to `main`, and the server rebuilds from `main` automatically.

**Architecture:** Editable content moves to `content/data/*.json`, each described by a schema that drives validation (build time and save time) and the editor's forms. Route handlers under `/api/edit/*` read and commit through the GitHub REST API with the signed-in user's GitHub App token, sealed in an encrypted cookie. A systemd timer on aahil-server polls `main`, then pulls and rebuilds.

**Tech Stack:** Next 16 (app router, route handlers, `proxy.ts`), React 19, Web Crypto (AES-GCM, SHA-256), GitHub REST (contents + git data API), `node --test` with native TS stripping (Node 22.22), bash + systemd user units.

**Spec:** `docs/superpowers/specs/2026-09-28-content-editor-design.md`

## Global Constraints

- No new runtime dependency. No zod, no auth library, no Octokit.
- `/` and `/canvas` must not reference any chunk from `app/edit` or `lib/edit`; the gsap check still reads `/ LOADS GSAP`, `/canvas clean`.
- `lib/edit/*` and `content/schema/*` import each other by relative path **with `.ts` extensions** so `node --test` can load them; `tsconfig.json` gets `allowImportingTsExtensions: true` (valid because `noEmit`).
- Env: `EDIT_GITHUB_APP_CLIENT_ID`, `EDIT_GITHUB_APP_CLIENT_SECRET`, `EDIT_SESSION_SECRET` (≥32 chars), `EDIT_ALLOWED_USER_ID` (numeric), `EDIT_ORIGIN` (e.g. `https://portfolio-redesign.aahil-khan.xyz`). If any is missing, `/edit` and `/api/edit/*` return 404.
- Repo: `aahil-khan/portfolio-canvas`, branch `main` (constants in `lib/edit/config.ts`).
- Upload types: PNG, JPEG, WebP, PDF, by magic bytes. SVG is refused. Caps: 5 MB per image, 10 MB for a PDF.
- Cookie: `__Host-edit`, HttpOnly, Secure, SameSite=Strict, Path=/, max age 8h.
- UI values come from `design/DIRECTION.md` (cream tokens, Space Grotesk, 2px `--border`, hard shadows). The copy lives in `content/edit.ts`, not in components.
- Static-first: `prototype/edit.html` is built and screenshotted before `app/edit`.

## Review Focus

1. **Stale save:** a laptop push changes `projects.json` while the editor has it open → the save must return 409 and never overwrite. Pinned in Task 5 (`save rejects stale sha`) and via the ref-update race (`save maps 422 non-fast-forward to 409`).
2. **Content that is valid alone but invalid together:** e.g. deleting a tool that a project's `stack` still names → rejected at save time, not at build. Pinned in Task 5 (`save validates the whole set`).
3. **Another GitHub user signs in:** they must get a 403 at the callback and never receive a cookie. Pinned in Task 4 (`callback refuses other user`).
4. **Upload lies about its type:** an HTML file named `x.png`, or an SVG → 415. Pinned in Task 5 (`sniff`).
5. **Revert after a later edit** to the same file → refused with the later commit named. Pinned in Task 5 (`revert refuses when file moved on`).

---

### Task 1: Test harness + schema vocabulary

**Files:**
- Modify: `tsconfig.json` (add `"allowImportingTsExtensions": true`), `package.json` (`"test": "node --test 'lib/**/*.test.ts' 'content/**/*.test.ts'"`)
- Create: `lib/edit/schema.ts`, `lib/edit/schema.test.ts`

**Interfaces — Produces:**
```ts
export type Field =
  | { kind: 'str' | 'text' | 'rich' | 'url' | 'email'; label: string; help?: string; optional?: boolean; max?: number }
  | { kind: 'num'; label: string; help?: string; optional?: boolean; int?: boolean; min?: number; max?: number }
  | { kind: 'bool'; label: string; help?: string; optional?: boolean }
  | { kind: 'enum'; label: string; help?: string; optional?: boolean; options: readonly string[] }
  | { kind: 'ref'; label: string; help?: string; optional?: boolean; to: 'tool' }
  | { kind: 'file'; label: string; help?: string; optional?: boolean; accept: 'image' | 'pdf'; dir: 'work' | 'archive' | 'pfp' | 'logos' | '' }
  | { kind: 'shot'; label: string; help?: string; optional?: boolean; dir: 'archive' }   // string | {src, caption?}
  | { kind: 'list'; label: string; help?: string; optional?: boolean; of: Field; itemLabel?: string; titleKey?: string }
  | { kind: 'obj'; label: string; help?: string; optional?: boolean; fields: Record<string, Field> }
export interface Issue { path: string; message: string }   // path like "projects[2].stack[0]"
export function check(field: Field, value: unknown, path?: string): Issue[]
export function blank(field: Field): unknown   // empty value for "Add"
```
Rules: unknown keys on `obj` are issues ("unknown field"); a missing optional field is fine, and so is an empty string on an optional string (the UI deletes the key on save); a required `str` must be a non-empty trimmed string; `url` must match `^(https?:|mailto:)`; `email` must contain `@`; `file` must start with `/` and not contain `..`; `max` on strings is the length limit.

- [ ] **Step 1: Write the failing tests** in `lib/edit/schema.test.ts`: required str missing → issue at the exact path; unknown key → issue; `url` rejects `javascript:alert(1)`; `enum` rejects a value outside `options`; `list` of `obj` reports `items[1].name`; `shot` accepts `'/a.webp'` and `{src:'/a.webp',caption:'x'}` and rejects `{src:1}`; `file` rejects `/../etc/passwd`; `blank(obj)` fills required strings with `''` and leaves optional ones out; `num` with `int` rejects `2.5`.
- [ ] **Step 2:** `npm test` → fails (module missing).
- [ ] **Step 3:** Implement `schema.ts` (~150 lines, one `switch` over `kind`).
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `Add a small schema vocabulary for editable content`.

### Task 2: Content schemas + pure cross-file rules

**Files:**
- Create: `content/schema/index.ts` (exports `SCHEMAS: Record<FileId, Field>` and `FILES`), `lib/edit/rules.ts`, `lib/edit/rules.test.ts`
- `FileId = 'profile' | 'projects' | 'experience' | 'archive' | 'now' | 'writing' | 'stack' | 'site'`

**Interfaces — Produces:**
```ts
// content/schema/index.ts
export const FILES: readonly { id: FileId; label: string; path: `content/data/${string}.json` }[]
export const SCHEMAS: Record<FileId, Field>
export type ContentSet = Record<FileId, unknown>
// lib/edit/rules.ts
export function validateSet(set: ContentSet, fileExists: (publicPath: string) => boolean): Issue[]
```
JSON shapes (one file each):
- `profile.json`: `{ profile: Profile, headlineStats: {value,label}[] }`. The `wins` entry is **removed** from JSON and injected by the wrapper as `String(awards.length)`, keeping its position through a `{ "derived": "wins" }` placeholder, which the schema allows only in `headlineStats`.
- `projects.json`: `Project[]`. `experience.json`: `{ jobs, education, awards }`. `archive.json`: `ArchiveItem[]` (the `ARCHIVE_KINDS` colours stay in TS). `now.json`: `{ updated, lede, items, foot }`. `writing.json`: `Post[]`. `stack.json`: `ToolGroup[]`. `site.json`: the whole `site` object.
- The `help` text for each field is taken from the doc comment above it in the current `.ts`/`types.ts`, shortened to one sentence.
- `site` schema: built by `copyTree(label, value)`, a helper in `content/schema/site.ts` that walks the current object and produces `obj`/`text`/`num`/`list of str` fields, with help text for the fields that have a comment today (openTo, headline, toDesk, portraitEgg.answers, door.note).

`validateSet` = schema `check` on each file + the editable-content rules moved out of `content/validate.ts`: duplicate slugs (projects, jobs, posts, archive ids), unknown stack names, missing files (project/job images, archive image(s), tool logos, profile resumePdf/portrait/portraitHidden), non-absolute project links, email shape, and the FORBIDDEN typos. Props/apps/dockLayout rules stay in `content/validate.ts`.

- [ ] **Step 1: Failing tests** in `rules.test.ts` built on a minimal valid fixture set: the fixture passes; a duplicate project slug → issue; a project `stack: ['Nope']` → issue naming the slug; an image the `fileExists` stub says is missing → issue; `"Al Powered"` in a job highlight → issue; `headlineStats` with `{derived:'wins'}` passes but `{derived:'x'}` fails.
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement the schemas and `rules.ts`.
- [ ] **Step 4:** `npm test` → passes.
- [ ] **Step 5:** Commit `Describe the editable content as schemas, and make its rules pure`.

### Task 3: Migrate content to JSON (no visible change)

**Files:**
- Create: `scripts/content-snapshot.ts` (imports the 8 content modules by relative path — they use only relative, type-only imports, so Node's type stripping loads them), `content/data/*.json` (8 files), `scripts/check-content.ts`
- Modify: `content/profile.ts`, `projects.ts`, `experience.ts`, `archive.ts`, `now.ts`, `writing.ts`, `stack.ts`, `site.ts` → wrappers; `content/validate.ts` → calls `validateSet` with a JSON-loaded set + `existsSync`, and keeps the non-editable rules; `package.json` (`"content:check": "node scripts/check-content.ts"`, added to `check`)

Snapshot method: run `node scripts/content-snapshot.ts > $SCRATCH/before.json`, migrate, run again, `diff` → must be empty.

Wrapper shape (example):
```ts
import type { Project } from './types'
import data from './data/projects.json'
/** Edited at /edit — see content/schema/index.ts for field help. */
export const projects: readonly Project[] = data as Project[]
```
Casts are sound because `validateSet` (same schema) runs at build on this exact data; `content/schema/index.ts` carries type-level assertions (`AssertEq<Infer, Project>`-style, via a `satisfies` check on a typed fixture) so the schema and `types.ts` can't drift. `site`/`now` keep `as const` narrowness only where consumers need it. `tsc` decides; widen the type in `types.ts` if nothing needs the literal.

- [ ] **Step 1:** Write `scripts/content-snapshot.ts` (serialise every value export of the 8 files, sorted keys) and capture `before.json`.
- [ ] **Step 2:** Generate the JSON files from the current exports (a one-off `node` script in scratch, not committed), then hand-check the `wins` placeholder.
- [ ] **Step 3:** Convert the wrappers; update `validate.ts`; add `scripts/check-content.ts` (reads JSON with `fs`, runs `validateSet`, prints issues, exits 1 on any).
- [ ] **Step 4:** Snapshot again → `diff` empty. `npm run typecheck && npm test && npm run content:check && npm run build` → green.
- [ ] **Step 5:** Commit `Move editable content to JSON behind typed wrappers`.

### Task 4: Config, session and GitHub sign-in

**Files:**
- Create: `lib/edit/config.ts`, `lib/edit/session.ts`, `lib/edit/session.test.ts`, `lib/edit/oauth.ts`, `lib/edit/oauth.test.ts`, `app/api/edit/auth/login/route.ts`, `app/api/edit/auth/callback/route.ts`, `app/api/edit/auth/logout/route.ts`

**Interfaces — Produces:**
```ts
// config.ts
export interface EditConfig { clientId: string; clientSecret: string; secret: string; allowedUserId: number; origin: string }
export function editConfig(env?: Record<string, string | undefined>): EditConfig | null  // null → 404
export const REPO = { owner: 'aahil-khan', repo: 'portfolio-canvas', branch: 'main' } as const
// session.ts
export interface Session { token: string; userId: number; login: string; exp: number }  // exp: epoch ms
export async function seal(s: Session, secret: string): Promise<string>   // base64url(iv|ciphertext)
export async function unseal(v: string | undefined, secret: string, now?: number): Promise<Session | null>
export const COOKIE = '__Host-edit'; export const FLOW_COOKIE = '__Host-edit-flow'
// oauth.ts
export function pkcePair(): Promise<{ verifier: string; challenge: string }>
export function authorizeUrl(cfg: EditConfig, state: string, challenge: string): string
export async function finishLogin(cfg: EditConfig, code: string, verifier: string, fetchImpl?: typeof fetch):
  Promise<{ ok: true; session: Session } | { ok: false; status: 403 | 502; reason: string }>
```
The key is SHA-256(secret), imported as AES-GCM 256. The flow cookie seals `{state, verifier, exp: now+10min}` with the same `seal`. The callback compares `state` in constant time, exchanges the code (sending `code_verifier`), calls `GET /user`, and requires `id === allowedUserId`. Otherwise 403, no session cookie, and the GitHub token is revoked best-effort with `DELETE /applications/{client_id}/token`. The callback is rate-limited with `allow('edit-login:'+bucket, 10, 600)` from `lib/store.ts`.

- [ ] **Step 1: Failing tests:** `seal`→`unseal` round-trip; a flipped byte → null; wrong secret → null; `exp` in the past → null; `editConfig` with any var missing → null, and with a non-numeric user id → null; `finishLogin` with a fake fetch returning user id 999 → `{ok:false,status:403}` (**callback refuses other user**); allowed id → session with `exp` = now + token `expires_in` (capped at 8h).
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement the modules and the three routes (login: set the flow cookie, 302 to GitHub; callback: validate, set the session cookie, 302 `/edit`; logout: POST only, Origin-checked, clear the cookie, 303 `/`).
- [ ] **Step 4:** `npm test && npm run typecheck` → green.
- [ ] **Step 5:** Commit `Sign in to the editor with a GitHub App`.

### Task 5: GitHub client and the content service

**Files:**
- Create: `lib/edit/github.ts` (interface + fetch implementation), `lib/edit/service.ts`, `lib/edit/sniff.ts`, `lib/edit/fake-github.ts` (test helper), `lib/edit/service.test.ts`, `lib/edit/sniff.test.ts`

**Interfaces — Produces:**
```ts
// github.ts
export interface TreeEntry { path: string; sha: string; type: 'blob' | 'tree' }
export interface Git {
  head(): Promise<{ commit: string; tree: string }>
  tree(treeSha: string): Promise<TreeEntry[]>                 // recursive
  blob(sha: string): Promise<Uint8Array>
  commit(parent: string, baseTree: string, files: { path: string; content: Uint8Array | null }[], message: string): Promise<string>
  //  ↑ blobs → tree(base_tree) → commit → PATCH ref (force:false); throws GitConflict on 422 non-fast-forward
  log(path: string, n: number): Promise<{ sha: string; message: string; date: string; author: string }[]>
  diff(sha: string): Promise<{ parent: string; files: { path: string; status: 'added' | 'modified' | 'removed' }[] }>
  blobAt(commit: string, path: string): Promise<{ sha: string; bytes: Uint8Array } | null>
}
export class GitConflict extends Error {}
export function githubGit(token: string, fetchImpl?: typeof fetch): Git
// sniff.ts
export function sniff(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | 'pdf' | null
// service.ts
export interface Loaded { head: string; files: Record<FileId, { sha: string; data: unknown }>; publicFiles: string[] }
export async function load(git: Git): Promise<Loaded>
export type SaveResult = { ok: true; commit: string } | { ok: false; status: 409 | 422; issues?: Issue[]; message: string }
export async function save(git: Git, id: FileId, data: unknown, baseSha: string, message: string): Promise<SaveResult>
export async function upload(git: Git, bytes: Uint8Array, target: { dir: string; slug: string } | { resume: true }, message?: string):
  Promise<{ ok: true; path: string; commit: string } | { ok: false; status: 413 | 415; message: string }>
export async function history(git: Git, n?: number): Promise<{ sha: string; message: string; date: string; author: string }[]>
export async function revert(git: Git, sha: string): Promise<{ ok: true; commit: string } | { ok: false; status: 409 | 422; message: string; issues?: Issue[] }>
```
`save`: load head and tree; if the tree's blob sha for `content/data/<id>.json` ≠ `baseSha` → 409 "changed elsewhere". Build the set with `data` substituted, run `validateSet` (fileExists = path in tree under `public/`); issues → 422. Otherwise serialise with `JSON.stringify(data, null, 2) + '\n'` and commit; on `GitConflict` → 409. The commit message defaults to `Edit <label>` and always ends with the trailer `Edited-via: /edit`.
`upload`: size check before sniffing (413). `sniff` null, or pdf-vs-image mismatch → 415. The path is `public/<dir>/<slug>-<n>.<ext>`, where `n` = 1 + the highest existing `n` for that slug; the slug is re-slugified server-side (`[a-z0-9-]`, max 40). A résumé goes to `profile.resumePdf`'s current path, or `/resume.pdf`.
`history`: merge `log('content/data', n)` and `log('public', n)`, dedupe by sha, sort newest first, take `n` (default 20).
`revert`: for each file in `diff(sha)`, if the current blob sha at head ≠ the blob sha at `sha` → 409 naming the newest `log(path,1)` commit. Otherwise build the restored set (the parent's bytes, or deletion when `added`) and validate it like `save` (422 if invalid) **before** committing it as one commit `Revert "<subject>"`.

- [ ] **Step 1: Failing tests** against `fakeGit` (an in-memory map of commits): `save` happy path creates exactly one commit with the trailer; **save rejects stale sha** → 409; **save validates the whole set** (removing a tool that a project names → 422 with the issue); **save maps 422 non-fast-forward to 409** (fake throws `GitConflict`); `upload` of 6 MB image → 413; **sniff**: PNG/JPEG/WebP/PDF magic → type, `<svg` and `<html` → null, and `upload` of those → 415; `upload` numbering picks `-4` when `-1..-3` exist; slug `../../x` → `x`; **revert refuses when file moved on**; revert of an add deletes the file.
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement `sniff.ts`, `fake-github.ts`, `service.ts`, `github.ts`.
- [ ] **Step 4:** `npm test` → passes.
- [ ] **Step 5:** Commit `Read and commit content through the GitHub API`.

### Task 6: API routes, guard, headers, version

**Files:**
- Create: `lib/edit/guard.ts`, `lib/edit/guard.test.ts`, `app/api/edit/content/route.ts` (GET → `Loaded` minus `publicFiles` noise + schemas' file list), `app/api/edit/content/[file]/route.ts` (PUT `{data, sha, message?}`), `app/api/edit/upload/route.ts` (POST multipart: `file`, `dir`, `slug` | `resume=1`), `app/api/edit/history/route.ts`, `app/api/edit/revert/route.ts` (POST `{sha}`), `app/api/version/route.ts`, `proxy.ts`
- Modify: `app/robots.ts` (disallow `/edit`, `/api/edit`), `Dockerfile` (the builder does `RUN touch .build-sha`; the runner copies `.build-sha`), `.gitignore` (`.build-sha`)

**Interfaces — Produces:**
```ts
// guard.ts
export type Guarded = { ok: true; cfg: EditConfig; session: Session } | { ok: false; res: Response }
export async function guard(req: Request, opts: { mutate: boolean }, env?: Record<string,string|undefined>, now?: number): Promise<Guarded>
```
`guard`: no config → 404; a mutation whose `Origin` ≠ `cfg.origin` → 403; no or invalid session → 401; `session.userId !== cfg.allowedUserId` → 403. Every response gets `Cache-Control: no-store`.
`proxy.ts` matcher `['/edit/:path*', '/edit']`: generates a nonce and sets `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-X' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://github.com`, plus `X-Frame-Options: DENY`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, and passes `x-nonce` to the page. If the proxy would touch any other route, it's out of scope and the matcher is wrong.
`/api/version`: `{ sha }` read from `.build-sha` at the working directory (or `'dev'`), `force-dynamic`, no-store.

- [ ] **Step 1: Failing tests** in `guard.test.ts`: missing env → 404; POST with `Origin: https://evil.example` → 403; valid session cookie + GET → ok; session for another user id → 403; expired → 401.
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement the guard, the routes (each is `guard` → `githubGit(session.token)` → service → JSON), `proxy.ts`, robots, the Dockerfile and `/api/version`.
- [ ] **Step 4:** `npm test && npm run build`. Then `npm run start` with no `EDIT_*` → `curl -I /edit` and `/api/edit/content` → 404; with dummy env → `/api/edit/content` 401, and a POST with a foreign Origin → 403.
- [ ] **Step 5:** Commit `Serve the editor API behind a session and origin guard`.

### Task 7: Static prototype of the editor

**Files:** Create `prototype/edit.html` (self-contained, tokens from DIRECTION.md, sample Projects section with a list, an open item, the tool picker, the image strip, an inline error, the save bar and the status strip; phone layout under 720px).

- [ ] **Step 1:** Build it.
- [ ] **Step 2:** `node scripts/shot.mjs file://$PWD/prototype/edit.html --w 1440 --h 900` and `--w 390 --h 844`. Look at both, fix anything that reads as a wireframe, and check that accent use is ≈5%.
- [ ] **Step 3:** Commit `Prototype the editor in static HTML`.

### Task 8: The editor UI

**Files:**
- Create: `content/edit.ts` (all editor copy), `app/edit/page.tsx` (server: `editConfig` null → `notFound()`; no session → sign-in screen; otherwise render `<Editor>`), `app/edit/edit.css`, `components/edit/editor.tsx` (state, section switcher, save/status/history), `components/edit/field.tsx` (renders any `Field` recursively), `components/edit/list.tsx` (add/remove/move/duplicate, with inline delete confirmation), `components/edit/picker.tsx` (tool ref and file picker + upload)
- Client validation reuses `check` + `validateSet` (pure; fileExists = the loaded public file list plus this session's uploads).

Behaviour: load `/api/edit/content` once; each section keeps `{data, sha, dirty}`; Save is disabled while there are issues ("Fix 2 issues"); after a save, poll `/api/version` every 10s until it equals the new commit (Live) or 10 min pass (Build failed?); a 409 shows "Changed elsewhere, reload" with a Reload button; `beforeunload` guard while anything is dirty; History tab lists commits with Revert. On phone, the sidebar becomes a `<select>`.

- [ ] **Step 1:** Build it against the prototype.
- [ ] **Step 2:** `npm run build`, then run the editor-chunk isolation check (Task 10's command) → `/` and `/canvas` clean.
- [ ] **Step 3:** Run locally with a dev GitHub App if available. Otherwise use a `EDIT_DEV_FAKE=1` mode that swaps `githubGit` for `fakeGit` seeded from the working tree and a fixed session. It's **only honoured when `NODE_ENV !== 'production'`** and is tested in `guard.test.ts` as ignored in production. Screenshot `/edit` at 1440 and 390; edit a project, see the inline error, save, and see the commit in the fake's log.
- [ ] **Step 4:** Commit `Build the editor from the content schemas`.

### Task 9: Deploy from `main`

**Files:** Create `deploy/watch.sh`, `deploy/portfolio-watch.service`, `deploy/portfolio-watch.timer`, `deploy/setup.sh`, `deploy/README.md`

`watch.sh` (runs on the server as the user): `cd $APP_DIR` (default `~/staging/apps/portfolio-redesign`); `flock` so runs never overlap; refuse if `git status --porcelain` shows tracked changes; `git fetch origin main`; if `HEAD == origin/main`, exit 0; otherwise `git merge --ff-only origin/main`, `git rev-parse HEAD > .build-sha`, `~/staging/bin/stagectl deploy portfolio-redesign`, then `docker image prune -f --filter label=...`. Because stagectl doesn't label images, it removes dangling images **only** when their parent repo tag was `stage-portfolio-redesign`, via `docker images --filter dangling=true --format '{{.ID}} {{.Repository}}'`. Dangling images have no repo, so instead record the old image ID before the build and `docker rmi` it after a successful deploy if nothing uses it. Log to `~/.local/state/portfolio-watch.log`.
`setup.sh`: moves the rsynced dir aside (`.pre-git-<date>`, keeping `.env.local`), `git clone`s the public repo into place, copies `.env.local` back, installs and enables the user units. It prints each step and requires `--yes`.

- [ ] **Step 1:** Write the scripts; `bash -n` and `shellcheck` if present.
- [ ] **Step 2:** Dry-run `watch.sh` locally against a scratch clone with `STAGECTL=echo` to confirm it no-ops when up to date and deploys once when behind.
- [ ] **Step 3:** Commit `Deploy the site from main on a timer`. The server setup itself is **not** run by the agent. It's handed to Aahil, because it replaces a live service's directory.

### Task 10: Agent skill, docs, bundle check

**Files:**
- Create: `.claude/skills/update-content/SKILL.md`, `scripts/check-bundles.mjs` (gsap check + editor check in one script, `npm run check:bundles`)
- Modify: `CLAUDE.md` (Content section: JSON + `/edit` + the skill; the deploy-by-push rule), `README.md`, `.env.example` (the `EDIT_*` block with GitHub App setup values)

The skill: when asked to change site content → edit `content/data/<file>.json` (never the wrappers), with the schema in `content/schema/` as the field reference → `npm run content:check` → `npm run build` → screenshot the affected page → commit with the trailer `Edited-via: claude` → push `main` only when the user said to publish (the timer deploys it) → report the commit and "live in ~3 min".

- [ ] **Step 1:** Write the files; run `npm run check:bundles` → `/ LOADS GSAP`, `/canvas clean`, `editor: absent from / and /canvas`.
- [ ] **Step 2:** Final gate: `npm test && npm run check && npm run build && npm run check:bundles`.
- [ ] **Step 3:** Commit `Document the editor and give agents the same path`.
