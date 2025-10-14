/**
 * Enhanced WebSocket fallback mechanism for serverless environments
 * Provides robust polling-based real-time communication when WebSockets fail
 */

interface PollingOptions {
  interval: number;
  endpoint: string;
  onMessage: (data: any) => void;
  onError: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
  maxRetries?: number;
  backoffMultiplier?: number;
  maxBackoff?: number;
}

interface ConnectionMetrics {
  totalPolls: number;
  successfulPolls: number;
  failedPolls: number;
  averageResponseTime: number;
  lastSuccessfulPoll: Date | null;
  consecutiveFailures: number;
  isHealthy: boolean;
}

export class WebSocketFallback {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastMessageId: string | null = null;
  private options: PollingOptions;
  private metrics: ConnectionMetrics;
  private retryCount = 0;
  private currentInterval: number;
  private isConnected = false;
  private lastPollTime = 0;
  private responseTimeSum = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(options: PollingOptions) {
    this.options = {
      maxRetries: 5,
      backoffMultiplier: 2,
      maxBackoff: 30000,
      ...options
    };
    this.currentInterval = this.options.interval;
    
    this.metrics = {
      totalPolls: 0,
      successfulPolls: 0,
      failedPolls: 0,
      averageResponseTime: 0,
      lastSuccessfulPoll: null,
      consecutiveFailures: 0,
      isHealthy: true
    };
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  start(): void {
    if (this.isPolling) return;
    
    console.log('Starting enhanced polling fallback...');
    this.isPolling = true;
    this.retryCount = 0;
    this.currentInterval = this.options.interval;
    this.poll();
  }

  stop(): void {
    console.log('Stopping enhanced polling fallback...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.isPolling = false;
    this.isConnected = false;
    this.retryCount = 0;
    this.currentInterval = this.options.interval;
    
    if (this.options.onConnectionChange) {
      this.options.onConnectionChange(false);
    }
  }

  private async poll(): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalPolls++;
    
    try {
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lastMessageId: this.lastMessageId,
          timestamp: Date.now(),
          metrics: this.metrics
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const responseTime = Date.now() - startTime;
      this.responseTimeSum += responseTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update metrics for successful poll
      this.metrics.successfulPolls++;
      this.metrics.consecutiveFailures = 0;
      this.metrics.lastSuccessfulPoll = new Date();
      this.metrics.averageResponseTime = this.responseTimeSum / this.metrics.successfulPolls;
      this.metrics.isHealthy = this.metrics.consecutiveFailures < 3;
      
      // Update connection status
      if (!this.isConnected) {
        this.isConnected = true;
        if (this.options.onConnectionChange) {
          this.options.onConnectionChange(true);
        }
      }
      
      if (data.messages && Array.isArray(data.messages)) {
        for (const message of data.messages) {
          this.options.onMessage(message);
          this.lastMessageId = message.id || Date.now().toString();
        }
      }
      
      // Reset retry count and interval on success
      this.retryCount = 0;
      this.currentInterval = this.options.interval;

      // Schedule next poll
      if (this.isPolling) {
        this.intervalId = setTimeout(() => this.poll(), this.currentInterval);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update metrics for failed poll
      this.metrics.failedPolls++;
      this.metrics.consecutiveFailures++;
      this.metrics.isHealthy = this.metrics.consecutiveFailures < 3;
      
      console.error('Polling error:', error, 'Consecutive failures:', this.metrics.consecutiveFailures);
      
      // Update connection status if too many failures
      if (this.isConnected && this.metrics.consecutiveFailures >= 3) {
        this.isConnected = false;
        if (this.options.onConnectionChange) {
          this.options.onConnectionChange(false);
        }
      }
      
      this.options.onError(error as Error);
      
      // Enhanced retry with exponential backoff
      if (this.isPolling && this.retryCount < (this.options.maxRetries || 5)) {
        this.retryCount++;
        const backoffDelay = Math.min(
          this.currentInterval * Math.pow(this.options.backoffMultiplier || 2, this.retryCount),
          this.options.maxBackoff || 30000
        );
        
        console.log(`Retrying poll in ${backoffDelay}ms (attempt ${this.retryCount}/${this.options.maxRetries || 5})`);
        
        this.intervalId = setTimeout(() => this.poll(), backoffDelay);
      } else if (this.isPolling) {
        console.error('Max retry attempts reached, stopping polling');
        this.stop();
      }
    }
  }

  sendMessage(message: any): Promise<void> {
    return fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...message,
        timestamp: Date.now(),
        fallbackMode: true
      }),
      signal: AbortSignal.timeout(5000) // 5 second timeout for sends
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
    });
  }
  
  // Enhanced health monitoring
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 30000); // Check every 30 seconds
  }
  
  private checkHealth(): void {
    const now = Date.now();
    const timeSinceLastPoll = now - this.lastPollTime;
    
    // If no polling has happened in the expected interval + 50% buffer
    if (timeSinceLastPoll > this.currentInterval * 1.5) {
      console.warn('Polling appears to be stalled, restarting...');
      this.restart();
    }
    
    // Update health status based on consecutive failures
    const wasHealthy = this.metrics.isHealthy;
    this.metrics.isHealthy = this.metrics.consecutiveFailures < 3;
    
    if (wasHealthy !== this.metrics.isHealthy) {
      console.log('Health status changed:', this.metrics.isHealthy ? 'healthy' : 'unhealthy');
    }
  }
  
  private restart(): void {
    console.log('Restarting polling fallback...');
    this.stop();
    setTimeout(() => {
      this.start();
    }, 1000);
  }
  
  // Get connection metrics
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }
  
  // Check if connection is healthy
  isHealthy(): boolean {
    return this.metrics.isHealthy && this.isConnected;
  }
}

