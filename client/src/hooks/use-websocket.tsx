import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage } from '@/types/chat';
import { getWebSocketUrl, validateWebSocketUrl } from '@/lib/websocket-utils';
import { HybridConnection } from '@/lib/websocket-fallback';

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [connectionType, setConnectionType] = useState<'websocket' | 'polling'>('websocket');
  
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
  const hybridConnection = useRef<HybridConnection | null>(null);

  const connect = useCallback(async () => {
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
    if (hybridConnection.current) {
      console.log('Closing existing hybrid connection');
      hybridConnection.current.disconnect();
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
      
      // Create hybrid connection
      hybridConnection.current = new HybridConnection(wsUrl, '/api/poll');
      
      // Set up message handlers
      hybridConnection.current.on('user_joined', (message) => {
        console.log('User joined message received:', message);
        setUserId(message.userId);
      });
      
      hybridConnection.current.on('heartbeat_ack', (message) => {
        console.log('Heartbeat ack received:', message);
        setLastHeartbeat(new Date());
        setConnectionQuality('good');
      });
      
      // Set up other message handlers
      messageHandlers.current.forEach((handler, type) => {
        hybridConnection.current?.on(type, handler);
      });
      
      // Connect with hybrid approach
      console.log('Attempting hybrid connection...');
      await hybridConnection.current.connect();
      
      console.log('Hybrid connection established, type:', hybridConnection.current.getConnectionType());
      setIsConnected(true);
      setConnectionType(hybridConnection.current.getConnectionType());
      setReconnectAttempts(0);
      isConnecting.current = false;
      connectionAttempted.current = false;
      
      // Send join message
      try {
        const joinMessage = {
          type: 'join',
          interests: JSON.parse(localStorage.getItem('interests') || '[]')
        };
        console.log('Sending join message:', joinMessage);
        hybridConnection.current.send(joinMessage);
      } catch (error) {
        console.error('Failed to send join message:', error);
      }
      
      return hybridConnection.current;
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
    
    if (hybridConnection.current) {
      hybridConnection.current.disconnect();
      hybridConnection.current = null;
    }
    
    setIsConnected(false);
    setUserId(null);
    setConnectionType('websocket');
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    console.log('sendMessage called:', message.type, 'isConnected:', isConnected, 'hasConnection:', !!hybridConnection.current);
    if (hybridConnection.current && isConnected) {
      try {
        hybridConnection.current.send(message);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    } else {
      console.warn('Cannot send message - not connected or no hybrid connection');
    }
  }, [isConnected]);

  const onMessage = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
    // Also register with the current hybrid connection if it exists
    if (hybridConnection.current) {
      hybridConnection.current.on(type, handler);
    }
  }, []);

  const offMessage = useCallback((type: string) => {
    messageHandlers.current.delete(type);
    // Also unregister from the current hybrid connection if it exists
    if (hybridConnection.current) {
      hybridConnection.current.off(type);
    }
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
    connectionType,
    sendMessage,
    onMessage,
    offMessage,
    connect,
    disconnect,
    getQueueStatus,
  };
}
