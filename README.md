# HMT Project Setup

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB (local or remote)

## 1) Clone and install

```bash
git clone <your-repo-url>
cd Desktop

cd backend
npm install

cd ../frontend
npm install
```

## 2) Environment setup

Create env files before running the apps.

### Backend

Create `backend/.env` with your values:

```env
PORT=3002
MONGODB_URI=mongodb://localhost:27017/hmt
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3002

# Email (choose one method)
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USER=
# SMTP_PASS=

# or Gmail
# GMAIL_USER=
# GMAIL_APP_PASSWORD=

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3002/api
```

## 3) Seed database (optional)

```bash
cd backend
npm run seed
```

## 4) Run the apps

### Backend

```bash
cd backend
npm run dev
```

### Frontend

```bash
cd frontend
npm run dev
```

## Test commands

### Backend tests

```bash
cd backend
npm test
```

Test logs are saved to:

- `backend/test-results/latest.log`
- `backend/test-results/backend-tests-YYYY-MM-DDTHH-MM-SS-sssZ.log`

### Frontend tests

```bash
cd frontend
npm test
```

Test logs are saved to:

- `frontend/test-results/latest.log`
- `frontend/test-results/frontend-tests-YYYY-MM-DDTHH-MM-SS-sssZ.log`
