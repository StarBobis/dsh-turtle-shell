/**
 * dsh-turtle-shell · Host 半边
 *
 * 两件事：
 * 1. 往 ctx.systemPrompt 里注册一个全局 section。section 的 text 是函数，
 *    每个 model step 重新求值一次，所以面板上开关一关，下一条消息立刻不带协议，
 *    不需要重启、不需要重开会话。
 * 2. 注册 /turtle-shell/api/* 路由，供左侧栏面板读写开关、档位与协议原文。
 *
 * 状态落在 $DSH_HOME/plugins-data/dsh-turtle-shell/state.json，重启保留。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { buildProtocol, DEFAULT_TIER, protocolDigest, resolveTier, TIERS, tierMeta } from './protocol.js'

const PLUGIN_ID = 'dsh-turtle-shell'
const VERSION = '0.1.0'
const SECTION_NAME = 'turtle-shell:protocol'
/** 排在 deployment:persona-suffix（10200）之后，让模型最后读到。 */
const SECTION_ORDER = 10300
const PREFIX = '/turtle-shell/api'

export const name = PLUGIN_ID
export const inject = ['systemPrompt', 'webServer']

const DEFAULTS = Object.freeze({ enabled: true, tier: DEFAULT_TIER })

function dataDir() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'plugins-data', PLUGIN_ID)
}

function statePath() {
  return join(dataDir(), 'state.json')
}

/** 读盘失败一律退回默认值：状态文件坏了不应该让插件起不来。 */
function loadState() {
  try {
    const raw = JSON.parse(readFileSync(statePath(), 'utf8'))
    return {
      enabled: raw && raw.enabled !== false,
      tier: resolveTier(raw && raw.tier),
      revision: Number(raw && raw.revision) || 0,
      updatedAt: Number(raw && raw.updatedAt) || 0,
    }
  } catch {
    return { ...DEFAULTS, revision: 0, updatedAt: 0 }
  }
}

function persist(state) {
  mkdirSync(dataDir(), { recursive: true })
  writeFileSync(
    statePath(),
    JSON.stringify(
      { enabled: state.enabled, tier: state.tier, revision: state.revision, updatedAt: state.updatedAt },
      null,
      2,
    ),
    'utf8',
  )
}

function send(res, code, body) {
  const text = JSON.stringify(body)
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-length', Buffer.byteLength(text))
  res.end(text)
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (raw === '') return {}
  const parsed = JSON.parse(raw)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  return parsed
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const state = loadState()
  const stats = { assembles: 0, lastAssembledAt: 0, lastChars: 0, since: Date.now() }

  const activeText = () => (state.enabled ? buildProtocol({ tier: state.tier }) : '')

  // ---------- 1. 系统提示词 ----------
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: SECTION_ORDER,
        // 返回空串时组装层会整段丢掉，等于「关闭」；不需要重新注册。
        text: () => {
          const text = activeText()
          if (text !== '') {
            stats.assembles += 1
            stats.lastAssembledAt = Date.now()
            stats.lastChars = text.length
          }
          return text
        },
        // 协议正文不参与 {{变量}} 插值：用户以后在正文里写花括号不会被当成变量。
        interpolate: false,
      }),
    'turtle-shell: 提示词 section',
  )

  // ---------- 2. 面板接口 ----------
  const route = (method, path, handler) =>
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: 'exact',
          path: PREFIX + path,
          handler: (req, res) => {
            if ((req.method || 'GET').toUpperCase() !== method) {
              send(res, 405, { ok: false, message: `只接受 ${method}` })
              return
            }
            Promise.resolve()
              .then(() => handler(req, res))
              .catch((error) => {
                try {
                  send(res, 500, { ok: false, message: String((error && error.message) || error) })
                } catch {
                  /* 响应已经发出去时二次 send 会抛，忽略 */
                }
              })
          },
        }),
      `turtle-shell: 路由 ${method} ${path}`,
    )

  const snapshot = () => {
    const text = activeText()
    return {
      ok: true,
      plugin: { id: PLUGIN_ID, version: VERSION, section: SECTION_NAME, order: SECTION_ORDER },
      enabled: state.enabled,
      tier: state.tier,
      tiers: Object.values(TIERS).map((tier) => ({ id: tier.id, label: tier.label, hint: tier.hint })),
      digest: protocolDigest({ tier: state.tier }),
      protocol: { chars: text.length, title: tierMeta(state.tier).label },
      stats: { ...stats, uptimeMs: Date.now() - stats.since },
      revision: state.revision,
      updatedAt: state.updatedAt,
    }
  }

  route('GET', '/state', async (req, res) => send(res, 200, snapshot()))

  route('POST', '/config', async (req, res) => {
    const body = await readJson(req)
    let changed = false
    if (typeof body.enabled === 'boolean' && body.enabled !== state.enabled) {
      state.enabled = body.enabled
      changed = true
    }
    if (typeof body.tier === 'string') {
      const next = resolveTier(body.tier)
      if (next !== state.tier) {
        state.tier = next
        changed = true
      }
    }
    if (changed) {
      state.revision += 1
      state.updatedAt = Date.now()
      persist(state)
    }
    send(res, 200, { ...snapshot(), changed })
  })

  route('POST', '/reset', async (req, res) => {
    state.enabled = DEFAULTS.enabled
    state.tier = DEFAULTS.tier
    state.revision += 1
    state.updatedAt = Date.now()
    persist(state)
    send(res, 200, { ...snapshot(), changed: true })
  })

  route('GET', '/protocol', async (req, res) =>
    send(res, 200, { ok: true, tier: state.tier, enabled: state.enabled, text: buildProtocol({ tier: state.tier }) }),
  )

  // 面板上的「自检注入」：真的组装一次系统提示词，回读我们那段在不在。
  // 这是 L2 合成回读，只能证明「组装层收到了这段文本」，不能证明某一条回复已经按它执行。
  route('POST', '/probe', async (req, res) => {
    const assembly = await ctx.systemPrompt.assemble()
    const hit = assembly.sections.find((section) => section.name === SECTION_NAME)
    send(res, 200, {
      ok: true,
      enabled: state.enabled,
      found: Boolean(hit),
      chars: hit ? hit.text.length : 0,
      // 组装后的 section 只保留 name/text/interpolate，order 得用注册时的常量。
      order: SECTION_ORDER,
      sectionCount: assembly.sections.length,
      contextCount: assembly.contexts.length,
      toolCount: assembly.tools.length,
      firstLine: hit ? hit.text.split('\n')[0] : '',
    })
  })

  ctx.logger?.info?.(
    `[turtle-shell] 已挂载：section=${SECTION_NAME} order=${SECTION_ORDER} enabled=${state.enabled} tier=${state.tier}`,
  )
}
