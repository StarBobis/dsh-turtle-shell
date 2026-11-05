import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProtocol, DEFAULT_TIER, resolveTier, TIERS } from '../src/protocol.js'

test('协议包含全部硬条款', () => {
  const text = buildProtocol({ tier: 'analysis' })
  for (const needle of [
    'L0',
    'L4',
    '[无判断]',
    '[叠甲已按用户要求关闭]',
    '豁免清单（封闭列表）',
    '禁止的退化路径',
    '至少 1 个具体限定动作',
    '2–3 个不同限定动作',
  ]) {
    assert.ok(text.includes(needle), `协议缺少：${needle}`)
  }
})

test('档位非法值回退到默认档', () => {
  assert.equal(resolveTier('nope'), DEFAULT_TIER)
  assert.equal(resolveTier(undefined), DEFAULT_TIER)
  assert.equal(resolveTier(''), DEFAULT_TIER)
  assert.equal(resolveTier('heavy'), 'heavy')
  assert.equal(resolveTier('normal'), 'normal')
})

test('每一档都渲染自己的档位行，且互不相同', () => {
  const rendered = new Set()
  for (const id of Object.keys(TIERS)) {
    const text = buildProtocol({ tier: id })
    assert.ok(text.includes(`当前默认档位：${TIERS[id].label}`), `${id} 缺少档位行`)
    assert.ok(text.includes('任何档位的下限都不是 0'), `${id} 缺少下限声明`)
    rendered.add(text)
  }
  assert.equal(rendered.size, Object.keys(TIERS).length)
})

test('协议正文不包含会破坏插值的花括号引用', () => {
  const text = buildProtocol({ tier: 'analysis' })
  assert.equal(/\{\{[a-z_]+\}\}/.test(text), false)
})
