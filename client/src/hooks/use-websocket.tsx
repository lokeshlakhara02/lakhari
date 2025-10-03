import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage } from '@/types/chat';

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setSocket(ws);
      
      // Send join message
      ws.send(JSON.stringify({
        type: 'join',
        interests: JSON.parse(localStorage.getItem('interests') || '[]')
      }));
    };

    ws.onclose = () => {
      setIsConnected(false);
      setSocket(null);
      setUserId(null);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Handle user joined
        if (message.type === 'user_joined') {
          setUserId(message.userId);
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

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }, []);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.close();
    }
  }, [socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
    }
  }, [socket, isConnected]);

  const onMessage = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
  }, []);

  const offMessage = useCallback((type: string) => {
    messageHandlers.current.delete(type);
  }, []);

  useEffect(() => {
    const ws = connect();
    
    return () => {
      ws.close();
    };
  }, [connect]);

  return {
    socket,
    isConnected,
    userId,
    sendMessage,
    onMessage,
    offMessage,
    connect,
    disconnect,
  };
}
