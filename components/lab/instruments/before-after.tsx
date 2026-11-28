import { at } from './draw'
import { Inline } from './text'

/**
 * Before and after (`before-after`): two boxes side by side, one on a phone above the other, the
 * second marked as the one that stands. Words only; they rise in on first view.
 */
export function BeforeAfter({ before, after, labels }: { before: string; after: string; labels: { before: string; after: string } }) {
  return (
    <div className="lab-ba">
      <div className="lab-ba-side" data-draw="in" style={at(0)}>
        <p className="end-h">{labels.before}</p>
        <p>
          <Inline text={before} />
        </p>
      </div>
      <div className="lab-ba-side" data-after="" data-draw="in" style={at(3)}>
        <p className="end-h">{labels.after}</p>
        <p>
          <Inline text={after} />
        </p>
      </div>
    </div>
  )
}
