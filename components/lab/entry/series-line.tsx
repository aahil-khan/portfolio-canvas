import Link from 'next/link'

/** A study's note names its study above the title: "A note from" + the study. */
export function SeriesLine({ label, title, href, id }: { label: string; title: string; href: string; id: string }) {
  return (
    <p className="lab-series-line">
      <span className="meta">{label}</span>
      <Link href={href} data-preview={`entry:${id}`}>
        {title}
      </Link>
    </p>
  )
}
