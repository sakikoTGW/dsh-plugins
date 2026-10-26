# 新插件独立仓库清单

用途：一个新插件从「想法」到「能在 `dsh-plugins` 目录里被找到、能装、能反馈」，逐项过这张表。可以复制成 Issue / PR 的勾选表用。

依据 DSH 官方文档（`deepseek-ai/deepseek-harness`）：

- [打包与安装插件 `docs/user/develop/basic/publish.zh.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)：组合包 manifest、`dsh.bundle.patch`、`engines.dsh`、git 安装的 `prepare` 坎。
- [插件索引 `docs/user/guide/plugin-market.zh.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)：DSH 官方插件索引（市场）是自托管 JSON，与本仓库的 `catalog.json` 是两件事。

## 0. 开工前先写清问题

- [ ] 一句话说清它替用户省掉哪一步（说不清就先不做）
- [ ] 问题具体：哪一步每天在浪费时间？现在怎么绕过去？
- [ ] 验收标准写下来：目标 / 验收标准 / 非目标 / 失败模式（先定验收，再写代码）
- [ ] 非目标写进 README，防止插件越做越大

## 1. README 结构（缺一项都不算完整）

- [ ] **一句话**：首段独立说清是什么、给谁用
- [ ] **解决什么问题**：场景 + 现在的绕过方式 + 做到什么程度算解决
- [ ] **安装**：`dsh plugin --profile <profile> add <包名>`；有 git / tarball 安装方式就一并写
- [ ] **兼容范围**：`engines.dsh` 原文范围 + Node 版本
- [ ] **用法**：最小可复制示例（输入 → 输出），必要时配图
- [ ] **反馈入口**：Issues 链接；安全报告走私密渠道
- [ ] **许可证**：与 `package.json` / `LICENSE` 一致（当前都是 MIT）

## 2. package.json 必备字段

| 字段 | 要求 | 参考值（`dsh-plugin-resolver`，已发布 0.1.2） |
| --- | --- | --- |
| `name` | `dsh-` 前缀、小写、连字符；与仓库名一致 | `dsh-plugin-resolver` |
| `version` | 精确 SemVer；首个版本从 `0.1.0` 起 | `0.1.2` |
| `description` | 一句话，npm 搜索与插件卡可见 | 见该包 `package.json` |
| `type` | `"module"`（纯 ESM 优先，安装侧风险最小） | `"module"` |
| `exports` | 至少 `"."` 指向入口；需要时加 `"./package.json"` | `{ ".": "./index.js", "./package.json": "./package.json" }` |
| `files` | 只发运行所需文件，不含 `test/`、CI、临时产物 | 入口、`host/`、`logic/`、`cordis.patch.yml`、README 等 |
| `dsh.bundle.patch` | 指向 `./cordis.patch.yml`。**没有它也能装，但只作为普通依赖、会警告且不激活任何层**（官方文档） | `{ "bundle": { "patch": "./cordis.patch.yml" } }` |
| `engines.dsh` | SemVer 范围。安装和 profile 启动会拒绝当前 DSH 不满足的组合包；缺省时改为检查 `@deepseek-ai/dsh*` peer 范围（官方文档） | `">=0.2.0-rc.2 <0.3.0"` |
| `keywords` | 至少含 `dsh`、`dsh-plugin` 和用途词 | `["deepseek", "harness", "dsh", "dsh-plugin", ...]` |
| `license` | 与 LICENSE 一致 | `"MIT"` |
| `repository` | `git+https://github.com/sakikoTGW/<name>.git` | `"git+https://github.com/sakikoTGW/dsh-plugin-resolver.git"` |
| `bugs` | Issues URL | `"https://github.com/sakikoTGW/dsh-plugin-resolver/issues"` |
| `homepage` | 通常是 `<repo>#readme` | `"https://github.com/sakikoTGW/dsh-plugin-resolver#readme"` |

补充：

- [ ] 与宿主共享实例的 `@deepseek-ai/dsh*` 包同时声明在 `peerDependencies` 与 `devDependencies`；不 import 宿主包（用 `ctx.get()` 动态取服务）则不需要（官方文档）
- [ ] 需要 `main` 作为非 `exports` 场景的入口回退时补上

## 3. cordis.patch.yml

- [ ] 文件存在，且被 `dsh.bundle.patch` 指向
- [ ] 行里用**包名**引用自己，不用相对源码路径（官方文档：用源码路径时 Node 解析不到已安装的代码）
- [ ] `id` 唯一、可读（例：`plugin-resolver`），`name` 与包名一致
- [ ] 只声明真正要激活的行，越少越好
- [ ] 验证：`dsh --profile <profile> --dump-config` 能看到自己的层（官方文档）

参考实现（`dsh-plugin-resolver/cordis.patch.yml`）：

```yaml
- insert:
    - id: plugin-resolver
      name: 'dsh-plugin-resolver'
```

## 4. 测试与 CI

- [ ] `npm test` 能**离线**跑（`node --test` 或自建 harness），断网也绿
- [ ] 覆盖主路径 + 至少一条错误路径（装错版本 / 找不到包 / 内核不兼容）
- [ ] 测试不依赖真实网络、不残留用户环境（临时目录、跑完清理）
- [ ] CI（GitHub Actions）在 push / PR 上跑测试，Node 20
- [ ] 失败信息能直接定位（别把断言输出吞掉）

## 5. 发版

- [ ] 版本号按 SemVer；tag 用 `vX.Y.Z`（官方索引生成器按 `vX.Y.Z` / `X.Y.Z` / `<name>@X.Y.Z` 识别版本）
- [ ] npm 发布的是**预构建产物**，不是源码
- [ ] 发版前 `npm pack --dry-run` 检查 `files` 清单里没有 test / CI / 临时文件
- [ ] 有构建步骤 → 提供自包含的 `prepare` 脚本，否则 git 安装拿到的源码没有产物、加载失败（官方文档）；纯 ESM 无构建优先
- [ ] CHANGELOG 写 Added / Changed / Fixed；破坏性变更标 `BREAKING`
- [ ] 破坏性变更按 [`MAINTENANCE.md`](MAINTENANCE.md) 第 3 节：0.x 提前一个版本在 README 提示
- [ ] 在干净 profile 里装一次并启动，确认插件真的生效

## 6. 回本仓库登记

- [ ] `catalog.json` 的 `plugins` 加条目：`id` / `name` / `title` / `category` / `status` / `summary` / `problem` / `repo` / `npm` / `version` / `install` / `engines` / `license` / `since` / `feedback`
- [ ] `repo` 字段：有独立仓库时必须正好是 `https://github.com/sakikoTGW/<name>`；没有仓库填 `null`，README 里那一行链接退回 npm 包页（`dsh-element-picker` 目前就是这种状态）
- [ ] `npm run render` 重新生成 README 的表格
- [ ] `npm run verify` 全绿（check + render --check + test）
- [ ] PR 按 [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) 贴验证命令和输出

## 7. 可选：进 DSH 官方插件索引

- 官方索引是一份自托管的 JSON（`format: 1`），放静态主机，用户手动添加索引源；与本仓库的 `catalog.json` 不是一回事（官方 `plugin-market` 文档）
- 索引生成器只收录声明了 `dsh.bundle` 的包，版本按 `vX.Y.Z` 标签识别
- 不进官方索引不影响 `dsh plugin add` 安装；这是额外的曝光渠道，按需做
