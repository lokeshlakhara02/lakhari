import { WebSocketDebug } from '@/components/websocket-debug';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function WebSocketDebugPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-2xl font-bold">WebSocket Debug Tool</h1>
              <p className="text-muted-foreground">Diagnose connection issues</p>
            </div>
          </div>
        </div>

        {/* Debug Component */}
        <WebSocketDebug />
      </div>
    </div>
  );
}
