import { useCallback, useRef, useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

// Enhanced error types for better debugging
interface WebRTCError extends Error {
  code?: string;
  operation?: string;
  recoverable?: boolean;
}

interface ConnectionStats {
  rtt: number;
  packetsLost: number;
  packetsReceived: number;
  bytesReceived: number;
  bytesSent: number;
  frameRate: number;
  resolution: { width: number; height: number };
}

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface ConnectionHealth {
  isHealthy: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  bandwidth: number;
  latency: number;
  packetLoss: number;
  jitter: number;
  lastUpdate: Date;
}

interface AdvancedWebRTCOptions {
  enableAdaptiveBitrate: boolean;
  enableNetworkAdaptation: boolean;
  enableAutomaticRecovery: boolean;
  maxRetryAttempts: number;
  connectionTimeout: number;
  iceGatheringTimeout: number;
  offerAnswerTimeout: number;
}

interface PermissionState {
  camera: 'unknown' | 'granted' | 'denied' | 'prompt';
  microphone: 'unknown' | 'granted' | 'denied' | 'prompt';
}

export function useWebRTC(onRemoteStream?: (stream: MediaStream) => void, options?: Partial<AdvancedWebRTCOptions>) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: 'unknown',
    microphone: 'unknown'
  });
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<WebRTCError | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [negotiationNeeded, setNegotiationNeeded] = useState(false);
  
  // Advanced features
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    isHealthy: false,
    quality: 'poor',
    bandwidth: 0,
    latency: 0,
    packetLoss: 0,
    jitter: 0,
    lastUpdate: new Date()
  });
  const [isAdapting, setIsAdapting] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [maxRecoveryAttempts] = useState(options?.maxRetryAttempts || 5);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [peerConnectionState, setPeerConnectionState] = useState<RTCPeerConnection | null>(null);
  const streamUpdateTimeout = useRef<NodeJS.Timeout>();
  const connectionQualityInterval = useRef<NodeJS.Timeout>();
  const statsInterval = useRef<NodeJS.Timeout>();
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const isInitializing = useRef(false);
  const lastStreamId = useRef<string | null>(null);
  const connectionStateInitialized = useRef(false);
  const retryConfig = useRef<RetryConfig>({
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  });
  const negotiationTimeout = useRef<NodeJS.Timeout>();
  const iceGatheringTimeout = useRef<NodeJS.Timeout>();
  const healthCheckInterval = useRef<NodeJS.Timeout>();
  const adaptationTimeout = useRef<NodeJS.Timeout>();
  const connectionTimeout = useRef<NodeJS.Timeout>();
  const lastSuccessfulConnection = useRef<Date | null>(null);
  const connectionFailureCount = useRef(0);
  const adaptiveBitrateEnabled = useRef(options?.enableAdaptiveBitrate !== false);
  const networkAdaptationEnabled = useRef(options?.enableNetworkAdaptation !== false);
  const automaticRecoveryEnabled = useRef(options?.enableAutomaticRecovery !== false);

  // Check current permission states
  const checkPermissions = useCallback(async () => {
    try {
      if (!navigator.permissions) {
        // Fallback for browsers that don't support permissions API
        setPermissions({ camera: 'prompt', microphone: 'prompt' });
        return { camera: 'prompt', microphone: 'prompt' };
      }

      const [cameraPermission, micPermission] = await Promise.all([
        navigator.permissions.query({ name: 'camera' as PermissionName }),
        navigator.permissions.query({ name: 'microphone' as PermissionName })
      ]);

      const newPermissions: PermissionState = {
        camera: cameraPermission.state as 'unknown' | 'granted' | 'denied' | 'prompt',
        microphone: micPermission.state as 'unknown' | 'granted' | 'denied' | 'prompt'
      };
      
      setPermissions(newPermissions);
      return newPermissions;
    } catch (error) {
      console.warn('Could not check permissions:', error);
      const fallbackPermissions: PermissionState = { camera: 'prompt', microphone: 'prompt' };
      setPermissions(fallbackPermissions);
      return fallbackPermissions;
    }
  }, []);

  // Check if we have necessary permissions
  const hasPermissions = useCallback((video: boolean, audio: boolean) => {
    return (!video || permissions.camera === 'granted') && 
           (!audio || permissions.microphone === 'granted');
  }, [permissions]);

  // Request permissions explicitly - this will trigger browser permission dialog
  const requestPermissions = useCallback(async (video: boolean = true, audio: boolean = true) => {
    setPermissionError(null);
    
    try {
      // This call will trigger the browser's permission dialog
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
      });

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      // Stop the stream immediately as we just wanted to check permissions
      stream.getTracks().forEach(track => track.stop());

      // Update permission states
      setPermissions({
        camera: hasVideo ? 'granted' : 'denied',
        microphone: hasAudio ? 'granted' : 'denied'
      });

      return { hasVideo, hasAudio };
    } catch (error: any) {
      console.error('Permission request failed:', error);
      
      let errorMessage = 'Failed to access camera and microphone. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone access when prompted by your browser and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found on your device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera or microphone is already in use by another application.';
      } else {
        errorMessage += 'Please check your device and try again.';
      }
      
      setPermissionError(errorMessage);
      setPermissions({ camera: 'denied', microphone: 'denied' });
      throw error;
    }
  }, []);

  // Enhanced error handling utility with optimized logging
  const createWebRTCError = useCallback((message: string, operation: string, code?: string, recoverable = true): WebRTCError => {
    const error = new Error(message) as WebRTCError;
    error.operation = operation;
    error.code = code;
    error.recoverable = recoverable;
    // Use optimized logger
    logger.webrtcError(operation, message, undefined, code);
    return error;
  }, []);

  // Advanced connection health monitoring
  const updateConnectionHealth = useCallback(async () => {
    if (!peerConnection.current || peerConnection.current.connectionState !== 'connected') {
      return;
    }

    try {
      const stats = await peerConnection.current.getStats();
      let bandwidth = 0;
      let latency = 0;
      let packetLoss = 0;
      let jitter = 0;
      let totalPackets = 0;
      let totalBytes = 0;

      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          totalPackets += report.packetsReceived || 0;
          totalBytes += report.bytesReceived || 0;
          packetLoss += report.packetsLost || 0;
          
          if (report.mediaType === 'video') {
            bandwidth += (report.bytesReceived || 0) * 8; // Convert to bits
          }
        }
        
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          latency = (report.currentRoundTripTime || 0) * 1000; // Convert to ms
        }
      });

      const lossRate = totalPackets > 0 ? (packetLoss / (totalPackets + packetLoss)) * 100 : 0;
      const bandwidthMbps = bandwidth / (1024 * 1024); // Convert to Mbps

      // Determine connection quality
      let quality: ConnectionHealth['quality'] = 'excellent';
      if (latency > 200 || lossRate > 5 || bandwidthMbps < 1) {
        quality = 'critical';
      } else if (latency > 150 || lossRate > 3 || bandwidthMbps < 2) {
        quality = 'poor';
      } else if (latency > 100 || lossRate > 1 || bandwidthMbps < 5) {
        quality = 'fair';
      } else if (latency > 50 || lossRate > 0.5 || bandwidthMbps < 10) {
        quality = 'good';
      }

      const health: ConnectionHealth = {
        isHealthy: quality !== 'critical' && quality !== 'poor',
        quality,
        bandwidth: bandwidthMbps,
        latency,
        packetLoss: lossRate,
        jitter,
        lastUpdate: new Date()
      };

      setConnectionHealth(health);

      // Trigger adaptive bitrate if enabled
      if (adaptiveBitrateEnabled.current && (quality === 'poor' || quality === 'critical')) {
        await adaptToNetworkConditions(health);
      }

    } catch (error) {
      logger.webrtcWarn('update_connection_health', 'Failed to update connection health', error);
    }
  }, []);

  // Adaptive bitrate and network adaptation
  const adaptToNetworkConditions = useCallback(async (health: ConnectionHealth) => {
    if (!localStream || !networkAdaptationEnabled.current) return;

    setIsAdapting(true);
    
    try {
      const videoTracks = localStream.getVideoTracks();
      
      if (videoTracks.length > 0 && typeof videoTracks[0].getConstraints === 'function') {
        const currentConstraints = videoTracks[0].getConstraints();
        let newConstraints: MediaTrackConstraints = {};

        if (health.quality === 'critical') {
          // Reduce to minimum quality
          newConstraints = {
            width: { ideal: 320, max: 480 },
            height: { ideal: 240, max: 360 },
            frameRate: { ideal: 15, max: 20 }
          };
        } else if (health.quality === 'poor') {
          // Reduce quality moderately
          newConstraints = {
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 20, max: 25 }
          };
        } else if (health.quality === 'fair') {
          // Medium quality
          newConstraints = {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 25, max: 30 }
          };
        } else {
          // High quality
          newConstraints = {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          };
        }

        // Apply new constraints
        await videoTracks[0].applyConstraints(newConstraints);
      }
    } catch (error) {
      logger.webrtcError('adapt_network_conditions', 'Failed to adapt to network conditions', error);
    } finally {
      setIsAdapting(false);
    }
  }, [localStream]);

  // Retry mechanism with exponential backoff
  const retryOperation = useCallback(async <T extends any>(
    operation: () => Promise<T>,
    operationName: string,
    config = retryConfig.current
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        setRetryCount(attempt - 1);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.webrtcWarn('retry_operation', `${operationName} attempt ${attempt} failed`, error);
        
        if (attempt === config.maxAttempts) {
          throw createWebRTCError(
            `${operationName} failed after ${config.maxAttempts} attempts: ${lastError.message}`,
            operationName,
            'MAX_RETRIES_EXCEEDED',
            false
          );
        }
        
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }, [createWebRTCError]);

  const initializePeerConnection = useCallback(() => {
    // Close existing connection if any
    if (peerConnection.current) {
      console.log('🔄 Closing existing peer connection...');
      peerConnection.current.close();
    }

    // Enhanced ICE servers with fallbacks
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.ekiga.net' },
      { urls: 'stun:stun.ideasip.com' },
      { urls: 'stun:stun.schlund.de' },
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipbuster.com' },
      { urls: 'stun:stun.voipstunt.com' },
      { urls: 'stun:stun.counterpath.com' },
      { urls: 'stun:stun.1und1.de' },
      { urls: 'stun:stun.gmx.net' },
      { urls: 'stun:stun.callwithus.com' },
      { urls: 'stun:stun.counterpath.net' },
      { urls: 'stun:stun.internetcalls.com' }
    ];

    console.log('🔗 Creating new RTCPeerConnection...');
    
    // Create new peer connection directly (simplified approach)
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10, // Reduced for better performance
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      // sdpSemantics: 'unified-plan', // Not available in all browsers
      // Enhanced configuration for better reliability
      // Note: These properties may not be available in all browsers
    });

    // Set the peer connection immediately and synchronize state
    peerConnection.current = pc;
    setPeerConnectionState(pc);
    
    console.log('✅ Peer connection created and set in state');
    
    // Set up connection state handlers with reduced logging
    pc.onconnectionstatechange = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Connection state changed:', pc.connectionState);
      }
      setConnectionState(pc.connectionState);
    };
    
    pc.oniceconnectionstatechange = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🧊 ICE connection state changed:', pc.iceConnectionState);
      }
      setIceConnectionState(pc.iceConnectionState);
    };
    
    // Ensure the peer connection is properly set (reduced logging)
    setTimeout(() => {
      if (peerConnection.current !== pc) {
        // Only log in development mode to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.warn('Peer connection not properly set');
        }
      }
    }, 100);

    pc.onicecandidate = null; // Will be set by parent component
    
    // Enhanced negotiation handling
    pc.onnegotiationneeded = async () => {
      setNegotiationNeeded(true);
      
      try {
        // Clear any existing negotiation timeout
        if (negotiationTimeout.current) {
          clearTimeout(negotiationTimeout.current);
        }
        
        // Set timeout for negotiation (reduced logging)
        negotiationTimeout.current = setTimeout(() => {
          // Only log in development mode to reduce Railway rate limits
          if (process.env.NODE_ENV === 'development') {
            console.warn('Negotiation timeout - connection may be unstable');
          }
          setNegotiationNeeded(false);
        }, 15000); // Increased to 15 seconds
        
        // Only proceed if we're in the right state and have a local stream
        if (pc.signalingState === 'stable' && localStream) {
          // The parent component will handle creating the offer
        }
      } catch (error) {
        console.error('Error during negotiation:', error);
        setNegotiationNeeded(false);
      }
    };
    
    // Enhanced ICE gathering state handling
    pc.onicegatheringstatechange = () => {
      
      if (pc.iceGatheringState === 'gathering') {
        // Set timeout for ICE gathering
        if (iceGatheringTimeout.current) {
          clearTimeout(iceGatheringTimeout.current);
        }
        
        iceGatheringTimeout.current = setTimeout(() => {
          // Only log in development mode to reduce Railway rate limits
          if (process.env.NODE_ENV === 'development') {
            console.warn('ICE gathering timeout - forcing completion');
          }
          if (pc.iceGatheringState === 'gathering') {
            // Force completion by setting local description again
            pc.setLocalDescription(pc.localDescription || undefined).catch(error => {
              // Only log critical errors
              if (process.env.NODE_ENV === 'development') {
                console.error('Error forcing ICE gathering completion:', error);
              }
            });
          }
        }, 15000); // 15 second timeout
      } else {
        if (iceGatheringTimeout.current) {
          clearTimeout(iceGatheringTimeout.current);
        }
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && stream.id) {
        // Prevent duplicate stream updates
        if (lastStreamId.current === stream.id) {
          return;
        }
        
        // Enhanced stream validation
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        const hasVideo = videoTracks.length > 0;
        const hasAudio = audioTracks.length > 0;
        
        if (!hasVideo && !hasAudio) {
          // Only log in development mode to reduce Railway rate limits
          if (process.env.NODE_ENV === 'development') {
            console.warn('Received empty stream, ignoring');
          }
          return;
        }
        
        // Prevent self-connection by checking if this is the local stream
        if (localStream && localStream.id === stream.id) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Prevented self-connection: received own local stream');
          }
          return;
        }
        
        // Additional validation: check if stream tracks match local stream tracks
        if (localStream) {
          const localVideoTracks = localStream.getVideoTracks();
          const localAudioTracks = localStream.getAudioTracks();
          
          // Check if any tracks match (indicating self-connection)
          const hasMatchingVideoTrack = videoTracks.some(remoteTrack => 
            localVideoTracks.some(localTrack => 
              localTrack.label === remoteTrack.label && 
              localTrack.kind === remoteTrack.kind
            )
          );
          
          const hasMatchingAudioTrack = audioTracks.some(remoteTrack => 
            localAudioTracks.some(localTrack => 
              localTrack.label === remoteTrack.label && 
              localTrack.kind === remoteTrack.kind
            )
          );
          
          if (hasMatchingVideoTrack || hasMatchingAudioTrack) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Prevented self-connection: stream tracks match local tracks');
            }
            return;
          }
        }
        
        // Clear any existing timeout
        if (streamUpdateTimeout.current) {
          clearTimeout(streamUpdateTimeout.current);
        }
        
        // Set remote stream immediately for better responsiveness
        lastStreamId.current = stream.id;
        setRemoteStream(stream);
        
        // Force update connection states
        setConnectionState('connected');
        setIceConnectionState('connected');
        
        // Enhanced callback with error handling
        if (onRemoteStream) {
          try {
            onRemoteStream(stream);
          } catch (error) {
            // Only log critical errors to reduce Railway rate limits
            if (process.env.NODE_ENV === 'development') {
              console.error('Error in onRemoteStream callback:', error);
            }
          }
        }
        
      } else {
        // Only log in development mode to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.warn('Invalid stream received:', stream);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      
      // Only update state if it's actually changing to prevent flickering
      setIceConnectionState(prevState => {
        if (prevState !== pc.iceConnectionState) {
          return pc.iceConnectionState;
        }
        return prevState;
      });
      
      if (pc.iceConnectionState === 'failed') {
        // Only log in development mode to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.warn('ICE connection failed, attempting restart');
        }
        setConnectionQuality('poor');
        setLastError(createWebRTCError('ICE connection failed', 'ice_connection', 'ICE_FAILED'));
        
        // Enhanced ICE restart with retry
        retryOperation(
          () => {
            return new Promise<void>((resolve, reject) => {
              try {
                pc.restartIce();
                resolve();
              } catch (error) {
                reject(error);
              }
            });
          },
          'ICE restart'
        ).catch(error => {
          // Only log critical errors to reduce Railway rate limits
          if (process.env.NODE_ENV === 'development') {
            console.error('ICE restart failed:', error);
          }
          setIsReconnecting(true);
          // Attempt full reconnection
          setTimeout(() => {
            initializePeerConnection();
            setIsReconnecting(false);
          }, 2000);
        });
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionQuality('good');
        setLastError(null);
        setRetryCount(0);
      } else if (pc.iceConnectionState === 'disconnected') {
        // Only log in development mode to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.warn('ICE connection disconnected');
        }
        setConnectionQuality('poor');
      } else if (pc.iceConnectionState === 'checking') {
        setConnectionQuality('unknown');
      }
    };

    pc.onconnectionstatechange = () => {
      
      // Only update state if it's actually changing to prevent flickering
      setConnectionState(prevState => {
        if (prevState !== pc.connectionState) {
          return pc.connectionState;
        }
        return prevState;
      });
      
      if (pc.connectionState === 'failed') {
        // Only log critical errors to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.error('Peer connection failed');
        }
        setConnectionQuality('poor');
        setRemoteStream(null);
        connectionFailureCount.current++;
        
        const error = createWebRTCError('Peer connection failed', 'peer_connection', 'CONNECTION_FAILED');
        setLastError(error);
        
        // Advanced recovery logic
        if (automaticRecoveryEnabled.current && recoveryAttempts < maxRecoveryAttempts) {
          setRecoveryAttempts(prev => prev + 1);
          setIsReconnecting(true);
          
          // Exponential backoff for recovery attempts
          const delay = Math.min(1000 * Math.pow(2, recoveryAttempts), 30000);
          setTimeout(() => {
            initializePeerConnection();
            setIsReconnecting(false);
          }, delay);
        } else {
          setIsReconnecting(true);
        }
      } else if (pc.connectionState === 'connected') {
        setConnectionQuality('good');
        setLastError(null);
        setRetryCount(0);
        setNegotiationNeeded(false);
        setIsReconnecting(false);
        setRecoveryAttempts(0);
        connectionFailureCount.current = 0;
        lastSuccessfulConnection.current = new Date();
        
        // Clear negotiation timeout
        if (negotiationTimeout.current) {
          clearTimeout(negotiationTimeout.current);
        }
      } else if (pc.connectionState === 'connecting') {
        setConnectionQuality('unknown');
      } else if (pc.connectionState === 'disconnected') {
        // Only log in development mode to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.warn('Peer connection disconnected');
        }
        setConnectionQuality('poor');
      }
    };

    // Enhanced signaling state handling
    const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
    const originalSetRemoteDescription = pc.setRemoteDescription.bind(pc);
    
    pc.setLocalDescription = async (description) => {
      try {
        await originalSetLocalDescription(description);
      } catch (error) {
        // Only log critical errors to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to set local description:', error);
        }
        setLastError(createWebRTCError('Failed to set local description', 'set_local_description', 'SET_LOCAL_DESC_FAILED'));
        throw error;
      }
    };
    
    pc.setRemoteDescription = async (description) => {
      try {
        await originalSetRemoteDescription(description);
      } catch (error) {
        // Only log critical errors to reduce Railway rate limits
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to set remote description:', error);
        }
        setLastError(createWebRTCError('Failed to set remote description', 'set_remote_description', 'SET_REMOTE_DESC_FAILED'));
        throw error;
      }
    };

    // Advanced connection health monitoring (optimized frequency)
    healthCheckInterval.current = setInterval(async () => {
      if (pc.connectionState === 'connected') {
        await updateConnectionHealth();
      }
    }, 10000); // Check every 10 seconds to reduce Railway rate limits

    // Enhanced connection quality monitoring with detailed stats
    connectionQualityInterval.current = setInterval(async () => {
      if (pc.connectionState === 'connected') {
        try {
          const stats = await pc.getStats();
          let audioQuality = 'good';
          let videoQuality = 'good';
          let rtt = 0;
          let packetsLost = 0;
          let packetsReceived = 0;
          let bytesReceived = 0;
          let bytesSent = 0;
          let frameRate = 0;
          let resolution = { width: 0, height: 0 };
          
          stats.forEach(report => {
            if (report.type === 'inbound-rtp') {
              packetsReceived += report.packetsReceived || 0;
              bytesReceived += report.bytesReceived || 0;
              packetsLost += report.packetsLost || 0;
              
              if (report.mediaType === 'audio') {
                const lossRate = (report.packetsLost || 0) / ((report.packetsReceived || 0) + (report.packetsLost || 0)) || 0;
                if (lossRate > 0.05) audioQuality = 'poor';
              }
              if (report.mediaType === 'video') {
                const lossRate = (report.packetsLost || 0) / ((report.packetsReceived || 0) + (report.packetsLost || 0)) || 0;
                if (lossRate > 0.05) videoQuality = 'poor';
                frameRate = report.framesPerSecond || 0;
              }
            }
            
            if (report.type === 'outbound-rtp') {
              bytesSent += report.bytesSent || 0;
            }
            
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              rtt = report.currentRoundTripTime * 1000 || 0;
            }
          });
          
          // Update detailed connection stats
          setConnectionStats({
            rtt,
            packetsLost,
            packetsReceived,
            bytesReceived,
            bytesSent,
            frameRate,
            resolution
          });
          
          const overallQuality = (audioQuality === 'poor' || videoQuality === 'poor' || rtt > 500) ? 'poor' : 'good';
          setConnectionQuality(overallQuality);
          
          // Log quality issues (optimized)
          if (overallQuality === 'poor') {
            logger.webrtcWarn('connection_quality', 'Connection quality degraded', { audioQuality, videoQuality, rtt });
          }
        } catch (error) {
          logger.webrtcWarn('connection_stats', 'Error getting connection stats', error);
        }
      }
    }, 15000); // Check every 15 seconds to reduce Railway rate limits
    
    // If we have a local stream, add it to the new peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Clear any existing timeouts
    if (negotiationTimeout.current) {
      clearTimeout(negotiationTimeout.current);
    }
    if (iceGatheringTimeout.current) {
      clearTimeout(iceGatheringTimeout.current);
    }
    
    return pc;
  }, [onRemoteStream, createWebRTCError, retryOperation, localStream]);

  const startLocalStream = useCallback(async (video: boolean = true, audio: boolean = true) => {
    // Prevent multiple simultaneous initialization attempts
    if (isInitializing.current) {
      return localStream;
    }

    // If we already have a local stream, don't reinitialize
    if (localStream && localStream.active) {
      logger.webrtcInfo('start_local_stream', 'Local stream already active, skipping initialization');
      return localStream;
    }

    try {
      isInitializing.current = true;
      setPermissionError(null);
      setLastError(null);
      

      // Stop existing stream first to prevent conflicts
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
        setLocalStream(null); // Clear the state immediately
      }

      // Enhanced media device validation
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Check if we're in a secure context
        if (!window.isSecureContext) {
          throw createWebRTCError(
            'HTTPS required for camera/microphone access',
            'start_local_stream',
            'INSECURE_CONTEXT',
            false
          );
        }
        throw createWebRTCError(
          'Browser does not support camera/microphone access',
          'start_local_stream',
          'UNSUPPORTED_BROWSER',
          false
        );
      }

      // Check current permissions first
      await checkPermissions();

      // Enhanced device enumeration with retry
      const devices = await retryOperation(
        () => navigator.mediaDevices.enumerateDevices(),
        'Device enumeration'
      );
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      

      // Use local variables to avoid reassigning parameters
      let requestVideo = video;
      let requestAudio = audio;

      if (requestVideo && videoDevices.length === 0) {
        requestVideo = false;
      }

      if (requestAudio && audioDevices.length === 0) {
        requestAudio = false;
      }

      if (!requestVideo && !requestAudio) {
        throw createWebRTCError(
          'No camera or microphone devices found on this device',
          'start_local_stream',
          'NO_DEVICES_FOUND',
          false
        );
      }

      // Enhanced permission checking with retry
      if (!hasPermissions(requestVideo, requestAudio)) {
        try {
          await retryOperation(
            () => requestPermissions(requestVideo, requestAudio),
            'Permission request',
            { maxAttempts: 2, baseDelay: 500, maxDelay: 2000, backoffMultiplier: 2 }
          );
        } catch (permError) {
          console.error('Permission request failed:', permError);
          throw permError;
        }
      }

      // Enhanced getUserMedia with progressive fallback
      const constraints = {
        video: requestVideo ? { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user',
          aspectRatio: 16/9
        } : false,
        audio: requestAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 }
        } : false,
      };
      
      
      const stream = await retryOperation(
        async () => {
          try {
            return await navigator.mediaDevices.getUserMedia(constraints);
          } catch (error: any) {
            // Progressive fallback for video constraints
            if (error.name === 'OverconstrainedError' && requestVideo) {
              console.warn('Video constraints too strict, trying fallback...');
              const fallbackConstraints = {
                ...constraints,
                video: {
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                  frameRate: { ideal: 24 }
                }
              };
              return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            }
            throw error;
          }
        },
        'Media stream acquisition',
        { maxAttempts: 3, baseDelay: 1000, maxDelay: 5000, backoffMultiplier: 1.5 }
      );

      // Enhanced stream validation and setup
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      
      // Validate stream quality
      if (requestVideo && videoTracks.length === 0) {
        console.warn('Video requested but no video tracks available');
      }
      if (requestAudio && audioTracks.length === 0) {
        console.warn('Audio requested but no audio tracks available');
      }
      
      // Set the new stream
      setLocalStream(stream);
      setIsVideoEnabled(requestVideo && videoTracks.length > 0);
      setIsAudioEnabled(requestAudio && audioTracks.length > 0);
      
      // Log track details
      videoTracks.forEach(track => {
      });
      
      audioTracks.forEach(track => {
      });

      // Enhanced peer connection setup
      if (!peerConnection.current) {
        console.log('🔗 Initializing peer connection for local stream...');
        initializePeerConnection();
        
        // Wait longer for the peer connection to be created
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds total
        while (!peerConnection.current && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!peerConnection.current) {
          console.error('❌ Failed to initialize peer connection after timeout');
          throw new Error('Failed to initialize peer connection');
        }
        
        console.log('✅ Peer connection initialized successfully for local stream');
      }
      

      // Remove existing tracks before adding new ones
      if (peerConnection.current) {
        const senders = peerConnection.current.getSenders();
        await Promise.all(senders.map(sender => {
          if (sender.track) {
            return peerConnection.current?.removeTrack(sender);
          }
          return Promise.resolve();
        }));
      }

      // Add new tracks to peer connection
      stream.getTracks().forEach(track => {
        if (peerConnection.current) {
          peerConnection.current.addTrack(track, stream);
        }
      });

      return stream;
    } catch (error) {
      console.error('Failed to start local stream:', error);
      
      // Enhanced error handling with specific error types
      let errorMessage = 'Failed to start local stream';
      let errorCode = 'UNKNOWN_ERROR';
      let isRecoverable = true;
      
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          errorMessage = 'Camera or microphone not found. Please check your device and try again.';
          errorCode = 'DEVICE_NOT_FOUND';
        } else if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera or microphone access denied. Please allow access in your browser settings and try again.';
          errorCode = 'PERMISSION_DENIED';
          isRecoverable = false;
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera or microphone is already in use by another application. Please close other applications and try again.';
          errorCode = 'DEVICE_IN_USE';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera or microphone settings are not supported. Trying with lower quality settings.';
          errorCode = 'CONSTRAINTS_NOT_SUPPORTED';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Security error: HTTPS is required for camera and microphone access.';
          errorCode = 'SECURITY_ERROR';
          isRecoverable = false;
        } else if (error.name === 'AbortError') {
          errorMessage = 'Media access was interrupted. Please try again.';
          errorCode = 'ABORTED';
        } else {
          errorMessage = error.message || 'Failed to access camera and microphone.';
        }
      }
      
      const webRTCError = createWebRTCError(errorMessage, 'start_local_stream', errorCode, isRecoverable);
      setLastError(webRTCError);
      setPermissionError(errorMessage);
      
      // Set to false if it was enabled but failed
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      
      throw webRTCError;
    } finally {
      isInitializing.current = false;
    }
  }, [initializePeerConnection, localStream, checkPermissions, hasPermissions, requestPermissions, createWebRTCError, retryOperation]);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  const createOffer = useCallback(async () => {
    // Force peer connection initialization if not ready
    if (!peerConnection.current) {
      initializePeerConnection();
      
      // Wait for initialization with longer timeout
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds total
      
      while (!peerConnection.current && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
    
    // Double-check and force initialization if still not ready
    if (!peerConnection.current) {
      initializePeerConnection();
      
      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!peerConnection.current) {
        console.error('❌ Cannot create offer: no peer connection after force initialization');
        const webRTCError = createWebRTCError(
          'Peer connection not ready for offer creation',
          'create_offer',
          'NO_PEER_CONNECTION'
        );
        setLastError(webRTCError);
        return null;
      }
    }

    try {
      
      // Ensure peer connection is ready
      if (!peerConnection.current) {
        console.error('❌ Peer connection is null during offer creation');
        return null;
      }
      
      // Check if peer connection is in the right state
      if (peerConnection.current.signalingState === 'closed') {
        console.log('⚠️ Peer connection is closed, cannot create offer');
        return null;
      }
      
      // Wait a moment for the connection to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Double-check peer connection is still valid
      if (!peerConnection.current) {
        console.error('❌ Peer connection became null during offer creation');
        return null;
      }
      
      // Enhanced offer creation with constraints
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true,
        iceRestart: false
      };
      
      const offer = await retryOperation(
        () => peerConnection.current!.createOffer(offerOptions),
        'Create offer',
        { maxAttempts: 3, baseDelay: 500, maxDelay: 2000, backoffMultiplier: 1.5 }
      );
      
      
      await retryOperation(
        () => peerConnection.current!.setLocalDescription(offer),
        'Set local description for offer',
        { maxAttempts: 3, baseDelay: 500, maxDelay: 2000, backoffMultiplier: 1.5 }
      );
      
      setLastError(null);
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      const webRTCError = createWebRTCError(
        'Failed to create WebRTC offer',
        'create_offer',
        'OFFER_CREATION_FAILED'
      );
      setLastError(webRTCError);
      return null;
    }
  }, [createWebRTCError, retryOperation, initializePeerConnection]);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnection.current) {
      console.error('Cannot create answer: no peer connection');
      return null;
    }

    if (!offer || !offer.type || !offer.sdp) {
      console.error('Invalid offer received:', offer);
      return null;
    }

    try {
      
      // Check if peer connection is in the right state
      if (peerConnection.current.signalingState !== 'stable') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Enhanced answer creation with validation
      await retryOperation(
        () => peerConnection.current!.setRemoteDescription(offer),
        'Set remote description for offer',
        { maxAttempts: 3, baseDelay: 500, maxDelay: 2000, backoffMultiplier: 1.5 }
      );
      
      
      const answerOptions = {
        voiceActivityDetection: true
      };
      
      const answer = await retryOperation(
        () => peerConnection.current!.createAnswer(answerOptions),
        'Create answer',
        { maxAttempts: 3, baseDelay: 500, maxDelay: 2000, backoffMultiplier: 1.5 }
      );
      
      
      await retryOperation(
        () => peerConnection.current!.setLocalDescription(answer),
        'Set local description for answer',
        { maxAttempts: 3, baseDelay: 500, maxDelay: 2000, backoffMultiplier: 1.5 }
      );
      
      setLastError(null);
      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      const webRTCError = createWebRTCError(
        'Failed to create WebRTC answer',
        'create_answer',
        'ANSWER_CREATION_FAILED'
      );
      setLastError(webRTCError);
      return null;
    }
  }, [createWebRTCError, retryOperation]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnection.current) {
      console.error('Cannot handle answer: no peer connection');
      return;
    }

    if (!answer || !answer.type || !answer.sdp) {
      console.error('Invalid answer received:', answer);
      return;
    }

    try {
      
      // Check signaling state before setting remote description
      const currentState = peerConnection.current.signalingState;
      
      if (currentState !== 'have-local-offer') {
        console.warn('Invalid signaling state for answer:', currentState);
        // Don't try to set remote description if we're not in the right state
        return;
      }
      
      await retryOperation(
        () => peerConnection.current!.setRemoteDescription(answer),
        'Set remote description for answer',
        { maxAttempts: 3, baseDelay: 500, maxDelay: 2000, backoffMultiplier: 1.5 }
      );
      
      setLastError(null);
    } catch (error) {
      console.error('Failed to handle answer:', error);
      const webRTCError = createWebRTCError(
        'Failed to handle WebRTC answer',
        'handle_answer',
        'ANSWER_HANDLING_FAILED'
      );
      setLastError(webRTCError);
    }
  }, [createWebRTCError, retryOperation]);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnection.current) {
      console.error('Cannot add ICE candidate: no peer connection');
      return;
    }

    if (!candidate || !candidate.candidate) {
      console.error('Invalid ICE candidate received:', candidate);
      return;
    }

    try {
      
      await retryOperation(
        () => peerConnection.current!.addIceCandidate(candidate),
        'Add ICE candidate',
        { maxAttempts: 3, baseDelay: 200, maxDelay: 1000, backoffMultiplier: 1.2 }
      );
      
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      // ICE candidate errors are usually not critical, so we don't set lastError
      // They often happen due to timing issues or duplicate candidates
    }
  }, [retryOperation]);

  const sendIceCandidate = useCallback((candidate: RTCIceCandidateInit, sendMessage: (message: any) => void, sessionId?: string) => {
    if (!candidate || !sendMessage) {
      console.error('Cannot send ICE candidate: missing candidate or sendMessage function');
      return;
    }

    try {
      const message = {
        type: 'webrtc_ice_candidate',
        sessionId,
        candidate,
      };
      
      
      sendMessage(message);
    } catch (error) {
      console.error('Failed to send ICE candidate:', error);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStream) {
      console.warn('Cannot toggle video: no local stream');
      return false;
    }

    try {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length === 0) {
        console.warn('Cannot toggle video: no video tracks available');
        return false;
      }

      const videoTrack = videoTracks[0];
      const newState = !videoTrack.enabled;
      
      videoTrack.enabled = newState;
      setIsVideoEnabled(newState);
      
      return newState;
    } catch (error) {
      console.error('Failed to toggle video:', error);
      setLastError(createWebRTCError('Failed to toggle video', 'toggle_video', 'TOGGLE_VIDEO_FAILED'));
      return false;
    }
  }, [localStream, createWebRTCError]);

  const toggleAudio = useCallback(() => {
    if (!localStream) {
      console.warn('Cannot toggle audio: no local stream');
      return false;
    }

    try {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('Cannot toggle audio: no audio tracks available');
        return false;
      }

      const audioTrack = audioTracks[0];
      const newState = !audioTrack.enabled;
      
      audioTrack.enabled = newState;
      setIsAudioEnabled(newState);
      
      return newState;
    } catch (error) {
      console.error('Failed to toggle audio:', error);
      setLastError(createWebRTCError('Failed to toggle audio', 'toggle_audio', 'TOGGLE_AUDIO_FAILED'));
      return false;
    }
  }, [localStream, createWebRTCError]);

  // Optimized endCall function that preserves local stream for "next" button
  const endCall = useCallback((preserveLocalStream = false) => {
    try {
      // Clear any pending stream updates
      if (streamUpdateTimeout.current) {
        clearTimeout(streamUpdateTimeout.current);
        streamUpdateTimeout.current = undefined;
      }
      
      // Clear connection quality monitoring
      if (connectionQualityInterval.current) {
        clearInterval(connectionQualityInterval.current);
        connectionQualityInterval.current = undefined;
      }
      
      // Clear stats monitoring
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
        statsInterval.current = undefined;
      }
      
      // Clear reconnection timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = undefined;
      }
      
      // Clear negotiation timeout
      if (negotiationTimeout.current) {
        clearTimeout(negotiationTimeout.current);
        negotiationTimeout.current = undefined;
      }
      
      // Clear ICE gathering timeout
      if (iceGatheringTimeout.current) {
        clearTimeout(iceGatheringTimeout.current);
        iceGatheringTimeout.current = undefined;
      }
      
      // Clear health check interval
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
        healthCheckInterval.current = undefined;
      }
      
      // Clear adaptation timeout
      if (adaptationTimeout.current) {
        clearTimeout(adaptationTimeout.current);
        adaptationTimeout.current = undefined;
      }
      
      // Clear connection timeout
      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current);
        connectionTimeout.current = undefined;
      }
      
      // Reset initialization flag
      isInitializing.current = false;
      lastStreamId.current = null;
      connectionStateInitialized.current = false;
      connectionFailureCount.current = 0;
      lastSuccessfulConnection.current = null;
      
      // Only stop local stream if not preserving it (for "next" button optimization)
      if (!preserveLocalStream) {
        try {
          stopLocalStream();
        } catch (streamError) {
          // Only log in development mode to reduce Railway rate limits
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error stopping local stream:', streamError);
          }
        }
      }
      
      // Clear remote stream
      setRemoteStream(null);
      
      // Reset connection states
      setConnectionState('new');
      setIceConnectionState('new');
      setConnectionQuality('unknown');
      setConnectionStats(null);
      setRetryCount(0);
      setLastError(null);
      setIsReconnecting(false);
      setNegotiationNeeded(false);
      
      // Close peer connection safely
      if (peerConnection.current) {
        try {
          peerConnection.current.close();
        } catch (pcError) {
          logger.webrtcWarn('end_call', 'Error closing peer connection', pcError);
        } finally {
          peerConnection.current = null;
          setPeerConnectionState(null);
        }
      }
      
    } catch (error) {
      logger.webrtcError('end_call', 'Error during call cleanup', error);
      // Don't re-throw the error to prevent ErrorBoundary from catching it
    }
  }, [stopLocalStream]);

  // Initialize peer connection on mount - only once
  useEffect(() => {
    // Initialize peer connection immediately when hook mounts
    if (!peerConnection.current && !isInitialized) {
      try {
        initializePeerConnection();
        setIsInitialized(true);
        console.log('🔗 Peer connection initialized on mount');
      } catch (error) {
        console.error('❌ Failed to initialize peer connection on mount:', error);
      }
    }
    
    // Cleanup function to prevent multiple initializations
    return () => {
      // Don't clean up peer connection here to prevent reinitialization
    };
  }, []); // Empty dependency array to run only once

  // Enhanced cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't call endCall here as it might cause infinite loops
      // Just clean up the peer connection directly
      if (peerConnection.current) {
        try {
          peerConnection.current.close();
        } catch (error) {
          console.warn('Error closing peer connection during cleanup:', error);
        }
        peerConnection.current = null;
      }
      setPeerConnectionState(null);
      // Note: localStream is a state variable, not a ref, so we can't access it directly in cleanup
      // The cleanup will be handled by the component unmounting
    };
  }, []); // Empty dependency array to run only on unmount

  return {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    iceConnectionState,
    connectionQuality,
    permissions,
    permissionError,
    connectionStats,
    retryCount,
    lastError,
    isReconnecting,
    negotiationNeeded,
    startLocalStream,
    stopLocalStream,
    createOffer,
    createAnswer,
    handleAnswer,
    addIceCandidate,
    sendIceCandidate,
    toggleVideo,
    toggleAudio,
    endCall,
    checkPermissions,
    requestPermissions,
    hasPermissions,
    peerConnection: peerConnectionState,
    // Advanced features
    connectionHealth,
    isAdapting,
    recoveryAttempts,
    maxRecoveryAttempts,
    updateConnectionHealth,
    adaptToNetworkConditions,
    toggleAdaptiveBitrate: () => {
      adaptiveBitrateEnabled.current = !adaptiveBitrateEnabled.current;
    },
    toggleNetworkAdaptation: () => {
      networkAdaptationEnabled.current = !networkAdaptationEnabled.current;
    },
    toggleAutomaticRecovery: () => {
      automaticRecoveryEnabled.current = !automaticRecoveryEnabled.current;
    },
    forceRecovery: () => {
      setRecoveryAttempts(0);
      initializePeerConnection();
    },
    getConnectionDiagnostics: () => ({
      connectionHealth,
      isAdapting,
      recoveryAttempts,
      maxRecoveryAttempts,
      connectionFailureCount: connectionFailureCount.current,
      lastSuccessfulConnection: lastSuccessfulConnection.current,
      adaptiveBitrateEnabled: adaptiveBitrateEnabled.current,
      networkAdaptationEnabled: networkAdaptationEnabled.current,
      automaticRecoveryEnabled: automaticRecoveryEnabled.current
    })
  };
}
