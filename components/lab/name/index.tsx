import { NameTip } from '@/components/lab/name/name-tip'
import { getLab } from '@/lib/lab/content'

import './name.css'

/**
 * His name (API.md §6), wherever a Lab page says it. The first word, "Aahil", is the one with a
 * voice: double-underlined, and once the page's script runs, a button whose tooltip shows it in
 * Devanagari and Arabic script beside a voice bubble that says it (`NameTip`). The rest of the
 * name follows as plain text.
 *
 * A server component, so the tooltip's words come from `content/data/lab.json` (`copy.name*`)
 * without a caller passing them: render it from server components only.
 */
export function Name({ name }: { name: string }) {
  const { copy } = getLab()
  const [first, ...rest] = name.trim().split(/\s+/)
  return (
    <>
      <NameTip
        word={first}
        labels={{
          tip: copy.nameTipLabel,
          devanagari: copy.nameDevanagari,
          arabic: copy.nameArabic,
          say: copy.nameSay,
          sayLabel: copy.nameSayLabel,
        }}
      />
      {rest.length ? ` ${rest.join(' ')}` : null}
    </>
  )
}
