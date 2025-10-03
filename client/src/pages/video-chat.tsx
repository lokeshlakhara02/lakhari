import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebSocket } from '@/hooks/use-websocket';
import { useWebRTC } from '@/hooks/use-webrtc';
import { 
  Phone, Maximize, Mic, MicOff, Video, VideoOff, 
  SkipForward, Send, Heart 
} from 'lucide-react';
import type { ChatSession } from '@/types/chat';

export default function VideoChat() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
  const [textMessage, setTextMessage] = useState('');
  const [textMessages, setTextMessages] = useState<Array<{id: string, content: string, isOwn: boolean}>>([]);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const { isConnected, userId, sendMessage, onMessage, offMessage } = useWebSocket();
  const {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    startLocalStream,
    toggleVideo,
    toggleAudio,
    endCall,
    createOffer,
    createAnswer,
    handleAnswer,
    addIceCandidate,
    peerConnection
  } = useWebRTC();

  useEffect(() => {
    // Start local video stream
    startLocalStream(true).catch(error => {
      console.error('Failed to start local stream:', error);
    });

    return () => {
      endCall();
    };
  }, [startLocalStream, endCall]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!isConnected || !userId) return;

    // Find a match when component mounts
    const interests = JSON.parse(localStorage.getItem('interests') || '[]');
    sendMessage({
      type: 'find_match',
      chatType: 'video',
      interests,
    });

    // Register WebSocket handlers
    onMessage('waiting_for_match', () => {
      setConnectionStatus('waiting');
    });

    onMessage('match_found', async (data) => {
      setSession({
        id: data.sessionId,
        partnerId: data.partnerId,
        type: 'video',
        status: 'connected',
      });
      setConnectionStatus('connected');
      
      // Calculate shared interests
      const userInterests = JSON.parse(localStorage.getItem('interests') || '[]');
      const shared = userInterests.filter((interest: string) => 
        data.partnerInterests?.includes(interest)
      );
      setSharedInterests(shared);

      // Start WebRTC offer
      if (peerConnection) {
        const offer = await createOffer();
        if (offer) {
          sendMessage({
            type: 'webrtc_offer',
            sessionId: data.sessionId,
            offer,
          });
        }
      }
    });

    onMessage('webrtc_offer', async (data) => {
      if (peerConnection) {
        const answer = await createAnswer(data.offer);
        if (answer) {
          sendMessage({
            type: 'webrtc_answer',
            sessionId: data.sessionId,
            answer,
          });
        }
      }
    });

    onMessage('webrtc_answer', async (data) => {
      await handleAnswer(data.answer);
    });

    onMessage('webrtc_ice_candidate', async (data) => {
      await addIceCandidate(data.candidate);
    });

    onMessage('chat_ended', () => {
      setConnectionStatus('ended');
      setSession(null);
      endCall();
    });

    // Set up ICE candidate handler
    if (peerConnection) {
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && session) {
          sendMessage({
            type: 'webrtc_ice_candidate',
            sessionId: session.id,
            candidate: event.candidate,
          });
        }
      };
    }

    return () => {
      offMessage('waiting_for_match');
      offMessage('match_found');
      offMessage('webrtc_offer');
      offMessage('webrtc_answer');
      offMessage('webrtc_ice_candidate');
      offMessage('chat_ended');
    };
  }, [
    isConnected, userId, session, peerConnection,
    sendMessage, onMessage, offMessage,
    createOffer, createAnswer, handleAnswer, addIceCandidate, endCall
  ]);

  const handleEndCall = () => {
    if (session) {
      sendMessage({
        type: 'end_chat',
        sessionId: session.id,
      });
    }
    endCall();
    setLocation('/');
  };

  const handleNextStranger = () => {
    if (session) {
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      sendMessage({
        type: 'next_stranger',
        sessionId: session.id,
        chatType: 'video',
        interests,
      });
    }
  };

  const handleSendTextMessage = () => {
    if (!textMessage.trim() || !session) return;

    const message = {
      id: Date.now().toString(),
      content: textMessage.trim(),
      isOwn: true,
    };

    setTextMessages(prev => [...prev, message]);
    
    sendMessage({
      type: 'send_message',
      sessionId: session.id,
      content: textMessage.trim(),
    });

    setTextMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendTextMessage();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Video Container */}
        <div className="relative bg-black aspect-video">
          {/* Remote Video (Main) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            data-testid="remote-video"
          />
          
          {/* Waiting State */}
          {connectionStatus === 'waiting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
              <div className="text-center">
                <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <VideoOff className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Looking for someone to video chat with...</p>
              </div>
            </div>
          )}

          {/* No Remote Stream */}
          {connectionStatus === 'connected' && !remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
              <div className="text-center">
                <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <VideoOff className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Waiting for stranger's video...</p>
              </div>
            </div>
          )}

          {/* Local Video (Picture-in-Picture) */}
          <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-border shadow-xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
              data-testid="local-video"
            />
          </div>

          {/* Connection Status Overlay */}
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
              connectionStatus === 'waiting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-sm text-white font-medium" data-testid="connection-status">
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'waiting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>

          {/* Shared Interests Badge */}
          {sharedInterests.length > 0 && (
            <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
              <span className="text-sm text-white font-medium">
                <Heart className="inline h-4 w-4 text-primary mr-1" />
                {sharedInterests.length} shared interest{sharedInterests.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Video Controls Overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={toggleAudio}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 border border-white/20"
              data-testid="button-toggle-audio"
            >
              {isAudioEnabled ? (
                <Mic className="h-5 w-5 text-white" />
              ) : (
                <MicOff className="h-5 w-5 text-white" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="lg"
              onClick={toggleVideo}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 border border-white/20"
              data-testid="button-toggle-video"
            >
              {isVideoEnabled ? (
                <Video className="h-5 w-5 text-white" />
              ) : (
                <VideoOff className="h-5 w-5 text-white" />
              )}
            </Button>
            
            <Button
              variant="destructive"
              size="lg"
              onClick={handleEndCall}
              className="w-14 h-14 rounded-full shadow-lg"
              data-testid="button-end-call"
            >
              <Phone className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="lg"
              onClick={toggleFullscreen}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 border border-white/20"
              data-testid="button-fullscreen"
            >
              <Maximize className="h-5 w-5 text-white" />
            </Button>
            
            <Button
              onClick={handleNextStranger}
              disabled={connectionStatus !== 'connected'}
              className="px-6 h-12 rounded-full bg-primary hover:bg-primary/90 font-medium shadow-lg"
              data-testid="button-next-video"
            >
              Next
              <SkipForward className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Text Chat in Video Mode */}
        <div className="border-t border-border">
          <div className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-3">
              <Send className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Text Chat</span>
            </div>
            
            {textMessages.length > 0 && (
              <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                {textMessages.map((message) => (
                  <div key={message.id} className="flex items-start gap-2">
                    <div className="text-xs text-muted-foreground mt-1">
                      {message.isOwn ? 'You:' : 'Stranger:'}
                    </div>
                    <div className="flex-1 text-sm bg-muted/20 rounded-lg px-3 py-1.5">
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Input
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1"
                disabled={connectionStatus !== 'connected'}
                data-testid="input-text-message"
              />
              <Button
                onClick={handleSendTextMessage}
                disabled={!textMessage.trim() || connectionStatus !== 'connected'}
                size="sm"
                data-testid="button-send-text"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
