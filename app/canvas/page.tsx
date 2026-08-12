import type { Metadata } from 'next'

import { buildCards } from '@/components/apps/build-cards'
import { Desktop } from '@/components/desktop/desktop'
import { apps, dockLayout, externalApps, mobile, profile, site } from '@/content'
import { validateContent } from '@/content/validate'

/*
 * Content is checked here, at module scope. This runs while `next build` prerenders the page,
 * so bad content fails the build instead of rendering a blank card in production — and in dev
 * it re-runs on every recompile, so you find out the moment you save.
 */
validateContent()

export const metadata: Metadata = {
  title: `${profile.name} — ${site.desk.tabSuffix}`,
  description: mobile.onlyDesktopBody,
  alternates: { canonical: '/canvas' },
}

const HERO_WIDTH = 600

function Hero() {
  return (
    <div className="hero__card">
      <div className="hero__avatar">{profile.initials}</div>
      <h1>{profile.name}</h1>
      <p className="hero__role">
        {profile.role.prefix} <b>{profile.role.emphasis}</b>
      </p>
      <p className="hero__meta">
        {profile.location}
        {profile.availability ? ` · ${profile.availability}` : ''}
      </p>
      {/*
       * Rendered for both shells and revealed by CSS only under `.m-hero`, rather than branched
       * on a media query in JS. The hero is one server-rendered node shared by the canvas and
       * the phone — keeping it that way is what stops the two drifting apart.
       */}
      {mobile.heroNote ? <p className="hero__note">{mobile.heroNote}</p> : null}
    </div>
  )
}

export default async function Page() {
  const tile = (a: (typeof apps)[number]) => ({ id: a.id, label: a.label, icon: a.icon, colour: a.colour })
  const byId = new Map(apps.map((a) => [a.id, a]))

  /*
   * Two shapes of the same set. `dock` stays flat because the completionist egg, Random and the
   * phone shell all just want "every dock app"; `dockEntries` carries the folder structure,
   * which is purely how the dock draws itself. validate.ts guarantees every id here resolves.
   */
  const dock = apps.map(tile)
  const dockEntries = dockLayout.map((node) =>
    node.kind === 'app'
      ? ({ kind: 'app', app: tile(byId.get(node.id)!) } as const)
      : ({
          kind: 'folder',
          id: node.id,
          label: node.label,
          icon: node.icon,
          colour: node.colour,
          apps: node.items.map((id) => tile(byId.get(id)!)),
        } as const),
  )
  const externals = externalApps.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon,
    colour: a.colour,
    href: a.href,
  }))

  return (
    <main>
      <Desktop
        cards={await buildCards()}
        dock={dock}
        dockEntries={dockEntries}
        externals={externals}
        bootIds={['about', 'work', 'experience']}
        hero={<Hero />}
        heroWidth={HERO_WIDTH}
      />
    </main>
  )
}