/**
 * Enhanced Hybrid WebSocket/Polling connection manager
 * Automatically falls back to polling if WebSocket fails with comprehensive monitoring
 */
export class HybridConnection {
  private ws: WebSocket | null = null;
  private fallback: WebSocketFallback | null = null;
  private useFallback = false;
  private messageHandlers = new Map<string, (data: any) => void>();
  private connectionState: 'connecting' | 'connected' | 'disconnected' | 'fallback' = 'disconnected';
  private connectionAttempts = 0;
  private lastConnectionAttempt = 0;
  private messageQueue: any[] = [];
  private connectionMetrics = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    fallbackActivations: 0,
    averageConnectionTime: 0
  };
  private connectionStartTime = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat = 0;
  private isHealthy = true;

  constructor(
    private wsUrl: string,
    private fallbackEndpoint: string = '/api/poll'
  ) {
    console.log('Initializing enhanced hybrid connection:', {
      wsUrl: this.wsUrl,
      fallbackEndpoint: this.fallbackEndpoint
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
        console.log('HybridConnection: Already connected or connecting');
        resolve();
        return;
      }

      this.connectionState = 'connecting';
      this.connectionAttempts++;
      this.lastConnectionAttempt = Date.now();
      this.connectionStartTime = Date.now();
      this.connectionMetrics.totalConnections++;
      
      console.log('HybridConnection: Starting connection to', this.wsUrl, `(attempt ${this.connectionAttempts})`);

      // Try WebSocket first
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
          const connectionTime = Date.now() - this.connectionStartTime;
          console.log('HybridConnection: WebSocket connected successfully in', connectionTime, 'ms');
          
          this.connectionState = 'connected';
          this.useFallback = false;
          this.connectionAttempts = 0;
          this.connectionMetrics.successfulConnections++;
          this.connectionMetrics.averageConnectionTime = 
            (this.connectionMetrics.averageConnectionTime * (this.connectionMetrics.successfulConnections - 1) + connectionTime) / 
            this.connectionMetrics.successfulConnections;
          
          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('HybridConnection: WebSocket closed', event.code, event.reason);
          
          this.stopHeartbeat();
          
          if (this.connectionState === 'connected') {
            this.connectionState = 'disconnected';
            this.connectionMetrics.failedConnections++;
            
            // Enhanced reconnection logic with backoff
            if (event.code !== 1000 && event.code !== 1001) { // Don't reconnect on normal closure
              const backoffDelay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
              console.log(`HybridConnection: Attempting to reconnect WebSocket in ${backoffDelay}ms...`);
              
              setTimeout(() => {
                if (this.connectionState === 'disconnected' && this.connectionAttempts < 5) {
                  this.connect();
                } else if (this.connectionAttempts >= 5) {
                  console.log('HybridConnection: Max reconnection attempts reached, falling back to polling');
                  this.fallbackToPolling();
                }
              }, backoffDelay);
            } else {
              this.fallbackToPolling();
            }
          }
        };

        this.ws.onerror = (error) => {
          console.log('HybridConnection: WebSocket error', error);
          this.connectionMetrics.failedConnections++;
          this.isHealthy = false;
          
          // Emit error event for handlers
          const errorHandler = this.messageHandlers.get('error');
          if (errorHandler) {
            errorHandler({ 
              type: 'websocket_error', 
              error: error,
              timestamp: Date.now() 
            });
          }
          
          this.fallbackToPolling();
          resolve(); // Don't reject, fallback is available
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('HybridConnection: Received message', message.type, message);
            
            this.connectionMetrics.messagesReceived++;
            this.lastHeartbeat = Date.now();
            
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message);
            } else {
              console.warn(`⚠️ No handler found for message type: ${message.type}`);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            
            // Emit parse error event
            const errorHandler = this.messageHandlers.get('error');
            if (errorHandler) {
              errorHandler({ 
                type: 'parse_error', 
                error: error,
                timestamp: Date.now() 
              });
            }
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            console.log('HybridConnection: WebSocket connection timeout, falling back to polling');
            this.fallbackToPolling();
            resolve();
          }
        }, 5000);

      } catch (error) {
        console.log('HybridConnection: WebSocket creation failed', error);
        this.fallbackToPolling();
        resolve();
      }
    });
  }

  private fallbackToPolling(): void {
    if (this.useFallback) return;
    
    console.log('HybridConnection: Falling back to polling...');
    this.useFallback = true;
    this.connectionState = 'fallback';
    this.connectionMetrics.fallbackActivations++;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.fallback = new WebSocketFallback({
      interval: 5000, // Poll every 5 seconds instead of 2
      endpoint: this.fallbackEndpoint,
      maxRetries: 5,
      backoffMultiplier: 2,
      maxBackoff: 30000,
      onMessage: (message) => {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message);
        }
        this.connectionMetrics.messagesReceived++;
      },
      onError: (error) => {
        console.error('Polling error:', error);
        
        // Emit polling error event
        const errorHandler = this.messageHandlers.get('error');
        if (errorHandler) {
          errorHandler({ 
            type: 'polling_error', 
            error: error,
            timestamp: Date.now() 
          });
        }
      },
      onConnectionChange: (connected) => {
        console.log('Polling connection status changed:', connected);
        if (connected) {
          this.processMessageQueue();
        }
      }
    });

    this.fallback.start();
  }

  send(message: any): void {
    console.log('HybridConnection: Sending message', message.type, 'via', this.useFallback ? 'polling' : 'websocket');
    
    if (this.useFallback && this.fallback) {
      this.fallback.sendMessage(message).catch(error => {
        console.error('Failed to send message via polling:', error);
        // Queue message for retry
        this.messageQueue.push(message);
      });
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.connectionMetrics.messagesSent++;
      } catch (error) {
        console.error('Failed to send message via WebSocket:', error);
        // Queue message for retry
        this.messageQueue.push(message);
      }
    } else {
      console.log('HybridConnection: Cannot send message - no active connection, queuing message');
      this.messageQueue.push(message);
    }
  }
  
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    console.log(`Processing ${this.messageQueue.length} queued messages...`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  on(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  off(type: string): void {
    this.messageHandlers.delete(type);
  }

  disconnect(): void {
    console.log('HybridConnection: Disconnecting...');
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.fallback) {
      this.fallback.stop();
      this.fallback = null;
    }
    
    this.connectionState = 'disconnected';
    this.useFallback = false;
    this.connectionAttempts = 0;
    this.messageQueue = [];
    this.isHealthy = false;
    
    console.log('HybridConnection: Disconnected');
  }

  getConnectionType(): 'websocket' | 'polling' {
    return this.useFallback ? 'polling' : 'websocket';
  }

  isConnected(): boolean {
    return this.connectionState === 'connected' || this.connectionState === 'fallback';
  }
  
  // Enhanced heartbeat mechanism
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastHeartbeat;
      
      // If no message received in 60 seconds, consider connection stale
      if (timeSinceLastMessage > 60000) {
        console.warn('HybridConnection: Connection appears stale, sending heartbeat');
        this.send({ type: 'heartbeat', timestamp: now });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  // Get comprehensive connection metrics
  getMetrics() {
    const fallbackMetrics = this.fallback ? this.fallback.getMetrics() : null;
    
    return {
      ...this.connectionMetrics,
      connectionState: this.connectionState,
      useFallback: this.useFallback,
      connectionAttempts: this.connectionAttempts,
      isHealthy: this.isHealthy,
      lastHeartbeat: this.lastHeartbeat,
      messageQueueLength: this.messageQueue.length,
      fallbackMetrics
    };
  }
  
  // Force reconnection
  forceReconnect(): Promise<void> {
    console.log('HybridConnection: Forcing reconnection...');
    this.disconnect();
    return this.connect();
  }
}
