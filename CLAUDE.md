# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CPA Quota — a private read-only dashboard for `CLIProxyAPI` / `CPA-backend` quota and usage data. Users connect via CPA URL + management key; the server fetches quota/usage from CPA's management API and displays it in a single-page React app. The last successful overview snapshot is also served publicly at `/` (no auth required), while admin access is at `/admin`.

## Commands

```bash
# Development (starts Vite dev server on :4178 + Express API on :4179)
npm install
SESSION_SECRET=dev-secret npm run dev

# Build (client to dist/client, server to dist/server)
npm run build

# Docker production (app container only; host nginx handles 80/443)
cp .env.production.example .env.production
docker compose build
docker compose up -d

# Type checking (both client and server)
npm run type-check
```

No test framework is configured in this project.

## Architecture

**Monorepo-style client/server split** sharing types via `src/shared/`.

### `src/client/` — React SPA (Vite + React 19 + React Router v7)

按职责拆分为 pages / components / hooks / lib 四层：

- **`main.tsx`** — 入口，挂载 BrowserRouter + AppRouter
- **`router.tsx`** — 路由定义：`/` → PublicPage，`/admin` → AdminGuard（内聚认证逻辑）→ LoginPage 或 AdminPage
- **`api.ts`** — 通用 `request<T>()` fetch 封装 + 12 个具名 API 函数（checkSession, login, logout, fetchSites, saveSite, deleteSite, fetchOverview, refreshOverview, fetchPublicOverview, fetchAlertConfig, saveAlertConfig, testAlertWebhook）
- **`index.css`** — 全局样式，CSS 变量配色 + 模态弹窗 + 表单网格
- **`lib/format.ts`** — fmtPercent, fmtDateTime, fmtNumber, quotaColor
- **`lib/constants.ts`** — providerAccent 配色表、下拉选项静态数据
- **`hooks/`** — useAuth（会话管理）、useOverview（概览数据+自动刷新定时器）、useSites（站点CRUD）、useAlert（告警配置）
- **`components/`** — StatusPill, QuotaBar, AccountCard, SitePanel（站点折叠面板+色块概览）, SiteManager（站点CRUD弹窗）, AlertPanel（告警配置弹窗）
- **`pages/`** — PublicPage（公开快照，与管理面板一致布局）、LoginPage（密码登录）、AdminPage（管理面板，组合所有 hooks 和组件）

### `src/server/` — Express 5 API (Node, ESM)
- **`index.ts`** — Express app with auth middleware, all API routes (`/api/session`, `/api/login`, `/api/logout`, `/api/overview`, `/api/refresh`, `/api/public-overview`). In production, also serves the built SPA as static files with SPA fallback.
- **`session.ts`** — In-memory session store (Map) with HMAC-signed cookies. Sessions hold CPA credentials. Two TTL tiers: 1 day (default) or 30 days (remember me).
- **`cpaClient.ts`** — Axios client wrapping CPA's `/v0/management` REST API. Provides `listAuthFiles`, `downloadAuthFile`, `getUsage`, `apiCall`. The `apiCall` method is used for per-provider quota fetching (Claude, Codex, Gemini CLI, Kimi, Antigravity).
- **`overview.ts`** — Core data pipeline (~985 lines). Orchestrates: fetch auth files → fetch usage → per-account quota fetching (via provider-specific API calls through CPA's `apiCall` proxy) → grouping by provider → computing aggregates. Contains TTL-based in-memory caches for usage and quota data.
- **`config.ts`** — Reads env vars: `HOST` (`127.0.0.1` default), `PORT` (4179), `SESSION_SECRET`, `USAGE_TTL_SECONDS` (30), `QUOTA_TTL_SECONDS` (300), `COOKIE_NAME`, `publicDir`.

### `src/shared/types.ts` — Shared TypeScript interfaces
- `OverviewResponse`, `OverviewProvider`, `OverviewAccount`, `OverviewQuota`, `OverviewUsage`, etc.
- `ProviderId` union type: `'claude' | 'codex' | 'gemini-cli' | 'kimi' | 'antigravity'`

### Key data flow
1. Client logs in with admin password → server sets HMAC-signed cookie
2. Authenticated `/api/overview` call → `buildOverview()` fetches all auth files + usage in parallel, then fetches per-account quota concurrently
3. Each provider has a dedicated quota fetcher (`fetchClaudeQuotaWithClient`, `fetchCodexQuotaWithClient`, etc.) that calls the provider's API through CPA's `apiCall` proxy (the `$TOKEN$` placeholder is replaced server-side by CPA)
4. Results are cached in-memory with configurable TTL; `/api/refresh` with `{ scope }` forces cache bypass
5. Last successful overview is stored in `publicOverview` variable and served unauthenticated at `/api/public-overview`

## Deployment

- Production uses `docker-compose.yml` to run the app container on `127.0.0.1:4179`
- Host Nginx keeps handling `80/443`, TLS certificates, and reverse proxy for `cpas.6553501.xyz`
- Persistent runtime data is stored in host `data/` and mounted into the container as `/app/.data`
- Server TypeScript compiles with `tsconfig.server.json` (NodeNext modules), output to `dist/server/`
- Client builds via Vite to `dist/client/`

## TypeScript Configuration

Two separate configs:
- `tsconfig.json` — Client: ES2022 target, Bundler module resolution, JSX react-jsx, covers `src/client` + `src/shared`
- `tsconfig.server.json` — Server: ES2022 target, NodeNext module resolution, covers `src/server` + `src/shared`
- Server imports use `.js` extension (NodeNext requirement): `import { foo } from './bar.js'`
