import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Image as ImageIcon } from 'lucide-react';
import EmojiPicker from './emoji-picker';
import FileUpload from './file-upload';
import type { Attachment } from '@/types/chat';

interface EnhancedMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function EnhancedMessageInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  className = ""
}: EnhancedMessageInputProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-resize input based on content
  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      // Reset height to auto to get the correct scrollHeight
      input.style.height = 'auto';
      // Set height to scrollHeight to fit content
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!value.trim() && attachments.length === 0) return;
    
    onSend(value.trim(), attachments);
    setValue('');
    setAttachments([]); // Clear attachments after sending
  };

  // Clear attachments when component unmounts (chat ends)
  useEffect(() => {
    return () => {
      setAttachments([]);
    };
  }, []);

  const setValue = (newValue: string) => {
    onChange(newValue);
  };

  const handleEmojiSelect = (emoji: string) => {
    const newValue = value + emoji;
    setValue(newValue);
    inputRef.current?.focus();
  };

  const handleFileSelect = async (file: File) => {
    try {
      // Convert file to base64 for now (in a real app, you'd upload to a server)
      const base64 = await fileToBase64(file);
      
      const attachment: Attachment = {
        id: Date.now().toString(),
        type: getFileType(file.type),
        url: base64,
        filename: file.name,
        size: file.size,
        mimeType: file.type
      };

      setAttachments(prev => [...prev, attachment]);
    } catch (error) {
      // Only log in development mode to reduce Railway rate limits
      if (process.env.NODE_ENV === 'development') {
        console.error('Error processing file:', error);
      }
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const hasContent = value.trim() || attachments.length > 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600 shadow-sm">
              {attachment.type === 'image' && (
                <img 
                  src={attachment.url} 
                  alt={attachment.filename}
                  className="w-8 h-8 object-cover rounded"
                />
              )}
              {attachment.type !== 'image' && (
                <ImageIcon className="w-8 h-8 text-gray-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                  {attachment.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(attachment.size / 1024).toFixed(1)}KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAttachment(attachment.id)}
                className="w-6 h-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

        {/* Input Area - Modern Glassmorphism */}
        <div className="flex items-end gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-card/95 to-card/90 backdrop-blur-xl border-t border-border/50">
          {/* Emoji Picker */}
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            className="flex-shrink-0"
          />

          {/* File Upload Button */}
          <FileUpload
            onFileSelect={handleFileSelect}
            className="flex-shrink-0"
          />

          {/* Text Input */}
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-border/50 focus:ring-2 focus:ring-primary focus:border-primary rounded-2xl text-sm min-h-[40px] max-h-[120px] resize-none px-4 py-2.5 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              style={{ height: 'auto' }}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={disabled || !hasContent}
            size="sm"
            className="group relative w-10 h-10 sm:w-11 sm:h-11 p-0 rounded-full bg-gradient-to-br from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 hover:scale-110"
          >
            <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Send className="relative h-5 w-5" />
          </Button>
        </div>
    </div>
  );
}

// Helper functions
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

function getFileType(mimeType: string): Attachment['type'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}
