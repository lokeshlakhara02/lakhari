import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, Image, File, Upload, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  maxSizeBytes?: number;
  acceptedTypes?: string[];
  className?: string;
}

export default function FileUpload({ 
  onFileSelect, 
  maxSizeBytes = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'],
  className 
}: FileUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${Math.round(maxSizeBytes / (1024 * 1024))}MB`;
    }

    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return 'File type not supported';
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    setUploadError(null);
    onFileSelect(file);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const getSupportedTypesText = () => {
    const types = [];
    if (acceptedTypes.includes('image/*')) types.push('Images');
    if (acceptedTypes.includes('video/*')) types.push('Videos');
    if (acceptedTypes.includes('audio/*')) types.push('Audio');
    if (acceptedTypes.includes('application/pdf')) types.push('PDFs');
    if (acceptedTypes.includes('text/*')) types.push('Text files');
    
    return types.join(', ');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`w-8 h-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
        >
          <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg"
        align="end"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
              Upload File
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supported: {getSupportedTypesText()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Max size: {Math.round(maxSizeBytes / (1024 * 1024))}MB
            </p>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUploadError(null)}
                className="h-4 w-4 p-0 ml-auto"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Drag and drop a file here
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">
                or click to browse
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                Choose File
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
