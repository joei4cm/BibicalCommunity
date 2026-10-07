# 圣言家 LogosHome

产品化的多端圣经社区：读经 · 计划灵修 · 教会「家」· 端到端加密沟通。

部署目标：**Cloudflare Workers + D1 + R2**（Durable Objects 信令、Cron 过期与远程抹除）。

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
| `packages/bible` | 译本注册、经文、CSV、伙伴 SSO、R2 格式 |
| `packages/crypto` | X3DH + Double Ratchet 骨架、信封、wipe |
| `packages/ui` | 主题 tokens |

## 快速开始

```bash
pnpm install
pnpm --filter @logoshome/shared --filter @logoshome/bible --filter @logoshome/crypto --filter @logoshome/ui build

# API（本地 D1）
pnpm --filter @logoshome/api db:migrate:local
pnpm dev:api

# Web（另一终端）
pnpm dev:web

# 冒烟
./scripts/smoke-api.sh
```

Web 默认代理 `/v1` 到 `http://127.0.0.1:8787`。

## 功能覆盖

1. **圣经阅读器** — 中英日译本注册、书卷章节、双栏、版式、高亮/书签/笔记、研读材料、R2 授权译本管线、恩道/微读深链与 SSO 适配
2. **计划与灵修** — 创建/CSV 导入/编辑/订阅/公开列表、灵修五步、开源灵修材料
3. **家** — 多教会、小组、通知/综合/小组看板、外链音视频嵌入、E2EE 消息（Double Ratchet）、阅后即焚、归档收藏、WebRTC + TURN 凭证 + 屏幕共享信令
4. **我** — 签名/UID/昵称/真实姓名（字段加密）、教会认证、隐私搜索、设备预密钥上传、远程抹除轮询与本地擦除

## 安全要点

- 消息正文仅存密文；服务器不做内容解密
- 档案敏感字段 AES-GCM at-rest（`KEK_MASTER`）
- WebRTC 媒体点对点；DO 只转发 SDP/ICE；TURN 短时凭证
- 远程抹除：吊销会话 + 清空密文 + 客户端擦除 `lh.*`（见 `docs/SECURITY.md`）

## 译本与外链

- 公版样例：WEB / 日语文语等本地包
- 授权译本：`MEDIA` 键 `bible/{id}/{Book}.{chapter}.json` + entitlements（见 `apps/api/scripts/seed-r2-sample.md`）
- 恩道 / 微读：`ENDAO_SSO_ENABLED` / `WEREAD_SSO_ENABLED`

## 部署

```bash
cd apps/api
pnpm wrangler secret put HANDLE_PEPPER
pnpm wrangler secret put KEK_MASTER
pnpm wrangler secret put TURN_SECRET
pnpm deploy
```

将 Web 构建产物发布到 Cloudflare Pages，并设置 `VITE_API_BASE`。
