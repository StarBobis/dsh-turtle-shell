import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'client', 'client.js')
const source = readFileSync(bundlePath, 'utf8')

/** 用最小沙箱执行 client bundle，截获 `__ModuleLoader__.load` 的声明。 */
function loadBundle() {
  let declared = null
  const sandbox = {
    window: { __ModuleLoader__: { load: (spec) => { declared = spec } } },
    console,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ json: async () => ({ ok: false }) }),
  }
  vm.runInNewContext(source, sandbox, { filename: bundlePath })
  return declared
}

/** 只实现 client 代码实际用到的 React 表面。 */
function fakeReact() {
  return {
    createElement: () => null,
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useRef: (initial) => ({ current: initial }),
  }
}

function mountWith(slots) {
  const declared = loadBundle()
  assert.ok(declared, 'client bundle 没有调用 __ModuleLoader__.load')
  const factory = declared.factory
  const mod = factory((name) => (name === 'react' ? fakeReact() : {}))
  const registrations = []
  const ctx = {
    get(name) {
      if (name === 'slots') return slots(registrations)
      return undefined
    },
  }
  mod.apply(ctx)
  return { declared, mod, registrations }
}

function defaultSlots(registrations) {
  return {
    inject(slotName, callback) {
      callback()
      return () => {}
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  }
}

test('bundle 声明的 id 等于包名', () => {
  const declared = loadBundle()
  assert.equal(declared.id, 'dsh-turtle-shell')
  assert.equal(typeof declared.factory, 'function')
})

test('模块注入 slots，并同时注册侧栏图标与主面板', () => {
  const { mod, registrations } = mountWith(defaultSlots)
  assert.deepEqual([...mod.inject], ['slots'])
  assert.equal(registrations.length, 2)

  const main = registrations.find((r) => r.options.name === 'main')
  assert.ok(main, '缺少 main 面板注册')
  assert.equal(main.options.key, 'turtle-shell')
  assert.equal(typeof main.component, 'function')

  const icon = registrations.find((r) => r.options.name === 'sidebar.panellist')
  assert.ok(icon, '缺少 sidebar.panellist 图标注册')
  assert.equal(icon.options.id, 'turtle-shell')
  assert.equal(icon.options.order, 30)
  assert.equal(typeof icon.options.label, 'function')
  assert.equal(icon.options.label(), '叠甲')
  assert.equal(typeof icon.component, 'function')
})

test('slots 服务缺席时安静退出，不抛错', () => {
  const declared = loadBundle()
  const mod = declared.factory((name) => (name === 'react' ? fakeReact() : {}))
  const ctx = { get: () => undefined }
  assert.doesNotThrow(() => mod.apply(ctx))
})

test('面板组件可以单独求值（不依赖调用 React hooks 的顺序副作用）', () => {
  const { registrations } = mountWith(defaultSlots)
  const main = registrations.find((r) => r.options.name === 'main')
  // Panel 内部走 hooks；这里只验证它是零参函数且不抛错地返回 React 元素占位。
  assert.equal(main.component.length, 0)
  const element = main.component()
  assert.equal(element, null, '假 React 的 createElement 返回 null')
})
