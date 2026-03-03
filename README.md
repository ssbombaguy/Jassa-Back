# Adidas Soccer Jersey Database API

A production-ready REST API built with Node.js, Express, and **Neon serverless PostgreSQL** for managing an Adidas soccer jersey catalog. Deploy on Vercel, Railway, or any Node.js host — no local database required!

## ⚡ Quick Start (5 minutes)

### Prerequisites

- **Node.js** 20.0.0 or higher
- That is it! No PostgreSQL install needed.

### Step 1: Set up Neon (Free)

1. Go to https://neon.tech and click Sign up
2. Create a new project:
   - Click New Project
   - Name it `football-db`
   - Select your region
   - Click Create
3. Copy your connection string from Dashboard → Connection Details:
   ```
   postgresql://neondb_owner:xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Install & Configure

```bash
cd football-backend
npm install
cp .env.example .env
```

Paste your Neon connection string in `.env`:

```env
DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
PORT=3000
NODE_ENV=development
```

### Step 3: Seed & Run

```bash
npm run seed
npm run dev
```

Visit http://localhost:3000/api/leagues — done!

---

## 📁 Project Structure

```
/
├── server.js                 # Express app, middleware, routes
├── db.js                     # Neon connection pool
├── seed.js                   # Database seeding script
├── .env.example              # Environment template
├── package.json
├── README.md
├── middleware/
│   ├── errorHandler.js       # Global error handler
│   └── notFound.js           # 404 handler
├── routes/
│   ├── leagues.js            # GET /api/leagues
│   ├── clubs.js              # GET /api/clubs
│   └── jerseys.js            # GET/POST/PUT/DELETE /api/jerseys
└── validators/
    └── jerseyValidator.js    # express-validator rules
```

---

## 🗄️ Database Schema

### Leagues

| Column | Type | Constraints |
|--------|------|-------------|
| league_id | SERIAL | PRIMARY KEY |
| league_name | VARCHAR(100) | NOT NULL, UNIQUE |
| short_code | VARCHAR(10) | NOT NULL |
| country | VARCHAR(60) | NOT NULL |
| confederation | VARCHAR(20) | UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC |
| tier | SMALLINT | DEFAULT 1 |
| adidas_partner | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### Clubs

| Column | Type | Constraints |
|--------|------|-------------|
| club_id | SERIAL | PRIMARY KEY |
| league_id | INT | FK → leagues, ON DELETE RESTRICT |
| club_name | VARCHAR(100) | NOT NULL |
| founded_year | SMALLINT | |
| city | VARCHAR(60) | |
| country | VARCHAR(60) | |
| primary_color | CHAR(7) | Hex color |
| adidas_partner | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Index:** `idx_clubs_league_id`

### Jerseys

| Column | Type | Constraints |
|--------|------|-------------|
| jersey_id | SERIAL | PRIMARY KEY |
| club_id | INT | FK → clubs, ON DELETE CASCADE |
| league_id | INT | FK → leagues, ON DELETE RESTRICT |
| product_code | VARCHAR(20) | NOT NULL, UNIQUE |
| season | VARCHAR(9) | e.g. 2024/25 |
| jersey_type | VARCHAR(20) | home, away, third, goalkeeper |
| name | VARCHAR(150) | NOT NULL |
| price_usd | DECIMAL(8,2) | CHECK > 0 |
| technology | VARCHAR(50) | HEAT.RDY, AEROREADY |
| in_stock | BOOLEAN | DEFAULT true |
| release_date | DATE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_jerseys_club_id`, `idx_jerseys_league_id`, `idx_jerseys_season`

---

## 📡 API Endpoints

All responses include `{ success: true/false, data: ..., pagination: ... }`

Error format: `{ success: false, error: "message" }`

### LEAGUES

#### GET /api/leagues

List all leagues (paginated).

**Query:**
- `page` (default 1)
- `limit` (default 20, max 100)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "league_id": 1,
      "league_name": "Premier League",
      "short_code": "EPL",
      "country": "England",
      "confederation": "UEFA",
      "tier": 1,
      "adidas_partner": true,
      "created_at": "2024-03-03T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

**curl:**
```bash
curl http://localhost:3000/api/leagues
curl http://localhost:3000/api/leagues?page=1&limit=10
```

---

#### GET /api/leagues/:id

