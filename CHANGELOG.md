# Changelog

本仓库（聚合索引）的变更记录。**插件各自的版本与变更在插件仓库的 CHANGELOG 里**（例如 [`dsh-plugin-resolver`](https://github.com/sakikoTGW/dsh-plugin-resolver)）；这里只记索引、约定、文档和脚本。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-10-27

首个版本：索引 + 约定 + 反馈闭环。

### Added

- `catalog.json`：插件目录的唯一事实源（`schemaVersion: 1`，收录 2 个插件、2 个分类）。
- `README.md`：目录表由 `catalog.json` 生成，CI 校验两者一致；含安装方式、状态含义与维护承诺。
- `CONTRIBUTING.md`：渠道分工、提 Issue 要写清的要素、意见落地流程、PR 规则。
- 维护承诺：7 天内首次响应、每周三晚 triage、每月第一个周末盘点、不做静默放弃、PR 3 天内 review、0.x 破坏性变更规则。
- `.github/ISSUE_TEMPLATE/`：新插件建议 / 自荐、维护请求 / 催更、本仓库问题三个表单；空白 Issue 关闭。
- `.github/PULL_REQUEST_TEMPLATE.md`：改了什么 / 为什么 / 验证证据 / 影响范围 / 勾选项。
- `docs/MAINTENANCE.md`：维护节奏、SLA、版本与弃用、状态迁移、安全漏洞处理。
- `docs/PLUGIN-REPO-CHECKLIST.md`：新插件独立仓库清单（README、`package.json`、`cordis.patch.yml`、测试与 CI、发版、回目录登记）。
- `CODE_OF_CONDUCT.md`：五条行为约定与举报渠道。

### Security

- 安全漏洞改走私密报告（GitHub Security Advisory），不收公开 Issue。
