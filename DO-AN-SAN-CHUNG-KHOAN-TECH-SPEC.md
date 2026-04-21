# ĐỒ ÁN: HỆ THỐNG GIAO DỊCH CHỨNG KHOÁN TRỰC TUYẾN

> **Mục đích file:** Tài liệu kỹ thuật đầy đủ cho đồ án tốt nghiệp. Khi đưa file này cho AI, dùng làm base để xây dựng/triển khai dự án theo đúng yêu cầu và stack đã định nghĩa.

---

## 1. Tên đề tài

**Xây dựng Website/hệ thống giao dịch chứng khoán trực tuyến**

## 2. Nội dung dự kiến thực hiện

Đề tài tập trung xây dựng một hệ thống giao dịch chứng khoán trực tuyến mô phỏng theo mô hình hoạt động của các công ty chứng khoán hiện nay (như SSI, DSC, AseanSC,...), với mục tiêu hỗ trợ nhà đầu tư theo dõi thị trường và thực hiện giao dịch cơ bản trong môi trường giả lập, đồng thời ứng dụng trí tuệ nhân tạo (AI) để hỗ trợ phân tích dữ liệu.

Hệ thống dự kiến bao gồm các phân hệ chính sau:

- **Phân hệ người dùng (nhà đầu tư):** Đăng ký, đăng nhập, quản lý thông tin cá nhân, theo dõi danh mục đầu tư, xem số dư tiền và chứng khoán.
- **Phân hệ dữ liệu thị trường và giao dịch:** Hiển thị bảng giá chứng khoán (giả lập hoặc từ nguồn dữ liệu công khai), cho phép người dùng đặt lệnh mua/bán cơ bản, lưu trữ và hiển thị lịch sử giao dịch.
- **Phân hệ trí tuệ nhân tạo (AI):** Ứng dụng AI để phân tích dữ liệu giá lịch sử và nhận diện xu hướng biến động của cổ phiếu, từ đó cung cấp thông tin tham khảo cho người dùng khi theo dõi thị trường.
- **Phân hệ quản trị hệ thống:** Quản lý người dùng, mã chứng khoán, dữ liệu giao dịch, theo dõi thống kê số lượng giao dịch, giá trị giao dịch và báo cáo tổng hợp.

Đề tài tập trung vào việc xây dựng các chức năng cốt lõi của hệ thống và áp dụng AI ở mức độ phù hợp với phạm vi đồ án tốt nghiệp.

---

## Mục lục

