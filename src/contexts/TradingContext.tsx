import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI } from '../services/derivAPI';
import { useAuth } from './AuthContext';

interface Trade {
  id: string;
  symbol: string;
  account_loginid?: string; // Track which account this trade belongs to
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
  transactionId?: string;
  purchaseTime?: number;
  sellTime?: number;
  longcode?: string;
  shortcode?: string;
}

interface TradingStats {
  totalProfit: number;
  winRate: number;
  activeTrades: number;
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
  loadTradingHistory: () => Promise<void>;
  syncWithDeriv: () => Promise<void>;
  loadOpenTrades: () => Promise<void>;
  sellTrade: (contractId: string) => Promise<void>;
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
  const { user, isAuthenticated, accountList } = useAuth();

  // Load trades from localStorage on mount
  useEffect(() => {
    const loadTrades = async () => {
      const savedTrades = localStorage.getItem('app_trades');
      if (savedTrades) {
        try {
          setTrades(JSON.parse(savedTrades));
        } catch (error) {
          console.error('Failed to load trades from localStorage:', error);
        }
      }
    };

    loadTrades();
  }, []);

  // Load trading history from Deriv when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      // Load both trading history and open trades when user logs in
      loadTradingHistory();
      loadOpenTrades();
      
      // Set up periodic refresh of open trades every 30 seconds
      const openTradesInterval = setInterval(() => {
        loadOpenTrades();
      }, 30000);
      
