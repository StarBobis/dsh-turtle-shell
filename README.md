# dsh-turtle-shell · 叠甲协议

把「每段都要有证据等级和范围限定」的叠甲文风，做成一个装一次就全局生效的 DSH 插件。左侧栏有一枚龟壳图标，点开是总开关、三档密度、协议原文和注入自检。

## 它到底做了什么

1. 往 `ctx.systemPrompt` 注册一个全局 section，名字 `turtle-shell:protocol`，order `10300`（排在 `deployment:persona-suffix` 之后）。
2. section 的正文是函数，**每个 model step 重新求值一次**——所以面板上一关，下一条消息立刻不带协议，不用重启、不用重开会话。
3. 状态落在 `$DSH_HOME/plugins-data/dsh-turtle-shell/state.json`，重启保留。

## 生效范围（重要）

- 全局段落会进入每一次 `systemPrompt.assemble()`：默认 preset、普通新会话、子代理都算。
- 例外：带 `complete: true` 的 agent preset（例如 Aurabot 私聊）在组装层会把自己变成**唯一** section，其它 section 被替换。这不是本插件的开关故障，是 `@deepseek-ai/dsh-system-prompt` 的既定语义（见 `assemble()`：`completeSection === undefined ? transformed.sections : [completeSection]`）。
- 想绕开这个例外，只能把协议文本搬进那个 preset 自己的 persona 里；本插件不主动改别人的 preset。

## 三档密度

| 档位 | 每段限定动作 | 说明 |
| --- | --- | --- |
| 普通 | 1 个 | 最低档，仍然不允许整段免叠 |
| 分析（默认） | 2–3 个 | 与 AGENTS.md 的默认档对齐 |
| 强叠甲 | 连续嵌套 | 允许嵌套，但必须正面回答原问题 |

## 面板

- **总开关**：开 / 关注入。
- **密度档位**：三选一，立即写盘。
- **协议原文**：展开看模型实际读到的全文。
- **自检注入**：调用一次 `systemPrompt.assemble()`，回读 section 在不在、多少字符、第几段。这是 L2 合成回读，只证明组装层收到了文本，不证明某条回复已经按它执行。

## HTTP

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/turtle-shell/api/state` | 当前开关、档位、字符数、组装计数 |
| POST | `/turtle-shell/api/config` | `{ enabled?: boolean, tier?: string }` |
| POST | `/turtle-shell/api/reset` | 恢复默认（启用 + 分析档） |
| GET | `/turtle-shell/api/protocol` | 协议全文 |
| POST | `/turtle-shell/api/probe` | 真组装一次并回读 section |

## 安装

```
plugin_manager({ action: "install_bundle", target: "C:\\Dev\\dsh-turtle-shell" })
```

本地目录安装是链接到 checkout，改完源码后需要重启 DSH 才会加载新的 JavaScript 代际。

## 开发

```
node --check src/host.js
node --check client/client.js
node --test test/protocol.test.js test/client-contract.test.js
```

`src/protocol.js` 是唯一文本来源：Host、面板、测试都读它，避免「面板显示的和模型读到的」分叉。
