'use client'

import { useId, useRef, useState } from 'react'

import { profile, site } from '@/content'

/**
 * The About portrait, and the secret behind it.
 *
 * Ten taps on the photo asks a question; one particular answer flips the card. The whole thing
 * is deliberately invisible until you go looking — no hint, no cursor change, nothing in the
 * markup that reads as a control until the question is actually on screen.
 *
 * The egg only arms itself when `profile.portraitHidden` exists, so the component degrades to a
 * plain framed photo (or the placeholder) rather than counting taps toward a reveal that has
 * nothing to reveal.
 *
 * Accessibility: the photo stays presentational and the tap count is a pointer-only affordance —
 * a decorative image should not be in the tab order. The moment the question appears it becomes
 * a real labelled form, and the flipped state is announced, so the *outcome* is reachable even
 * though the trigger is a game.
 */
/**
 * Lowercase, letters only, and runs of a repeated letter collapsed to one.
 *
 *   "  AaLoo! " → "alo"      "aalu" → "alu"      "ALLOO" → "alo"
 *
 * Transliterating आलू has no single right answer — aloo, aaloo, alu, aalu are all fair — and
 * someone typing a joke answer into a hidden prompt should not be graded on spelling. Applied
 * to both sides of the comparison, so the accepted list in content stays human-readable.
 */
const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1')

export function Portrait() {
  const [taps, setTaps] = useState(0)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const egg = site.portraitEgg
  const armed = Boolean(profile.portrait && profile.portraitHidden)

  if (!profile.portrait) {
    return (
      <div className="about__photo about__photo--empty reveal">
        <span>
          {site.about.portraitPending}
          <br />4 : 5
        </span>
      </div>
    )
  }

  const onTap = () => {
    if (!armed || flipped || asking) return
    const next = taps + 1
    setTaps(next)
    if (next >= egg.taps) {
      setAsking(true)
      setTaps(0)
      /* focus lands on the input so a keyboard can finish what a pointer started */
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (egg.answers.some((a) => squash(a) === squash(answer))) {
      setFlipped(true)
      setAsking(false)
      setWrong(false)
      setAnswer('')
    } else {
      setWrong(true)
      setAnswer('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="portrait reveal">
      <div className="portrait__card" data-flipped={flipped ? '1' : '0'}>
        {/* pointer-only by design: a decorative photo should not be in the tab order */}
        <div className="portrait__face portrait__face--front" onClick={onTap}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static asset, fixed 4:5 frame */}
          <img src={profile.portrait} alt={site.about.portraitAlt} />
        </div>

        {profile.portraitHidden ? (
          <div className="portrait__face portrait__face--back">
            {/* eslint-disable-next-line @next/next/no-img-element -- static asset, fixed 4:5 frame */}
            <img src={profile.portraitHidden} alt={egg.hiddenAlt} />
            <p className="portrait__caption">{egg.caption}</p>
          </div>
        ) : null}
      </div>

      {asking ? (
        <form className="portrait__ask" onSubmit={onSubmit}>
          <label htmlFor={inputId}>{egg.question}</label>
          <div className="portrait__row">
            <input
              id={inputId}
              ref={inputRef}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value)
                setWrong(false)
              }}
              autoComplete="off"
              aria-describedby={wrong ? `${inputId}-err` : undefined}
            />
            <button type="submit">{egg.submit}</button>
          </div>
          {/* assertive: the field is cleared on a wrong answer, so silence would be confusing */}
          {wrong ? (
            <p className="portrait__wrong" id={`${inputId}-err`} role="alert">
              {egg.wrong}
            </p>
          ) : null}
          <button type="button" className="portrait__dismiss" onClick={() => setAsking(false)}>
            {egg.dismiss}
          </button>
        </form>
      ) : null}

      {flipped ? (
        <button type="button" className="portrait__dismiss" onClick={() => setFlipped(false)}>
          {egg.flipBack}
        </button>
      ) : null}
    </div>
  )
}
