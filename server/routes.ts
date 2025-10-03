import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { randomUUID } from "crypto";

interface WebSocketWithUserId extends WebSocket {
  userId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.get("/api/stats", async (_req, res) => {
    try {
      const onlineUsers = await storage.getAllOnlineUsers();
      const activeUsers = onlineUsers.length;
      
      // Mock stats for now
      res.json({
        activeUsers,
        chatsToday: Math.floor(Math.random() * 100000) + 50000,
        countries: 147
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket Server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocketWithUserId) => {
    console.log('New WebSocket connection');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
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
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', async () => {
      if (ws.userId) {
        await storage.removeOnlineUser(ws.userId);
        console.log(`User ${ws.userId} disconnected`);
      }
    });
  });

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

    const { chatType, interests } = message;
    
    // Update user status
    await storage.updateOnlineUser(ws.userId, {
      isWaiting: true,
      chatType,
      interests,
    });

    // Find a match
    const waitingUsers = await storage.getWaitingUsers(chatType, interests);
    const potentialMatch = waitingUsers.find(user => user.id !== ws.userId);

    if (potentialMatch) {
      // Create chat session
      const session = await storage.createChatSession({
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
        sessionId: session.id,
        partnerId: potentialMatch.id,
      }));

      // Find partner socket and notify
      const partnerSocket = findSocketByUserId(potentialMatch.id);
      if (partnerSocket) {
        partnerSocket.send(JSON.stringify({
          type: 'match_found',
          sessionId: session.id,
          partnerId: ws.userId,
        }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'waiting_for_match' }));
    }
  }

  async function handleSendMessage(ws: WebSocketWithUserId, message: any) {
    if (!ws.userId) return;

    const { sessionId, content } = message;
    
    // Save message
    const savedMessage = await storage.createMessage({
      sessionId,
      senderId: ws.userId,
      content,
    });

    // Get session to find partner
    const session = await storage.getChatSession(sessionId);
    if (!session) return;

    const partnerId = session.user1Id === ws.userId ? session.user2Id : session.user1Id;
    if (!partnerId) return;
    const partnerSocket = findSocketByUserId(partnerId);

    // Send message to partner
    if (partnerSocket) {
      partnerSocket.send(JSON.stringify({
        type: 'message_received',
        message: savedMessage,
      }));
    }

    // Confirm to sender
    ws.send(JSON.stringify({
      type: 'message_sent',
      message: savedMessage,
    }));
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

  function findSocketByUserId(userId: string): WebSocketWithUserId | null {
    for (const client of Array.from(wss.clients)) {
      const wsClient = client as WebSocketWithUserId;
      if (wsClient.userId === userId && wsClient.readyState === WebSocket.OPEN) {
        return wsClient;
      }
    }
    return null;
  }

  return httpServer;
}
