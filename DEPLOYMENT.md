# 🚀 Deploying IPL Auction for Free

Follow these steps to host your auction app and play with friends online.

## 1. Backend (WebSocket Server) - Host on Render
Render's free tier supports Node.js services.

1. Create a free account on [Render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Use these settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. **CRITICAL**: Go to **Settings** and ensure the port is `8081` or whatever you defined. Render usually provides a dynamic port via `process.env.PORT`. 
   > **Note**: I've updated the server to handle Render's dynamic port.
6. Copy your Service URL (e.g., `https://ipl-auction-backend.onrender.com`).
   - Change `https` to `wss` for the WebSocket URL: `wss://ipl-auction-backend.onrender.com`.

## 2. Frontend (React App) - Host on Vercel
Vercel is the best for fast React deployments.

1. Create a free account on [Vercel.com](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. **Environment Variables**:
   - Add a variable named `VITE_WS_URL`.
   - Set the value to your Backend WebSocket URL from step 1 (e.g., `wss://ipl-auction-backend.onrender.com`).
5. Click **Deploy**.

## 3. Deployment Ready Checklist
- [ ] **WS URL**: Ensure the frontend has the correct `wss://` address in the Vercel environment variables.
- [ ] **CORS/Origin**: Render handles the WebSocket traffic, but ensure you aren't blocking connections from your Vercel domain.

## ⚠️ Free Tier Limitations
- **Cold Starts**: Render's free tier spins down after 15 minutes of inactivity. The first person to join might need to wait 30 seconds for the server to "wake up".
- **Concurrent Connections**: Free tiers are fine for 10-20 friends but might lag if 100+ people join.

## 🛠️ Performance Tip
For the best experience (zero lag), consider **Railway.app**. It gives you a $5 free trial credit which is enough to run this auction for months with no sleep/cold-start issues.

---
**Enjoy your Auction!** 🏏
