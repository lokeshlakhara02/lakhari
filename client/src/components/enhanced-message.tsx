import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Download, Eye, EyeOff } from 'lucide-react';
import type { Message } from '@/types/chat';

interface EnhancedMessageProps {
  message: Message;
  className?: string;
}

export default function EnhancedMessage({ message, className }: EnhancedMessageProps) {
  const [showFullImage, setShowFullImage] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleImageClick = (attachmentId: string) => {
    setShowFullImage(attachmentId);
  };

  const handleAudioPlay = (attachmentId: string, url: string) => {
    if (playingAudio === attachmentId) {
      setPlayingAudio(null);
      return;
    }

    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => setPlayingAudio(null);
    
    audio.play().then(() => {
      setPlayingAudio(attachmentId);
    }).catch(error => {
      console.error('Error playing audio:', error);
      setPlayingAudio(null);
    });
  };

  const handleFileDownload = (attachment: any) => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderAttachment = (attachment: any) => {
    switch (attachment.type) {
      case 'image':
        return (
          <div className="mt-2">
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => handleImageClick(attachment.id)}
              loading="lazy"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {attachment.filename} ({formatFileSize(attachment.size)})
            </p>
          </div>
        );

      case 'video':
        return (
          <div className="mt-2">
            <video
              src={attachment.url}
              controls
              className="max-w-full h-auto rounded-lg"
              preload="metadata"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {attachment.filename} ({formatFileSize(attachment.size)})
            </p>
          </div>
        );

      case 'audio':
        return (
          <div className="mt-2 flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAudioPlay(attachment.id, attachment.url)}
              className="w-8 h-8 p-0"
            >
              {playingAudio === attachment.id ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {attachment.filename}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(attachment.size)}
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="mt-2 flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {attachment.filename}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(attachment.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleFileDownload(attachment)}
              className="w-8 h-8 p-0"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );
    }
  };

  return (
    <div className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'} ${className}`}>
      <div className={`group max-w-[85%] relative ${
        message.isOwn 
          ? 'bg-gradient-to-br from-primary to-primary/90 text-white shadow-lg shadow-primary/20' 
          : 'bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg'
      } rounded-2xl px-4 py-3 hover:shadow-xl transition-all duration-300`}
      style={{
        borderRadius: message.isOwn ? '20px 20px 4px 20px' : '20px 20px 20px 4px'
      }}>
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        
        {/* Message Content */}
        {message.content && (
          <div className="relative text-sm leading-relaxed whitespace-pre-wrap break-words mb-1">
            {message.content}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-1">
            {message.attachments.map((attachment) => (
              <div key={attachment.id} className="mb-1">
                {renderAttachment(attachment)}
              </div>
            ))}
          </div>
        )}

        {/* Message Timestamp and Status */}
        <div className={`relative flex items-center justify-end gap-1.5 mt-2 ${
          message.isOwn ? 'text-white/80' : 'text-muted-foreground'
        }`}>
          <span className="text-xs font-medium">
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          {message.isOwn && (
            <div className="flex items-center">
              <svg className="w-3.5 h-3.5 drop-shadow-sm" viewBox="0 0 16 15" fill="currentColor">
                <path d="M15.8545 0.854503C16.0498 0.65924 16.0498 0.342658 15.8545 0.147396C15.6593 -0.0478664 15.3427 -0.0478664 15.1474 0.147396L5.85355 9.44129C5.65829 9.63655 5.34171 9.63655 5.14645 9.44129L0.852539 5.14739C0.657277 4.95212 0.340695 4.95212 0.145433 5.14739C-0.0498294 5.34265 -0.0498294 5.65924 0.145433 5.8545L5.14645 10.8555C5.34171 11.0508 5.65829 11.0508 5.85355 10.8555L15.8545 0.854503Z"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Full Image Modal */}
      {showFullImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFullImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={message.attachments?.find(att => att.id === showFullImage)?.url}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullImage(null)}
              className="absolute top-4 right-4 w-8 h-8 p-0 bg-black/50 hover:bg-black/70 text-white"
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
