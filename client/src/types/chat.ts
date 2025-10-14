export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  isOwn?: boolean;
  attachments?: Attachment[];
  hasEmoji?: boolean;
}

export interface ChatSession {
  id: string;
  partnerId: string;
  type: 'text' | 'video';
  status: 'waiting' | 'connected' | 'ended';
}

export interface OnlineStats {
  activeUsers: number;
  chatsToday: number;
  countries: number;
  textUsers: number;
  videoUsers: number;
  avgWaitTime: number;
  serverUptime: number;
  lastUpdated: string;
}

export interface AnalyticsData {
  totalUsers: number;
  textUsers: number;
  videoUsers: number;
  waitingUsers: number;
  topInterests: Array<{ interest: string; count: number }>;
  peakHour: number;
  successRate: number;
}

export interface QueueStatus {
  position: number;
  totalWaiting: number;
  estimatedWaitTime: number;
  chatType: string;
}

export interface ChatFeedback {
  sessionId: string;
  rating: number;
  feedback: string;
  type: 'text' | 'video';
}

export interface UserReport {
  sessionId: string;
  reason: string;
  description: string;
}

export type ChatView = 'landing' | 'text-chat' | 'video-chat';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}
