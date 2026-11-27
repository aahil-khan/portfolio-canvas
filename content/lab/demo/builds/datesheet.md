## A schedule that lived in the session died with a page refresh

The Datesheet generator builds Thapar University’s exam timetable, and I worked on its backend from March to July 2025. It kept the work in [[t:session-state|session state]], so a timetable in progress lived only as long as one visit: a page refresh, or a dropped connection, and it was gone.

The fix was the unglamorous one: move the workflow into MySQL, so every step is a row that outlives the tab. Once the state was durable, the rest followed from it: sign-in, several people working at once, and [[t:savepoint|savepoints]], so a half-built timetable resumes where it stopped instead of starting over.

## Scheduling errors fell by 40% once generation was rebuilt on it

With the workflow persistent, the generation steps could be reworked too, and scheduling errors came down by 40%. The university’s records live in [[t:peoplesoft|Oracle PeopleSoft]], so the last piece was automating the import and export between it and the new system.

It’s the oldest build here and the plainest: Python and MySQL, with no model anywhere in it.
