export interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  isOwn?: boolean;
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
}

export type ChatView = 'landing' | 'text-chat' | 'video-chat';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}
