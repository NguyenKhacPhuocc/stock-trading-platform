# Hướng dẫn chạy dự án Stock Trading Platform

## Cấu trúc dự án

```
STOCK-TRADING-PLATFORM/
├── apps/
│   ├── www/              # Marketing site (www.domain.com)
│   └── trade/            # Trading platform (app.domain.com)
├── packages/
│   ├── types/            # Shared types
│   ├── utils/            # Shared utilities (axios, query-client, socket)
│   └── ui/               # Shared UI components
├── backend/              # NestJS API
├── ai-service/           # FastAPI AI service
└── docker-compose.yml    # PostgreSQL + Redis
```

## Yêu cầu hệ thống

- Node.js 22+
- Docker Desktop
- Python 3.10+ (cho AI service)

## Cách chạy

### 1. Cài dependencies

```powershell
# Root (Turborepo + workspaces)
cd e:\fss\stock-trading-platform
npm install

# Backend
cd backend
npm install

# AI service
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Setup môi trường

Mỗi phần có **`.env.example`** cạnh **`.env`** (hoặc **`.env.local`** cho Next) — khi đổi biến trong code, cập nhật `.env.example` rồi đồng bộ file thật cùng thư mục.

```powershell
copy backend\.env.example backend\.env
copy apps\trade\.env.example apps\trade\.env.local
copy apps\www\.env.example apps\www\.env.local
copy ai-service\.env.example ai-service\.env
```

File `.env.example` ở **gốc repo** chỉ là mục lục (không chứa biến app).

### 3. Start services

#### 3.1. Database + Redis

```powershell
docker-compose up -d
```

Frontend truy cập trực tiếp theo port (không qua reverse proxy).

#### 3.2. Backend (NestJS)

```powershell
cd backend
npm run start:dev
```

Backend chạy ở `http://localhost:3002` (tránh trùng Next **www** trên 3001)

#### 3.3. Frontend (Turborepo)

```powershell
cd e:\fss\stock-trading-platform
npm run dev
```

Hoặc chạy riêng từng app:

```powershell
npm run dev:www    # port 3001
npm run dev:trade  # port 3000
```

#### 3.4. AI Service (optional)

```powershell
cd ai-service
.\.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Truy cập

| Service         | URL                              | Mô tả                                   |
| --------------- | -------------------------------- | --------------------------------------- |
| **Marketing**   | `http://localhost:3001/`         | Landing page, giới thiệu                |
| **Trading**     | `http://localhost:3000/`         | Redirect → `/trade/priceboard`          |
| **Backend API** | `http://localhost:3002/api`      | NestJS REST API                         |
| **AI Service**  | `http://localhost:8000`          | FastAPI                                 |

---

## Luồng User

1. Vào `http://localhost:3001/` → landing page
2. Bấm **"Mở tài khoản"** → mở `http://localhost:3000/` → redirect sang `/trade/priceboard`
3. Bấm **"Mở tài khoản"** ở header → popup register
4. Đăng ký → popup đóng → bấm **"Đăng nhập"** → popup login
5. Login thành công → header hiển thị tên user

---

## Lưu ý Windows

1. Firewall cho phép các port 3000, 3001, 3002 (và 5433, 6379 nếu cần DB/Redis từ host)
2. Frontend apps đang chạy ở đúng port
3. Nếu Docker lỗi kết nối DB/Redis, thử restart Docker Desktop

---

## Troubleshooting

### Port conflict (`EADDRINUSE`)

**www** phải chạy **3001**, **trade** phải chạy **3000**. Nếu cổng bị chiếm bởi phiên `npm run dev` / Next cũ, Turbo sẽ lỗi (www) hoặc trade tự nhảy sang cổng khác → link từ marketing sang 3000 sẽ không đúng app.

```powershell
# Xem PID đang LISTENING (cột cuối)
netstat -ano | findstr ":3000 :3001"

# Đóng process (thay PID bằng số từ netstat)
taskkill /PID <PID> /F
```

Sau đó chạy lại `npm run dev` từ root. Chỉ để một terminal dev cho monorepo (hoặc đóng hết Next/node cũ trước khi chạy lại).

### Frontend không connect backend

Kiểm tra `apps/trade/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=http://localhost:3002
```
