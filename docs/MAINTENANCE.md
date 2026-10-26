# 维护约定

这是 `dsh-plugins` 的执行细则：维护节奏、SLA、版本与弃用、状态迁移、安全处理。

**对外承诺以 [`README.md`](../README.md) 的「提意见与维护承诺」为准**，本文件只是把承诺翻译成可执行的步骤。两者不一致时先改 README，再改这里。

## 1. 维护节奏

| 节奏 | 时间 | 做什么 | 能看到的证据 |
| --- | --- | --- | --- |
| 每周 triage | 每周三晚 | 过一遍新 Issue / Discussion：打标签（`idea` / `maintenance` / `hub`）、分类、给第一次回复 | 每个新 Issue 至少有一个标签和一条维护者回复 |
| 每月盘点 | 每月第一个周末 | 对照 `catalog.json` 逐条核对版本号、repo 链接、状态；关掉过期 Issue 或给出时间表 | `catalog.json` 的 `updated` 更新；盘点后 `npm run verify` 通过 |
| 每次发版 | 插件仓库发版时 | README / CHANGELOG / tag / npm 四处同步；0.x 破坏性变更提前一个版本提示 | `vX.Y.Z` tag + npm `latest` + CHANGELOG 条目 |
| 每个 PR | 收到后 3 天内 | 给 review 意见或直接合并 | PR 上有 review 或合并记录 |
| 在线检查 | 每周一（CI 定时任务） | `node scripts/check.mjs --online`：npm 版本与 `catalog.json` 是否一致、repo 是否可达；失败自动开 Issue | Actions 运行记录 + 自动 Issue |

每周三晚 triage 保证最坏情况：周四之后提的 Issue 会在下周三处理，落在第 7 天内。

## 2. SLA

| 事项 | 承诺（同 README） | 从何时起算 | 怎么算做到 |
| --- | --- | --- | --- |
| Issue（插件仓库 / 本仓库）首次响应 | 7 天内 | Issue 创建时间 | Issue 下有维护者回复并给出下一步（例：「已确认，下个 patch 修」或「需要你补日志」） |
| Discussion 首次响应 | 尽量 7 天内 | 发帖时间 | 同上 |
| 小修发版 | ≤ 14 天 | 确认可复现起算；等你补充环境 / 步骤时暂停 | npm 出现修复版本 + 插件仓库 CHANGELOG 有对应条目 |
| 不做的需求 | 7 天内给理由 | Issue 创建时间 | 关闭评论里有原因 + 替代方案 |
| PR review | 3 天内 | PR 创建时间 | 有 review 意见或已合并 |
| 安全报告 | 见第 6 节 | 收到报告 | 私密渠道回复确认并同步进度 |

这组数字写在 README 里。如果持续做不到，先改 README 的表并说明原因，不悄悄降级。

## 3. 版本与弃用

### 0.x 阶段（当前）

- **minor 版本允许破坏性变更**（`0.1 → 0.2`）。patch 只修 bug，不做破坏性改动。
- 破坏性变更必须**提前一个版本在 README 提示**，并在 CHANGELOG 标 `BREAKING`。
- 具体节奏：

| 版本 | 插件仓库要做的 | 用户会看到 |
| --- | --- | --- |
| N（提示版） | README 写明「`0.N+1` 将移除 / 改掉 X，替代方案是 Y」；CHANGELOG 加 `### Deprecated`；本仓库 `catalog.json` 的 `version` 同步 | 新版本照常可用，但 README 已预告 |
| N+1（变更版） | 执行变更；CHANGELOG 用 `### Changed` + `BREAKING` 写清迁移步骤 | 升级即遇到变更，按 CHANGELOG 迁移 |

本仓库的 `catalog.json` 只是一条索引：插件的 README / CHANGELOG 在插件仓库，破坏性变更的说明以插件仓库为准。

### 1.0 之后

- 遵循 SemVer：破坏性变更只出现在 major；minor 只加功能；patch 只修 bug。
- 弃用公告（`Deprecated`）与真正移除之间**至少隔 1 个 minor**。

### 弃用与下架