Single league.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "league_id": 1,
    "league_name": "Premier League",
    "short_code": "EPL",
    "country": "England",
    "confederation": "UEFA",
    "tier": 1,
    "adidas_partner": true,
    "created_at": "2024-03-03T10:00:00Z"
  }
}
```

**Response (404):**

```json
{
  "success": false,
  "error": "Not found"
}
```

**curl:**
```bash
curl http://localhost:3000/api/leagues/1
```

---

#### GET /api/leagues/:id/clubs

All clubs in league.

**Query:**
- `page` (default 1)
- `limit` (default 20, max 100)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "club_id": 1,
      "league_id": 1,
      "club_name": "Arsenal",
      "short_name": "ARS",
      "founded_year": 1886,
      "city": "London",
      "country": "England",
      "primary_color": "#EF0107",
      "secondary_color": "#FFFFFF",
      "adidas_partner": true,
      "created_at": "2024-03-03T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 4 }
}
```

**curl:**
```bash
curl http://localhost:3000/api/leagues/1/clubs
```

---

#### GET /api/leagues/:id/jerseys

All jerseys in league (JOINed with club info).

**Query:**
- `page` (default 1)
- `limit` (default 20, max 100)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "jersey_id": 1,
      "club_id": 1,
      "league_id": 1,
      "product_code": "AR6001",
      "season": "2024/25",
      "jersey_type": "home",
      "name": "Arsenal Home Jersey 2024/25",
      "price_usd": "120.00",
      "technology": "HEAT.RDY",
      "in_stock": true,
      "release_date": "2024-06-15",
      "created_at": "2024-03-03T10:00:00Z",
      "club_name": "Arsenal",
      "short_name": "ARS",
      "club_city": "London",
      "league_name": "Premier League",
      "short_code": "EPL"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12 }
}
```

**curl:**
```bash
curl http://localhost:3000/api/leagues/1/jerseys?limit=5
```

---

### CLUBS

#### GET /api/clubs

All clubs with optional league filter.

**Query:**
- `league_id` (optional filter)
- `page` (default 1)
- `limit` (default 20, max 100)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "club_id": 1,
      "league_id": 1,
      "club_name": "Arsenal",
      "short_name": "ARS",
      "founded_year": 1886,
      "city": "London",
      "country": "England",
      "primary_color": "#EF0107",
      "secondary_color": "#FFFFFF",
      "adidas_partner": true,
      "created_at": "2024-03-03T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 14 }
}
```

**curl:**
```bash
curl http://localhost:3000/api/clubs
curl http://localhost:3000/api/clubs?league_id=1
```

---

#### GET /api/clubs/:id

Single club with league info (JOINed).

**Response (200):**

```json
{
  "success": true,
  "data": {
    "club_id": 1,
    "league_id": 1,
    "club_name": "Arsenal",
    "short_name": "ARS",
    "founded_year": 1886,
    "city": "London",
    "country": "England",
    "primary_color": "#EF0107",
    "secondary_color": "#FFFFFF",
    "adidas_partner": true,
    "created_at": "2024-03-03T10:00:00Z",
    "league_name": "Premier League",
    "short_code": "EPL",
    "confederation": "UEFA"
  }
}
```

**curl:**
```bash
curl http://localhost:3000/api/clubs/1
```

---

#### GET /api/clubs/:id/jerseys

All jerseys for club.

**Query:**
- `page` (default 1)
- `limit` (default 20, max 100)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "jersey_id": 1,
      "club_id": 1,
      "league_id": 1,
      "product_code": "AR6001",
      "season": "2024/25",
      "jersey_type": "home",
      "name": "Arsenal Home Jersey 2024/25",
      "price_usd": "120.00",
      "technology": "HEAT.RDY",
      "in_stock": true,
      "release_date": "2024-06-15",
      "created_at": "2024-03-03T10:00:00Z",
      "club_name": "Arsenal",
      "short_name": "ARS",
      "league_name": "Premier League"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3 }
}
```

**curl:**
```bash
curl http://localhost:3000/api/clubs/1/jerseys
```

---

### JERSEYS

#### GET /api/jerseys

All jerseys with multiple filters.

**Query:**
- `club_id` (optional)
- `league_id` (optional)
- `type` (home, away, third, goalkeeper)
- `season` (2024/25)
- `in_stock` (true/false)
- `page` (default 1)
- `limit` (default 20, max 100)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "jersey_id": 1,
      "club_id": 1,
      "league_id": 1,
      "product_code": "AR6001",
      "season": "2024/25",
      "jersey_type": "home",
      "name": "Arsenal Home Jersey 2024/25",
      "price_usd": "120.00",
      "technology": "HEAT.RDY",
      "in_stock": true,
      "release_date": "2024-06-15",
      "created_at": "2024-03-03T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 40 }
}
```

**curl:**
```bash
curl http://localhost:3000/api/jerseys
curl http://localhost:3000/api/jerseys?type=home
curl http://localhost:3000/api/jerseys?club_id=1&in_stock=true
curl http://localhost:3000/api/jerseys?league_id=1&type=away
curl http://localhost:3000/api/jerseys?season=2024/25&page=2&limit=10
```

---

#### GET /api/jerseys/:id

