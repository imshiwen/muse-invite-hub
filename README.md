# Muse Invite Hub

面向 Muse 个人 agent 的免费邀请码分享站。首版使用 Next.js、Cloudflare Workers / OpenNext 和 Neon PostgreSQL；公开页面英文，访客无需注册。本站不生成或兑换邀请码，也不承诺奖励到账。

## 本地开发

需要 Node.js 22 或更新版本（本次验证使用当前宿主机的 24.18.0，已写入 `.node-version`），以及仓库声明的 pnpm 10.33.2。安装依赖：

```bash
pnpm install --frozen-lockfile
```

复制 `.env.example` 为 `.env.local`，为 `LOCAL_DB_KEY`、`APP_HMAC_KEY` 和 `LOCAL_ADMIN_KEY` 分别生成独立随机密钥（每个至少 32 字节）。`.env.local` 不提交到 Git。当前工作区已有独立生成的本地配置；其他克隆请自行生成密钥，不要复制本机的 `.local` 或 `.env.local`。

先在一个终端启动本地数据库服务：

```bash
pnpm db:local
```

服务只监听 `127.0.0.1:54329`，数据持久保存在被忽略的 `.local/muse-invite-hub-db/`。首次启动以及之后的本地启动都会应用 `migrations/001_initial.sql`。这是 PGlite 开发数据库，不是 Neon 的替代品，也不会安装成系统级服务；停止时按 `Ctrl+C`。

另开终端导入站主测试码，再启动网页：

```bash
pnpm db:seed:local
pnpm dev
```

本地 seed 从 `data/bootstrap-codes.json` 导入首页展示的 5 个码：`CJ5FU3` 是站主码，其余 4 个标记为 `community`。社区码由管理员在后台维护，不伪装为原作者投稿，也不提供原作者管理链接。5 条记录初始均为 `approved` / `uncertain`，剩余量未知，成功反馈和复制数为 0。站主管理链接保存在 `.local/owner-link.txt`，不要提交或分享；重复 seed 会保留已有记录及统计，来源冲突时停止且不接管。

本地没有配置 Turnstile 时，投稿和举报默认失败关闭。只有需要测试表单交互时，才在 `APP_ENV=local` 的 `.env.local` 或本机 Worker `.dev.vars` 显式设置 `LOCAL_TURNSTILE_BYPASS=true`；它仅适用于本地环境。生产 Worker 永远不会使用此绕过。

运行静态检查和数据库行为测试：

```bash
pnpm check
pnpm test
```

本地验收生成的日志、截图和 JSON 证据保留在 `artifacts/`，该目录已从 Git 提交中排除；验收范围与线上待办见 [本地验收记录](docs/VERIFICATION.md)。

Next.js 开发服务器用于快速编辑页面。Cloudflare 运行时另用 OpenNext 本地预览验证：先按 [部署说明](docs/DEPLOYMENT.md) 配置本地 PGlite bridge 和 `.dev.vars`，再运行 `pnpm build:worker` 与 `pnpm preview:worker`。不要用正式数据库做预览。

Worker 构建会清理 OpenNext 生成的本地环境 fallback 文件；预览和发布请只使用项目提供的 pnpm 命令，不要直接调用 OpenNext 的 build 或 deploy CLI。

## 环境变量

`.env.example` 列出本地开发变量。生产数据库连接、HMAC 密钥、Cloudflare Access、Turnstile 私钥和维护密钥应在部署环境的密钥管理中配置；详细步骤见 [部署说明](docs/DEPLOYMENT.md)。GA4 测量 ID 目前待补，不使用假 ID。

环境文件按环境使用：`.env.local` 用于本机 PGlite 预览，`.env.dev.local` 用于远程开发，`.env.prod.local` 合并生产 Neon、Turnstile、Access 与 GA4 配置。Next.js 不会自动读取 `.env.dev.local` 或 `.env.prod.local`，需通过 `--env-file` 显式加载；本地文件不会自动同步到 Cloudflare，`MUSE_OWNER_MANAGE_TOKEN` 仅供 seed 使用，不上传 Worker。

## 数据与部署

远程 Neon migration 和 seed 都需要显式指定目标、确认远程写入并核对完整主机名。脚本不会由 `pnpm dev`、Worker 构建或部署流程自动触发。Cloudflare 账号连接、Access 策略、Turnstile 站点、域名绑定、首次部署及生产数据库写入由站主手动完成。

## 本地配置文件

- `.env.local`：本机预览。
- `.env.dev.local`：远程开发环境。
- `.env.prod.local`：生产环境，统一填写 Neon、Turnstile、Access 和 GA4。

后两份采用自定义名称，Next.js 不会自动加载；运行数据库脚本时使用 `--env-file` 显式指定。所有实际配置文件均不提交 Git，也不会自动同步 Cloudflare。`MUSE_OWNER_MANAGE_TOKEN` 仅供初始化使用，不上传到 Worker。
