'use client'

import { useId, useState, type CSSProperties } from 'react'

import { passAt, passHat, pct } from '@/lib/lab/instruments/passk'

import { at } from './draw'
import { useLeadUse } from './live'

export interface PasskCopy {
  p: string
  at: string
  hat: string
  atKey: string
  hatKey: string
}

const KS = [1, 3, 5, 8]

/**
 * pass@k against pass^k (`passk`, note T02's lead). Arithmetic, not results: for runs that succeed
 * independently with chance p, pass@k = 1 − (1 − p)^k and pass^k = p^k. One control, a slider for
 * p (50–99%), and two bars a row that split apart as k grows; k = 5's pass^k is the accent. With
 * JavaScript off the slider is hidden and the figure shows p = 90%, which is also where it starts.
 */
export function Passk({ copy, ks = KS, p0 = 0.9 }: { copy: PasskCopy; ks?: number[]; p0?: number }) {
  const [p, setP] = useState(p0)
  const id = useId()
  const used = useLeadUse('passk')
  const pv = `${Math.round(p * 100)}%`
  const mark = ks.includes(5) ? 5 : ks[Math.floor(ks.length / 2)]
  return (
    <div className="lab-pk">
      <div className="lab-pk-p">
        <label htmlFor={id} className="lab-pk-p-label">
          {copy.p} <span data-num>{pv}</span>
        </label>
        <input
          id={id}
          type="range"
          min={50}
          max={99}
          step={1}
          value={Math.round(p * 100)}
          aria-valuetext={pv}
          data-needs-js
          onChange={(e) => {
            used()
            setP(Number(e.target.value) / 100)
          }}
          style={{ '--v': `${((Math.round(p * 100) - 50) / 49) * 100}%` } as CSSProperties}
        />
      </div>
      <ul className="lab-pk-rows">
        {ks.map((k, i) => {
          const a = passAt(p, k)
          const h = passHat(p, k)
          return (
            <li key={k} className="lab-pk-row" data-mark={k === mark ? '' : undefined}>
              <span className="lab-pk-k" data-num>
                k = {k}
              </span>
              <span className="lab-pk-bars" aria-hidden="true">
                <span className="lab-pk-bar" data-at="">
                  <i data-draw="x" style={{ ...at(i * 2), width: `${(a * 100).toFixed(2)}%` }} />
                </span>
                <span className="lab-pk-bar" data-hat="">
                  <i data-draw="x" style={{ ...at(i * 2 + 1), width: `${(h * 100).toFixed(2)}%` }} />
                </span>
              </span>
              <span className="lab-pk-vals">
                <span className="lab-pk-v">
                  <span>{copy.at}</span> <span data-num>{pct(a)}</span>
                </span>
                <span className="lab-pk-v">
                  <span>{copy.hat}</span> <span data-num>{pct(h)}</span>
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="lab-pk-key meta">
        <span className="lab-pk-swatch" data-at="" aria-hidden="true" />
        <span>{copy.atKey}</span>
        <span className="lab-pk-swatch" data-hat="" aria-hidden="true" />
        <span>{copy.hatKey}</span>
      </p>
    </div>
  )
}
