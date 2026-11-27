// Entry bodies for the agent-reliability study and its notes (T01, T02). Format: the parent's
// writers' contract (inline markup as in content/copy.js; P = proposed, S = from a source).
var Lab = window.Lab = window.Lab || {};
(function () {
  function P(text, where, reason) { return { text: text, proposal: true, where: where, reason: reason }; }
  function S(text, source) { return { text: text, source: source }; }

  Object.assign(Lab.copy, {
    'passk.p': P('Chance one run succeeds:', 'Note T02, the slider’s label', 'Names the one input'),
    'passk.at': P('pass@k', 'Note T02 figure, the first value', ''),
    'passk.hat': P('pass^k', 'Note T02 figure, the second value', ''),
    'passk.atKey': P('pass@k: at least one of k runs succeeds', 'Note T02 figure, the key', ''),
    'passk.hatKey': P('pass^k: all k runs succeed', 'Note T02 figure, the key', ''),
  });

  // Terms. Definitions are adapted wording; COPY.md lists them for veto.
  // its glossary terms live in content/terms.js

  var ANTHROPIC = { title: 'Demystifying evals for AI agents', site: 'Anthropic Engineering · 9 Jan 2026',
    line: S('Capability evals “should start at a low pass rate, targeting tasks the agent struggles with.”', 'the article, quoted'),
    url: 'https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents' };
  var TWP = { title: 'how to do agentic evals', site: 'the working prototype · 9 Apr 2026',
    line: S('“For reliable agents in production, pass^k is what we should worry about.”', 'the article, quoted'),
    url: 'https://theworkingprototype.substack.com/p/how-to-do-agentic-evals' };

  var STUDY = 'Study page';
  var T01 = 'Note T01';
  var T02 = 'Note T02';

  Object.assign(Lab.bodies, {
    'agent-reliability': {
      leadIntro: Lab.copy['board.intro'],
      pull: 'Topics that can wait are parked rather than deleted, and they show faint on the board, so the gaps stay visible.',
      blocks: [
        { h2: P('The study is a syllabus I wrote myself, in eight tracks', STUDY + ', first heading', 'States what the study is') },
        { p: P('I wanted to know how AI agents fail and how you catch them at it, so I wrote myself a syllabus. It runs in eight tracks: [[tag:evals|evals]] and [[t:error-analysis|error analysis]] first, then tracing, reliability, latency, voice agents, guardrails against things like [[t:prompt-injection|prompt injection]], deployment, and open source. Each topic is one line of what to learn, an estimate, and one resource to learn it from. The board above is that list, one square a topic.', STUDY, 'adapted from the tracker: its tracks, and the columns What to learn, the hour estimates and Resource') },
        { p: P('It runs in phases, in order. The first is the evals core, because every later track needs a way to tell whether a change helped. Topics that can wait are parked rather than deleted, and they show faint on the board, so the gaps stay visible.', STUDY, 'adapted from the tracker’s Phase column: Phase 1 · Evals core, and Parked') },
        { h2: P('A session is one resource, read, written up by hand, then recalled', STUDY, 'States how a session runs, from the log') },
        { p: P('A session goes the same way each time: read the topic’s resource, take notes by hand, then check what stuck with a quiz or a recall pass. The log below lists every session with what it did. When a topic calls for building something, the build goes in the log too: the first one scored [[holt|Holt]]’s verdicts for consistency, with [[t:pass-k|pass^3]] and a [[t:wilson-interval|Wilson interval]].', STUDY, 'adapted from the tracker’s Log: handwritten notes, quiz, recall check; Build 1, Holt verdict consistency') },
        { h2: P('Each finished topic becomes a note, and a project tests them', STUDY, 'States what the study produces') },
        { p: P('A finished topic gets a short note: [[t01|Eval anatomy]] is the first, and [[t02|the one on pass^k]] the second. The topics get tested on a real project, [[shopkeeper|The Shopkeeper]]: an agent that haggles and must never sell below a secret price, specified eval-first before any of it runs. Its chapter on [[shopkeeper-05|keeping the floor price out of the agent’s context]] is where the evals core meets the guardrails track.', STUDY, 'adapted from the tracker’s portfolio note and the spec; links the study to its notes and series') },
      ],
    },

    t01: {
      meta: {
        updated: '2026-11-27',
        lede: P('An eval has five working parts: [[t:eval-task|tasks]], [[t:eval-trial|trials]], [[t:grader|graders]], the [[t:transcript-outcome|transcript and the outcome]], and the [[t:eval-harness|harness]] that runs them.', T01 + ', the lede', 'adapted from the tracker, T01 What to learn'),
      },
      pull: 'An agent that took an odd route to the right end state did the job.',
      blocks: [
        { h2: P('A task is the question; a trial is one attempt at it', T01 + ', first heading', 'States the distinction') },
        { p: P('A task is one thing the agent is asked to do, with a known good end to check against. A trial is one run of it. Agents don’t answer the same way twice, so a task gets several trials and the score belongs to the task, not to any one run. How to turn those runs into a number is [[t02|the next note]].', T01, 'adapted from the tracker, T01 What to learn') },
        { p: P('A grader looks at a trial and says pass or fail. Some graders are code: compare a field, run a test, check the final state. Some are a model reading the output, an [[t:llm-judge|LLM judge]], for what code can’t check. Choosing between them check by check is a [[t:code-grader|topic of its own]] on the board.[^anthropic]', T01, 'adapted from the tracker, T01 and T04, and their resource') },
        { h2: P('The transcript is evidence; the outcome is what gets graded', T01, 'States the note’s claim') },
        { p: P('The transcript is everything the agent said and called on the way. The outcome is the state of the world when it stopped: the order placed, the file written, the price agreed. ==Grade the outcome.== An agent that took an odd route to the right end state did the job. A grader that insists on one path fails good runs, and tells you nothing about the ones that went wrong.', T01, 'adapted from the tracker, T01 What to learn: grade what was produced, not the exact path') },
        { p: P('The transcript still earns its keep. When a trial fails, it’s where you find out why, which is what [[t:error-analysis|error analysis]] is for. In [[shopkeeper-05|the Shopkeeper’s pricing chapter]], the agreed price is the outcome, and the tool calls are the transcript.', T01, 'Ties the note to the series') },
        { p: P('The harness is the loop around all of it: load the tasks, run the trials, call the graders, keep the transcripts. It’s plumbing, and it decides how cheaply everything can be run again, which matters once every task runs five times.', T01, 'adapted from the tracker, T01 What to learn: eval harness') },
      ],
      refs: { anthropic: ANTHROPIC },
    },

    t02: {
      meta: {
        updated: '2026-11-27',
        lede: P('Run each task k times. [[t:pass-at-k|pass@k]] counts it if any run succeeded, [[t:pass-k|pass^k]] only if every run did, and the score is reported with an interval, not as a single number.', T02 + ', the lede', 'adapted from the tracker, T02 What to learn'),
        lead: { instrument: 'passk' },
      },
      leadIntro: P('Move the slider to set how often one run succeeds, and watch the two scores split:', T02 + ', the line above the figure', 'Every interactive lead is introduced by one bold line'),
      leadCaption: P('Arithmetic, not results: for runs that succeed independently with chance p, pass@k is 1 − (1 − p)^k and pass^k is p^k.', T02 + ', under the figure', 'Says plainly that the figure is computed'),
      pull: 'Five runs out of five isn’t proof of 100%.',
      blocks: [
        { h2: P('At 90% a run, pass^5 is 59%', T02 + ', first heading', 'States the arithmetic’s result') },
        { p: P('Say one run of a task succeeds nine times in ten. Over five runs, the chance that at least one succeeds is 99.999%: that’s pass@5, and it says the agent can do the task. The chance that all five succeed is 0.9 to the fifth, about 59%: that’s pass^5, and it says whether a customer who comes back five times gets five good answers. ==Same agent, same task, 41 points apart.==', T02, 'computed: 1 − 0.1^5 and 0.9^5') },
        { p: P('pass@k suits a tool where a person picks the best of several tries. An agent that acts on its own gets one try per customer, so pass^k is the one to report.[^twp]', T02, 'adapted from the tracker, T02, and its resource') },
        { h2: P('Five runs make a rate, and a rate needs an interval', T02, 'States the second half of the topic') },
        { p: P('Five runs out of five isn’t proof of 100%. With so few trials, a [[t:wilson-interval|Wilson interval]] on the pass rate is wide: for five in five it runs from about 57% to 100%, and saying so is more honest than the point score. When two versions run on the same tasks, [[t:mcnemar|McNemar’s test]] looks only at the tasks that flipped between them, and asks whether they flipped one way more than chance would.', T02, 'adapted from the tracker, T02 What to learn and log; the interval computed') },
        { p: P('The study’s first build used all three: it ran [[holt|Holt]]’s verdicts for consistency, scored with pass^3, Wilson intervals and McNemar’s test. [[shopkeeper-05|The Shopkeeper]] is stricter still: a B scenario passes only on pass^5, five runs out of five.', T02, 'adapted from the tracker’s Log, Build 1, and the spec, Repeated runs') },
      ],
      refs: { twp: TWP },
    },
  });
})();
