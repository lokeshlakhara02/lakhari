# Lakhari - Anonymous Chat Platform

A modern, real-time anonymous chat platform built with React, TypeScript, Node.js, and WebSocket technology. Connect with strangers worldwide through text and video chat.

## Features

### Core Features
- 🎯 **Anonymous Chat**: No registration required, completely anonymous
- 💬 **Text Chat**: Real-time messaging with typing indicators
- 📹 **Video Chat**: Face-to-face conversations with WebRTC
- 🎯 **Interest Matching**: Find like-minded people based on shared interests
- 🌐 **Global Community**: Connect with users from around the world
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Beautiful, accessible interface with dark/light themes
- ⚡ **Real-time**: Instant connections and messaging

### 🚀 Enhanced Dynamic Features

#### **Professional Homepage UI/UX with GSAP & Parallax**
- 🚀 **GSAP-powered animations** for smooth 60fps performance
- 🌊 **Parallax scrolling effects** for depth and dimension
- 🎯 **Compact hero section** with prominent, large CTA buttons
- ⚡ Timeline animations with staggered effects
- 📊 Scroll-triggered animations for all sections
- 🎨 Triple gradient buttons (primary → secondary → accent)
- 💫 Parallax background elements at different speeds
- ❓ Comprehensive FAQ section with accordion UI
- 🎪 6 feature cards with GSAP scroll animations
- 🔽 Sticky floating CTA button for quick access
- 📱 Fully responsive on all devices

#### **Real-time Auto-refreshing Stats**
- Live counter updates every 5 seconds
- Animated counters with intersection observer
- Active users, chats today, and countries count
- No page refresh needed

#### **Smart Matching Algorithm**
- Priority scoring system (0-100 points)
- Interest matching (50 points max)
- Wait time bonus (30 points) - prioritizes users waiting longer
- Random variety factor (20 points)
- Match quality indicators: 'high', 'medium', 'random'

#### **Session Recovery**
- Automatically recovers chat session after page refresh
- Reconnects you with the same partner if still online
- Preserves conversation continuity
- Works for both text and video chat

#### **Message Read Receipts**
- Delivery status indicators
- Real-time message status updates
- Shows when partner receives and reads messages

#### **Smart Queue Management**
- Real-time queue position updates every 10 seconds
- Dynamic wait time estimation based on queue length
- Automatic queue position broadcasting
- Shows total users in queue

#### **Enhanced Connection Quality Monitoring**
- Adaptive latency-based quality detection
- RTT (Round-Trip Time) measurement
- Quality levels: 'good' (<300ms), 'poor' (>300ms)
- Multiple slow response detection before marking as poor
- Visual indicators in UI

#### **Dynamic Interest Suggestions**
- Trending interests based on current users
- Shows 'hot', 'rising', or 'normal' trends
- Popular interests recommendations
- Real-time interest analytics

#### **Enhanced Analytics Dashboard**
- Real-time metrics and statistics
- Hourly activity charts (24-hour view)
- Active chats vs waiting users
- Match success rate calculation
- Average session duration tracking
- Recently active users count
- Interest distribution analytics

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- **GSAP (GreenSock)** for high-performance animations
- Radix UI components
- React Query for data fetching
- Wouter for routing
- WebSocket for real-time communication
- WebRTC for video chat

### Backend
- Node.js with Express
- TypeScript
- WebSocket server for real-time features
- Drizzle ORM for database operations
- PostgreSQL database
- CORS support

## 🚀 Development Setup

