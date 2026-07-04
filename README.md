# 💬 Family Link

Private voice & text chat for two people. Works over the internet on any device with Chrome.

> [!NOTE]
> ### 🤖 AI Context & System Overview
> *This section is optimized for AI assistants to instantly parse the project's purpose, design patterns, and codebase layout.*
>
> #### 1. Core Product & Flow
> - **Purpose:** A Progressive Web App (PWA) for direct, private communication (real-time chat and WebRTC voice calls) between exactly two users.
> - **Authentication:** Zero database or authentication overhead. Session state is stored in localStorage. Connection is established by sharing a random 6-character room code.
> - **Capacity:** Strictly 2 users per room code. Rooms automatically clean up 1 hour after all users disconnect.
>
> #### 2. Codebase Architecture
> - **Frontend (React + Vite in `/frontend`):**
>   - **Styling:** Premium, minimalist iOS-style dark mode styling inside [App.css](file:///c:/Users/manip/OneDrive/Desktop/family-link/frontend/src/App.css) (no Tailwind).
>   - **PWA Configuration:** Service workers and offline manifest handled via `vite-plugin-pwa` in [vite.config.js](file:///c:/Users/manip/OneDrive/Desktop/family-link/frontend/vite.config.js).
>   - **Real-time / WebRTC Hook:** [useSocket.js](file:///c:/Users/manip/OneDrive/Desktop/family-link/frontend/src/hooks/useSocket.js) handles all connection lifecycles, message streams, RTCPeerConnection signaling (offer/answer/ice-candidate), and microphone access.
> - **Backend (Node.js + Express + Socket.IO in `/backend`):**
>   - **State:** In-memory `rooms` map tracking messages and socket IDs.
>   - **Key file:** [server.js](file:///c:/Users/manip/OneDrive/Desktop/family-link/backend/server.js) runs the HTTP server, Socket.IO instance, WebRTC signaling events, and room code endpoints.
>
> #### 3. Production Deployment Strategy
> - **Frontend Deployment (Vercel - Free Tier):**
>   - Root Directory: `frontend`
>   - Build Command: `npm run build`
>   - Output Directory: `dist`
>   - Environment Variables: `VITE_SERVER_URL` points to the Render backend URL.
> - **Backend Deployment (Render - Web Service):**
>   - Root Directory: `backend`
>   - Build Command: `npm install`
>   - Start Command: `npm start`
>   - Environment Variables: `FRONTEND_URL` points to the Vercel frontend URL.
>   - Health check: Endpoint `GET /` is implemented as a simple API health check returning `Family Link API is running` (preventing ENOENT errors on health checks).


## How It Works

1. One person **creates a room** → gets a 6-character code
2. Shares the code with the other person
3. Other person **joins the room** with that code
4. Chat and voice call — works across different WiFi networks

## Project Structure

```
family-link/
├── backend/
│   ├── package.json       # Server dependencies
│   └── server.js          # Express + Socket.IO (chat, rooms, WebRTC signaling)
├── frontend/
│   ├── index.html         # Entry HTML with PWA meta
│   ├── vite.config.js     # Vite + PWA plugin config
│   ├── public/icons/      # App icons (192, 512)
│   └── src/
│       ├── main.jsx       # React mount
│       ├── App.jsx        # Main app shell (header, routing)
│       ├── App.css        # All styles (Apple iOS dark theme)
│       ├── components/
│       │   ├── JoinRoom.jsx    # Create/join room screen
│       │   ├── Chat.jsx        # Message list + composer
│       │   └── CallScreen.jsx  # Voice call overlay
│       └── hooks/
│           └── useSocket.js    # Socket.IO + WebRTC logic
├── .gitignore
└── README.md
```

## Local Development

```bash
# Terminal 1 — Backend
cd backend
npm install
npm start                  # → http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev                # → http://localhost:5173
```

---

## 🚀 Deploy to Production (Two Phones Over Internet)

### Step 1: Push to GitHub

```bash
cd family-link
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/family-link.git
git push -u origin main
```

### Step 2: Deploy Backend on Render (free)

1. Go to [render.com](https://render.com) → New → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Environment variables:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` (add after frontend deploy) |
5. Deploy → copy the URL (e.g. `https://family-link-backend.onrender.com`)

### Step 3: Deploy Frontend on Vercel (free)

1. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
2. Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Environment variables:
   | Key | Value |
   |---|---|
   | `VITE_SERVER_URL` | `https://family-link-backend.onrender.com` (your Render URL) |
4. Deploy → copy the URL
5. **Go back to Render** → add `FRONTEND_URL` = your Vercel URL

### Step 4: Use It

1. Open the Vercel URL on Phone 1 → Create Room → get code
2. Open the Vercel URL on Phone 2 → Join Room → enter code
3. Chat + Call 🎉

> **Tip:** On Android Chrome, tap the menu → "Add to Home Screen" to install as an app.

---

## Environment Variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | Backend | 3001 | Server port |
| `FRONTEND_URL` | Backend | http://localhost:5173 | CORS allowed origin |
| `NODE_ENV` | Backend | development | `production` serves static files |
| `VITE_SERVER_URL` | Frontend | http://localhost:3001 | Backend API/Socket URL |

## Features

- ✅ Any 2 users (room code system)
- ✅ Real-time text chat
- ✅ Voice calling (WebRTC)
- ✅ Online/offline status
- ✅ Incoming call (accept/reject)
- ✅ Mute mic + call timer
- ✅ Auto-reconnect
- ✅ Installable PWA
- ✅ Apple-style dark UI
- ✅ Works over internet (different WiFi)