- [3. Công nghệ sử dụng](#3-công-nghệ-sử-dụng)
- [4. Kiến trúc hệ thống](#4-kiến-trúc-hệ-thống)
- [5. Chức năng chi tiết](#5-chức-năng-chi-tiết)
- [6. Database design](#6-database-design)
- [7. API design](#7-api-design)
- [8. Nguồn dữ liệu thị trường VN](#8-nguồn-dữ-liệu-thị-trường-vn)
- [9. Lộ trình triển khai](#9-lộ-trình-triển-khai)
- [Phụ lục: Kiến trúc tham khảo (production)](#phụ-lục-kiến-trúc-tham-khảo-production)

---

## 3. Công nghệ sử dụng


| Tầng          | Công nghệ                                     |
| ------------- | --------------------------------------------- |
| **Frontend**  | Next.js 15 (App Router), React 19, TypeScript |
| **State**     | TanStack Query + Redux Toolkit (RTK)          |
| **HTTP**      | Axios                                         |
| **WebSocket** | Socket.IO (client + server)                   |
| **Styling**   | Tailwind CSS                                  |
| **Charts**    | Lightweight Charts hoặc Highcharts            |
| **Backend**   | NestJS, TypeScript                            |
| **Database**  | PostgreSQL                                    |
| **ORM / mapping** | **TypeORM** (trùng với code trong `backend/`) |
| **Cache**     | Redis (thư viện `redis` trong NestJS)         |
| **Auth**      | JWT + HTTP-only cookie                        |
| **AI**        | Python + FastAPI (service riêng)              |


---

## 4. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                               │
│  TanStack Query │ Redux RTK │ Axios │ Socket.IO │ Lightweight Charts / Highcharts │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ REST + WebSocket
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        BACKEND (NestJS)                                  │
│  Auth │ Users │ Orders │ Matching Engine │ Trades │ Market │ Admin │ AI  │
└───────┬────────────────────────────┬─────────────────────┬──────────────┘
        │                            │                     │
   ┌────▼────┐                 ┌─────▼─────┐        ┌──────▼──────┐
   │PostgreSQL│                 │   Redis   │        │ AI Service  │
   │(TypeORM) │                 │ Cache,    │        │ (FastAPI)   │
   │          │                 │ Pub/Sub   │        │ Python      │
   └──────────┘                 └───────────┘        └─────────────┘
        ▲
   ┌────┴────┐
   │ Data    │  Giả lập / Crawl / Dataset công khai
   │ Source  │  (Cafef, VNDirect, Vietstock...)
   └─────────┘
```

---

## 5. Chức năng chi tiết

### 5.1 Phân hệ người dùng

- Đăng ký, đăng nhập (JWT + HTTP-only)
- Quản lý hồ sơ, đổi mật khẩu
- Xem danh mục đầu tư (tiền + chứng khoán)
- Số dư tiền, số dư chứng khoán theo mã

### 5.2 Phân hệ dữ liệu & giao dịch

- Bảng giá: mã, giá, thay đổi %, khối lượng, sàn (HOSE/HNX/UPCOM)
- Biểu đồ nến, volume
- Order book (sổ lệnh)
- Đặt lệnh: LO (limit), ATO, ATC (triển khai theo luật đơn giản hóa, không xử lý đầy đủ tất cả case phức tạp như thị trường thực tế)
- Kiểm tra biên độ (±7% HOSE, ±10% HNX, ±15% UPCOM)
- Lô chẵn 100 cp
- Lịch sử lệnh, lịch sử khớp

### 5.3 Phân hệ AI

(Implement sau cùng (Phase 4). Tạm thời bỏ qua phần này khi base project.)
## AI Service
- Folder: ai-service/
- Framework: FastAPI (Python)
- Endpoints: POST /analyze/:symbol, GET /indicators/:symbol
- Communication: NestJS gọi HTTP sang FastAPI (không dùng queue)
- Tính toán indicators (SMA, EMA, RSI, MACD)
- Phân loại xu hướng: tăng / giảm / đi ngang
- Dự báo/trend ngắn hạn dựa trên các chỉ báo kỹ thuật (các mô hình nâng cao như Prophet / ARIMA / LSTM là hướng mở rộng nếu đủ thời gian)
- API trả gợi ý tham khảo (không phải tư vấn đầu tư)

### 5.4 Phân hệ quản trị

- CRUD user, mã chứng khoán
- Import/export dữ liệu giá
- Thống kê: số lệnh, khối lượng, giá trị
- Báo cáo tổng hợp

---

## 6. Database design

**Nguồn triển khai thực tế:** PostgreSQL, entity TypeORM trong `backend/src/database/entities/`. Tài liệu đồ án và code phải **cùng mô tả một stack** (không dùng Prisma trong repo này).

**Mục tiêu mô hình dữ liệu:** Giữ phạm vi đồ án nhưng **bám quan hệ nghiệp vụ gần với thực tế** (định danh khách hàng, tài khoản giao dịch, dòng tiền, lịch sử khớp) để sau này mở rộng truy vấn, báo cáo, hoặc dùng **VIEW / FUNCTION / PROCEDURE** trên PostgreSQL phù hợp (ví dụ tổng hợp khớp theo ngày, đối soát số dư).

### 6.1 So sánh nhanh: đồ án vs công ty chứng khoán

| Khía cạnh | Thực tế doanh nghiệp (ý tưởng) | Đồ án (mặc định hiện tại) | Hướng mở rộng trong DB |
| --------- | ------------------------------ | ------------------------- | ---------------------- |
| Đăng nhập | User / IAM | `users.cust_id` (custId) + `password_hash` (email tùy chọn) | — |
| Khách hàng / KYC | Party, CCCD | `customer_profiles` gắn `user_id` | — |
| Tài khoản CK | TKCK, sub-account | `trading_accounts` (`account_id`); ví / lệnh / position gắn `trading_account_id` | `account_id` = `{cust_id}.1` (cash mặc định), sau có thể `.5`, `.6`… |
| Tiền | Sổ/quỹ, ledger append-only | `wallets.available_balance` + `locked_balance` + `cash_transactions` | Không cập nhật snapshot tay; mọi biến động trong transaction (ledger + 2 cột snapshot); `balance_after` = tổng sau bút toán |
| Lệnh / Khớp | Order id nội bộ, trạng thái đồng bộ core | `orders`, `trades` | Giữ; thêm mã tham chiếu, `board_lot`, `channel` nếu báo cáo cần |

### 6.2 Core entities (TypeORM, PostgreSQL — snake_case columns)

Khóa chính UUID. Tên cột snake_case qua `@Column({ name: '...' })`.

**Quy ước khóa:** PK mọi bảng là `id`. Tham chiếu ngoại luôn là `xxx_id` (vd. `trading_accounts.id` được các bảng khác gọi là `trading_account_id`).

```
users — party / custId (đăng nhập)
├── id (UUID PK) — khóa nội bộ
├── cust_id (UNIQUE, VARCHAR) — custId / mã khách; format {org}C/A + 6 số (vd 025C000001); khác `account_id` tiểu khoản (`{cust_id}.1`…)
├── password_hash — bcrypt
├── full_name, phone (nullable), email (nullable)
├── role (user|admin), is_active
└── created_at, updated_at

customer_profiles — KYC, 1-1 users
├── user_id (PK/FK → users)
├── national_id_number (nullable) — CCCD giả lập
├── kyc_status (pending | simulated_verified | rejected)
├── date_of_birth (nullable), address (nullable)
└── created_at, updated_at

trading_accounts — tiểu khoản (uuid PK → trading_account_id ở bảng khác)
├── id (UUID), user_id (FK → users)
├── account_id (UNIQUE, VARCHAR) — mã tiểu khoản; không suy type/channel từ suffix
├── account_type (CASH|MARGIN|DERIVATIVE|BOND), trading_channel (STOCK|DERIVATIVE|BOND|FUND)
├── status (active|suspended|closed), is_default
└── opened_at, created_at, updated_at

wallets             ← ví tiền snapshot, 1-1 với trading_accounts
├── id (UUID PK), trading_account_id (UNIQUE FK → trading_accounts)
├── available_balance, locked_balance (NUMERIC 20,2) — invariant: không sửa SQL tay; chỉ qua service + transaction
└── updated_at

cash_transactions   ← sổ nhật ký tiền, append-only
├── id, wallet_id (FK), type (deposit|withdraw|buy_lock|buy_unlock|buy_matched|sell_matched|fee|adjustment)
├── amount (NUMERIC, dương=cộng / âm=trừ), balance_after (NUMERIC)
├── ref_order_id (nullable FK → orders), description (nullable)
└── created_at

stocks
├── id, symbol (UNIQUE), name, exchange (HOSE|HNX|UPCOM)
├── ceil_pct, floor_pct (NUMERIC 5,2), tick_size (NUMERIC 10,2), lot_size
├── is_active
└── created_at, updated_at

positions           ← danh mục nắm giữ, UNIQUE (trading_account_id, stock_id)
├── id, trading_account_id (FK), stock_id (FK)
├── quantity, locked_quantity (phong tỏa khi đặt lệnh bán)
├── avg_price (NUMERIC 18,2) — giá vốn bình quân gia quyền (WAC); khi mua nhiều lần / bán một phần phải cập nhật đúng công thức
└── updated_at

orders
├── id, trading_account_id (FK), stock_id (FK)
├── side (buy|sell), order_type (LO|ATO|ATC)
├── price (NUMERIC nullable), quantity, matched_qty
├── status (pending|partial|filled|cancelled|rejected)
├── cancelled_at (nullable), rejected_reason (nullable)
└── created_at, updated_at
INDEX: (stock_id, status, created_at), (trading_account_id, created_at)

trades              ← bản ghi khớp lệnh, append-only
├── id, buy_order_id (FK → orders), sell_order_id (FK → orders)
├── price (NUMERIC), quantity, trade_value (NUMERIC = price × qty)
└── created_at
INDEX: (created_at), (buy_order_id), (sell_order_id)

price_histories     ← OHLCV theo ngày, UNIQUE (stock_id, date)
├── id, stock_id (FK), open/high/low/close (NUMERIC), volume (bigint), date
INDEX: (stock_id, date)

ai_analyses, watchlists, watchlist_items, notifications
exchange_calendar, system_configs
audit_logs — ghi nhận thay đổi quan trọng (actor_user_id, action, entity_type, entity_id, payload_before/after, created_at)
```

**Margin (mở rộng sau, chưa bắt buộc đồ án):** khi làm nghiệp vụ margin thật cần thêm bảng dạng `margin_accounts`, `margin_loans` (lãi, tài sản đảm bảo) — hiện repo chưa triển khai.

**system_configs seed mặc định:**
| key | value | ý nghĩa |
|-----|-------|---------|
| `broker.org_code` | `025` | Mã tổ chức — prefix cust_id / account_id |
| `broker.seq.customer` | `2` | Số thứ tự tiếp theo cho khách hàng |
| `broker.seq.admin` | `2` | Số thứ tự tiếp theo cho admin |

**Tài khoản seed mặc định:**
| cust_id | TK cash (.1) | password | role |
|---------|--------------|----------|------|
| `025C000001` | `025C000001.1` | `123123` | user |
| `025A000001` | `025A000001.1` | `123123` | admin |

### 6.3 Truy vấn, thủ tục và tính nhất quán dữ liệu

- **Ưu tiên đồ án:** Logic đặt lệnh, khớp, cập nhật số dư nằm trong **NestJS (transaction TypeORM)** để dễ test và debug.
- **PostgreSQL bổ sung (tùy chọn, có giá trị trong báo cáo đồ án):**
  - **VIEW:** ví dụ `v_daily_trade_stats` (tổng KL, giá trị theo `symbol` + ngày).
  - **FUNCTION:** tính toán read-only (tránh trùng code giữa API và báo cáo admin).
  - **PROCEDURE / TRIGGER:** chỉ nên thêm khi cần **đối soát** (ví dụ cảnh báo khi tổng `(available + locked)` lệch với tổng ledger); tránh nhồi toàn bộ nghiệp vụ vào trigger nếu chưa quen vận hành.
- **Decimal / tiền:** Dùng `NUMERIC(precision, scale)` trong PostgreSQL cho số dư và giá; tránh `float` cho tiền tệ.

### 6.4 Ghi chú thiết kế

- **Đăng nhập bằng `cust_id`** (API body `custId`; không bắt buộc email), format `{org_code}C{6 số}` / `{org_code}A{6 số}`.
- **`account_id`** trên `trading_accounts`: số tiểu khoản; đăng ký / seed luôn tạo sẵn `{cust_id}.1` (cash); sau có thể thêm `.5`, `.6`…
- **`trades.trade_value`:** luôn = `price × quantity` khi ghi (denormalize để query nhanh; đồng bộ ở tầng app).
- **KYC giả lập:** người dùng nhập số CCCD bất kỳ → `kyc_status = simulated_verified`; không nhập → `pending`.
- **Mã tổ chức** (`025`) cấu hình trong `system_configs`; sequence sinh mã tự động tăng theo transaction.
- **Tất cả lệnh / ví / danh mục** gắn `trading_account_id`, không gắn trực tiếp `user_id` — đúng mô hình TKCK.
- **NUMERIC** cho mọi cột tiền tệ và giá (tránh lỗi làm tròn float).
- **Sổ nhật ký tiền** (`cash_transactions`) append-only với `balance_after` để đối soát.
---

## 7. API design

### 7.1 REST (mẫu)


| Method | Endpoint                 | Mô tả           |
| ------ | ------------------------ | --------------- |
| POST   | /api/auth/register       | Đăng ký         |
| POST   | /api/auth/login          | Đăng nhập       |
| GET    | /api/users/me            | Thông tin user  |
| GET    | /api/stocks              | Danh sách mã CK |
| GET    | /api/stocks/:symbol      | Chi tiết mã     |
| GET    | /api/market/prices       | Bảng giá        |
| POST   | /api/orders              | Đặt lệnh        |
| GET    | /api/orders              | Lịch sử lệnh    |
| GET    | /api/trades              | Lịch sử khớp    |
| GET    | /api/wallet              | Số dư, danh mục |
| GET    | /api/ai/analysis/:symbol | Gợi ý AI        |
| ...    | /api/admin/*             | Admin endpoints |


### 7.2 WebSocket (Socket.IO)


| Event               | Hướng           | Mô tả                            |
| ------------------- | --------------- | -------------------------------- |
| subscribe:price     | Client → Server | Subscribe bảng giá               |
| subscribe:orderbook | Client → Server | Subscribe order book theo symbol |
| price:update        | Server → Client | Cập nhật giá                     |
| orderbook:update    | Server → Client | Cập nhật order book              |
| order:matched       | Server → Client | Lệnh đã khớp                     |


---

## 8. Nguồn dữ liệu thị trường VN


| Nguồn             | Kiểu                | Ghi chú                      |
| ----------------- | ------------------- | ---------------------------- |
| Giả lập           | Random walk         | Dễ triển khai, dùng cho demo |
| Dataset công khai | CSV, Kaggle, GitHub | Lịch sử để backtest AI       |
| Cafef, Vietstock  | Crawl               | Cần đọc ToS, tránh spam      |
| Fireant, TCBS     | API                 | Có thể cần đăng ký           |


**Đề xuất:** Bắt đầu bằng **dữ liệu giả lập + dataset lịch sử**; sau đó mới cân nhắc crawl/API nếu đủ thời gian.

---

## 9. Lộ trình triển khai


| Phase             | Nội dung                            | Thời lượng |
| ----------------- | ----------------------------------- | ---------- |
| **1. Foundation** | Setup project, DB, Auth, UI base    | 3–4 tuần   |
| **2. Market**     | Mã CK, bảng giá, biểu đồ, WebSocket | 3–4 tuần   |
| **3. Trading**    | Order, matching engine, order book  | 4–5 tuần   |
| **4. AI**         | Python service, indicators, gợi ý   | 3 tuần     |
| **5. Admin**      | CRUD, thống kê, báo cáo             | 2–3 tuần   |
| **6. Polish**     | Test, tối ưu, tài liệu              | 2 tuần     |


---

## Phụ lục: Kiến trúc tham khảo (production)

Tham khảo kiến trúc thực tế từ công ty chứng khoán (HAProxy, API.TradeApi, API.Datafeed, RabbitMQ, Kafka, Redis...). Áp dụng **đơn giản hóa** cho đồ án:


| Ý tưởng từ sơ đồ production           | Áp dụng vào đồ án                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| **Tách API theo chức năng**           | Module NestJS: AuthModule, OrderModule, MarketModule, ReportModule, AdminModule |
| **Datafeed + Socket Services**        | WebSocket real-time giá/order book; REST cho dữ liệu lịch sử                    |
| **Redis**                             | Cache bảng giá, order book; Pub/Sub broadcast cập nhật → WebSocket              |
| **Luồng Data → Queue → Distribution** | Cron/Job cập nhật giá → Publish Redis → WebSocket đẩy xuống client              |
| **Phân tách Data / Trade / Report**   | Endpoint rõ ràng: `/api/market/`*, `/api/orders`, `/api/trades`, `/api/reports` |
| **DMZ / bảo vệ đầu vào**              | Middleware, Guard NestJS (JWT, rate limit)                                      |


**Lưu ý:** Không dùng microservice, Kafka, RabbitMQ, HAProxy cho đồ án. Monolith đủ dùng.

---

## Phụ lục: So sánh nhanh


| Chủ đề    | Lựa chọn                           | Thay thế                          |
| --------- | ---------------------------------- | --------------------------------- |
| State     | TanStack Query + Redux RTK         | -                                 |
| HTTP      | Axios                              | Ky (nhẹ hơn)                      |
| WebSocket | Socket.IO                          | ws (gọn, ít tính năng)            |
| Redis     | node-redis                         | ioredis                           |
| Backend   | NestJS                             | Fastify (nếu ưu tiên performance) |
| ORM       | **TypeORM** (đang dùng)            | Prisma, Drizzle, raw SQL          |
| Charts    | Lightweight Charts hoặc Highcharts | TradingView, ECharts              |


---

*Tài liệu tham khảo cho đồ án tốt nghiệp – Sàn giao dịch chứng khoán trực tuyến VN*