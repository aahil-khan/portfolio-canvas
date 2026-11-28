'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'

import { bigEnough, px, ZOOM_SELECTOR, type ViewerCopy, type ViewerItem } from '@/lib/lab/viewer'
import { fill } from '@/lib/lab/view'

import type { ViewerProps } from './viewer'

/** The viewer's chunk, fetched on the first open and kept: it costs nothing on a page's first load. */
let loading: Promise<ComponentType<ViewerProps>> | null = null
const loadViewer = () => (loading ??= import('./viewer').then((m) => m.Viewer))

/** The attributes this marks an image with, so they can be taken off again exactly. */
const MARKS = ['data-zoom-ready', 'tabindex', 'role', 'aria-label', 'aria-haspopup'] as const

/** The page's own entry: never a copy of one inside a preview window. */
const articleOf = (entry: string) => document.querySelector<HTMLElement>(`#lab-main article[data-entry="${CSS.escape(entry)}"]`)

function zoomable(img: HTMLImageElement): boolean {
  if (img.closest('a[href], [aria-hidden="true"]')) return false
  return bigEnough(px(img.getAttribute('width'), img.naturalWidth || img.width), px(img.getAttribute('height'), img.naturalHeight || img.height))
}

const images = (article: HTMLElement) => [...article.querySelectorAll<HTMLImageElement>(ZOOM_SELECTOR)].filter(zoomable)

function itemOf(img: HTMLImageElement): ViewerItem {
  const caption = img.closest('figure')?.querySelector('figcaption')?.textContent?.replace(/\s+/g, ' ').trim()
  return {
    src: img.src,
    alt: img.alt,
    w: px(img.getAttribute('width'), img.naturalWidth || 1),
    h: px(img.getAttribute('height'), img.naturalHeight || 1),
    ...(caption ? { caption } : {}),
  }
}

interface Open {
  Viewer: ComponentType<ViewerProps>
  items: ViewerItem[]
  index: number
  opener: HTMLImageElement
}

/**
 * Every image on an entry page opens full size (Aahil, 28 Nov: "make images clickable too for full
 * screen just like canvas has"): the body's (`img[data-zoom]`) and the lead's (`[data-lead] img`).
 *
 * One delegated listener on the entry, mounted once per entry page. With JavaScript off it never
 * runs, so the images are only images: the zoom cursor, the "View full size" hint, the button role
 * and the tab stop are all written here, at mount. The viewer itself is a separate chunk, imported
 * on the first open (`check:lab` rule LB holds it out of the first load).
 */
export function ImageZoom({ entry, copy }: { entry: string; copy: ViewerCopy }) {
  const [open, setOpen] = useState<Open | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    const article = articleOf(entry)
    if (!article) return
    const marked = images(article)
    const figures: HTMLElement[] = []
    for (const img of marked) {
      img.setAttribute('data-zoom-ready', '')
      img.setAttribute('tabindex', '0')
      img.setAttribute('role', 'button')
      img.setAttribute('aria-haspopup', 'dialog')
      img.setAttribute('aria-label', fill(copy.open, { alt: img.alt || copy.untitled }))
      const fig = img.parentElement
      if (fig?.tagName === 'FIGURE') {
        fig.setAttribute('data-zoom-hint', copy.hint)
        figures.push(fig)
      }
    }

    const show = async (img: HTMLImageElement) => {
      if (busy.current) return
      busy.current = true
      try {
        const list = images(article)
        const Viewer = await loadViewer()
        setOpen({ Viewer, items: list.map(itemOf), index: Math.max(0, list.indexOf(img)), opener: img })
      } finally {
        busy.current = false
      }
    }
    const target = (e: Event) => {
      const img = (e.target as Element | null)?.closest?.('img[data-zoom-ready]')
      return img instanceof HTMLImageElement && article.contains(img) ? img : null
    }
    const onClick = (e: MouseEvent) => {
      const img = target(e)
      if (!img || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      void show(img)
    }
    const onKey = (e: KeyboardEvent) => {
      const img = target(e)
      if (!img || (e.key !== 'Enter' && e.key !== ' ')) return
      e.preventDefault()
      void show(img)
    }
    article.addEventListener('click', onClick)
    article.addEventListener('keydown', onKey)
    return () => {
      article.removeEventListener('click', onClick)
      article.removeEventListener('keydown', onKey)
      for (const img of marked) for (const a of MARKS) img.removeAttribute(a)
      for (const f of figures) f.removeAttribute('data-zoom-hint')
    }
  }, [entry, copy])

  if (!open) return null
  const { Viewer, items, index, opener } = open
  return (
    <Viewer
      items={items}
      start={index}
      copy={copy}
      onClose={() => {
        // the viewer has released the page (no longer inert), so the image can take focus now
        opener.focus({ preventScroll: true })
        setOpen(null)
      }}
    />
  )
}
