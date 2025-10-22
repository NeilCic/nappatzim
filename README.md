# Nappatzim - Workout Tracking App

Fitness tracking application with React Native mobile app and Express/Prisma backend.

---

## Architecture

- **Backend:** Express.js + Prisma ORM
- **Database:** PostgreSQL (local via Docker / Neon for production)
- **Mobile:** React Native (Expo)
- **Deployment:** Render (backend) + Neon (database)

---

## Local Development Setup

### 1. Start Local Database

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` and pgAdmin on `localhost:5050`

### 2. Configure Backend Environment

Ensure your `.env` file has:

```env
DATABASE_URL="postgresql://neil:secret123@localhost:5432/napadb?schema=public"
JWT_SECRET=K8s9mN2pQ7rT4vX1wZ5aB8cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN
```

### 3. Start Backend Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Backend runs on `http://localhost:3000`

### 4. Configure Mobile App

In `mobile/App.js` or wherever API base URL is configured, use:

```javascript
const API_BASE_URL = "http://192.168.1.215:3000"; // Your local IP
```

### 5. Start Mobile App

```bash
cd mobile
npx expo start
```

---

## Production Deployment

### Backend (Render)

**Deployment URL:** `https://nappatzim.onrender.com`

#### Environment Variables (Set in Render Dashboard)

Navigate to your Render service → Environment tab and set:

```
DATABASE_URL=postgresql://neondb_owner:npg_QuRG1d0pvAIt@ep-sparkling-mud-abdv14rt-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

JWT_SECRET=K8s9mN2pQ7rT4vX1wZ5aB8cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN5pQ8rT1vX4wZ7aB0cE3fG6hI9jL2mN
```

**Important:**

- Your local `.env` file is in `.gitignore` and does NOT get deployed
- Environment variables must be set in Render's dashboard
- Render automatically redeploys when you push to main branch

### Database (Neon)

**Connection:** Already configured via `DATABASE_URL` in Render

- No local setup needed
- Database is in EU-West-2 region
- Uses connection pooling (`-pooler` endpoint)

### Mobile App (Testing Production)

In `mobile/App.js` or API config, use:

```javascript
const API_BASE_URL = "https://nappatzim.onrender.com";
```

Then start mobile with tunnel:

```bash
cd mobile
npx expo start --tunnel
```

---

## Quick Reference: Local vs Production

| Component          | Local                           | Production                       |
| ------------------ | ------------------------------- | -------------------------------- |
| **Mobile API URL** | `http://192.168.1.215:3000`     | `https://nappatzim.onrender.com` |
| **Backend .env**   | Local postgres + JWT_SECRET     | Set in Render dashboard          |
| **Database**       | Docker Compose (localhost:5432) | Neon (cloud)                     |
| **Run Docker**     | ✅ Yes (`docker-compose up -d`) | ❌ No                            |
| **Run npm start**  | ✅ Yes (backend)                | ❌ No (Render handles it)        |
| **Mobile Expo**    | `npx expo start`                | `npx expo start --tunnel`        |

---

## Common Commands

### Backend

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### Mobile

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npx expo start

# Start with tunnel (for production testing)
npx expo start --tunnel

# Run on Android
npx expo start --android

# Run on iOS
npx expo start --ios
```

### Database

```bash
# Start local database
docker-compose up -d

# Stop local database
docker-compose down

# View logs
docker-compose logs -f postgres

# Access pgAdmin
# Open browser: http://localhost:5050
# Email: admin@admin.com
# Password: admin
```

---

## Project Structure

```
Nappatzim/
├── controllers/          # Request handlers
├── services/             # Business logic
├── routes/               # API routes
├── middleware/           # Auth middleware
├── lib/                  # Prisma client
├── prisma/               # Database schema & migrations
├── mobile/               # React Native app
│   └── src/
│       ├── screens/      # App screens
│       ├── components/   # Reusable components
│       └── utils/        # Utilities
├── index.js              # Express server entry point
├── docker-compose.yml    # Local database setup
└── .env                  # Environment variables (not in git)
```

---

## Troubleshooting

### "Can't connect to database"

- **Local:** Ensure `docker-compose up -d` is running
- **Production:** Check Render environment variables are set correctly

### "Mobile app can't reach API"

- **Local:** Use your computer's local IP (192.168.x.x), not localhost
- **Production:** Ensure API_BASE_URL points to `https://nappatzim.onrender.com`

### "Token expired"

- Tokens expire after 15 minutes
- Refresh token is valid for 7 days
- Re-login if refresh token expired

---

## Security Notes

- Never commit `.env` file to git
- Keep `JWT_SECRET` secure and unique
- Use different secrets for local/production
- Database credentials should be rotated periodically
- CORS is currently wide open (`cors()`) - should be restricted in production

---

## License

ISC

---

---

---

For LOCAL development:
set const USE_PRODUCTION = false;
✅ Run: docker-compose up -d
✅ Run: npm start (backend)
✅ Run: npx expo start (mobile)

For DEPLOYED (Render):
set const USE_PRODUCTION = true;
✅ Don't run docker-compose
✅ Don't run npm start locally
✅ Run: npx expo start --tunnel (mobile)

before pushing to git - always revert to DEPLOYMENT mode
