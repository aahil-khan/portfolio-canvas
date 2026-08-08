/**
 * Canvas maths. Deliberately pure — no React, no DOM — so it can be reasoned about and tested
 * on its own. The React layer only decides *when* to call these.
 */

export interface Camera {
  x: number
  y: number
  s: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const MIN_SCALE = 0.35
export const MAX_SCALE = 2.0

/**
 * Framing is allowed to zoom out past the interactive floor.
 *
 * `MIN_SCALE` exists to stop someone wheeling the world into uselessness. But "fit all" is an
 * explicit request to see everything, and clamping it to 0.35 is what made large arrangements
 * clip off screen: once a layout needed, say, 0.22 to fit, the clamp handed back 0.35 and the
 * edges simply overflowed the viewport with no way to reach them.
 */
export const FIT_MIN_SCALE = 0.06

/** World px of breathing room required around every card when auto-placing. */
export const GUTTER = 30

/**
 * The zoom at which card text is comfortable to read. Body copy is 15px, so this is ~13.5px on
 * screen — close enough to design size without snapping all the way to 1:1 every time a card
 * opens. Revealing a card zooms in to at most this.
 */
export const READABLE_SCALE = 0.9

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

export const screenToWorld = (cam: Camera, px: number, py: number) => ({
  x: (px - cam.x) / cam.s,
  y: (py - cam.y) / cam.s,
})

/**
 * Zoom about a screen point so the world pixel under the cursor stays exactly put.
 * Getting this wrong is the classic canvas bug — the content drifts away from the pointer.
 */
export function zoomAt(cam: Camera, px: number, py: number, nextScale: number): Camera {
  const s = clampScale(nextScale)
  if (s === cam.s) return cam
  const wx = (px - cam.x) / cam.s
  const wy = (py - cam.y) / cam.s
  return { s, x: px - wx * s, y: py - wy * s }
}

/**
 * `deltaY` is not comparable across devices — a trackpad pinch emits ~1-10 per event, a mouse
 * notch 100-300. Clamp first, then exponentiate, or one mouse notch slams into the zoom limit.
 */
export const wheelToScale = (scale: number, deltaY: number) =>
  scale * Math.exp(-Math.max(-50, Math.min(50, deltaY)) * 0.0035)

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const inflate = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  w: r.w + by * 2,
  h: r.h + by * 2,
})

/**
 * Spiral outward from a preferred point until a w×h rectangle hits nothing.
 *
 * Rings are elliptical (1.6:1) because viewports are wider than they are tall, so spreading
 * sideways keeps more of the arrangement on screen. Each ring's start angle is rotated, or
 * cards march out along one axis and the result reads as a diagonal line rather than a cluster.
 */
export function findFreeSpot(
  w: number,
  h: number,
  prefer: { x: number; y: number },
  taken: readonly Rect[],
  gutter = GUTTER,
): { x: number; y: number } {
  const boxes = taken.map((t) => inflate(t, gutter))
  const free = (x: number, y: number) => !boxes.some((b) => overlaps({ x, y, w, h }, b))

  let x = prefer.x - w / 2
  let y = prefer.y - h / 2
  if (free(x, y)) return { x, y }

  const STEP = 70
  for (let ring = 1; ring <= 40; ring++) {
    const samples = 10 + ring * 4
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2 + ring * 0.7
      x = prefer.x + Math.cos(a) * ring * STEP * 1.6 - w / 2
      y = prefer.y + Math.sin(a) * ring * STEP - h / 2
      if (free(x, y)) return { x, y }
    }
  }
  return { x, y }
}

/** A random free position strictly inside `rect`. Returns null when it can't fit. */
export function findFreeSpotInRect(
  w: number,
  h: number,
  rect: Rect,
  taken: readonly Rect[],
  rand: () => number,
  tries = 600,
  gutter = GUTTER,
): { x: number; y: number } | null {
  const boxes = taken.map((t) => inflate(t, gutter))
  const free = (x: number, y: number) => !boxes.some((b) => overlaps({ x, y, w, h }, b))
  const spanX = rect.w - w
  const spanY = rect.h - h
  if (spanX < 0 || spanY < 0) return null
  for (let i = 0; i < tries; i++) {
    const x = rect.x + rand() * spanX
    const y = rect.y + rand() * spanY
    if (free(x, y)) return { x, y }
  }
  return null
}

