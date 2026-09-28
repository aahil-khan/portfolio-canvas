import { test } from 'node:test'
import assert from 'node:assert/strict'

import { blank, check, type Field } from './schema.ts'

const person: Field = {
  kind: 'obj',
  label: 'Person',
  fields: {
    name: { kind: 'str', label: 'Name' },
    nick: { kind: 'str', label: 'Nick', optional: true },
    site: { kind: 'url', label: 'Site', optional: true },
  },
}

const paths = (field: Field, value: unknown) => check(field, value).map((i) => i.path)

test('a required string that is missing is reported at its path', () => {
  assert.deepEqual(paths(person, {}), ['name'])
})

test('a required string of whitespace is missing', () => {
  assert.deepEqual(paths(person, { name: '   ' }), ['name'])
})

test('an unknown key on an object is reported', () => {
  const issues = check(person, { name: 'A', naem: 'B' })
  assert.equal(issues.length, 1)
  assert.equal(issues[0].path, 'naem')
  assert.match(issues[0].message, /unknown field/)
})

test('an optional field may be absent', () => {
  assert.deepEqual(check(person, { name: 'A' }), [])
})

test('url rejects a javascript: scheme', () => {
  assert.deepEqual(paths(person, { name: 'A', site: 'javascript:alert(1)' }), ['site'])
})

test('url accepts https and mailto', () => {
  assert.deepEqual(check(person, { name: 'A', site: 'https://x.dev' }), [])
  assert.deepEqual(check(person, { name: 'A', site: 'mailto:a@b.c' }), [])
})

test('enum rejects a value outside its options', () => {
  const kind: Field = { kind: 'enum', label: 'Kind', options: ['Product', 'System'] }
  assert.equal(check(kind, 'Hobby').length, 1)
  assert.deepEqual(check(kind, 'System'), [])
})

test('a list of objects reports the index of the bad item', () => {
  const people: Field = { kind: 'list', label: 'People', of: person }
  assert.deepEqual(check(people, [{ name: 'A' }, {}], 'items').map((i) => i.path), ['items[1].name'])
})

test('shot accepts a path or a path with a caption', () => {
  const shot: Field = { kind: 'shot', label: 'Shot', dir: 'archive' }
  assert.deepEqual(check(shot, '/archive/a.webp'), [])
  assert.deepEqual(check(shot, { src: '/archive/a.webp', caption: 'x' }), [])
  assert.equal(check(shot, { src: 1 }).length, 1)
})

test('file rejects a path that climbs out of public/', () => {
  const file: Field = { kind: 'file', label: 'Img', accept: 'image', dir: 'work' }
  assert.equal(check(file, '/../etc/passwd').length, 1)
  assert.equal(check(file, 'work/a.png').length, 1)
  assert.deepEqual(check(file, '/work/a.png'), [])
})

test('int rejects a fraction', () => {
  const year: Field = { kind: 'num', label: 'Year', int: true }
  assert.equal(check(year, 2.5).length, 1)
  assert.deepEqual(check(year, 2025), [])
})

test('max bounds a string length', () => {
  const s: Field = { kind: 'str', label: 'S', max: 3 }
  assert.equal(check(s, 'abcd').length, 1)
})

test('email needs an @', () => {
  const e: Field = { kind: 'email', label: 'E' }
  assert.equal(check(e, 'nope').length, 1)
  assert.deepEqual(check(e, 'a@b.c'), [])
})

test('blank fills required strings and leaves optional fields out', () => {
  assert.deepEqual(blank(person), { name: '' })
})

test('blank of a list is empty, of a required enum is its first option', () => {
  assert.deepEqual(blank({ kind: 'list', label: 'L', of: person }), [])
  assert.equal(blank({ kind: 'enum', label: 'K', options: ['a', 'b'] }), 'a')
})
