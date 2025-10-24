import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useWebSocket } from '@/hooks/use-websocket';
import { Square, SkipForward, User } from 'lucide-react';
import { QuickGenderSelector } from '@/components/quick-gender-selector';
import EnhancedMessageInput from '@/components/enhanced-message-input';
import EnhancedMessage from '@/components/enhanced-message';
import type { Message, ChatSession, Attachment } from '@/types/chat';

export default function TextChat() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [matchQuality, setMatchQuality] = useState<'high' | 'random' | null>(null);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other' | null>(() => {
    return localStorage.getItem('gender') as 'male' | 'female' | 'other' | null || null;
  });
  const [showFeedback, setShowFeedback] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  const { 
    isConnected, 
    userId, 
    reconnectAttempts, 
    connectionQuality,
    lastHeartbeat,
    sendMessage, 
    onMessage, 
    offMessage,
    getQueueStatus 
  } = useWebSocket();

  useEffect(() => {
    if (!isConnected || !userId) return;

    // Try to recover existing session first
    const savedSessionId = sessionStorage.getItem('currentSessionId');
    const savedSessionType = sessionStorage.getItem('currentSessionType');
    
    if (savedSessionId && savedSessionType === 'text') {
      // Attempt session recovery
      sendMessage({
        type: 'get_session_recovery',
        sessionId: savedSessionId,
      });
    } else {
      // Find a match when component mounts
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
      sendMessage({
        type: 'find_match',
        chatType: 'text',
        interests,
        gender,
      });
    }

    // Register message handlers
    onMessage('waiting_for_match', (data) => {
      setConnectionStatus('waiting');
      setQueuePosition(data.queuePosition || null);
      setEstimatedWaitTime(data.estimatedWaitTime || null);
    });

    onMessage('match_found', async (data) => {
      const newSession = {
        id: data.sessionId,
        partnerId: data.partnerId,
        type: 'text' as const,
        status: 'connected' as const,
      };
      setSession(newSession);
      setConnectionStatus('connected');
      setMatchQuality(data.matchQuality || 'random');
      setSharedInterests(data.sharedInterests || []);
      setQueuePosition(null);
      setEstimatedWaitTime(null);
      
      // Save session for recovery
      sessionStorage.setItem('currentSessionId', data.sessionId);
      sessionStorage.setItem('currentSessionType', 'text');
      
      // Load existing messages for this session
      try {
        // Note: In a real implementation, you'd fetch from API
        // For now, we'll start with empty messages
        setMessages([]);
      } catch (error) {
        console.error('Failed to load messages:', error);
        setMessages([]);
      }
    });

    onMessage('session_recovered', (data) => {
      setSession({
        id: data.sessionId,
        partnerId: data.partnerId,
        type: 'text',
        status: 'connected',
      });
      setConnectionStatus('connected');
      // Show recovery message
      const recoveryMessage: Message = {
        id: `recovery-${Date.now()}`,
        content: '✅ Session recovered! You are back with your previous partner.',
        senderId: 'system',
        timestamp: new Date(),
        isOwn: false,
      };
      setMessages([recoveryMessage]);
    });

    onMessage('session_recovery_failed', () => {
      // Clear saved session
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      
      // Find new match
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
      sendMessage({
        type: 'find_match',
        chatType: 'text',
        interests,
        gender,
      });
    });

    onMessage('partner_reconnected', () => {
      // Show reconnection notification
      const reconnectMessage: Message = {
        id: `reconnect-${Date.now()}`,
        content: '🔄 Your partner reconnected!',
        senderId: 'system',
        timestamp: new Date(),
        isOwn: false,
      };
      setMessages(prev => [...prev, reconnectMessage]);
    });

    onMessage('gender_updated', (data) => {
      // Gender was successfully updated
      console.log('Gender updated:', data.gender);
    });

    onMessage('queue_status', (data) => {
      setQueuePosition(data.position);
      setEstimatedWaitTime(data.estimatedWaitTime);
    });

    onMessage('message_received', (data) => {
      // Only add message if it's from another user
      if (data.message.senderId !== userId) {
        const message: Message = {
          id: data.message.id || Date.now().toString(),
          content: data.message.content,
          senderId: data.message.senderId || 'unknown',
          timestamp: new Date(data.message.timestamp || Date.now()),
          isOwn: false, // Always false for received messages
          attachments: data.message.attachments || [],
          hasEmoji: data.message.hasEmoji || false,
        };
        setMessages(prev => [...prev, message]);
      }
    });

    onMessage('message_sent', (data) => {
      // Only add message if it's from the current user
      if (data.message.senderId === userId) {
        const message: Message = {
          id: data.message.id || Date.now().toString(),
          content: data.message.content,
          senderId: data.message.senderId || userId || 'self',
          timestamp: new Date(data.message.timestamp || Date.now()),
          isOwn: true, // Always true for sent messages
          attachments: data.message.attachments || [],
          hasEmoji: data.message.hasEmoji || false,
        };
        setMessages(prev => [...prev, message]);
      }
    });

    onMessage('message_delivered', (data) => {
      // Handle message delivery confirmation silently
      // Update message status if needed in the future
      console.log('Message delivered:', data.messageId);
    });

    onMessage('partner_typing', (data) => {
      setIsStrangerTyping(data.isTyping);
    });

    onMessage('chat_ended', () => {
      setConnectionStatus('ended');
      setSession(null);
      // Clear session storage
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      // Clear messages when chat ends (ephemeral chat)
      setMessages([]);
    });

    return () => {
      offMessage('waiting_for_match');
      offMessage('match_found');
      offMessage('message_received');
      offMessage('message_sent');
      offMessage('message_delivered');
      offMessage('partner_typing');
      offMessage('chat_ended');
      offMessage('session_recovered');
      offMessage('session_recovery_failed');
      offMessage('partner_reconnected');
      offMessage('gender_updated');
    };
  }, [isConnected, userId, sendMessage, onMessage, offMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStrangerTyping]);

  const handleSendMessage = (content: string, attachments?: Attachment[]) => {
    if ((!content.trim() && !attachments?.length) || !session) return;

    // Check if message contains emojis
    const hasEmoji = /[\u2600-\u27BF]|[\uD83C][\uDF00-\uDFFF]|[\uD83D][\uDC00-\uDE4F]|[\uD83D][\uDE80-\uDEFF]|[\uD83E][\uDD00-\uDDFF]/g.test(content);

    sendMessage({
      type: 'send_message',
      sessionId: session.id,
      content: content.trim(),
      attachments: attachments || [],
      hasEmoji,
    });

    setMessageInput('');
    handleStopTyping();
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
    // Clear session storage
    sessionStorage.removeItem('currentSessionId');
    sessionStorage.removeItem('currentSessionType');
    setLocation('/');
  };

  const handleGenderChange = (newGender: 'male' | 'female' | 'other') => {
    setUserGender(newGender);
    localStorage.setItem('gender', newGender);
    
    // If we're in a session, notify the server about the gender change
    if (session && isConnected) {
      sendMessage({
        type: 'update_gender',
        sessionId: session.id,
        gender: newGender,
      });
    }
  };

  const handleNextStranger = () => {
    console.log('Next stranger clicked - current status:', connectionStatus);
    
    // Clear any existing session storage
    sessionStorage.removeItem('currentSessionId');
    sessionStorage.removeItem('currentSessionType');
    
    const interests = JSON.parse(localStorage.getItem('interests') || '[]');
    const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
    
    if (session) {
      // If we have an active session, end it and find a new match
      sendMessage({
        type: 'next_stranger',
        sessionId: session.id,
        chatType: 'text',
        interests,
        gender,
      });
    } else {
      // If no active session, just start looking for a new match
      sendMessage({
        type: 'find_match',
        chatType: 'text',
        interests,
        gender,
      });
    }
    
    // Clear messages when moving to next stranger (ephemeral chat)
    setMessages([]);
    
    // Reset connection status to waiting
    setConnectionStatus('waiting');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full h-full flex flex-col animate-slide-in">
      <div className="flex-1 flex flex-col bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-0 overflow-hidden">
        {/* Chat Header - Modern Design */}
        <div className="flex-shrink-0 border-b border-border/50 p-4 sm:p-6 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <Avatar className="relative w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-background">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                    <User className="h-6 w-6 sm:h-7 sm:w-7" />
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 border-2 border-background rounded-full transition-colors ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'waiting' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold" data-testid="stranger-name">Stranger</h3>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                    connectionStatus === 'waiting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span data-testid="connection-status" className="font-medium">
                    {connectionStatus === 'connected' ? (
                      <span className="text-green-500">Connected {connectionQuality === 'poor' ? '(Poor)' : ''}</span>
                    ) : connectionStatus === 'waiting' ? (
                      <span className="text-yellow-500">
                        {reconnectAttempts > 0 ? `Reconnecting... (${reconnectAttempts})` : 
                         queuePosition ? `Position ${queuePosition} in queue` : 'Finding match...'}
                      </span>
                    ) : !isConnected ? (
                      <span className="text-red-500">Disconnected</span>
                    ) : (
                      'Connecting...'
                    )}
                  </span>
                </div>
                {sharedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sharedInterests.slice(0, 3).map((interest) => (
                      <span key={interest} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                        #{interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <QuickGenderSelector
                currentGender={userGender}
                onGenderChange={handleGenderChange}
                disabled={connectionStatus === 'ended'}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextStranger}
                className="flex-1 sm:flex-initial bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 hover:border-primary/40 rounded-xl"
                data-testid="button-next-stranger"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Next
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopChat}
                className="flex-1 sm:flex-initial shadow-md hover:shadow-lg transition-all rounded-xl"
                data-testid="button-stop-chat"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-background/50 to-background/30 custom-scrollbar" data-testid="messages-container">
          {connectionStatus === 'waiting' && (
            <div className="flex justify-center items-center h-full">
              <div className="text-center animate-scale-in">
                <div className="relative mb-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full mx-auto animate-ping"></div>
                </div>
                <div className="bg-card/80 backdrop-blur-sm px-6 py-3 rounded-2xl text-sm border border-border shadow-lg">
                  <span className="mr-2">🔄</span>
                  {queuePosition ? (
                    <>
                      Position <span className="font-bold text-primary">{queuePosition}</span> in queue
                      {estimatedWaitTime && (
                        <span className="text-muted-foreground"> • ~{estimatedWaitTime}s wait</span>
                      )}
                    </>
                  ) : (
                    'Looking for someone to chat with...'
                  )}
                </div>
              </div>
            </div>
          )}

          {connectionStatus === 'connected' && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/30 blur-2xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-primary to-secondary w-20 h-20 rounded-full flex items-center justify-center shadow-xl">
                  <User className="h-10 w-10 text-white" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="bg-card/80 backdrop-blur-sm px-6 py-3 rounded-2xl text-sm border border-border shadow-lg">
                  <span className="mr-2">👋</span>
                  <span className="font-medium">You're now chatting with a random stranger</span>
                  {matchQuality === 'high' && (
                    <span className="ml-2 text-primary font-semibold">✨ Great match!</span>
                  )}
                </div>
                {sharedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {sharedInterests.map((interest, index) => (
                      <span 
                        key={interest} 
                        className="px-3 py-1.5 bg-gradient-to-r from-primary/10 to-secondary/10 text-primary text-xs font-medium rounded-full border border-primary/20 animate-scale-in"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        #{interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${message.isOwn ? 'justify-end' : ''} animate-slide-in`}
              style={{ animationDelay: `${index * 50}ms` }}
              data-testid={`message-${message.id}`}
            >
              {!message.isOwn && (
                <Avatar className="w-9 h-9 flex-shrink-0 ring-2 ring-primary/10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={`flex-1 max-w-[85%] sm:max-w-[75%] ${message.isOwn ? 'flex flex-col items-end' : ''}`}>
                <EnhancedMessage message={message} />
                <p className="text-xs text-muted-foreground mt-1.5 mx-2 font-medium" data-testid="message-time">
                  {formatTime(message.timestamp)}
                </p>
              </div>

              {message.isOwn && (
                <Avatar className="w-9 h-9 flex-shrink-0 ring-2 ring-accent/10">
                  <AvatarFallback className="bg-gradient-to-br from-accent to-secondary text-white">
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isStrangerTyping && (
            <div className="flex items-start gap-3 animate-slide-in" data-testid="typing-indicator">
              <Avatar className="w-9 h-9 flex-shrink-0 ring-2 ring-primary/10">
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl rounded-tl-sm px-5 py-3 flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input - WhatsApp Style */}
        <div className="flex-shrink-0">
          <EnhancedMessageInput
            value={messageInput}
            onChange={setMessageInput}
            onSend={handleSendMessage}
            disabled={connectionStatus !== 'connected'}
            placeholder="Type your message..."
          />
        </div>
      </div>
    </div>
  );
}
