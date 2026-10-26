# dsh-plugins（fixture）

用于测试 `scripts/render.mjs` 与 `scripts/check.mjs` 的最小仓库快照；两个 marker 之外的手写内容不参与校验。

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
| [dsh-plugin-resolver](https://github.com/sakikoTGW/dsh-plugin-resolver) | 一次工具调用把插件装对：搜目录、同名消歧、按当前内核选兼容版本、装完校验 | `dsh plugin --profile <profile> add dsh-plugin-resolver` | ✅ 可用 · 0.1.2 |
<!-- catalog:end -->

手写尾部：这一段不参与校验，也不应被 render 修改。
