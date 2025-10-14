import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Mic, MicOff, VideoOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionsGranted: (hasVideo: boolean, hasAudio: boolean) => void;
  onRetry: () => void;
}

interface PermissionState {
  camera: 'unknown' | 'granted' | 'denied' | 'prompt';
  microphone: 'unknown' | 'granted' | 'denied' | 'prompt';
}

export function PermissionModal({ isOpen, onClose, onPermissionsGranted, onRetry }: PermissionModalProps) {
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: 'unknown',
    microphone: 'unknown'
  });
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRequestedOnce, setHasRequestedOnce] = useState(false);

  // Check current permission states and auto-request if needed
  useEffect(() => {
    if (isOpen) {
      checkPermissions();
      
      // Auto-request permissions if they're in prompt state
      const autoRequest = async () => {
        const currentPerms = await checkPermissions();
        if (currentPerms.camera === 'prompt' || currentPerms.microphone === 'prompt') {
          // Small delay to let the modal render first
          setTimeout(() => {
            requestPermissions();
          }, 500);
        }
      };
      
      autoRequest();
    }
  }, [isOpen]);

  const checkPermissions = async (): Promise<{ camera: string; microphone: string }> => {
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

      const perms = {
        camera: cameraPermission.state,
        microphone: micPermission.state
      };
      setPermissions(perms);
      return perms;
    } catch (error) {
      console.warn('Could not check permissions:', error);
      setPermissions({ camera: 'prompt', microphone: 'prompt' });
      return { camera: 'prompt', microphone: 'prompt' };
    }
  };

  const requestPermissions = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      // Request camera and microphone access - this will trigger the browser's permission dialog
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      // Stop the stream immediately as we just wanted to check permissions
      stream.getTracks().forEach(track => track.stop());

      setHasRequestedOnce(true);
      setPermissions({
        camera: hasVideo ? 'granted' : 'denied',
        microphone: hasAudio ? 'granted' : 'denied'
      });

      if (hasVideo || hasAudio) {
        onPermissionsGranted(hasVideo, hasAudio);
      } else {
        setError('Camera and microphone access were both denied. Please enable at least one in your browser settings.');
      }
    } catch (error: any) {
      console.error('Permission request failed:', error);
      setHasRequestedOnce(true);
      
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
      
      setError(errorMessage);
      setPermissions({ camera: 'denied', microphone: 'denied' });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setHasRequestedOnce(false);
    setPermissions({ camera: 'prompt', microphone: 'prompt' });
    onRetry();
  };

  const handleClose = () => {
    setError(null);
    setHasRequestedOnce(false);
    setPermissions({ camera: 'unknown', microphone: 'unknown' });
    onClose();
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'granted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'denied':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getPermissionText = (permission: string, device: string) => {
    switch (permission) {
      case 'granted':
        return `${device} access granted`;
      case 'denied':
        return `${device} access denied`;
      default:
        return `${device} access needed`;
    }
  };

  const canProceed = permissions.camera === 'granted' || permissions.microphone === 'granted';
  const needsPermission = permissions.camera === 'prompt' || permissions.microphone === 'prompt' || permissions.camera === 'unknown' || permissions.microphone === 'unknown';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-500" />
            Camera & Microphone Access
          </DialogTitle>
          <DialogDescription>
            To start video chatting, we need permission to access your camera and microphone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Permission Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              {getPermissionIcon(permissions.camera)}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {getPermissionText(permissions.camera, 'Camera')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {permissions.camera === 'granted' ? 'Ready for video chat' : 
                   permissions.camera === 'denied' ? 'Camera is disabled' : 'Camera permission required'}
                </p>
              </div>
              <Camera className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              {getPermissionIcon(permissions.microphone)}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {getPermissionText(permissions.microphone, 'Microphone')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {permissions.microphone === 'granted' ? 'Ready for audio chat' : 
                   permissions.microphone === 'denied' ? 'Microphone is disabled' : 'Microphone permission required'}
                </p>
              </div>
              {permissions.microphone === 'granted' ? (
                <Mic className="h-4 w-4 text-slate-400" />
              ) : (
                <MicOff className="h-4 w-4 text-slate-400" />
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          {needsPermission && !hasRequestedOnce && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Important:</strong> When you click "Allow Access", your browser will show a permission dialog asking for camera and microphone access. 
                <br /><br />
                <strong>Mobile Users:</strong> Tap "Allow" in the browser's permission dialog to enable camera and microphone access.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isRequesting}
          >
            Cancel
          </Button>
          
          {hasRequestedOnce && !canProceed && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={isRequesting}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          
          {needsPermission && !hasRequestedOnce && (
            <Button
              onClick={requestPermissions}
              disabled={isRequesting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {isRequesting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Requesting Permission...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Request Camera & Microphone Access
                </>
              )}
            </Button>
          )}
          
          {canProceed && (
            <Button
              onClick={() => onPermissionsGranted(
                permissions.camera === 'granted',
                permissions.microphone === 'granted'
              )}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
