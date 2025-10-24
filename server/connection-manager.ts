import { WebSocket } from 'ws';
import { log } from './vite';

interface ConnectionInfo {
  id: string;
  socket: WebSocket;
  userId?: string;
  sessionId?: string;
  chatType?: 'text' | 'video';
  interests?: string[];
  gender?: 'male' | 'female' | 'other';
  isWaiting: boolean;
  connectedAt: Date;
  lastActivity: Date;
  ip: string;
  userAgent?: string;
}

export class ConnectionManager {
  private connections = new Map<string, ConnectionInfo>();
  private userConnections = new Map<string, string>(); // userId -> connectionId
  private waitingQueue = new Map<string, Set<string>>(); // chatType -> Set<connectionId>
  private maxConnections = parseInt(process.env.MAX_CONNECTIONS || '1000');
  private connectionTimeout = parseInt(process.env.CONNECTION_TIMEOUT || '300000'); // 5 minutes

  constructor() {
    // Cleanup inactive connections every minute
    setInterval(() => this.cleanupInactiveConnections(), 60000);
  }

  addConnection(connectionId: string, socket: WebSocket, ip: string, userAgent?: string): ConnectionInfo {
    if (this.connections.size >= this.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      socket,
      isWaiting: false,
      connectedAt: new Date(),
      lastActivity: new Date(),
      ip,
      userAgent
    };

    this.connections.set(connectionId, connectionInfo);
    log(`Connection added: ${connectionId} (Total: ${this.connections.size})`);
    
    return connectionInfo;
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user mapping
    if (connection.userId) {
      this.userConnections.delete(connection.userId);
    }

    // Remove from waiting queue
    if (connection.isWaiting && connection.chatType) {
      const queue = this.waitingQueue.get(connection.chatType);
      if (queue) {
        queue.delete(connectionId);
        if (queue.size === 0) {
          this.waitingQueue.delete(connection.chatType);
        }
      }
    }

    this.connections.delete(connectionId);
    log(`Connection removed: ${connectionId} (Total: ${this.connections.size})`);
  }

  updateConnection(connectionId: string, updates: Partial<ConnectionInfo>): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Handle user ID changes
    if (updates.userId && updates.userId !== connection.userId) {
      if (connection.userId) {
        this.userConnections.delete(connection.userId);
      }
      this.userConnections.set(updates.userId, connectionId);
    }

    // Handle waiting status changes
    if (updates.isWaiting !== undefined && updates.isWaiting !== connection.isWaiting) {
      if (updates.isWaiting && updates.chatType) {
        this.addToWaitingQueue(connectionId, updates.chatType);
      } else if (!updates.isWaiting && connection.chatType) {
        this.removeFromWaitingQueue(connectionId, connection.chatType);
      }
    }

    // Update connection info
    Object.assign(connection, updates);
    connection.lastActivity = new Date();
  }

  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionByUserId(userId: string): ConnectionInfo | undefined {
    const connectionId = this.userConnections.get(userId);
    return connectionId ? this.connections.get(connectionId) : undefined;
  }

  getWaitingUsers(chatType: string, interests?: string[]): ConnectionInfo[] {
    const queue = this.waitingQueue.get(chatType);
    if (!queue) return [];

    const waitingUsers: ConnectionInfo[] = [];
    for (const connectionId of queue) {
      const connection = this.connections.get(connectionId);
      if (connection && this.isConnectionActive(connection)) {
        // Filter by interests if provided
        if (interests && interests.length > 0) {
          const hasMatchingInterest = connection.interests?.some(interest => 
            interests.includes(interest)
          );
          if (hasMatchingInterest) {
            waitingUsers.push(connection);
          }
        } else {
          waitingUsers.push(connection);
        }
      }
    }

    return waitingUsers;
  }

  private addToWaitingQueue(connectionId: string, chatType: string): void {
    let queue = this.waitingQueue.get(chatType);
    if (!queue) {
      queue = new Set();
      this.waitingQueue.set(chatType, queue);
    }
    queue.add(connectionId);
  }

  private removeFromWaitingQueue(connectionId: string, chatType: string): void {
    const queue = this.waitingQueue.get(chatType);
    if (queue) {
      queue.delete(connectionId);
      if (queue.size === 0) {
        this.waitingQueue.delete(chatType);
      }
    }
  }

  private isConnectionActive(connection: ConnectionInfo): boolean {
    return connection.socket.readyState === WebSocket.OPEN;
  }

  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const timeSinceActivity = now - connection.lastActivity.getTime();
      
      if (!this.isConnectionActive(connection) || timeSinceActivity > this.connectionTimeout) {
        toRemove.push(connectionId);
      }
    }

    for (const connectionId of toRemove) {
      this.removeConnection(connectionId);
    }

    if (toRemove.length > 0) {
      log(`Cleaned up ${toRemove.length} inactive connections`);
    }
  }

  getStats() {
    const waitingByType: Record<string, number> = {};
    for (const [chatType, queue] of this.waitingQueue) {
      waitingByType[chatType] = queue.size;
    }

    return {
      totalConnections: this.connections.size,
      waitingByType,
      maxConnections: this.maxConnections,
      activeConnections: Array.from(this.connections.values()).filter(c => this.isConnectionActive(c)).length
    };
  }

  broadcast(message: any, filter?: (connection: ConnectionInfo) => boolean): void {
    for (const connection of this.connections.values()) {
      if (this.isConnectionActive(connection)) {
        if (!filter || filter(connection)) {
          try {
            connection.socket.send(JSON.stringify(message));
          } catch (error) {
            log(`Error broadcasting to connection ${connection.id}:`, error);
          }
        }
      }
    }
  }

  sendToUser(userId: string, message: any): boolean {
    const connection = this.getConnectionByUserId(userId);
    if (connection && this.isConnectionActive(connection)) {
      try {
        connection.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        log(`Error sending message to user ${userId}:`, error);
        return false;
      }
    }
    return false;
  }
}

// Global connection manager instance
export const connectionManager = new ConnectionManager();
