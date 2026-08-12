import type { ReactNode } from 'react'

/**
 * Renders `**bold**` and `*italic*` from content strings.
 *
 * Content files are plain typed arrays that several surfaces read, so they cannot hold JSX — but
 * a highlight inside a job bullet is genuinely part of the writing. This is the whole markup
 * vocabulary: two markers, no parser, no dependency.
 *
 * It lived in `components/resume/resume-doc.tsx` until that component was deleted along with the
 * résumé surfaces. It is not a component and never was, so it belongs in lib.
 */
export function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}
