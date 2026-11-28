/**
 * Runs code that imports the Markdown pipeline, for tests.
 *
 * Every file here starts `import 'server-only'`, which throws outside React's `react-server`
 * condition, and that condition in turn hides `react-dom/server`, which a test needs to look at
 * the output. So the test runs the code in a child Node whose only change is that `server-only`
 * resolves to its empty module. Nothing else about how the pipeline loads is different.
 *
 * The code is an ES module body; whatever it passes to `out()` comes back, JSON-decoded.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const EMPTY = pathToFileURL(path.join(ROOT, 'node_modules/server-only/empty.js')).href
const HOOK = `export async function resolve(s, c, next) { return s === 'server-only' ? { url: ${JSON.stringify(EMPTY)}, shortCircuit: true } : next(s, c) }`

/** `pipeline` names `lib/lab/markdown/pipeline.ts`'s file URL inside the code. */
export function inChild<T = unknown>(code: string): T {
  const pipeline = pathToFileURL(path.join(ROOT, 'lib/lab/markdown/pipeline.ts')).href
  const src = [
    `import { register } from 'node:module'`,
    `register('data:text/javascript,' + encodeURIComponent(${JSON.stringify(HOOK)}))`,
    `const pipeline = ${JSON.stringify(pipeline)}`,
    `const out = (v) => process.stdout.write('\\u0000' + JSON.stringify(v))`,
    code,
  ].join('\n')
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', src], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.status !== 0) throw new Error(`child failed (${r.status}):\n${r.stderr}`)
  const at = r.stdout.lastIndexOf('\u0000')
  if (at < 0) throw new Error(`child sent nothing back:\n${r.stdout}\n${r.stderr}`)
  return JSON.parse(r.stdout.slice(at + 1)) as T
}
