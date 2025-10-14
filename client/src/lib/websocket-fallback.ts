/**
 * WebSocket fallback mechanism for serverless environments
 * Provides polling-based real-time communication when WebSockets fail
 */

interface PollingOptions {
  interval: number;
  endpoint: string;
  onMessage: (data: any) => void;
  onError: (error: Error) => void;
}

export class WebSocketFallback {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastMessageId: string | null = null;
  private options: PollingOptions;

  constructor(options: PollingOptions) {
    this.options = options;
  }

  start(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.poll();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lastMessageId: this.lastMessageId,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.messages && Array.isArray(data.messages)) {
        for (const message of data.messages) {
          this.options.onMessage(message);
          this.lastMessageId = message.id || Date.now().toString();
        }
      }

      // Schedule next poll
      if (this.isPolling) {
        this.intervalId = setTimeout(() => this.poll(), this.options.interval);
      }
    } catch (error) {
      this.options.onError(error as Error);
      
      // Retry with exponential backoff
      const retryDelay = Math.min(this.options.interval * 2, 30000);
      if (this.isPolling) {
        this.intervalId = setTimeout(() => this.poll(), retryDelay);
      }
    }
  }

  sendMessage(message: any): Promise<void> {
    return fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
    });
  }
}

/**
 * Hybrid WebSocket/Polling connection manager
 * Automatically falls back to polling if WebSocket fails
 */
export class HybridConnection {
  private ws: WebSocket | null = null;
  private fallback: WebSocketFallback | null = null;
  private useFallback = false;
  private messageHandlers = new Map<string, (data: any) => void>();
  private connectionState: 'connecting' | 'connected' | 'disconnected' | 'fallback' = 'disconnected';

  constructor(
    private wsUrl: string,
    private fallbackEndpoint: string = '/api/poll'
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
        resolve();
        return;
      }

      this.connectionState = 'connecting';

      // Try WebSocket first
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
          this.connectionState = 'connected';
          this.useFallback = false;
          resolve();
        };

        this.ws.onclose = () => {
          if (this.connectionState === 'connected') {
            this.connectionState = 'disconnected';
            this.fallbackToPolling();
          }
        };

        this.ws.onerror = () => {
          this.fallbackToPolling();
          resolve(); // Don't reject, fallback is available
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            this.fallbackToPolling();
            resolve();
          }
        }, 5000);

      } catch (error) {
        this.fallbackToPolling();
        resolve();
      }
    });
  }

  private fallbackToPolling(): void {
    if (this.useFallback) return;
    
    this.useFallback = true;
    this.connectionState = 'fallback';
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.fallback = new WebSocketFallback({
      interval: 2000, // Poll every 2 seconds
      endpoint: this.fallbackEndpoint,
      onMessage: (message) => {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message);
        }
      },
      onError: (error) => {
        console.error('Polling error:', error);
      }
    });

    this.fallback.start();
  }

  send(message: any): void {
    if (this.useFallback && this.fallback) {
      this.fallback.sendMessage(message);
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  off(type: string): void {
    this.messageHandlers.delete(type);
  }

  disconnect(): void {
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
  }

  getConnectionType(): 'websocket' | 'polling' {
    return this.useFallback ? 'polling' : 'websocket';
  }

  isConnected(): boolean {
    return this.connectionState === 'connected' || this.connectionState === 'fallback';
  }
}
