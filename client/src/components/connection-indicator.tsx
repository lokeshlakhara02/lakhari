import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface ConnectionIndicatorProps {
  connectionQuality: 'good' | 'poor' | 'unknown';
  lastHeartbeat: Date | null;
  className?: string;
}

export function ConnectionIndicator({ 
  connectionQuality, 
  lastHeartbeat, 
  className = '' 
}: ConnectionIndicatorProps) {
  const [timeSinceLastHeartbeat, setTimeSinceLastHeartbeat] = useState<number>(0);

  useEffect(() => {
    if (!lastHeartbeat) {
      setTimeSinceLastHeartbeat(0);
      return;
    }

    const updateTime = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000);
      setTimeSinceLastHeartbeat(diff);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [lastHeartbeat]);

  const getIndicator = () => {
    if (connectionQuality === 'poor' || timeSinceLastHeartbeat > 30) {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/20',
        label: 'Poor Connection'
      };
    }
    
    if (connectionQuality === 'good' && timeSinceLastHeartbeat <= 10) {
      return {
        icon: Wifi,
        color: 'text-green-500',
        bg: 'bg-green-500/20',
        label: 'Good Connection'
      };
    }

    return {
      icon: WifiOff,
      color: 'text-gray-500',
      bg: 'bg-gray-500/20',
      label: 'Unknown'
    };
  };

  const indicator = getIndicator();
  const Icon = indicator.icon;

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${indicator.bg} ${className}`}>
      <Icon className={`h-3 w-3 ${indicator.color}`} />
      <span className={`text-xs font-medium ${indicator.color}`}>
        {indicator.label}
      </span>
      {lastHeartbeat && (
        <span className="text-xs text-muted-foreground">
          {timeSinceLastHeartbeat < 60 ? `${timeSinceLastHeartbeat}s ago` : 
           `${Math.floor(timeSinceLastHeartbeat / 60)}m ago`}
        </span>
      )}
    </div>
  );
}