### Prerequisites
- **Node.js 18+** ([Download here](https://nodejs.org/))
- **PostgreSQL database** (Optional - works without database too!)
- **npm** (comes with Node.js)

### Quick Start (Without Database)

If you want to run the website quickly without setting up a database:

1. **Open Terminal/Command Prompt** and navigate to the project folder:
   ```bash
   cd E:\omegle\OmegleWeb
   ```

2. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and visit:
   ```
   https://localhost:5173
   ```

That's it! The website will run in memory-only mode (data won't persist between restarts).

### Full Setup (With Database)

For production use or to persist data, set up PostgreSQL:

1. **Install PostgreSQL** ([Download here](https://www.postgresql.org/download/windows/))

2. **Create a database**:
   - Open pgAdmin or command line
   - Run:
   ```sql
   CREATE DATABASE lakhari;
   ```

3. **Create environment file**:
   - Copy `env.example` to `.env`
   - Edit `.env` and add your database URL:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/lakhari
   PORT=8080
   NODE_ENV=development
   CORS_ORIGIN=https://localhost:5173
   ```

4. **Run database migrations**:
   ```bash
   npm run db:push
   ```

5. **Start the server**:
   ```bash
   npm run dev
   ```

6. **Access the website**:
   - Frontend: https://localhost:5173
   - Backend API: http://localhost:8080
   - WebSocket: ws://localhost:8080/ws

### Testing on Mobile/Other Devices

To access from your phone or other devices on the same network:

1. **Find your computer's IP address**:
   - Windows: Run `ipconfig` in Command Prompt, look for "IPv4 Address"
   - Mac/Linux: Run `ifconfig` or `ip addr`

2. **Start the server** (it binds to 0.0.0.0 by default)

3. **Access from other devices**:
   ```
   https://YOUR-IP:5173
   ```
   Example: `https://192.168.1.100:5173`

### Common Issues & Solutions

**Issue: Port already in use**
```bash
# Change the port in .env file or use:
PORT=3000 npm run dev
```

**Issue: Cannot connect to WebSocket**
- Make sure the server is running
- Check firewall settings
- Verify the WebSocket URL in browser console

**Issue: Database connection failed**
- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Run: `npm run db:push` to create tables

**Issue: Camera/Microphone not working**
- Use HTTPS (not HTTP) - the server runs on https://localhost:5173
- Accept the self-signed certificate when prompted
- Check browser permissions for camera/microphone

## 🚀 Production Deployment on Railway

### Why Railway?
- ✅ **FREE hosting** with $5 monthly credit
- ✅ **Automatic HTTPS** (solves camera/mic issues)
- ✅ **PostgreSQL database included**
- ✅ **Easy deployment** from GitHub
- ✅ **Custom domain support**
- ✅ **WebSocket support** for real-time chat

### Step 1: Prepare Your Code

1. **Create a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Ready for Railway deployment"
   git remote add origin https://github.com/yourusername/OmegleWeb.git
   git push -u origin main
   ```

2. **Make sure your code is ready**:
   - All files committed to Git
   - No sensitive data in code
   - Environment variables documented

### Step 2: Deploy to Railway

1. **Go to Railway**:
   - Visit [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your OmegleWeb repository

2. **Railway will automatically**:
   - Detect your Node.js project
   - Install dependencies
   - Build your application
   - Deploy it

3. **Get your Railway URL**:
   - Railway will provide a URL like: `https://your-app.railway.app`
   - This URL has HTTPS automatically enabled

### Step 3: Add PostgreSQL Database

1. **In Railway Dashboard**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically set the DATABASE_URL environment variable
   - Your app will connect to this database

### Step 4: Configure Environment Variables

In Railway dashboard, add these environment variables:

```
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://your-app.railway.app
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
MAX_WS_CONNECTIONS_PER_IP=5
ENABLE_SECURITY_HEADERS=true
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

### Step 5: Deploy with Custom Domain (Optional)

If you have a custom domain (like lakhari.com):

1. **In Railway Dashboard**:
   - Go to your project
   - Click "Settings" → "Domains"
   - Click "Add Domain"
   - Enter your domain: `lakhari.com`

2. **Configure DNS in your domain provider**:
   - Add CNAME record: `www` → `your-app.railway.app`
   - Add A record: `@` → [Railway IP address]
   - Railway will provide the exact DNS records

3. **SSL Certificate**:
   - Railway automatically issues SSL certificates
   - Your domain will be available at `https://lakhari.com`
   - Camera/microphone will work perfectly

### Step 6: Test Your Deployment

1. **Visit your Railway URL**:
   - `https://your-app.railway.app`
   - Test all features: homepage, interest selection, video chat

2. **Test HTTPS functionality**:
   - Camera/microphone access should work
   - No "Media devices API not supported" errors
   - Video chat should work on mobile and desktop

3. **Test with custom domain** (if configured):
   - `https://lakhari.com`
   - All features should work the same

## Development

### Available Scripts

- `npm run dev` - Start development server with HTTPS
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check
- `npm run db:push` - Push database schema changes

### Project Structure

```
Lakhari/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   ├── types/         # TypeScript type definitions
│   │   └── lib/           # Utility functions
├── server/                 # Node.js backend
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes and WebSocket handlers
│   ├── storage.ts         # Database storage layer
│   └── vite.ts            # Vite development setup
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema
├── migrations/             # Database migrations
└── dist/                   # Production build output
```

## API Endpoints

### REST API
- `GET /api/stats` - Get platform statistics (auto-refreshes)
- `GET /api/analytics` - Get enhanced analytics with charts
- `GET /api/interests/suggestions` - Get dynamic interest suggestions
- `GET /api/health` - Health check endpoint
- `POST /api/feedback` - Submit user feedback
- `POST /api/report` - Report inappropriate behavior

### WebSocket API
- `WebSocket /ws` - Real-time communication

**WebSocket Message Types:**
- `join` - Join the chat platform
- `find_match` - Find a chat partner
- `send_message` - Send a text message
- `typing` - Send typing indicator
- `webrtc_offer` - WebRTC offer for video chat
- `webrtc_answer` - WebRTC answer
- `webrtc_ice_candidate` - ICE candidate for WebRTC
- `end_chat` - End current chat
- `next_stranger` - Skip to next stranger
- `get_session_recovery` - Attempt to recover a session
- `session_recovered` - Session recovery successful
- `session_recovery_failed` - Session recovery failed
- `partner_reconnected` - Partner has reconnected
- `message_delivered` - Message delivery confirmation
- `message_read` - Mark message as read
- `message_read_receipt` - Read receipt notification
- `queue_status` - Real-time queue position updates

## Production Build

To build for production:

```bash
npm run build
npm start
```

The built application will serve from `dist/` folder.

## Cost Breakdown

| Service | Cost | What You Get |
|---------|------|-------------|
| Railway Hosting | FREE ($5 credit) | App hosting + database |
| Custom Domain | Already purchased | Your domain (lakhari.com) |
| SSL Certificate | FREE | Automatic HTTPS |
| **Total Monthly** | **$0** | **Professional setup** |

## Security

- All chats are anonymous and not logged
- No personal information is collected
- WebRTC connections are peer-to-peer
- HTTPS/WSS encryption for production
- Rate limiting and security headers enabled

## Performance

- Optimized WebSocket connections
- Efficient database queries with indexes
- Client-side caching with React Query
- Minimal bundle size with Vite
- Responsive design for all devices
- GSAP animations for smooth 60fps performance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review existing issues and discussions

---

## Quick Deployment Summary

1. **Prepare code**: Commit to GitHub
2. **Deploy to Railway**: Connect GitHub repo
3. **Add database**: PostgreSQL in Railway
4. **Configure domain**: Add custom domain (optional)
5. **Test**: Visit your Railway URL
6. **Result**: Professional chat platform with HTTPS

**Total time**: ~20 minutes
**Total cost**: $0/month
**Result**: Professional OmegleWeb at your custom domain!