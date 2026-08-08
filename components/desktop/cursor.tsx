'use client'

import { useEffect, useRef } from 'react'

/**
 * The dot that replaces the native cursor on fine pointers.
 *
 * Small precision targets get colour feedback, never size: a 32px ring over a 22px close
 * button covers the thing you're aiming at, which reads as the button being hard to hit.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = dot.current
    if (!el) return
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let cx = window.innerWidth / 2
    let cy = window.innerHeight / 2
    let tx = cx
    let ty = cy

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      tx = e.clientX
      ty = e.clientY
      el.classList.add('on')
      const t = e.target as HTMLElement
      // form controls get the small dot too: the 22px ring hides the caret you're aiming at
    const precise = t.closest('.card__x,.tool,.chip,.link,a,input,textarea')
      const big = !precise && t.closest('.dock__item,.card__head,#hero,button')
      el.classList.toggle('precise', !!precise)
      el.classList.toggle('big', !!big)
    }
    const leave = () => el.classList.remove('on')

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerleave', leave)

    let raf = 0
    const frame = () => {
      cx += (tx - cx) * 0.35
      cy += (ty - cy) * 0.35
      el.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <div ref={dot} id="cursor" aria-hidden />
}
