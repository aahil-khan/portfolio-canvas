## At 90% a run, pass^5 is 59%

Say one run of a task succeeds nine times in ten. Over five runs, the chance that at least one succeeds is 99.999%: that’s pass@5, and it says the agent can do the task. The chance that all five succeed is 0.9 to the fifth, about 59%: that’s pass^5, and it says whether a customer who comes back five times gets five good answers. ==Same agent, same task, 41 points apart.==

pass@k suits a tool where a person picks the best of several tries. An agent that acts on its own gets one try per customer, so pass^k is the one to report.[^twp]

## Five runs make a rate, and a rate needs an interval

Five runs out of five isn’t proof of 100%. With so few trials, a [[t:wilson-interval|Wilson interval]] on the pass rate is wide: for five in five it runs from about 57% to 100%, and saying so is more honest than the point score. When two versions run on the same tasks, [[t:mcnemar|McNemar’s test]] looks only at the tasks that flipped between them, and asks whether they flipped one way more than chance would.

The study’s first build used all three: it ran [[holt|Holt]]’s verdicts for consistency, scored with pass^3, Wilson intervals and McNemar’s test. [[shopkeeper-05|The Shopkeeper]] is stricter still: a B scenario passes only on pass^5, five runs out of five.
