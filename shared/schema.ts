import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").notNull(),
  user2Id: varchar("user2_id"),
  type: text("type").notNull(), // 'text' | 'video'
  interests: json("interests").$type<string[]>().default([]),
  status: text("status").notNull().default('waiting'), // 'waiting' | 'connected' | 'ended'
  createdAt: timestamp("created_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content").notNull(),
  attachments: json("attachments").$type<any[]>().default([]),
  hasEmoji: boolean("has_emoji").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const onlineUsers = pgTable("online_users", {
  id: varchar("id").primaryKey(),
  socketId: varchar("socket_id").notNull(),
  interests: json("interests").$type<string[]>().default([]),
  isWaiting: boolean("is_waiting").default(false),
  chatType: text("chat_type"), // 'text' | 'video'
  gender: text("gender"), // 'male' | 'female' | 'other'
  lastSeen: timestamp("last_seen").defaultNow(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  user1Id: true,
  user2Id: true,
  type: true,
  interests: true,
  status: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  sessionId: true,
  senderId: true,
  content: true,
  attachments: true,
  hasEmoji: true,
});

export const insertOnlineUserSchema = createInsertSchema(onlineUsers).pick({
  id: true,
  socketId: true,
  interests: true,
  isWaiting: true,
  chatType: true,
  gender: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertOnlineUser = z.infer<typeof insertOnlineUserSchema>;

export type ChatSession = typeof chatSessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type OnlineUser = typeof onlineUsers.$inferSelect;
