# 圣言家 LogosHome

产品化的多端圣经社区：读经 · 计划灵修 · 教会「家」· 端到端加密沟通。

部署目标：**Cloudflare Workers + D1 + R2**（Durable Objects 信令、Queues/Cron 过期与远程抹除）。

## 文档

- [产品说明](docs/PRODUCT.md)
- [架构](docs/ARCHITECTURE.md)
- [安全模型](docs/SECURITY.md)
- [路线图](docs/ROADMAP.md)

## Monorepo

| 路径 | 说明 |
| --- | --- |
| `apps/api` | Hono Worker API |
| `apps/web` | React + Vite PWA |
| `apps/mobile` | Expo（iOS/Android） |
| `packages/shared` | Zod / i18n / IDs |
| `packages/bible` | 译本注册、经文、CSV 计划 |
| `packages/crypto` | 笔记信封加密 + Signal 风格接口 |
| `packages/ui` | 主题 tokens |

## 快速开始

```bash
pnpm install
pnpm --filter @logoshome/shared build
pnpm --filter @logoshome/bible build
pnpm --filter @logoshome/crypto build
pnpm --filter @logoshome/ui build

# API（本地 D1）
pnpm --filter @logoshome/api db:migrate:local
pnpm dev:api

# Web
pnpm dev:web
```

Web 默认代理 `/v1` 到 `http://127.0.0.1:8787`。

## 功能覆盖（脚手架已接线）

1. **圣经阅读器** — 译本列表（中/英/日主流注册）、章节、字号、书签 API、恩道/微读外链（SSO 开关）
2. **计划与灵修** — CSV 导入解析、计划 CRUD/订阅、灵修五步
3. **家** — 多教会成员入口、论坛帖子、外链媒体字段；聊天密文投递 + 阅后即焚元数据；通话信令 DO
4. **我** — 注册登录、UID、昵称/签名、主题与中英日语言、隐私 JSON、管理员远程抹除 API

## 安全要点

- 消息正文仅存密文；服务器不做内容解密
- WebRTC 媒体点对点；DO 只转发 SDP/ICE
- 远程抹除：吊销会话 + 清空密文 + 客户端擦除密钥（见 `docs/SECURITY.md`）

## 译本与外链

- 公版样例：WEB / KJV / ASV 等本地或 R2
- 授权译本：登记后待 R2 授权包上线
- 恩道 / 微读：`ENDAO_SSO_ENABLED` / `WEREAD_SSO_ENABLED`；未开通 SSO 时走深链

## 部署

配置真实 `database_id` 与 R2 bucket 后：

```bash
cd apps/api
pnpm wrangler secret put HANDLE_PEPPER
pnpm wrangler secret put KEK_MASTER
pnpm deploy
```

将 Web 构建产物发布到 Cloudflare Pages，并设置 `VITE_API_BASE`。
