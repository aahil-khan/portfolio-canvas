import { SoundMenu, type SoundLabels } from '@/components/lab/sound/sound-menu'
import { getLab } from '@/lib/lab/content'
import { fill } from '@/lib/lab/view'
import { NOISE_IDS, type NoiseId } from '@/lib/noise'

import './sound.css'

const cap = (id: string) => id[0].toUpperCase() + id.slice(1)

/**
 * The Sound slot in the bar (API.md §6): the canvas's Sound menu, row for row, in the Lab's frame
 * (`SoundMenu`). A server component, so its words come from `content/data/lab.json`
 * (`copy.sound*`) without the bar passing them.
 */
export function SoundControl() {
  const { copy } = getLab()
  const noise = Object.fromEntries(
    NOISE_IDS.map((id) => [id, { label: copy[`soundNoise${cap(id)}`], hint: copy[`soundNoise${cap(id)}Hint`] }]),
  ) as Record<NoiseId, { label: string; hint: string }>
  const volume = (name: string) => fill(copy.soundVolume, { name })
  const labels: SoundLabels = {
    label: copy.soundLabel,
    title: copy.soundTitle,
    ui: copy.soundUi,
    uiHint: copy.soundUiHint,
    ambience: copy.soundAmbience,
    ambienceOff: copy.soundAmbienceOff,
    connecting: copy.soundConnecting,
    playing: copy.soundPlaying,
    error: copy.soundError,
    source: copy.soundSource,
    radio: copy.soundTabRadio,
    noise: copy.soundTabNoise,
    shuffle: copy.soundShuffle,
    now: copy.soundNow,
    noises: noise,
    master: copy.soundMaster,
    music: copy.soundMusic,
    noiseLevel: copy.soundNoise,
    interface: copy.soundInterface,
    masterVolume: volume(copy.soundMaster),
    musicVolume: volume(copy.soundMusic),
    noiseVolume: volume(copy.soundNoise),
    interfaceVolume: volume(copy.soundInterface),
    mute: copy.soundMute,
    mixShow: copy.soundMixShow,
    mixHide: copy.soundMixHide,
    credit: copy.soundCredit,
  }
  return <SoundMenu labels={labels} />
}
