# 余安的数字花园

记录、Ideas 和可以直接使用的小工具。Astro 静态网站，Markdown 管理内容，代码保存在 GitHub，正式网站部署在阿里云 [ymihh.xyz](https://ymihh.xyz)。GitHub Pages 保留为静态备用版本。

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

入口：[月笺](https://ymihh.xyz/tools/cycle/)。一键记录开始、结束；点日期可以补记，历次记录里可以修改。小猫陪伴可在设置中开关。

正式站登录后保存到阿里云服务器的私有 SQLite 数据库；当前版本是一个家庭自用账号，没有公开注册、多用户或共享权限系统。页面显示“已保存到服务器”后才算保存成功；其他设备登录同一账号，打开或点击“同步”即可查看。冲突会拒绝覆盖，提示先核对最新记录。

GitHub Pages 备用站仍是本地模式，不会上传其浏览器旧记录。迁移方法：在旧站设置中导出 JSON，再登录新站导入；导入先校验和预览，确认后替换。备份包含私人日期，请妥善保存。页面可添加到手机主屏幕，使用服务器保存需要网络。

只记录日期和历史间隔，不提供经期、排卵或安全期预测。小猫图片随站点提供，不加载第三方插件或脚本。

## GitHub Pages 备用发布

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
| `src/components/CyclePage.astro` | 月笺独立手机页面，服务器入口 `/private/cycle/` |
| `src/scripts/cycle.ts` | 月笺交互、本地保存与备份 |
| `src/lib/cycle.mjs` | 日期、重叠检查与备份校验 |
| `src/layouts/Layout.astro` | 导航、页脚、全站搜索 |
| `src/styles/global.css` | 样式与响应式布局 |

公开文章和 Ideas 仍从 Git 仓库发布，访客不能修改公开内容。私有经期数据独立保存，不进入公开搜索或 RSS。正式服务器部署、回滚、备份及首次账号设置见 [部署说明](deploy/README.md)，API 协议见 [后端说明](server/README.md)。

## 界面风格

公开花园与私人空间使用浅色工作室风格：顶部导航、深灰正文、蓝色强调、记录列表和紧凑工具入口。全局视觉在 `src/styles/global.css`，共享页面框架在 `src/layouts/Layout.astro`。月笺使用独立样式，保留柔和配色与可关闭的小猫。
