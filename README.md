# Nappatzim

Nappatzim is a modern workout-tracking platform that pairs a React Native mobile client with an Express/Prisma backend. The goal is to deliver a smooth experience for programming workouts, logging sessions, and syncing data across devices.

---

## Features at a Glance

- **Cross-platform mobile experience** via Expo + React Native.
- **Secure REST API** powered by Express.js, Prisma ORM, and JWT authentication.
- **PostgreSQL storage** (Docker for development, Neon for cloud hosting).
- **Cloud-friendly deployment** targeting Render for the backend and Neon for the database.

---

## Architecture Overview

| Layer        | Technology                              |
| ------------ | ---------------------------------------- |
| Mobile App   | React Native (Expo)                      |
| API Server   | Node.js · Express.js · Prisma ORM        |
| Database     | PostgreSQL                               |
| Deployment   | Render (API) · Neon (Database)           |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or yarn)
- Docker & Docker Compose (for local database)
- Expo CLI (`npm install -g expo-cli`)

### 1. Install Dependencies

```bash
npm install
cd mobile && npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root (keep it out of version control). Use placeholders such as:

```env
# Backend
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<db>?schema=public"
JWT_SECRET="<32+ character random string>"

# Optional: Docker Compose defaults
POSTGRES_USER=<postgres-user>
POSTGRES_PASSWORD=<postgres-password>
POSTGRES_DB=<postgres-database>

# Mobile API base
API_BASE_URL="http://<your-local-ip>:3000"
```

For production, define the same variable names in Render's dashboard and point `DATABASE_URL` to your Neon connection string.

### 3. Start Local Services

```bash
docker compose up -d
```

- PostgreSQL available at `localhost:5432`
- pgAdmin available at `http://localhost:5050`

### 4. Prepare the Database

```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Start the Backend

```bash
npm run dev
```

The API is served at `http://localhost:3000`.

### 6. Launch the Mobile App

```bash
cd mobile
npx expo start
```

Set `API_BASE_URL` to your machine's LAN IP so the emulator/device can reach the backend.

---

## Deployment Notes

### Render (Backend)

1. Connect this repository to Render and enable auto-deploys from the main branch.
2. Configure environment variables (`DATABASE_URL`, `JWT_SECRET`, etc.) in the Render dashboard.
3. Ensure the `DATABASE_URL` uses Neon's SSL-enabled connection string.

### Neon (Database)

- Use the Neon-provided connection string (pooler endpoint recommended).
- Apply Prisma migrations via CI/CD or manually from a trusted environment.

### Mobile Client

- When testing against production, update `API_BASE_URL` to `https://<your-render-app>.onrender.com`.
- Start Expo in tunnel mode if you need the device to reach your local machine: `npx expo start --tunnel`.

---

## Project Structure

```
Nappatzim/
├── controllers/          # Express route controllers
├── services/             # Business/domain services
├── routes/               # API route definitions
├── middleware/           # Auth and other middleware
├── lib/                  # Shared utilities (e.g., Prisma client)
├── prisma/               # Prisma schema & migrations
├── mobile/               # React Native application
│   └── src/
│       ├── screens/
│       ├── components/
│       └── utils/
├── index.js              # Express server entry point
├── docker-compose.yml    # Local infrastructure
└── README.md
```

---

## Useful Commands

| Task                         | Command                                      |
| ---------------------------- | -------------------------------------------- |
| Install backend dependencies | `npm install`                                |
| Install mobile dependencies  | `cd mobile && npm install`                   |
| Start local Postgres         | `docker compose up -d`                       |
| Stop local Postgres          | `docker compose down`                        |
| Generate Prisma client       | `npx prisma generate`                        |
| Run migrations               | `npx prisma migrate dev`                     |
| Start backend (dev)          | `npm run dev`                                |
| Start Expo dev server        | `cd mobile && npx expo start`                |
| Expo with tunnel             | `cd mobile && npx expo start --tunnel`       |

---

## Troubleshooting

- **Database connection issues**
  - Ensure Docker is running and the compose stack is up.
  - Confirm `DATABASE_URL` matches your local credentials.
- **Mobile cannot reach API**
  - Use your machine's LAN IP rather than `localhost`.
  - Verify the backend is listening on port 3000.
- **Expired tokens**
  - Access tokens expire after 15 minutes; refresh tokens are valid for 7 days.
  - Trigger the refresh endpoint or re-authenticate.

---

## Security Checklist

- Keep `.env` out of version control.
- Rotate database credentials and JWT secrets regularly.
- Restrict CORS in production to trusted origins.
- Use different secrets for each environment.

---

## License

ISC License.