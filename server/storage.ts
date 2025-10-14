import { type ChatSession, type InsertChatSession, type Message, type InsertMessage, type OnlineUser, type InsertOnlineUser, chatSessions, messages, onlineUsers } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, or, desc } from "drizzle-orm";

export interface IStorage {
  // Chat sessions
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  deleteChatSession(id: string): Promise<void>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesBySession(sessionId: string): Promise<Message[]>;

  // Online users
  addOnlineUser(user: InsertOnlineUser): Promise<OnlineUser>;
  removeOnlineUser(id: string): Promise<void>;
  getOnlineUser(id: string): Promise<OnlineUser | undefined>;
  getOnlineUserBySocket(socketId: string): Promise<OnlineUser | undefined>;
  updateOnlineUser(id: string, updates: Partial<OnlineUser>): Promise<OnlineUser | undefined>;
  getWaitingUsers(chatType: string, interests?: string[]): Promise<OnlineUser[]>;
  getAllOnlineUsers(): Promise<OnlineUser[]>;
}

export class MemStorage implements IStorage {
  private chatSessions: Map<string, ChatSession>;
  private messages: Map<string, Message>;
  private onlineUsers: Map<string, OnlineUser>;

  constructor() {
    this.chatSessions = new Map();
    this.messages = new Map();
    this.onlineUsers = new Map();
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = randomUUID();
    const session: ChatSession = {
      id,
      user1Id: insertSession.user1Id,
      user2Id: insertSession.user2Id || null,
      type: insertSession.type,
      interests: (insertSession.interests as string[]) || [],
      status: insertSession.status || 'waiting',
      createdAt: new Date(),
      endedAt: null,
    };
    this.chatSessions.set(id, session);
    return session;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const session = this.chatSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.chatSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteChatSession(id: string): Promise<void> {
    this.chatSessions.delete(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      id,
      content: insertMessage.content,
      sessionId: insertMessage.sessionId,
      senderId: insertMessage.senderId,
      attachments: insertMessage.attachments ?? null,
      hasEmoji: insertMessage.hasEmoji ?? null,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessagesBySession(sessionId: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      message => message.sessionId === sessionId
    ).sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
  }

  async addOnlineUser(insertUser: InsertOnlineUser): Promise<OnlineUser> {
    const user: OnlineUser = {
      id: insertUser.id,
      socketId: insertUser.socketId,
      interests: (insertUser.interests as string[]) || [],
      isWaiting: insertUser.isWaiting || false,
      chatType: insertUser.chatType || null,
      lastSeen: new Date(),
    };
    this.onlineUsers.set(user.id, user);
    return user;
  }

  async removeOnlineUser(id: string): Promise<void> {
    this.onlineUsers.delete(id);
  }

  async getOnlineUser(id: string): Promise<OnlineUser | undefined> {
    return this.onlineUsers.get(id);
  }

  async getOnlineUserBySocket(socketId: string): Promise<OnlineUser | undefined> {
    return Array.from(this.onlineUsers.values()).find(
      user => user.socketId === socketId
    );
  }

  async updateOnlineUser(id: string, updates: Partial<OnlineUser>): Promise<OnlineUser | undefined> {
    const user = this.onlineUsers.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, lastSeen: new Date() };
    this.onlineUsers.set(id, updatedUser);
    return updatedUser;
  }

  async getWaitingUsers(chatType: string, interests?: string[]): Promise<OnlineUser[]> {
    const waitingUsers = Array.from(this.onlineUsers.values()).filter(
      user => user.isWaiting && user.chatType === chatType
    );

    if (!interests || interests.length === 0) {
      return waitingUsers;
    }

    // Sort by number of matching interests (descending)
    return waitingUsers.sort((a, b) => {
      const aMatches = a.interests?.filter(interest => interests.includes(interest)).length || 0;
      const bMatches = b.interests?.filter(interest => interests.includes(interest)).length || 0;
      return bMatches - aMatches;
    });
  }

  async getAllOnlineUsers(): Promise<OnlineUser[]> {
    return Array.from(this.onlineUsers.values());
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/omegle_revive';
    const client = postgres(connectionString);
    this.db = drizzle(client);
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const sessionData = {
      ...insertSession,
      interests: insertSession.interests as string[] || []
    };
    const [session] = await this.db.insert(chatSessions).values(sessionData).returning();
    return session;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const [session] = await this.db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return session;
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const [session] = await this.db.update(chatSessions)
      .set(updates)
      .where(eq(chatSessions.id, id))
      .returning();
    return session;
  }

  async deleteChatSession(id: string): Promise<void> {
    await this.db.delete(chatSessions).where(eq(chatSessions.id, id));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await this.db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async getMessagesBySession(sessionId: string): Promise<Message[]> {
    return await this.db.select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.timestamp));
  }

  async addOnlineUser(insertUser: InsertOnlineUser): Promise<OnlineUser> {
    const userData = {
      ...insertUser,
      interests: insertUser.interests as string[] || []
    };
    const [user] = await this.db.insert(onlineUsers).values(userData).returning();
    return user;
  }

  async removeOnlineUser(id: string): Promise<void> {
    await this.db.delete(onlineUsers).where(eq(onlineUsers.id, id));
  }

  async getOnlineUser(id: string): Promise<OnlineUser | undefined> {
    const [user] = await this.db.select().from(onlineUsers).where(eq(onlineUsers.id, id));
    return user;
  }

  async getOnlineUserBySocket(socketId: string): Promise<OnlineUser | undefined> {
    const [user] = await this.db.select().from(onlineUsers).where(eq(onlineUsers.socketId, socketId));
    return user;
  }

  async updateOnlineUser(id: string, updates: Partial<OnlineUser>): Promise<OnlineUser | undefined> {
    const [user] = await this.db.update(onlineUsers)
      .set({ ...updates, lastSeen: new Date() })
      .where(eq(onlineUsers.id, id))
      .returning();
    return user;
  }

  async getWaitingUsers(chatType: string, interests?: string[]): Promise<OnlineUser[]> {
    let query = this.db.select().from(onlineUsers)
      .where(and(
        eq(onlineUsers.isWaiting, true),
        eq(onlineUsers.chatType, chatType)
      ));

    const waitingUsers = await query;

    if (!interests || interests.length === 0) {
      return waitingUsers;
    }

    // Sort by number of matching interests (descending)
    return waitingUsers.sort((a, b) => {
      const aMatches = a.interests?.filter(interest => interests.includes(interest)).length || 0;
      const bMatches = b.interests?.filter(interest => interests.includes(interest)).length || 0;
      return bMatches - aMatches;
    });
  }

  async getAllOnlineUsers(): Promise<OnlineUser[]> {
    return await this.db.select().from(onlineUsers);
  }
}

// Use database storage if DATABASE_URL is available, otherwise fall back to memory storage
export const storage = process.env.DATABASE_URL 
  ? new DatabaseStorage() 
  : new MemStorage();
