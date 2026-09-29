# 本地验收记录

完成日期：2026-09-29。项目：Muse Invite Hub 本地工作区。首版验证使用本机 PGlite（PostgreSQL 兼容）；后续获授权的 Neon 开发库验收见文末。尚未发布到正式域名。

## 已验证

- `pnpm check`：ESLint 和 TypeScript 类型检查通过。
- `pnpm test`：17 项数据库/安全测试通过，包括原子提交、并发与幂等、改动请求冲突、复制限频、同主体反馈去重、3 个独立 IP 门槛、时间窗口过期、迟到成功、下架保护、举报独立审核、管理 token 轮换和旧 token 拒绝、伪造 Cookie / 跨站写入拒绝。
- `wrangler deploy --dry-run`：本机完成发布打包预检，未发起发布；Worker 6904.33 KiB，gzip 1408.61 KiB。
- `pnpm build:worker`：Next.js 生产构建及 OpenNext Worker 打包通过。打包后清除适配器自动生成的本地环境 fallback，扫描部署用 JS/JSON/HTML，不包含本地运行时密钥。
- `tests/e2e.py`：在构建后的 Next.js Node 服务与 Wrangler / workerd 本机预览分别通过 11 组检查。覆盖 9 个公开 URL 的标题/canonical/响应、390px 与 1440px 布局、剪贴板失败手动复制、关闭 JS 的码池、投稿与私密管理链接、30 次复制不会下架、反馈纠正、暂停恢复、剩余 0、替换码重新审核、管理员批准、管理链接轮换和退出。
- `tests/consent.py`：拦截全部 Google 网络请求，用测试测量 ID 检查同意队列。EEA/英国/瑞士/挪威默认 denied；接受仅更新分析用途；拒绝、重新打开、换地区保留拒绝；地区未知或失败继续 denied；清理 URL 参数；一个文档一个手动 page_view；管理文档没有 GA 脚本；慢地区响应不能覆盖已点击的拒绝。
- 图标：ICO 实含 16/32/48；PNG 96×96；Apple 180×180；源 PNG 1024×1024；社交图 1200×630，保留 SVG 源。
- 2026-09-29 首页改版后，按用户要求将全部 5 个提供的码加入初始列表：CJ5FU3 为站主码，其他四个为 Community-sourced；状态 uncertain、剩余量未知，无伪造成功/复制记录。端到端测试使用独立 E2E 前缀临时码，执行后清理本轮记录。

## 证据

- `artifacts/check.log`：静态检查。
- `artifacts/unit-tests.log`：17 项测试结果。
- `artifacts/worker-build.log`：生产打包及环境清理。
- `artifacts/deploy-dry-run.log`：发布 dry-run 与 bundle 大小。
- `artifacts/http-check.json`：本机图标、索引文件和私有页响应头。
- `artifacts/e2e.log`：Next.js Node 浏览器流程。
- `artifacts/e2e-worker.log`：Workers 浏览器流程。
- `artifacts/consent.log`：同意流程与慢响应回归。
- `artifacts/home-desktop.png`、`home-mobile.png`、`share-mobile.png`、`admin-desktop.png`、`consent-mobile.png`：界面证据。

## 必须区分的线上待验收项

本地通过不等于外部服务已经接通：

1. Neon 生产环境的实际迁移、数据和凭据验收情况只记入站主私密本地记录；发布前按部署步骤完成相应核对。
2. Cloudflare 正式域名 DNS/HTTPS、首次发布、真实边缘地区/IP。
3. Cloudflare Access 单个管理员邮箱 OTP、JWT 配置与退出。已验证的是本机独立管理员会话，不是实际 Cloudflare 账号登录。
4. Turnstile 真实 widget/Siteverify hostname/action、过期与失败。本机完整流程采用显式 local-only 测试开关；生产路径缺验证码会拒绝提交。
5. GA4 实际测量 ID、增强型衡量设置与 DebugView 收数。同意测试拦截 Google 请求，不代表真实属性已收到数据。
6. 支持邮箱真实收件、Google Search Console 验证与收录。
7. 生产每日清理 Cron 的成功事件与数据库保留期限。
8. 生产网络与真实流量下的性能。没有将本地截图或实验室结果声明为线上 LCP 达标。

这些项目按 `DEPLOYMENT.md` 操作和验证；平台连接、首次部署和远程数据写入由站主完成。

## 2026-09-29 首页改版验证

首页调整为直接取码的紧凑工具页：完整码列表前置，取消遮挡、展开和宣传大图。桌面 1440×1000 与手机 390×844 的首屏均实测有 5 个完整邀请码和 5 个复制按钮可见，没有横向溢出。复制内容与行内文本一致；刷新列表和问题码入口正常；关闭 JavaScript 仍能直接读出全部五码。

证据：`artifacts/redesign-browser.json`、`redesign-desktop-first-screen.png`、`redesign-mobile-first-screen.png`、`redesign-check.log`、`redesign-build.log`。本次仍只修改本地项目与本地数据库，没有发布或写入 Neon。

## 紫色分享凭条视觉与首次仓库交付

2026-09-29 在保持首屏完整邀请码的前提下，接入自托管 Bricolage Grotesque 标题字体、淡紫色点阵背景、具有分隔结构的邀请码行、复制成功反馈和双向奖励说明。品牌 SVG、favicon、Apple 图标及社交分享图同步更新。

本轮 `pnpm check`、17 项测试、完整浏览器流程及 OpenNext 构建通过；本机证据位于 `artifacts/violet-*.log`。验收文件不随 Git 发布，避免把本机日志与临时记录放入仓库。仍未进行云平台发布或远程数据库写入。

## Neon 开发库初始化（2026-09-29）

在站主明确确认的 development 端点完成 `001_initial.sql`：10 张表、码状态视图、业务函数与迁移记录均已回查。导入了 1 个站主码和 4 个社区码，全部为 uncertain，剩余量未知，复制和成功反馈数为 0。随后直接调用网站的 getCodes/getManaged 查询函数，从 Neon 成功读取五个码并验证站主管理凭据只对应 CJ5FU3。

开发凭据与原本本地预览凭据隔离；开发管理路径不指向生产域名。远程 seed 现在要求显式指定 development/production，新增 3 项本地环境隔离检查通过，类型与 lint 检查通过。详细回读证据保存在本机忽略目录 `artifacts/neon-development-verification.json`，未保存密钥值。

该次开发库验收的授权与操作仅覆盖开发库建表和五条初始化记录。当时生产库、Cloudflare 实际部署、真实验证码、Access 和 GA4 验收仍待完成。本机预览仍使用原本 PGlite 数据，没有被静默切换到远程库。

后续生产运营验收记录保存在站主私密本地目录，不作为公开仓库材料。本文公开的本地/开发检查记录不代表当前线上服务状态。