Single jersey with club + league info.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "jersey_id": 1,
    "club_id": 1,
    "league_id": 1,
    "product_code": "AR6001",
    "season": "2024/25",
    "jersey_type": "home",
    "name": "Arsenal Home Jersey 2024/25",
    "price_usd": "120.00",
    "technology": "HEAT.RDY",
    "in_stock": true,
    "release_date": "2024-06-15",
    "created_at": "2024-03-03T10:00:00Z",
    "club_name": "Arsenal",
    "short_name": "ARS",
    "city": "London",
    "primary_color": "#EF0107",
    "secondary_color": "#FFFFFF",
    "league_name": "Premier League",
    "short_code": "EPL"
  }
}
```

**curl:**
```bash
curl http://localhost:3000/api/jerseys/1
```

---

#### POST /api/jerseys

Create jersey. All fields required unless marked optional.

**Body:**

```json
{
  "club_id": 1,
  "league_id": 1,
  "product_code": "AR6004",
  "season": "2024/25",
  "jersey_type": "goalkeeper",
  "name": "Arsenal Goalkeeper Jersey 2024/25",
  "price_usd": 125,
  "technology": "AEROREADY",
  "in_stock": true,
  "release_date": "2024-07-01"
}
```

**Validation:**
- `club_id`: integer, required
- `league_id`: integer, required
- `product_code`: string 5-20 chars, no spaces, required
- `season`: matches YYYY/YY, required
- `jersey_type`: home|away|third|goalkeeper, required
- `name`: max 150, required
- `price_usd`: float 1-999, required
- `technology`: max 50, optional
- `in_stock`: boolean, optional (default true)
- `release_date`: ISO date, optional

**Response (201):**

```json
{
  "success": true,
  "data": {
    "jersey_id": 42,
    "club_id": 1,
    "league_id": 1,
    "product_code": "AR6004",
    "season": "2024/25",
    "jersey_type": "goalkeeper",
    "name": "Arsenal Goalkeeper Jersey 2024/25",
    "price_usd": "125.00",
    "technology": "AEROREADY",
    "in_stock": true,
    "release_date": "2024-07-01",
    "created_at": "2024-03-03T10:00:00Z"
  }
}
```

**Response (400 — validation error):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "product_code", "message": "product_code must be 5-20 characters" }
  ]
}
```

**curl:**
```bash
curl -X POST http://localhost:3000/api/jerseys \
  -H "Content-Type: application/json" \
  -d '{
    "club_id": 1,
    "league_id": 1,
    "product_code": "AR6004",
    "season": "2024/25",
    "jersey_type": "goalkeeper",
    "name": "Arsenal Goalkeeper Jersey 2024/25",
    "price_usd": 125,
    "technology": "AEROREADY",
    "release_date": "2024-07-01"
  }'
```

---

#### PUT /api/jerseys/:id

Update jersey (all fields optional).

**Body (example):**

```json
{
  "price_usd": 130,
  "in_stock": false,
  "technology": "HEAT.RDY"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "jersey_id": 1,
    "club_id": 1,
    "league_id": 1,
    "product_code": "AR6001",
    "season": "2024/25",
    "jersey_type": "home",
    "name": "Arsenal Home Jersey 2024/25",
    "price_usd": "130.00",
    "technology": "HEAT.RDY",
    "in_stock": false,
    "release_date": "2024-06-15",
    "created_at": "2024-03-03T10:00:00Z"
  }
}
```

**curl:**
```bash
curl -X PUT http://localhost:3000/api/jerseys/1 \
  -H "Content-Type: application/json" \
  -d '{ "price_usd": 130, "in_stock": false }'
```

---

#### DELETE /api/jerseys/:id

Delete jersey.

**Response (200):**

```json
{
  "success": true,
  "data": { "jersey_id": 1 }
}
```

**Response (404):**

```json
{
  "success": false,
  "error": "Not found"
}
```

**curl:**
```bash
curl -X DELETE http://localhost:3000/api/jerseys/1
```

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon connection string |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | development / production |

---

## 📦 Scripts

```bash
npm start     # Production
npm run dev   # Development with auto-reload
npm run seed  # Reset DB and seed data
```

---

## 🚀 Deploy

### Vercel

```bash
git push
# Auto-deploys on push
```

### Railway

```bash
npm install -g railway
railway link
railway up
```

---

## 🛠️ Tech Stack

- **Node.js 20** — Runtime
- **Express 4** — Web framework
- **Neon PostgreSQL** — Serverless database
- **pg 8** — PostgreSQL driver
- **express-validator 7** — Input validation
- **helmet 7** — Security headers
- **cors 2** — Cross-origin requests
- **morgan** — HTTP logging
- **dotenv** — Environment variables

---

## 📝 License

MIT
