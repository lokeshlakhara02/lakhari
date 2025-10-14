import { useCallback, useRef, useState, useEffect } from 'react';

interface PermissionState {
  camera: 'unknown' | 'granted' | 'denied' | 'prompt';
  microphone: 'unknown' | 'granted' | 'denied' | 'prompt';
}

export function useWebRTC(onRemoteStream?: (stream: MediaStream) => void) {
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
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const streamUpdateTimeout = useRef<NodeJS.Timeout>();
  const connectionQualityInterval = useRef<NodeJS.Timeout>();
  const isInitializing = useRef(false);
  const lastStreamId = useRef<string | null>(null);
  const connectionStateInitialized = useRef(false);

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

  const initializePeerConnection = useCallback(() => {
    // Close existing connection if any
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Store the candidate to be sent by the parent component
        console.log('ICE candidate generated:', event.candidate);
        // The parent component will handle sending this via WebSocket
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && stream.id) {
        // Prevent duplicate stream updates
        if (lastStreamId.current === stream.id) {
          return;
        }
        
        // Debounce stream updates to prevent flickering
        if (streamUpdateTimeout.current) {
          clearTimeout(streamUpdateTimeout.current);
        }
        
        streamUpdateTimeout.current = setTimeout(() => {
          lastStreamId.current = stream.id;
          setRemoteStream(stream);
          if (onRemoteStream) {
            onRemoteStream(stream);
          }
        }, 200); // Increased debounce to 200ms
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
        setConnectionQuality('poor');
        pc.restartIce();
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionQuality('good');
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
        setConnectionQuality('poor');
        setRemoteStream(null);
      } else if (pc.connectionState === 'connected') {
        setConnectionQuality('good');
      }
    };

    pc.onicegatheringstatechange = () => {
      // ICE gathering state changed
    };

    // Enhanced connection quality monitoring
    connectionQualityInterval.current = setInterval(() => {
      if (pc.connectionState === 'connected') {
        pc.getStats().then(stats => {
          let audioQuality = 'good';
          let videoQuality = 'good';
          
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
              const lossRate = report.packetsLost / (report.packetsReceived + report.packetsLost) || 0;
              if (lossRate > 0.05) audioQuality = 'poor';
            }
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
              const lossRate = report.packetsLost / (report.packetsReceived + report.packetsLost) || 0;
              if (lossRate > 0.05) videoQuality = 'poor';
            }
          });
          
          const overallQuality = (audioQuality === 'poor' || videoQuality === 'poor') ? 'poor' : 'good';
          setConnectionQuality(overallQuality);
        });
      }
    }, 5000); // Check every 5 seconds

    peerConnection.current = pc;
    return pc;
  }, [onRemoteStream]);

  const startLocalStream = useCallback(async (video: boolean = true, audio: boolean = true) => {
    // Prevent multiple simultaneous initialization attempts
    if (isInitializing.current) {
      return localStream;
    }

    try {
      isInitializing.current = true;
      setPermissionError(null);

      // Stop existing stream first to prevent conflicts
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null); // Clear the state immediately
      }

      // Check if media devices are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Check if we're in a secure context
        if (!window.isSecureContext) {
          throw new Error('HTTPS required for camera/microphone access');
        }
        throw new Error('Browser does not support camera/microphone access');
      }

      // Check current permissions first
      await checkPermissions();

      // Get available devices first
      const devices = await navigator.mediaDevices.enumerateDevices();
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
        throw new Error('No camera or microphone devices found');
      }

      // Check if we have the necessary permissions
      if (!hasPermissions(requestVideo, requestAudio)) {
        // Try to request permissions first
        try {
          await requestPermissions(requestVideo, requestAudio);
        } catch (permError) {
          // If permission request fails, we'll handle it in the main catch block
          throw permError;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: requestVideo ? { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user' // Prefer front camera
        } : false,
        audio: requestAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
      });

      // Set the new stream
      setLocalStream(stream);
      setIsVideoEnabled(requestVideo && stream.getVideoTracks().length > 0);
      setIsAudioEnabled(requestAudio && stream.getAudioTracks().length > 0);

      // Add tracks to peer connection
      if (!peerConnection.current) {
        initializePeerConnection();
      }

      // Remove existing tracks before adding new ones
      if (peerConnection.current) {
        const sender = peerConnection.current.getSenders();
        await Promise.all(sender.map(s => peerConnection.current?.removeTrack(s)));
      }

      stream.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, stream);
      });

      return stream;
    } catch (error) {
      console.error('Failed to start local stream:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        let errorMessage = '';
        
        if (error.name === 'NotFoundError') {
          errorMessage = 'Camera or microphone not found. Please check your device permissions.';
        } else if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera or microphone access denied. Please allow access in your browser settings and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera or microphone is already in use by another application.';
        } else {
          errorMessage = error.message || 'Failed to access camera and microphone.';
        }
        
        setPermissionError(errorMessage);
      }
      
      // Set to false if it was enabled but failed
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      
      throw error;
    } finally {
      isInitializing.current = false;
    }
  }, [initializePeerConnection, localStream, checkPermissions, hasPermissions, requestPermissions]);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  const createOffer = useCallback(async () => {
    if (!peerConnection.current) return null;

    try {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      return null;
    }
  }, []);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnection.current) return null;

    try {
      await peerConnection.current.setRemoteDescription(offer);
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      return null;
    }
  }, []);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  const sendIceCandidate = useCallback((candidate: RTCIceCandidateInit, sendMessage: (message: any) => void, sessionId?: string) => {
    if (candidate && sendMessage) {
      sendMessage({
        type: 'webrtc_ice_candidate',
        sessionId,
        candidate,
      });
      console.log('ICE candidate sent:', candidate);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  const endCall = useCallback(() => {
    // Clear any pending stream updates
    if (streamUpdateTimeout.current) {
      clearTimeout(streamUpdateTimeout.current);
    }
    
    // Clear connection quality monitoring
    if (connectionQualityInterval.current) {
      clearInterval(connectionQualityInterval.current);
    }
    
    // Reset initialization flag
    isInitializing.current = false;
    lastStreamId.current = null;
    connectionStateInitialized.current = false;
    
    stopLocalStream();
    setRemoteStream(null);
    setConnectionState('new');
    setIceConnectionState('new');
    setConnectionQuality('unknown');
    
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  }, [stopLocalStream]);

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
    peerConnection: peerConnection.current,
  };
}
