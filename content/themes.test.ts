import assert from 'node:assert/strict'
import { test } from 'node:test'

import { allThemes, labThemes, themeCss, themes } from './themes.ts'

const TOKENS = ['canvas', 'surface', 'ink', 'inkMuted', 'inkSubtle', 'accent', 'accentInk', 'border', 'grid', 'trail', 'raised', 'shadowInk', 'hair', 'mark'] as const

test('the site keeps exactly its eighteen themes, none of them Lab-only', () => {
  assert.equal(themes.length, 18)
  assert.ok(themes.every((t) => !t.labOnly))
})

test('the Lab adds two Premium palettes, both labOnly, and nothing else', () => {
  assert.deepEqual(labThemes.map((t) => t.id), ['lab-premium-day', 'lab-premium-night'])
  assert.ok(labThemes.every((t) => t.labOnly === true))
  assert.equal(allThemes.length, 20)
  assert.equal(new Set(allThemes.map((t) => t.id)).size, 20)
})

test('every theme defines every token, with no empty values', () => {
  for (const t of allThemes)
    for (const k of TOKENS) assert.ok(typeof t.tokens[k] === 'string' && t.tokens[k].length > 0, `${t.id} has no ${k}`)
})

test("Night's frame and offset are both brass (decision 3)", () => {
  const night = labThemes.find((t) => t.id === 'lab-premium-night')!
  assert.equal(night.tokens.border, '#7F6C45')
  assert.equal(night.tokens.shadowInk, '#7F6C45')
  assert.equal(night.dark, true)
})

test('the trail is the accent on light grounds and the muted ink on dark ones', () => {
  for (const t of themes) assert.equal(t.tokens.trail, t.dark ? t.tokens.inkMuted : t.tokens.accent, t.id)
})

test('themeCss emits one block per theme, Lab tokens included', () => {
  const css = themeCss()
  for (const t of allThemes) assert.match(css, new RegExp(`\\[data-theme="${t.id}"\\]\\{[^}]*--trail:[^}]*--raised:[^}]*--shadow-ink:[^}]*--hair:[^}]*--mark:`))
  assert.equal(css.split('\n').length, 20)
})
