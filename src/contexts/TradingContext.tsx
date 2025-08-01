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

  const addTrade = (trade: Omit<Trade, 'id'>) => {
    const newTrade: Trade = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setTrades(prev => [newTrade, ...prev]);
  };

  const updateTrade = (id: string, updates: Partial<Trade>) => {
    setTrades(prev => prev.map(trade => 
      trade.id === id ? { ...trade, ...updates } : trade
    ));
  };

  const clearTrades = () => {
    setTrades([]);
    localStorage.removeItem('app_trades');
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