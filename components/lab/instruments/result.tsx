import { at } from './draw'

/**
 * An experiment's result (`result`, the end of an experiment's chain): the question, the number it
 * came to against its baseline, and the setup that produced it. Words only, so it is the same
 * with JavaScript off; its three lines rise in on first view.
 */
export function Result({ result, against }: { result: { question: string; setup: string; value: string; baseline?: string }; against: string }) {
  return (
    <div className="lab-result-box">
      <p className="lab-result-q" data-draw="in" style={at(0)}>
        {result.question}
      </p>
      <p className="lab-result" data-draw="in" style={at(2)}>
        <strong data-num>{result.value}</strong>
        {result.baseline ? (
          <span className="lab-result-vs">
            {against} {result.baseline}
          </span>
        ) : null}
      </p>
      <p className="meta" data-draw="in" style={at(4)}>
        {result.setup}
      </p>
    </div>
  )
}
