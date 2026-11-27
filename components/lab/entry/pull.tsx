/**
 * The pull-quote (decision 5): at the lede's size, in the text column. It repeats a sentence of the
 * body word for word, so assistive tech skips it.
 */
export function Pull({ text }: { text: string }) {
  return (
    <p className="lab-pull" data-pull aria-hidden="true">
      {text}
    </p>
  )
}
