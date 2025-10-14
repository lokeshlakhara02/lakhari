import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export default function EmojiPicker({ onEmojiSelect, className }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('recent');

  // Curated minimal emoji set - most commonly used
  const emojiCategories = {
    recent: {
      icon: '🕐',
      emojis: ['😊', '❤️', '😂', '👍', '🙏', '😍', '😭', '🎉', '🔥', '💯', '✨', '🤔', '😎', '👏', '💪', '🙌']
    },
    smileys: {
      icon: '😊',
      emojis: ['😊', '😂', '😍', '😭', '😎', '🤔', '😏', '😘', '🥰', '😉', '😇', '🤗', '🤭', '😋', '😜', '🤪', '😌', '😔', '😪', '😴']
    },
    gestures: {
      icon: '👍',
      emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👋', '✌️', '🤞', '👌', '🤙', '🤘', '👊', '✊', '🤛', '🤜', '🤚', '👐', '🙌']
    },
    hearts: {
      icon: '❤️',
      emojis: ['❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝']
    },
    symbols: {
      icon: '✨',
      emojis: ['✨', '🔥', '💯', '⭐', '🌟', '💫', '⚡', '💥', '🎉', '🎊', '🎈', '🎁', '🏆', '👑', '💎', '🔔', '🎵', '🎶']
    }
  };

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`w-9 h-9 p-0 rounded-full hover:bg-primary/10 transition-all duration-200 ${className}`}
        >
          <Smile className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 bg-gradient-to-br from-background/95 to-background/98 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
          <h3 className="text-sm font-semibold text-foreground">Emoji</h3>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 bg-muted/30">
          {Object.entries(emojiCategories).map(([key, { icon }]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex-1 py-2 px-1 text-xl rounded-lg transition-all duration-200 ${
                selectedCategory === key
                  ? 'bg-primary/10 scale-110'
                  : 'hover:bg-muted/50'
              }`}
              title={key}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Emoji Grid */}
        <div className="p-3 max-h-64 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-8 gap-1">
            {emojiCategories[selectedCategory as keyof typeof emojiCategories].emojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 hover:scale-125 transition-all duration-150 text-xl active:scale-95"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
