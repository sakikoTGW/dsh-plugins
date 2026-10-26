## 改了什么

<!-- 列文件 + 一句话。一事一 PR，无关改动另开。 -->

## 为什么

<!-- 关联 Issue（如 Closes #123）；没有 Issue 就写清动机和影响。 -->

## 怎么验证（命令 + 输出）

```sh
# 至少跑这个
npm run verify
```

<!-- 粘贴实际输出，不要写「应该没问题」。改了 catalog.json 的先跑 npm run render；改了脚本的贴对应测试输出。 -->

## 影响哪些插件

<!-- 无（仅文档 / CI）/ dsh-element-picker 0.2.x / ...；改了目录结构或链接要说明影响范围。 -->

## 勾选项

- [ ] 改了 `catalog.json` 的话，已跑 `npm run render`，并把生成的 README 一起提交
- [ ] 本地 `npm run verify` 通过（check + render --check + test）
- [ ] 文档 PR：说明改了哪个文件、哪一段、为什么；改动里的链接已点过
- [ ] 没有在本仓库提交插件源码（插件代码 PR 请提到插件自己的仓库）
- [ ] 新增依赖（如有）已说明理由；没有新增就不勾这条
