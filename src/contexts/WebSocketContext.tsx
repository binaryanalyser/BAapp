import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI } from '../services/derivAPI';

interface TickData {
  symbol: string;
  price: number;
  epoch: number;
  quote: number;
}

interface WebSocketContextType {
  ticks: Record<string, TickData>;
  subscribeTo: (symbol: string) => void;
  unsubscribeFrom: (symbol: string) => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [ticks, setTicks] = useState<Record<string, TickData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Auto-reconnect WebSocket if user is authenticated
    const token = localStorage.getItem('deriv_token');
    if (token) {
      derivAPI.connect().catch(console.error);
    }

    const handleTick = (data: any) => {
      if (data.price) {
        setTicks(prev => ({
          ...prev,
          [data.symbol]: {
            symbol: data.symbol,
            price: data.price,
            epoch: data.epoch,
            quote: data.quote
          }
        }));
      }
    };

    const handleConnection = (connected: boolean) => {
      setIsConnected(connected);
    };

    derivAPI.onTick(handleTick);
    derivAPI.onConnection(handleConnection);

    return () => {
      derivAPI.disconnect();
    };
  }, []);

  const subscribeTo = (symbol: string) => {
    if (!subscriptions.has(symbol)) {
      derivAPI.subscribeTicks(symbol);
      setSubscriptions(prev => new Set(prev).add(symbol));
    }
  };

  const unsubscribeFrom = (symbol: string) => {
    if (subscriptions.has(symbol)) {
      derivAPI.unsubscribeTicks(symbol);
      setSubscriptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(symbol);
        return newSet;
      });
    }
  };

  const value = {
    ticks,
    subscribeTo,
    unsubscribeFrom,
    isConnected
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};