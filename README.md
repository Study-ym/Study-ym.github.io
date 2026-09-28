# 余安的数字花园

记录、Ideas 和可以直接使用的小工具。Astro 静态网站，Markdown 管理内容，通过 GitHub Actions 发布到 [study-ym.github.io](https://study-ym.github.io)。

## 本地启动

需要 Node.js 22.12+（推荐 24）。项目 `.npmrc` 使用 npm 官方源，不改变全局配置。

```bash
npm ci
npm run dev
```

按终端提示打开本地地址。检查与构建：

```bash
npm run check
npm test
npm run build
npm run preview
```

## 写记录与 Ideas

```bash
npm run new -- note my-first-note "第一条记录"
npm run new -- idea a-small-experiment "一个小实验"
```

脚本默认创建 `draft: true` 草稿。编辑文件并把 `draft` 改为 `false`，提交到 `main` 后自动发布。也可以直接在 GitHub 的 `src/content/notes` 或 `src/content/ideas` 目录新增或编辑 Markdown。

```yaml
---
title: 第一条记录
description: 用一句话说明这篇记录讲什么
date: 2026-09-28
updated: 2026-09-28 # 可选，真正更新时再填写
tags: [学习, 生活]
stage: seed # 记录：seed / growing / evergreen
draft: false
---
```

Ideas 使用 `status: idea` / `doing` / `done`，不需要 `stage`。文件名决定页面地址；内容可以用 `[相关笔记](/notes/my-first-note/)` 互相链接。图片放在 `public/images/` 后，用 `![说明](/images/example.png)` 引用。

**公开范围：**此仓库是公开仓库。`draft: true` 只会让内容不出现在网站、搜索、RSS 和 sitemap 中，不会隐藏 GitHub 中的源文件或 Git 历史。私密内容不要放进这个仓库。

当前 `example: true` 的内容是示例，可以删除或替换。`welcome.md` 和 `a-place-for-ideas.md` 记录网站本身的起点。RSS 订阅记录摘要。

## 工具箱

- JSON：校验、无损格式化、压缩、复制。保留大整数和原始数字字面量。
- 时间戳：秒/毫秒转日期，同时展示 UTC 和本地时区；本地日期转时间戳。
- URL：`encodeURIComponent` / `decodeURIComponent`，用于参数值，不是保留完整 URL 分隔符的 `encodeURI`。

以上三个工具的输入仅在浏览器内处理，不发送到服务器，也不写入浏览器存储。

### 月笺 · 极简经期日历

入口：[月笺](https://study-ym.github.io/tools/cycle/)。一键记录开始、结束；点日期可以补记，历次记录里可以修改。小猫陪伴可在设置中开关。

日期只保存在当前浏览器的 localStorage，不上传 GitHub 或服务器，没有账号和设备同步。换浏览器、换手机或清除网站数据前，请在设置中导出 JSON 备份；恢复前会检查日期并预览，确认后替换当前记录。备份包含私人日期，请自行妥善保存。页面可以添加到手机主屏幕，加载页面仍需要网络。

只记录日期和历史间隔，不提供经期、排卵或安全期预测。小猫图片随站点提供，不加载第三方插件或脚本。

## 第一次发布

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 将代码推送到 `main`。
3. 在 Actions 查看 `Deploy garden to GitHub Pages`；成功后访问 https://study-ym.github.io。

后续推送自动检查、测试、构建并发布。PR 只构建，不发布。网站名称和作者位于 `src/site.ts`；域名位于 `astro.config.mjs`，更换域名时也要更新 `public/robots.txt`。

## 文件入口

| 位置 | 用途 |
| --- | --- |
| `src/content/notes/` | 记录 Markdown |
| `src/content/ideas/` | Ideas Markdown |
| `src/content.config.ts` | 内容字段校验 |
| `src/lib/content.ts` | 公共内容筛选，统一排除草稿 |
| `src/pages/tools/index.astro` | 工具交互 |
| `src/lib/tools.mjs` | 工具纯函数 |
| `src/pages/tools/cycle/index.astro` | 月笺独立手机页面 |
| `src/scripts/cycle.ts` | 月笺交互、本地保存与备份 |
| `src/lib/cycle.mjs` | 日期、重叠检查与备份校验 |
| `src/layouts/Layout.astro` | 导航、页脚、全站搜索 |
| `src/styles/global.css` | 样式与响应式布局 |

当前版本不包含私密空间、网站内登录编辑、评论或数据库。内容从仓库发布，访客不能修改站点内容。
