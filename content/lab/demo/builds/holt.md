## Whether a repo merges outsiders is in its pull requests, not its README

Holt answers one question before you spend a weekend on a first pull request: will this repository actually merge it? It reads the repo’s recent pull requests. Do people outside the team get replies, and does their work get merged?[^site] From that it gives one of six [[t:holt-verdict|verdicts]], in words: worth your time, a long shot, not worth your time, not enough evidence, a personal project, or a list rather than code.

The verdict comes from fixed rules over GitHub’s own data, not from a model’s opinion. That was a choice, and the benchmark is why.

## Fixed rules scored an MCC of 0.61 to 0.63, against 0.32 for one LLM prompt

On a custom benchmark, Holt’s rules reach a [[t:mcc|Matthews correlation coefficient]] of 0.61 to 0.63. A single-prompt LLM baseline, asked the same question, gets 0.32. MCC runs from −1 to 1, with 0 no better than a coin, and it doesn’t reward a classifier for saying yes to everything, which accuracy would. That makes it the fair number for a [[tag:evals|yes-or-no call]] like this one.

::figure{of="chart-holt"}

It started as a simple CLI, grew into a TUI, and shipped as a web app with a FastAPI backend, a browser extension and the Python CLI beside it.[^repo] More than 10,000 repositories have been analysed and over 12,600 reports generated in production, and it won the Most Useful Real World Workflow Award.
