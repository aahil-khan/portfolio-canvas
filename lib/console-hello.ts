import { consoleHello } from '../content/console.ts'

/**
 * An inline script that prints the console hello once, as the page's HTML parses.
 *
 * Inline rather than a client component, so it adds no JavaScript chunk to either page and
 * nothing to hydrate. Without JavaScript it simply never runs, which is the right outcome.
 * `<` is escaped so no copy can ever close the surrounding <script> tag.
 */
const message = [...consoleHello.lines, consoleHello.link].join('\n')

export const consoleHelloScript = `console.log(${JSON.stringify(message).replace(/</g, '\\u003c')})`
