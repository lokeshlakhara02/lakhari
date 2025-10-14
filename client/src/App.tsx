import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import ErrorBoundary from "@/components/error-boundary";
import Home from "@/pages/home";
import TextChat from "@/pages/text-chat";
import VideoChat from "@/pages/video-chat";
import WebSocketDebug from "@/pages/websocket-debug";
import NotFound from "@/pages/not-found";
import { Moon, Sun, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loading } from "@/components/ui/loading";
import type { OnlineStats } from "@/types/chat";
import logoImage from "@/components/assets/img/logo.jpg";

// Import WebSocket protection
import "./lib/websocket-protection";

function Header() {
  const { theme, toggleTheme } = useTheme();
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<OnlineStats>({
    queryKey: ['/api/stats'],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-lg animate-slide-in-down">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 sm:h-18 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity bg-gradient-to-br from-primary to-secondary"></div>
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden shadow-xl group-hover:scale-110 transition-transform bg-white">
                  <img 
                    src={logoImage} 
                    alt="Lakhari Logo" 
                    className="w-full h-full object-contain p-0.5"
                  />
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold gradient-text">
                Lakhari
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Session Counter */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20 hover:border-primary/40 transition-all">
              {statsLoading ? (
                <Loading size="sm" />
              ) : statsError ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : stats ? (
                <>
                  <div className="relative">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  </div>
                  <span className="text-sm font-bold" data-testid="header-online-count">
                    {stats.activeUsers.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">online</span>
                </>
              ) : null}
            </div>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="group relative w-10 h-10 rounded-xl hover:bg-primary/10 transition-all"
              data-testid="button-theme-toggle"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {theme === 'dark' ? (
                <Sun className="relative h-5 w-5 text-primary group-hover:rotate-180 transition-transform duration-500" />
              ) : (
                <Moon className="relative h-5 w-5 text-primary group-hover:-rotate-12 transition-transform duration-500" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<OnlineStats>({
    queryKey: ['/api/stats'],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  return (
    <footer className="mt-16 sm:mt-20 border-t border-border/50 bg-gradient-to-b from-background to-card/30 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 mb-12">
          {/* About */}
          <div className="space-y-4 animate-slide-in-left">
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity bg-gradient-to-br from-primary to-secondary"></div>
                <div className="relative w-10 h-10 rounded-2xl overflow-hidden shadow-xl bg-white">
                  <img 
                    src={logoImage} 
                    alt="Lakhari Logo" 
                    className="w-full h-full object-contain p-0.5"
                  />
                </div>
              </div>
              <h4 className="text-lg font-bold gradient-text">Lakhari</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect with random strangers worldwide through anonymous text and video chat. 100% free, no registration required. Experience genuine human connections.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="https://instagram.com/_laxkar.lokesh" target="_blank" rel="noopener noreferrer" className="group w-9 h-9 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center hover:from-primary/20 hover:to-secondary/20 transition-all">
                <span className="text-sm font-bold text-primary group-hover:scale-110 transition-transform">IG</span>
              </a>
            </div>
          </div>

          {/* Creator Info */}
          <div className="space-y-4 animate-slide-in-up animate-delay-100">
            <h4 className="text-lg font-semibold">Created By</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">L</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Lokesh Lakhara</p>
                  <p className="text-xs text-muted-foreground">Full Stack Developer</p>
                </div>
              </div>
              <a href="https://instagram.com/_laxkar.lokesh" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <span className="w-1.5 h-1.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                <span className="group-hover:translate-x-1 transition-transform">Follow on Instagram</span>
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4 animate-slide-in-right animate-delay-200">
            <h4 className="text-lg font-semibold">Platform Stats</h4>
            {statsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 bg-muted/20 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : statsError ? (
              <div className="text-sm text-muted-foreground">
                Stats temporarily unavailable
              </div>
            ) : stats ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20">
                  <span className="text-sm text-muted-foreground">Active Users</span>
                  <span className="font-bold text-primary">{stats.activeUsers.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20">
                  <span className="text-sm text-muted-foreground">Chats Today</span>
                  <span className="font-bold text-secondary">{stats.chatsToday.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20">
                  <span className="text-sm text-muted-foreground">Countries</span>
                  <span className="font-bold text-accent">{stats.countries}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} <span className="font-semibold text-foreground">Lakhari</span>. Created by <span className="font-semibold text-primary">Lokesh Lakhara</span>. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with <span className="text-red-500">❤</span> by <a href="https://instagram.com/_laxkar.lokesh" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@_laxkar.lokesh</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/text-chat" component={TextChat} />
      <Route path="/video-chat" component={VideoChat} />
      <Route path="/debug" component={WebSocketDebug} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const isVideoChatPage = location === '/video-chat';
  const isTextChatPage = location === '/text-chat';
  const isFullScreenPage = isVideoChatPage || isTextChatPage;

  return (
    <div className={`${isFullScreenPage ? 'h-screen' : 'min-h-screen'} flex flex-col ${isFullScreenPage ? 'overflow-hidden' : ''}`}>
      <Header />
      <main className={`${isFullScreenPage ? 'flex-1 min-h-0 overflow-hidden' : 'container mx-auto px-4 py-8 flex-1'}`}>
        <Router />
      </main>
      {!isFullScreenPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
            {/* {process.env.NODE_ENV === 'development' && (
              <ReactQueryDevtools initialIsOpen={false} />
            )} */}
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
