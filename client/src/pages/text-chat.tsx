import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useWebSocket } from '@/hooks/use-websocket';
import { Square, SkipForward, Send, User } from 'lucide-react';
import type { Message, ChatSession } from '@/types/chat';

export default function TextChat() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  const { isConnected, userId, sendMessage, onMessage, offMessage } = useWebSocket();

  useEffect(() => {
    if (!isConnected || !userId) return;

    // Find a match when component mounts
    const interests = JSON.parse(localStorage.getItem('interests') || '[]');
    sendMessage({
      type: 'find_match',
      chatType: 'text',
      interests,
    });

    // Register message handlers
    onMessage('waiting_for_match', () => {
      setConnectionStatus('waiting');
    });

    onMessage('match_found', (data) => {
      setSession({
        id: data.sessionId,
        partnerId: data.partnerId,
        type: 'text',
        status: 'connected',
      });
      setConnectionStatus('connected');
      setMessages([]);
    });

    onMessage('message_received', (data) => {
      const message: Message = {
        ...data.message,
        timestamp: new Date(data.message.timestamp),
        isOwn: false,
      };
      setMessages(prev => [...prev, message]);
    });

    onMessage('message_sent', (data) => {
      const message: Message = {
        ...data.message,
        timestamp: new Date(data.message.timestamp),
        isOwn: true,
      };
      setMessages(prev => [...prev, message]);
    });

    onMessage('partner_typing', (data) => {
      setIsStrangerTyping(data.isTyping);
    });

    onMessage('chat_ended', () => {
      setConnectionStatus('ended');
      setSession(null);
    });

    return () => {
      offMessage('waiting_for_match');
      offMessage('match_found');
      offMessage('message_received');
      offMessage('message_sent');
      offMessage('partner_typing');
      offMessage('chat_ended');
    };
  }, [isConnected, userId, sendMessage, onMessage, offMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStrangerTyping]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !session) return;

    sendMessage({
      type: 'send_message',
      sessionId: session.id,
      content: messageInput.trim(),
    });

    setMessageInput('');
    handleStopTyping();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (value: string) => {
    setMessageInput(value);
    
    if (!session) return;

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendMessage({
        type: 'typing',
        sessionId: session.id,
        isTyping: true,
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(handleStopTyping, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping && session) {
      setIsTyping(false);
      sendMessage({
        type: 'typing',
        sessionId: session.id,
        isTyping: false,
      });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleStopChat = () => {
    if (session) {
      sendMessage({
        type: 'end_chat',
        sessionId: session.id,
      });
    }
    setLocation('/');
  };

  const handleNextStranger = () => {
    if (session) {
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      sendMessage({
        type: 'next_stranger',
        sessionId: session.id,
        chatType: 'text',
        interests,
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Chat Header */}
        <div className="border-b border-border p-4 flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-card rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'waiting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold" data-testid="stranger-name">Stranger</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                  connectionStatus === 'waiting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span data-testid="connection-status">
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'waiting' ? 'Finding match...' : 'Disconnected'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopChat}
              data-testid="button-stop-chat"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
            <Button
              size="sm"
              onClick={handleNextStranger}
              disabled={connectionStatus !== 'connected'}
              data-testid="button-next-stranger"
            >
              Next
              <SkipForward className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="h-[500px] overflow-y-auto p-4 space-y-4 bg-background/30" data-testid="messages-container">
          {connectionStatus === 'waiting' && (
            <div className="flex justify-center">
              <div className="bg-muted/20 px-4 py-2 rounded-full text-sm text-muted-foreground">
                <span className="mr-2">🔄</span>
                Looking for someone to chat with...
              </div>
            </div>
          )}

          {connectionStatus === 'connected' && messages.length === 0 && (
            <div className="flex justify-center">
              <div className="bg-muted/20 px-4 py-2 rounded-full text-sm text-muted-foreground">
                <span className="mr-2">👋</span>
                You're now chatting with a random stranger
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${message.isOwn ? 'justify-end' : ''}`}
              data-testid={`message-${message.id}`}
            >
              {!message.isOwn && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={`flex-1 ${message.isOwn ? 'flex flex-col items-end' : ''}`}>
                <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] inline-block ${
                  message.isOwn 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-card border border-border rounded-tl-sm'
                }`}>
                  <p className="text-sm" data-testid="message-content">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 mx-1" data-testid="message-time">
                  {formatTime(message.timestamp)}
                </p>
              </div>

              {message.isOwn && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-accent to-secondary text-white">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isStrangerTyping && (
            <div className="flex items-start gap-3" data-testid="typing-indicator">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-border p-4 bg-card/50">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Textarea
                value={messageInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="resize-none min-h-[50px]"
                rows={1}
                disabled={connectionStatus !== 'connected'}
                data-testid="input-message"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || connectionStatus !== 'connected'}
              className="px-6 py-3"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
