import 'server-only'

import type { Element, Root } from 'hast'
import { bundledLanguages, createCssVariablesTheme, createHighlighter, type Highlighter } from 'shiki'

/**
 * Fenced code, highlighted at build (API.md §4). The theme is shiki's CSS-variables theme, so the
 * colours are `var(--shiki-*)` and the Lab's CSS maps them onto the ink tiers: code follows all 20
 * themes and passes contrast by construction. Shiki's default (Oniguruma) engine: the JavaScript
 * one tokenises TypeScript into one span a line. Next keeps `shiki` external on the server, so its
 * WASM loads from node_modules at build.
 *
 * One highlighter for the whole build; a language loads the first time a body uses it. A language
 * shiki doesn't know is rendered as plain text.
 */

const THEME = createCssVariablesTheme({ name: 'lab', variablePrefix: '--shiki-', fontStyle: true })
export const PLAIN = 'text'

let highlighter: Promise<Highlighter> | null = null
const loaded = new Set<string>()

function get(): Promise<Highlighter> {
  highlighter ??= createHighlighter({ themes: [THEME], langs: [] })
  return highlighter
}

/** The language a fence names, or plain text when shiki has no grammar for it. */
export function language(lang: string | null | undefined): string {
  const l = (lang ?? '').trim().toLowerCase()
  return l && l in bundledLanguages ? l : PLAIN
}

/** A fenced block as hast: `pre[data-language] > code[data-language]`, shiki's spans inside. */
export async function highlight(code: string, lang: string | null | undefined): Promise<Element> {
  const l = language(lang)
  const hl = await get()
  if (l !== PLAIN && !loaded.has(l)) {
    await hl.loadLanguage(l as keyof typeof bundledLanguages)
    loaded.add(l)
  }
  // no tokenize time limit: under load the 500ms default gives up and leaves the rest of a line one
  // unhighlighted span (a flaky test, a wrong page); bodies are ours and render at build, never on a request
  const root = hl.codeToHast(code, { lang: l, theme: 'lab', tokenizeTimeLimit: 0 }) as Root
  const pre = root.children.find((c): c is Element => c.type === 'element' && c.tagName === 'pre')
  if (!pre) throw new Error('shiki returned no <pre>')
  pre.properties = { ...pre.properties, dataLanguage: l }
  const inner = pre.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code')
  if (inner) inner.properties = { ...inner.properties, dataLanguage: l }
  return pre
}
