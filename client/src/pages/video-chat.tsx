import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { useWebRTC } from '@/hooks/use-webrtc';
import { 
  Phone, Maximize, Mic, MicOff, Video, VideoOff, 
  SkipForward, Send, Heart, AlertCircle, ChevronDown 
} from 'lucide-react';
import { QuickGenderSelector } from '@/components/quick-gender-selector';
import EnhancedMessageInput from '@/components/enhanced-message-input';
import EnhancedMessage from '@/components/enhanced-message';
import type { ChatSession, Message, Attachment } from '@/types/chat';

export default function VideoChat() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
  const [textMessage, setTextMessage] = useState('');
  const [textMessages, setTextMessages] = useState<Message[]>([]);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other' | null>(() => {
    return localStorage.getItem('gender') as 'male' | 'female' | 'other' | null || null;
  });
  const [mediaAccessStatus, setMediaAccessStatus] = useState<{
    hasVideo: boolean;
    hasAudio: boolean;
    error: string | null;
  }>({
    hasVideo: false,
    hasAudio: false,
    error: null
  });
  
  // Control bar visibility state
  const [isControlBarVisible, setIsControlBarVisible] = useState(true);
  const [isControlBarPinned, setIsControlBarPinned] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoDesktopRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { isConnected, userId, reconnectAttempts, sendMessage, onMessage, offMessage } = useWebSocket();
  const {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    iceConnectionState,
    connectionQuality,
    permissions,
    permissionError: webrtcPermissionError,
    startLocalStream,
    toggleVideo,
    toggleAudio,
    endCall,
    createOffer,
    createAnswer,
    handleAnswer,
    addIceCandidate,
    checkPermissions,
    requestPermissions,
    peerConnection
  } = useWebRTC();

  // Initialize media access gracefully
  useEffect(() => {
    let isMounted = true;
    
    const initializeMedia = async () => {
      try {
        // Try to start with both video and audio
        await startLocalStream(true, true);
        setMediaAccessStatus({
          hasVideo: true,
          hasAudio: true,
          error: null
        });
      } catch (error) {
        console.log('Full media access failed, trying fallback options:', error);
        
        // Try with audio only
        try {
          await startLocalStream(false, true);
          setMediaAccessStatus({
            hasVideo: false,
            hasAudio: true,
            error: 'Video access denied, audio only mode'
          });
        } catch (audioError) {
          console.log('Audio only failed, trying video only:', audioError);
          
          // Try with video only
          try {
            await startLocalStream(true, false);
            setMediaAccessStatus({
              hasVideo: true,
              hasAudio: false,
              error: 'Audio access denied, video only mode'
            });
          } catch (videoError) {
            console.log('Video only failed, continuing without media:', videoError);
            
            // Continue without any media
            setMediaAccessStatus({
              hasVideo: false,
              hasAudio: false,
              error: 'Camera and microphone access denied. Chat will work in text-only mode.'
            });
          }
        }
      }
    };

    if (isMounted) {
      initializeMedia();
    }

    return () => {
      isMounted = false;
      endCall();
    };
  }, []); // Empty dependency array to run only once on mount

  useEffect(() => {
    const localVideo = localVideoRef.current;
    const localVideoDesktop = localVideoDesktopRef.current;
    
    const updateVideoStream = (video: HTMLVideoElement | null) => {
      if (video && localStream) {
        // Only set srcObject if it's different to prevent flickering
        if (video.srcObject !== localStream) {
          video.srcObject = localStream;
          // Use a more robust play() approach
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              // Ignore AbortError as it's expected when new streams are loaded
              if (error.name !== 'AbortError') {
                console.error('Video play error:', error);
              }
            });
          }
        }
      }
    };

    // Add a small delay to prevent rapid updates
    const timeoutId = setTimeout(() => {
      updateVideoStream(localVideo);
      updateVideoStream(localVideoDesktop);
    }, 100); // 100ms delay to debounce updates

    return () => {
      clearTimeout(timeoutId);
      if (localVideo && localVideo.srcObject) {
        localVideo.srcObject = null;
      }
      if (localVideoDesktop && localVideoDesktop.srcObject) {
        localVideoDesktop.srcObject = null;
      }
    };
  }, [localStream]);

  useEffect(() => {
    const remoteVideo = remoteVideoRef.current;
    if (remoteVideo && remoteStream) {
      // Only set srcObject if it's different to prevent flickering
      if (remoteVideo.srcObject !== remoteStream) {
        // Add a small delay to prevent rapid updates
        const timeoutId = setTimeout(() => {
          if (remoteVideo && remoteStream) {
            remoteVideo.srcObject = remoteStream;
            // Use a more robust play() approach
            const playPromise = remoteVideo.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                // Ignore AbortError as it's expected when new streams are loaded
                if (error.name !== 'AbortError') {
                  console.error('Remote video play error:', error);
                }
              });
            }
          }
        }, 100); // 100ms delay to debounce updates

        return () => {
          clearTimeout(timeoutId);
        };
      }
    }
    return () => {
      if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
      }
    };
  }, [remoteStream]);

  // WebSocket message handlers - only set up once
  useEffect(() => {
    if (!isConnected || !userId) return;

    // Try to recover existing session first
    const savedSessionId = sessionStorage.getItem('currentSessionId');
    const savedSessionType = sessionStorage.getItem('currentSessionType');
    
    if (savedSessionId && savedSessionType === 'video') {
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
        chatType: 'video',
        interests,
        gender,
      });
    }
  }, [isConnected, userId, sendMessage]);

  // WebSocket message handlers - stable references
  useEffect(() => {
    if (!isConnected) return;

    const handleWaitingForMatch = () => {
      setConnectionStatus('waiting');
    };

    const handleMatchFound = async (data: any) => {
      const newSession = {
        id: data.sessionId,
        partnerId: data.partnerId,
        type: 'video' as const,
        status: 'connected' as const,
      };
      setSession(newSession);
      setConnectionStatus('connected');
      
      // Save session for recovery
      sessionStorage.setItem('currentSessionId', data.sessionId);
      sessionStorage.setItem('currentSessionType', 'video');
      
      // Clear previous messages when new match is found (ephemeral chat)
      setTextMessages([]);
      
      // Calculate shared interests
      const userInterests = JSON.parse(localStorage.getItem('interests') || '[]');
      const shared = userInterests.filter((interest: string) => 
        data.partnerInterests?.includes(interest)
      );
      setSharedInterests(shared);

      // Start WebRTC offer - use current peerConnection ref
      const pc = peerConnection;
      if (pc) {
        try {
          const offer = await createOffer();
          if (offer) {
            sendMessage({
              type: 'webrtc_offer',
              sessionId: data.sessionId,
              offer,
            });
          }
        } catch (error) {
          console.error('Failed to create offer:', error);
        }
      }
    };

    const handleWebRTCOffer = async (data: any) => {
      const pc = peerConnection;
      if (pc) {
        try {
          const answer = await createAnswer(data.offer);
          if (answer) {
            sendMessage({
              type: 'webrtc_answer',
              sessionId: data.sessionId,
              answer,
            });
          }
        } catch (error) {
          console.error('Failed to create answer:', error);
        }
      }
    };

    const handleWebRTCAnswer = async (data: any) => {
      try {
        await handleAnswer(data.answer);
      } catch (error) {
        console.error('Failed to handle answer:', error);
      }
    };

    const handleIceCandidate = async (data: any) => {
      try {
        await addIceCandidate(data.candidate);
      } catch (error) {
        console.error('Failed to add ICE candidate:', error);
      }
    };

    const handleChatEnded = () => {
      setConnectionStatus('ended');
      setSession(null);
      // Clear session storage
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      // Clear all messages and files when chat ends (ephemeral like WhatsApp)
      setTextMessages([]);
      endCall();
    };

    const handleSessionRecovered = (data: any) => {
      setSession({
        id: data.sessionId,
        partnerId: data.partnerId,
        type: 'video',
        status: 'connected',
      });
      setConnectionStatus('connected');
      // Show recovery notification
      const recoveryMsg: Message = {
        id: `recovery-${Date.now()}`,
        content: '✅ Session recovered! Reconnecting video...',
        senderId: 'system',
        timestamp: new Date(),
        isOwn: false,
      };
      setTextMessages([recoveryMsg]);
    };

    const handleSessionRecoveryFailed = () => {
      // Clear saved session
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      
      // Find new match
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
      sendMessage({
        type: 'find_match',
        chatType: 'video',
        interests,
        gender,
      });
    };

    const handlePartnerReconnected = () => {
      const reconnectMsg: Message = {
        id: `reconnect-${Date.now()}`,
        content: '🔄 Your partner reconnected!',
        senderId: 'system',
        timestamp: new Date(),
        isOwn: false,
      };
      setTextMessages(prev => [...prev, reconnectMsg]);
    };

    const handleMessageReceived = (data: any) => {
      const message: Message = {
        id: data.message.id || Date.now().toString(),
        content: data.message.content,
        senderId: data.message.senderId || 'unknown',
        timestamp: new Date(data.message.timestamp || Date.now()),
        isOwn: false,
        attachments: data.message.attachments || [],
        hasEmoji: data.message.hasEmoji || false,
      };
      setTextMessages(prev => [...prev, message]);
    };

    const handleMessageSent = (data: any) => {
      const message: Message = {
        id: data.message.id || Date.now().toString(),
        content: data.message.content,
        senderId: data.message.senderId || userId || 'self',
        timestamp: new Date(data.message.timestamp || Date.now()),
        isOwn: true,
        attachments: data.message.attachments || [],
        hasEmoji: data.message.hasEmoji || false,
      };
      setTextMessages(prev => [...prev, message]);
    };

    // Register message handlers
    onMessage('waiting_for_match', handleWaitingForMatch);
    onMessage('match_found', handleMatchFound);
    onMessage('webrtc_offer', handleWebRTCOffer);
    onMessage('webrtc_answer', handleWebRTCAnswer);
    onMessage('webrtc_ice_candidate', handleIceCandidate);
    onMessage('chat_ended', handleChatEnded);
    onMessage('message_received', handleMessageReceived);
    onMessage('message_sent', handleMessageSent);
    onMessage('session_recovered', handleSessionRecovered);
    onMessage('session_recovery_failed', handleSessionRecoveryFailed);
    onMessage('partner_reconnected', handlePartnerReconnected);
    onMessage('gender_updated', (data) => {
      // Gender was successfully updated
      console.log('Gender updated:', data.gender);
    });

    return () => {
      offMessage('waiting_for_match');
      offMessage('match_found');
      offMessage('webrtc_offer');
      offMessage('webrtc_answer');
      offMessage('webrtc_ice_candidate');
      offMessage('chat_ended');
      offMessage('message_received');
      offMessage('message_sent');
      offMessage('session_recovered');
      offMessage('session_recovery_failed');
      offMessage('partner_reconnected');
      offMessage('gender_updated');
    };
  }, [isConnected]); // Only depend on isConnected

  // ICE candidate handler - separate effect to avoid dependency issues
  useEffect(() => {
    const pc = peerConnection;
    if (pc) {
      const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate && session) {
          sendMessage({
            type: 'webrtc_ice_candidate',
            sessionId: session.id,
            candidate: event.candidate,
          });
        }
      };

      pc.onicecandidate = handleIceCandidate;

      return () => {
        pc.onicecandidate = null;
      };
    }
  }, [peerConnection, session, sendMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [textMessages]);

  // Auto-hide control bar functionality
  useEffect(() => {
    const handleMouseMove = () => {
      if (isControlBarPinned) return;
      
      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      // Show control bar immediately
      setIsControlBarVisible(true);
      
      // Set timeout to hide after 3 seconds of no movement
      hideTimeoutRef.current = setTimeout(() => {
        setIsControlBarVisible(false);
      }, 3000);
    };

    const handleMouseLeave = () => {
      if (isControlBarPinned) return;
      
      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      // Hide control bar when mouse leaves the video area
      hideTimeoutRef.current = setTimeout(() => {
        setIsControlBarVisible(false);
      }, 1000);
    };

    // Add event listeners to the video container
    const videoContainer = document.querySelector('[data-video-container]');
    if (videoContainer) {
      videoContainer.addEventListener('mousemove', handleMouseMove);
      videoContainer.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (videoContainer) {
        videoContainer.removeEventListener('mousemove', handleMouseMove);
        videoContainer.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isControlBarPinned]);

  // Toggle control bar visibility
  const toggleControlBar = () => {
    if (isControlBarPinned) {
      // Currently pinned, so unpin and hide
      setIsControlBarPinned(false);
      setIsControlBarVisible(false);
    } else {
      // Currently unpinned, so pin and show
      setIsControlBarPinned(true);
      setIsControlBarVisible(true);
    }
  };

  // Manual hide control bar
  const hideControlBar = () => {
    setIsControlBarVisible(false);
    setIsControlBarPinned(false);
  };

  const handleEndCall = () => {
    if (session) {
      sendMessage({
        type: 'end_chat',
        sessionId: session.id,
      });
    }
    // Clear session storage
    sessionStorage.removeItem('currentSessionId');
    sessionStorage.removeItem('currentSessionType');
    // Clear messages when ending call (ephemeral chat)
    setTextMessages([]);
    endCall();
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
    if (session) {
      // Clear session storage before finding new match
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
      sendMessage({
        type: 'next_stranger',
        sessionId: session.id,
        chatType: 'video',
        gender,
        interests,
      });
      // Clear messages when moving to next stranger (ephemeral chat)
      setTextMessages([]);
    }
  };

  const handleSendTextMessage = (content: string, attachments?: Attachment[]) => {
    if ((!content.trim() && !attachments?.length) || !session) return;

    // Check if message contains emojis
    const hasEmoji = /[\u2600-\u27BF]|[\uD83C][\uDF00-\uDFFF]|[\uD83D][\uDC00-\uDE4F]|[\uD83D][\uDE80-\uDEFF]|[\uD83E][\uDD00-\uDDFF]/g.test(content);

    // Send message to server - the server will send back a message_sent event
    sendMessage({
      type: 'send_message',
      sessionId: session.id,
      content: content.trim(),
      attachments: attachments || [],
      hasEmoji,
    });
  };


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Retry media access
  const handleRetryMediaAccess = async () => {
    setMediaAccessStatus({
      hasVideo: false,
      hasAudio: false,
      error: null
    });
    
    try {
      // Try to start with both video and audio
      await startLocalStream(true, true);
      setMediaAccessStatus({
        hasVideo: true,
        hasAudio: true,
        error: null
      });
    } catch (error) {
      console.log('Retry failed, trying fallback options:', error);
      
      // Try with audio only
      try {
        await startLocalStream(false, true);
        setMediaAccessStatus({
          hasVideo: false,
          hasAudio: true,
          error: 'Video access denied, audio only mode'
        });
      } catch (audioError) {
        // Try with video only
        try {
          await startLocalStream(true, false);
          setMediaAccessStatus({
            hasVideo: true,
            hasAudio: false,
            error: 'Audio access denied, video only mode'
          });
        } catch (videoError) {
          // Continue without any media
          setMediaAccessStatus({
            hasVideo: false,
            hasAudio: false,
            error: 'Camera and microphone access denied. Chat will work in text-only mode.'
          });
        }
      }
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-background via-background to-primary/5 flex flex-col animate-fade-in">
      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-full min-h-0">
        {/* Remote Video Section */}
        <div className="h-1/2 lg:h-auto lg:flex-1 relative lg:order-1" data-video-container>
          <div className="relative bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-900 dark:to-slate-800 w-full h-full">
                {/* Remote Video (Main) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  controls={false}
                  className="w-full h-full object-cover"
                  data-testid="remote-video"
                  style={{ 
                    backgroundColor: '#0f172a',
                    transform: 'scaleX(-1)', // Mirror the remote video
                    imageRendering: 'auto',
                    willChange: 'transform'
                  }}
                />
                
                {/* Video Overlay Effects */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 dark:from-black/20 from-white/10 via-transparent to-transparent pointer-events-none" />
                
                {/* Waiting State */}
                {connectionStatus === 'waiting' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200/90 to-slate-300/90 dark:from-slate-800/90 dark:to-slate-900/90 backdrop-blur-sm">
                    <div className="text-center px-4 max-w-xs mx-auto">
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                          <VideoOff className="h-8 w-8 text-slate-700 dark:text-white/60" />
                        </div>
                        <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full mx-auto animate-ping" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Finding Match</h3>
                      <p className="text-slate-600 dark:text-white/70 text-xs leading-relaxed mb-3">
                        Searching for someone to video chat with...
                      </p>
                      
                      {/* Media Access Status - Simplified */}
                      {mediaAccessStatus.error && (
                        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            {mediaAccessStatus.error.includes('HTTPS') 
                              ? 'Camera/microphone access requires HTTPS. Please use https:// instead of http://'
                              : mediaAccessStatus.error
                            }
                          </p>
                        </div>
                      )}
                      
                      <div className="flex justify-center mt-3">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* No Remote Stream */}
                {connectionStatus === 'connected' && !remoteStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200/90 to-slate-300/90 dark:from-slate-800/90 dark:to-slate-900/90 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <VideoOff className="h-8 w-8 text-slate-700 dark:text-white/60" />
                      </div>
                      <p className="text-slate-600 dark:text-white/70 text-xs">Waiting for video...</p>
                    </div>
                  </div>
                )}

                {/* Local Video (Picture-in-Picture) - Mobile Only */}
                {localStream && (
                  <div className="lg:hidden absolute bottom-3 right-3 w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl backdrop-blur-sm bg-gradient-to-br from-black/40 to-black/20 group hover:scale-105 transition-transform duration-300">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted={true}
                      controls={false}
                      className="w-full h-full object-cover"
                      style={{ 
                        backgroundColor: '#000',
                        transform: 'scaleX(-1)',
                        imageRendering: 'auto',
                        willChange: 'transform'
                      }}
                    />
                    {/* Local video indicator - Glassmorphism */}
                    <div className="absolute top-2 left-2 px-2 py-1 bg-gradient-to-r from-primary/80 to-secondary/80 backdrop-blur-md rounded-lg text-xs text-white font-semibold border border-white/20 shadow-lg">
                      You
                    </div>
                  </div>
                )}

                {/* Video Controls - Modern Glassmorphism with Hide/Show */}
                <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 lg:bottom-8 lg:left-1/2 transition-all duration-500 ease-in-out ${
                  isControlBarVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-16 pointer-events-none'
                }`}>
                  <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 bg-gradient-to-r from-background/90 via-background/80 to-background/90 backdrop-blur-xl rounded-2xl px-3 py-2 sm:px-6 sm:py-4 border border-border/50 shadow-2xl">
                    {/* Audio Toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAudio}
                      disabled={!mediaAccessStatus.hasAudio}
                      className={`group relative w-10 h-10 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 ${
                        !mediaAccessStatus.hasAudio
                          ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                          : isAudioEnabled 
                            ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 shadow-lg shadow-green-500/20' 
                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 shadow-lg shadow-red-500/20'
                      }`}
                      data-testid="button-toggle-audio"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      {!mediaAccessStatus.hasAudio ? (
                        <MicOff className="relative h-4 w-4 sm:h-6 sm:w-6" />
                      ) : isAudioEnabled ? (
                        <Mic className="relative h-4 w-4 sm:h-6 sm:w-6" />
                      ) : (
                        <MicOff className="relative h-4 w-4 sm:h-6 sm:w-6" />
                      )}
                    </Button>
                    
                    {/* Video Toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleVideo}
                      disabled={!mediaAccessStatus.hasVideo}
                      className={`group relative w-10 h-10 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 ${
                        !mediaAccessStatus.hasVideo
                          ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                          : isVideoEnabled 
                            ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/20' 
                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 shadow-lg shadow-red-500/20'
                      }`}
                      data-testid="button-toggle-video"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      {!mediaAccessStatus.hasVideo ? (
                        <VideoOff className="relative h-4 w-4 sm:h-6 sm:w-6" />
                      ) : isVideoEnabled ? (
                        <Video className="relative h-4 w-4 sm:h-6 sm:w-6" />
                      ) : (
                        <VideoOff className="relative h-4 w-4 sm:h-6 sm:w-6" />
                      )}
                    </Button>
                    
                    {/* Gender Selector */}
                    <QuickGenderSelector
                      currentGender={userGender}
                      onGenderChange={handleGenderChange}
                      disabled={connectionStatus === 'ended'}
                    />
                    
                    {/* End Call */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleEndCall}
                      className="group relative w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-2xl shadow-red-500/50 transform hover:scale-110 transition-all duration-300"
                      data-testid="button-end-call"
                    >
                      <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <Phone className="relative h-5 w-5 sm:h-7 sm:w-7 rotate-[135deg]" />
                    </Button>
                    
                    {/* Fullscreen */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFullscreen}
                      className="group relative w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 shadow-lg shadow-purple-500/20 transition-all duration-300 hover:scale-110 hidden sm:flex"
                      data-testid="button-fullscreen"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <Maximize className="relative h-4 w-4 sm:h-6 sm:w-6" />
                    </Button>
                    
                    {/* Next Stranger */}
                    <Button
                      onClick={handleNextStranger}
                      disabled={connectionStatus !== 'connected'}
                      className="group relative px-4 h-10 sm:px-6 sm:h-14 rounded-full bg-gradient-to-r from-primary via-secondary to-accent hover:shadow-2xl hover:shadow-primary/30 text-white font-semibold transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm border border-white/20"
                      data-testid="button-next-video"
                    >
                      <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="relative hidden sm:inline mr-2">Next</span>
                      <SkipForward className="relative h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    
                    {/* Control Bar Hide Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={hideControlBar}
                      className="group relative w-10 h-10 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 shadow-lg shadow-yellow-500/20"
                      data-testid="button-hide-controls"
                      title="Hide control bar"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <ChevronDown className="relative h-4 w-4 sm:h-6 sm:w-6" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

        {/* Right Side - Full Chat on Mobile, Split Layout on Desktop */}
        <div className="w-full lg:w-[500px] h-1/2 lg:h-full border-t lg:border-t-0 lg:border-l border-border/50 lg:order-2 flex flex-col min-h-0">
          {/* Local Video Section - Desktop Only (Upper Right) */}
          <div className="hidden lg:block lg:h-1/2 relative bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-900 dark:to-slate-800 border-b border-border/50">
            {localStream ? (
              <>
                <video
                  ref={localVideoDesktopRef}
                  autoPlay
                  playsInline
                  muted={true}
                  controls={false}
                  className="w-full h-full object-cover"
                  data-testid="local-video-desktop"
                  style={{ 
                    backgroundColor: '#000',
                    transform: 'scaleX(-1)',
                    imageRendering: 'auto',
                    willChange: 'transform'
                  }}
                />
                {/* Local video indicator - Glassmorphism */}
                <div className="absolute top-4 left-4 px-4 py-2 bg-gradient-to-r from-primary/90 to-secondary/90 backdrop-blur-md rounded-lg text-sm text-white font-semibold border border-white/20 shadow-lg">
                  Your Camera
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <VideoOff className="h-10 w-10 text-slate-700 dark:text-white/60" />
                  </div>
                  <p className="text-slate-600 dark:text-white/70 text-sm">Camera Off</p>
                </div>
              </div>
            )}
          </div>

          {/* Text Chat Section */}
          <div className="h-full lg:h-1/2 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl flex flex-col min-h-0">
            {/* Chat Header - Modern Design */}
            <div className="flex-shrink-0 p-4 lg:p-3 border-b border-border/50 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 backdrop-blur-sm">
              <div className="flex items-center gap-3 lg:gap-2">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-full blur-md opacity-50"></div>
                  <div className="relative w-12 h-12 lg:w-10 lg:h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-lg">
                    <Send className="h-6 w-6 lg:h-5 lg:w-5 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg lg:text-base">Stranger</h3>
                  <p className="text-sm lg:text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`} />
                    {connectionStatus === 'connected' ? 'online' : 'offline'}
                  </p>
                </div>
                {/* Shared Interests Badge */}
                {sharedInterests.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 lg:px-2 lg:py-1 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full border border-primary/20">
                    <Heart className="h-3.5 w-3.5 lg:h-3 lg:w-3 text-primary" />
                    <span className="text-xs text-primary font-semibold">
                      {sharedInterests.length}
                    </span>
                  </div>
                )}
              </div>
              {sharedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 lg:gap-1 mt-3 lg:mt-2">
                  {sharedInterests.slice(0, 3).map((interest) => (
                    <span key={interest} className="px-2 py-1 lg:py-0.5 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">
                      #{interest}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Messages - Modern Style */}
            <div className="flex-1 min-h-0 p-4 lg:p-3 overflow-y-auto bg-gradient-to-b from-background/30 to-background/50 custom-scrollbar">
              {textMessages.length === 0 ? (
                <div className="text-center py-8 lg:py-4 h-full flex flex-col items-center justify-center">
                  <div className="relative mb-4 lg:mb-3">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/30 blur-xl rounded-full"></div>
                    <div className="relative w-16 h-16 lg:w-12 lg:h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-xl">
                      <Send className="h-8 w-8 lg:h-6 lg:w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm lg:text-xs text-muted-foreground px-4">
                    {connectionStatus === 'connected' 
                      ? 'Start chatting with your match!' 
                      : 'Connect to start chatting'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {textMessages.map((message, index) => (
                    <div key={message.id} className="animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
                      <EnhancedMessage
                        message={message}
                      />
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input - WhatsApp Style */}
            <div className="flex-shrink-0">
              <EnhancedMessageInput
                value={textMessage}
                onChange={setTextMessage}
                onSend={handleSendTextMessage}
                disabled={connectionStatus !== 'connected'}
                placeholder={connectionStatus === 'connected' ? "Type a message..." : "Connect to chat..."}
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