1. 先在文档和 CHANGELOG 标 `Deprecated`，写清替代方案和预计移除版本。
2. 用 npm 给旧的版本范围打弃用标记（空消息 = 撤销标记）：

   ```sh
   npm deprecate dsh-plugin-resolver@"<0.2.0" "0.2.0 起改用 xxx，见 https://github.com/sakikoTGW/dsh-plugin-resolver/blob/main/CHANGELOG.md"
   npm deprecate dsh-plugin-resolver@"<0.2.0" ""
   ```

3. 到点再移除；CHANGELOG 用 `### Removed`，必要时标 `BREAKING`。
4. 已发布版本不重写历史：不改已 publish 的版本号，问题发新 patch 修。不轻易 `npm unpublish`（会让锁定了该版本的用户装不上）。

## 4. 状态定义与迁移

状态值写在 `catalog.json` 的 `status` 字段，README 的表格由 `npm run render` 生成：

| 中文状态 | `status` | 含义（同 README） | 允许的下一步 |
| --- | --- | --- | --- |
| 可用 | `live` | 有版本、能装、在用；接口可能小幅演进，破坏性改动会写进 CHANGELOG | `beta`（发现接口还要改）/ `archived` |
| Beta | `beta` | 能用，但接口 / 行为还会变 | `live` / `archived` |
| 开发中 | `wip` | 还没发布，能看进度，不建议装 | `beta` / `archived` / 取消条目 |
| 计划中 | `planned` | 场景明确，还没动工 | `wip` / 取消条目 |
| 已归档 | `archived` | 不再维护，会在条目里给出替代方案 | 不回退；重开需要新的验收 |

迁移规则：

- 状态变更和版本变更放在**同一个 catalog PR** 里，改完 `npm run render`，README 自动同步。
- 升 `live` 的验收：在一个干净 profile 里 `dsh plugin --profile <profile> add <包名>` 能装上并生效。
- 归档 / 取消：在条目文字（`summary` 或 `feedback`）里写替代方案，然后 `npm run render`。
- 「计划中」取消也适用**不做静默放弃**：Issue 里写原因 + 替代方案再关闭，条目不声不响消失不算数。

## 5. 发版后三步

| 步骤 | 做什么 | 失败会怎样 |
| --- | --- | --- |
| 1. 插件仓库 | `vX.Y.Z` tag + npm 发布预构建产物 + CHANGELOG 条目 | 用户装到旧代码 / 市场索引版本对不上 |
| 2. 本仓库 | 改 `catalog.json` 的 `version`、`updated` → `npm run render` → `npm run verify` | CI 的 validate 失败；README 与 catalog 不一致 |
| 3. 核对 | `node scripts/check.mjs --online`（CI 每周一也会跑） | 版本漂移，在线检查自动开 Issue |

## 6. 安全漏洞

**不要开公开 Issue**，也不要在 Discussions 里贴利用细节或 PoC。

| 插件 | 私密报告渠道 |
| --- | --- |
| `dsh-plugin-resolver`（有独立仓库） | 仓库 **Security → Advisories → Report a vulnerability**（GitHub 私密漏洞报告 / Security Advisory） |
| `dsh-element-picker`（只有 npm 包页，独立仓库整理中） | 先在本仓库 Discussions 发帖**只说明「需要私下报告安全问题」**，不要贴细节，由维护者转到私密渠道；独立仓库建好后统一走 Security Advisory |

处理流程：

1. 在私密渠道确认收到，评估影响范围与受影响版本。
2. 修复 → 发新版本；CHANGELOG 用 `### Security` 记录（在细节可以公开之前，先写「已修复，细节待披露」）。
3. 评估是否公开 advisory；给报告者 credit（如果对方愿意）。
4. 私密渠道同步进度，不在公开 Issue 里讨论未修复的漏洞。

## 7. 改这份文档

- 与承诺相关的改动，必须在同一个 PR 里同时改 [`README.md`](../README.md)，否则 CI 之外的「承诺」会漂移。
- 本文件的章节被 README 或 Issue 模板引用时，改标题要同步改引用链接。
