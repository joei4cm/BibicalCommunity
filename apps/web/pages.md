# Cloudflare Pages (web)

The web app is a Vite SPA. Deploy the build output to Cloudflare Pages.

## One-time project setup

```bash
# From repo root
pnpm --filter @logoshome/web build

# Create / link a Pages project (interactive)
npx wrangler pages project create logoshome-web
```

Or use the Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.

## Build settings (dashboard / CI)

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` (or monorepo root with filter) |
| Build command | `pnpm --filter @logoshome/web build` |
| Build output | `apps/web/dist` |
| Node | `20+` |

## Environment variables (Pages)

| Name | Notes |
| --- | --- |
| `VITE_API_BASE` | Public API origin, e.g. `https://api.example.com` (no trailing slash) |

`VITE_*` vars are baked in at **build** time — set them in Pages → Settings → Environment variables, then rebuild.

## Deploy from CLI

```bash
pnpm --filter @logoshome/web build
npx wrangler pages deploy apps/web/dist --project-name=logoshome-web
```

## Optional `wrangler.toml` stub

Pages projects often use dashboard config only. If you prefer a file:

```toml
# apps/web/wrangler.toml (optional Pages project stub)
name = "logoshome-web"
compatibility_date = "2025-10-01"
pages_build_output_dir = "dist"
```

Then: `npx wrangler pages deploy -c apps/web/wrangler.toml` after build.
