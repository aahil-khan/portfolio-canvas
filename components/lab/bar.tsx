import Link from 'next/link'

import { Aa } from '@/components/lab/aa'
import { SoundControl } from '@/components/lab/sound'
import { ThemePicker } from '@/components/lab/theme-picker'
import { labDemo } from '@/lib/lab/visibility'

/**
 * The Lab's bar: AK (home, a full page load out of the Lab), Lab, the "Demo content" marker while
 * demo is on, then the theme picker, Aa (the reader settings) and the Sound slot. Fixed, never
 * inside anything that pans. The trail and the dot are `Progress`, rendered beside it by the layout. Controls that need
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
        <ThemePicker labels={{ label: copy.themeLabel, light: copy.themeLight, dark: copy.themeDark, close: copy.panelClose }} />
        <Aa
          labels={{
            label: copy.aaLabel,
            close: copy.panelClose,
            size: copy.aaSize,
            smaller: copy.aaSmaller,
            larger: copy.aaLarger,
            px: copy.aaPx,
            font: copy.aaFont,
            fontGrotesk: copy.aaFontGrotesk,
            fontSerif: copy.aaFontSerif,
            fontSystem: copy.aaFontSystem,
            leading: copy.aaLeading,
            tight: copy.aaTight,
            normal: copy.aaNormal,
            relaxed: copy.aaRelaxed,
            measure: copy.aaMeasure,
            narrow: copy.aaNarrow,
            comfortable: copy.aaComfortable,
            wide: copy.aaWide,
            layout: copy.aaLayout,
            side: copy.aaSide,
            centred: copy.aaCentred,
            reset: copy.aaReset,
          }}
        />
        <SoundControl />
      </div>
    </header>
  )
}
