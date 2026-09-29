# Muse Invite Hub 部署说明

本文描述本地验证、Neon 分支迁移和 Cloudflare Workers / OpenNext 上线准备。平台资源创建、身份权限配置、域名绑定及首次部署由站主操作；远程 migration/seed 须针对具体数据库和操作获得许可后执行。实际生产配置与验收状态保存在站主私密本地记录中，不随仓库公开。

项目按已确认的 Next.js + OpenNext 路线实现。Cloudflare 当前文档把 OpenNext 定位为现有项目适配器，并推荐新项目评估 vinext；这不改变本项目已经确认的选型，只有遇到具体兼容问题时才重新讨论框架。[OpenNext 适配器文档](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)

## 1. 本地验证

需要 Node.js 22 或更新版本（本次验证使用当前宿主机的 24.18.0，已写入 `.node-version`）和 pnpm 10.33.2。Node 的 `--env-file` 用于安全地向脚本加载本地环境变量。

1. 安装仓库依赖：

   ```bash
   pnpm install --frozen-lockfile
   ```

2. 复制 `.env.example` 为 `.env.local`，为 `LOCAL_DB_KEY`、`APP_HMAC_KEY`、`LOCAL_ADMIN_KEY` 分别生成独立的随机值，每个至少 32 字节。不要将本机密钥复制到其他环境。

3. 在终端 A 启动持久 PGlite 服务：

   ```bash
   pnpm db:local
   ```

   服务仅绑定 `127.0.0.1:54329`，只接受带 `Authorization: Bearer LOCAL_DB_KEY` 的查询；仅允许配置的本地开发 Origin，默认 `http://localhost:3000` 和 `http://127.0.0.1:3000`。请求体上限为 64 KiB。数据库文件位于被忽略的 `.local/muse-invite-hub-db/`。本服务只在当前终端运行，不会安装为全局服务或后台守护进程。首次和后续启动都会应用当前的幂等 SQL migration。

4. 在终端 B 创建本地站主测试数据并启动 Next.js：

   ```bash
   pnpm db:seed:local
   pnpm dev
   ```

   seed 从 `data/bootstrap-codes.json` 加入首页展示的 5 个码：站主自有 `CJ5FU3`，以及 4 个 `community` 码。社区码由管理员后台维护；脚本为每条社区记录生成独立随机管理 capability，只保存其 HMAC 摘要并丢弃原 token，不授予未知原作者管理权。5 条记录初始均为 `approved` / `uncertain`，剩余量未知，成功反馈和复制数为 0。站主管理链接仍写入权限为用户私有的 `.local/owner-link.txt`，不要将链接放入公开问题、提交记录或截图。重复 seed 保留任何已有状态和统计；若码已以其他来源存在，脚本停止且不接管。

