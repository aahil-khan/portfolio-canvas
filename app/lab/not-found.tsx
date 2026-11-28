import Link from 'next/link'

import { getLab } from '@/lib/lab/content'

/**
 * A clean 404 inside the Lab: anything `generateStaticParams` did not make (`dynamicParams =
 * false`), and every entry route while the Lab is empty. The bar and the footer stay.
 */
export default function LabNotFound() {
  const { copy } = getLab()
  return (
    <div className="lab-page lab-404">
      <p className="lab-eyebrow">{copy.secEyebrow}</p>
      <h1 className="lab-home-title">{copy.notFoundTitle}</h1>
      <p>{copy.notFoundBody}</p>
      <Link className="lab-chip" href="/lab">
        {copy.nextBack}
      </Link>
    </div>
  )
}
