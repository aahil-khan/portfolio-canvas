---
title: "Holt"
type: build
status: live
updated: 2026-11-20
summary: "Will this repo merge your PR? Find open source projects that will actually merge your first PR."
tags: [open-source, shipping]
aliases: []
listen: true
visibility: public
stack: [Python, FastAPI, Next.js, TypeScript, PostgreSQL, Redis]
links: { live: "https://githolt.com", repo: "https://github.com/holt-oss/holt" }
award: "Most Useful Real World Workflow Award"
images: [/work/screenshot-from-2026-10-12-01-15-50-1.png, /work/screenshot-from-2026-10-12-01-16-37-1.png, /work/screenshot-from-2026-10-12-01-16-57-1.png]
source: content/data/projects.json (holt); the study log, 2026-11-20
---

## 1 · clip

```clip src=holt dur=42
fig · clip · placeholder: a 15–60 s clip goes here
```

## 2 · what it is

Will this repo merge your PR?

Find open source projects that will actually merge your first PR

## 3 · try it

[githolt.com ↗](https://githolt.com)

## 4 · what broke, what I measured

- Achieved an MCC of **0.61–0.63**, outperforming a single prompt LLM baseline (0.32) custom benchmark.
- Analysed **10,000+** repositories and generated **12,600+** reports in production.
- [[T02]], 2026-11-20: Build 1: Holt verdict consistency (pass^3, Wilson, McNemar) + write-up

## 5 · how it's built

- Built an open source tool that analyses GitHub PR history to predict whether repositories welcome outside contributors.
- Shipped a Next.js web app, FastAPI backend, browser extension, and Python CLI/TUI.

```block gallery
```

## 6 · code

[github.com/holt-oss/holt ↗](https://github.com/holt-oss/holt)
