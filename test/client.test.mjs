import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const code = readFileSync(join(here, '..', 'client.js'), 'utf8')

/** 假沙箱：document + React + __ModuleLoader__ 都是假的。 */
function boot() {
  const loaded = []
  const styles = []
  const document = {
    head: { appendChild: (el) => styles.push(el) },
    createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }),
  }
  const React = {
    createElement: (type, props, ...kids) => ({ type, props: props || {}, kids }),
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

test('自注册：id 等于包名', () => {
  const { loaded } = boot()
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].id, 'dsh-bagu')
})

test('factory 返回 inject + apply', () => {
  const { loaded, React } = boot()
  const def = loaded[0].factory(() => React)
  assert.equal(Array.from(def.inject).join(','), 'slots')
  assert.equal(typeof def.apply, 'function')
})

test('apply 注入 CSS 并注册 settings.section', () => {
  const { loaded, React, styles } = boot()
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
  assert.equal(styles.length, 1)
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
  assert.equal(styles.length, 1)
})

test('CSS 只引用真实存在的 --dsw-alias-* 变量', () => {
  const { loaded, React } = boot()
  const def = loaded[0].factory(() => React)
  const ctx = { get: () => ({}), effect: (fn) => fn }
  def.apply(ctx)
  // 从 dsh-m 的 client bundle 里核对过的可用变量
  const KNOWN = new Set([
    '--dsw-alias-bg-base', '--dsw-alias-bg-elevated', '--dsw-alias-bg-hover',
    '--dsw-alias-fill-secondary', '--dsw-alias-interactive-bg-hover',
    '--dsw-alias-interactive-bg-selected', '--dsw-alias-border-l',
    '--dsw-alias-border-default', '--dsw-alias-label-primary',
    '--dsw-alias-label-secondary', '--dsw-alias-label-tertiary',
    '--dsw-alias-label-caption', '--dsw-alias-label-dimmed',
    '--dsw-alias-state-business-primary', '--dsw-alias-state-business-tertiary',
    '--dsw-alias-state-error-primary', '--dsw-alias-state-error-secondary',
  ])
  const used = [...code.matchAll(/var\((--dsw-alias-[a-z-]+)/g)].map((m) => m[1])
  const unknown = [...new Set(used)].filter((v) => !KNOWN.has(v))
  assert.deepEqual(unknown, [], '用到了不存在的变量: ' + unknown.join(', '))
})

test('CSS 每个 var() 都有回退值', () => {
  const bad = [...code.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1])
  assert.deepEqual(bad, [], '缺回退值: ' + bad.join(', '))
})

test('槽里渲染的是 Panel', () => {
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
  assert.equal(el.type.name, 'Panel')
})

test('接口是 /api/bagu 的三条', () => {
  assert.ok(code.includes("'/api/bagu'"))
  assert.ok(code.includes("jget('/status')"))
  assert.ok(code.includes("jpost('/config'"))
  assert.ok(code.includes("jpost('/preview'"))
})

test('preview 会带 full 开关', () => {
  assert.ok(code.includes('{ text, full }'), 'preview 请求体里要带 full')
})

test('没写死颜色值，只允许纯白', () => {
  // DSH 的设计变量里没有反色文字（没有 --dsw-alias-label-inverse 之类），
  // 所以蓝底按钮上的白字和开关圆点的白点只能写 #fff。白是唯一安全的中性色。
  const stray = [...code.matchAll(/(?:^|[;\s])(?:color|background)\s*:\s*(#[0-9a-fA-F]{3,8})/g)]
    .map((m) => m[1].toLowerCase())
    .filter((hex) => hex !== '#fff' && hex !== '#ffffff')
  assert.deepEqual(stray, [], '写死的颜色: ' + stray.join(', '))
})
