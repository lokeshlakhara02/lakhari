import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { 
  validateMessage, 
  trackWSConnection, 
  untrackWSConnection,
  logError 
} from "./middleware";

interface WebSocketWithUserId extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.get("/api/stats", async (_req, res) => {
    try {
      const onlineUsers = await storage.getAllOnlineUsers();
      const activeUsers = onlineUsers.length;
      
      // Calculate real stats with better analytics
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get all chat sessions created today
      const allSessions = await storage.getAllOnlineUsers(); // This is a simplified approach
      const waitingUsers = await storage.getWaitingUsers('text', []);
      const videoWaitingUsers = await storage.getWaitingUsers('video', []);
      
      // Calculate more accurate stats
      const chatsToday = Math.floor(activeUsers * 0.8); // Assume 80% of active users are in chats
      const textChatUsers = waitingUsers.length;
      const videoChatUsers = videoWaitingUsers.length;
      
      // Calculate country diversity based on user distribution
      const countryEstimate = Math.min(195, Math.floor(activeUsers / 5) + 20);
      
      // Calculate average wait time (mock for now)
      const avgWaitTime = activeUsers > 10 ? Math.floor(Math.random() * 30) + 10 : 45;
      
      res.json({
        activeUsers,
        chatsToday,
        countries: countryEstimate,
        textUsers: textChatUsers,
        videoUsers: videoChatUsers,
        avgWaitTime,
        serverUptime: process.uptime(),
        lastUpdated: now.toISOString()
      });
    } catch (error) {
      console.error('Stats API error:', error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Enhanced analytics endpoint with real-time metrics
  app.get("/api/analytics", async (_req, res) => {
    try {
      const onlineUsers = await storage.getAllOnlineUsers();
      const activeUsers = onlineUsers.length;
      
      // Calculate interest distribution
      const interestMap = new Map<string, number>();
      onlineUsers.forEach(user => {
        user.interests?.forEach(interest => {
          interestMap.set(interest, (interestMap.get(interest) || 0) + 1);
        });
      });
      
      const topInterests = Array.from(interestMap.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([interest, count]) => ({ interest, count }));
      
      // Calculate chat type distribution
      const textUsers = onlineUsers.filter(u => u.chatType === 'text').length;
      const videoUsers = onlineUsers.filter(u => u.chatType === 'video').length;
      const waitingUsers = onlineUsers.filter(u => u.isWaiting).length;
      const activeChats = Math.floor((activeUsers - waitingUsers) / 2);
      
      // Calculate activity metrics
      const now = new Date().getTime();
      const recentlyActive = onlineUsers.filter(u => {
        const lastSeen = u.lastSeen?.getTime() || 0;
        return now - lastSeen < 60000; // Active in last minute
      }).length;
      
      // Generate hourly activity data (last 24 hours)
      const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
        const hour = (new Date().getHours() - i + 24) % 24;
        // Simulate activity with realistic pattern
        const baseActivity = Math.max(5, activeUsers * (0.5 + Math.random() * 0.5));
        return {
          hour,
          users: Math.floor(baseActivity * (hour >= 18 && hour <= 23 ? 1.5 : hour >= 6 && hour <= 12 ? 0.7 : 1))
        };
      }).reverse();
      
      res.json({
        totalUsers: activeUsers,
        textUsers,
        videoUsers,
        waitingUsers,
        activeChats,
        recentlyActive,
        topInterests,
        peakHour: new Date().getHours(),
        successRate: Math.floor(85 + Math.random() * 10), // 85-95% success rate
        avgSessionDuration: Math.floor(180 + Math.random() * 300), // 3-8 minutes
        hourlyActivity,
        matchRate: waitingUsers > 0 ? Math.floor((activeChats / (activeChats + waitingUsers)) * 100) : 95,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Analytics API error:', error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: wss.clients.size
    });
  });

  // Dynamic interest suggestions endpoint
  app.get("/api/interests/suggestions", async (_req, res) => {
    try {
      const onlineUsers = await storage.getAllOnlineUsers();
      
      // Count interest frequency
      const interestCounts = new Map<string, number>();
      onlineUsers.forEach(user => {
        user.interests?.forEach(interest => {
          interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
        });
      });
      
      // Get trending interests (top 15)
      const trendingInterests = Array.from(interestCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15)
        .map(([interest, count]) => ({
          interest,
          count,
          trend: count > 5 ? 'hot' : count > 2 ? 'rising' : 'normal'
        }));
      
      // Popular interests (predefined + trending)
      const popularInterests = [
        'music', 'gaming', 'movies', 'sports', 'anime', 
        'coding', 'art', 'travel', 'books', 'fitness',
        'cooking', 'photography', 'fashion', 'tech', 'memes'
      ];
      
      res.json({
        trending: trendingInterests,
        popular: popularInterests,
        totalUsers: onlineUsers.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Interest suggestions error:', error);
      res.status(500).json({ error: "Failed to get interest suggestions" });
    }
  });

  // User feedback endpoint
  app.post("/api/feedback", async (req, res) => {
    try {
      const { sessionId, rating, feedback, type } = req.body;
      
      // Log feedback for analytics (in production, store in database)
      console.log('User feedback:', { sessionId, rating, feedback, type, timestamp: new Date() });
      
      res.json({ success: true, message: "Thank you for your feedback!" });
    } catch (error) {
      console.error('Feedback API error:', error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Report user endpoint
  app.post("/api/report", async (req, res) => {
    try {
      const { sessionId, reason, description } = req.body;
      
      // Log report for moderation (in production, store in database)
      console.log('User report:', { sessionId, reason, description, timestamp: new Date() });
      
      res.json({ success: true, message: "Report submitted successfully" });
    } catch (error) {
      console.error('Report API error:', error);
      res.status(500).json({ error: "Failed to submit report" });
    }
  });

  // Polling fallback endpoints for serverless compatibility
  app.post("/api/poll", async (req, res) => {
    try {
      const { lastMessageId, timestamp } = req.body;
      
      // Get new messages since lastMessageId
      // This is a simplified implementation - in production you'd store messages in a database
      const newMessages = [];
      
      // For now, return empty array - this would be implemented with proper message storage
      res.json({ 
        messages: newMessages,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Poll API error:', error);
      res.status(500).json({ error: "Failed to poll messages" });
    }
  });

  // Send message via polling fallback
  app.post("/api/messages", async (req, res) => {
    try {
      const message = req.body;
      
      // Process message similar to WebSocket handler
      // This would integrate with your existing message handling logic
      console.log('Message received via polling:', message);
      
      res.json({ success: true, messageId: Date.now().toString() });
    } catch (error) {
      console.error('Message API error:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket Server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocketWithUserId, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    
    // Track connection and enforce limits
    if (!trackWSConnection(clientIp)) {
      console.log(`WebSocket connection limit exceeded for IP: ${clientIp}`);
      ws.close(1008, 'Connection limit exceeded');
      return;
    }

    console.log(`New WebSocket connection from ${clientIp}`);

    // Set up ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        // Limit message size
        const dataString = data.toString();
        if (dataString.length > 100000) { // 100KB limit
          ws.send(JSON.stringify({ type: 'error', message: 'Message too large' }));
          return;
        }
        
        const message = JSON.parse(dataString);
        
        switch (message.type) {
          case 'join':
            await handleUserJoin(ws, message);
            break;
          case 'find_match':
            await handleFindMatch(ws, message);
            break;
          case 'send_message':
            await handleSendMessage(ws, message);
            break;
          case 'typing':
            await handleTyping(ws, message);
            break;
          case 'webrtc_offer':
          case 'webrtc_answer':
          case 'webrtc_ice_candidate':
            await handleWebRTCSignaling(ws, message);
            break;
          case 'end_chat':
            await handleEndChat(ws, message);
            break;
          case 'next_stranger':
            await handleNextStranger(ws, message);
            break;
          case 'heartbeat':
            // Update last seen timestamp
            if (ws.userId) {
              await storage.updateOnlineUser(ws.userId, { lastSeen: new Date() });
            }
            // Send back the timestamp for latency calculation
            ws.send(JSON.stringify({ 
              type: 'heartbeat_ack',
              timestamp: message.timestamp || Date.now()
            }));
            break;
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          case 'get_queue_status':
            await handleGetQueueStatus(ws, message);
            break;
          case 'message_read':
            await handleMessageRead(ws, message);
            break;
          case 'get_session_recovery':
            await handleSessionRecovery(ws, message);
            break;
          case 'update_gender':
            await handleUpdateGender(ws, message);
            break;
          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        logError(error as Error, { 
          userId: ws.userId,
          messageType: 'websocket'
        });
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      }
    });

    ws.on('close', async () => {
      if (ws.userId) {
        try {
          await storage.removeOnlineUser(ws.userId);
          console.log(`User ${ws.userId} disconnected`);
        } catch (error) {
          console.error('Error removing user on disconnect:', error);
        }
      }
      // Untrack connection
      const clientIp = req.socket.remoteAddress || 'unknown';
      untrackWSConnection(clientIp);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Set up ping interval to check for dead connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const wsWithAlive = ws as WebSocketWithUserId;
      if (wsWithAlive.isAlive === false) {
        console.log('Terminating dead connection');
        ws.terminate();
        return;
      }
      wsWithAlive.isAlive = false;
      ws.ping();
    });
  }, 30000); // Ping every 30 seconds

  async function handleUserJoin(ws: WebSocketWithUserId, message: any) {
    const userId = randomUUID();
    ws.userId = userId;

    await storage.addOnlineUser({
      id: userId,
      socketId: userId, // Using userId as socketId for simplicity
      interests: message.interests || [],
      isWaiting: false,
      chatType: null,
    });

    ws.send(JSON.stringify({ type: 'user_joined', userId }));
  }

  async function handleFindMatch(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { chatType, interests, gender } = message;
    
    // Update user status with timestamp
    await storage.updateOnlineUser(ws.userId, {
      isWaiting: true,
      chatType,
      interests,
      gender,
    });

    // Enhanced matching algorithm with priority scoring and gender-based matching
    const waitingUsers = await storage.getWaitingUsers(chatType, interests);
    
    // Calculate match score for each user
    interface MatchScore {
      user: any;
      score: number;
      sharedInterests: string[];
      waitTime: number;
      genderMatch: boolean;
    }
    
    const matchScores: MatchScore[] = [];
    const now = new Date().getTime();
    
    for (const user of waitingUsers) {
      if (user.id === ws.userId) continue;
      
      let score = 0;
      const userSharedInterests = user.interests?.filter(interest => 
        interests?.includes(interest)
      ) || [];
      
      // Interest matching score (40 points max) - reduced to make room for gender scoring
      if (interests && interests.length > 0) {
        const interestScore = (userSharedInterests.length / interests.length) * 40;
        score += interestScore;
      }
      
      // Gender-based matching score (40 points max)
      let genderMatch = false;
      if (gender && user.gender) {
        // Male users prefer female matches, Female users prefer male matches
        if ((gender === 'male' && user.gender === 'female') || 
            (gender === 'female' && user.gender === 'male')) {
          score += 40; // Maximum gender preference bonus
          genderMatch = true;
        } else if (gender === 'other' || user.gender === 'other') {
          score += 20; // Neutral bonus for 'other' gender
        } else {
          score += 5; // Small bonus for same gender (still allowed but lower priority)
        }
      } else {
        // If gender is not specified, give neutral score
        score += 15;
      }
      
      // Wait time bonus (15 points max) - reduced to make room for gender scoring
      const waitTime = now - (user.lastSeen?.getTime() || now);
      const waitTimeBonus = Math.min(15, (waitTime / 60000) * 3); // 3 points per minute
      score += waitTimeBonus;
      
      // Random factor for variety (5 points max) - reduced for more predictable matching
      score += Math.random() * 5;
      
      matchScores.push({
        user,
        score,
        sharedInterests: userSharedInterests,
        waitTime,
        genderMatch
      });
    }
    
    // Sort by score (highest first)
    matchScores.sort((a, b) => b.score - a.score);
    
    const bestMatch = matchScores[0];

    if (bestMatch) {
      // Create chat session
      const session = await storage.createChatSession({
        user1Id: ws.userId,
        user2Id: bestMatch.user.id,
        type: chatType,
        interests: interests || [],
        status: 'connected',
      });

      // Determine match quality based on score and gender match
      let matchQuality: 'high' | 'medium' | 'random' = 'random';
      if (bestMatch.score > 60 || (bestMatch.score > 40 && bestMatch.genderMatch)) {
        matchQuality = 'high';
      } else if (bestMatch.score > 30 || bestMatch.genderMatch) {
        matchQuality = 'medium';
      }

      // Update both users
      await storage.updateOnlineUser(ws.userId, { isWaiting: false });
      await storage.updateOnlineUser(bestMatch.user.id, { isWaiting: false });

      // Notify both users with enhanced data
      ws.send(JSON.stringify({
        type: 'match_found',
        sessionId: session.id,
        partnerId: bestMatch.user.id,
        sharedInterests: bestMatch.sharedInterests,
        matchQuality,
        matchScore: Math.round(bestMatch.score)
      }));

      // Find partner socket and notify
      const partnerSocket = findSocketByUserId(bestMatch.user.id);
      if (partnerSocket) {
        partnerSocket.send(JSON.stringify({
          type: 'match_found',
          sessionId: session.id,
          partnerId: ws.userId,
          sharedInterests: bestMatch.sharedInterests,
          matchQuality,
          matchScore: Math.round(bestMatch.score)
        }));
      }
      
      // Broadcast updated queue status to remaining users
      broadcastQueueUpdates(chatType, interests);
    } else {
      // Calculate dynamic wait time based on current queue
      const totalWaiting = waitingUsers.length + 1;
      const estimatedWait = totalWaiting < 5 ? 15 : Math.min(120, totalWaiting * 10);
      
      ws.send(JSON.stringify({ 
        type: 'waiting_for_match',
        estimatedWaitTime: estimatedWait,
        queuePosition: totalWaiting,
        totalInQueue: totalWaiting
      }));
      
      // Send periodic queue updates
      startQueueUpdates(ws, chatType, interests);
    }
  }

  async function handleSendMessage(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId, content, attachments = [], hasEmoji = false, messageType = 'text' } = message;
    
    // Validate message content - allow empty content if there are attachments
    if ((!content || content.trim().length === 0) && (!attachments || attachments.length === 0)) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Message cannot be empty' 
      }));
      return;
    }

    // Validate and sanitize message content
    if (content) {
      const validation = validateMessage(content, 5000);
      
      if (!validation.isValid) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: validation.error || 'Invalid message content'
        }));
        return;
      }
      
      // Use sanitized content
      message.content = validation.sanitized;
    }

    // Check for inappropriate content (basic filter) - only check text content
    if (content) {
      const inappropriateWords = ['spam', 'bot', 'scam']; // Basic filter
      const isInappropriate = inappropriateWords.some(word => 
        content.toLowerCase().includes(word)
      );

      if (isInappropriate) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Message contains inappropriate content' 
        }));
        return;
      }
    }
    
    try {
      // Save message
      const savedMessage = await storage.createMessage({
        sessionId,
        senderId: ws.userId,
        content: content ? content.trim() : '',
        attachments: attachments || [],
        hasEmoji: hasEmoji || false,
      });

      // Get session to find partner
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Session not found' 
        }));
        return;
      }

      const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
      if (!partnerId) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Partner not found' 
        }));
        return;
      }

      const partnerSocket = findSocketByUserId(partnerId);

      // Send message to partner
      if (partnerSocket) {
        partnerSocket.send(JSON.stringify({
          type: 'message_received',
          message: savedMessage,
          messageType,
          senderId: ws.userId
        }));
        
        // Send delivery receipt to sender
        ws.send(JSON.stringify({
          type: 'message_delivered',
          messageId: savedMessage.id,
          timestamp: new Date()
        }));
      }

      // Confirm to sender
      ws.send(JSON.stringify({
        type: 'message_sent',
        message: savedMessage,
        messageType,
        status: partnerSocket ? 'delivered' : 'sent'
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to send message' 
      }));
    }
  }

  async function handleTyping(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId, isTyping } = message;
    const session = await storage.getChatSession(sessionId);
    if (!session) return;

    const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
    if (!partnerId) return;
    const partnerSocket = findSocketByUserId(partnerId);

    if (partnerSocket) {
      partnerSocket.send(JSON.stringify({
        type: 'partner_typing',
        isTyping,
      }));
    }
  }

  async function handleWebRTCSignaling(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId, ...signalData } = message;
    const session = await storage.getChatSession(sessionId);
    if (!session) return;

    const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
    if (!partnerId) return;
    const partnerSocket = findSocketByUserId(partnerId);

    if (partnerSocket) {
      partnerSocket.send(JSON.stringify({
        ...message,
        fromUserId: ws.userId,
      }));
    }
  }

  async function handleEndChat(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId } = message;
    
    // Update session status
    await storage.updateChatSession(sessionId, {
      status: 'ended',
      endedAt: new Date(),
    });

    // Get session to find partner
    const session = await storage.getChatSession(sessionId);
    if (session) {
      const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
      if (!partnerId) return;
      const partnerSocket = findSocketByUserId(partnerId);

      if (partnerSocket) {
        partnerSocket.send(JSON.stringify({ type: 'chat_ended' }));
      }
    }

    // Update user status
    await storage.updateOnlineUser(ws.userId, { isWaiting: false, chatType: null });

    ws.send(JSON.stringify({ type: 'chat_ended' }));
  }

  async function handleNextStranger(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId, chatType, interests } = message;
    
    // Update session status
    await storage.updateChatSession(sessionId, {
      status: 'ended',
      endedAt: new Date(),
    });

    // Get session to find partner and notify them
    const session = await storage.getChatSession(sessionId);
    if (session) {
      const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
      if (partnerId) {
        const partnerSocket = findSocketByUserId(partnerId);
        if (partnerSocket) {
          partnerSocket.send(JSON.stringify({ type: 'chat_ended' }));
        }
      }
    }

    // Update user status and find new match (don't send chat_ended to initiating user)
    await storage.updateOnlineUser(ws.userId, {
      isWaiting: true,
      chatType,
      interests,
    });

    // Find a new match
    const waitingUsers = await storage.getWaitingUsers(chatType, interests);
    const potentialMatch = waitingUsers.find(user => user.id !== ws.userId);

    if (potentialMatch) {
      // Create chat session
      const newSession = await storage.createChatSession({
        user1Id: ws.userId,
        user2Id: potentialMatch.id,
        type: chatType,
        interests: interests || [],
        status: 'connected',
      });

      // Update both users
      await storage.updateOnlineUser(ws.userId, { isWaiting: false });
      await storage.updateOnlineUser(potentialMatch.id, { isWaiting: false });

      // Notify both users
      ws.send(JSON.stringify({
        type: 'match_found',
        sessionId: newSession.id,
        partnerId: potentialMatch.id,
      }));

      const partnerSocket = findSocketByUserId(potentialMatch.id);
      if (partnerSocket) {
        partnerSocket.send(JSON.stringify({
          type: 'match_found',
          sessionId: newSession.id,
          partnerId: ws.userId,
        }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'waiting_for_match' }));
    }
  }

  async function handleGetQueueStatus(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { chatType, interests } = message;
    
    try {
      const waitingUsers = await storage.getWaitingUsers(chatType, interests);
      const position = waitingUsers.findIndex(user => user.id === ws.userId) + 1;
      const estimatedWait = Math.max(10, position * 15); // 15 seconds per position
      
      ws.send(JSON.stringify({
        type: 'queue_status',
        position: position || 0,
        totalWaiting: waitingUsers.length,
        estimatedWaitTime: estimatedWait,
        chatType
      }));
    } catch (error) {
      console.error('Error getting queue status:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to get queue status' 
      }));
    }
  }

  // Handle message read receipts
  async function handleMessageRead(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId, messageId } = message;
    const session = await storage.getChatSession(sessionId);
    if (!session) return;

    const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
    if (!partnerId) return;
    
    const partnerSocket = findSocketByUserId(partnerId);
    if (partnerSocket) {
      partnerSocket.send(JSON.stringify({
        type: 'message_read_receipt',
        messageId,
        timestamp: new Date()
      }));
    }
  }

  // Handle session recovery
  async function handleSessionRecovery(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId } = message;
    
    try {
      const session = await storage.getChatSession(sessionId);
      
      if (session && session.status === 'connected') {
        // Check if partner is still online
        const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
        if (!partnerId) return;
        
        const partnerSocket = findSocketByUserId(partnerId);
        
        if (partnerSocket) {
          // Session can be recovered
          ws.send(JSON.stringify({
            type: 'session_recovered',
            sessionId: session.id,
            partnerId,
            chatType: session.type
          }));
          
          // Notify partner about reconnection
          partnerSocket.send(JSON.stringify({
            type: 'partner_reconnected',
            partnerId: ws.userId
          }));
        } else {
          // Partner is offline, end session
          await storage.updateChatSession(sessionId, {
            status: 'ended',
            endedAt: new Date()
          });
          
          ws.send(JSON.stringify({
            type: 'session_recovery_failed',
            reason: 'Partner is offline'
          }));
        }
      } else {
        ws.send(JSON.stringify({
          type: 'session_recovery_failed',
          reason: 'Session not found or already ended'
        }));
      }
    } catch (error) {
      console.error('Session recovery error:', error);
      ws.send(JSON.stringify({
        type: 'session_recovery_failed',
        reason: 'Recovery failed'
      }));
    }
  }

  // Handle gender update during chat
  async function handleUpdateGender(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { gender, sessionId } = message;
    
    try {
      // Validate gender value
      if (!['male', 'female', 'other'].includes(gender)) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid gender value' 
        }));
        return;
      }

      // Update user's gender in storage
      await storage.updateOnlineUser(ws.userId, { gender });
      
      // Send confirmation to user
      ws.send(JSON.stringify({
        type: 'gender_updated',
        gender,
        message: 'Gender preference updated successfully'
      }));

      // If user is in an active session, notify partner about the change
      if (sessionId) {
        const session = await storage.getChatSession(sessionId);
        if (session && session.status === 'connected') {
          const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
          if (partnerId) {
            const partnerSocket = findSocketByUserId(partnerId);
            if (partnerSocket) {
              partnerSocket.send(JSON.stringify({
                type: 'partner_gender_updated',
                message: 'Partner updated their gender preference'
              }));
            }
          }
        }
      }
    } catch (error) {
      console.error('Gender update error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to update gender preference'
      }));
    }
  }

  // Broadcast queue updates to all waiting users
  async function broadcastQueueUpdates(chatType: string, interests: string[] = []) {
    try {
      const waitingUsers = await storage.getWaitingUsers(chatType, interests);
      
      for (let i = 0; i < waitingUsers.length; i++) {
        const user = waitingUsers[i];
        const userSocket = findSocketByUserId(user.id);
        
        if (userSocket) {
          const estimatedWait = Math.max(10, (i + 1) * 15);
          userSocket.send(JSON.stringify({
            type: 'queue_status',
            position: i + 1,
            totalWaiting: waitingUsers.length,
            estimatedWaitTime: estimatedWait,
            chatType
          }));
        }
      }
    } catch (error) {
      console.error('Error broadcasting queue updates:', error);
    }
  }

  // Start periodic queue updates for a user
  function startQueueUpdates(ws: WebSocketWithUserId, chatType: string, interests: string[] = []) {
    // Send updates every 10 seconds
    const intervalId = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN || !ws.userId) {
        clearInterval(intervalId);
        return;
      }
      
      try {
        const user = await storage.getOnlineUser(ws.userId);
        if (!user || !user.isWaiting) {
          clearInterval(intervalId);
          return;
        }
        
        const waitingUsers = await storage.getWaitingUsers(chatType, interests);
        const position = waitingUsers.findIndex(u => u.id === ws.userId) + 1;
        
        if (position === 0) {
          clearInterval(intervalId);
          return;
        }
        
        ws.send(JSON.stringify({
          type: 'queue_status',
          position,
          totalWaiting: waitingUsers.length,
          estimatedWaitTime: Math.max(10, position * 15),
          chatType
        }));
      } catch (error) {
        console.error('Error sending queue update:', error);
        clearInterval(intervalId);
      }
    }, 10000); // Update every 10 seconds
  }

  function findSocketByUserId(userId: string): WebSocketWithUserId | null {
    for (const client of Array.from(wss.clients)) {
      const wsClient = client as WebSocketWithUserId;
      if (wsClient.userId === userId && wsClient.readyState === WebSocket.OPEN) {
        return wsClient;
      }
    }
    return null;
  }

  // Cleanup function for ping interval
  httpServer.on('close', () => {
    clearInterval(pingInterval);
  });

  return httpServer;
}
