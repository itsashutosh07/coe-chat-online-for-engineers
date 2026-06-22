# COE Chat — Chat Online for Engineers

Realtime chat app with WebSockets (Socket.io), Node.js, Express, and MongoDB.

## Authors

1. Ashutosh Jaiswal : 2019UCO1616
2. Ayush Mishra : 2019UCO1617
3. Kapish Garg : 2019UCO1618

## Features

- Real-time messaging with room-based chat
- Message history (last 50 messages per room, 7-day TTL)
- Typing indicators, live room directory with online counts
- Reconnection handling, mobile sidebar drawer
- Message bubbles (own vs others), bot/system messages
- Code block rendering, @mentions highlighting
- Rate limiting, security headers, health check endpoint

## Tech Stack

HTML, CSS, JavaScript, Node.js, Express, Socket.io, MongoDB (Mongoose), Render

## Local Setup

```bash
cp .env.example .env
# Add your MongoDB Atlas connection string to .env

npm install
npm run dev   # development with nodemon
# or
npm start
```

Open http://localhost:3000

## Deployment (Render Free Tier)

1. Set `MONGODB_URI` in Render environment variables
2. Deploy with `web: node app.js` (see Procfile)
3. **Keep-alive:** Render spins down after 15 min idle. Set up [cron-job.org](https://cron-job.org) to ping `GET https://your-app.onrender.com/health` every **14 minutes**

## Hosted Link

https://coe-chat-online-for-engineers.onrender.com/

## Project Structure

```
app.js              # Entry point
config/db.js        # MongoDB connection
models/             # User & Message schemas
socket/handlers.js  # Socket.io event handlers
public/             # Static frontend
```
