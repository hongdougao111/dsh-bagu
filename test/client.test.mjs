import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const code = readFileSync(join(here, '..', 'client.js'), 'utf8')

/** 把 client.js 跑在假沙箱里：window.__ModuleLoader__ + document + react 都是假的。 */
function boot() {
  const loaded = []
  const styles = []
  const document = {
    head: { appendChild: (el) => styles.push(el) },
    createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }),
  }
  const React = {
    createElement: (type, props, ...kids) => ({ type, props, kids }),
    useState: (v) => [v, () => {}],
    useRef: (v) => ({ current: v }),
    useCallback: (f) => f,
    useEffect: () => {},
  }
  const sandbox = {
    window: { __ModuleLoader__: { load: (def) => loaded.push(def) } },
    document,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return { loaded, styles, React, document }
}

test('自注册脚本：id 等于包名', () => {
  const { loaded } = boot()
  assert.equal(loaded.length, 1, '应该只 load 一次')
  assert.equal(loaded[0].id, 'dsh-bagu')
})

test('有 factory，且是函数', () => {
  const { loaded } = boot()
  assert.equal(typeof loaded[0].factory, 'function')
})

test('factory 返回 inject + apply', () => {
  const { loaded, React } = boot()
  const def = loaded[0].factory((m) => {
    if (m === 'react') return React
    throw new Error('unexpected require: ' + m)
  })
  // vm 沙箱里的数组原型和外面不同，逐项比
  assert.equal(Array.from(def.inject).join(','), 'slots')
  assert.equal(typeof def.apply, 'function')
})

test('apply 会注入 CSS 并注册 settings.section', () => {
  const { loaded, React, styles } = boot()
  const def = loaded[0].factory(() => React)
  const registered = []
  const ctx = {
    get: () => ({
      inject: (_slot, fn) => fn(),
      register: (meta, fn) => { registered.push({ meta, fn }); return () => {} },
    }),
    effect: (fn) => fn,
  }
  def.apply(ctx)
  assert.equal(styles.length, 1, '应该注入一份 CSS')
  assert.equal(registered.length, 1)
  assert.equal(registered[0].meta.name, 'settings.section')
  assert.equal(registered[0].meta.id, 'bagu')
  assert.equal(registered[0].meta.label, '八股检测')
})

test('没有 slots 时不炸', () => {
  const { loaded, React, styles } = boot()
  const def = loaded[0].factory(() => React)
  const ctx = { get: () => ({}), effect: (fn) => fn }
  assert.doesNotThrow(() => def.apply(ctx))
  assert.equal(styles.length, 1, 'CSS 还是要注入')
})

test('register 的槽函数返回 Panel 元素', () => {
  const { loaded, React } = boot()
  const def = loaded[0].factory(() => React)
  const registered = []
  const ctx = {
    get: () => ({
      inject: (_s, fn) => fn(),
      register: (meta, fn) => { registered.push({ meta, fn }); return () => {} },
    }),
    effect: (fn) => fn,
  }
  def.apply(ctx)
  const el = registered[0].fn()
  assert.equal(typeof el, 'object')
  assert.equal(el.type.name, 'Panel', '槽里渲染的应该是 Panel')
})

test('API 前缀是 /api/bagu', () => {
  assert.ok(code.includes("'/api/bagu'"), 'client 必须打 /api/bagu')
})

test('三个接口都用上了：status / config / preview', () => {
  assert.ok(code.includes("jget('/status')"))
  assert.ok(code.includes("jpost('/config'"))
  assert.ok(code.includes("jpost('/preview'"))
})
