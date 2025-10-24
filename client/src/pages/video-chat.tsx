import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { useWebRTC } from '@/hooks/use-webrtc';
import { 
  Phone, Maximize, Mic, MicOff, Video, VideoOff, 
  SkipForward, Send, Heart, AlertCircle, ChevronDown, 
  Wifi, WifiOff, RefreshCw, CheckCircle, XCircle, Pin, PinOff
} from 'lucide-react';
import { QuickGenderSelector } from '@/components/quick-gender-selector';
import EnhancedMessageInput from '@/components/enhanced-message-input';
import EnhancedMessage from '@/components/enhanced-message';
import StableCamera from '@/components/stable-camera';
import type { ChatSession, Message, Attachment } from '@/types/chat';

// Enhanced error types for video chat
interface VideoChatError {
  id: string;
  type: 'connection' | 'media' | 'webrtc' | 'websocket' | 'permission';
  message: string;
  timestamp: Date;
  recoverable: boolean;
  retryCount?: number;
}

interface ConnectionDiagnostics {
  websocket: {
    connected: boolean;
    quality: 'good' | 'poor' | 'unknown';
    type: 'websocket' | 'polling';
    reconnectAttempts: number;
    lastHeartbeat: Date | null;
  };
  webrtc: {
    connectionState: RTCPeerConnectionState;
    iceConnectionState: RTCIceConnectionState;
    quality: 'good' | 'poor' | 'unknown';
    hasLocalStream: boolean;
    hasRemoteStream: boolean;
  };
  media: {
    hasVideo: boolean;
    hasAudio: boolean;
    permissions: {
      camera: 'unknown' | 'granted' | 'denied' | 'prompt';
      microphone: 'unknown' | 'granted' | 'denied' | 'prompt';
    };
  };
}

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
  
  // Enhanced error and diagnostics state
  const [errors, setErrors] = useState<VideoChatError[]>([]);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [lastErrorTime, setLastErrorTime] = useState<Date | null>(null);
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(true);
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);
  
  // Advanced features state
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [connectionDiagnostics, setConnectionDiagnostics] = useState<any>(null);
  const [componentMounted, setComponentMounted] = useState(false);

  // Component mount effect - prevent multiple initializations
  useEffect(() => {
    if (!componentMounted) {
      setComponentMounted(true);
    }
    
    return () => {
      setComponentMounted(false);
    };
  }, []); // Empty dependency array to prevent re-runs
  
  // Control bar visibility state
  const [isControlBarVisible, setIsControlBarVisible] = useState(true);
  const [isControlBarPinned, setIsControlBarPinned] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Video refs for direct video element access (if needed)
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoDesktopRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Enhanced error tracking and recovery refs
  const errorRecoveryTimeoutRef = useRef<NodeJS.Timeout>();
  const diagnosticsIntervalRef = useRef<NodeJS.Timeout>();
  const lastDiagnosticsUpdate = useRef<Date>(new Date());
  const connectionStabilityTimeoutRef = useRef<NodeJS.Timeout>();
  // Video play timeouts are now handled by StableCamera component
  const mediaRecoveryAttempts = useRef(0);
  const maxMediaRecoveryAttempts = 3;
  
  const { 
    isConnected, 
    userId, 
    reconnectAttempts, 
    connectionQuality: wsConnectionQuality,
    connectionType,
    lastHeartbeat,
    connectionError: wsConnectionError,
    isConnecting: wsIsConnecting,
    connectionMetrics,
    sendMessage, 
    onMessage, 
    offMessage,
    getConnectionDiagnostics
  } = useWebSocket();

  // Enhanced error management utilities with reduced logging
  const addError = useCallback((error: Omit<VideoChatError, 'id' | 'timestamp'>) => {
    const newError: VideoChatError = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
      ...error
    };
    
    setErrors(prev => [newError, ...prev.slice(0, 9)]); // Keep only last 10 errors
    setLastErrorTime(new Date());
    
    // Use optimized logger with rate limiting
    if (process.env.NODE_ENV === 'development') {
      logger.videoChatError(error.type, newError.message, newError);
    }
    
    // Auto-recovery for recoverable errors
    if (error.recoverable && autoRecoveryEnabled) {
      // Schedule recovery directly here to avoid dependency issues
      setTimeout(() => {
        if (errorRecoveryTimeoutRef.current) {
          clearTimeout(errorRecoveryTimeoutRef.current);
        }
        
        errorRecoveryTimeoutRef.current = setTimeout(() => {
        }, 5000);
      }, 100);
    }
  }, [autoRecoveryEnabled]);
  
  const clearError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  const {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    iceConnectionState,
    connectionQuality: webrtcConnectionQuality,
    permissions,
    permissionError: webrtcPermissionError,
    connectionStats,
    retryCount: webrtcRetryCount,
    lastError: webrtcLastError,
    isReconnecting: webrtcIsReconnecting,
    negotiationNeeded,
    startLocalStream,
    toggleVideo,
    toggleAudio,
    endCall,
    createOffer,
    createAnswer,
    handleAnswer,
    addIceCandidate,
    sendIceCandidate,
    checkPermissions,
    requestPermissions,
    peerConnection
  } = useWebRTC(useCallback((stream: MediaStream) => {
    // Remote stream callback - now handled by StableCamera component
    logger.videoChatInfo('webrtc', 'Remote stream received');
  }, [addError]), {
    enableAdaptiveBitrate: true,
    enableNetworkAdaptation: true,
    enableAutomaticRecovery: true,
    maxRetryAttempts: 5,
    connectionTimeout: 30000,
    iceGatheringTimeout: 15000,
    offerAnswerTimeout: 10000
  });
  
  const attemptRecovery = useCallback(async (error: VideoChatError) => {
    try {
      logger.videoChatInfo('recovery', `Attempting recovery for error: ${error.type}`);
      
      switch (error.type) {
        case 'media':
          await recoverMediaAccess();
          break;
        case 'webrtc':
          await recoverWebRTC();
          break;
        case 'connection':
          await recoverConnection();
          break;
        case 'permission':
          await recoverPermissions();
          break;
        default:
          logger.videoChatWarn('recovery', `Unknown error type for recovery: ${error.type}`);
      }
      
      // Clear the error on successful recovery
      clearError(error.id);
    } catch (recoveryError) {
      logger.videoChatError('recovery', 'Recovery failed', recoveryError);
      
      // Increment retry count
      setErrors(prev => prev.map(e => 
        e.id === error.id 
          ? { ...e, retryCount: (e.retryCount || 0) + 1 }
          : e
      ));
      
      // Don't retry if max attempts reached
      if ((error.retryCount || 0) < 3) {
        setTimeout(() => attemptRecovery(error), 5000);
      }
    } finally {
      setIsRecovering(false);
    }
  }, [clearError]);
  
  // Recovery functions
  const recoverMediaAccess = useCallback(async () => {
    if (mediaRecoveryAttempts.current >= maxMediaRecoveryAttempts) {
      throw new Error('Max media recovery attempts reached');
    }
    
    mediaRecoveryAttempts.current++;
    
    try {
      await startLocalStream(true, true);
      setMediaAccessStatus({
        hasVideo: true,
        hasAudio: true,
        error: null
      });
      mediaRecoveryAttempts.current = 0; // Reset on success
    } catch (error) {
      throw error;
    }
  }, [startLocalStream]);
  
  const recoverWebRTC = useCallback(async () => {
    try {
      // Don't stop the local stream during recovery
      // Just try to re-establish the peer connection
      if (peerConnection && localStream) {
        // The peer connection will handle its own recovery
        // We just need to make sure the local stream stays active
      } else {
        // Only log in development mode to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.warn('No peer connection or local stream to recover');
        }
      }
    } catch (error) {
      // Only log critical errors to reduce Railway rate limits
      if (process.env.NODE_ENV === 'development') {
        console.error('WebRTC recovery failed:', error);
      }
    }
  }, [peerConnection, localStream]);
  
  const recoverConnection = useCallback(async () => {
    // Connection recovery is handled by the WebSocket hook
  }, []);
  
  const recoverPermissions = useCallback(async () => {
    try {
      await requestPermissions(true, true);
      await startLocalStream(true, true);
      setMediaAccessStatus({
        hasVideo: true,
        hasAudio: true,
        error: null
      });
    } catch (error) {
      throw error;
    }
  }, [requestPermissions, startLocalStream]);
  
  // Enhanced diagnostics update
  const updateDiagnostics = useCallback(() => {
    const now = new Date();
    const newDiagnostics: ConnectionDiagnostics = {
      websocket: {
        connected: isConnected,
        quality: wsConnectionQuality,
        type: connectionType,
        reconnectAttempts,
        lastHeartbeat
      },
      webrtc: {
        connectionState,
        iceConnectionState,
        quality: webrtcConnectionQuality,
        hasLocalStream: !!localStream,
        hasRemoteStream: !!remoteStream
      },
      media: {
        hasVideo: mediaAccessStatus.hasVideo,
        hasAudio: mediaAccessStatus.hasAudio,
        permissions
      }
    };
    
    setDiagnostics(newDiagnostics);
    lastDiagnosticsUpdate.current = now;
  }, [
    isConnected, wsConnectionQuality, connectionType, reconnectAttempts, lastHeartbeat,
    connectionState, iceConnectionState, webrtcConnectionQuality, localStream, remoteStream,
    mediaAccessStatus, permissions
  ]);

  // Initialize media access gracefully with enhanced error handling
  useEffect(() => {
    let isMounted = true;
    let initializationAttempted = false;
    
    const initializeMedia = async () => {
      if (initializationAttempted || !isMounted) {
        return;
      }
      
      initializationAttempted = true;
      
      try {
        // Try to start with both video and audio
        await startLocalStream(true, true);
        
        if (isMounted) {
          setMediaAccessStatus({
            hasVideo: true,
            hasAudio: true,
            error: null
          });
        }
      } catch (error) {
        if (!isMounted) return;
        
        addError({
          type: 'media',
          message: `Full media access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recoverable: true
        });
        
        // Try with audio only
        try {
          await startLocalStream(false, true);
          
          if (isMounted) {
            setMediaAccessStatus({
              hasVideo: false,
              hasAudio: true,
              error: 'Video access denied, audio only mode'
            });
          }
        } catch (audioError) {
          if (!isMounted) return;
          
          // Try with video only
          try {
            await startLocalStream(true, false);
            
            if (isMounted) {
              setMediaAccessStatus({
                hasVideo: true,
                hasAudio: false,
                error: 'Audio access denied, video only mode'
              });
            }
          } catch (videoError) {
            if (!isMounted) return;
            
            // Continue without any media
            setMediaAccessStatus({
              hasVideo: false,
              hasAudio: false,
              error: 'Camera and microphone access denied. Chat will work in text-only mode.'
            });
            
            addError({
              type: 'permission',
              message: 'Camera and microphone access denied. Please allow access in your browser settings.',
              recoverable: true
            });
          }
        }
      }
    };

    if (isMounted && !initializationAttempted && componentMounted) {
      initializeMedia();
    }

    return () => {
      isMounted = false;
      initializationAttempted = false;
      
      // Clear recovery timeout
      if (errorRecoveryTimeoutRef.current) {
        clearTimeout(errorRecoveryTimeoutRef.current);
      }
      
      // Clear session storage
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      
      // Clean up WebRTC safely
      try {
        endCall();
      } catch (error) {
        console.warn('⚠️ Error during unmount cleanup:', error);
      }
    };
  }, [componentMounted]); // Add componentMounted dependency

  // Local video stream handling is now managed by StableCamera component
  // No need for direct video element manipulation

  // Remote video stream handling is now managed by StableCamera component
  // No need for direct video element manipulation

  // Video stream health monitoring is now handled by StableCamera component

  // Enhanced diagnostics monitoring
  useEffect(() => {
    // Update diagnostics every 5 seconds
    diagnosticsIntervalRef.current = setInterval(() => {
      updateDiagnostics();
    }, 5000);
    
    // Initial diagnostics update
    updateDiagnostics();
    
    return () => {
      if (diagnosticsIntervalRef.current) {
        clearInterval(diagnosticsIntervalRef.current);
      }
    };
  }, [updateDiagnostics]);
  
  // Enhanced error monitoring from hooks
  useEffect(() => {
    // Monitor WebSocket errors
    if (wsConnectionError) {
      addError({
        type: 'connection',
        message: `WebSocket error: ${wsConnectionError.message}`,
        recoverable: wsConnectionError.recoverable !== false
      });
    }
    
    // Monitor WebRTC errors
    if (webrtcLastError) {
      addError({
        type: 'webrtc',
        message: `WebRTC error: ${webrtcLastError.message}`,
        recoverable: webrtcLastError.recoverable !== false
      });
    }
    
    // Monitor permission errors
    if (webrtcPermissionError) {
      addError({
        type: 'permission',
        message: webrtcPermissionError,
        recoverable: true
      });
    }
  }, [wsConnectionError, webrtcLastError, webrtcPermissionError, addError]);

  // Monitor WebRTC connection states for debugging
  useEffect(() => {
    
    // Handle peer connection failures
    if (connectionState === 'failed' && session && isConnected && !recoveryInProgress) {
      setRecoveryInProgress(true);
      
      // Wait a bit before attempting recovery
      setTimeout(async () => {
        try {
          
          // Reinitialize peer connection
          if (peerConnection) {
            // The peer connection will be reinitialized by the hook
          }
          
          // If we have a session, try to re-establish the connection
          if (session && sendMessage) {
            sendMessage({
              type: 'webrtc_recovery',
              sessionId: session.id,
            });
          }
        } catch (error) {
          console.error('❌ Recovery attempt failed:', error);
        } finally {
          // Reset recovery flag after a delay
          setTimeout(() => {
            setRecoveryInProgress(false);
          }, 5000);
        }
      }, 2000);
    }
    
    // If we have a good connection but no remote stream, log it for debugging
    if (connectionState === 'connected' && iceConnectionState === 'connected' && !remoteStream) {
      console.warn('⚠️ Connection established but no remote stream received');
    }
    
    // If we have a remote stream, log its details
    if (remoteStream) {
    }
  }, [connectionState, iceConnectionState, remoteStream, localStream, webrtcConnectionQuality, session, connectionStatus, isConnected, peerConnection, sendMessage, recoveryInProgress, setRecoveryInProgress]); // Add all dependencies

  // Advanced connection diagnostics monitoring
  useEffect(() => {
    if (getConnectionDiagnostics) {
      const diagnostics = getConnectionDiagnostics();
      setConnectionDiagnostics(diagnostics);
    }
  }, [connectionState, iceConnectionState]); // Remove getConnectionDiagnostics dependency
  
  // Connection stability monitoring
  useEffect(() => {
    if (isConnected && session) {
      // Clear any existing stability timeout
      if (connectionStabilityTimeoutRef.current) {
        clearTimeout(connectionStabilityTimeoutRef.current);
      }
      
      // Set timeout to check connection stability
      connectionStabilityTimeoutRef.current = setTimeout(() => {
        if (!isConnected || !session) {
          addError({
            type: 'connection',
            message: 'Connection lost during active session',
            recoverable: true
          });
        }
      }, 30000); // Check every 30 seconds
    }
    
    return () => {
      if (connectionStabilityTimeoutRef.current) {
        clearTimeout(connectionStabilityTimeoutRef.current);
      }
    };
  }, [isConnected, session, addError]);

  // Initialize video chat - optimized flow
  useEffect(() => {
    if (!isConnected || !userId) {
      console.log('⏳ Waiting for WebSocket connection and userId...');
      return;
    }

    // Prevent multiple initializations
    if (session) {
      console.log('✅ Session already exists, skipping initialization');
      return;
    }

    console.log('🚀 Starting video chat initialization...');

    // Try to recover existing session first
    const savedSessionId = sessionStorage.getItem('currentSessionId');
    const savedSessionType = sessionStorage.getItem('currentSessionType');
    
    if (savedSessionId && savedSessionType === 'video') {
      console.log('🔄 Attempting session recovery...');
      sendMessage({
        type: 'get_session_recovery',
        sessionId: savedSessionId,
      });
    } else {
      // Start finding match immediately (before camera initialization)
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
      const findMatchMessage = {
        type: 'find_match',
        chatType: 'video',
        interests,
        gender,
      };
      
      console.log('🔍 Looking for video chat match...', { interests, gender });
      sendMessage(findMatchMessage);
    }

    // Initialize camera and WebRTC in parallel (non-blocking)
    const initializeWebRTC = async () => {
      try {
        console.log('🎥 Initializing camera and WebRTC...');
        
        // Start local stream first
        await startLocalStream(true, true);
        
        // Wait for peer connection to be properly initialized
        let attempts = 0;
        const maxAttempts = 150; // 15 seconds total - increased timeout
        while (!peerConnection && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!peerConnection) {
          console.warn('⚠️ Peer connection not initialized after timeout, will retry when match is found');
          addError({
            type: 'webrtc',
            message: 'Peer connection initialization timeout',
            recoverable: true
          });
          return;
        }
        
        // Verify peer connection is in a valid state
        if (peerConnection.signalingState === 'closed') {
          console.warn('⚠️ Peer connection is closed, reinitializing...');
          try {
            await startLocalStream(true, true);
          } catch (error) {
            console.error('❌ Failed to reinitialize peer connection:', error);
            addError({
              type: 'webrtc',
              message: 'Failed to reinitialize peer connection',
              recoverable: true
            });
            return;
          }
        }
        
        console.log('✅ Camera and WebRTC initialized successfully');
        
        // Ensure the peer connection is ready for use
        if (peerConnection.signalingState === 'closed') {
          console.warn('⚠️ Peer connection is closed, reinitializing...');
          // Force reinitialization
          await startLocalStream(true, true);
        }
        
      } catch (error) {
        console.error('❌ Failed to initialize camera/WebRTC:', error);
        addError({
          type: 'webrtc',
          message: `Failed to initialize camera: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recoverable: true
        });
      }
    };

    // Initialize WebRTC in background (non-blocking)
    initializeWebRTC();
  }, [isConnected, userId, sendMessage, session, userGender, addError, startLocalStream, peerConnection]);

  // Stable message handlers using useCallback
  const handleWaitingForMatch = useCallback(() => {
      console.log('⏳ Waiting for match...');
      setConnectionStatus('waiting');
  }, []);

  const handleMatchFound = useCallback(async (data: any) => {
    // Prevent duplicate match handling with enhanced checks
    if (session && session.id === data.sessionId) {
      console.log('⚠️ Duplicate match_found event ignored');
      return;
    }
    
    // Prevent handling if already processing a match
    if (connectionStatus === 'connected' && session) {
      console.log('⚠️ Already connected, ignoring new match');
      return;
    }

    try {
      console.log('🎉 Match found!', data);
      
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

      // Ensure WebRTC peer connection is ready with proper initialization
      if (!peerConnection || !localStream) {
        console.log('🔧 Peer connection not ready, initializing...');
        try {
          // Ensure local stream is started first
          if (!localStream) {
            console.log('🎥 Starting local stream for match...');
            await startLocalStream(true, true);
          }
          
          // Wait for peer connection to be properly initialized with longer timeout
          let attempts = 0;
          const maxAttempts = 150; // 15 seconds total - increased timeout
          while (!peerConnection && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          if (!peerConnection) {
            console.error('❌ Peer connection not initialized after extended timeout');
            addError({
              type: 'webrtc',
              message: 'Peer connection not initialized after extended timeout',
              recoverable: true
            });
            return;
          }
          
          // Verify peer connection is in a valid state
          if (peerConnection.signalingState === 'closed') {
            console.log('🔄 Peer connection is closed, reinitializing...');
            try {
              await startLocalStream(true, true);
            } catch (error) {
              console.error('❌ Failed to reinitialize peer connection:', error);
              addError({
                type: 'webrtc',
                message: 'Failed to reinitialize peer connection',
                recoverable: true
              });
              return;
            }
            
            // Wait again for reinitialization
            attempts = 0;
            while (!peerConnection && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
            
            if (!peerConnection) {
              console.error('❌ Peer connection reinitialization failed');
              addError({
                type: 'webrtc',
                message: 'Peer connection reinitialization failed',
                recoverable: true
              });
              return;
            }
          }
          
          console.log('✅ Peer connection initialized successfully for match');
        } catch (error) {
          console.error('❌ Failed to initialize WebRTC:', error);
          addError({
            type: 'webrtc',
            message: `Failed to initialize WebRTC: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recoverable: true
          });
          return;
        }
      }

      // Double-check peer connection is ready
      if (!peerConnection) {
        console.error('❌ Peer connection still not ready after initialization');
        addError({
          type: 'webrtc',
          message: 'Peer connection not ready after initialization',
          recoverable: true
        });
        return;
      }

      // Ensure the peer connection is ready before creating offer
      if (peerConnection.signalingState === 'closed') {
        console.log('⚠️ Peer connection is closed, cannot create offer');
        addError({
          type: 'webrtc',
          message: 'Peer connection is closed, cannot create offer',
          recoverable: true
        });
        return;
      }
      
      // Wait a moment for the connection to be ready
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create WebRTC offer
      if (createOffer && sendMessage) {
        try {
          console.log('📤 Creating WebRTC offer...');
          
          // Add a small delay to ensure everything is ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const offer = await createOffer();
          if (offer) {
            sendMessage({
              type: 'webrtc_offer',
              sessionId: data.sessionId,
              offer,
            });
            console.log('✅ WebRTC offer sent successfully');
          } else {
            console.error('❌ createOffer returned null');
            addError({
              type: 'webrtc',
              message: 'Failed to create offer - returned null',
              recoverable: true
            });
          }
        } catch (error) {
          console.error('❌ Failed to create WebRTC offer:', error);
          addError({
            type: 'webrtc',
            message: `Failed to create WebRTC offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recoverable: true
          });
        }
      } else {
        console.error('Missing createOffer function or sendMessage function');
        addError({
          type: 'webrtc',
          message: 'Missing required functions for WebRTC offer creation',
          recoverable: true
        });
      }
    } catch (error) {
      // Only log critical errors to reduce Railway rate limits
      if (process.env.NODE_ENV === 'development') {
        console.error('Error in handleMatchFound:', error);
      }
      addError({
        type: 'connection',
        message: `Match found but failed to establish session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true
      });
    }
  }, [peerConnection, localStream, createOffer, sendMessage, addError, startLocalStream, session, userId]);

  const handleWebRTCOffer = useCallback(async (data: any) => {
    // Prevent self-connection by validating sender ID
    if (data.senderId === userId) {
      console.warn('Prevented self-connection: received WebRTC offer from self');
      return;
    }

    // Validate session ID matches current session
    if (session && session.id !== data.sessionId) {
      console.warn(`Session ID mismatch: received offer for ${data.sessionId}, current session is ${session.id}`);
      return;
    }

    // Ensure peer connection is ready before handling offer
    if (!peerConnection) {
      try {
        await startLocalStream(true, true);
      } catch (error) {
        console.error('❌ Failed to initialize peer connection for offer:', error);
        addError({
          type: 'webrtc',
          message: 'Failed to initialize peer connection for WebRTC offer',
          recoverable: true
        });
        return;
      }
    }

    const pc = peerConnection;
    if (!pc || !createAnswer || !sendMessage || !data?.offer) {
      addError({
        type: 'webrtc',
        message: 'Cannot handle WebRTC offer: missing peer connection, functions, or offer data',
        recoverable: true
      });
      return;
    }
    
    try {
      let answerCreated = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!answerCreated && attempts < maxAttempts) {
        try {
          attempts++;
          
          const answer = await createAnswer(data.offer);
          if (answer) {
            sendMessage({
              type: 'webrtc_answer',
              sessionId: data.sessionId,
              answer,
            });
            answerCreated = true;
          } else {
            throw new Error('Failed to create answer - returned null');
          }
        } catch (error) {
          // Only log in development mode to reduce Railway rate limits
          if (process.env.NODE_ENV === 'development') {
            console.error(`Failed to create answer (attempt ${attempts}):`, error);
          }
          
          if (attempts >= maxAttempts) {
            addError({
              type: 'webrtc',
              message: `Failed to create WebRTC answer after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
              recoverable: true
            });
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
    } catch (error) {
      // Only log critical errors to reduce Railway rate limits
      if (process.env.NODE_ENV === 'development') {
        console.error('Error in handleWebRTCOffer:', error);
      }
      addError({
        type: 'webrtc',
        message: `WebRTC offer handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true
      });
    }
  }, [peerConnection, createAnswer, sendMessage, addError]);

  const handleWebRTCAnswer = useCallback(async (data: any) => {
    // Prevent self-connection by validating sender ID
    if (data.senderId === userId) {
      console.warn('Prevented self-connection: received WebRTC answer from self');
      return;
    }

    // Validate session ID matches current session
    if (session && session.id !== data.sessionId) {
      console.warn(`Session ID mismatch: received answer for ${data.sessionId}, current session is ${session.id}`);
      return;
    }

    if (!handleAnswer || !data?.answer) {
      addError({
        type: 'webrtc',
        message: 'Cannot handle WebRTC answer: missing handleAnswer function or answer data',
        recoverable: true
      });
      return;
    }
    
    try {
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          
        await handleAnswer(data.answer);
          break; // Success, exit retry loop
          
      } catch (error) {
          // Only log in development mode to reduce Railway rate limits
          if (process.env.NODE_ENV === 'development') {
            console.error(`Failed to handle answer (attempt ${attempts}):`, error);
          }
          
          if (attempts >= maxAttempts) {
            addError({
              type: 'webrtc',
              message: `Failed to handle WebRTC answer after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
              recoverable: true
            });
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
    } catch (error) {
      // Only log critical errors to reduce Railway rate limits
      if (process.env.NODE_ENV === 'development') {
        console.error('Error in handleWebRTCAnswer:', error);
      }
      addError({
        type: 'webrtc',
        message: `WebRTC answer handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true
      });
    }
  }, [handleAnswer, addError]);

  const handleIceCandidate = useCallback(async (data: any) => {
    // Prevent self-connection by validating sender ID
    if (data.senderId === userId) {
      console.warn('Prevented self-connection: received ICE candidate from self');
      return;
    }

    // Validate session ID matches current session
    if (session && session.id !== data.sessionId) {
      console.warn(`Session ID mismatch: received ICE candidate for ${data.sessionId}, current session is ${session.id}`);
      return;
    }

    // Ensure peer connection is ready before handling ICE candidate
    if (!peerConnection) {
      try {
        await startLocalStream(true, true);
      } catch (error) {
        console.error('❌ Failed to initialize peer connection for ICE candidate:', error);
        return;
      }
    }

    if (!addIceCandidate || !data?.candidate) {
      console.warn('Cannot handle ICE candidate: missing addIceCandidate function or candidate data');
      return;
    }
    
    try {
      await addIceCandidate(data.candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
        // ICE candidate errors are usually not critical, but log them for debugging
        if (error instanceof Error && !error.message.includes('duplicate')) {
          addError({
            type: 'webrtc',
            message: `ICE candidate error: ${error.message}`,
            recoverable: true
          });
        }
      }
  }, [addIceCandidate, addError, peerConnection, startLocalStream]);

  // Handle sending ICE candidates when they are generated
  useEffect(() => {
    if (peerConnection && session?.id && sendMessage && sendIceCandidate) {
      const pc = peerConnection;
      
      if (pc && typeof pc === 'object' && 'onicecandidate' in pc) {
        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
          if (event && event.candidate && sendMessage && sendIceCandidate) {
            sendIceCandidate(event.candidate, sendMessage, session.id);
          }
        };
      }
      
      // Cleanup function to remove the event listener
      return () => {
        if (pc && typeof pc === 'object' && 'onicecandidate' in pc) {
          pc.onicecandidate = null;
        }
      };
    }
  }, [session?.id, sendIceCandidate, sendMessage, peerConnection]);

  // Update media access status based on local stream
  useEffect(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      
      setMediaAccessStatus({
        hasVideo: videoTracks.length > 0,
        hasAudio: audioTracks.length > 0,
        error: null
      });
      
      // Ensure video tracks are enabled
      videoTracks.forEach((track) => {
        if (!track.enabled) {
          track.enabled = true;
        }
      });
      
      // Ensure audio tracks are enabled
      audioTracks.forEach((track) => {
        if (!track.enabled) {
          track.enabled = true;
        }
      });
    }
  }, [localStream]);

  // Periodic video stream health check
  useEffect(() => {
    if (!localStream) return;
    
    const healthCheckInterval = setInterval(() => {
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        
        // Check if video tracks are still active
        videoTracks.forEach((track) => {
          if (track.readyState === 'ended') {
            console.warn('⚠️ Video track has ended, attempting to restart...');
            // The track has ended, we need to restart the stream
            startLocalStream(true, true).catch(error => {
              console.error('Failed to restart local stream:', error);
            });
          } else if (!track.enabled) {
            track.enabled = true;
          }
        });
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(healthCheckInterval);
  }, [localStream, startLocalStream]);

  // WebRTC connection states monitoring (silent)

  // WebSocket message handlers - stable references
  useEffect(() => {
    if (!isConnected) {
      console.log('🔌 WebSocket not connected, skipping message handler registration');
      return;
    }

    console.log('📡 Registering WebSocket message handlers...');

    // Register main message handlers first
    if (onMessage) {
      onMessage('waiting_for_match', handleWaitingForMatch);
      onMessage('match_found', handleMatchFound);
      onMessage('webrtc_offer', handleWebRTCOffer);
      onMessage('webrtc_answer', handleWebRTCAnswer);
      onMessage('webrtc_ice_candidate', handleIceCandidate);
      console.log('✅ Main WebSocket handlers registered');
    }

    // Register additional message handlers
    if (onMessage) {
      onMessage('chat_ended', () => {
      setConnectionStatus('ended');
      setSession(null);
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      setTextMessages([]);
      endCall();
      });

      onMessage('session_recovered', (data: any) => {
      setSession({
        id: data.sessionId,
        partnerId: data.partnerId,
        type: 'video',
        status: 'connected',
      });
      setConnectionStatus('connected');
      const recoveryMsg: Message = {
        id: `recovery-${Date.now()}`,
        content: '✅ Session recovered! Reconnecting video...',
        senderId: 'system',
        timestamp: new Date(),
        isOwn: false,
      };
      setTextMessages([recoveryMsg]);
      });

      onMessage('session_recovery_failed', () => {
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('currentSessionType');
      const interests = JSON.parse(localStorage.getItem('interests') || '[]');
      const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
      sendMessage({
        type: 'find_match',
        chatType: 'video',
        interests,
        gender,
      });
      });

      onMessage('partner_reconnected', () => {
      const reconnectMsg: Message = {
        id: `reconnect-${Date.now()}`,
        content: '🔄 Your partner reconnected!',
        senderId: 'system',
        timestamp: new Date(),
        isOwn: false,
      };
      setTextMessages(prev => [...prev, reconnectMsg]);
      });

      onMessage('message_received', (data: any) => {
      
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
        setTextMessages(prev => [...prev, message]);
      } else {
      }
      });

      onMessage('message_sent', (data: any) => {
      
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
        setTextMessages(prev => [...prev, message]);
      } else {
      }
      });
      
      onMessage('message_delivered', (data: any) => {
        // Handle message delivery confirmation silently
      });

      onMessage('partner_typing', (data: any) => {
        // Handle typing indicator for video chat text messages
        // This could be used to show typing indicator in text chat area
        console.log('Partner typing:', data.isTyping);
      });
      
      onMessage('gender_updated', (data: any) => {
    });
    }

    return () => {
      if (offMessage) {
        // Clean up main handlers
      offMessage('waiting_for_match');
      offMessage('match_found');
      offMessage('webrtc_offer');
      offMessage('webrtc_answer');
      offMessage('webrtc_ice_candidate');
        
        // Clean up additional handlers
      offMessage('chat_ended');
      offMessage('session_recovered');
      offMessage('session_recovery_failed');
      offMessage('partner_reconnected');
        offMessage('message_received');
        offMessage('message_sent');
        offMessage('message_delivered');
        offMessage('partner_typing');
      offMessage('gender_updated');
      }
    };
  }, [
    isConnected, 
    onMessage, 
    offMessage, 
    handleWaitingForMatch,
    handleMatchFound,
    handleWebRTCOffer,
    handleWebRTCAnswer,
    handleIceCandidate,
    endCall, 
    userGender, 
    sendMessage, 
    userId
  ]); // Include all handler dependencies

  // ICE candidate handler removed - using the one above with sendIceCandidate function

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [textMessages]);

  // Auto-hide control bar functionality
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
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
      videoContainer.addEventListener('mousemove', handleMouseMove as EventListener);
      videoContainer.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (videoContainer) {
        videoContainer.removeEventListener('mousemove', handleMouseMove as EventListener);
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

  // Toggle pin state for control bar
  const togglePinControlBar = () => {
    if (isControlBarPinned) {
      // Currently pinned, so unpin and allow auto-hide
      setIsControlBarPinned(false);
      // Start auto-hide timer when unpinning
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setIsControlBarVisible(false);
      }, 3000);
    } else {
      // Currently unpinned, so pin and show
      setIsControlBarPinned(true);
      setIsControlBarVisible(true);
      // Clear any existing timeout when pinning
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    }
  };

  const handleEndCall = useCallback(() => {
    // Prevent multiple calls
    if (connectionStatus === 'ended') {
      return;
    }
    
    try {
      // Send end chat message if we have a session and connection
      if (session && isConnected && sendMessage) {
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
      
      // Reset session and connection status
      setSession(null);
      setConnectionStatus('ended');
      
      // Clean up WebRTC (don't preserve stream for end call)
      endCall(false);
      
      // Navigate to home page
      try {
        setLocation('/');
      } catch (navError) {
        console.warn('⚠️ Navigation error, using fallback:', navError);
        // Fallback to window location
        window.location.href = '/';
      }
      
    } catch (error) {
      console.error('❌ Error during call cleanup:', error);
      
      // Even if there's an error, try to navigate to home
      try {
        setLocation('/');
      } catch (navError) {
        console.error('❌ Navigation error:', navError);
        // Fallback to window location
        window.location.href = '/';
      }
    }
  }, [session, isConnected, sendMessage, endCall, setLocation, connectionStatus]);

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

  const handleNextStranger = useCallback(async () => {
    
    // End current call but preserve local stream to avoid camera reload
    if (connectionStatus === 'connected') {
      endCall(true); // Pass true to preserve local stream
    }
    
    // Clear any existing session storage
    sessionStorage.removeItem('currentSessionId');
    sessionStorage.removeItem('currentSessionType');
    
    const interests = JSON.parse(localStorage.getItem('interests') || '[]');
    const gender = userGender || localStorage.getItem('gender') as 'male' | 'female' | 'other' | null;
    
    // Clear messages when moving to next stranger (ephemeral chat)
    setTextMessages([]);
    
    // Reset connection status to waiting
    setConnectionStatus('waiting');
    
    // Reset session
    setSession(null);
    
    // CRITICAL: Ensure camera and WebRTC are still active
    if (!localStream) {
      try {
        await startLocalStream(true, true);
      } catch (error) {
        console.error('❌ Failed to reinitialize camera:', error);
        addError({
          type: 'webrtc',
          message: `Failed to reinitialize camera: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recoverable: true
        });
      }
    }
    
    if (session && isConnected) {
      // If we have an active session, end it and find a new match
      sendMessage({
        type: 'next_stranger',
        sessionId: session.id,
        chatType: 'video',
        gender,
        interests,
      });
      
      // Also send find_match after a delay
      setTimeout(() => {
        sendMessage({
          type: 'find_match',
          chatType: 'video',
          interests,
          gender,
        });
      }, 1000);
    } else {
      // If no active session, just start looking for a new match
      const findMatchMessage = {
        type: 'find_match',
        chatType: 'video',
        interests,
        gender,
      };
      
      // Add a longer delay to ensure proper cleanup
      setTimeout(() => {
        sendMessage(findMatchMessage);
      }, 1000);
    }
  }, [connectionStatus, session, isConnected, sendMessage, userGender, endCall, localStream, startLocalStream, addError]);

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
                <StableCamera
                  stream={remoteStream}
                  isLocal={false}
                  isVideoEnabled={true}
                  isAudioEnabled={true}
                  className="w-full h-full"
                  muted={false}
                  playsInline={true}
                  autoPlay={true}
                  controls={false}
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
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <p>Connection: {connectionState}</p>
                        <p>ICE: {iceConnectionState}</p>
                        <p>Quality: {webrtcConnectionQuality}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Local Video (Picture-in-Picture) - Mobile Only */}
                {localStream && (
                  <div className="lg:hidden absolute bottom-3 right-3 w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl backdrop-blur-sm bg-gradient-to-br from-black/40 to-black/20 group hover:scale-105 transition-transform duration-300">
                    <StableCamera
                      stream={localStream}
                      isLocal={true}
                      isVideoEnabled={isVideoEnabled}
                      isAudioEnabled={isAudioEnabled}
                      className="w-full h-full"
                      muted={true}
                      playsInline={true}
                      autoPlay={true}
                      controls={false}
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
                    
                    {/* Next Stranger - Always Available */}
                    <Button
                      onClick={handleNextStranger}
                      className="group relative px-4 h-10 sm:px-6 sm:h-14 rounded-full bg-gradient-to-r from-primary via-secondary to-accent hover:shadow-2xl hover:shadow-primary/30 text-white font-semibold transform hover:scale-105 transition-all duration-300 text-sm border border-white/20"
                      data-testid="button-next-video"
                    >
                      <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="relative hidden sm:inline mr-2">Next</span>
                      <SkipForward className="relative h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    
                    {/* Control Bar Pin/Unpin Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={togglePinControlBar}
                      className={`group relative w-10 h-10 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 ${
                        isControlBarPinned 
                          ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 shadow-lg shadow-green-500/20' 
                          : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 shadow-lg shadow-yellow-500/20'
                      }`}
                      data-testid="button-pin-controls"
                      title={isControlBarPinned ? "Unpin control bar" : "Pin control bar"}
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <ChevronDown className={`relative h-4 w-4 sm:h-6 sm:w-6 transition-transform duration-300 ${
                        isControlBarPinned ? 'rotate-180' : ''
                      }`} />
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
                <StableCamera
                  stream={localStream}
                  isLocal={true}
                  isVideoEnabled={isVideoEnabled}
                  isAudioEnabled={isAudioEnabled}
                  className="w-full h-full"
                  muted={true}
                  playsInline={true}
                  autoPlay={true}
                  controls={false}
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
