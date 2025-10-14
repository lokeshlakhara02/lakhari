import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage } from '@/types/chat';
import { getWebSocketUrl, validateWebSocketUrl } from '@/lib/websocket-utils';
import { HybridConnection } from '@/lib/websocket-fallback';

// Enhanced error types for WebSocket
interface WebSocketError extends Error {
  code?: string | number;
  type?: string;
  recoverable?: boolean;
  retryAfter?: number;
}

interface ConnectionConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  connectionTimeout: number;
}

interface ConnectionMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  lastConnectionTime: Date | null;
  averageConnectionTime: number;
  messagesSent: number;
  messagesReceived: number;
}

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [connectionType, setConnectionType] = useState<'websocket' | 'polling'>('websocket');
  const [connectionError, setConnectionError] = useState<WebSocketError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics>({
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    lastConnectionTime: null,
    averageConnectionTime: 0,
    messagesSent: 0,
    messagesReceived: 0
  });
  
  // Enhanced configuration
  const connectionConfig = useRef<ConnectionConfig>({
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    heartbeatInterval: 30000,
    heartbeatTimeout: 10000,
    connectionTimeout: 10000
  });

  // Use refs to avoid dependency issues
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeout = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionAttempted = useRef(false);
  const isConnectingRef = useRef(false);
  const shouldReconnect = useRef(true);
  const connectionStartTime = useRef<number>(0);
  const hybridConnection = useRef<HybridConnection | null>(null);
  const lastMessageTime = useRef<number>(Date.now());
  const messageQueue = useRef<WebSocketMessage[]>([]);
  
  // Enhanced error handling utility
  const createWebSocketError = useCallback((message: string, code?: string | number, type?: string, recoverable = true): WebSocketError => {
    const error = new Error(message) as WebSocketError;
    error.code = code;
    error.type = type;
    error.recoverable = recoverable;
    return error;
  }, []);

  // Enhanced connection with metrics tracking
  const updateConnectionMetrics = useCallback((success: boolean) => {
    const connectionTime = Date.now() - connectionStartTime.current;
    
    setConnectionMetrics(prev => ({
      ...prev,
      totalConnections: prev.totalConnections + 1,
      successfulConnections: success ? prev.successfulConnections + 1 : prev.successfulConnections,
      failedConnections: success ? prev.failedConnections : prev.failedConnections + 1,
      lastConnectionTime: new Date(),
      averageConnectionTime: prev.totalConnections > 0 
        ? (prev.averageConnectionTime * prev.totalConnections + connectionTime) / (prev.totalConnections + 1)
        : connectionTime
    }));
  }, []);

  const connect = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || isConnected) {
      console.log('WebSocket already connecting or connected, skipping');
      return null;
    }

    if (reconnectAttempts >= connectionConfig.current.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      const error = createWebSocketError(
        'Maximum reconnection attempts exceeded',
        'MAX_RECONNECT_ATTEMPTS',
        'CONNECTION_FAILED',
        false
      );
      setConnectionError(error);
      return null;
    }

    connectionStartTime.current = Date.now();
    isConnectingRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);
    
    console.log('Starting WebSocket connection attempt...');

    // Clear any existing connections first
    if (hybridConnection.current) {
      console.log('Closing existing hybrid connection');
      hybridConnection.current.disconnect();
    }

    connectionAttempted.current = true;
    
    // Clear connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    const wsUrl = getWebSocketUrl('/ws');
    
    // Enhanced URL validation
    if (!validateWebSocketUrl(wsUrl)) {
      console.error('Invalid WebSocket URL:', wsUrl);
      const error = createWebSocketError(
        'Invalid WebSocket URL',
        'INVALID_URL',
        'VALIDATION_ERROR',
        false
      );
      setConnectionError(error);
      isConnectingRef.current = false;
      setIsConnecting(false);
      updateConnectionMetrics(false);
      return null;
    }
    
    try {
    // Final validation before creating WebSocket
    if (wsUrl.includes('undefined') || wsUrl.includes('null')) {
      console.error('WebSocket URL contains invalid values:', wsUrl);
      const error = createWebSocketError(
        'WebSocket URL contains invalid values',
        'INVALID_URL_VALUES',
        'VALIDATION_ERROR',
        false
      );
      setConnectionError(error);
      isConnectingRef.current = false;
      setIsConnecting(false);
      updateConnectionMetrics(false);
      return null;
    }
      
      // Create hybrid connection
      hybridConnection.current = new HybridConnection(wsUrl, '/api/poll');
      
      // Enhanced message handlers with metrics
      hybridConnection.current.on('user_joined', (message) => {
        console.log('User joined message received:', message);
        setUserId(message.userId);
        setConnectionMetrics(prev => ({ ...prev, messagesReceived: prev.messagesReceived + 1 }));
      });
      
      hybridConnection.current.on('heartbeat_ack', (message) => {
        console.log('Heartbeat ack received:', message);
        setLastHeartbeat(new Date());
        setConnectionQuality('good');
        setConnectionMetrics(prev => ({ ...prev, messagesReceived: prev.messagesReceived + 1 }));
      });
      
      // Enhanced error handling
      hybridConnection.current.on('error', (error) => {
        console.error('Hybrid connection error:', error);
        const wsError = createWebSocketError(
          `Connection error: ${error.message || 'Unknown error'}`,
          error.code || 'CONNECTION_ERROR',
          'HYBRID_CONNECTION_ERROR'
        );
        setConnectionError(wsError);
        setConnectionQuality('poor');
      });
      
      // Set up other message handlers with metrics
      messageHandlers.current.forEach((handler, type) => {
        hybridConnection.current?.on(type, (message) => {
          try {
            handler(message);
            setConnectionMetrics(prev => ({ ...prev, messagesReceived: prev.messagesReceived + 1 }));
          } catch (error) {
            console.error(`Error in message handler for ${type}:`, error);
          }
        });
      });
      
      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (isConnectingRef.current) {
          console.error('Connection timeout');
          const timeoutError = createWebSocketError(
            'Connection timeout',
            'CONNECTION_TIMEOUT',
            'TIMEOUT_ERROR'
          );
          setConnectionError(timeoutError);
          isConnectingRef.current = false;
          setIsConnecting(false);
          updateConnectionMetrics(false);
        }
      }, connectionConfig.current.connectionTimeout);
      
      // Connect with hybrid approach
      console.log('Attempting hybrid connection...');
      await hybridConnection.current.connect();
      
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      console.log('Hybrid connection established, type:', hybridConnection.current.getConnectionType());
      setIsConnected(true);
      setConnectionType(hybridConnection.current.getConnectionType());
      setReconnectAttempts(0);
      isConnectingRef.current = false;
      setIsConnecting(false);
      connectionAttempted.current = false;
      setConnectionError(null);
      setConnectionQuality('good');
      updateConnectionMetrics(true);
      
      // Send queued messages
      while (messageQueue.current.length > 0) {
        const message = messageQueue.current.shift();
        if (message && hybridConnection.current) {
          hybridConnection.current.send(message);
          setConnectionMetrics(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
        }
      }
      
      // Send join message with enhanced error handling
      try {
        const interests = JSON.parse(localStorage.getItem('interests') || '[]');
        const joinMessage = {
          type: 'join',
          interests: Array.isArray(interests) ? interests : [],
          timestamp: Date.now()
        };
        console.log('Sending join message:', joinMessage);
        hybridConnection.current.send(joinMessage);
        setConnectionMetrics(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
      } catch (error) {
        console.error('Failed to send join message:', error);
        const joinError = createWebSocketError(
          'Failed to send join message',
          'JOIN_MESSAGE_FAILED',
          'MESSAGE_ERROR'
        );
        setConnectionError(joinError);
      }
      
      return hybridConnection.current;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      const connectionError = createWebSocketError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONNECTION_FAILED',
        'CONNECTION_ERROR'
      );
      setConnectionError(connectionError);
      isConnectingRef.current = false;
      setIsConnecting(false);
      updateConnectionMetrics(false);
      
      // Attempt reconnection if recoverable
      if (shouldReconnect.current && reconnectAttempts < connectionConfig.current.maxReconnectAttempts) {
        const delay = Math.min(
          connectionConfig.current.reconnectDelay * Math.pow(2, reconnectAttempts),
          connectionConfig.current.maxReconnectDelay
        );
        
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      }
      
      return null;
    }
  }, [reconnectAttempts, isConnected, createWebSocketError, updateConnectionMetrics]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting WebSocket...');
    shouldReconnect.current = false;
    
    // Clear timeouts and intervals
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (heartbeatTimeout.current) {
      clearTimeout(heartbeatTimeout.current);
      heartbeatTimeout.current = undefined;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }
    
    if (hybridConnection.current) {
      hybridConnection.current.disconnect();
      hybridConnection.current = null;
    }
    
    setIsConnected(false);
    setUserId(null);
    setConnectionType('websocket');
    setConnectionError(null);
    setIsConnecting(false);
    setConnectionQuality('unknown');
    
    // Clear message queue
    messageQueue.current = [];
    
    console.log('WebSocket disconnected');
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    console.log('sendMessage called:', message.type, 'isConnected:', isConnected, 'hasConnection:', !!hybridConnection.current);
    
    if (!message || typeof message !== 'object') {
      console.error('Invalid message format:', message);
      return;
    }
    
    // Add timestamp to message
    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now()
    };
    
    if (hybridConnection.current && isConnected) {
      try {
        hybridConnection.current.send(messageWithTimestamp);
        setConnectionMetrics(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
        lastMessageTime.current = Date.now();
      } catch (error) {
        console.error('Failed to send message:', error);
        const sendError = createWebSocketError(
          `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'MESSAGE_SEND_FAILED',
          'SEND_ERROR'
        );
        setConnectionError(sendError);
        
        // Queue message for retry
        messageQueue.current.push(messageWithTimestamp);
      }
    } else {
      console.warn('Cannot send message - not connected or no hybrid connection');
      
      // Queue message for when connection is restored
      if (shouldReconnect.current) {
        messageQueue.current.push(messageWithTimestamp);
        console.log('Message queued for later delivery');
      }
    }
  }, [isConnected, createWebSocketError]);

  const onMessage = useCallback((type: string, handler: (data: any) => void) => {
    if (!type || typeof handler !== 'function') {
      console.error('Invalid message handler:', { type, handler });
      return;
    }
    
    // Enhanced handler with error protection
    const protectedHandler = (data: any) => {
      try {
        handler(data);
        setConnectionMetrics(prev => ({ ...prev, messagesReceived: prev.messagesReceived + 1 }));
        lastMessageTime.current = Date.now();
      } catch (error) {
        console.error(`❌ Error in message handler for ${type}:`, error);
        const handlerError = createWebSocketError(
          `Message handler error for ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'HANDLER_ERROR',
          'MESSAGE_HANDLER_ERROR'
        );
        setConnectionError(handlerError);
      }
    };
    
    messageHandlers.current.set(type, protectedHandler);
    
    // Also register with the current hybrid connection if it exists
    if (hybridConnection.current) {
      hybridConnection.current.on(type, protectedHandler);
    }
  }, [createWebSocketError]);

  const offMessage = useCallback((type: string) => {
    if (!type) {
      console.error('Invalid message type for unregistration:', type);
      return;
    }
    
    messageHandlers.current.delete(type);
    
    // Also unregister from the current hybrid connection if it exists
    if (hybridConnection.current) {
      hybridConnection.current.off(type);
    }
    
    // Message handler unregistered silently
  }, []);

  // Enhanced connection monitoring
  useEffect(() => {
    if (isConnected) {
      // Start heartbeat monitoring
      heartbeatIntervalRef.current = setInterval(() => {
        if (hybridConnection.current && lastMessageTime.current) {
          const timeSinceLastMessage = Date.now() - lastMessageTime.current;
          if (timeSinceLastMessage > connectionConfig.current.heartbeatInterval * 2) {
            console.warn('No messages received recently, connection may be stale');
            setConnectionQuality('poor');
          }
        }
      }, connectionConfig.current.heartbeatInterval);
    }
    
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isConnected]);

  useEffect(() => {
    // Only connect if not already connected and not already connecting
    if (!isConnected && !connectionAttempted.current && !isConnectingRef.current) {
      console.log('Auto-connecting WebSocket...');
      connect();
    }
    
    return () => {
      // Clean up everything on unmount
      console.log('useWebSocket cleanup on unmount');
      shouldReconnect.current = false;
      
      // Clear all timeouts and intervals
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
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      if (socket) {
        socket.close(1000, 'Component unmounted');
      }
      
      connectionAttempted.current = false;
      isConnectingRef.current = false;
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Enhanced reconnection logic
  useEffect(() => {
    if (!isConnected && shouldReconnect.current && reconnectAttempts < connectionConfig.current.maxReconnectAttempts) {
      const delay = Math.min(
        connectionConfig.current.reconnectDelay * Math.pow(2, reconnectAttempts),
        connectionConfig.current.maxReconnectDelay
      );
      
      console.log(`Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldReconnect.current) {
          connect();
        }
      }, delay);
    }
  }, [isConnected, reconnectAttempts, connect]);

  const getQueueStatus = useCallback((chatType: string, interests: string[] = []) => {
    if (!chatType) {
      console.error('Cannot get queue status: chatType is required');
      return;
    }
    
    const message = {
      type: 'get_queue_status',
      chatType,
      interests: Array.isArray(interests) ? interests : []
    };
    
    console.log('Getting queue status:', message);
    sendMessage(message);
  }, [sendMessage]);
  
  // Enhanced connection diagnostics
  const getConnectionDiagnostics = useCallback(() => {
    return {
      isConnected,
      connectionType,
      connectionQuality,
      reconnectAttempts,
      lastHeartbeat,
      connectionError: connectionError ? {
        message: connectionError.message,
        code: connectionError.code,
        type: connectionError.type,
        recoverable: connectionError.recoverable
      } : null,
      metrics: connectionMetrics,
      messageQueueLength: messageQueue.current.length,
      isConnecting
    };
  }, [
    isConnected,
    connectionType,
    connectionQuality,
    reconnectAttempts,
    lastHeartbeat,
    connectionError,
    connectionMetrics,
    isConnecting
  ]);

  return {
    socket,
    isConnected,
    userId,
    reconnectAttempts,
    connectionQuality,
    lastHeartbeat,
    connectionType,
    connectionError,
    isConnecting,
    connectionMetrics,
    sendMessage,
    onMessage,
    offMessage,
    connect,
    disconnect,
    getQueueStatus,
    getConnectionDiagnostics,
  };
}
