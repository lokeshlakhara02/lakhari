import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage } from '@/types/chat';
import { getWebSocketUrl, validateWebSocketUrl } from '@/lib/websocket-utils';

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  
  // Use refs to avoid dependency issues
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeout = useRef<NodeJS.Timeout>();
  const connectionAttempted = useRef(false);
  const isConnecting = useRef(false);
  const shouldReconnect = useRef(true);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting.current || isConnected) {
      console.log('WebSocket already connecting or connected, skipping');
      return null;
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return null;
    }

    // Clear any existing connections first
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      console.log('Closing existing WebSocket connection');
      socket.close();
    }

    isConnecting.current = true;
    connectionAttempted.current = true;

    const wsUrl = getWebSocketUrl('/ws');
    
    // Validate WebSocket URL before creating connection
    if (!validateWebSocketUrl(wsUrl)) {
      console.error('Invalid WebSocket URL:', wsUrl);
      isConnecting.current = false;
      return null;
    }
    
    try {
      // Final validation before creating WebSocket
      if (wsUrl.includes('undefined') || wsUrl.includes('null')) {
        console.error('WebSocket URL contains invalid values:', wsUrl);
        isConnecting.current = false;
        return null;
      }
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        setSocket(ws);
        setReconnectAttempts(0);
        isConnecting.current = false;
        connectionAttempted.current = false;
      
        // Clear any existing ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Set up ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds

        // Set up heartbeat interval for adaptive connection quality monitoring
        let poorResponseCount = 0;
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const heartbeatStart = Date.now();
            ws.send(JSON.stringify({ type: 'heartbeat', timestamp: heartbeatStart }));
            
            // Set adaptive timeout for heartbeat response
            heartbeatTimeout.current = setTimeout(() => {
              poorResponseCount++;
              // Only mark as poor if we have multiple slow responses
              if (poorResponseCount >= 2) {
                setConnectionQuality('poor');
              }
            }, 5000); // Consider poor if no response in 5 seconds
          }
        }, 10000); // Heartbeat every 10 seconds
        
        // Send join message
        try {
          ws.send(JSON.stringify({
            type: 'join',
            interests: JSON.parse(localStorage.getItem('interests') || '[]')
          }));
        } catch (error) {
          console.error('Failed to send join message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setSocket(null);
        setUserId(null);
        isConnecting.current = false;
        connectionAttempted.current = false;
        
        // Clear intervals
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        if (heartbeatTimeout.current) {
          clearTimeout(heartbeatTimeout.current);
        }
        
        // Only attempt to reconnect if it wasn't a clean close and we should reconnect
        if (!event.wasClean && shouldReconnect.current && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle user joined
          if (message.type === 'user_joined') {
            setUserId(message.userId);
          }
          
          // Handle pong
          if (message.type === 'pong') {
            return; // Just ignore pong messages
          }

          // Handle heartbeat acknowledgment with latency calculation
          if (message.type === 'heartbeat_ack') {
            if (heartbeatTimeout.current) {
              clearTimeout(heartbeatTimeout.current);
            }
            
            // Calculate round-trip time for adaptive quality monitoring
            const now = Date.now();
            const rtt = message.timestamp ? now - message.timestamp : 0;
            
            setLastHeartbeat(new Date());
            
            // Adaptive quality based on latency
            if (rtt < 100) {
              setConnectionQuality('good');
            } else if (rtt < 300) {
              setConnectionQuality('good'); // Still acceptable
            } else {
              setConnectionQuality('poor');
            }
            
            return;
          }
          
          // Call registered handlers
          const handler = messageHandlers.current.get(message.type);
          if (handler) {
            handler(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = () => {
        isConnecting.current = false;
      };

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      isConnecting.current = false;
      return null;
    }
  }, [reconnectAttempts, isConnected, socket]); // Include all necessary dependencies

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    
    // Clear timeouts and intervals
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (heartbeatTimeout.current) {
      clearTimeout(heartbeatTimeout.current);
    }
    
    if (socket) {
      socket.close(1000, 'User disconnected'); // Clean close
    }
  }, [socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket && isConnected && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    }
  }, [socket, isConnected]);

  const onMessage = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
  }, []);

  const offMessage = useCallback((type: string) => {
    messageHandlers.current.delete(type);
  }, []);

  useEffect(() => {
    // Only connect if not already connected and not already connecting
    if (!isConnected && !connectionAttempted.current && !isConnecting.current) {
      connect();
    }
    
    return () => {
      // Clean up everything on unmount
      shouldReconnect.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (heartbeatTimeout.current) {
        clearTimeout(heartbeatTimeout.current);
      }
      if (socket) {
        socket.close(1000, 'Component unmounted');
      }
      connectionAttempted.current = false;
      isConnecting.current = false;
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Prevent reconnection when component re-renders
  useEffect(() => {
    // This effect only runs when isConnected changes
  }, [isConnected]);

  const getQueueStatus = useCallback((chatType: string, interests: string[] = []) => {
    sendMessage({
      type: 'get_queue_status',
      chatType,
      interests
    });
  }, [sendMessage]);

  return {
    socket,
    isConnected,
    userId,
    reconnectAttempts,
    connectionQuality,
    lastHeartbeat,
    sendMessage,
    onMessage,
    offMessage,
    connect,
    disconnect,
    getQueueStatus,
  };
}
