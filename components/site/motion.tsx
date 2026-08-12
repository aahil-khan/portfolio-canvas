'use client'

import { useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'

import { prefersReducedMotion, hasFinePointer, SITE_MEDIA } from '@/lib/site-motion'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Every moving part of `/`, in one client component.
 *
 * It wraps the page rather than sitting beside it, so `useGSAP`'s `scope` can be the page root:
 * per the GSAP React guidance, selector strings inside the hook are then resolved against this
 * subtree only and can never reach into the canvas or another route. Cleanup — reverting every
 * tween, ScrollTrigger and inline style — happens automatically when the hook re-runs or the
 * component unmounts, which is what stops a ScrollTrigger surviving a client-side navigation to
 * `/canvas` and firing against detached nodes.
 *
 * The sections themselves stay server components. This one holds no content, only behaviour.
 *
 * Reduced motion is asked once, here, via lib/site-motion.ts — never during render, and never
 * in a section component. See the note in that file about React #418.
 */
export function SiteMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const reduced = prefersReducedMotion()

      /*
       * Listeners and rAF loops GSAP does not own. A gsap context reverts tweens and
       * ScrollTriggers; it knows nothing about `addEventListener` or `requestAnimationFrame`,
       * so those are drained by hand in the cleanup returned below. Local to this run of the
       * hook — a module-level array would be shared between mounts and drain the wrong ones.
       */
      const cleanups: Array<() => void> = []

      /* ── Lenis ────────────────────────────────────────────────────────
       * Smooth scrolling is motion too, so reduced motion gets the native scroller. Lenis
       * drives the real scroll position rather than transforming a wrapper, so ScrollTrigger
       * needs no scrollerProxy — only its update hook and Lenis's raf on gsap's ticker.
       * lagSmoothing(0) stops a dropped frame desyncing scrub from scroll.
       */
      let lenis: Lenis | null = null
      const bar = root.current?.querySelector<HTMLElement>('[data-site-bar]')
      const setStuck = (y: number) => {
        if (bar) bar.dataset.stuck = y > 24 ? '1' : '0'
        /* drives the back-to-top control: far enough down that getting back is a real chore */
        if (root.current) root.current.dataset.far = y > 900 ? '1' : '0'
      }

      if (!reduced) {
        lenis = new Lenis({ duration: 1.05, smoothWheel: true })
        lenis.on('scroll', (e: { scroll: number }) => {
          ScrollTrigger.update()
          setStuck(e.scroll)
        })
        const raf = (t: number) => lenis?.raf(t * 1000)
        gsap.ticker.add(raf)
        gsap.ticker.lagSmoothing(0)
        /* gsap.ticker is global and outlives this component, so remove the callback explicitly */
        cleanups.push(() => gsap.ticker.remove(raf))
      } else {
        const onScroll = () => setStuck(window.scrollY)
        window.addEventListener('scroll', onScroll, { passive: true })
        cleanups.push(() => window.removeEventListener('scroll', onScroll))
      }

      /* in-page links have to go through Lenis or they fight the smooth scroller */
      const barH =
        parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 64
      const anchors = root.current?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? []
      let flashTimer = 0
      const onAnchor = (e: Event) => {
        const a = e.currentTarget as HTMLAnchorElement
        const target = document.querySelector<HTMLElement>(a.getAttribute('href')!)
        if (!target || !lenis) return
        e.preventDefault()
        /*
         * Land the section's *content* just under the bar, not its box.
         *
         * A section carries up to 128px of its own top padding, so scrolling its box below the
         * bar left the heading a further ~108px down and the jump consistently stopped short.
         *
         * Two things have to be in this sum, and missing either leaves it wrong: Lenis applies
         * `scroll-margin-top` *in addition to* the offset given here, so the offset has to add
         * that margin back before subtracting the bar. Measured, not assumed — with a naive
         * `padTop - barH` the landing was 44px out, exactly the amount `scroll-margin-top`
         * had already contributed.
         */
        const cs = getComputedStyle(target)
        const padTop = parseFloat(cs.paddingTop) || 0
        const scrollMargin = parseFloat(cs.scrollMarginTop) || 0
        lenis.scrollTo(target, { offset: scrollMargin + padTop - barH - 12 })

        /*
         * Flash the thing you were sent to.
         *
         * Set as an attribute rather than relying on `:target`, because the handler above calls
         * preventDefault — the hash never changes, so `:target` would never match. Re-triggering
         * needs the attribute removed and re-added, hence the reflow read.
         */
        window.clearTimeout(flashTimer)
        target.removeAttribute('data-flash')
        void target.offsetWidth
        target.setAttribute('data-flash', '1')
        /* must outlast the CSS animation (2 × 1s) or the highlight is cut off mid-pulse */
        flashTimer = window.setTimeout(() => target.removeAttribute('data-flash'), 2100)
      }
      anchors.forEach((a) => a.addEventListener('click', onAnchor))
      cleanups.push(() => {
        window.clearTimeout(flashTimer)
        anchors.forEach((a) => a.removeEventListener('click', onAnchor))
      })

      /* ── The hero's cursor light ──────────────────────────────────────
       * Not a GSAP tween — a rAF lerp writing two custom properties, the same shape as the
       * canvas cursor. Gated on a real pointer: a spotlight with nothing to follow is a hole.
       */
      if (!reduced && hasFinePointer()) {
        const hero = root.current?.querySelector<HTMLElement>('[data-hero]')
        const light = root.current?.querySelector<HTMLElement>('[data-hero-light]')
        if (hero && light) {
          const target = { x: 0, y: 0 }
          const smooth = { x: 0, y: 0 }
          let seeded = false
          let frame = 0
          /* accumulated idle offset, and the timestamp it was last advanced from */
          let driftX = 0
          let driftY = 0
          let last = performance.now()

          const onMove = (e: PointerEvent) => {
            if (e.pointerType === 'touch') return
            const r = hero.getBoundingClientRect()
            if (e.clientY > r.bottom) {
              light.dataset.on = '0'
              return
            }
            target.x = e.clientX - r.left
            target.y = e.clientY - r.top
            if (!seeded) {
              smooth.x = target.x
              smooth.y = target.y
              seeded = true
            }
            light.dataset.on = '1'
          }
          /*
           * The same lerped position drives the parallax, so the light and the grid can never
           * disagree about where the pointer is. Layers move by different amounts and in
           * opposite senses — the grid against the pointer, the bloom with it — which is what
           * gives the hero depth instead of a flat slide.
           */
          const lines = root.current?.querySelector<HTMLElement>('[data-hero-lines]')
          const glow = root.current?.querySelector<HTMLElement>('[data-hero-glow]')

          const tick = () => {
            smooth.x += (target.x - smooth.x) * 0.11
            smooth.y += (target.y - smooth.y) * 0.11
            light.style.setProperty('--sx', `${smooth.x.toFixed(1)}px`)
            light.style.setProperty('--sy', `${smooth.y.toFixed(1)}px`)

            /*
             * Idle drift — continuous, not an oscillation.
             *
             * This started as two slow sines and read as completely static: a 57-second period
             * at 16px amplitude works out to ~1.6px/sec, which is real motion and invisible
             * motion. It accumulates distance every frame now, so the grid is *always* travelling
             * at ~44px/sec — half a grid tile every second.
             *
             * The heading rotates slowly (a full turn every ~70s) so it never settles into one
             * direction, and the offset wraps at 88px — one grid tile — so the wrap is invisible.
             * Frame-time is clamped so a backgrounded tab returning after a long pause does not
             * jump the grid across the screen in one frame.
             */
            const now = performance.now()
            const dt = Math.min((now - last) / 1000, 0.05)
            last = now
            const heading = (now / 1000) * 0.09
            driftX = (driftX + Math.cos(heading) * 44 * dt) % 88
            driftY = (driftY + Math.sin(heading) * 44 * dt) % 88

            let px = 0
            let py = 0
            let gx = 0
            let gy = 0
            if (seeded) {
              const r = hero.getBoundingClientRect()
              /* -0.5 … 0.5 across the hero, so direction follows the pointer rather than a loop */
              const nx = smooth.x / Math.max(r.width, 1) - 0.5
              const ny = smooth.y / Math.max(r.height, 1) - 0.5
              px = -nx * 46
              py = -ny * 30
              gx = nx * 26
              gy = ny * 16
            }

            /* grid against the pointer, bloom with it — the opposition is what reads as depth */
            if (lines) {
              lines.style.transform = `translate3d(${(px + driftX).toFixed(1)}px, ${(py + driftY).toFixed(1)}px, 0)`
            }
            /*
             * The bloom must not wrap — a soft shape jumping 88px would be obvious — so it gets
             * the un-wrapped heading as a gentle sway instead.
             * `translate`, not `transform`: GSAP owns the bloom's transform for the scale breathe.
             */
            if (glow) {
              glow.style.translate = `${(gx + Math.cos(heading) * 18).toFixed(1)}px ${(gy + Math.sin(heading) * 12).toFixed(1)}px`
            }

            frame = requestAnimationFrame(tick)
          }
          window.addEventListener('pointermove', onMove, { passive: true })
          frame = requestAnimationFrame(tick)
          cleanups.push(() => {
            window.removeEventListener('pointermove', onMove)
            cancelAnimationFrame(frame)
          })
        }
      }

      /* ── Everything scroll-driven ─────────────────────────────────────
       * One matchMedia owns the lot. Triggers are created top-to-bottom in page order, which is
       * the refresh order ScrollTrigger wants.
       */
      const mm = gsap.matchMedia()

      mm.add(SITE_MEDIA, (ctx) => {
        if (ctx.conditions?.reduce) return

        /* hero intro */
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
        intro
          .from('[data-hero-grid]', { autoAlpha: 0, duration: 1.1 }, 0)
          .from('[data-intro="eyebrow"]', { y: 14, autoAlpha: 0, duration: 0.6 }, 0.1)
          /* the clip is on .name__line; the child moves, so letters rise out of nothing */
          .from('.name__line > span', { yPercent: 108, duration: 0.95, stagger: 0.08 }, 0.15)
          .from('.word > span', { yPercent: 105, duration: 0.7, stagger: 0.035 }, 0.5)
          .from('[data-intro="actions"]', { y: 18, autoAlpha: 0, duration: 0.6 }, 0.95)
          .from('[data-intro="stats"]', { y: 18, autoAlpha: 0, duration: 0.6 }, 1.05)

        gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
          const end = parseFloat(el.dataset.count!)
          const dec = parseInt(el.dataset.dec ?? '0')
          const o = { v: 0 }
          intro.to(
            o,
            {
              v: end,
              duration: 1.1,
              ease: 'power2.out',
              onUpdate: () => {
                el.textContent = o.v.toFixed(dec)
              },
            },
            1.1,
          )
        })

        /*
         * Idle drift only where there is no pointer to react to.
         *
         * On a touch screen there is nothing to follow, so the grid keeps a slow constant loop —
         * exactly one 88px tile, which repeats seamlessly. With a mouse this is skipped and the
         * grid is driven by the pointer instead (see the parallax block above), because a
         * background that always slides the same way reads as a loop no matter how slow it is.
         */
        if (!hasFinePointer()) {
          gsap.to('[data-hero-lines]', { x: 88, y: 88, duration: 9, ease: 'none', repeat: -1 })
        }

        /* the bloom breathes regardless — it is not directional, so it never reads as a loop */
        gsap.to('[data-hero-glow]', {
          scale: 1.12,
          duration: 13,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          transformOrigin: '50% 20%',
        })

        /* hero drifts out */
        gsap.to('[data-hero-inner]', {
          yPercent: -12,
          autoAlpha: 0.25,
          ease: 'none',
          scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true },
        })

        /*
         * Skills: ONE trigger for the whole toolbox, not one per group. Per-group triggers at
         * `top 85%` left the bottom rows unrevealed when the section filled the screen — the
         * section exists to be legible in one look, and the reveal must not be what prevents it.
         */
        gsap.from('[data-skills] .s-tool', {
          y: 12,
          autoAlpha: 0,
          duration: 0.45,
          ease: 'power3.out',
          stagger: 0.025,
          scrollTrigger: { trigger: '[data-skills]', start: 'top 70%', once: true },
        })

        /* generic entry reveals */
        gsap.set('.reveal', { y: 28, autoAlpha: 0 })
        ScrollTrigger.batch('.reveal', {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              duration: 0.7,
              ease: 'power3.out',
              stagger: 0.09,
              overwrite: true,
            }),
        })

        /* experience: light the index row matching the job in view */
        const items = gsap.utils.toArray<HTMLElement>('[data-xp-item]')
        gsap.utils.toArray<HTMLElement>('[data-job]').forEach((job, i) => {
          const light = () =>
            items.forEach((it, j) => {
              it.dataset.on = j === i ? '1' : '0'
            })
          ScrollTrigger.create({
            trigger: job,
            start: 'top 55%',
            end: 'bottom 55%',
            onEnter: light,
            onEnterBack: light,
          })
        })

        /*
         * Work: screenshots drift inside their frames.
         *
         * The scale is what makes the drift safe. `object-fit: cover` only leaves spare material
         * when the source is a different shape from the frame — and gina-1 is exactly 1.60, the
         * same as the 16:10 frame, so it had none. Translating it ±6% pulled the picture off its
         * own frame and exposed a band of surface at the top or bottom. 1.16 guarantees 8% of
         * headroom at each end whatever the source shape.
         */
        gsap.utils.toArray<HTMLElement>('[data-case-shot] img').forEach((img) => {
          gsap.fromTo(
            img,
            { yPercent: -6, scale: 1.16 },
            {
              yPercent: 6,
              scale: 1.16,
              ease: 'none',
              scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          )
        })

        /* closer parallax */
        gsap.to('[data-closer-field]', {
          yPercent: 14,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-closer]',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      })

      /*
       * Fonts and lazily-decoded images change layout metrics, which moves every trigger.
       * Viewport resize is handled automatically; these are not.
       */
      void document.fonts?.ready.then(() => ScrollTrigger.refresh())

      return () => {
        lenis?.destroy()
        mm.revert()
        cleanups.forEach((fn) => fn())
      }
    },
    { scope: root },
  )

  return (
    <div ref={root} data-scroll-page className="site">
      {children}
    </div>
  )
}
