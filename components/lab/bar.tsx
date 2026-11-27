import Link from 'next/link'

import { Aa } from '@/components/lab/aa'
import { DarkToggle, LookSwitch } from '@/components/lab/look-switch'
import { SoundControl } from '@/components/lab/sound'
import { labDemo } from '@/lib/lab/visibility'

/**
 * The Lab's bar: AK (home, a full page load out of the Lab), Lab, the "Demo content" marker while
 * demo is on, then Look, Aa, light and dark, and the Sound slot. Fixed, never inside anything that
 * pans. The trail and the dot are `Progress`, rendered beside it by the layout. Controls that need
 * JavaScript carry `data-needs-js` and hide without it.
 */
export function Bar({ copy }: { copy: Record<string, string> }) {
  return (
    <header className="lab-bar" data-bar>
      <a className="lab-skip" href="#lab-main">
        {copy.skipToText}
      </a>
      <div className="lab-bar-left">
        {/* a full page load: leaving the Lab must not carry its look onto the rest of the site */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="lab-mark" href="/">
          <span aria-hidden="true">{copy.barMark}</span>
          <span className="sr">{copy.barHome}</span>
        </a>
        <Link className="lab-bar-lab" href="/lab">
          {copy.barLab}
        </Link>
        {labDemo ? (
          <span className="lab-demo" data-demo-marker>
            {copy.demoMarker}
          </span>
        ) : null}
      </div>
      <div className="lab-bar-right">
        <LookSwitch
          labels={{ group: copy.lookLabel, paper: copy.lookPaper, lab: copy.lookLab, toPaper: copy.lookToPaper, toLab: copy.lookToLab }}
        />
        <Aa
          labels={{ label: copy.aaLabel, measure: copy.aaMeasure, wide: copy.aaWide, comfortable: copy.aaComfortable, size: copy.aaSize, px: copy.aaPx }}
        />
        <DarkToggle toDark={copy.themeToDark} toLight={copy.themeToLight} />
        <SoundControl />
      </div>
    </header>
  )
}