5. 在本地检查 Turnstile 表单：默认没有 Cloudflare secret 时，投稿和举报会失败关闭。只有要测试本地表单界面时才在 `APP_ENV=local` 的 `.env.local` 或本机 Worker `.dev.vars` 显式设置 `LOCAL_TURNSTILE_BYPASS=true`。不要把它配置到 Cloudflare 的 production variables/secrets；应用只在 local 环境接受此标记。真正的验证仍需服务端调用 Turnstile Siteverify。[Turnstile 服务端校验](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

6. 在终端 C 运行：

   ```bash
   pnpm check
   pnpm test
   ```

`pnpm dev` 验证 Next.js Node 开发运行时。它不替代 OpenNext / Workers 预览。

### OpenNext 本机预览

OpenNext 预览在本机 Wrangler / Workers 运行时执行。先创建被忽略的 `.dev.vars`，填入本机数据库 bridge 和本机 HMAC/admin key，不要放 Neon 生产 URL：

```dotenv
APP_ENV=local
LOCAL_DB_URL=http://127.0.0.1:54329
LOCAL_DB_KEY=与.env.local相同的本地LOCAL_DB_KEY
APP_HMAC_KEY=与.env.local相同的本地APP_HMAC_KEY
LOCAL_ADMIN_KEY=与.env.local相同的本地LOCAL_ADMIN_KEY
```

保持 `pnpm db:local` 正在运行，再构建并启动 Worker 预览：

```bash
pnpm build:worker
pnpm preview:worker
```

OpenNext 预览用于检查 Worker 运行时中的 SSR、路由和数据库连接兼容性；当前本机预览已验证 Worker 可读取 PGlite 中的 codes 数据。完整表单和权限流程仍需运行浏览器验收。Cloudflare 要求 OpenNext 使用 `nodejs_compat` 和兼容日期；本仓库 `wrangler.jsonc` 已配置这两项。[OpenNext 适配器要求](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)

`.dev.vars` 与 `.env.local` 是两套不同用途的本地环境文件。若创建 `.dev.vars`，Wrangler 会优先从它加载本地 Worker secret；切勿将生产密钥复制到其中。[Workers 本地环境变量](https://developers.cloudflare.com/workers/local-development/environment-variables/)

## 2. Neon 数据库

在 Neon 控制台手动创建项目，并至少保留隔离的开发与生产分支。分别记录每个分支连接串的完整 hostname；本地预览只能连接开发分支。远程 migration 和 seed 会写数据库，不要用生产分支做试运行。

把开发分支连接串和只供开发环境使用的独立密钥、站主管理 token 放进被忽略的 `.env.neon-dev.local`，例如：

```dotenv
DATABASE_URL=从Neon控制台复制的开发分支连接串
APP_HMAC_KEY=仅开发环境使用的独立随机密钥
MUSE_OWNER_MANAGE_TOKEN=仅开发环境使用的32字节base64url随机token
```

确认 `DATABASE_URL` 指向刚核对的 Neon branch hostname 后，手动应用初始 schema：

```bash
node --env-file=.env.neon-dev.local --import tsx scripts/migrate.ts \
  --target neon --confirm-remote --expected-host ep-example.us-east-2.aws.neon.tech
```

把示例 hostname 替换为连接串中逐字一致的实际 hostname。脚本同时要求 `--target neon`、`--confirm-remote` 和精确 `--expected-host`，且只接受 `*.neon.tech`。它会记录 `001_initial.sql`；已记录的 migration 再运行不会重复应用。这个命令是手动操作步骤，不会由安装、Next 开发服务器、测试、OpenNext 构建或部署触发。

确认 `DATABASE_URL` 指向已核对的开发 branch hostname，并确认 `APP_HMAC_KEY` 与开发 Worker 一致、`MUSE_OWNER_MANAGE_TOKEN` 为开发环境专用后，可显式准备开发环境的 5 个码：

```bash
node --env-file=.env.neon-dev.local --import tsx scripts/seed.ts \
  --target neon --environment development --confirm-remote --expected-host ep-development-example.us-east-2.aws.neon.tech
```

`--environment` 只决定凭据保存位置和环境标记，不会替你选择或验证 Neon 分支；实际目标由 `DATABASE_URL` 与 `--expected-host` 决定。`MUSE_OWNER_MANAGE_TOKEN` 只用于初始化站主记录，不需要配置到 Worker。

将示例 hostname 替换为连接串中逐字一致的实际 hostname。脚本把开发管理路径保存到被忽略的 `.local/neon-development-owner-path.txt`，格式为 `/manage/<token>`，不附加正式域名；开发域名尚未绑定时，这不会生成指向生产站的可点击链接。development 与 production 使用独立的 token 和 `APP_HMAC_KEY`，不要把开发密钥复制到生产配置。

需要在 Neon 准备生产站主码时，先建立被忽略的 `.env.neon-prod.local`：

```dotenv
DATABASE_URL=Neon生产分支连接串
APP_HMAC_KEY=与生产Worker配置完全一致的密钥
MUSE_OWNER_MANAGE_TOKEN=预先安全生成的32字节base64url随机token
```

然后在核对 hostname 和 production branch 后显式运行：

```bash
node --env-file=.env.neon-prod.local --import tsx scripts/seed.ts \
  --target neon --environment production --confirm-remote --expected-host ep-production-example.us-east-2.aws.neon.tech
```

把示例 hostname 替换成连接串中的准确值。远程 seed 必须明确传入 `--environment development` 或 `--environment production`，缺失或无效时会在连接 Neon 前拒绝。脚本不会生成站主管理 token；production 会把完整正式链接写入被忽略的 `.local/production-owner-link.txt`，不把 token 打到终端。生产 seed 最多新写入上述 5 条初始化记录；已有记录会保留，来源冲突时停止。确认写入前须核对目标分支、邀请码和站主管理凭据；此项目不会自动执行该命令。

Neon 远程配置完成后，创建仅供 Worker 预览使用的 `.dev.vars`，改为开发 branch URL 与开发环境密钥。若你启用 Cloudflare 环境隔离，应分别为各环境配置完整的变量集合；不要把 `.env.local` 的 HMAC key 用作生产 key。

## 3. Cloudflare Worker 环境

在 Cloudflare Dashboard 手动连接 Worker 项目或配置 Worker，并完成首次部署。仓库已提供 OpenNext 配置、`wrangler.jsonc` 和以下命令：

```bash
pnpm build:worker
pnpm preview:worker
pnpm deploy
```

本机 preview 只用前两条。必须通过项目命令执行 OpenNext build、preview 和 deploy；**不要直接运行 `opennextjs-cloudflare build` 或 `opennextjs-cloudflare deploy`**。构建会清理 `.open-next/cloudflare/next-env.mjs` 中的环境 fallback，避免本机 `.env.local` 值进入 Worker 构建产物；不要绕过 `pnpm build:worker` 的清理步骤。公开 Turnstile site key 需在构建进程环境中提供；其余运行时变量由 Worker vars / secrets 或本地 `.dev.vars` 注入。`pnpm deploy` 会发布 Worker，只能在已核对目标账号、环境和分支后由站主执行。配置 `museinvitehub.org` 为正式域名并核对 HTTPS、规范主机名与 Worker 路由；用户报告域名已注册不等于 DNS、TLS 或部署已验证。规范网址固定为 `https://museinvitehub.org`。

通过 Cloudflare Worker 的 Environment Variables / Secrets 设置服务端变量：

| 名称 | 用途 |
|---|---|
| `APP_ENV` | 正式环境为 `production`；`wrangler.jsonc` 已设置正式默认值 |
| `DATABASE_URL` | Neon 生产分支连接串，仅服务端 secret |
| `APP_HMAC_KEY` | 服务端 HMAC 密钥，至少 32 字节；管理链接与匿名摘要使用它，须在应用生命周期内稳定保管 |
| `ADMIN_EMAIL` | 仅管理员身份校验，填写已确认的唯一站主邮箱（见内部 Spec）；只允许该邮箱访问后台，不用于公开页面或统计 |
| `CF_ACCESS_ISSUER` | Cloudflare Access JWT issuer，按当前 Access 应用配置填写 |
| `CF_ACCESS_AUD` | 同一 Access 应用的 audience tag |
| `TURNSTILE_SECRET_KEY` | Turnstile 服务端私钥，只放 secret |
| `TURNSTILE_HOSTNAME` | 正式值为 `museinvitehub.org`，服务端会比对 Siteverify 返回的 hostname |
| `MAINTENANCE_SECRET` | 维护接口使用的独立 secret |
| `GA4_MEASUREMENT_ID` | 正式 GA4 `G-...` 测量 ID；目前待站主提供，不要填假 ID |

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` 是公开 widget key，需在构建环境设置后运行 `pnpm build:worker`；它不是 secret。生产站点只加载公开页面的 GA4，不在 manage/admin 页面加载统计。

`wrangler.jsonc` 配置了 `17 4 * * *` UTC Cron Trigger。`scheduled()` 仅当 `APP_ENV=production` 时调用 Neon 的 `hub_cleanup()`，每日清理达到保留期限的业务记录；`APP_ENV=local` 的 Next.js、本地 Worker 预览不会执行远程清理。本机 `.dev.vars` 不应连接生产库。

### Cloudflare Access 管理员入口

在 Zero Trust Dashboard 添加 One-time PIN identity provider，在同一个 Access self-hosted application（同一个 audience）中覆盖 `/admin`、`/admin/*`、`/api/admin`、`/api/admin/*` 四个路径，策略只允许已确认的唯一站主邮箱。不要用整个 Gmail 域或 `Everyone` 规则。把该应用的 issuer 和 audience 配入 Worker；应用端还会校验 Access JWT 签名、issuer、audience、有效期和邮箱，因此不能只依赖可伪造的普通请求头。[Cloudflare Access One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)

初次操作时需在 Cloudflare 控制台由站主完成 Access identity provider、应用、策略及认证邮箱设置。本文件记录的邮箱只作为后台身份 allowlist，不能显示到公开网页。

## 4. Turnstile、GA4 和支持联系

本地私密文件 `.env.cloudflare-prod.local` 可用于收集 Turnstile、Access 和 GA4 配置，已被 Git 忽略。创建验证码组件后填写 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 与 `TURNSTILE_SECRET_KEY`，`TURNSTILE_HOSTNAME` 使用正式域名。写入这个文件不会自动配置 Cloudflare：公开 site key 仍需设置到构建环境，服务端密钥仍需设置到 Worker Secrets。

在 Turnstile 创建针对正式 hostname 的 widget。提交邀请码和替换码使用 action `submit`，举报使用 action `abuse`；hostname 或 action 不匹配、secret 缺失、Siteverify 失败都会拒绝写入。正式 hostname 固定为 `museinvitehub.org`；本地和预览如果需要真实验证，应使用允许相应测试 hostname 的独立 widget。客户端只收到 site key，服务端 secret 不写到 `.env.example` 的实际值或浏览器代码。[Turnstile widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/) 与 [Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

GA4 测量 ID 仍待补齐。在配置真实 ID 后，公开正式页面按可信国家码处理分析同意：GA4 初始化前四种 Consent Mode 状态先设为 denied；EEA、英国和瑞士显示底部同意提示；其他已识别地区按项目默认；地区未知时保持 denied。用户只同意 analytics，广告三项始终 denied。上线验收接受、拒绝、重新打开 Cookie settings、修改选择以及管理页面不发分析事件。[Google Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)

GA4 数据流的增强型衡量需核对：本项目自己发送 page_view，不再让历史导航自动重复发送；关闭自动表单互动和站内搜索采集，避免表单/查询参数绕过手工事件白名单。其他增强衡量按实际需求保留，不能将广告用途默认开启。

公开联系邮箱是 `support@museinvitehub.org`。发布前由站主确认该邮箱实际能收到邮件；当前配置记录并不代表邮箱收件已验证。

## 5. 上线后核对

部署后先核对 Cron Trigger：在 Cloudflare Dashboard 的 Workers & Pages → 选择 Worker → Settings → Triggers → Cron Triggers 检查计划为每日 04:17 UTC；到下一次触发后，再打开 Settings → Trigger Events → View events，确认最新 Cron invocation 成功。新建或改名 Worker 后事件记录可能延迟出现。当前 `wrangler.jsonc` 未启用 Workers Logs，因此以 Cron Events 为首要执行记录；如需在 Workers Logs 中查看详细错误，须由站主决定是否启用 observability 并重新部署。[Cron Triggers 与 Cron Events](https://developers.cloudflare.com/workers/configuration/cron-triggers/) [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)

部署后继续分别确认下面几项，不将本地构建结果写成生产验证结果：

- Worker 正式自定义域可通过 HTTPS 打开，所有公开 canonical 指向 `https://museinvitehub.org`。
- Access 未登录时拦住 `/admin`、`/admin/*`、`/api/admin` 与 `/api/admin/*`；仅上述单个管理员邮箱能通过 OTP；应用拒绝错误 audience 或邮箱的 JWT。
- 投稿与举报的 Turnstile hostname/action 匹配；没有有效 Siteverify token 时不会创建或修改记录。
- 首页初始邀请码为 `uncertain`，无假剩余量、成功反馈和复制数；列表返回的公开字段不包含管理 hash、token、IP/访客摘要或审核备注。
- GA4 仅在有真实测量 ID 的公开正式页加载；Consent Mode 默认状态和地区提示与隐私说明一致，管理路径不发送 GA4 请求。
- `https://museinvitehub.org/contact` 显示 `support@museinvitehub.org`，并实际测试该邮箱收信。
- 生产数据库 branch、域名/DNS/TLS、Access 策略、Turnstile 状态、GA4 和邮箱收件分别记录为“已配置”“已核对”或“已验证”；未知项保持待验证。
