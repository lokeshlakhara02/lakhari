/**
 * Connection pooling system to optimize resource usage and reduce Railway costs
 * Manages WebRTC connections efficiently to prevent resource leaks
 */

interface ConnectionPoolItem {
  id: string;
  connection: RTCPeerConnection;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
}

class ConnectionPool {
  private connections: Map<string, ConnectionPoolItem> = new Map();
  private maxConnections = 5; // Limit concurrent connections
  private maxIdleTime = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  // Create or reuse a connection
  createConnection(id: string, iceServers: RTCIceServer[]): RTCPeerConnection {
    // Check if connection already exists and is active
    const existing = this.connections.get(id);
    if (existing && existing.isActive) {
      existing.lastUsed = new Date();
      return existing.connection;
    }

    // Check if we've hit the limit
    if (this.connections.size >= this.maxConnections) {
      this.cleanupOldConnections();
    }

    // Create new connection
    const connection = new RTCPeerConnection({ iceServers });
    const poolItem: ConnectionPoolItem = {
      id,
      connection,
      createdAt: new Date(),
      lastUsed: new Date(),
      isActive: true
    };

    this.connections.set(id, poolItem);
    return connection;
  }

  // Get an existing connection
  getConnection(id: string): RTCPeerConnection | null {
    const item = this.connections.get(id);
    if (item && item.isActive) {
      item.lastUsed = new Date();
      return item.connection;
    }
    return null;
  }

  // Mark connection as inactive
  deactivateConnection(id: string) {
    const item = this.connections.get(id);
    if (item) {
      item.isActive = false;
      item.lastUsed = new Date();
    }
  }

  // Close and remove a connection
  closeConnection(id: string) {
    const item = this.connections.get(id);
    if (item) {
      try {
        item.connection.close();
      } catch (error) {
        // Ignore errors when closing
      }
      this.connections.delete(id);
    }
  }

  // Clean up old connections
  private cleanupOldConnections() {
    const now = new Date();
    const toRemove: string[] = [];

    this.connections.forEach((item, id) => {
      const timeSinceLastUsed = now.getTime() - item.lastUsed.getTime();
      
      if (!item.isActive && timeSinceLastUsed > this.maxIdleTime) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.closeConnection(id));
  }

  // Start periodic cleanup
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldConnections();
    }, 60000); // Clean up every minute
  }

  // Stop cleanup
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Get pool statistics
  getStats() {
    const active = Array.from(this.connections.values()).filter(item => item.isActive).length;
    const inactive = Array.from(this.connections.values()).filter(item => !item.isActive).length;
    
    return {
      total: this.connections.size,
      active,
      inactive,
      maxConnections: this.maxConnections
    };
  }

  // Close all connections
  closeAll() {
    this.connections.forEach((item, id) => {
      this.closeConnection(id);
    });
    this.stopCleanup();
  }
}

export const connectionPool = new ConnectionPool();
export default connectionPool;
