import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
import Home from "@/pages/home";
import TextChat from "@/pages/text-chat";
import VideoChat from "@/pages/video-chat";
import NotFound from "@/pages/not-found";
import { Moon, Sun, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnlineStats } from "@/types/chat";

function Header() {
  const { theme, toggleTheme } = useTheme();
  const { data: stats } = useQuery<OnlineStats>({
    queryKey: ['/api/stats'],
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Video className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">
                ChatRoulette
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Session Counter */}
            {stats && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-border">
                <Users className="h-4 w-4 text-secondary" />
                <span className="text-sm font-medium" data-testid="header-online-count">
                  {stats.activeUsers.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">online</span>
              </div>
            )}

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              data-testid="button-theme-toggle"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { data: stats } = useQuery<OnlineStats>({
    queryKey: ['/api/stats'],
  });

  return (
    <footer className="mt-16 border-t border-border py-8">
      <div className="container mx-auto px-4">
        {/* Bottom Ad Banner */}
        <div className="mb-8">
          <div className="bg-muted/20 rounded-lg p-4 text-center border border-border">
            <p className="text-xs text-muted-foreground">
              <span className="mr-2">📢</span>
              Advertisement Space - Footer Banner
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* About */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Video className="h-4 w-4 text-white" />
              </div>
              ChatRoulette
            </h4>
            <p className="text-sm text-muted-foreground">
              Connect with random strangers worldwide through anonymous text and video chat. 100% free, no registration required.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <span className="mr-2">→</span>
                  How It Works
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <span className="mr-2">→</span>
                  Safety Guidelines
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <span className="mr-2">→</span>
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <span className="mr-2">→</span>
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Stats */}
          <div>
            <h4 className="font-semibold mb-3">Platform Stats</h4>
            <div className="space-y-3">
              {stats && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Users</span>
                    <span className="font-semibold">{stats.activeUsers.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Chats Today</span>
                    <span className="font-semibold">{stats.chatsToday.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Countries</span>
                    <span className="font-semibold">{stats.countries}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 ChatRoulette. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              Twitter
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              Discord
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              Reddit
            </a>
          </div>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-8 flex-1">
        <Router />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
