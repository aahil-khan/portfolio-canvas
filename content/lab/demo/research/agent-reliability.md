## The study is a syllabus I wrote myself, in eight tracks

I wanted to know how AI agents fail and how you catch them at it, so I wrote myself a syllabus. It runs in eight tracks: [[tag:evals|evals]] and [[t:error-analysis|error analysis]] first, then tracing, reliability, latency, voice agents, guardrails against things like [[t:prompt-injection|prompt injection]], deployment, and open source. Each topic is one line of what to learn, an estimate, and one resource to learn it from. The board above is that list, one square a topic.

It runs in phases, in order. The first is the evals core, because every later track needs a way to tell whether a change helped. Topics that can wait are parked rather than deleted, and they show faint on the board, so the gaps stay visible.

## A session is one resource, read, written up by hand, then recalled

A session goes the same way each time: read the topic’s resource, take notes by hand, then check what stuck with a quiz or a recall pass. The log below lists every session with what it did. When a topic calls for building something, the build goes in the log too: the first one scored [[holt|Holt]]’s verdicts for consistency, with [[t:pass-k|pass^3]] and a [[t:wilson-interval|Wilson interval]].

## Each finished topic becomes a note, and a project tests them

A finished topic gets a short note: [[t01|Eval anatomy]] is the first, and [[t02|the one on pass^k]] the second. The topics get tested on a real project, [[shopkeeper|The Shopkeeper]]: an agent that haggles and must never sell below a secret price, specified eval-first before any of it runs. Its chapter on [[shopkeeper-05|keeping the floor price out of the agent’s context]] is where the evals core meets the guardrails track.
