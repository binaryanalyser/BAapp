import React, { useState, useEffect } from 'react';
import { Play, DollarSign, Clock, Target, TrendingUp, TrendingDown, Zap, Activity, AlertCircle } from 'lucide-react';
import { derivAPI } from '../../services/derivAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTradingContext } from '../../contexts/TradingContext';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface QuickTradeProps {
  selectedAsset?: string;
}

const QuickTrade: React.FC<QuickTradeProps> = ({ selectedAsset = 'R_10' }) => {
  const { user } = useAuth();
  const { addTrade, updateTrade } = useTradingContext();
  const { ticks } = useWebSocket();
  const [selectedContract, setSelectedContract] = useState('CALL');
  const [amount, setAmount] = useState('10');
  const [duration, setDuration] = useState('5');
  const [isTrading, setIsTrading] = useState(false);
  const [availableContracts, setAvailableContracts] = useState<any[]>([]);
  const [proposalData, setProposalData] = useState<any>(null);
  const [isLoadingProposal, setIsLoadingProposal] = useState(false);
  const [priceMovement, setPriceMovement] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [previousPrice, setPreviousPrice] = useState<number>(0);
  const [profitAnimation, setProfitAnimation] = useState(false);

  const currentPrice = ticks[selectedAsset]?.price || 0;

  // Load available contracts when asset changes
  useEffect(() => {
    const loadContracts = async () => {
      try {
        const response = await derivAPI.getContractsFor(selectedAsset);
        if (response.contracts_for) {
          setAvailableContracts(response.contracts_for.available);
        }
      } catch (error) {
        console.error('Failed to load contracts:', error);
      }
    };

    if (selectedAsset) {
      loadContracts();
    }
  }, [selectedAsset]);

  // Get proposal for current parameters
  useEffect(() => {
    const getProposal = async () => {
      if (!currentPrice || !amount || parseFloat(amount) <= 0) {
        setProposalData(null);
        return;
      }

      setIsLoadingProposal(true);
      try {
        const contractType = selectedContract === 'CALL' ? 'CALL' : 
                           selectedContract === 'PUT' ? 'PUT' : 
                           selectedContract === 'DIGITMATCH' ? 'DIGITMATCH' : 'DIGITDIFF';
        
        const proposalParams = {
          contract_type: contractType,
          symbol: selectedAsset,
          duration: parseInt(duration),
          duration_unit: 'm',
          amount: parseFloat(amount),
          basis: 'stake',
          currency: user?.currency || 'USD'
        };

        const response = await derivAPI.getProposal(proposalParams);
        if (response.proposal) {
          setProposalData(response.proposal);
        }
      } catch (error) {
        console.error('Failed to get proposal:', error);
        setProposalData(null);
      } finally {
        setIsLoadingProposal(false);
      }
    };

    const debounceTimer = setTimeout(getProposal, 500);
    return () => clearTimeout(debounceTimer);
  }, [selectedContract, selectedAsset, duration, amount, currentPrice, user?.currency]);

  // Track price movement for animations
  useEffect(() => {
    if (currentPrice && previousPrice) {
      if (currentPrice > previousPrice) {
        setPriceMovement('up');
      } else if (currentPrice < previousPrice) {
        setPriceMovement('down');
      } else {
        setPriceMovement('neutral');
      }
      
      // Reset movement after animation
      setTimeout(() => setPriceMovement('neutral'), 1000);
    }
    setPreviousPrice(currentPrice);
  }, [currentPrice, previousPrice]);

  // Animate profit calculation
  useEffect(() => {
    if (amount) {
      setProfitAnimation(true);
      setTimeout(() => setProfitAnimation(false), 300);
    }
  }, [amount, selectedContract]);

  const contractTypes = [
    { 
      value: 'CALL', 
      label: 'Higher', 
      color: 'bg-green-600 hover:bg-green-700 border-green-500', 
      icon: TrendingUp,
      activeColor: 'bg-green-700 shadow-lg shadow-green-500/25 border-green-400'
    },
    { 
      value: 'PUT', 
      label: 'Lower', 
      color: 'bg-red-600 hover:bg-red-700 border-red-500', 
      icon: TrendingDown,
      activeColor: 'bg-red-700 shadow-lg shadow-red-500/25 border-red-400'
    },
    { 
      value: 'DIGITDIFF', 
      label: 'Differs', 
      color: 'bg-yellow-600 hover:bg-yellow-700 border-yellow-500', 
      icon: Target,
      activeColor: 'bg-yellow-700 shadow-lg shadow-yellow-500/25 border-yellow-400'
    },
    { 
      value: 'DIGITMATCH', 
      label: 'Matches', 
      color: 'bg-blue-600 hover:bg-blue-700 border-blue-500', 
      icon: Target,
      activeColor: 'bg-blue-700 shadow-lg shadow-blue-500/25 border-blue-400'
    }
  ];

  const handleTrade = async () => {
    // This function is now replaced by handleTradeAction
  };

  const handleTradeAction = async (contractType: 'CALL' | 'PUT') => {
    if (!user) return;
    
    setSelectedContract(contractType);
    setIsTrading(true);
    const entryTime = Date.now();
    const tradeDuration = parseInt(duration) * 60; // Convert minutes to seconds
    
    try {
      // Check if we have proposal data
      if (!proposalData || !proposalData.id || !proposalData.ask_price) {
        throw new Error('No valid proposal data available. Please wait for price calculation.');
      }

      // Execute trade using proposal ID and ask price
      console.log('Executing trade via Deriv API:', {
        proposalId: proposalData.id,
        askPrice: proposalData.ask_price,
        symbol: selectedAsset,
        type: contractType
      });

      const tradeResponse = await derivAPI.buyContract(proposalData.id, proposalData.ask_price);
      
      if (tradeResponse.buy) {
        // Trade executed successfully via webhook
        const contractId = tradeResponse.buy.contract_id.toString();
        const actualPayout = tradeResponse.buy.payout;
        const purchasePrice = tradeResponse.buy.buy_price;
        
        console.log('Trade executed successfully:', {
          contractId,
          payout: actualPayout,
          purchasePrice
        });

        const newTrade = {
          symbol: selectedAsset,
          type: contractType as 'CALL' | 'PUT' | 'DIGITMATCH' | 'DIGITDIFF',
          stake: purchasePrice,
          duration: tradeDuration,
          payout: actualPayout,
          profit: 0,
          status: 'open' as const,
          entryTime,
          entryPrice: currentPrice,
          contractId: contractId,
          transactionId: tradeResponse.buy.transaction_id?.toString()
        };
        
        addTrade(newTrade);

        // Show success notification
        console.log('✅ Trade placed successfully:', {
          symbol: selectedAsset,
          type: contractType,
          contractId,
          stake: purchasePrice,
          payout: actualPayout
        });
        
      } else {
        throw new Error('Trade execution failed - no buy response');
      }
      
    } catch (error) {
      console.error('Trade execution error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to execute trade';
      if (error instanceof Error) {
        if (error.message.includes('InsufficientBalance')) {
          errorMessage = 'Insufficient balance to place this trade';
        } else if (error.message.includes('InvalidContract')) {
          errorMessage = 'Invalid contract parameters';
        } else if (error.message.includes('MarketClosed')) {
          errorMessage = 'Market is currently closed';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(`❌ ${errorMessage}`);
    } finally {
      setIsTrading(false);
    }
  };

  const getPriceMovementClass = () => {
    switch (priceMovement) {
      case 'up':
        return 'text-green-400 animate-bounce';
      case 'down':
        return 'text-red-400 animate-bounce';
      default:
        return 'text-white';
    }
  };

  const getPriceMovementIcon = () => {
    switch (priceMovement) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-400 animate-pulse" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-400 animate-pulse" />;
      default:
        return <Activity className="h-4 w-4 text-blue-400" />;
    }
  };

  const potentialPayout = proposalData ? proposalData.payout.toFixed(2) : (parseFloat(amount || '0') * 1.85).toFixed(2);
  const potentialProfit = proposalData ? (proposalData.payout - parseFloat(amount || '0')).toFixed(2) : (parseFloat(amount || '0') * 0.85).toFixed(2);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Target className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Quick Trade</h3>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">Live</span>
          </div>
        </div>
        {getPriceMovementIcon()}
      </div>

      <div className="space-y-6">

        {/* Amount Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <DollarSign className="inline h-4 w-4 mr-1" />
            Stake Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
              placeholder="10.00"
              min="1"
              step="0.01"
            />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">
              {user?.currency || 'USD'}
            </span>
          </div>
          {/* Quick amount buttons */}
          <div className="flex space-x-2 mt-2">
            {['5', '10', '25', '50'].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
              >
                ${quickAmount}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
          <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Clock className="inline h-4 w-4 mr-1" />
            Duration (minutes)
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
          >
            <option value="1">1 minute</option>
            <option value="2">2 minutes</option>
            <option value="3">3 minutes</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
          </select>
        </div>
        </div>

        {/* Trade Summary */}
        <div className="bg-gray-750 rounded-lg p-4 border border-gray-600">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400 text-sm">Asset:</span>
            <span className="text-white font-medium">{selectedAsset}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400 text-sm">Current Price:</span>
            <div className="flex items-center space-x-2">
              <span className={`font-mono font-medium transition-all duration-300 ${getPriceMovementClass()}`}>
                {currentPrice ? currentPrice.toFixed(4) : '---'}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400 text-sm">Stake:</span>
            <span className="text-white font-medium">{amount} {user?.currency}</span>
          </div>
          {proposalData && (
            <>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">Ask Price:</span>
                <span className="text-blue-400 font-medium">{proposalData.ask_price.toFixed(2)} {user?.currency}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400 text-sm">Potential Payout:</span>
            <span className={`text-green-400 font-medium transition-all duration-300 ${profitAnimation ? 'animate-pulse scale-110' : ''}`}>
              {potentialPayout} {user?.currency}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Potential Profit:</span>
            <span className={`text-green-400 font-medium transition-all duration-300 ${profitAnimation ? 'animate-pulse scale-110' : ''}`}>
              +{potentialProfit} {user?.currency}
            </span>
          </div>
        </div>

        {/* Trade Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          {/* Trade Higher Button */}
          <button
            onClick={() => handleTradeAction('CALL')}
            disabled={!user || !currentPrice || isLoadingProposal}
            className="disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-6 px-4 rounded-xl transition-all duration-300 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl bg-gradient-to-r from-green-600 via-green-700 to-green-800 hover:from-green-700 hover:via-green-800 hover:to-green-900 shadow-green-500/25"
          >
            {isLoadingProposal ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="text-sm">Loading...</span>
              </>
            ) : (
              <>
                <TrendingUp className="h-8 w-8 animate-bounce" />
                <span className="text-lg">Trade Higher</span>
                <Zap className="h-4 w-4 animate-pulse" />
              </>
            )}
          </button>

          {/* Trade Lower Button */}
          <button
            onClick={() => handleTradeAction('PUT')}
            disabled={!user || !currentPrice || isLoadingProposal}
            className="disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-6 px-4 rounded-xl transition-all duration-300 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 shadow-red-500/25"
          >
            {isLoadingProposal ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="text-sm">Loading...</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-8 w-8 animate-bounce" />
                <span className="text-lg">Trade Lower</span>
                <Zap className="h-4 w-4 animate-pulse" />
              </>
            )}
          </button>
        </div>

        {!user && (
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
            <AlertCircle className="h-4 w-4" />
            <span>Please log in to place trades</span>
          </div>
        )}

        {(!currentPrice || !proposalData) && user && !isLoadingProposal && (
          <div className="flex items-center justify-center space-x-2 text-sm text-yellow-400">
            <Activity className="h-4 w-4 animate-pulse" />
            <span>Waiting for market data...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickTrade;