/**
 * The instrument registry's schemas: one entry per instrument, checking the shape of its figure
 * data (`lab-figures.json`). Contract: `content/lab/API.md` §1 (`Figure`) and §6.
 *
 * Empty in PR 2. PR 11 (instruments) fills it, and from then `validateLab` also refuses an
 * instrument or figure name that is not registered. Until then a name is checked only for being
 * there, and figure data only for being an object.
 *
 * Plain TypeScript with no imports beyond types, so Node runs it with `--experimental-strip-types`.
 */

/** Checks one figure's `data`; returns one message per problem, or none. */
export type InstrumentSchema = (data: Record<string, unknown>) => string[]

export const INSTRUMENT_SCHEMAS: Readonly<Record<string, InstrumentSchema>> = {}
