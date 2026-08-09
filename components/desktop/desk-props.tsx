import { type DeskProp, props } from '@/content/props'

/**
 * The things left on the desk. Server-rendered, inert, and never in anyone's way.
 *
 * No `data-obj`, so the canvas treats a press on one as a press on the background and keeps
 * panning. No entry in `takenRects`, so a prop never shifts where a card lands and never drags
 * the framing out when you fit everything.
 *
 * Which of them follow the theme and which do not is the same split `apps.ts` already makes for
 * the per-card pastels: the paperclip is drawn from `--ink` so it reads on all eighteen
 * themes, while the notes and the pencil keep their own colours — a yellow pencil is yellow in a
 * dark room too, and a pad of notes does not restyle itself to match the desk.
 */
function Prop({ p }: { p: DeskProp }) {
  const style = {
    left: p.x,
    top: p.y,
    ['--rot' as string]: `${p.rotate ?? 0}deg`,
  }

  if (p.kind === 'sticky') {
    const [label, body] = p.lines ?? ['', '']
    return (
      <div className="prop prop--sticky" data-tint={p.tint ?? 'yellow'} style={style} aria-hidden>
        <b>{label}</b>
        {body}
      </div>
    )
  }

  if (p.kind === 'pencil') {
    return (
      <div className="prop prop--pencil" style={style} aria-hidden>
        <svg viewBox="0 0 150 14" width="150" height="14" fill="none">
          <rect x="18" y="1" width="118" height="12" rx="2" fill="#FFD84D" stroke="#161616" strokeOpacity=".4" strokeWidth="1.4" />
          <path d="M18 1 4 7l14 6z" fill="#F0DCC0" stroke="#161616" strokeOpacity=".4" strokeWidth="1.4" />
          <path d="M9 4.4 4 7l5 2.6z" fill="#3b3320" />
          <rect x="136" y="1" width="12" height="12" rx="2" fill="#FFB4A2" stroke="#161616" strokeOpacity=".4" strokeWidth="1.4" />
        </svg>
      </div>
    )
  }

  return (
    <div className="prop prop--clip" style={style} aria-hidden>
      <svg viewBox="0 0 34 70" width="34" height="70" fill="none" stroke="currentColor"
        strokeWidth="3.4" strokeLinecap="round">
        <path d="M11 56V15a6 6 0 0 1 12 0v42a10 10 0 0 1-20 0V19" />
      </svg>
    </div>
  )
}

export function DeskProps() {
  return (
    <>
      {props.map((p) => (
        <Prop key={p.id} p={p} />
      ))}
    </>
  )
}
