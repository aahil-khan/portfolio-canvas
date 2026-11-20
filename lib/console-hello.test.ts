import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'

import { consoleHelloScript } from './console-hello.ts'
import { consoleHello } from '../content/console.ts'

function run(script: string): unknown[][] {
  const calls: unknown[][] = []
  vm.runInNewContext(script, { console: { log: (...a: unknown[]) => calls.push(a) } })
  return calls
}

test('the console hello prints once, with the ask and the README link', () => {
  const calls = run(consoleHelloScript)
  assert.equal(calls.length, 1)
  const text = String(calls[0][0])
  for (const line of consoleHello.lines) assert.ok(text.includes(line), `missing: ${line}`)
  assert.ok(text.includes(consoleHello.link))
  assert.match(consoleHello.link, /#building-on-this$/)
})

test('the console hello cannot close its own <script> tag', () => {
  assert.ok(!/<\/script/i.test(consoleHelloScript))
})
