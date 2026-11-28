---
title: "Datesheet Generator"
type: build
status: done
updated: 2025-07-31
summary: "Re-architected an exam scheduling system that couldn't survive a page refresh."
tags: [shipping, infra]
aliases: [datesheet]
listen: true
visibility: public
stack: [MySQL, Python]
links: {}
source: content/data/experience.json (datesheet); Datesheet-Generator/README.md
---

## 2 · what it is

Re-architected an exam scheduling system that couldn't survive a page refresh.

## 3 · try it

```terminal
$ pip install virtualenv
$ python3 -m venv venv
$ source venv/bin/activate
$ pip install -r requirements.txt
…
$ flask --app main run --debug --port 8080
…
```

## 4 · what broke, what I measured

- Improved the generation workflow, cutting scheduling errors by **40%**.

## 5 · how it's built

- Moved from **session-based state to a persistent MySQL-backed workflow** — the core fix.
- Secure authentication, multi-user support and **savepoints**, so partial work resumes instead of starting over.
- Integrated with **Oracle PeopleSoft** to automate structured data ingestion and export between the legacy system and the new one.
