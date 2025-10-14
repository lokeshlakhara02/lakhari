import React, { useState } from 'react';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { User, Users, Heart, ChevronDown } from 'lucide-react';

interface QuickGenderSelectorProps {
  currentGender: 'male' | 'female' | 'other' | null;
  onGenderChange: (gender: 'male' | 'female' | 'other') => void;
  disabled?: boolean;
}

export function QuickGenderSelector({ currentGender, onGenderChange, disabled = false }: QuickGenderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getGenderIcon = (gender: string | null) => {
    switch (gender) {
      case 'male': return <User className="h-4 w-4" />;
      case 'female': return <Users className="h-4 w-4" />;
      case 'other': return <Heart className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getGenderLabel = (gender: string | null) => {
    switch (gender) {
      case 'male': return 'Male';
      case 'female': return 'Female';
      case 'other': return 'Other';
      default: return 'Gender';
    }
  };

  const getGenderColor = (gender: string | null) => {
    switch (gender) {
      case 'male': return 'text-blue-400';
      case 'female': return 'text-pink-400';
      case 'other': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const handleGenderSelect = (gender: 'male' | 'female' | 'other') => {
    onGenderChange(gender);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`group relative w-auto h-10 sm:h-14 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:scale-110 px-3 sm:px-4 ${getGenderColor(currentGender)}`}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative flex items-center gap-2">
            {getGenderIcon(currentGender)}
            <span className="hidden sm:inline text-sm font-medium">
              {getGenderLabel(currentGender)}
            </span>
            <ChevronDown className="h-3 w-3" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="center" 
        className="w-48 bg-black/90 backdrop-blur-xl border border-white/20 shadow-2xl"
        sideOffset={8}
      >
        <DropdownMenuItem 
          onClick={() => handleGenderSelect('male')}
          className="flex items-center gap-3 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 focus:bg-blue-500/20 focus:text-blue-300"
        >
          <User className="h-4 w-4" />
          <span>Male</span>
          {currentGender === 'male' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleGenderSelect('female')}
          className="flex items-center gap-3 text-pink-400 hover:bg-pink-500/20 hover:text-pink-300 focus:bg-pink-500/20 focus:text-pink-300"
        >
          <Users className="h-4 w-4" />
          <span>Female</span>
          {currentGender === 'female' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleGenderSelect('other')}
          className="flex items-center gap-3 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 focus:bg-purple-500/20 focus:text-purple-300"
        >
          <Heart className="h-4 w-4" />
          <span>Other</span>
          {currentGender === 'other' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
