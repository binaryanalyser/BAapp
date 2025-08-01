import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI } from '../services/derivAPI';

interface Trade {
  id: string;
  symbol: string;
  type: 'CALL' | 'PUT' | 'DIGITMATCH' | 'DIGITDIFF';
  stake: number;
  duration?: number; // Duration in seconds
  payout: number;
  profit: number;
  status: 'won' | 'lost' | 'open';
  entryTime: number;
  exitTime?: number;
  entryPrice: number;
  exitPrice?: number;
  contractId?: string;
  barrier?: string;
}

interface TradingStats {
  totalProfit: number;
  winRate: number;
  activeTrades: number;
  todaySignals: number;
  totalTrades: number;
  winningTrades: number;
  dailyProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
}

interface TradingContextType {
  trades: Trade[];
  stats: TradingStats;
  addTrade: (trade: Omit<Trade, 'id'>) => void;
  updateTrade: (id: string, updates: Partial<Trade>) => void;
  clearTrades: () => void;
  isLoading: boolean;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const useTradingContext = () => {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error('useTradingContext must be used within a TradingProvider');
  }
  return context;
};

interface TradingProviderProps {
  children: ReactNode;
}

export const TradingProvider: React.FC<TradingProviderProps> = ({ children }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expiryTimeouts, setExpiryTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // Load trades from localStorage on mount
  useEffect(() => {
    const savedTrades = localStorage.getItem('app_trades');
    if (savedTrades) {
      try {
        setTrades(JSON.parse(savedTrades));
      } catch (error) {
        console.error('Failed to load trades from localStorage:', error);
      }
    }
  }, []);

  // Save trades to localStorage whenever trades change
  useEffect(() => {
    localStorage.setItem('app_trades', JSON.stringify(trades));
  }, [trades]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      expiryTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [expiryTimeouts]);
  const addTrade = (trade: Omit<Trade, 'id'>) => {
    const newTrade: Trade = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setTrades(prev => [newTrade, ...prev]);
    
    // Set up expiry timeout if trade has duration
    if (newTrade.duration && newTrade.status === 'open') {
      const timeoutId = setTimeout(() => {
        expireTrade(newTrade.id);
      }, newTrade.duration * 1000);
      
      setExpiryTimeouts(prev => new Map(prev).set(newTrade.id, timeoutId));
    }
  };

  const updateTrade = (id: string, updates: Partial<Trade>) => {
    setTrades(prev => prev.map(trade => 
      trade.id === id ? { ...trade, ...updates } : trade
    ));
    
    // Clear timeout if trade is being closed manually
    if (updates.status && updates.status !== 'open') {
      const timeout = expiryTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        setExpiryTimeouts(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      }
    }
  };

  const expireTrade = (tradeId: string) => {
    setTrades(prev => prev.map(trade => {
      if (trade.id === tradeId && trade.status === 'open') {
        // Simulate trade result based on trade type and random market movement
        const marketMovement = (Math.random() - 0.5) * 0.02; // -1% to +1% movement
        let isWin = false;
        
        // Determine win/loss based on trade type
        if (trade.type === 'CALL') {
          isWin = marketMovement > 0;
        } else if (trade.type === 'PUT') {
          isWin = marketMovement < 0;
        } else if (trade.type === 'DIGITMATCH') {
          // For digit match, use random with slight bias
          isWin = Math.random() > 0.6;
        } else if (trade.type === 'DIGITDIFF') {
          // For digit differs, use random with slight bias
          isWin = Math.random() > 0.4;
        }
        
        // Add some randomness to make it more realistic (70% accuracy)
        if (Math.random() > 0.7) {
          isWin = !isWin;
        }
        
        const exitPrice = trade.entryPrice + (trade.entryPrice * marketMovement);
        const payout = isWin ? trade.payout : 0;
        const profit = payout - trade.stake;
        
        // Show notification
        const notification = {
          type: isWin ? 'success' : 'error',
          title: isWin ? 'Trade Won! 🎉' : 'Trade Lost 😞',
          message: `${trade.symbol} ${trade.type} - ${isWin ? '+' : ''}$${profit.toFixed(2)}`,
          duration: 5000
        };
        
        // You could dispatch this to a notification system
        console.log('Trade Result:', notification);
        
        return {
          ...trade,
          status: isWin ? 'won' : 'lost',
          exitTime: Date.now(),
          exitPrice,
          payout,
          profit
        };
      }
      return trade;
    }));
    
    // Clean up timeout
    setExpiryTimeouts(prev => {
      const newMap = new Map(prev);
      newMap.delete(tradeId);
      return newMap;
    });
  };
  const clearTrades = () => {
    setTrades([]);
    localStorage.removeItem('app_trades');
    // Clear all timeouts
    expiryTimeouts.forEach(timeout => clearTimeout(timeout));
    setExpiryTimeouts(new Map());
  };

  // Calculate statistics from app trades only
  const calculateStats = (): TradingStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const completedTrades = trades.filter(trade => trade.status !== 'open');
    const activeTrades = trades.filter(trade => trade.status === 'open').length;
    const winningTrades = completedTrades.filter(trade => trade.profit > 0).length;
    const totalTrades = completedTrades.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const totalProfit = completedTrades.reduce((sum, trade) => sum + trade.profit, 0);
    
    const dailyProfit = completedTrades
      .filter(trade => trade.exitTime && new Date(trade.exitTime) >= today)
      .reduce((sum, trade) => sum + trade.profit, 0);
    
    const weeklyProfit = completedTrades
      .filter(trade => trade.exitTime && new Date(trade.exitTime) >= weekAgo)
      .reduce((sum, trade) => sum + trade.profit, 0);
    
    const monthlyProfit = completedTrades
      .filter(trade => trade.exitTime && new Date(trade.exitTime) >= monthAgo)
      .reduce((sum, trade) => sum + trade.profit, 0);

    // Mock today's signals count (would be tracked separately in a real app)
    const todaySignals = Math.floor(Math.random() * 15) + 10;

    return {
      totalProfit,
      winRate,
      activeTrades,
      todaySignals,
      totalTrades,
      winningTrades,
      dailyProfit,
      weeklyProfit,
      monthlyProfit
    };
  };

  const stats = calculateStats();

  const value = {
    trades,
    stats,
    addTrade,
    updateTrade,
    clearTrades,
    isLoading
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};