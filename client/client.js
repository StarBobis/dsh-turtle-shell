// dsh-turtle-shell · 网页半边
// 左侧栏一枚龟壳图标 → 主面板：总开关、三档密度、协议原文、注入自检。
// 只读写宿主半边的 /turtle-shell/api/*，不直接碰会话。
// 视觉全部走 DSH 主题变量（--dsw-alias-*），浅色/深色自动跟随。

window.__ModuleLoader__.load({
  id: 'dsh-turtle-shell',
  factory: (require) => {
    const React = require('react')
    const { useCallback, useEffect, useRef, useState } = React
    const h = React.createElement

    const PANEL_ID = 'turtle-shell'
    const API = '/turtle-shell/api'
    const inject = ['slots']

    // ---------------- HTTP ----------------
    const fail = (error) => ({ ok: false, message: '连不上插件：' + ((error && error.message) || String(error)) })
    const getJSON = (path) => fetch(API + path, { cache: 'no-store' }).then((r) => r.json()).catch(fail)
    const postJSON = (path, body) =>
      fetch(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
        .then((r) => r.json())
        .catch(fail)

    const cx = (...list) => list.filter(Boolean).join(' ')

    // ---------------- 样式 ----------------
    const CSS = `
.ts-root{
  --ts-bg:var(--dsw-alias-bg-base,#fff);
  --ts-card:var(--dsw-alias-bg-layer-1,#fff);
  --ts-card2:var(--dsw-alias-bg-layer-2,#f6f8fa);
  --ts-line:var(--dsw-alias-border-l1,rgba(0,0,0,.08));
  --ts-line2:var(--dsw-alias-border-l2,rgba(0,0,0,.14));
  --ts-text:var(--dsw-alias-label-primary,#1f2328);
  --ts-sub:var(--dsw-alias-label-secondary,#57606a);
  --ts-dim:var(--dsw-alias-label-secondary,#8b949e);
  --ts-accent:var(--dsw-alias-brand-primary,#2f6f5e);
  --ts-ok:var(--dsw-alias-state-success-primary,#1a7f37);
  --ts-err:var(--dsw-alias-state-error-primary,#cf222e);
  --ts-warn:var(--dsw-alias-state-warn-primary,#bf8700);
  --ts-shell:#1d5c4b;
  --ts-shell-2:#5fbf9e;
  --ts-shell-3:rgba(29,92,75,.13);
  height:100%;overflow:auto;background:var(--ts-bg);color:var(--ts-text);
  font-size:13px;line-height:1.62;box-sizing:border-box;
  padding:var(--dsh-frame-top-clearance,24px) 0 56px;
  font-family:var(--dsh-font-family-ui,inherit);
}
body[data-ds-dark-theme] .ts-root{
  --ts-shell:#8fe0c0;--ts-shell-2:#7fd4b4;--ts-shell-3:rgba(143,224,192,.12);
}
.ts-wrap{max-width:980px;margin:0 auto;padding:0 28px;box-sizing:border-box}
.ts-hero{display:flex;align-items:center;gap:18px;padding:20px;border:1px solid var(--ts-line);
  border-radius:18px;background:linear-gradient(118deg,var(--ts-shell-3),transparent 62%),var(--ts-card);
  position:relative;overflow:hidden}
.ts-hero:after{content:"";position:absolute;right:-46px;bottom:-70px;width:240px;height:240px;border-radius:50%;
  background:radial-gradient(circle,var(--ts-shell-3),transparent 68%);pointer-events:none}
.ts-mark{width:86px;height:86px;flex:none;display:grid;place-items:center;border-radius:22px;
  background:var(--ts-card2);border:1px solid var(--ts-line);color:var(--ts-shell);position:relative;z-index:1}
.ts-hero-main{flex:1;min-width:0;position:relative;z-index:1}
.ts-hero h1{margin:0;font-size:21px;font-weight:650;letter-spacing:.6px}
.ts-hero-sub{margin:4px 0 0;color:var(--ts-sub);font-size:13px}
.ts-hero-side{display:flex;flex-direction:column;align-items:flex-end;gap:6px;position:relative;z-index:1}
.ts-switch-row{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ts-sub)}
.ts-hint{color:var(--ts-dim);font-size:12px}
.ts-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0 0}
.ts-stat{padding:12px 14px;border:1px solid var(--ts-line);border-radius:14px;background:var(--ts-card)}
.ts-stat .k{color:var(--ts-sub);font-size:12px}
.ts-stat .v{margin-top:2px;font-size:17px;font-weight:620;letter-spacing:.3px}
.ts-stat .v.ok{color:var(--ts-ok)}.ts-stat .v.off{color:var(--ts-dim)}
.ts-card{margin:14px 0 0;padding:16px 18px;border:1px solid var(--ts-line);border-radius:16px;background:var(--ts-card)}
.ts-card-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.ts-card-head h3{margin:0;font-size:14px;font-weight:620}
.ts-card-head .sp{flex:1}
.ts-sub{color:var(--ts-sub);font-size:12.5px;margin:0}
.ts-tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ts-tier{display:flex;flex-direction:column;gap:3px;align-items:flex-start;text-align:left;
  padding:12px 14px;border-radius:13px;border:1px solid var(--ts-line);background:var(--ts-card2);
  color:var(--ts-text);font:inherit;cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s}
.ts-tier b{font-size:13.5px;font-weight:620}
.ts-tier span{color:var(--ts-sub);font-size:12px}
.ts-tier:hover{border-color:var(--ts-line2)}
.ts-tier.on{border-color:var(--ts-shell-2);background:var(--ts-shell-3);box-shadow:0 0 0 1px var(--ts-shell-2) inset}
.ts-tier:disabled{cursor:default;opacity:.65}
.ts-note{margin:14px 0 0;padding:14px 16px;border-radius:14px;border:1px dashed var(--ts-line2);background:var(--ts-card2)}
.ts-note b{font-size:12.5px}
.ts-note p{margin:6px 0 0;color:var(--ts-sub);font-size:12.5px}
.ts-note code{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;padding:1px 5px;border-radius:5px;
  background:var(--ts-card);border:1px solid var(--ts-line)}
.ts-pre{margin:0;max-height:340px;overflow:auto;padding:14px 16px;border-radius:12px;border:1px solid var(--ts-line);
  background:var(--ts-card2);color:var(--ts-text);font-family:ui-monospace,Consolas,monospace;
  font-size:11.8px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.ts-link{border:0;background:transparent;color:var(--ts-accent);font:inherit;font-size:12.5px;cursor:pointer;padding:2px 4px;border-radius:6px}
.ts-link:hover{background:var(--ts-card2)}
.ts-actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
.ts-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:10px;
  border:1px solid var(--ts-line2);background:var(--ts-card);color:var(--ts-text);font:inherit;font-size:12.5px;
  cursor:pointer;transition:background .15s,border-color .15s}
.ts-btn:hover{border-color:var(--ts-shell-2);background:var(--ts-card2)}
.ts-btn.primary{border-color:var(--ts-shell-2);background:var(--ts-shell-3);color:var(--ts-shell);font-weight:600}
.ts-btn:disabled{cursor:default;opacity:.6}
.ts-btn .spin{width:10px;height:10px;border-radius:50%;border:1.5px solid currentColor;border-top-color:transparent;
  animation:ts-spin .8s linear infinite}
@keyframes ts-spin{to{transform:rotate(360deg)}}
.ts-switch{position:relative;width:42px;height:24px;border-radius:999px;border:1px solid var(--ts-line2);
  background:var(--ts-card2);cursor:pointer;padding:0;transition:background .18s,border-color .18s;flex:none}
.ts-switch:after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
  background:var(--ts-dim);transition:transform .18s,background .18s}
.ts-switch.on{border-color:var(--ts-shell-2);background:var(--ts-shell-3)}
.ts-switch.on:after{transform:translateX(18px);background:var(--ts-shell)}
.ts-switch:disabled{opacity:.55;cursor:default}
.ts-probe{margin:12px 0 0;padding:10px 14px;border-radius:12px;font-size:12.5px;border:1px solid var(--ts-line);background:var(--ts-card2)}
.ts-probe.ok{border-color:var(--ts-ok);color:var(--ts-ok)}
.ts-probe.bad{border-color:var(--ts-warn);color:var(--ts-warn)}
.ts-error{margin:12px 0 0;padding:10px 14px;border-radius:12px;border:1px solid var(--ts-err);color:var(--ts-err);font-size:12.5px}
.ts-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:40;padding:8px 16px;border-radius:10px;
  background:var(--ts-text);color:var(--ts-bg);font-size:12.5px;box-shadow:0 6px 24px rgba(0,0,0,.18)}
.ts-empty{padding:40px 8px;color:var(--ts-sub);font-size:13px}
.ts-foot{margin:22px 0 0;color:var(--ts-dim);font-size:12px;line-height:1.7}
@media (max-width:820px){.ts-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ts-tiers{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.ts-root *{transition:none!important;animation:none!important}}
`

    // ---------------- 图标 ----------------
    function ShellMark({ size }) {
      const s = size || 24
      return h(
        'svg',
        {
          width: s,
          height: s,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('ellipse', { cx: 12, cy: 12.6, rx: 8.6, ry: 6.8 }),
        h('path', { d: 'M12 5.8 16.6 9.2l-1.8 5.9H9.2L7.4 9.2z' }),
        h('path', { d: 'M3.4 12.6h2M10.3 6.2l.9 1.8M13.7 6.2l-.9 1.8M20.6 12.6h-2M10.3 19.6l.9-1.8M13.7 19.6l-.9-1.8' }),
      )
    }

    // ---------------- 小控件 ----------------
    function Switch({ on, onChange, disabled }) {
      return h('button', {
        type: 'button',
        className: cx('ts-switch', on && 'on'),
        role: 'switch',
        'aria-checked': !!on,
        disabled,
        onClick: () => {
          if (!disabled) onChange(!on)
        },
      })
    }

    function Btn({ onClick, disabled, primary, busy, children }) {
      return h(
        'button',
        {
          type: 'button',
          className: cx('ts-btn', primary && 'primary'),
          disabled: disabled || busy,
          onClick: () => {
            if (!disabled && !busy) onClick()
          },
        },
        busy ? h('i', { className: 'spin' }) : null,
        children,
      )
    }

    // ---------------- 主面板 ----------------
    function Panel() {
      const [snapshot, setSnapshot] = useState(null)
      const [loading, setLoading] = useState(true)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [toast, setToast] = useState('')
      const [showProtocol, setShowProtocol] = useState(false)
      const [protocolText, setProtocolText] = useState('')
      const [probe, setProbe] = useState(null)
      const toastTimer = useRef(null)
      const alive = useRef(true)

      useEffect(() => {
        alive.current = true
        return () => {
          alive.current = false
          if (toastTimer.current) clearTimeout(toastTimer.current)
        }
      }, [])

      const flash = useCallback((text) => {
        setToast(text)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => {
          if (alive.current) setToast('')
        }, 1800)
      }, [])

      const load = useCallback(async () => {
        setBusy('refresh')
        const next = await getJSON('/state')
        if (!alive.current) return
        if (next && next.ok) {
          setSnapshot(next)
          setError('')
        } else {
          setError((next && next.message) || '读不到插件状态')
        }
        setLoading(false)
        setBusy('')
      }, [])

      useEffect(() => {
        load()
      }, [load])

      const update = useCallback(
        async (patch, label) => {
          setBusy(label)
          const next = await postJSON('/config', patch)
          if (!alive.current) return
          if (next && next.ok) {
            setSnapshot(next)
            setError('')
            if (label === 'toggle') flash(next.enabled ? '已开启：下一条消息带上协议' : '已关闭：下一条消息不再注入')
            else flash('档位已切换')
          } else {
            setError((next && next.message) || '保存失败')
          }
          setBusy('')
        },
        [flash],
      )

      const reset = useCallback(async () => {
        setBusy('reset')
        const next = await postJSON('/reset')
        if (!alive.current) return
        if (next && next.ok) {
          setSnapshot(next)
          setError('')
          setShowProtocol(false)
          setProtocolText('')
          setProbe(null)
          flash('已恢复默认')
        } else {
          setError((next && next.message) || '重置失败')
        }
        setBusy('')
      }, [flash])

      const toggleProtocol = useCallback(async () => {
        if (showProtocol) {
          setShowProtocol(false)
          return
        }
        setBusy('protocol')
        const next = await getJSON('/protocol')
        if (!alive.current) return
        if (next && next.ok) {
          setProtocolText(next.text)
          setShowProtocol(true)
          setError('')
        } else {
          setError((next && next.message) || '读不到协议原文')
        }
        setBusy('')
      }, [showProtocol])

      const runProbe = useCallback(async () => {
        setBusy('probe')
        const next = await postJSON('/probe')
        if (!alive.current) return
        if (next && next.ok) {
          setProbe(next)
          setError('')
        } else {
          setError((next && next.message) || '自检失败')
        }
        setBusy('')
      }, [])

      if (!snapshot) {
        return h(
          'div',
          { className: 'ts-root' },
          h('style', null, CSS),
          h('div', { className: 'ts-wrap' }, h('div', { className: 'ts-empty' }, error || (loading ? '读取插件状态…' : '未取得状态'))),
        )
      }

      const currentTier = snapshot.tiers.find((tier) => tier.id === snapshot.tier)
      const tierLabel = currentTier ? currentTier.label : snapshot.tier

      return h(
        'div',
        { className: 'ts-root' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'ts-wrap' },
          // hero
          h(
            'div',
            { className: 'ts-hero' },
            h('div', { className: 'ts-mark' }, h(ShellMark, { size: 52 })),
            h(
              'div',
              { className: 'ts-hero-main' },
              h('h1', null, '叠甲协议'),
              h(
                'p',
                { className: 'ts-hero-sub' },
                'L0–L4 证据等级 + 每段限定动作 · 当前档位 ' + tierLabel + '（' + (currentTier ? currentTier.hint : '') + '）',
              ),
            ),
            h(
              'div',
              { className: 'ts-hero-side' },
              h(
                'div',
                { className: 'ts-switch-row' },
                h('span', null, snapshot.enabled ? '已启用' : '已停用'),
                h(Switch, {
                  on: snapshot.enabled,
                  disabled: busy === 'toggle',
                  onChange: (value) => update({ enabled: value }, 'toggle'),
                }),
              ),
              h('small', { className: 'ts-hint' }, '改完下一条消息生效，不用重启'),
            ),
          ),

          // stats
          h(
            'div',
            { className: 'ts-stats' },
            h(
              'div',
              { className: 'ts-stat' },
              h('div', { className: 'k' }, '注入状态'),
              h('div', { className: cx('v', snapshot.enabled ? 'ok' : 'off') }, snapshot.enabled ? '已挂载' : '已关闭'),
            ),
            h(
              'div',
              { className: 'ts-stat' },
              h('div', { className: 'k' }, '当前档位'),
              h('div', { className: 'v' }, tierLabel),
            ),
            h(
              'div',
              { className: 'ts-stat' },
              h('div', { className: 'k' }, '已组装次数'),
              h('div', { className: 'v' }, String(snapshot.stats.assembles)),
            ),
            h(
              'div',
              { className: 'ts-stat' },
              h('div', { className: 'k' }, '注入字符'),
              h('div', { className: 'v' }, String(snapshot.protocol.chars)),
            ),
          ),

          // tiers
          h(
            'div',
            { className: 'ts-card' },
            h(
              'div',
              { className: 'ts-card-head' },
              h('h3', null, '密度档位'),
              h('div', { className: 'sp' }),
              h('span', { className: 'ts-sub' }, '默认档：分析'),
            ),
            h(
              'div',
              { className: 'ts-tiers' },
              snapshot.tiers.map((tier) =>
                h(
                  'button',
                  {
                    key: tier.id,
                    type: 'button',
                    className: cx('ts-tier', snapshot.tier === tier.id && 'on'),
                    disabled: Boolean(busy),
                    onClick: () => update({ tier: tier.id }, 'tier'),
                  },
                  h('b', null, tier.label),
                  h('span', null, tier.hint),
                ),
              ),
            ),
          ),

          // 生效范围
          h(
            'div',
            { className: 'ts-note' },
            h('b', null, '生效范围'),
            h(
              'p',
              null,
              '协议作为全局系统提示词段落 ',
              h('code', null, snapshot.plugin.section),
              '（order ',
              String(snapshot.plugin.order),
              '）注入，排在 deployment:persona-suffix 之后，每个 model step 重新求值一次。',
            ),
            h(
              'p',
              null,
              '带 ',
              h('code', null, 'complete: true'),
              ' 的 agent preset（例如 Aurabot 私聊）会独占系统提示词，这一段会被替换掉——那是组装层的既定语义，不是开关故障。',
            ),
          ),

          // 协议原文
          h(
            'div',
            { className: 'ts-card' },
            h(
              'div',
              { className: 'ts-card-head' },
              h('h3', null, '协议原文'),
              h('div', { className: 'sp' }),
              h(
                'button',
                { type: 'button', className: 'ts-link', onClick: toggleProtocol, disabled: busy === 'protocol' },
                showProtocol ? '收起' : '展开',
              ),
            ),
            showProtocol
              ? h('pre', { className: 'ts-pre' }, protocolText || '读取中…')
              : h('p', { className: 'ts-sub' }, '共 ' + String(snapshot.protocol.chars) + ' 字符。点「展开」看模型实际读到的全文。'),
          ),

          // actions
          h(
            'div',
            { className: 'ts-actions' },
            h(Btn, { onClick: load, busy: busy === 'refresh' }, '刷新'),
            h(Btn, { onClick: runProbe, busy: busy === 'probe' }, '自检注入'),
            h(Btn, { onClick: reset, busy: busy === 'reset' }, '恢复默认'),
          ),

          probe
            ? h(
                'div',
                { className: cx('ts-probe', probe.found && probe.chars > 0 ? 'ok' : 'bad') },
                probe.found && probe.chars > 0
                  ? '组装结果里找到了这段：' +
                    String(probe.chars) +
                    ' 字符，order ' +
                    String(probe.order) +
                    '；当前共 ' +
                    String(probe.sectionCount) +
                    ' 段 section。这只证明组装层收到了文本，不证明某条回复已经按它执行。'
                  : probe.found
                    ? '段落还在组装结果里，但文本是空的（0 字符）：开关关着时这是预期行为，它不会被最终提示词采用。'
                    : '组装结果里没有找到这段：开关 enabled=' +
                      String(probe.enabled) +
                      '，当前 ' +
                      String(probe.sectionCount) +
                      ' 段 section。插件可能被禁用，或注册的上下文已经被拆掉。',
              )
            : null,

          error ? h('div', { className: 'ts-error' }, error) : null,

          h(
            'p',
            { className: 'ts-foot' },
            '状态文件：$DSH_HOME/plugins-data/' + snapshot.plugin.id + '/state.json（重启保留）。',
            h('br'),
            '插件版本 ' + snapshot.plugin.version + ' · 服务端口与路由见 /turtle-shell/api/state。',
          ),
        ),
        toast ? h('div', { className: 'ts-toast', role: 'status' }, toast) : null,
      )
    }

    // ---------------- 挂载 ----------------
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return
      slots.inject('main', () => slots.register({ name: 'main', key: PANEL_ID }, Panel))
      slots.inject('sidebar.panellist', () =>
        slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: () => '叠甲' }, ShellMark),
      )
    }

    return { inject, apply }
  },
})
