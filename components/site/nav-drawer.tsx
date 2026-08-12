'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

import { site } from '@/content'

/**
 * The phone navigation.
 *
 * This replaced a horizontally scrollable row of chips pinned under the bar. That row cost a
 * permanent 46px band on the smallest screens, only ever showed four of its six destinations, and
 * relied on a fade to hint that the rest existed — which is a lot of apparatus to say "there are
 * six sections". A drawer is what a phone user already expects, and it costs nothing until opened.
 *
 * Scroll is locked while it is open via an attribute on <html> rather than by touching Lenis:
 * Lenis drives the real scroll position, so `overflow: hidden` on the document stops it dead
 * without this component needing a reference to it.
 *
 * The panel and scrim are PORTALLED to <body>, and that is not optional. This component is
 * rendered inside the top bar, and the bar has `backdrop-filter` — which makes it a containing
 * block for `position: fixed` descendants. Left in place, the drawer resolved `inset: 0` against
 * the 428×64 bar instead of the viewport and rendered as a small box in the corner.
 */
export function NavDrawer() {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  /*
   * "Are we on the client yet?" — portals need a DOM to target and there is none during the
   * server render. `useSyncExternalStore` rather than `useState` + an effect, matching
   * lib/theme.ts and lib/shell-mode.ts: setting state in an effect costs a second render on
   * every mount, and the lint rule in this repo rejects it outright.
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    document.documentElement.toggleAttribute('data-drawer', open)
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    /* focus moves into the panel, or the drawer is invisible to a keyboard and a screen reader */
    panel.current?.querySelector<HTMLAnchorElement>('a')?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.removeAttribute('data-drawer')
    }
  }, [open])

  const links = [
    { href: '#about', label: site.nav.about },
    { href: '#skills', label: site.nav.skills },
    { href: '#experience', label: site.nav.experience },
    { href: '#work', label: site.nav.work },
    { href: '#contact', label: site.nav.contact },
  ]

  return (
    <>
      <button
        ref={button}
        type="button"
        className="burger"
        aria-expanded={open}
        aria-controls="site-drawer"
        aria-label={open ? site.nav.closeMenu : site.nav.openMenu}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden />
        <span aria-hidden />
        <span aria-hidden />
      </button>

      {mounted
        ? createPortal(
            /*
             * `site` on the portal root is load-bearing: every drawer rule is scoped `.site .x`,
             * and portalling to <body> took the panel out of that subtree — the styles silently
             * stopped matching and it rendered as a 428×48 strip. `display: contents` keeps the
             * class in the ancestor chain without adding a box.
             */
            <div className="site drawer__root" data-open={open ? '1' : '0'}>
          {/* the scrim is a button so a tap outside closes, and so it is skipped by tab */}
          <button
            type="button"
            className="drawer__scrim"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
          />

          <div
            id="site-drawer"
            className="drawer"
            ref={panel}
            /* inert while closed, or its links stay in the tab order behind the page */
            inert={!open}
          >
            <nav aria-label={site.nav.sectionsLabel}>
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              ))}
              <Link className="drawer__desk" href="/canvas" onClick={() => setOpen(false)}>
                {site.nav.desk}
                <span className="drawer__badge">{site.toDeskBadge}</span>
              </Link>
            </nav>
          </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
