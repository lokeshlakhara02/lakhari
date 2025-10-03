import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InterestModal } from '@/components/interest-modal';
import { Video, MessageCircle, Shield, Zap, Globe, Heart, Users } from 'lucide-react';
import type { OnlineStats } from '@/types/chat';

export default function Home() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('interests') || '[]');
  });
  const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);

  const { data: stats } = useQuery<OnlineStats>({
    queryKey: ['/api/stats'],
  });

  const handleSaveInterests = (interests: string[]) => {
    setSelectedInterests(interests);
    localStorage.setItem('interests', JSON.stringify(interests));
  };

  const removeInterest = (interestToRemove: string) => {
    const updatedInterests = selectedInterests.filter(interest => interest !== interestToRemove);
    handleSaveInterests(updatedInterests);
  };

  return (
    <div className="animate-slide-in">
      {/* Header Ad Zone */}
      <div className="py-2 border-b border-border/50 mb-8">
        <div className="bg-muted/20 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground">
            <span className="mr-2">📢</span>
            Advertisement Space - Header Banner
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar Ad Zone (Desktop) */}
        <aside className="hidden lg:block lg:col-span-2">
          <div className="sticky top-24 space-y-4">
            <div className="bg-muted/20 rounded-lg p-4 text-center border border-border min-h-[600px] flex items-center justify-center">
              <div>
                <span className="text-4xl mb-2 block">📢</span>
                <p className="text-xs text-muted-foreground">Sidebar Ad<br/>160x600</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Talk to Strangers Anonymously
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect with random people worldwide through text or video chat. 100% free, no registration required.
            </p>
          </div>

          {/* Chat Mode Selection */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Text Chat Card */}
            <div className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20">Popular</Badge>
              </div>
              <h3 className="text-xl font-semibold mb-2">Text Chat</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Anonymous text messaging with strangers. Fast, simple, and completely private.
              </p>
              <Link href="/text-chat">
                <Button 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-start-text-chat"
                >
                  Start Text Chat
                  <span className="ml-2">→</span>
                </Button>
              </Link>
            </div>

            {/* Video Chat Card */}
            <div className="bg-card rounded-xl p-6 border border-border hover:border-secondary/50 transition-all hover:shadow-lg hover:shadow-secondary/5 cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <Video className="h-6 w-6 text-secondary" />
                </div>
                <Badge className="bg-secondary/10 text-secondary border-secondary/20">New</Badge>
              </div>
              <h3 className="text-xl font-semibold mb-2">Video Chat</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Face-to-face conversations with random people. Real human connections.
              </p>
              <Link href="/video-chat">
                <Button 
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  data-testid="button-start-video-chat"
                >
                  Start Video Chat
                  <span className="ml-2">→</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Interest Tags Section */}
          <div className="bg-card rounded-xl p-6 border border-border mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Find Like-minded People</h3>
                <p className="text-sm text-muted-foreground">Add interests to match with strangers who share your passions</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setIsInterestModalOpen(true)}
                className="text-primary hover:text-primary/80"
                data-testid="button-add-interests"
              >
                <span className="mr-1">+</span>
                Add Interests
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {selectedInterests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interests selected. Add some to find like-minded strangers!</p>
              ) : (
                selectedInterests.map((interest) => (
                  <Badge
                    key={interest}
                    variant="secondary"
                    className="font-mono flex items-center gap-2"
                    data-testid={`interest-badge-${interest}`}
                  >
                    #{interest}
                    <button
                      onClick={() => removeInterest(interest)}
                      className="hover:text-destructive"
                      data-testid={`remove-interest-${interest}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-card/50 rounded-lg p-4 border border-border">
              <Shield className="h-8 w-8 text-primary mb-3" />
              <h4 className="font-semibold mb-1">100% Anonymous</h4>
              <p className="text-sm text-muted-foreground">No registration, no personal data required</p>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border border-border">
              <Zap className="h-8 w-8 text-secondary mb-3" />
              <h4 className="font-semibold mb-1">Instant Connect</h4>
              <p className="text-sm text-muted-foreground">Start chatting in seconds with one click</p>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border border-border">
              <Globe className="h-8 w-8 text-accent mb-3" />
              <h4 className="font-semibold mb-1">Global Community</h4>
              <p className="text-sm text-muted-foreground">Connect with people from around the world</p>
            </div>
          </div>

          {/* Online Stats */}
          {stats && (
            <div className="mt-8 bg-card/50 rounded-lg p-6 border border-border">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Platform Stats
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="stats-active-users">
                    {stats.activeUsers.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-secondary" data-testid="stats-chats-today">
                    {stats.chatsToday.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Chats Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent" data-testid="stats-countries">
                    {stats.countries}
                  </div>
                  <div className="text-sm text-muted-foreground">Countries</div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Ad Zone (Mobile) */}
          <div className="mt-8 lg:hidden">
            <div className="bg-muted/20 rounded-lg p-4 text-center border border-border">
              <p className="text-xs text-muted-foreground">
                <span className="mr-2">📢</span>
                Advertisement Space - Bottom Banner
              </p>
            </div>
          </div>
        </div>

        {/* Right Sidebar Ad Zone (Desktop) */}
        <aside className="hidden lg:block lg:col-span-2">
          <div className="sticky top-24 space-y-4">
            <div className="bg-muted/20 rounded-lg p-4 text-center border border-border min-h-[600px] flex items-center justify-center">
              <div>
                <span className="text-4xl mb-2 block">📢</span>
                <p className="text-xs text-muted-foreground">Right Sidebar Ad<br/>160x600</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <InterestModal
        isOpen={isInterestModalOpen}
        onClose={() => setIsInterestModalOpen(false)}
        selectedInterests={selectedInterests}
        onSaveInterests={handleSaveInterests}
      />
    </div>
  );
}
