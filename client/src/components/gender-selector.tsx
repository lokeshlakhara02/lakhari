import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { User, Users, Heart } from 'lucide-react';

interface GenderSelectorProps {
  onGenderSelect: (gender: 'male' | 'female' | 'other') => void;
  selectedGender?: 'male' | 'female' | 'other' | null;
  disabled?: boolean;
}

export function GenderSelector({ onGenderSelect, selectedGender, disabled = false }: GenderSelectorProps) {
  const genderOptions = [
    {
      value: 'male' as const,
      label: 'Male',
      icon: User,
      description: 'I identify as male',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      value: 'female' as const,
      label: 'Female', 
      icon: Users,
      description: 'I identify as female',
      color: 'bg-pink-500 hover:bg-pink-600'
    },
    {
      value: 'other' as const,
      label: 'Other',
      icon: Heart,
      description: 'I identify differently',
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-semibold">Select Your Gender</CardTitle>
        <CardDescription>
          This helps us find better matches for you. Your preference will be respected in matching.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {genderOptions.map((option) => {
          const IconComponent = option.icon;
          const isSelected = selectedGender === option.value;
          
          return (
            <Button
              key={option.value}
              variant={isSelected ? "default" : "outline"}
              className={`w-full justify-start h-auto p-4 ${
                isSelected 
                  ? option.color 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => onGenderSelect(option.value)}
              disabled={disabled}
            >
              <div className="flex items-center space-x-3">
                <IconComponent className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm opacity-75">{option.description}</div>
                </div>
              </div>
            </Button>
          );
        })}
        
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Matching Algorithm:</strong> Male users are prioritized to match with female users, 
            and female users are prioritized to match with male users. Other identities are matched 
            with appropriate preferences.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
