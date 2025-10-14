import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SetupModal } from '@/components/setup-modal';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  MessageCircle, 
  Shield, 
  Zap, 
  Globe, 
  Heart, 
  Users, 
  AlertCircle,
  Lock,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Play,
  ChevronDown,
  Star,
  MessageSquare,
  UserCheck,
  Clock
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { OnlineStats } from '@/types/chat';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Animated Counter Component
function AnimatedCounter({ end, duration = 2000 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const countRef = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(easeOutQuart * end);
      
      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, isVisible]);

  return <span ref={countRef}>{count.toLocaleString()}</span>;
}

export default function Home() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('interests') || '[]');
  });
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'other' | null>(() => {
    return localStorage.getItem('gender') as 'male' | 'female' | 'other' | null || null;
  });
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [showScrollCTA, setShowScrollCTA] = useState(false);
  
  // Refs for GSAP animations
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<OnlineStats>({
    queryKey: ['/api/stats'],
    refetchInterval: 30000, // 30 seconds instead of 5 seconds
    refetchIntervalInBackground: true,
    staleTime: 15000, // 15 seconds
  });

  // GSAP Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance animations
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      
      tl.from(titleRef.current, {
        y: 100,
        opacity: 0,
        duration: 1,
        scale: 0.8
      })
      .from(subtitleRef.current, {
        y: 50,
        opacity: 0,
        duration: 0.8
      }, '-=0.5')
      .from(ctaRef.current?.children || [], {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.2
      }, '-=0.4');

      // Parallax effect for background elements
      if (backgroundRef.current) {
        const circles = backgroundRef.current.querySelectorAll('.parallax-circle');
        circles.forEach((circle, index) => {
          gsap.to(circle, {
            y: -150 * (index + 1),
            scrollTrigger: {
              trigger: heroRef.current,
              start: 'top top',
              end: 'bottom top',
              scrub: true
            }
          });
        });
      }

      // Features animation
      if (featuresRef.current) {
        const featureCards = featuresRef.current.querySelectorAll('.feature-card');
        featureCards.forEach((card, index) => {
          gsap.from(card, {
            y: 80,
            opacity: 0,
            duration: 0.8,
            scrollTrigger: {
              trigger: card,
              start: 'top 80%',
              end: 'top 50%',
              toggleActions: 'play none none reverse'
            }
          });
        });
      }

      // Stats counter animation
      if (statsRef.current) {
        gsap.from(statsRef.current, {
          y: 100,
          opacity: 0,
          duration: 1,
          scrollTrigger: {
            trigger: statsRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        });
      }
    });

    return () => ctx.revert();
  }, []);

  // Handle scroll for sticky CTA
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollCTA(window.scrollY > 800);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSaveSetup = (interests: string[], gender: 'male' | 'female' | 'other') => {
    setSelectedInterests(interests);
    setSelectedGender(gender);
    localStorage.setItem('interests', JSON.stringify(interests));
    localStorage.setItem('gender', gender);
  };

  const removeInterest = (interestToRemove: string) => {
    const updatedInterests = selectedInterests.filter(interest => interest !== interestToRemove);
    setSelectedInterests(updatedInterests);
    localStorage.setItem('interests', JSON.stringify(updatedInterests));
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="animate-slide-in min-h-screen relative">
      {/* Sticky Floating CTA */}
      <div 
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
          showScrollCTA ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'
        }`}
      >
        <Link href="/video-chat">
          <Button 
            size="lg"
            className="group relative px-6 py-6 text-base font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-2xl hover:shadow-primary/50 transition-all duration-300 rounded-full"
          >
            <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
            Start Chatting
          </Button>
        </Link>
      </div>

      {/* Hero Section with Parallax Effects */}
      <div ref={heroRef} className="relative overflow-hidden min-h-[90vh] flex items-center justify-center">
        {/* Parallax Background Elements */}
        <div ref={backgroundRef} className="absolute inset-0 -z-10 overflow-hidden">
          <div className="parallax-circle absolute top-20 left-10 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
          <div className="parallax-circle absolute bottom-20 right-10 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-3xl" />
          <div className="parallax-circle absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
          
          {/* Animated Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_110%)]" />
        </div>

        {/* Hero Content - More Compact */}
        <div className="text-center px-4 max-w-5xl mx-auto z-10">
          {/* Content Wrapper with Background for Better Visibility */}
          <div className="bg-background/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl border border-border/30">
            {/* Main Title */}
            <h1 ref={titleRef} className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 text-balance leading-[1.1] tracking-tight">
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent drop-shadow-2xl" style={{ WebkitTextStroke: '1px rgba(147, 51, 234, 0.3)' }}>
                Meet Strangers,<br />
                Make Connections
              </span>
            </h1>
            
            {/* Subtitle */}
            <p ref={subtitleRef} className="text-lg md:text-xl text-foreground font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
              Connect instantly with random people worldwide. Anonymous, free, and no registration required.
            </p>

            {/* Primary CTA Buttons - More Prominent */}
            <div ref={ctaRef} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/video-chat">
              <Button 
                size="lg"
                className="group relative w-full sm:w-auto px-12 py-8 text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent hover:from-primary/90 hover:via-secondary/90 hover:to-accent/90 shadow-2xl hover:shadow-primary/50 transition-all duration-300 rounded-2xl overflow-hidden min-w-[280px]"
                data-testid="button-start-video-chat"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                <Video className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform relative z-10" />
                <span className="relative z-10">Video Chat</span>
                <ArrowRight className="h-6 w-6 ml-3 group-hover:translate-x-2 transition-transform relative z-10" />
              </Button>
            </Link>
            
            <Link href="/text-chat">
              <Button 
                size="lg"
                variant="outline"
                className="group w-full sm:w-auto px-12 py-8 text-xl font-bold border-2 bg-card/30 hover:bg-card/50 backdrop-blur-md rounded-2xl transition-all duration-300 hover:border-primary/50 hover:shadow-xl min-w-[280px]"
                data-testid="button-start-text-chat"
              >
                <MessageCircle className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
                Text Chat
                <ArrowRight className="h-6 w-6 ml-3 group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>
            </div>

            {/* Quick Features - Inline */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 backdrop-blur-md border border-primary/30 shadow-lg">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">Anonymous</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary/10 backdrop-blur-md border border-secondary/30 shadow-lg">
                <Zap className="h-4 w-4 text-secondary" />
                <span className="font-semibold text-foreground">Instant</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent/10 backdrop-blur-md border border-accent/30 shadow-lg">
                <Globe className="h-4 w-4 text-accent" />
                <span className="font-semibold text-foreground">Global</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-500/10 backdrop-blur-md border border-green-500/30 shadow-lg">
                <Lock className="h-4 w-4 text-green-500" />
                <span className="font-semibold text-foreground">Secure</span>
              </div>
            </div>
          </div>

          {/* Scroll Indicator - Outside the background box */}
          <button 
            onClick={() => scrollToSection('features')}
            className="mt-8 animate-bounce inline-flex flex-col items-center gap-2 text-foreground hover:text-primary transition-colors cursor-pointer"
            aria-label="Scroll to features"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 py-16" id="features">
        {/* Features Grid with Enhanced Design */}
        <div ref={featuresRef} className="mb-20">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
              Why Choose Our Platform?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experience the best way to connect with strangers around the world
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="feature-card group relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm rounded-3xl p-8 border border-border hover:border-primary/50 transition-all duration-500 card-hover overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 flex items-center gap-2">
                  100% Anonymous
                  <CheckCircle2 className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  No registration, no personal data required. Your privacy is our top priority.
                </p>
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">End-to-end security</span>
                </div>
              </div>
            </div>

            <div className="feature-card group relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm rounded-3xl p-8 border border-border hover:border-secondary/50 transition-all duration-500 card-hover overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <Zap className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 flex items-center gap-2">
                  Instant Connect
                  <CheckCircle2 className="h-5 w-5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Start chatting in seconds with one click. No waiting, no hassle, just connect.
                </p>
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Connect in &lt;3 seconds</span>
                </div>
              </div>
            </div>

            <div className="feature-card group relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm rounded-3xl p-8 border border-border hover:border-accent/50 transition-all duration-500 card-hover overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-accent/30 to-accent/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <Globe className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 flex items-center gap-2">
                  Global Community
                  <CheckCircle2 className="h-5 w-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Connect with people from every corner of the world. Every chat is unique.
                </p>
                <div className="flex items-center gap-2 text-sm text-accent">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{stats?.countries || '150'}+ countries</span>
                </div>
              </div>
            </div>

            <div className="feature-card group relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm rounded-3xl p-8 border border-border hover:border-primary/50 transition-all duration-500 card-hover overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500/30 to-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <Video className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">HD Video Quality</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Crystal clear video and audio quality for the best chat experience.
                </p>
                <div className="flex items-center gap-2 text-sm text-purple-500">
                  <Star className="h-4 w-4" />
                  <span className="font-medium">1080p support</span>
                </div>
              </div>
            </div>

            <div className="feature-card group relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm rounded-3xl p-8 border border-border hover:border-secondary/50 transition-all duration-500 card-hover overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500/30 to-green-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <MessageSquare className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Rich Messaging</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Send text, emojis, and files. Express yourself in multiple ways.
                </p>
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">Multiple formats</span>
                </div>
              </div>
            </div>

            <div className="feature-card group relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm rounded-3xl p-8 border border-border hover:border-accent/50 transition-all duration-500 card-hover overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500/30 to-orange-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <UserCheck className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Smart Matching</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Find compatible people who share your interests and preferences.
                </p>
                <div className="flex items-center gap-2 text-sm text-orange-500">
                  <Heart className="h-4 w-4" />
                  <span className="font-medium">Smart matching</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interest Tags Section */}
        <div className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm rounded-3xl p-10 border border-border mb-20 animate-scale-in shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h3 className="text-3xl font-semibold mb-3 flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center">
                <Heart className="h-6 w-6 text-primary" />
                </div>
                Find Like-minded People
              </h3>
              <p className="text-muted-foreground text-lg">Add interests to match with strangers who share your passions</p>
            </div>
            <Button
              onClick={() => setIsSetupModalOpen(true)}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-md hover:shadow-lg transition-all rounded-xl px-6 py-6 text-base"
              data-testid="button-add-interests"
            >
              <span className="mr-2">+</span>
              Setup Profile
            </Button>
          </div>

          {/* Gender Display */}
          {selectedGender && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Your Gender</h3>
                <Badge variant="outline" className="px-3 py-1">
                  {selectedGender === 'male' ? '👨 Male' : 
                   selectedGender === 'female' ? '👩 Female' : 
                   '🌈 Other'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                This helps us find compatible matches for you.
              </p>
            </div>
          )}
          
          <div className="flex flex-wrap gap-3">
            {selectedInterests.length === 0 ? (
              <div className="w-full text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Heart className="h-10 w-10 text-primary" />
                </div>
                <p className="text-muted-foreground text-lg mb-4">No interests selected yet.</p>
                <p className="text-muted-foreground text-sm">Add some to find like-minded strangers!</p>
              </div>
            ) : (
              selectedInterests.map((interest, index) => (
                <Badge
                  key={interest}
                  variant="secondary"
                  className="px-5 py-3 text-base font-medium flex items-center gap-2 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 hover:border-primary/40 hover:scale-105 transition-all rounded-full animate-scale-in cursor-pointer"
                  style={{ animationDelay: `${index * 50}ms` }}
                  data-testid={`interest-badge-${interest}`}
                >
                  #{interest}
                  <button
                    onClick={() => removeInterest(interest)}
                    className="hover:text-destructive transition-colors ml-1 text-lg font-bold"
                    data-testid={`remove-interest-${interest}`}
                  >
                    ×
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Live Stats with Animated Counters */}
        <div ref={statsRef} className="relative bg-gradient-to-br from-card to-card/30 backdrop-blur-sm rounded-3xl p-12 border border-border shadow-2xl overflow-hidden mb-20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 opacity-50" />
          <div className="relative z-10">
            <div className="text-center mb-10">
              <Badge className="mb-4 px-4 py-2 bg-primary/10 text-primary border-primary/20">
                <TrendingUp className="h-3 w-3 mr-1" />
                Real-Time Analytics
              </Badge>
              <h3 className="text-3xl md:text-4xl font-semibold mb-2 flex items-center justify-center gap-3">
                <Users className="h-8 w-8 text-primary" />
            Live Platform Stats
          </h3>
              <p className="text-muted-foreground text-lg">Updated every 5 seconds</p>
            </div>
          {statsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                    <div className="h-16 bg-muted/20 rounded-xl animate-pulse mb-4"></div>
                    <div className="h-4 bg-muted/20 rounded animate-pulse w-32 mx-auto"></div>
                </div>
              ))}
            </div>
          ) : statsError ? (
            <Alert className="bg-destructive/10 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Unable to load platform stats. Please try again later.
              </AlertDescription>
            </Alert>
          ) : stats ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
              <div className="text-center group">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse"></div>
                    <div className="relative text-5xl md:text-6xl font-bold gradient-text" data-testid="stats-active-users">
                      <AnimatedCounter end={stats.activeUsers} />
                    </div>
                  </div>
                  <div className="text-base font-semibold text-muted-foreground uppercase tracking-wide mb-3">Active Users</div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm rounded-full border border-primary/20">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    Live Now
                  </div>
                </div>
                <div className="text-center group">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-secondary/30 blur-2xl rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                    <div className="relative text-5xl md:text-6xl font-bold gradient-text" data-testid="stats-chats-today">
                      <AnimatedCounter end={stats.chatsToday} />
                </div>
              </div>
                  <div className="text-base font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chats Today</div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary text-sm rounded-full border border-secondary/20">
                    <MessageCircle className="h-4 w-4" />
                    And counting
                  </div>
                </div>
                <div className="text-center group">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-accent/30 blur-2xl rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
                    <div className="relative text-5xl md:text-6xl font-bold gradient-text" data-testid="stats-countries">
                      <AnimatedCounter end={stats.countries} duration={1500} />+
                    </div>
              </div>
                  <div className="text-base font-semibold text-muted-foreground uppercase tracking-wide mb-3">Countries</div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent text-sm rounded-full border border-accent/20">
                    <Globe className="h-4 w-4" />
                    Worldwide
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-20" id="faq">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-accent/10 text-accent border-accent/20">
              <AlertCircle className="h-3 w-3 mr-1" />
              FAQ
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about our platform
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border px-6 overflow-hidden">
                <AccordionTrigger className="text-lg font-semibold hover:text-primary transition-colors py-6">
                  Is the platform really free?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  Yes! Our platform is 100% free to use. No hidden fees, no subscription required. 
                  We believe in providing a free space for people to connect and make new friends worldwide.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border px-6 overflow-hidden">
                <AccordionTrigger className="text-lg font-semibold hover:text-primary transition-colors py-6">
                  Do I need to register or provide personal information?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  No registration required! You can start chatting immediately without providing any personal 
                  information. Your privacy and anonymity are our top priorities. We don't store chat logs or 
                  collect personal data.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border px-6 overflow-hidden">
                <AccordionTrigger className="text-lg font-semibold hover:text-primary transition-colors py-6">
                  How does interest matching work?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  You can add interests that you're passionate about. Our algorithm then tries to match you with 
                  strangers who share similar interests. This increases the chances of having more meaningful and 
                  engaging conversations. You can add or remove interests anytime.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border px-6 overflow-hidden">
                <AccordionTrigger className="text-lg font-semibold hover:text-primary transition-colors py-6">
                  Is video chat safe and secure?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  Yes! We use WebRTC technology which provides peer-to-peer encrypted connections. Your video 
                  streams are not stored on our servers. However, please exercise caution and common sense when 
                  chatting with strangers. Use our report feature if you encounter inappropriate behavior.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border px-6 overflow-hidden">
                <AccordionTrigger className="text-lg font-semibold hover:text-primary transition-colors py-6">
                  Can I skip to the next person?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  Absolutely! If you're not enjoying a conversation or want to meet someone new, you can skip to 
                  the next stranger at any time. Simply click the "Next" button and you'll be instantly matched 
                  with another random person.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border px-6 overflow-hidden">
                <AccordionTrigger className="text-lg font-semibold hover:text-primary transition-colors py-6">
                  What should I do if I encounter inappropriate behavior?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  Use the report button immediately. We take inappropriate behavior seriously and will take action. 
                  You can also skip to the next person right away. Please help us maintain a safe and friendly 
                  community by reporting any violations.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Final CTA */}
          <div className="text-center mt-16">
            <p className="text-xl text-muted-foreground mb-6">Ready to meet new people?</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/video-chat">
                <Button 
                  size="lg"
                  className="group px-10 py-7 text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-xl hover:shadow-2xl transition-all rounded-2xl"
                >
                  <Video className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                  Start Video Chat
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/text-chat">
                <Button 
                  size="lg"
                  variant="outline"
                  className="group px-10 py-7 text-lg font-semibold border-2 hover:bg-card/50 rounded-2xl transition-all"
                >
                  <MessageCircle className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                  Start Text Chat
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <SetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        selectedInterests={selectedInterests}
        selectedGender={selectedGender}
        onSaveSetup={handleSaveSetup}
      />
    </div>
  );
}
