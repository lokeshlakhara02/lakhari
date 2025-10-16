import React, { useRef, useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface StableCameraProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  isVideoEnabled?: boolean;
  isAudioEnabled?: boolean;
  className?: string;
  muted?: boolean;
  playsInline?: boolean;
  autoPlay?: boolean;
  controls?: boolean;
}

export const StableCamera: React.FC<StableCameraProps> = ({
  stream,
  isLocal = false,
  isVideoEnabled = true,
  isAudioEnabled = true,
  className = '',
  muted = false,
  playsInline = true,
  autoPlay = true,
  controls = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastStreamId, setLastStreamId] = useState<string | null>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const maxRetries = 3;
  const retryDelay = 500;

  // Stable stream application
  const applyStream = useCallback(async (newStream: MediaStream) => {
    if (!videoRef.current || !newStream) return;

    const videoElement = videoRef.current;
    const streamId = newStream.id;

    // Prevent duplicate stream application
    if (lastStreamId === streamId && videoElement.srcObject === newStream) {
      return;
    }

    try {
      // Clear any existing timeouts
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Set video properties for stability
      videoElement.muted = muted;
      videoElement.playsInline = playsInline;
      videoElement.autoplay = autoPlay;
      videoElement.controls = controls;
      videoElement.volume = isAudioEnabled ? 1.0 : 0.0;

      // Apply stream
      videoElement.srcObject = newStream;
      setLastStreamId(streamId);

      // Attempt to play with retry logic
      const attemptPlay = async (attempt: number = 0) => {
        if (attempt >= maxRetries) {
          logger.componentError('stable_camera', `Failed to play video after ${maxRetries} attempts`);
          return;
        }

        try {
          const playPromise = videoElement.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            setIsPlaying(true);
            setRetryCount(0);
            logger.componentInfo('stable_camera', `Video playing successfully (attempt ${attempt + 1})`);
          }
        } catch (error) {
          logger.componentWarn('stable_camera', `Play attempt ${attempt + 1} failed:`, error);
          
          if (attempt < maxRetries - 1) {
            retryTimeoutRef.current = setTimeout(() => {
              attemptPlay(attempt + 1);
            }, retryDelay * (attempt + 1));
          }
        }
      };

      // Start play attempt after a small delay
      playTimeoutRef.current = setTimeout(() => {
        attemptPlay();
      }, 100);

    } catch (error) {
      logger.componentError('stable_camera', 'Error applying stream:', error);
    }
  }, [muted, playsInline, autoPlay, controls, isAudioEnabled, lastStreamId, maxRetries, retryDelay]);

  // Handle stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      applyStream(stream);
    } else if (!stream && videoRef.current) {
      // Clear stream when null
      videoRef.current.srcObject = null;
      setLastStreamId(null);
      setIsPlaying(false);
    }
  }, [stream, applyStream]);

  // Handle video/audio toggles
  useEffect(() => {
    if (videoRef.current && stream) {
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      // Update video tracks
      videoTracks.forEach(track => {
        track.enabled = isVideoEnabled;
      });

      // Update audio tracks
      audioTracks.forEach(track => {
        track.enabled = isAudioEnabled;
      });

      // Update volume
      if (videoRef.current) {
        videoRef.current.volume = isAudioEnabled ? 1.0 : 0.0;
      }
    }
  }, [isVideoEnabled, isAudioEnabled, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Handle video element events
  const handleLoadedMetadata = useCallback(() => {
    logger.componentInfo('stable_camera', 'Video metadata loaded');
  }, []);

  const handleCanPlay = useCallback(() => {
    logger.componentInfo('stable_camera', 'Video can play');
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    logger.componentInfo('stable_camera', 'Video started playing');
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    logger.componentInfo('stable_camera', 'Video paused');
  }, []);

  const handleError = useCallback((error: any) => {
    logger.componentError('stable_camera', 'Video error:', error);
    setIsPlaying(false);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover rounded-lg"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
        style={{
          transform: isLocal ? 'scaleX(-1)' : 'none', // Mirror local video
          backgroundColor: '#000'
        }}
      />
      
      {/* Status indicators */}
      {!isPlaying && stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="text-white text-sm">
            {retryCount > 0 ? `Connecting... (${retryCount}/${maxRetries})` : 'Loading...'}
          </div>
        </div>
      )}
      
      {/* Video/Audio status indicators */}
      <div className="absolute top-2 right-2 flex gap-1">
        {!isVideoEnabled && (
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded">
            📹 Off
          </div>
        )}
        {!isAudioEnabled && (
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded">
            🎤 Off
          </div>
        )}
      </div>
    </div>
  );
};

export default StableCamera;
