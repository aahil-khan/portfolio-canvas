## A task is the question; a trial is one attempt at it

A task is one thing the agent is asked to do, with a known good end to check against. A trial is one run of it. Agents don’t answer the same way twice, so a task gets several trials and the score belongs to the task, not to any one run. How to turn those runs into a number is [[t02|the next note]].

A grader looks at a trial and says pass or fail. Some graders are code: compare a field, run a test, check the final state. Some are a model reading the output, an [[t:llm-judge|LLM judge]], for what code can’t check. Choosing between them check by check is a [[t:code-grader|topic of its own]] on the board.[^anthropic]

## The transcript is evidence; the outcome is what gets graded

The transcript is everything the agent said and called on the way. The outcome is the state of the world when it stopped: the order placed, the file written, the price agreed. ==Grade the outcome.== An agent that took an odd route to the right end state did the job. A grader that insists on one path fails good runs, and tells you nothing about the ones that went wrong.

The transcript still earns its keep. When a trial fails, it’s where you find out why, which is what [[t:error-analysis|error analysis]] is for. In [[shopkeeper-05|the Shopkeeper’s pricing chapter]], the agreed price is the outcome, and the tool calls are the transcript.

The harness is the loop around all of it: load the tasks, run the trials, call the graders, keep the transcripts. It’s plumbing, and it decides how cheaply everything can be run again, which matters once every task runs five times.
