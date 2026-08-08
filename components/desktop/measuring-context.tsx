'use client'

import { createContext, useContext } from 'react'

/**
 * True only while a card body is being rendered inside the hidden measurement rig.
 *
 * `MeasureRig` renders EVERY card once, off-screen, at page load — that is how placement knows a
 * card's height before it exists. The cost is that every effect inside every card body runs at
 * boot, for cards nobody opened, and then again on the real mount. For static cards that is
 * merely wasteful; for interactive ones it is wrong:
 *
 *   - a fetch fires twice per page load, once from a card that is not on screen
 *   - a rAF game loop starts and never stops, because nothing ever unmounts it visibly
 *   - `autoFocus` steals focus into a `visibility: hidden` subtree
 *   - anything measuring its own DOM reads zeroes, because the rig is at `left: -99999`
 *
 * So interactive bodies read this and bail out of their effects while it is true. The rig is the
 * only thing that ever provides `true`; a real card gets the default.
 *
 * A context rather than sniffing for a `[data-measure]` ancestor: it resolves during render
 * instead of after layout, so an effect can skip its own first run rather than undo it.
 */
export const MeasuringContext = createContext(false)

export const useMeasuring = () => useContext(MeasuringContext)
