import { createClient, RedisClientType } from 'redis';
import { log } from './vite';

interface SessionData {
  id: string;
  partnerId?: string;
  type: 'text' | 'video';
  status: 'waiting' | 'connected' | 'ended';
  createdAt: string;
  lastActivity: string;
  interests?: string[];
  gender?: string;
}

interface UserData {
  id: string;
  connectionId: string;
  chatType: 'text' | 'video';
  interests: string[];
  gender: 'male' | 'female' | 'other';
  isWaiting: boolean;
  lastSeen: string;
  ip: string;
}

export class RedisStore {
  private client: RedisClientType;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.maxReconnectAttempts) {
            log('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on('error', (err) => {
      log('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      log('Redis connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('disconnect', () => {
      log('Redis disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      log('Redis store connected successfully');
    } catch (error) {
      log('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // Session management
  async createSession(sessionData: SessionData): Promise<void> {
    if (!this.isConnected) return;

    try {
      const key = `session:${sessionData.id}`;
      await this.client.hSet(key, {
        id: sessionData.id,
        partnerId: sessionData.partnerId || '',
        type: sessionData.type,
        status: sessionData.status,
        createdAt: sessionData.createdAt,
        lastActivity: sessionData.lastActivity,
        interests: JSON.stringify(sessionData.interests || []),
        gender: sessionData.gender || ''
      });

      // Set expiration (24 hours)
      await this.client.expire(key, 86400);
    } catch (error) {
      log('Error creating session:', error);
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.isConnected) return null;

    try {
      const key = `session:${sessionId}`;
      const data = await this.client.hGetAll(key);
      
      if (!data.id) return null;

      return {
        id: data.id,
        partnerId: data.partnerId || undefined,
        type: data.type as 'text' | 'video',
        status: data.status as 'waiting' | 'connected' | 'ended',
        createdAt: data.createdAt,
        lastActivity: data.lastActivity,
        interests: data.interests ? JSON.parse(data.interests) : undefined,
        gender: data.gender || undefined
      };
    } catch (error) {
      log('Error getting session:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    if (!this.isConnected) return;

    try {
      const key = `session:${sessionId}`;
      const updateData: Record<string, string> = {
        lastActivity: new Date().toISOString()
      };

      if (updates.partnerId !== undefined) updateData.partnerId = updates.partnerId;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.interests !== undefined) updateData.interests = JSON.stringify(updates.interests);
      if (updates.gender !== undefined) updateData.gender = updates.gender;

      await this.client.hSet(key, updateData);
    } catch (error) {
      log('Error updating session:', error);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
    } catch (error) {
      log('Error deleting session:', error);
    }
  }

  // User management
  async createUser(userData: UserData): Promise<void> {
    if (!this.isConnected) return;

    try {
      const key = `user:${userData.id}`;
      await this.client.hSet(key, {
        id: userData.id,
        connectionId: userData.connectionId,
        chatType: userData.chatType,
        interests: JSON.stringify(userData.interests),
        gender: userData.gender,
        isWaiting: userData.isWaiting.toString(),
        lastSeen: userData.lastSeen,
        ip: userData.ip
      });

      // Set expiration (1 hour)
      await this.client.expire(key, 3600);
    } catch (error) {
      log('Error creating user:', error);
    }
  }

  async getUser(userId: string): Promise<UserData | null> {
    if (!this.isConnected) return null;

    try {
      const key = `user:${userId}`;
      const data = await this.client.hGetAll(key);
      
      if (!data.id) return null;

      return {
        id: data.id,
        connectionId: data.connectionId,
        chatType: data.chatType as 'text' | 'video',
        interests: JSON.parse(data.interests),
        gender: data.gender as 'male' | 'female' | 'other',
        isWaiting: data.isWaiting === 'true',
        lastSeen: data.lastSeen,
        ip: data.ip
      };
    } catch (error) {
      log('Error getting user:', error);
      return null;
    }
  }

  async updateUser(userId: string, updates: Partial<UserData>): Promise<void> {
    if (!this.isConnected) return;

    try {
      const key = `user:${userId}`;
      const updateData: Record<string, string> = {
        lastSeen: new Date().toISOString()
      };

      if (updates.connectionId !== undefined) updateData.connectionId = updates.connectionId;
      if (updates.chatType !== undefined) updateData.chatType = updates.chatType;
      if (updates.interests !== undefined) updateData.interests = JSON.stringify(updates.interests);
      if (updates.gender !== undefined) updateData.gender = updates.gender;
      if (updates.isWaiting !== undefined) updateData.isWaiting = updates.isWaiting.toString();
      if (updates.ip !== undefined) updateData.ip = updates.ip;

      await this.client.hSet(key, updateData);
    } catch (error) {
      log('Error updating user:', error);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const key = `user:${userId}`;
      await this.client.del(key);
    } catch (error) {
      log('Error deleting user:', error);
    }
  }

  // Queue management
  async addToWaitingQueue(userId: string, chatType: string, interests: string[]): Promise<void> {
    if (!this.isConnected) return;

    try {
      const queueKey = `queue:${chatType}`;
      const userKey = `user:${userId}`;
      
      // Add to queue with score (timestamp for ordering)
      await this.client.zAdd(queueKey, {
        score: Date.now(),
        value: userId
      });

      // Store user interests for matching
      await this.client.hSet(userKey, {
        interests: JSON.stringify(interests),
        isWaiting: 'true'
      });
    } catch (error) {
      log('Error adding to waiting queue:', error);
    }
  }

  async removeFromWaitingQueue(userId: string, chatType: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const queueKey = `queue:${chatType}`;
      await this.client.zRem(queueKey, userId);
    } catch (error) {
      log('Error removing from waiting queue:', error);
    }
  }

  async getWaitingUsers(chatType: string, limit = 10): Promise<string[]> {
    if (!this.isConnected) return [];

    try {
      const queueKey = `queue:${chatType}`;
      const users = await this.client.zRange(queueKey, 0, limit - 1);
      return users;
    } catch (error) {
      log('Error getting waiting users:', error);
      return [];
    }
  }

  // Statistics
  async getStats(): Promise<Record<string, any>> {
    if (!this.isConnected) return {};

    try {
      const stats: Record<string, any> = {};
      
      // Count sessions by type
      const textSessions = await this.client.keys('session:*');
      const videoSessions = await this.client.keys('session:*');
      
      stats.totalSessions = textSessions.length;
      
      // Count waiting users by type
      const textQueue = await this.client.zCard('queue:text');
      const videoQueue = await this.client.zCard('queue:video');
      
      stats.waitingUsers = {
        text: textQueue,
        video: videoQueue,
        total: textQueue + videoQueue
      };

      return stats;
    } catch (error) {
      log('Error getting stats:', error);
      return {};
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      log('Redis health check failed:', error);
      return false;
    }
  }
}

// Global Redis store instance
export const redisStore = new RedisStore();
