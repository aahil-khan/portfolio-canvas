import { buildCards } from '@/components/apps/build-cards'
import { Desktop } from '@/components/desktop/desktop'
import { VisitPing } from '@/components/desktop/visit-ping'
import { MobileOffer } from '@/components/resume/mobile-offer'
import { ResumeDoc } from '@/components/resume/resume-doc'
import { apps, externalApps, mobile, profile } from '@/content'
import { validateContent } from '@/content/validate'

/*
 * Content is checked here, at module scope. This runs while `next build` prerenders the page,
 * so bad content fails the build instead of rendering a blank card in production — and in dev
 * it re-runs on every recompile, so you find out the moment you save.
 */
validateContent()

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
  const dock = apps.map((a) => ({ id: a.id, label: a.label, icon: a.icon, colour: a.colour }))
  const externals = externalApps.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon,
    colour: a.colour,
    href: a.href,
  }))

  return (
    <main>
      {/* counts this page load — not inside the Visitors card, which most people never open */}
      <VisitPing />
      <Desktop
        cards={await buildCards()}
        dock={dock}
        externals={externals}
        bootIds={['about', 'work', 'experience']}
        hero={<Hero />}
        heroWidth={HERO_WIDTH}
        /*
         * Server-rendered here and handed down, exactly like the hero and the card bodies. The
         * canvas branch never renders it, so a desktop pays only for the element — and because
         * it is the same `ResumeDoc` that `/resume` uses, the two can never say different things.
         * No structured data: that belongs once, on the canonical `/resume`.
         */
        resume={<ResumeDoc top={<MobileOffer />} />}
      />
    </main>
  )
}
