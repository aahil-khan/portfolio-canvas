import { ARCHIVE_KINDS, type ArchiveItem, archive } from '@/content'

import { ArchiveImage } from './archive-image'

/**
 * The archive card.
 *
 * Every field but kind/title/when is optional, so this renders whatever an entry happens to
 * have and skips the rest — no per-entry configuration, no empty rows. Pinned entries lift into
 * "Right now"; everything else keeps the order it has in the file, newest first.
 */

function Entry({ item }: { item: ArchiveItem }) {
  const kind = ARCHIVE_KINDS[item.kind]
  return (
    <li className="arc" style={{ ['--k' as string]: kind.colour }}>
      <div className="arc__head">
        <span className="arc__kind">{kind.label}</span>
        <span className="arc__when">{item.when}</span>
      </div>

      <p className="arc__title">
        {item.href ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" className="link">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </p>

      {item.meta ? <p className="arc__meta">{item.meta}</p> : null}
      {item.note ? <p className="arc__note">{item.note}</p> : null}
      {item.image ? (
        <ArchiveImage cardId={`archive:${item.id}`} src={item.image} alt={item.title} />
      ) : null}
    </li>
  )
}

export function ArchiveFeed() {
  const pinned = archive.filter((a) => a.pinned)
  const rest = archive.filter((a) => !a.pinned)

  return (
    <>
      {pinned.length ? (
        <section className="arc-group">
          <h3>
            Right now <span>{pinned.length}</span>
          </h3>
          <ul className="arc-list">
            {pinned.map((item) => (
              <Entry key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="arc-group">
        <h3>Lately</h3>
        <ul className="arc-list">
          {rest.map((item) => (
            <Entry key={item.id} item={item} />
          ))}
        </ul>
      </section>
    </>
  )
}
