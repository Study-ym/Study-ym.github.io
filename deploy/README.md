# 阿里云花园部署

正式站 https://ymihh.xyz；www 通过 HTTPS 跳转主域名。代码仓库保持 GitHub，开发及发布分支 main。Node 24、Nginx、SQLite 单实例，无外部应用依赖。当前服务器为 Alibaba Cloud Linux 3，既有 Node v24.14.0。重装镜像仍带 OpenClaw/SearXNG，本次未卸载它们。

## 到期提醒服务试点

`/services/renewal-reminders/` 是公开英文介绍和虚构数据演示，入口位于“其他”和站内搜索。演示只在当前标签页计算，不保存客户资料、不发邮件、不收款。当前参考报价为一次性 $79–149，具体工具、范围、费用和交付时间须另行约定。

咨询地址配置在 `src/pages/services/renewal-reminders/index.astro` 的 `contactEmail`。为空时显示暂未开放接单；填入站长批准的公开邮箱后，重新构建发布即可启用咨询邮件链接。此链接只打开访客的邮件客户端，不替访客发送邮件。真实客户自动化需要单独交付，不应直接把演示改成公开客户数据库。

## 边界

- `/srv/garden/releases/<release>` 是不可变发布版本；`/srv/garden/current` 是当前版本软链接。
- `/var/lib/garden/garden.sqlite` 是独立私有数据文件，仅 garden 服务用户可读写。数据库不能放在 dist、Git 或发布包里。
- GitHub Actions 继续发布本地模式到 GitHub Pages，不会自动部署阿里云。阿里云使用下面的受控发布流程。
- 公开花园包含文章、Ideas和通用工具；私人空间 `/private/` 包含月笺 `/private/cycle/` 与账号管理入口。Nginx auth_request 通过 `/api/auth/check` 校验会话，未登录私人页面跳转账号页。数据API仍独立鉴权；页面设为no-store、noindex并排除公开搜索/sitemap。当前仅一个自用账号；不是多用户服务。
- 原正式站 `/tools/cycle/` 跳转私人日历，数据库和账号不变。GitHub Pages该地址继续运行旧本地日历，供导出历史备份。
- 日期数据通过 HTTPS `/api/` 写入；后端只监听127.0.0.1:8787，Nginx转发。API不写访问日志，程序不记录用户请求体。
- 密钥、设置码和备份不提交Git。SSH私钥留在自己的电脑。公司Git/SSH配置不变。

## 构建和发布

```sh
npm ci
npm run check
npm test
PUBLIC_GARDEN_CLOUD=true npm run build
node deploy/render-nginx.mjs > artifacts/nginx-prod.conf
```

每次生产构建必须同时生成对应的 Nginx CSP 脚本哈希，`install-release.sh` 自动完成。不要给脚本放开 unsafe-inline。安装前应确保域名解析、80/443、防火墙和HTTPS证书已配置。

将 `dist server src/lib/cycle.mjs deploy` 打包（macOS tar 使用 `--no-xattrs`，不包含 node_modules、私有数据或 artifacts），通过专用SSH传到服务器。以新的唯一 release id 执行：

```sh
sudo bash /tmp/install-release.sh /tmp/garden-release.tar.gz RELEASE_ID
```

脚本先检查Nginx配置，再切换版本、重启后端，健康检查通过后重载Nginx。保留旧版本供回滚。当前生产服务：`garden.service`、`nginx.service`。

回滚时将 current 原子指向上个完整发布目录，恢复该版本生成的Nginx配置、重启garden并重载Nginx。本次schema没有破坏性迁移；未来数据库迁移必须独立备份和验证兼容，不能只回滚代码。

## HTTPS

证书覆盖 ymihh.xyz 和 www.ymihh.xyz，Certbot webroot位于 `/var/www/letsencrypt`。由 `certbot-renew.timer` 检查续期；deploy hook验证并重载Nginx。申请时未配置联系邮箱，需依靠定时器/监控确认续期。

## 首次账号

通过可信SSH取得 `/var/lib/garden/setup-token`，在 https://ymihh.xyz/account/ 输入设置码，并由本人创建用户名与密码（至少12位）。初始化后设置码失效；没有公开注册。不要把设置码写进URL、日志或公开文档。

## 备份

`garden-backup.timer` 每天北京时间03:15附近执行一致性备份，保留最近30天；备份前使用SQLite机制生成一致性快照并检查完整性。保存在 `/var/lib/garden/backups`，权限受限。可手动运行：

```sh
sudo systemctl start garden-backup.service
sudo systemctl status garden-backup.service --no-pager
```

**目前每日自动备份仍在同一服务器上，不能抵御整台服务器丢失。** 尚未配置OSS等异地自动备份，需确认私有目的地及费用后接入。用户仍可在页面导出个人日期备份。服务端备份含账号哈希和会话，迁移前需加密。

恢复必须停服务，在新私有目录校验并恢复garden.sqlite、清空sessions、修复owner，之后再启动验证。详见server/README.md。

## 迁移旧数据

域名之间不共享localStorage。旧GitHub日历中导出JSON，在正式站登录后使用“恢复备份”，预览并确认。不会自动上传历史记录。
