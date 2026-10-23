# portfolio-canvas

Aahil Khan's portfolio: a scrolling front page and an infinite-canvas desktop.
Live at [aahil-khan.xyz](https://aahil-khan.xyz).

## Using this code

The code is [MIT licensed](LICENSE). You're welcome to learn from it, borrow pieces, or fork it.

If you reskin or build on the site, **please credit it**: a line in your footer or README such as
"Design inspired by [aahil-khan.xyz](https://aahil-khan.xyz)" is all I ask. Please don't lift the
layout, hero and README wholesale and ship it as your own. That's the one thing I'd rather you
didn't do, and it's what the credit is for.

What is not part of the licence: my name, photos, résumé, project write-ups and all the copy in
`content/data/`. Those are mine. Swap in your own.

## Updating the site

- **Content** (projects, jobs, awards, bio, archive, now, writing, tools, front-page copy,
  screenshots, résumé): open **`/edit`** on the live site and sign in with GitHub. Each save is one
  commit to `main` and is live in about three minutes. From a Claude session, ask for the change —
  the `update-content` skill edits the same files the same way.
- **Code:** push to `main`. The server deploys `main` on its own — see `deploy/README.md`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
