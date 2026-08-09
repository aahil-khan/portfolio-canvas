import { type DeskProp, props } from '@/content/props'

/**
 * The notes left on the desk. Server-rendered, inert, and never in anyone's way.
 *
 * No `data-obj`, so the canvas treats a press on one as a press on the background and keeps
 * panning. No entry in `takenRects`, so a note never shifts where a card lands and never drags
 * the framing out when you fit everything.
 *
 * The pads keep their own colours on every theme, the way `apps.ts` keeps the per-card pastels:
 * a pad of notes does not restyle itself to match the desk it is lying on. The text is dark on
 * all four tints, so that holds in a dark room too.
 */
function Note({ p }: { p: DeskProp }) {
  const style = { left: p.x, top: p.y, ['--rot' as string]: `${p.rotate ?? 0}deg` }

  if (p.glyph) {
    return (
      <div
        className="prop prop--sticky prop--glyph"
        data-tint={p.tint ?? 'yellow'}
        style={style}
        aria-hidden
      >
        {p.glyph}
      </div>
    )
  }

  const [label, body] = p.lines ?? ['', '']
  return (
    <div className="prop prop--sticky" data-tint={p.tint ?? 'yellow'} style={style} aria-hidden>
      <b>{label}</b>
      {body}
    </div>
  )
}

export function DeskProps() {
  return (
    <>
      {props.map((p) => (
        <Note key={p.id} p={p} />
      ))}
    </>
  )
}
