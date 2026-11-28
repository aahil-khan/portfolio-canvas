import type { CSSProperties } from 'react'

/**
 * A stagger index for `[data-draw]` (instruments.css), as the inline custom property the CSS
 * reads: the nth piece of a lead starts 30ms after the one before. The CSS caps the stagger, so a
 * long list never keeps its last rows waiting. Plain module, so server components can call it.
 */
export const at = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties
