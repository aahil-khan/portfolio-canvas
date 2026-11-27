'use client'

import { useEffect } from 'react'
import type Lenis from 'lenis'

import { prefersReducedMotion, subscribeReducedMotion } from '@/lib/motion/reduced'

declare global {
  interface Window {
    /** The running Lenis, for the check and the column transition. Absent on touch and under reduced motion. */
    __lenis?: Lenis
  }
}

/** A fine pointer: a mouse or a trackpad. Phones and tablets never load Lenis. */
const FINE = '(hover: hover) and (pointer: fine)'

/**
 * Smooth wheel scrolling, on a fine pointer only (CLAUDE.md: Lenis in the Lab, desktop only).
 * Lenis drives the native scroll position, so `position: sticky`, IntersectionObserver and the
 * progress loop all see real values. It is imported on demand, so touch devices never download
 * it, and it never starts under reduced motion (rule 19).
 */
export function SmoothScroll() {
  useEffect(() => {
    let lenis: Lenis | null = null
    let cancelled = false
    const fine = window.matchMedia(FINE)

    const stop = () => {
      lenis?.destroy()
      lenis = null
      delete window.__lenis
    }
    const start = async () => {
      if (lenis || !fine.matches || prefersReducedMotion()) return
      const { default: L } = await import('lenis')
      if (cancelled || lenis || !fine.matches || prefersReducedMotion()) return
      lenis = new L({ autoRaf: true, anchors: { offset: -72 }, allowNestedScroll: true })
      window.__lenis = lenis
    }
    const sync = () => (fine.matches && !prefersReducedMotion() ? void start() : stop())

    sync()
    fine.addEventListener('change', sync)
    const unsubscribe = subscribeReducedMotion(sync)
    return () => {
      cancelled = true
      fine.removeEventListener('change', sync)
      unsubscribe()
      stop()
    }
  }, [])
  return null
}
