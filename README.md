# dsh-plugins

**我做的 DeepSeek Harness（`dsh`）插件索引。** 每个插件独立仓库、独立发版；这个仓库只做三件事：告诉你有哪几个插件、约定每个插件该长什么样、把「提意见 → 修复 → 发版」跑通。

[![validate](https://github.com/sakikoTGW/dsh-plugins/actions/workflows/validate.yml/badge.svg)](https://github.com/sakikoTGW/dsh-plugins/actions/workflows/validate.yml)
[![license](https://img.shields.io/github/license/sakikoTGW/dsh-plugins)](LICENSE)
[![Discussions](https://img.shields.io/badge/讨论-Discussions-4d6bfe)](https://github.com/sakikoTGW/dsh-plugins/discussions)
[![catalog](https://img.shields.io/badge/目录-catalog.json-4d6bfe)](catalog.json)

方向很窄：**先解决一个具体的日常小问题，再谈通用。** 每个插件应该能用一句话说清它替你省掉了哪一步；说不清就先不做。

## 怎么用

- **想装插件** → 看下面的表；命令是 `dsh plugin --profile <profile> add <包名>`，`<profile>` 换成你自己的（通常是 `web`）。
- **想让我改 / 加东西** → [提意见与维护承诺](#提意见与维护承诺)，**7 天内**一定有第一次回应。
- **想贡献代码** → 插件代码在各自仓库，去那里的 Issue / PR；本仓库只收索引、文档和跨插件问题。

<!-- catalog:start -->
<!-- 本段由 scripts/render.mjs 从 catalog.json 生成，请勿手改；改完 catalog.json 后运行 npm run render -->

当前收录 **2** 个插件，按用途分组：

### 输入与引用
> 把说不清的东西变成可点的引用，少解释一句。

| 插件 | 一句话 | 安装 | 状态 |
| --- | --- | --- | --- |
| [dsh-element-picker](https://www.npmjs.com/package/dsh-element-picker) | 把元素、链接、文件路径变成输入框里的引用芯片，模型不用再猜「你说的是哪个」 | `dsh plugin --profile <profile> add dsh-element-picker` | ✅ 可用 · 0.2.1 |

### 安装与开发
> 让装插件、改插件这件事少踩坑。

| 插件 | 一句话 | 安装 | 状态 |
| --- | --- | --- | --- |
| [dsh-plugin-resolver](https://github.com/sakikoTGW/dsh-plugin-resolver) | 一次工具调用把插件装对：搜目录、同名消歧、按当前内核选兼容版本、装完校验 | `dsh plugin --profile <profile> add dsh-plugin-resolver` | ✅ 可用 · 0.1.3 |
<!-- catalog:end -->

> 表由 `catalog.json` 生成、CI 校验两者一致；兼容范围、CHANGELOG、Issue 在各自仓库。`dsh-element-picker` 的独立仓库还在整理：反馈先走本仓库 Issue，版本以 npm 包页为准。

## 为什么每个插件单独一个仓库

聚合仓库只放「索引 + 约定」，插件源码不进这里：

| 做 法 | 好 处 |
| --- | --- |
| 一个插件一个仓库 | 版本、Issue、CI、release 各自独立；一个插件黄了不拖累其他插件 |
| 一个插件一个 npm 包 | `dsh plugin add` 直接装；`engines.dsh` 写在包里，装错内核会当场拒绝 |
| 聚合仓库只管目录 | 找插件只来一个地方；新增插件不改别人仓库 |
| `catalog.json` 是唯一事实源 | README 由脚本生成，CI 比对，表不会和实际版本漂移 |

## 状态含义

| 状态 | 含义 |
| --- | --- |
| ✅ 可用 | 有版本、能装、在用；接口可能小幅演进，破坏性改动会写进 CHANGELOG |
| 🧪 Beta | 能用，但接口 / 行为还会变 |
| 🚧 开发中 | 还没发布，能看进度，不建议装 |
| 📝 计划中 | 场景明确，还没动工 |
| 📦 已归档 | 不再维护，会在条目里给出替代方案 |

## 提意见与维护承诺

意见不用客气，写清楚 **用的是哪个插件、什么版本、你想让它做什么** 就够；模板已经把这几项列好了。

| 渠道 | 用来提什么 | 响应承诺 |
| --- | --- | --- |
| 插件仓库 **Issue** | 某个插件坏了 / 行为不对 / 想加功能 | **7 天内**首次回应；小修 ≤ 14 天发版 |
| 本仓库 **Issue** | 想让我做一个新插件、索引有错漏、催更某个插件 | **7 天内**首次回应；不做的需求 7 天内给出理由 |
| **Discussions** | 用法提问、想法交流、还没想清楚该不该做的东西 | 尽量 7 天内 |
| **PR** | 文档 / 索引修正；插件代码请提到插件自己的仓库 | 3 天内给 review 意见或直接合并 |

维护节奏（写了就执行，做不到会改这张表）：

- **每周三晚** triage 一次：新 Issue 至少打标签并回复一次。
- **每月第一个周末**盘点：对照 `catalog.json` 检查版本号与链接，关掉过期 Issue 或给出时间表。
- **不做静默放弃**：决定不做 / 暂缓，会写清楚原因和替代方案，然后把 Issue 关掉。
- **破坏性变更**：0.x 阶段 minor 版本允许破坏性改动，但必须提前一个版本在 README 提示，并在 CHANGELOG 里标 `BREAKING`。

## 加一个新插件

1. **先写清问题**：哪一步每天都在浪费时间？现在怎么绕过去的？做到什么程度算解决？（参照 `vibe-coding-playbook` 的「验收先行」：目标 / 验收标准 / 非目标 / 失败模式）
2. **开独立仓库**：按 [docs/PLUGIN-REPO-CHECKLIST.md](docs/PLUGIN-REPO-CHECKLIST.md) 的清单补齐 README、`engines.dsh`、测试、CI。
3. **发版**：`vX.Y.Z` tag + npm 发布产物；纯 ESM、无构建、无 install 脚本的插件优先（安装侧风险最小）。
4. **回本仓库登记**：在 `catalog.json` 加一条 → `npm run render` → PR 里 `npm run verify` 全绿。

## English

An index of [sakikoTGW](https://github.com/sakikoTGW)'s DeepSeek Harness (`dsh`) plugins. One repository and one npm package per plugin; this hub holds the machine-readable catalog ([`catalog.json`](catalog.json)), the [plugin-repo checklist](docs/PLUGIN-REPO-CHECKLIST.md), and the feedback contract — **first response to any issue within 7 days**. Currently: [`dsh-element-picker`](https://www.npmjs.com/package/dsh-element-picker) (turn page elements, links and file paths into composer chips) and [`dsh-plugin-resolver`](https://github.com/sakikoTGW/dsh-plugin-resolver) (install a dsh plugin correctly in one tool call).

## License

[MIT](LICENSE)。插件各自仓库的许可证以各自仓库为准（目前都是 MIT）。
