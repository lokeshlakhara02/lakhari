import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { GenderSelector } from './gender-selector';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInterests: string[];
  selectedGender?: 'male' | 'female' | 'other' | null;
  onSaveSetup: (interests: string[], gender: 'male' | 'female' | 'other') => void;
}

const popularInterests = [
  'technology', 'gaming', 'music', 'movies', 'sports', 'travel', 
  'art', 'photography', 'cooking', 'fitness', 'books', 'science',
  'anime', 'fashion', 'dance', 'nature', 'programming', 'design'
];

const allInterests = [
  ...popularInterests,
  'cryptocurrency', 'meditation', 'yoga', 'gardening', 'pets',
  'history', 'philosophy', 'psychology', 'economics', 'politics',
  'languages', 'education', 'health', 'business', 'startup',
  'investment', 'real-estate', 'automotive', 'environment'
];

type SetupStep = 'gender' | 'interests';

export function SetupModal({ isOpen, onClose, selectedInterests, selectedGender, onSaveSetup }: SetupModalProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('gender');
  const [tempSelected, setTempSelected] = useState<string[]>([]);
  const [tempGender, setTempGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [customInterest, setCustomInterest] = useState('');

  useEffect(() => {
    setTempSelected([...selectedInterests]);
    setTempGender(selectedGender || null);
  }, [selectedInterests, selectedGender, isOpen]);

  const toggleInterest = (interest: string) => {
    setTempSelected(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    const interest = customInterest.trim().toLowerCase();
    if (interest && !tempSelected.includes(interest)) {
      setTempSelected(prev => [...prev, interest]);
      setCustomInterest('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addCustomInterest();
    }
  };

  const clearAll = () => {
    setTempSelected([]);
  };

  const nextStep = () => {
    if (currentStep === 'gender' && tempGender) {
      setCurrentStep('interests');
    }
  };

  const prevStep = () => {
    setCurrentStep('gender');
  };

  const saveSetup = () => {
    if (tempGender) {
      onSaveSetup(tempSelected, tempGender);
      onClose();
    }
  };

  const canProceed = () => {
    if (currentStep === 'gender') {
      return tempGender !== null;
    }
    return true; // Interests are optional
  };

  const renderGenderStep = () => (
    <div className="space-y-6">
      <GenderSelector
        onGenderSelect={setTempGender}
        selectedGender={tempGender}
      />
      
      <div className="flex justify-end">
        <Button 
          onClick={nextStep} 
          disabled={!canProceed()}
          className="flex items-center gap-2"
        >
          Continue to Interests
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderInterestsStep = () => (
    <div className="space-y-6">
      {/* Popular Interests */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Popular
        </h4>
        <div className="flex flex-wrap gap-2">
          {popularInterests.map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              className={`px-4 py-2 rounded-full text-sm font-mono transition-all ${
                tempSelected.includes(interest)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border hover:bg-primary hover:text-primary-foreground'
              }`}
            >
              #{interest}
            </button>
          ))}
        </div>
      </div>

      {/* All Categories */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          All Categories
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {allInterests.filter(interest => !popularInterests.includes(interest)).map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              className={`px-3 py-2 rounded-lg text-sm font-mono text-left transition-all ${
                tempSelected.includes(interest)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border hover:bg-primary hover:text-primary-foreground'
              }`}
            >
              #{interest}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Interest Input */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Add Custom
        </h4>
        <div className="flex gap-2">
          <Input
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your interest..."
            className="flex-1"
          />
          <Button onClick={addCustomInterest}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Selected Interests Display */}
      <div className="bg-muted/20 rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Selected Interests</h4>
          <span className="text-xs text-muted-foreground">
            {tempSelected.length} selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tempSelected.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interests selected (optional)</p>
          ) : (
            tempSelected.map((interest) => (
              <Badge
                key={interest}
                variant="secondary"
                className="font-mono"
              >
                #{interest}
                <button
                  onClick={() => toggleInterest(interest)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={prevStep}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Gender
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={clearAll}
          >
            Clear All
          </Button>
          <Button onClick={saveSetup}>
            Start Chatting
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'gender' ? 'Setup Your Profile' : 'Select Your Interests'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {currentStep === 'gender' 
              ? 'Tell us about yourself to get better matches'
              : 'Choose topics to match with like-minded strangers (optional)'
            }
          </p>
        </DialogHeader>

        {currentStep === 'gender' ? renderGenderStep() : renderInterestsStep()}
      </DialogContent>
    </Dialog>
  );
}
