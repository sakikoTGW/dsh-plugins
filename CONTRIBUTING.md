# 参与 dsh-plugins

这个仓库是**索引 + 约定 + 反馈闭环**，不是插件源码仓库：每个插件各自一个仓库、一个 npm 包。本仓库只收索引、文档和跨插件问题。

先读这两份，能省一轮来回：

- [`README.md`](README.md)：目录、安装方式、状态含义，以及**对外承诺**。
- [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md)：承诺的执行细则（节奏、SLA、版本与弃用、安全处理）。

## 1. 先选对渠道

| 渠道 | 用来提什么 | 响应承诺 |
| --- | --- | --- |
| 插件仓库 **Issue** | 某个插件坏了 / 行为不对 / 想加功能 | **7 天内**首次回应；小修 ≤ 14 天发版 |
| 本仓库 **Issue** | 想让我做一个新插件、索引有错漏、催更某个插件 | **7 天内**首次回应；不做的需求 7 天内给出理由 |
| **Discussions** | 用法提问、想法交流、还没想清楚该不该做的东西 | 尽量 7 天内 |
| **PR** | 文档 / 索引修正；插件代码请提到插件自己的仓库 | **3 天内**给 review 意见或直接合并 |

本仓库 Issue 有三个模板，按用途选（空白 Issue 已关闭）：

| 模板 | 什么时候用 | 关键必填项 |
| --- | --- | --- |
| [新插件建议 / 自荐](https://github.com/sakikoTGW/dsh-plugins/issues/new?template=plugin_idea.yml) | 想让我做一个新插件，或你自己想做一个并希望收录 | 具体日常问题、现在怎么绕过、期望行为、是否愿意提 PR |
| [维护请求 / 催更](https://github.com/sakikoTGW/dsh-plugins/issues/new?template=maintenance.yml) | 某个插件该修 / 该更新，或想催一个时间点 | 哪个插件、插件版本、影响程度、期望时间 |
| [本仓库问题](https://github.com/sakikoTGW/dsh-plugins/issues/new?template=repo_issue.yml) | 索引错漏、链接失效、文档问题、CI 问题 | 位置、期望怎么改 |

当前两个插件的反馈入口：

| 插件 | 反馈入口 | 说明 |
| --- | --- | --- |
| `dsh-plugin-resolver` | [仓库 Issues](https://github.com/sakikoTGW/dsh-plugin-resolver/issues) | 有独立仓库；版本、CHANGELOG、Issue 都在那里 |
| `dsh-element-picker` | 本仓库「维护请求」模板（暂） | 独立仓库整理中；当前版本可看 [npm 包页](https://www.npmjs.com/package/dsh-element-picker)。仓库开源后转到仓库 Issue |

## 2. 提 Issue 要写清什么

意见不用客气，但要让问题**可复现、可判断**。模板已经把下面几项列好了：

| 要素 | 写什么 | 例子 |
| --- | --- | --- |
| 插件 + 版本 | npm 包名 + 版本号 | `dsh-element-picker@0.2.1` |
| DSH 版本 | 你正在用的内核版本，对照插件的 `engines.dsh` | `0.2.0-rc.2` |
| 复现步骤 | 编号、最小化；能贴命令就贴命令 | 1. 启动 `dsh --profile web` 2. 在输入框选中一段文字 3. 期望出现引用芯片 |
| 期望 vs 实际 | 分开写，各一句 | 期望：出现芯片；实际：没有反应 |
| 日志 / 截图 | 报错原文、终端输出、界面截图 | 复制完整报错，不要只写「报错了」 |
| 环境 | 系统、Node 版本、profile 名 | Windows 11 / Node 24 / `web` |

贴日志前先脱敏：去掉私有路径、token、公司内网地址和别人的个人信息。安全问题不要开公开 Issue（见 [MAINTENANCE 第 6 节](docs/MAINTENANCE.md#6-安全漏洞)）。

## 3. 一个 Issue 怎么变成版本

| 步骤 | 发生什么 | 你会看到 |
| --- | --- | --- |
| 1. triage | 每周三晚过一遍新 Issue：打标签、分类、给第一次回复 | Issue 上有 `idea` / `maintenance` / `hub` 标签 + 维护者回复 |
| 2. 给结论 | 采纳 / 延后 / 不做。延后和**不做必须写原因 + 替代方案**（不做静默放弃） | Issue 评论 |
| 3. 排期 | 采纳的给目标版本或时间表；小修 ≤ 14 天发版 | Issue 评论里的版本号 / 时间 |
| 4. 修复发版 | 插件仓库改代码、跑测试、发 npm、打 `vX.Y.Z` tag | 插件仓库 PR + npm 新版本 |
| 5. 记录 | 在插件仓库 CHANGELOG 写清改了什么；Issue 关闭并引用版本 | CHANGELOG 条目 + Issue 关闭评论 |

Discussions 里的问题如果变成可执行的需求，会转成 Issue 再走上面这条流水线。

## 4. PR 规则

- **一事一 PR**：不混文档、目录、格式大改；无关的顺手修另开 PR。
- **必须贴验证证据**：命令 + 实际输出。写「应该没问题」不算。
- **CI 必须绿**（`validate.yml`）；红了先修再请求 review。
- **非必要不加依赖**：本仓库脚本保持零依赖（Node 20 标准库够用就不加包）。新增依赖要在 PR 里写理由、体积和安装面风险。
- **文档 PR 同样要贴证据**：改了哪个文件、哪一段、为什么；改动里的链接自己点一遍。
- **本仓库不收插件源码**：插件代码 PR 提到插件自己的仓库（当前 `dsh-plugin-resolver` 有独立仓库；`dsh-element-picker` 独立仓库整理中）。本仓库只审文档、索引、脚本和 CI。

按改动类型要跑的命令：

| 改了 | 先跑 | 再跑 | PR 里贴 |
| --- | --- | --- | --- |
| 任意 `.md` | — | `npm run verify`（建议） | 改哪一段、为什么 |
| `catalog.json` | `npm run render` | `npm run verify` | 生成的 README diff + verify 输出 |
| `scripts/` / `test/` | 对应单测 | `npm run verify` | 命令 + 输出 |

提交信息写清做了什么即可，例如 `docs: 补充 PR 验证要求`；一种改动一个 commit 更好 review。

## 5. 给目录加一个插件

1. 先按 [`docs/PLUGIN-REPO-CHECKLIST.md`](docs/PLUGIN-REPO-CHECKLIST.md) 把独立仓库补齐（README、`engines.dsh`、测试、CI），并发版到 npm。
2. 在 `catalog.json` 的 `plugins` 加一条，字段和现有条目保持一致；`status: "live"` 要求 `version` 是 SemVer 且 `npm` / `repo` 至少一个有效。
3. `npm run render` 重新生成 README 表格，然后 `npm run verify`。
4. 开 PR，按 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 贴验证输出。

`repo` 字段规则：有独立仓库时必须正好是 `https://github.com/sakikoTGW/<name>`；没有仓库填 `null`，README 里该行链接退回 npm 包页（`dsh-element-picker` 目前就是这种状态）。

## 6. 行为与安全

- 参与即表示同意 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。
- 安全漏洞：**不要开公开 Issue**，按 [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md#6-安全漏洞) 的私密渠道报告。
