# portfolio-canvas

Aahil Khan's portfolio: a scrolling front page and an infinite-canvas desktop.
Live at [aahil-khan.xyz](https://aahil-khan.xyz).

## Building on this

The code is [MIT licensed](LICENSE), and I'd love for you to build on it. As inspiration, though,
not as a template: twice now, someone has cloned the whole site, swapped in their own content and
shipped it with the design unchanged. Credit is welcome, but it doesn't turn a 1:1 copy into
something else.

**Welcome:**

- Reading the code to learn how something works.
- Lifting the canvas engine, the pan/zoom, the dock, the window system, the `/edit` editor or the
  scripts into your own project.
- Taking the idea of a desktop style portfolio and making it yours, even I didn't come up with this idea lol, taking inspiration is always fine.

**Please don't:** clone the site, swap in your own content and ship it with the same layout, hero,
themes and copy structure. Even with credit, that's still a copy of my site.

**If you start from a fork,** make the visual identity your own (the colours, the type, the front
page's layout) and keep a credit line in your footer or README, such as "Design inspired by
[aahil-khan.xyz](https://aahil-khan.xyz)".

My name, photos, résumé, project write-ups, the copy in `content/data/` and my images in `public/`
aren't covered by the MIT licence at all. [NOTICE](NOTICE) has the details.

## Updating the site

- **Content** (projects, jobs, awards, bio, archive, now, writing, tools, front-page copy,
  screenshots, résumé): open **`/edit`** on the live site and sign in with GitHub. Each save is one
  commit to `main` and is live in about three minutes. From a Claude session, ask for the change —
  the `update-content` skill edits the same files the same way.
- **Code:** push to `main` (or merge a PR). Vercel deploys `main` on its own, and it's live in a
  couple of minutes.

## Running it locally

Needs Node 22.6 or newer (the tests run `.ts` directly via `--experimental-strip-types`).

```bash
npm ci
npm run dev                     # http://localhost:3000
EDIT_DEV_FAKE=1 npm run dev     # the same, with a signed-in /edit over an in-memory repo
```

Build, lint, tests and the other checks are listed under [Commands in CLAUDE.md](CLAUDE.md#commands).