export interface Viewport {
  width: number
  height: number
  top: number
  bottom: number
}

/**
 * Camera that brings `target` fully on screen and readable.
 *
 * Pans if that's enough, zooms OUT if the card is too big for the viewport, and zooms IN if you
 * were far enough out that the card would arrive unreadable. That last case was the original
 * behaviour's blind spot: it only ever zoomed out, on the theory that arriving closer than you
 * were is disorienting — true in general, useless when the thing you just asked for lands as
 * illegible 40%-scale text.
 *
 * It stops at READABLE rather than going to 1:1, so it's a nudge toward the card rather than a
 * jump, and it never zooms in past the point where the card still fits.
 */
export function revealCamera(cam: Camera, target: Rect, vp: Viewport, pad = 44): Camera {
  const availW = vp.width - pad * 2
  const availH = vp.height - vp.top - vp.bottom - pad * 2

  let { s, x, y } = cam
  // the largest scale at which the whole card still fits the usable band
  const fits = Math.min(availW / target.w, availH / target.h)
  // where we'd like to end up: readable, but never larger than the card can fit
  const wanted = clampScale(Math.min(fits, READABLE_SCALE))

  if (fits < s || s < wanted) {
    s = fits < s ? clampScale(fits) : wanted
    // rescale about the viewport centre first; the pan below then frames the card
    const wx = (vp.width / 2 - cam.x) / cam.s
    const wy = (vp.height / 2 - cam.y) / cam.s
    x = vp.width / 2 - wx * s
    y = vp.height / 2 - wy * s
  }

  const L = target.x * s + x
  const T = target.y * s + y
  const R = L + target.w * s
  const B = T + target.h * s
  let dx = 0
  let dy = 0
  if (L < pad) dx = pad - L
  else if (R > vp.width - pad) dx = vp.width - pad - R
  if (T < vp.top + pad) dy = vp.top + pad - T
  else if (B > vp.height - vp.bottom - pad) dy = vp.height - vp.bottom - pad - B

  return { x: x + dx, y: y + dy, s }
}

/** Camera that centres one rect in the usable band, capped so it never zooms past 1.5. */
export function focusCamera(target: Rect, vp: Viewport, pad = 64): Camera {
  const bandH = vp.height - vp.top - vp.bottom
  const s = clampScale(
    Math.min(1.5, (vp.width - pad * 2) / target.w, (bandH - pad * 2) / target.h),
  )
  return {
    s,
    x: vp.width / 2 - (target.x + target.w / 2) * s,
    y: vp.top + bandH / 2 - (target.y + target.h / 2) * s,
  }
}

/** Camera that frames every rect. Never zooms past 1:1 — "fit" reveals layout, not magnifies. */
export function fitCamera(rects: readonly Rect[], vp: Viewport, pad = 56): Camera | null {
  if (!rects.length) return null
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const maxY = Math.max(...rects.map((r) => r.y + r.h))
  const bandH = vp.height - vp.top - vp.bottom
  const s = Math.min(
    1,
    Math.max(
      FIT_MIN_SCALE,
      Math.min(
        (vp.width - pad * 2) / Math.max(1, maxX - minX),
        (bandH - pad * 2) / Math.max(1, maxY - minY),
      ),
    ),
  )
  return {
    s,
    x: vp.width / 2 - ((minX + maxX) / 2) * s,
    /*
     * Centre in the USABLE band, not the raw viewport. The scale above already excludes the
     * fixed top pill and dock, so centring on `vp.height / 2` pushed the layout down by half
     * the difference between the two bands and tucked the bottom row under the dock.
     */
    y: vp.top + bandH / 2 - ((minY + maxY) / 2) * s,
  }
}

/**
 * Deterministic PRNG (mulberry32). The opening layout is random per visit but must be
 * reproducible within a render pass, and `Math.random()` during SSR would cause a hydration
 * mismatch. Seeded on the client after mount instead.
 */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
