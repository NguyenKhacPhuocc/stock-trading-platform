# Stock Trading Platform

Hệ thống giao dịch chứng khoán trực tuyến mô phỏng – Đồ án tốt nghiệp.

## Cấu trúc dự án

```
├── backend/        NestJS + Prisma + PostgreSQL + Redis + Socket.IO
├── frontend/       Next.js 15 + TanStack Query + Redux RTK + Highcharts
├── ai-service/     FastAPI (Python) – phân tích kỹ thuật
└── docker-compose.yml
```

## Khởi chạy môi trường dev

### 1. Khởi động PostgreSQL + Redis

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # hoặc chỉnh trực tiếp .env
npx prisma migrate dev --name init
npm run start:dev
```

Backend chạy tại: http://localhost:3002/api

### 3. Frontend

```bash
cd frontend
# .env.local đã có sẵn
npm run dev
```

Frontend chạy tại: http://localhost:3000

### 4. AI Service (Phase 4)

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
python main.py
```

AI service chạy tại: http://localhost:8000

## Tech Stack

| Tầng | Công nghệ |
|------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| State | TanStack Query + Redux RTK |
| Backend | NestJS, TypeScript, Prisma |
| Database | PostgreSQL 17 |
| Cache | Redis 7.4 |
| Auth | JWT + HTTP-only cookie |
| WebSocket | Socket.IO |
| AI | FastAPI (Python) |


## Goal
Restructure an existing Next.js project into a Turborepo monorepo with two frontend apps.

## Current structure
```
STOCK-TRADING-PLATFORM/
├── ai-service/
├── backend/
├── frontend/          # existing Next.js app (src/app, src/components, src/lib, src/store, src/types)
├── docker-compose.yml
└── README.md
```

## Target structure
Convert to Turborepo monorepo with npm workspaces:
```
STOCK-TRADING-PLATFORM/
├── apps/
│   ├── www/           # new Next.js app, deployed to www.domain.com
│   └── trade/         # moved from frontend/, deployed to app.domain.com
├── packages/
│   ├── ui/            # shared React components
│   ├── types/         # moved from frontend/src/types/
│   └── utils/         # moved from frontend/src/lib/
├── ai-service/
├── backend/
├── docker-compose.yml
├── package.json       # root
└── turbo.json
```

## Step-by-step instructions

### Step 1 — Root package.json
Create `package.json` at root:
```json
{
  "name": "stock-trading-platform",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "dev:www": "turbo dev --filter=www",
    "dev:trade": "turbo dev --filter=trade"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### Step 2 — turbo.json
Create `turbo.json` at root:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**"] },
    "dev": { "persistent": true, "cache": false }
  }
}
```

### Step 3 — Move frontend → apps/trade
- Move entire `frontend/` folder to `apps/trade/`
- Update `apps/trade/package.json`: set `"name": "trade"`
- Add to dependencies: `"@stock/ui": "*"`, `"@stock/types": "*"`, `"@stock/utils": "*"`
- Add `basePath: '/trade'` and `assetPrefix: '/trade'` to `apps/trade/next.config.ts`

### Step 4 — Reorganize apps/trade/src/app/
Create route groups inside `apps/trade/src/app/`:
- `(auth)/login/page.tsx` — login page, no sidebar
- `(auth)/register/page.tsx` — register page, no sidebar
- `(auth)/layout.tsx` — centered layout, no sidebar
- `(platform)/priceboard/page.tsx` — stock price board
- `(platform)/priceboard/[ticker]/page.tsx` — stock detail
- `(platform)/portfolio/page.tsx` — user portfolio
- `(platform)/order/page.tsx` — place order
- `(platform)/layout.tsx` — layout with sidebar
- `page.tsx` — redirects to `/priceboard` using `redirect('/priceboard')`

### Step 5 — Extract shared packages

#### packages/types/
- Move contents of `apps/trade/src/types/` → `packages/types/src/`
- Create `packages/types/package.json`:
```json
{
  "name": "@stock/types",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```
- Create `packages/types/src/index.ts` that re-exports all types

#### packages/utils/
- Move contents of `apps/trade/src/lib/` → `packages/utils/src/`
- Create `packages/utils/package.json`:
```json
{
  "name": "@stock/utils",
  "version": "0.0.1",
  "main": "./src/index.ts"
}
```

#### packages/ui/
- Create empty shared component library
- Create `packages/ui/package.json`:
```json
{
  "name": "@stock/ui",
  "version": "0.0.1",
  "main": "./src/index.ts"
}
```
- Create `packages/ui/src/index.ts` with placeholder export

### Step 6 — Create apps/www
Scaffold a new Next.js app at `apps/www/`:
- Run: `npx create-next-app@latest apps/www --typescript --tailwind --app --no-src-dir`
- Update `apps/www/package.json`: set `"name": "www"`
- Pages needed:
  - `app/page.tsx` — marketing homepage
  - `app/about/page.tsx` — about page
  - `app/layout.tsx` — root layout

### Step 7 — Update imports in apps/trade
- Replace all imports from `@/types/...` → `@stock/types`
- Replace all imports from `@/lib/...` → `@stock/utils`

### Step 8 — Install dependencies
Run at root: `npm install`

## Important rules
- Do NOT manually prepend `/trade` to any `<Link href>` or `router.push()` — Next.js handles basePath automatically
- Keep `store/` and `components/` inside `apps/trade/` — they are app-specific, not shared
- All shared code goes in `packages/`, not inside any app
- Use `@stock/` as the package namespace for all packages