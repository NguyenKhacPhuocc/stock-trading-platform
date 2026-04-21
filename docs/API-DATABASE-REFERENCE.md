# API & Database Reference

Tài liệu mô tả toàn bộ REST API, WebSocket và AI service của hệ thống, kèm thiết kế database phân tách theo lớp để dễ bảo trì và mở rộng.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [REST API theo module](#2-rest-api-theo-module)
   - [Auth](#21-auth)
   - [Users](#22-users)
   - [Stocks](#23-stocks)
   - [Market](#24-market)
   - [Orders](#25-orders)
   - [Trades](#26-trades)
   - [Wallet](#27-wallet)
   - [Watchlists](#28-watchlists)
   - [Notifications](#29-notifications)
   - [AI (proxy NestJS)](#210-ai-proxy-nestjs)
   - [Admin](#211-admin)
3. [WebSocket (Socket.IO)](#3-websocket-socketio)
4. [AI Service (FastAPI)](#4-ai-service-fastapi)
5. [Database](#5-database)
   - [Mô hình nghiệp vụ](#51-mô-hình-nghiệp-vụ)
   - [Vai trò và nhiệm vụ từng bảng](#db-table-roles)
   - [Ánh xạ TypeORM hiện tại](#52-ánh-xạ-typeorm-hiện-tại)
   - [Hướng tách persistence](#53-hướng-tách-persistence)

---

## 1. Tổng quan

### Base URL

| Môi trường | URL |
|---|---|
| Dev (NestJS) | `http://localhost:3001/api` |
| Dev (AI service) | `http://localhost:8000` |

### Authentication

- **Access token:** JWT ngắn hạn. Gửi qua cookie `access_token` (`httpOnly`, `path=/`) **hoặc** header `Authorization: Bearer <accessToken>` (tiện cho Postman).
- **Refresh token:** Chuỗi opaque, lưu **hash** trong bảng `refresh_tokens`. Gửi qua cookie `refresh_token` (`httpOnly`, `path=/api/auth`) **hoặc** body `refreshToken` tại `POST /api/auth/refresh` và `POST /api/auth/logout`.
- **Login / refresh** trả thêm `accessToken` và `refreshToken` trong JSON để test Postman; frontend có thể chỉ dùng cookie sau này.

Route của module Admin yêu cầu thêm **role `admin`** — kiểm tra qua `RolesGuard`.

### Response chuẩn

Mọi REST response được bọc bởi `ResponseInterceptor`:

```json
{ "success": true, "data": <payload> }
```

Khi lỗi, `GlobalExceptionFilter` trả về `{ "success": false, "message": "...", "statusCode": ... }`.

### Validation

`ValidationPipe` cấu hình với `whitelist: true` và `forbidNonWhitelisted: true` — mọi field không khai báo trong DTO sẽ bị từ chối (HTTP 400).

---

## 2. REST API theo module

### 2.1 Auth

Prefix: `/api/auth` — Không yêu cầu auth (trừ `GET /me`).

| Method | Path | Auth | Body | Ghi chú |
|--------|------|------|------|---------|
| `POST` | `/api/auth/register` | Không | `RegisterDto` | Tạo user + tiểu khoản `{custId}.1` + `Wallet` (không cấp token). Body trả `custId`, `defaultAccountId`, … |
| `POST` | `/api/auth/login` | Không | `LoginDto` | Trả `user`, `accessToken`, `refreshToken`; set cookie. FE gọi tiếp `GET /users/me/accounts` để lấy tiểu khoản |
| `POST` | `/api/auth/refresh` | Không | `RefreshTokenBodyDto` (optional) | Cặp token mới + `user` (không kèm danh sách tiểu khoản) |
| `POST` | `/api/auth/logout` | Không | `RefreshTokenBodyDto` (optional) | Revoke refresh (cookie hoặc body), xóa cả hai cookie |
| `GET` | `/api/auth/me` | JWT | — | Chỉ trả `{ user }`; danh sách tiểu khoản dùng `GET /api/users/me/accounts` |

#### DTO: RegisterDto

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---|---|
| `fullName` | `string` | Có | Tối thiểu 2 ký tự |
| `password` | `string` | Có | Tối thiểu 6 ký tự |
| `email` | `string` | Không | Email hợp lệ |
| `phone` | `string` | Không | Regex `/^[0-9]{10,11}$/` |
| `nationalIdNumber` | `string` | Không | Độ dài 9–32 ký tự; nếu có → `kyc_status = simulated_verified` |
| `dateOfBirth` | `string` | Không | ISO date `YYYY-MM-DD` (`IsDateString` strict) → `customer_profiles.date_of_birth` |
| `address` | `string` | Không | Tối đa 2000 ký tự → `customer_profiles.address` |

#### DTO: LoginDto

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---|---|
| `custId` | `string` | Có | Regex `/^[0-9A-Z]{3}[CA][0-9]{6}$/i` (ví dụ: `025C000001`) — mã khách, không gồm đuôi `.1` |
| `password` | `string` | Có | Tối thiểu 6 ký tự |

#### DTO: RefreshTokenBodyDto

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `refreshToken` | `string` | Không | Bắt buộc nếu không dùng cookie `refresh_token` (ví dụ Postman) |

---

### 2.2 Users

Prefix: `/api/users` — Yêu cầu JWT.

| Method | Path | Auth | Body | Ghi chú |
|--------|------|------|------|---------|
| `GET` | `/api/users/me/accounts` | JWT | — | `{ accounts: [{ tradingAccountId, id, type, channel, status, isDefault }] }` — `id` = mã tiểu khoản (`account_id`) |
| `GET` | `/api/users/me` | JWT | — | Hồ sơ đầy đủ của user hiện tại (bao gồm `customerProfile`) |
| `PATCH` | `/api/users/me` | JWT | `UpdateProfileDto` | Cập nhật `fullName` và/hoặc `phone` |
| `PATCH` | `/api/users/me/password` | JWT | `ChangePasswordDto` | Đổi mật khẩu |

#### DTO: UpdateProfileDto

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---|---|
| `fullName` | `string` | Không | Tối thiểu 2 ký tự |
| `phone` | `string` | Không | Regex `/^[0-9]{10,11}$/` |

#### DTO: ChangePasswordDto

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---|---|
| `currentPassword` | `string` | Có | — |
| `newPassword` | `string` | Có | Tối thiểu 6 ký tự |

---

### 2.3 Stocks

Prefix: `/api/stocks` — Yêu cầu JWT.

| Method | Path | Auth | Param | Ghi chú |
|--------|------|------|-------|---------|
| `GET` | `/api/stocks` | JWT | — | Danh sách toàn bộ mã CK đang hoạt động |
| `GET` | `/api/stocks/:symbol` | JWT | `symbol`: mã CK (VD: `VNM`) | Chi tiết một mã CK |

---

### 2.4 Market

Prefix: `/api/market` — Yêu cầu JWT.

| Method | Path | Auth | Query | Ghi chú |
|--------|------|------|-------|---------|
| `GET` | `/api/market/prices` | JWT | — | Bảng giá toàn thị trường (cache Redis) |
| `GET` | `/api/market/history/:symbol` | JWT | `limit?: number` (mặc định 100) | Lịch sử OHLCV theo ngày của một mã |

---

### 2.5 Orders

Prefix: `/api/orders` — Yêu cầu JWT.

| Method | Path | Auth | Param | Body | Ghi chú |
|--------|------|------|-------|------|---------|
| `POST` | `/api/orders` | JWT | — | `CreateOrderDto` | Đặt lệnh mua/bán; kiểm tra số dư, biên độ, lô chẵn |
| `GET` | `/api/orders` | JWT | — | — | Danh sách lệnh của tài khoản hiện tại |
| `DELETE` | `/api/orders/:id` | JWT | `id`: UUID lệnh | — | Hủy lệnh (chỉ khi `status = pending/partial`) |

#### DTO: CreateOrderDto

| Field | Kiểu | Bắt buộc | Giá trị hợp lệ |
|---|---|---|---|
| `stockId` | `string (UUID)` | Có | ID của `stocks` |
| `side` | `OrderSide` | Có | `"buy"` \| `"sell"` |
| `orderType` | `OrderType` | Có | `"LO"` \| `"ATO"` \| `"ATC"` |
| `price` | `number` | Không | `>= 0`; bắt buộc nếu `orderType = "LO"` |
| `quantity` | `number (int)` | Có | `>= 100` (tối thiểu 1 lô = 100 cổ phiếu) |

---

### 2.6 Trades

Prefix: `/api/trades` — Yêu cầu JWT.

| Method | Path | Auth | Param | Query | Ghi chú |
|--------|------|------|-------|-------|---------|
| `GET` | `/api/trades/my` | JWT | — | — | Lịch sử khớp lệnh của tài khoản hiện tại |
| `GET` | `/api/trades/:symbol` | JWT | `symbol`: mã CK | `limit?: number` (mặc định 50) | Lịch sử khớp của thị trường theo mã |

> **Lưu ý lệch spec:** `DO-AN-SAN-CHUNG-KHOAN-TECH-SPEC.md §7.1` liệt kê `GET /api/trades` — trong code thực tế là hai route riêng `GET /api/trades/my` và `GET /api/trades/:symbol`.

---

### 2.7 Wallet

Prefix: `/api/wallet` — Yêu cầu JWT.

| Method | Path | Auth | Ghi chú |
|--------|------|------|---------|
| `GET` | `/api/wallet` | JWT | Số dư ví (`available_balance`, `locked_balance`) của tài khoản mặc định |
| `GET` | `/api/wallet/positions` | JWT | Danh mục cổ phiếu đang nắm giữ (quantity, locked_quantity, avg_price) |

---

### 2.8 Watchlists

Prefix: `/api/watchlists` — Yêu cầu JWT.

| Method | Path | Auth | Param | Body | Ghi chú |
|--------|------|------|-------|------|---------|
| `GET` | `/api/watchlists` | JWT | — | — | Danh sách watchlist của user |
| `POST` | `/api/watchlists` | JWT | — | `{ name: string }` | Tạo watchlist mới |
| `POST` | `/api/watchlists/:id/items` | JWT | `id`: UUID watchlist | `{ stockId: string }` | Thêm mã CK vào watchlist |
| `DELETE` | `/api/watchlists/:id/items/:stockId` | JWT | `id`, `stockId` | — | Xóa mã CK khỏi watchlist |
| `DELETE` | `/api/watchlists/:id` | JWT | `id`: UUID watchlist | — | Xóa watchlist |

---

### 2.9 Notifications

Prefix: `/api/notifications` — Yêu cầu JWT.

| Method | Path | Auth | Param | Ghi chú |
|--------|------|------|-------|---------|
| `GET` | `/api/notifications` | JWT | — | Danh sách thông báo của user |
| `PATCH` | `/api/notifications/:id/read` | JWT | `id`: UUID notification | Đánh dấu một thông báo đã đọc |
| `PATCH` | `/api/notifications/read-all` | JWT | — | Đánh dấu tất cả đã đọc |

---

### 2.10 AI (proxy NestJS)

Prefix: `/api/ai` — Yêu cầu JWT. NestJS gọi nội bộ sang AI service (FastAPI), frontend không trực tiếp gọi FastAPI.

| Method | Path | Auth | Param | Ghi chú |
|--------|------|------|-------|---------|
| `POST` | `/api/ai/analysis/:symbol` | JWT | `symbol`: mã CK | Yêu cầu phân tích xu hướng; trả về `AnalysisResult` |
| `GET` | `/api/ai/indicators/:symbol` | JWT | `symbol`: mã CK | Lấy các chỉ báo kỹ thuật đã tính |

> **Lưu ý lệch spec:** `DO-AN-SAN-CHUNG-KHOAN-TECH-SPEC.md §7.1` liệt kê `GET /api/ai/analysis/:symbol` — trong code thực tế là `POST` (phù hợp hơn vì trigger tính toán).

---

### 2.11 Admin

Prefix: `/api/admin` — Yêu cầu JWT **và role `admin`**.

| Method | Path | Param | Query | Body | Ghi chú |
|--------|------|-------|-------|------|---------|
| `GET` | `/api/admin/stats` | — | — | — | Thống kê tổng quan: số user, số lệnh, giá trị giao dịch |
| `GET` | `/api/admin/users` | — | `page?: number` (mặc định 1), `limit?: number` (mặc định 20) | — | Danh sách user có phân trang |
| `PATCH` | `/api/admin/users/:id/toggle-active` | `id`: UUID user | — | — | Bật/tắt trạng thái hoạt động của user |
| `GET` | `/api/admin/configs` | — | — | — | Danh sách cấu hình hệ thống |
| `PATCH` | `/api/admin/configs/:key` | `key`: tên config | — | `{ value: string, description?: string }` | Cập nhật giá trị config |

---

## 3. WebSocket (Socket.IO)

**Namespace:** `/` (mặc định)
**URL dev:** `http://localhost:3001` (không có prefix `/api`)
**CORS:** Cùng origin list với REST, `credentials: true`

### Client → Server (emit)

| Event | Payload | Mô tả |
|---|---|---|
| `subscribe:price` | _(không có)_ | Tham gia room `room:price` để nhận cập nhật bảng giá toàn thị trường |
| `subscribe:orderbook` | `{ symbol: string }` | Tham gia room `room:orderbook:<symbol>` để nhận order book của mã cụ thể |

### Server → Client (emit)

| Event | Payload | Điều kiện |
|---|---|---|
| `price:update` | Bảng giá mới nhất | Broadcast đến `room:price` khi có cập nhật giá |
| `orderbook:update` | Order book của mã | Broadcast đến `room:orderbook:<symbol>` |
| `order:matched` | Chi tiết lệnh khớp | Gửi đến room `user:<userId>` của người có lệnh khớp |

> **Lưu ý:** Client tự join vào room `user:<userId>` khi kết nối để nhận thông báo cá nhân. Hiện tại server emit `order:matched` nhưng room `user:<userId>` cần được join ở phía client sau khi xác thực.

---

## 4. AI Service (FastAPI)

**Base URL dev:** `http://localhost:8000`

Service này chạy độc lập (Python/FastAPI), được NestJS gọi nội bộ. Trong production, frontend không trực tiếp gọi vào service này.

### Endpoints

| Method | Path | Param | Response | Ghi chú |
|--------|------|-------|----------|---------|
| `GET` | `/health` | — | `{ "status": "ok" }` | Health check |
| `POST` | `/analyze/{symbol}` | `symbol`: mã CK (uppercase) | `AnalysisResult` | Phân tích xu hướng dựa trên PriceHistory |
| `GET` | `/indicators/{symbol}` | `symbol`: mã CK (uppercase) | `IndicatorsResult` | Các chỉ báo kỹ thuật đã tính |

### Response schemas

**AnalysisResult**

| Field | Kiểu | Mô tả |
|---|---|---|
| `symbol` | `string` | Mã CK |
| `signal` | `string` | `"bullish"` \| `"bearish"` \| `"sideways"` |
| `confidence` | `float` | Độ tin cậy 0.0–1.0 |
| `summary` | `string` | Mô tả ngắn xu hướng |
| `indicators` | `dict` | Các chỉ báo kỹ thuật tại thời điểm tính |

**IndicatorsResult**

| Field | Kiểu | Mô tả |
|---|---|---|
| `symbol` | `string` | Mã CK |
| `sma_20` | `float \| null` | SMA 20 phiên |
| `sma_50` | `float \| null` | SMA 50 phiên |
| `ema_12` | `float \| null` | EMA 12 phiên |
| `ema_26` | `float \| null` | EMA 26 phiên |
| `rsi_14` | `float \| null` | RSI 14 phiên |
| `macd` | `float \| null` | MACD line |
| `macd_signal` | `float \| null` | MACD signal line |

> **Phase 4:** Các trường hiện trả về `null` (placeholder). Logic tính toán thực tế từ `price_histories` sẽ được implement ở Phase 4.

---

## 5. Database

### Tổng quan kiến trúc lớp

```
┌─────────────────────────────────────────────────────────┐
│          Lớp nghiệp vụ (Domain / Logical)               │
│   Bảng, khóa, quan hệ, invariant — không phụ thuộc ORM │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
┌─────────────────┐   ┌─────────────────────────────┐
│ TypeORM Entity  │   │  PostgreSQL PROCEDURE / VIEW │
│ (hiện tại)      │   │  (hướng tách — tùy chọn)    │
└─────────────────┘   └─────────────────────────────┘
```

Thiết kế theo hướng này giúp: khi chuyển tầng persistence (ORM → procedure/raw SQL), chỉ cần thay lớp repository mà không ảnh hưởng API hay nghiệp vụ.

---

### 5.1 Mô hình nghiệp vụ

**Quy ước chung:**
- PK: UUID (`gen_random_uuid()` / TypeORM `uuid`)
- Tên cột: `snake_case`
- Tiền tệ và giá: `NUMERIC` (tránh lỗi làm tròn `float`)
- Timestamps: `timestamptz`

<a id="db-table-roles"></a>

#### Vai trò và nhiệm vụ từng bảng

Bảng dưới đây tóm tắt **nhiệm vụ nghiệp vụ** của mỗi bảng (độc lập với việc đang dùng TypeORM hay sau này chuyển sang procedure/SQL).

| Bảng | Vai trò / nhiệm vụ |
|------|-------------------|
| `users` | Party / khách: `cust_id` (custId), mật khẩu (hash), họ tên, liên hệ, phân quyền `user`/`admin`, bật tắt hoạt động. |
| `customer_profiles` | Hồ sơ khách hàng / KYC giả lập gắn 1–1 với user (CCCD, trạng thái xác minh, thông tin bổ sung). |
| `trading_accounts` | Tài khoản giao dịch chứng khoán (TKCK): mọi lệnh, ví, danh mục cổ phiếu gắn vào đây — tách khái niệm đăng nhập và số TK. |
| `wallets` | Snapshot số dư tiền theo TKCK (khả dụng + phong tỏa); cập nhật đồng bộ với sổ `cash_transactions` trong transaction ứng dụng. |
| `cash_transactions` | Sổ cái tiền **append-only**: mỗi biến động tiền một dòng, có `balance_after` để đối soát và truy vết theo lệnh (`ref_order_id`). |
| `stocks` | Master mã chứng khoán: symbol, sàn, biên độ, lô, bước giá — phục vụ kiểm tra lệnh và dữ liệu thị trường. |
| `orders` | Lệnh mua/bán của một TKCK trên một mã: loại lệnh, giá, khối lượng, đã khớp, trạng thái, lý do từ chối/hủy. |
| `trades` | Bản ghi **khớp lệnh** (mỗi lần khớp một dòng): liên kết lệnh mua + bán, giá, khối lượng, giá trị giao dịch. |
| `positions` | Danh mục nắm giữ theo cặp (TKCK, mã CK): số lượng, phong tỏa bán, giá vốn bình quân (WAC). |
| `price_histories` | Lịch sử giá theo ngày (OHLCV) cho biểu đồ, API market và tính chỉ báo / AI. |
| `ai_analyses` | Lưu kết quả phân tích AI theo thời điểm (signal, độ tin cậy, snapshot chỉ báo) gắn mã CK. |
| `notifications` | Thông báo cho user (khớp/từ chối/hủy lệnh, nạp rút, hệ thống) và cờ đã đọc. |
| `watchlists` | Danh sách theo dõi do user đặt tên (nhóm mã quan tâm). |
| `watchlist_items` | Quan hệ nhiều–nhiều cụ thể: mã CK thuộc watchlist nào (mỗi cặp watchlist + stock một dòng). |
| `refresh_tokens` | Phiên đăng nhập dài hạn: lưu **hash** refresh token opaque, hết hạn/revoke/rotation (access JWT ngắn, không lưu ở đây). |
| `audit_logs` | Nhật ký thay đổi quan trọng (ai thao tác, entity, payload trước/sau, IP) phục vụ kiểm tra và báo cáo. |
| `system_configs` | Cấu hình key–value toàn hệ thống (mã tổ chức, sequence sinh mã khách, v.v.), chỉnh qua admin. |
| `exchange_calendar` | Lịch ngày/phiên giao dịch (ngày có/không phiên, buổi sáng/chiều/cả ngày) — phục vụ luật phiên (ATO/ATC) hoặc hiển thị. |

#### Sơ đồ quan hệ (ERD rút gọn)

```
users (1) ──── (1) customer_profiles
users (1) ──── (N) trading_accounts
trading_accounts (1) ──── (1) wallets
wallets (1) ──── (N) cash_transactions
trading_accounts (1) ──── (N) orders
trading_accounts (1) ──── (N) positions
orders (N) ──── (N) trades  [qua buy_order_id / sell_order_id]
stocks (1) ──── (N) orders
stocks (1) ──── (N) positions
stocks (1) ──── (N) price_histories
stocks (1) ──── (N) ai_analyses
users (1) ──── (N) watchlists
watchlists (1) ──── (N) watchlist_items
watchlist_items (N) ──── (1) stocks
users (1) ──── (N) notifications
users (1) ──── (N) refresh_tokens
exchange_calendar — lịch phiên theo ngày (độc lập, không FK từ bảng khác trong sơ đồ trên)
```

#### Bảng: `users`

**Nhiệm vụ:** Định danh người dùng hệ thống cho đăng nhập và phân quyền; không lưu số dư hay lệnh trực tiếp.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `cust_id` | `VARCHAR(32) UNIQUE` | CustId / mã khách; format `{org}C/A{6 số}` (VD: `025C000001`) |
| `password_hash` | `VARCHAR` | bcrypt |
| `full_name` | `VARCHAR(128)` | |
| `phone` | `VARCHAR(20) nullable` | |
| `email` | `VARCHAR(256) nullable` | |
| `role` | `ENUM(user, admin)` | |
| `is_active` | `BOOLEAN default true` | |
| `created_at`, `updated_at` | `timestamptz` | |

Index: `cust_id`

#### Bảng: `customer_profiles`

**Nhiệm vụ:** Tách dữ liệu KYC/hồ sơ khỏi bảng đăng nhập; mô phỏng xác minh danh tính trong phạm vi đồ án.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `user_id` | `UUID PK/FK → users` | 1-1 với users |
| `national_id_number` | `VARCHAR(32) nullable` | Số CCCD giả lập |
| `kyc_status` | `ENUM(pending, simulated_verified, rejected)` | |
| `date_of_birth` | `DATE nullable` | |
| `address` | `TEXT nullable` | |
| `created_at`, `updated_at` | `timestamptz` | |

#### Bảng: `trading_accounts`

**Nhiệm vụ:** Là “trục” giao dịch: mọi lệnh, ví và position thuộc một TKCK; cho phép mở rộng nhiều TKCK trên một user.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users` | |
| `account_id` | `VARCHAR(64) UNIQUE` | Mã tiểu khoản (VD `{cust_id}.1`); **không** dùng suffix để suy `type` / `channel` |
| `account_type` | `ENUM(CASH, MARGIN, DERIVATIVE, BOND)` | Cơ chế vốn — field riêng |
| `trading_channel` | `ENUM(STOCK, DERIVATIVE, BOND, FUND)` | Kênh sản phẩm — độc lập với `account_type` |
| `status` | `ENUM(active, suspended, closed)` | API danh sách map `active` → `ACTIVE`, còn lại → `INACTIVE` |
| `is_default` | `BOOLEAN` | 1 user có thể có nhiều TKCK; đồ án chỉ dùng default |
| `opened_at` | `timestamptz` | |
| `created_at`, `updated_at` | `timestamptz` | |

Index: `(user_id, is_default)`

#### Bảng: `wallets`

**Nhiệm vụ:** Cho phép đọc số dư nhanh (snapshot); mọi thay đổi phải đi kèm bút toán ở `cash_transactions` để đảm bảo truy vết.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `trading_account_id` | `UUID UNIQUE FK → trading_accounts` | 1-1 |
| `available_balance` | `NUMERIC(20,2) default 0` | Tiền có thể dùng |
| `locked_balance` | `NUMERIC(20,2) default 0` | Tiền đang phong tỏa chờ khớp |
| `updated_at` | `timestamptz` | |

**Invariant:** `available_balance + locked_balance` = tổng tiền thực. Chỉ cập nhật trong transaction NestJS cùng lúc với insert `cash_transactions`.

#### Bảng: `cash_transactions`

**Nhiệm vụ:** Là nguồn sự thật cho dòng tiền (ledger); dùng đối soát với `wallets` và giải thích mọi biến động tiền theo thời gian.

Append-only — không sửa/xóa dòng cũ.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `wallet_id` | `UUID FK → wallets` | |
| `type` | `ENUM(deposit, withdraw, buy_lock, buy_unlock, buy_matched, sell_matched, fee, adjustment)` | |
| `amount` | `NUMERIC(20,2)` | Dương = cộng vào ví; âm = trừ |
| `balance_after` | `NUMERIC(20,2)` | Tổng tiền sau bút toán (đối soát) |
| `ref_order_id` | `UUID nullable FK → orders` | Liên kết lệnh sinh ra giao dịch tiền |
| `description` | `TEXT nullable` | |
| `created_at` | `timestamptz` | |

Index: `(wallet_id, created_at)`

#### Bảng: `stocks`

**Nhiệm vụ:** Định nghĩa mã niêm yết và quy tắc giao dịch (sàn, biên độ, lô); tham chiếu chung cho lệnh, giá, watchlist, lịch sử.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `symbol` | `VARCHAR(10) UNIQUE` | Mã CK (VD: `VNM`, `HPG`) |
| `name` | `VARCHAR(256)` | Tên công ty |
| `exchange` | `ENUM(HOSE, HNX, UPCOM)` | |
| `ceil_pct` | `NUMERIC(5,2) default 7` | Biên độ trần (%) |
| `floor_pct` | `NUMERIC(5,2) default 7` | Biên độ sàn (%) |
| `tick_size` | `NUMERIC(10,2) default 100` | Bước giá tối thiểu (VND) |
| `lot_size` | `INTEGER default 100` | Lô tối thiểu (cổ phiếu) |
| `is_active` | `BOOLEAN default true` | |
| `created_at`, `updated_at` | `timestamptz` | |

Index: `symbol`

#### Bảng: `orders`

**Nhiệm vụ:** Ghi nhận ý định giao dịch của nhà đầu tư; engine khớp lệnh đọc/ghi trạng thái và `matched_qty` dựa trên bảng này.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `trading_account_id` | `UUID FK → trading_accounts` | |
| `stock_id` | `UUID FK → stocks` | |
| `side` | `ENUM(buy, sell)` | |
| `order_type` | `ENUM(LO, ATO, ATC)` | |
| `price` | `NUMERIC(18,2) nullable` | Bắt buộc với LO; null với ATO/ATC |
| `quantity` | `INTEGER` | Tổng số cổ phiếu đặt |
| `matched_qty` | `INTEGER default 0` | Số đã khớp |
| `status` | `ENUM(pending, partial, filled, cancelled, rejected)` | |
| `cancelled_at` | `timestamptz nullable` | |
| `rejected_reason` | `TEXT nullable` | |
| `created_at`, `updated_at` | `timestamptz` | |

Index: `(stock_id, status, created_at)`, `(trading_account_id, created_at)`

#### Bảng: `trades`

**Nhiệm vụ:** Chứng từ khớp giữa hai lệnh; là cơ sở cho lịch sử giao dịch công khai theo mã và theo tài khoản.

Append-only — mỗi lần khớp (kể cả khớp từng phần) tạo 1 dòng.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `buy_order_id` | `UUID FK → orders` | |
| `sell_order_id` | `UUID FK → orders` | |
| `price` | `NUMERIC(18,2)` | Giá khớp |
| `quantity` | `INTEGER` | Khối lượng khớp |
| `trade_value` | `NUMERIC(20,2)` | Denormalize: `price × quantity` (để query/báo cáo nhanh) |
| `created_at` | `timestamptz` | |

Index: `created_at`, `buy_order_id`, `sell_order_id`

#### Bảng: `positions`

**Nhiệm vụ:** Phản ánh danh mục thực tế sau khớp; cập nhật khi mua/bán và khi phong tỏa cổ cho lệnh bán chờ khớp.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `trading_account_id` | `UUID FK → trading_accounts` | |
| `stock_id` | `UUID FK → stocks` | |
| `quantity` | `INTEGER default 0` | Số lượng đang nắm giữ |
| `locked_quantity` | `INTEGER default 0` | Phong tỏa khi đặt lệnh bán chờ khớp |
| `avg_price` | `NUMERIC(18,2) default 0` | Giá vốn bình quân gia quyền (WAC) |
| `updated_at` | `timestamptz` | |

Unique: `(trading_account_id, stock_id)`

#### Bảng: `price_histories`

**Nhiệm vụ:** Chuỗi thời gian giá theo ngày; nguồn cho chart, backtest đơn giản và dịch vụ AI/indicators.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `stock_id` | `UUID FK → stocks` | |
| `date` | `DATE` | Ngày phiên giao dịch |
| `open`, `high`, `low`, `close` | `NUMERIC(18,2)` | Giá OHLC |
| `volume` | `BIGINT` | Khối lượng |

Unique: `(stock_id, date)`. Index: `(stock_id, date)`

#### Bảng: `ai_analyses`

**Nhiệm vụ:** Lưu lại “ảnh chụp” phân tích theo thời điểm để hiển thị lịch sử gợi ý, không thay thế bảng giá gốc.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `stock_id` | `UUID FK → stocks` | |
| `signal` | `VARCHAR(32)` | `"bullish"` \| `"bearish"` \| `"sideways"` |
| `confidence` | `NUMERIC(5,4)` | 0.0000–1.0000 |
| `indicators` | `JSONB` | SMA, EMA, RSI, MACD snapshot lúc phân tích |
| `created_at` | `timestamptz` | |

Index: `(stock_id, created_at)`

#### Bảng: `notifications`

**Nhiệm vụ:** Kênh thông tin tới user trong ứng dụng (sự kiện lệnh, tiền, hệ thống) tách khỏi email/SMS thật.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users` | |
| `type` | `ENUM(order_matched, order_rejected, order_cancelled, deposit, withdraw, system)` | |
| `title` | `VARCHAR(256)` | |
| `content` | `TEXT` | |
| `is_read` | `BOOLEAN default false` | |
| `created_at` | `timestamptz` | |

Index: `(user_id, is_read, created_at)`

#### Bảng: `watchlists`

**Nhiệm vụ:** Container logic do user đặt tên (ví dụ “Ưa thích”, “Ngành bank”) để nhóm các mã theo dõi.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users` | |
| `name` | `VARCHAR(64)` | |
| `created_at` | `timestamptz` | |

#### Bảng: `watchlist_items`

**Nhiệm vụ:** Thể hiện quan hệ “mã CK thuộc watchlist nào”; ràng buộc unique tránh trùng mã trong cùng một watchlist.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `watchlist_id` | `UUID FK → watchlists` | |
| `stock_id` | `UUID FK → stocks` | |
| `created_at` | `timestamptz` | |

#### Bảng: `refresh_tokens`

**Nhiệm vụ:** Quản lý refresh token (opaque): chỉ lưu SHA-256 của token gửi cho client; hỗ trợ **rotation** (mỗi lần refresh xong revoke dòng cũ, tạo dòng mới) và **logout** (set `revoked_at`).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users` | |
| `token_hash` | `VARCHAR(64) UNIQUE` | SHA-256 hex của refresh plaintext |
| `expires_at` | `timestamptz` | |
| `revoked_at` | `timestamptz nullable` | Có giá trị khi logout hoặc đã rotate |
| `created_at` | `timestamptz` | |

Index: `(user_id, created_at)`

#### Bảng: `exchange_calendar`

**Nhiệm vụ:** Khai báo lịch thị trường theo từng ngày (có/không phiên, buổi giao dịch) để áp luật phiên hoặc hiển thị lịch — tách khỏi dữ liệu giá từng mã.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `date` | `DATE UNIQUE` | Ngày (một dòng một ngày) |
| `is_trading_day` | `BOOLEAN default true` | Ngày có/không giao dịch |
| `session` | `ENUM(morning, afternoon, all_day)` | Phạm vi phiên trong ngày |
| `note` | `TEXT nullable` | Ghi chú (nghỉ lễ, v.v.) |

Index: `date`

#### Bảng: `audit_logs`

**Nhiệm vụ:** Phục vụ truy vết thay đổi dữ liệu nhạy cảm và hành động admin — bổ sung cho ledger tiền (`cash_transactions`) về mặt “ai làm gì”.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `actor_user_id` | `UUID nullable` | Null = hành động hệ thống |
| `action` | `VARCHAR(128)` | Mô tả hành động (VD: `USER_TOGGLE_ACTIVE`) |
| `entity_type` | `VARCHAR(64)` | Tên bảng/entity bị ảnh hưởng |
| `entity_id` | `VARCHAR(64) nullable` | ID bản ghi bị ảnh hưởng |
| `payload_before` | `JSONB nullable` | Giá trị trước khi thay đổi |
| `payload_after` | `JSONB nullable` | Giá trị sau khi thay đổi |
| `ip_address` | `VARCHAR(45) nullable` | |
| `created_at` | `timestamptz` | |

Index: `(entity_type, entity_id, created_at)`, `(actor_user_id, created_at)`

#### Bảng: `system_configs`

**Nhiệm vụ:** Cấu hình động không hard-code trong app (mã broker, bộ đếm sequence, cờ tính năng dạng chuỗi).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `UUID PK` | |
| `key` | `VARCHAR(128) UNIQUE` | Tên cấu hình |
| `value` | `TEXT` | Giá trị dạng string |
| `description` | `TEXT nullable` | |
| `updated_at` | `timestamptz` | |

**Seed mặc định:**

| key | value | Ý nghĩa |
|---|---|---|
| `broker.org_code` | `025` | Prefix mã tổ chức |
| `broker.seq.customer` | `2` | Sequence sinh `cust_id` khách hàng tiếp theo |
| `broker.seq.admin` | `2` | Sequence sinh `cust_id` admin tiếp theo |

---

### 5.2 Ánh xạ TypeORM hiện tại

| Bảng PostgreSQL | Entity file |
|---|---|
| `users` | `backend/src/database/entities/user.entity.ts` |
| `customer_profiles` | `backend/src/database/entities/customer-profile.entity.ts` |
| `trading_accounts` | `backend/src/database/entities/trading-account.entity.ts` |
| `wallets` | `backend/src/database/entities/wallet.entity.ts` |
| `cash_transactions` | `backend/src/database/entities/cash-transaction.entity.ts` |
| `stocks` | `backend/src/database/entities/stock.entity.ts` |
| `orders` | `backend/src/database/entities/order.entity.ts` |
| `trades` | `backend/src/database/entities/trade.entity.ts` |
| `positions` | `backend/src/database/entities/position.entity.ts` |
| `price_histories` | `backend/src/database/entities/price-history.entity.ts` |
| `ai_analyses` | `backend/src/database/entities/ai-analysis.entity.ts` |
| `notifications` | `backend/src/database/entities/notification.entity.ts` |
| `watchlists` | `backend/src/database/entities/watchlist.entity.ts` |
| `watchlist_items` | `backend/src/database/entities/watchlist-item.entity.ts` |
| `refresh_tokens` | `backend/src/database/entities/refresh-token.entity.ts` |
| `audit_logs` | `backend/src/database/entities/audit-log.entity.ts` |
| `system_configs` | `backend/src/database/entities/system-config.entity.ts` |
| `exchange_calendar` | `backend/src/database/entities/exchange-calendar.entity.ts` |

---

### 5.3 Hướng tách persistence

Mục tiêu: khi cần chuyển từ TypeORM sang gọi thủ tục SQL hoặc raw query, chỉ cần thay thế lớp repository, không sửa controller hay service logic.

#### Nguyên tắc phân tách

```
Controller  →  Service  →  Repository (interface)
                                 │
                    ┌────────────┴────────────┐
                    │                         │
             TypeORM Repository        Custom Repository
             (hiện tại)               (raw SQL / PROC)
```

Service chỉ gọi interface repository — không import `Repository<Entity>` của TypeORM trực tiếp vào service. Khi cần đổi tầng persistence, tạo implementation mới của interface và bind vào DI container NestJS.

#### Gợi ý VIEW / FUNCTION / PROCEDURE

| Loại | Tên gợi ý | Mục đích |
|---|---|---|
| VIEW | `v_daily_trade_stats` | Tổng hợp khối lượng, giá trị khớp theo `symbol + date` — dùng cho báo cáo admin, tránh query phức tạp mỗi lần |
| FUNCTION | `fn_calc_avg_price(trading_account_id, stock_id)` | Tính lại giá vốn bình quân gia quyền từ ledger — dùng cho đối soát, không thay thế logic cập nhật trong engine |
| FUNCTION | `fn_wallet_balance(wallet_id)` | Tính lại tổng tiền từ `cash_transactions` — đối soát với snapshot `wallets` |
| PROCEDURE | `sp_match_order(buy_order_id, sell_order_id, price, qty)` | Ghi `trades`, cập nhật `orders.matched_qty`, `positions`, `wallets` trong một transaction DB — thay thế transaction NestJS nếu chuyển sang stored proc |

**Quy tắc bất biến (invariant) phải giữ dù dùng ORM hay PROC:**

1. Mọi biến động số dư tiền phải có dòng tương ứng trong `cash_transactions` (ledger append-only).
2. `wallets.available_balance + wallets.locked_balance` = tổng tiền thực tại thời điểm đó.
3. `trades.trade_value` = `price × quantity` — tầng ghi phải tính đúng, không tính lại sau.
4. `positions.avg_price` cập nhật theo WAC mỗi khi có lệnh mua khớp.
5. `orders`, `trades`, `cash_transactions` không bao giờ bị UPDATE hay DELETE sau khi ghi (chỉ `orders.status`, `orders.matched_qty` được cập nhật trong quá trình khớp).
