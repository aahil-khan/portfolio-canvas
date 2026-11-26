---
kind: experiment
number: 1
short: Three-shot or rubric judge
title: Does a three-shot prompt beat a rubric judge on 200 traces?
line: Fixture experiment: the question as the title, the result first, then the setup and the caveat.
audience: For anyone choosing how to grade agent transcripts.
status: written up
published: 2026-11-25
updated: 2026-11-25
tags: [evals]
listen: true
links: [plain-retrieval-note]
---

:::artifact table | E1 · Retrieval quality | Agreement with human labels, 200 traces
| Grader | Agreement | False passes |
| --- | --- | --- |
| Three-shot prompt | 0.81 | 14 |
| Rubric judge | 0.86 | 9 |
:::

The rubric judge agreed with the human labels more often, and let fewer bad transcripts through, on this one fixture set of two hundred traces. These numbers are placeholders that exist so the page type can be checked; they are not a result.

## The setup behind the fixture numbers

Two graders read the same two hundred transcripts. One saw three worked examples, the other a five-line rubric with a yes or no per line. A person labelled every transcript first, without seeing either grader's verdict, and agreement is measured against that label.

## Why one run proves very little here

One set, one afternoon, one labeller. The gap between the graders is smaller than the noise you would expect from a second labeller, so the honest reading is that the rubric is not worse, not that it is better.