      return () => {
        clearInterval(openTradesInterval);
      };
    }
  }, [isAuthenticated, user]);

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

  const loadTradingHistory = async () => {
    if (!isAuthenticated || !derivAPI.getConnectionStatus()) {
      return;
    }

    setIsLoading(true);
    try {
      // Get profit table (completed trades)
      const profitResponse = await derivAPI.getProfitTable({
        limit: 100,
        description: 1
      });

      if (profitResponse.profit_table && profitResponse.profit_table.transactions) {
        const derivTrades = profitResponse.profit_table.transactions.map((transaction: any) => {
          // Parse contract type from shortcode or longcode
          let contractType: Trade['type'] = 'CALL';
          const shortcode = transaction.shortcode || '';
          const longcode = transaction.longcode || '';
          
          if (shortcode.includes('CALL') || longcode.toLowerCase().includes('rise')) {
            contractType = 'CALL';
          } else if (shortcode.includes('PUT') || longcode.toLowerCase().includes('fall')) {
            contractType = 'PUT';
          } else if (shortcode.includes('DIGITMATCH') || longcode.toLowerCase().includes('matches')) {
            contractType = 'DIGITMATCH';
          } else if (shortcode.includes('DIGITDIFF') || longcode.toLowerCase().includes('differs')) {
            contractType = 'DIGITDIFF';
          }

          const profit = parseFloat(transaction.sell_price || '0') - parseFloat(transaction.buy_price || '0');
          const status: Trade['status'] = profit > 0 ? 'won' : 'lost';

          return {
            id: `deriv_${transaction.transaction_id}`,
            symbol: transaction.underlying || transaction.symbol || 'R_10',
            account_loginid: user?.loginid, // Store which account this trade belongs to
            type: contractType,
            stake: parseFloat(transaction.buy_price || '0'),
            payout: parseFloat(transaction.sell_price || '0'),
            profit: profit,
            status: status,
            entryTime: (transaction.purchase_time || Date.now() / 1000) * 1000,
            exitTime: (transaction.sell_time || Date.now() / 1000) * 1000,
            entryPrice: parseFloat(transaction.entry_tick || '0'),
            exitPrice: parseFloat(transaction.exit_tick || '0'),
            contractId: transaction.contract_id?.toString(),
            transactionId: transaction.transaction_id?.toString(),
            purchaseTime: transaction.purchase_time,
            sellTime: transaction.sell_time,
            longcode: transaction.longcode,
            shortcode: transaction.shortcode,
            duration: transaction.duration || 300
          };
        });

        // Merge with existing app trades, avoiding duplicates
        setTrades(prevTrades => {
          const existingIds = new Set(prevTrades.map(trade => trade.id));
          const newTrades = derivTrades.filter((trade: Trade) => !existingIds.has(trade.id));
          
          // Remove existing Deriv trades for this account to avoid duplicates
          const filteredTrades = prevTrades.filter(trade => 
            !trade.id.startsWith('deriv_') || trade.account_loginid !== user?.loginid
          );
          
          // Combine and sort by entry time (newest first)
          const allTrades = [...filteredTrades, ...newTrades].sort((a, b) => b.entryTime - a.entryTime);
          
          return allTrades;
        });

        console.log(`Loaded ${derivTrades.length} trades from Deriv history`);
      }

    } catch (error) {
      console.error('Failed to load trading history from Deriv:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOpenTrades = async () => {
    if (!isAuthenticated || !derivAPI.getConnectionStatus()) {
      console.log('Cannot load open trades: not authenticated or not connected');
      return;
    }

    console.log('Loading open trades from Deriv...');
    setIsLoading(true);
    try {
      // Get portfolio (open positions)
      const portfolioResponse = await derivAPI.getPortfolio();
      console.log('Portfolio response:', portfolioResponse);

      if (portfolioResponse.portfolio && portfolioResponse.portfolio.contracts) {
        const openTrades = portfolioResponse.portfolio.contracts.map((contract: any) => {
          console.log('Processing contract:', contract);
          
          // Parse contract type from shortcode or longcode
          let contractType: Trade['type'] = 'CALL';
          const shortcode = contract.shortcode || '';
          const longcode = contract.longcode || '';
          
          if (shortcode.includes('CALL') || longcode.toLowerCase().includes('rise')) {
            contractType = 'CALL';
          } else if (shortcode.includes('PUT') || longcode.toLowerCase().includes('fall')) {
            contractType = 'PUT';
          } else if (shortcode.includes('DIGITMATCH') || longcode.toLowerCase().includes('matches')) {
            contractType = 'DIGITMATCH';
          } else if (shortcode.includes('DIGITDIFF') || longcode.toLowerCase().includes('differs')) {
            contractType = 'DIGITDIFF';
          }
          
          // Calculate current profit from bid_price if available
          const currentProfit = contract.bid_price ? 
            parseFloat(contract.bid_price) - parseFloat(contract.buy_price || '0') : 
            parseFloat(contract.profit || '0');

          return {
            id: `deriv_open_${contract.contract_id}`,
            symbol: contract.underlying || contract.symbol || 'R_10',
            account_loginid: user?.loginid, // Store which account this trade belongs to
            type: contractType,
            stake: parseFloat(contract.buy_price || '0'),
            payout: parseFloat(contract.payout || '0'),
            profit: currentProfit,
            status: 'open' as const,
            entryTime: (contract.purchase_time || Date.now() / 1000) * 1000,
            entryPrice: parseFloat(contract.entry_tick || '0'),
            contractId: contract.contract_id?.toString(),
            transactionId: contract.transaction_id?.toString(),
            purchaseTime: contract.purchase_time,
            longcode: contract.longcode,
            shortcode: contract.shortcode,
            duration: contract.duration || 300,
            barrier: contract.barrier,
            // Store additional Deriv-specific data
            bidPrice: parseFloat(contract.bid_price || '0')
          };
        });

        // Update trades with open positions from Deriv
        setTrades(prevTrades => {
          // Remove existing Deriv open trades for this account
          const filteredTrades = prevTrades.filter(trade => 
            !trade.id.startsWith('deriv_open_') || trade.account_loginid !== user?.loginid
          );
          
          // Add new open trades and sort by entry time (newest first)
          const allTrades = [...openTrades, ...filteredTrades].sort((a, b) => b.entryTime - a.entryTime);
          
          return allTrades;
        });

        console.log(`✅ Loaded ${openTrades.length} open trades from Deriv`);
      }

    } catch (error) {
      console.error('Failed to load open trades from Deriv:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to portfolio updates for real-time open trade updates
  useEffect(() => {
    if (isAuthenticated && derivAPI.getConnectionStatus()) {
      const subscribeToPortfolio = async () => {
        try {
          // Subscribe to portfolio updates using the dedicated method
          await derivAPI.subscribeToPortfolio();
          console.log('✅ Subscribed to portfolio updates');
        } catch (error) {
          console.warn('Failed to subscribe to portfolio updates:', error);
        }
      };
      
      subscribeToPortfolio();
    }
  }, [isAuthenticated]);

  const sellTrade = async (contractId: string) => {
    if (!isAuthenticated || !derivAPI.getConnectionStatus()) {
      throw new Error('Not connected to Deriv API');
    }

    try {
      console.log('Selling trade with contract ID:', contractId);
      const response = await derivAPI.sellContract(parseInt(contractId));
      console.log('Sell response:', response);
      
      if (response.sell) {
        // Update the trade status locally
        setTrades(prevTrades => prevTrades.map(trade => {
          if (trade.contractId === contractId) {
            const profit = response.sell.sold_for - trade.stake;
            return {
              ...trade,
              status: profit > 0 ? 'won' : 'lost' as const,
              exitTime: Date.now(),
              exitPrice: response.sell.sold_for,
              payout: response.sell.sold_for,
              profit: profit
            };
          }
          return trade;
        }));

        console.log('✅ Trade sold successfully:', response.sell);
        
        // Refresh open trades after selling
        setTimeout(() => loadOpenTrades(), 1000);
        return response.sell;
      } else {
        throw new Error('Failed to sell contract');
      }
    } catch (error) {
      console.error('Failed to sell trade:', error);
      throw error;
    }
  };

  const syncWithDeriv = async () => {
    console.log('🔄 Syncing with Deriv...');
    await Promise.all([
      loadTradingHistory(),
      loadOpenTrades()
    ]);
    console.log('✅ Sync with Deriv completed');
  };

  const addTrade = (trade: Omit<Trade, 'id'>) => {
    const newTrade: Trade = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      account_loginid: user?.loginid // Associate with current account
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

    // Filter trades by current active account
    const currentAccountTrades = trades.filter(trade => {
      // If no account_loginid stored (legacy trades), show all
      if (!trade.account_loginid) return true;
      
      // Only show trades from current account
      return trade.account_loginid === user?.loginid;
    });

    const completedTrades = currentAccountTrades.filter(trade => trade.status !== 'open');
    const activeTrades = currentAccountTrades.filter(trade => trade.status === 'open').length;
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

    return {
      totalProfit,
      winRate,
      activeTrades,
      totalTrades,
      winningTrades,
      dailyProfit,
      weeklyProfit,
      monthlyProfit
    };
  };

  const stats = calculateStats();

  const value = {
    trades: trades.filter(trade => {
      // Filter trades by current account for components
      if (!trade.account_loginid) return true; // Show legacy trades
      return trade.account_loginid === user?.loginid;
    }),
    stats,
    addTrade,
    updateTrade,
    clearTrades,
    loadTradingHistory,
    syncWithDeriv,
    loadOpenTrades,
    sellTrade,
    isLoading
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};