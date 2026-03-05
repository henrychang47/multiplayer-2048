# Multiplayer 2048

A multiplayer version of 2048 playable across devices in real time.

## Project Structure

This repository contains two main parts:
- **client/**: The frontend React application built with Vite and TypeScript.
- **server/**: The backend Python application built with FastAPI and WebSockets.

## Deployment

Since this project uses a monorepo structure, follow these steps to deploy each part:

### 1. Backend (Server)
Deploy the `server/` folder to a service like [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io).

- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment**: Your platform will usually provide a `$PORT` environment variable automatically.

### 2. Frontend (Client)
Deploy the `client/` folder to a static site host like [Vercel](https://vercel.com) or [Netlify](https://www.netlify.com).

- **Environment Variable**: You **must** set an environment variable named `VITE_WS_URL`.
- **Value**: The URL of your deployed backend (e.g., `wss://your-backend-url.onrender.com`). Note the `wss://` protocol for secure WebSockets.
- **Root Directory**: Set to `client/`.
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
