import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Activity, AlertCircle, Target, BarChart3, Zap, Play, DollarSign, Clock, Signal, Cpu } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { derivAPI } from '../../services/derivAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTradingContext } from '../../contexts/TradingContext';

interface AssetAnalysisProps {
  selectedSymbol: string;
}
interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  description: string;
  confidence: number;
  timeframe: string;
}

interface MarketSentiment {
  bullish: number;
  bearish: number;
  neutral: number;
  overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

interface PriceLevel {
  type: 'support' | 'resistance';
  level: number;
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  distance: number;
}

interface PriceHistory {
  prices: number[];
  timestamps: number[];
  volumes: number[];
}

interface AISignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  timeframe: string;
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  riskReward: number;
  indicators: string[];
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol = 'R_10' }) => {
  // Early validation
  if (!selectedSymbol || typeof selectedSymbol !== 'string') {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-400">Invalid symbol selected</p>
        </div>
      </div>
    );
  }

  const { ticks } = useWebSocket();
  const { user } = useAuth();
  const { addTrade, updateTrade } = useTradingContext();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<number>(Date.now());
  const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicator[]>([]);
  const [marketSentiment, setMarketSentiment] = useState<MarketSentiment>({
    bullish: 0,
    bearish: 0,
    neutral: 0,
    overall: 'NEUTRAL'
  });
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState<{
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string;
    timeframe: string;
    entryPrice: number;
    targetPrice?: number;
    stopLoss?: number;
    riskReward: number;
    indicators: string[];
  } | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory>({ prices: [], timestamps: [], volumes: [] });
  const [isCollectingData, setIsCollectingData] = useState(true);
  
  // Quick Trade states
  const [isLoadingProposal, setIsLoadingProposal] = useState(false);
  
  // Validate WebSocket context and tick data
  if (!ticks) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to market data...</p>
        </div>
      </div>
    );
  }

  const tickData = ticks[selectedSymbol];
  if (!tickData || typeof tickData.price !== 'number') {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="text-center py-8">
          <Activity className="h-12 w-12 mx-auto mb-4 text-yellow-400 animate-pulse" />
          <p className="text-gray-400">Waiting for {selectedSymbol} tick data...</p>
        </div>
      </div>
    );
  }

  const [selectedContract, setSelectedContract] = useState('CALL');
  const [amount, setAmount] = useState<string>('10');
  const [duration, setDuration] = useState('5');
  const [isTrading, setIsTrading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [barrier, setBarrier] = useState<string>('0');
  
  // Price movement tracking
  const [priceMovement, setPriceMovement] = useState<'up' | 'down' | 'none'>('none');
  const [previousPrice, setPreviousPrice] = useState<number>(0);

  const currentPrice = tickData.price;
  
  // Track price movement
  useEffect(() => {
    if (currentPrice > 0 && previousPrice > 0) {
      if (currentPrice > previousPrice) {
        setPriceMovement('up');
      } else if (currentPrice < previousPrice) {
        setPriceMovement('down');
      } else {
        setPriceMovement('none');
      }
    }
    setPreviousPrice(currentPrice);
  }, [currentPrice, previousPrice]);
  
  // Helper functions for price movement
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
        return null;
    }
  };

  // Collect price history for analysis
  useEffect(() => {
    if (currentPrice > 0) {
      const now = Date.now();
      setPriceHistory(prev => {
        const newPrices = [...prev.prices, currentPrice].slice(-200); // Keep last 200 prices
        const newTimestamps = [...prev.timestamps, now].slice(-200);
        const newVolumes = [...prev.volumes, Math.random() * 100 + 50].slice(-200); // Mock volume data
        
        return {
          prices: newPrices,
          timestamps: newTimestamps,
          volumes: newVolumes
        };
      });
      
      // Need at least 50 data points for reliable analysis
      if (priceHistory.prices.length >= 50) {
        setIsCollectingData(false);
      }
    }
  }, [currentPrice]);

  // Calculate potential payout and profit
  const potentialPayout = parseFloat(String(amount || '0')) * 1.85;
  const potentialProfit = potentialPayout - parseFloat(String(amount || '0'));

  // Animate profit calculation
  useEffect(() => {
    if (amount) {
      setProfitAnimation(true);
      setTimeout(() => setProfitAnimation(false), 300);
    }
  }, [amount, selectedContract]);

  // Quick Trade functionality
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
    
    try {
      console.log('Executing real trade:', {
        contractType,
        symbol: selectedSymbol,
        amount: parseFloat(amount),
        duration: parseInt(duration),
        currentPrice
      });
      
      // Get proposal first to get the contract details
      const proposalParams = {
        contract_type: contractType,
        symbol: selectedSymbol,
        duration: parseInt(duration),
        duration_unit: 'm',
        amount: parseFloat(amount),
        basis: 'stake',
        currency: user.currency
      };
      
      console.log('Getting proposal with params:', proposalParams);
      const proposalResponse = await derivAPI.getProposal(proposalParams);
      
      if (!proposalResponse.proposal) {
        throw new Error('Failed to get proposal');
      }
      
      console.log('Proposal received:', proposalResponse.proposal);
      
      // Buy the contract using the proposal ID
      const buyParams = {
        buy: proposalResponse.proposal.id,
        price: proposalResponse.proposal.ask_price
      };
      
      console.log('Buying contract with params:', buyParams);
      const buyResponse = await derivAPI.buyContract(buyParams);
      
      if (!buyResponse.buy) {
        throw new Error('Failed to buy contract');
      }
      
      console.log('Contract purchased successfully:', buyResponse.buy);
      
      const newTrade = {
        symbol: selectedSymbol,
        type: contractType as 'CALLE' | 'PUTE' | 'DIGITMATCH' | 'DIGITDIFF',
        stake: parseFloat(amount),
        duration: parseInt(duration) * 60, // Convert minutes to seconds
        payout: buyResponse.buy.payout || (parseFloat(amount) * 1.85),
        profit: 0,
        status: 'open' as const,
        entryTime,
        entryPrice: currentPrice,
        contractId: buyResponse.buy.contract_id.toString()
      };
      
      addTrade(newTrade);
      setTradeSuccess(true);
      setCountdown(parseInt(duration) * 60);
      
      // Subscribe to contract updates to track the trade
      try {
        const contractUpdates = await derivAPI.getProposalOpenContract(buyResponse.buy.contract_id);
        console.log('Subscribed to contract updates:', contractUpdates);
      } catch (error) {
        console.warn('Failed to subscribe to contract updates:', error);
      }
      
      // Set up trade resolution monitoring
      setTimeout(() => {
        // In a real implementation, this would be handled by WebSocket updates
        // For now, we'll check the portfolio to see if the trade is resolved
        checkTradeStatus(buyResponse.buy.contract_id, newTrade.symbol);
      }, parseInt(duration) * 60 * 1000);
      
    } catch (error) {
      console.error('Trade execution error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Show user-friendly error messages
      if (errorMessage.includes('InsufficientBalance')) {
        errorMessage = 'Insufficient balance to place this trade';
      } else if (errorMessage.includes('InvalidSymbol')) {
        errorMessage = 'Invalid trading symbol';
      } else if (errorMessage.includes('MarketIsClosed')) {
        errorMessage = 'Market is currently closed';
      } else if (errorMessage.includes('InvalidContract')) {
        errorMessage = 'Invalid contract parameters';
      }
      
      alert(`Failed to execute trade: ${errorMessage}`);
    } finally {
      setIsTrading(false);
    }
  };

  const checkTradeStatus = async (contractId: number, symbol: string) => {
    try {
      const portfolio = await derivAPI.getPortfolio();
      const contract = portfolio.portfolio?.contracts?.find((c: any) => c.contract_id === contractId);
      
      if (contract) {
        const isWin = contract.profit > 0;
        const profit = contract.profit || 0;
        const payout = contract.payout || 0;
        
        // Find and update the trade
        const tradeToUpdate = trades.find(t => t.contractId === contractId.toString());
        if (tradeToUpdate) {
          updateTrade(tradeToUpdate.id, {
            status: isWin ? 'won' : 'lost',
            exitTime: Date.now(),
            exitPrice: contract.exit_tick || currentPrice,
            profit
          });
        }
        
        const response = await derivAPI.getContractsFor(selectedSymbol);
      }
    } catch (error) {
      console.error('Failed to check trade status:', error);
    }
  };

  // Countdown effect for trade success
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      setTradeSuccess(false);
    }
  }, [countdown]);

  // Advanced Technical Analysis Functions
  const calculateSMA = (prices: number[], period: number): number => {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / period;
  };

  const calculateEMA = (prices: number[], period: number): number => {
    if (prices.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  };

  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const calculateMACD = (prices: number[]): { macd: number; signal: number; histogram: number } => {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Calculate signal line (9-period EMA of MACD)
    const macdHistory = [];
    for (let i = 26; i <= prices.length; i++) {
      const slice = prices.slice(0, i);
      const ema12_temp = calculateEMA(slice, 12);
      const ema26_temp = calculateEMA(slice, 26);
      macdHistory.push(ema12_temp - ema26_temp);
    }
    
    const signal = calculateEMA(macdHistory, 9);
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  };

  const calculateBollingerBands = (prices: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number; squeeze: boolean } => {
    if (prices.length < period) return { upper: 0, middle: 0, lower: 0, squeeze: false };
    
    const sma = calculateSMA(prices, period);
    const slice = prices.slice(-period);
    
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    const upper = sma + (standardDeviation * stdDev);
    const lower = sma - (standardDeviation * stdDev);
    const bandWidth = (upper - lower) / sma;
    const squeeze = bandWidth < 0.001; // Tight squeeze threshold
    
    return { upper, middle: sma, lower, squeeze };
  };

  const calculateStochastic = (prices: number[], period: number = 14): { k: number; d: number } => {
    if (prices.length < period) return { k: 50, d: 50 };
    
    const slice = prices.slice(-period);
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);
    const current = prices[prices.length - 1];
    
    const k = ((current - lowest) / (highest - lowest)) * 100;
    
    // Calculate %D (3-period SMA of %K)
    const kValues = [];
    for (let i = period; i <= prices.length; i++) {
      const tempSlice = prices.slice(i - period, i);
      const tempHighest = Math.max(...tempSlice);
      const tempLowest = Math.min(...tempSlice);
      const tempCurrent = prices[i - 1];
      kValues.push(((tempCurrent - tempLowest) / (tempHighest - tempLowest)) * 100);
    }
    
    const d = kValues.slice(-3).reduce((sum, val) => sum + val, 0) / Math.min(3, kValues.length);
    
    return { k, d };
  };

  const calculateWilliamsR = (prices: number[], period: number = 14): number => {
    if (prices.length < period) return -50;
    
    const slice = prices.slice(-period);
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);
    const current = prices[prices.length - 1];
    
    return ((highest - current) / (highest - lowest)) * -100;
  };

  const detectPricePatterns = (prices: number[]): { pattern: string; confidence: number; signal: 'BUY' | 'SELL' | 'NEUTRAL' } => {
    if (prices.length < 10) return { pattern: 'Insufficient Data', confidence: 0, signal: 'NEUTRAL' };
    
    const recent = prices.slice(-10);
    const current = recent[recent.length - 1];
    const previous = recent[recent.length - 2];
    
    // Double Bottom Pattern
    const lows = recent.filter((price, i) => i > 0 && i < recent.length - 1 && price < recent[i-1] && price < recent[i+1]);
    if (lows.length >= 2 && Math.abs(lows[0] - lows[1]) / lows[0] < 0.002) {
      return { pattern: 'Double Bottom', confidence: 75, signal: 'BUY' };
    }
    
    // Double Top Pattern
    const highs = recent.filter((price, i) => i > 0 && i < recent.length - 1 && price > recent[i-1] && price > recent[i+1]);
    if (highs.length >= 2 && Math.abs(highs[0] - highs[1]) / highs[0] < 0.002) {
      return { pattern: 'Double Top', confidence: 75, signal: 'SELL' };
    }
    
    // Ascending Triangle
    const isAscending = recent.slice(0, -2).every((price, i) => i === 0 || price >= recent[i-1]);
    if (isAscending && current > previous) {
      return { pattern: 'Ascending Triangle', confidence: 65, signal: 'BUY' };
    }
    
    // Descending Triangle
    const isDescending = recent.slice(0, -2).every((price, i) => i === 0 || price <= recent[i-1]);
    if (isDescending && current < previous) {
      return { pattern: 'Descending Triangle', confidence: 65, signal: 'SELL' };
    }
    
    return { pattern: 'No Clear Pattern', confidence: 0, signal: 'NEUTRAL' };
  };

  // Generate advanced technical analysis
  const generateTechnicalAnalysis = (): TechnicalIndicator[] => {
    if (priceHistory.prices.length < 50) {
      return [];
    }

    const prices = priceHistory.prices;
    const indicators: TechnicalIndicator[] = [];
    
    // RSI Analysis
    const rsi = calculateRSI(prices);
    let rsiSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let rsiStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';
    let rsiConfidence = 50;
    
    if (rsi < 25) {
      rsiSignal = 'BUY';
      rsiStrength = 'STRONG';
      rsiConfidence = 85;
    } else if (rsi < 35) {
      rsiSignal = 'BUY';
      rsiStrength = 'MODERATE';
      rsiConfidence = 70;
    } else if (rsi > 75) {
      rsiSignal = 'SELL';
      rsiStrength = 'STRONG';
      rsiConfidence = 85;
    } else if (rsi > 65) {
      rsiSignal = 'SELL';
      rsiStrength = 'MODERATE';
      rsiConfidence = 70;
    }
    
    indicators.push({
      name: 'RSI (14)',
      value: rsi,
      signal: rsiSignal,
      strength: rsiStrength,
      description: `RSI at ${rsi.toFixed(1)} indicates ${rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral'} conditions`,
      confidence: rsiConfidence,
      timeframe: '5-15 minutes'
    });
    
    // MACD Analysis
    const macdData = calculateMACD(prices);
    let macdSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let macdStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';
    let macdConfidence = 50;
    
    if (macdData.macd > macdData.signal && macdData.histogram > 0) {
      macdSignal = 'BUY';
      macdStrength = Math.abs(macdData.histogram) > 0.001 ? 'STRONG' : 'MODERATE';
      macdConfidence = macdStrength === 'STRONG' ? 80 : 65;
    } else if (macdData.macd < macdData.signal && macdData.histogram < 0) {
      macdSignal = 'SELL';
      macdStrength = Math.abs(macdData.histogram) > 0.001 ? 'STRONG' : 'MODERATE';
      macdConfidence = macdStrength === 'STRONG' ? 80 : 65;
    }
    
    indicators.push({
      name: 'MACD',
      value: macdData.macd,
      signal: macdSignal,
      strength: macdStrength,
      description: `MACD ${macdData.macd > macdData.signal ? 'above' : 'below'} signal line with ${macdData.histogram > 0 ? 'positive' : 'negative'} histogram`,
      confidence: macdConfidence,
      timeframe: '10-30 minutes'
    });
    
    // Bollinger Bands Analysis
    const bb = calculateBollingerBands(prices);
    const currentPrice = prices[prices.length - 1];
    let bbSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let bbStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';
    let bbConfidence = 50;
    
    const upperDistance = (bb.upper - currentPrice) / currentPrice;
    const lowerDistance = (currentPrice - bb.lower) / currentPrice;
    
    if (currentPrice <= bb.lower && !bb.squeeze) {
      bbSignal = 'BUY';
      bbStrength = lowerDistance > 0.002 ? 'STRONG' : 'MODERATE';
      bbConfidence = bbStrength === 'STRONG' ? 75 : 60;
    } else if (currentPrice >= bb.upper && !bb.squeeze) {
      bbSignal = 'SELL';
      bbStrength = upperDistance > 0.002 ? 'STRONG' : 'MODERATE';
      bbConfidence = bbStrength === 'STRONG' ? 75 : 60;
    } else if (bb.squeeze) {
      bbSignal = 'NEUTRAL';
      bbStrength = 'MODERATE';
      bbConfidence = 70; // High confidence in volatility breakout coming
    }
    
    indicators.push({
      name: 'Bollinger Bands',
      value: (currentPrice - bb.lower) / (bb.upper - bb.lower),
      signal: bbSignal,
      strength: bbStrength,
      description: bb.squeeze ? 'Bollinger squeeze detected - breakout imminent' : `Price ${currentPrice < bb.lower ? 'below lower' : currentPrice > bb.upper ? 'above upper' : 'within'} bands`,
      confidence: bbConfidence,
      timeframe: '5-20 minutes'
    });
    
    // Stochastic Analysis
    const stoch = calculateStochastic(prices);
    let stochSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let stochStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';
    let stochConfidence = 50;
    
    if (stoch.k < 20 && stoch.d < 20 && stoch.k > stoch.d) {
      stochSignal = 'BUY';
      stochStrength = 'STRONG';
      stochConfidence = 75;
    } else if (stoch.k > 80 && stoch.d > 80 && stoch.k < stoch.d) {
      stochSignal = 'SELL';
      stochStrength = 'STRONG';
      stochConfidence = 75;
    } else if (stoch.k < 30) {
      stochSignal = 'BUY';
      stochStrength = 'MODERATE';
      stochConfidence = 60;
    } else if (stoch.k > 70) {
      stochSignal = 'SELL';
      stochStrength = 'MODERATE';
      stochConfidence = 60;
    }
    
    indicators.push({
      name: 'Stochastic',
      value: stoch.k,
      signal: stochSignal,
      strength: stochStrength,
      description: `Stochastic %K at ${stoch.k.toFixed(1)}, %D at ${stoch.d.toFixed(1)} - ${stoch.k < 20 ? 'oversold' : stoch.k > 80 ? 'overbought' : 'neutral'}`,
      confidence: stochConfidence,
      timeframe: '3-10 minutes'
    });
    
    // Williams %R Analysis
    const williamsR = calculateWilliamsR(prices);
    let wrSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let wrStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';
    let wrConfidence = 50;
    
    if (williamsR < -80) {
      wrSignal = 'BUY';
      wrStrength = williamsR < -90 ? 'STRONG' : 'MODERATE';
      wrConfidence = wrStrength === 'STRONG' ? 70 : 55;
    } else if (williamsR > -20) {
      wrSignal = 'SELL';
      wrStrength = williamsR > -10 ? 'STRONG' : 'MODERATE';
      wrConfidence = wrStrength === 'STRONG' ? 70 : 55;
    }
    
    indicators.push({
      name: 'Williams %R',
      value: williamsR,
      signal: wrSignal,
      strength: wrStrength,
      description: `Williams %R at ${williamsR.toFixed(1)} indicates ${williamsR < -80 ? 'oversold' : williamsR > -20 ? 'overbought' : 'neutral'} momentum`,
      confidence: wrConfidence,
      timeframe: '5-15 minutes'
    });


    return indicators;
  };

  // Generate market sentiment
  const generateMarketSentiment = (indicators: TechnicalIndicator[]): MarketSentiment => {
    if (indicators.length === 0) {
      return { bullish: 33, bearish: 33, neutral: 34, overall: 'NEUTRAL' };
    }
    
    const buySignals = indicators.filter(i => i.signal === 'BUY');
    const sellSignals = indicators.filter(i => i.signal === 'SELL');
    const neutralSignals = indicators.filter(i => i.signal === 'NEUTRAL');
    
    // Weight by confidence and strength
    const buyWeight = buySignals.reduce((sum, ind) => {
      const strengthMultiplier = ind.strength === 'STRONG' ? 1.5 : ind.strength === 'MODERATE' ? 1.2 : 1;
      return sum + (ind.confidence * strengthMultiplier);
    }, 0);
    
    const sellWeight = sellSignals.reduce((sum, ind) => {
      const strengthMultiplier = ind.strength === 'STRONG' ? 1.5 : ind.strength === 'MODERATE' ? 1.2 : 1;
      return sum + (ind.confidence * strengthMultiplier);
    }, 0);
    
    const neutralWeight = neutralSignals.reduce((sum, ind) => sum + ind.confidence, 0);
    
    const totalWeight = buyWeight + sellWeight + neutralWeight;
    
    if (totalWeight === 0) {
      return { bullish: 33, bearish: 33, neutral: 34, overall: 'NEUTRAL' };
    }
    
    const bullish = (buyWeight / totalWeight) * 100;
    const bearish = (sellWeight / totalWeight) * 100;
    const neutral = (neutralWeight / totalWeight) * 100;

    let overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullish > 45 && bullish > bearish + 10) overall = 'BULLISH';
    else if (bearish > 45 && bearish > bullish + 10) overall = 'BEARISH';

    return { bullish, bearish, neutral, overall };
  };

  // Generate support/resistance levels
  const generatePriceLevels = (price: number): PriceLevel[] => {
    if (!price) return [];

    const levels: PriceLevel[] = [];
    
    // Generate support levels
    for (let i = 1; i <= 3; i++) {
      const supportLevel = price * (1 - (i * 0.001 * Math.random() * 5));
      levels.push({
        type: 'support',
        level: supportLevel,
        strength: i === 1 ? 'STRONG' : i === 2 ? 'MODERATE' : 'WEAK',
        distance: ((price - supportLevel) / price) * 100
      });
    }

    // Generate resistance levels
    for (let i = 1; i <= 3; i++) {
      const resistanceLevel = price * (1 + (i * 0.001 * Math.random() * 5));
      levels.push({
        type: 'resistance',
        level: resistanceLevel,
        strength: i === 1 ? 'STRONG' : i === 2 ? 'MODERATE' : 'WEAK',
        distance: ((resistanceLevel - price) / price) * 100
      });
    }

    return levels.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
  };

  // Generate AI recommendation
  const generateAIRecommendation = (indicators: TechnicalIndicator[], sentiment: MarketSentiment, patterns: any) => {
    if (indicators.length === 0) return null;
    
    const buySignals = indicators.filter(i => i.signal === 'BUY');
    const sellSignals = indicators.filter(i => i.signal === 'SELL');
    const strongSignals = indicators.filter(i => i.strength === 'STRONG');
    
    // Calculate weighted confidence based on indicator strength and confidence
    const buyConfidence = buySignals.reduce((sum, ind) => {
      const strengthWeight = ind.strength === 'STRONG' ? 1.5 : ind.strength === 'MODERATE' ? 1.2 : 1;
      return sum + (ind.confidence * strengthWeight);
    }, 0) / Math.max(buySignals.length, 1);
    
    const sellConfidence = sellSignals.reduce((sum, ind) => {
      const strengthWeight = ind.strength === 'STRONG' ? 1.5 : ind.strength === 'MODERATE' ? 1.2 : 1;
      return sum + (ind.confidence * strengthWeight);
    }, 0) / Math.max(sellSignals.length, 1);

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 50;
    let reasoning = 'Insufficient data or mixed signals suggest waiting for clearer direction';
    let timeframe = '5-10 minutes';
    let entryPrice = currentPrice;
    let targetPrice: number | undefined;
    let stopLoss: number | undefined;
    let riskReward = 1.0;
    let activeIndicators: string[] = [];

    // Pattern analysis bonus
    let patternBonus = 0;
    if (patterns.confidence > 60) {
      patternBonus = patterns.confidence * 0.3;
      if (patterns.signal === 'BUY') buyConfidence += patternBonus;
      if (patterns.signal === 'SELL') sellConfidence += patternBonus;
    }
    
    if (buySignals.length > sellSignals.length && buyConfidence > sellConfidence) {
      action = 'BUY';
      confidence = Math.min(95, buyConfidence + (strongSignals.filter(s => s.signal === 'BUY').length * 5));
      
      const buyIndicatorNames = buySignals.map(i => i.name);
      activeIndicators = buyIndicatorNames;
      
      reasoning = `${buySignals.length} bullish indicator${buySignals.length > 1 ? 's' : ''} (${buyIndicatorNames.join(', ')}) with ${sentiment.bullish.toFixed(0)}% market sentiment`;
      if (patterns.pattern !== 'No Clear Pattern') {
        reasoning += ` + ${patterns.pattern} pattern detected`;
      }
      
      timeframe = confidence > 85 ? '2-5 minutes' : confidence > 70 ? '5-10 minutes' : '10-15 minutes';
      targetPrice = currentPrice * 1.002; // 0.2% target
      stopLoss = currentPrice * 0.9985; // 0.15% stop loss
      riskReward = (targetPrice - currentPrice) / (currentPrice - stopLoss);
      
    } else if (sellSignals.length > buySignals.length && sellConfidence > buyConfidence) {
      action = 'SELL';
      confidence = Math.min(95, sellConfidence + (strongSignals.filter(s => s.signal === 'SELL').length * 5));
      
      const sellIndicatorNames = sellSignals.map(i => i.name);
      activeIndicators = sellIndicatorNames;
      
      reasoning = `${sellSignals.length} bearish indicator${sellSignals.length > 1 ? 's' : ''} (${sellIndicatorNames.join(', ')}) with ${sentiment.bearish.toFixed(0)}% market sentiment`;
      if (patterns.pattern !== 'No Clear Pattern') {
        reasoning += ` + ${patterns.pattern} pattern detected`;
      }
      
      timeframe = confidence > 85 ? '2-5 minutes' : confidence > 70 ? '5-10 minutes' : '10-15 minutes';
      targetPrice = currentPrice * 0.998; // 0.2% target
      stopLoss = currentPrice * 1.0015; // 0.15% stop loss
      riskReward = (currentPrice - targetPrice) / (stopLoss - currentPrice);
      
    } else if (strongSignals.length >= 2) {
      const strongBuySignals = strongSignals.filter(s => s.signal === 'BUY');
      const strongSellSignals = strongSignals.filter(s => s.signal === 'SELL');
      
      if (strongBuySignals.length > strongSellSignals.length) {
        action = 'BUY';
        activeIndicators = strongBuySignals.map(i => i.name);
        targetPrice = currentPrice * 1.0015;
        stopLoss = currentPrice * 0.999;
      } else if (strongSellSignals.length > strongBuySignals.length) {
        action = 'SELL';
        activeIndicators = strongSellSignals.map(i => i.name);
        targetPrice = currentPrice * 0.9985;
        stopLoss = currentPrice * 1.001;
      }
      
      confidence = Math.min(90, 70 + (strongSignals.length * 5));
      reasoning = `${strongSignals.length} strong technical signals (${activeIndicators.join(', ')}) provide clear direction`;
      timeframe = '3-8 minutes';
      riskReward = targetPrice ? Math.abs((targetPrice - currentPrice) / (stopLoss! - currentPrice)) : 1.0;
    }

    // Adjust confidence based on market conditions
    if (sentiment.overall === action.replace('BUY', 'BULLISH').replace('SELL', 'BEARISH')) {
      confidence = Math.min(95, confidence + 5);
    }
    
    return { 
      action, 
      confidence, 
      reasoning, 
      timeframe, 
      entryPrice,
      targetPrice,
      stopLoss,
      riskReward,
      indicators: activeIndicators
    };
  };

  // Perform analysis
  const performAnalysis = () => {
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const indicators = generateTechnicalAnalysis();
      const sentiment = generateMarketSentiment(indicators);
      const levels = generatePriceLevels(currentPrice);
      const patterns = detectPricePatterns(priceHistory.prices);
      const recommendation = generateAIRecommendation(indicators, sentiment, patterns);

      setTechnicalIndicators(indicators);
      setMarketSentiment(sentiment);
      setPriceLevels(levels);
      setAiRecommendation(recommendation);
      setLastAnalysis(Date.now());
      setIsAnalyzing(false);
    }, 1500);
  };

  // Auto-analyze when asset changes or every 30 seconds
  useEffect(() => {
    if (!isCollectingData && priceHistory.prices.length >= 50) {
      performAnalysis();
    }
    const interval = setInterval(() => {
      if (!isCollectingData && priceHistory.prices.length >= 50) {
        performAnalysis();
      }
    }, 15000); // More frequent updates
    return () => clearInterval(interval);
  }, [selectedSymbol, currentPrice, isCollectingData, priceHistory.prices.length]);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'text-green-400';
      case 'SELL': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'STRONG': return 'text-green-400';
      case 'MODERATE': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getRecommendationColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'border-green-500 bg-green-500/10';
      case 'SELL': return 'border-red-500 bg-red-500/10';
      default: return 'border-yellow-500 bg-yellow-500/10';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">AI Asset Analysis</h3>
          {isCollectingData && (
            <div className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-yellow-400 animate-pulse" />
              <span className="text-sm text-yellow-400">Collecting data... ({priceHistory.prices.length}/50)</span>
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-blue-400">Analyzing...</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{selectedSymbol}</div>
          <div className="text-sm text-gray-400">
            {isCollectingData ? 'Initializing...' : `Last: ${new Date(lastAnalysis).toLocaleTimeString()}`}
          </div>
        </div>
      </div>

      {isCollectingData && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Cpu className="h-5 w-5 text-yellow-400" />
            <div>
              <h4 className="text-yellow-400 font-medium">Initializing AI Analysis</h4>
              <p className="text-sm text-gray-300 mt-1">
                Collecting market data for accurate technical analysis. Need {50 - priceHistory.prices.length} more data points.
              </p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="h-2 rounded-full bg-yellow-400 transition-all duration-300"
                  style={{ width: `${(priceHistory.prices.length / 50) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendation */}
      {aiRecommendation && !isCollectingData && (
        <div className={`rounded-lg border-2 p-4 mb-6 ${getRecommendationColor(aiRecommendation.action)}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 space-y-3 lg:space-y-0">
            <div className="flex items-center space-x-3 flex-1">
              <Signal className="h-6 w-6 text-blue-400" />
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                  <span className="text-lg font-bold text-white">
                    AI Recommendation: {aiRecommendation.action}
                  </span>
                  <span className="text-sm bg-gray-700 px-2 py-1 rounded w-fit">
                    {aiRecommendation.timeframe}
                  </span>
                  <span className="text-sm bg-blue-600 px-2 py-1 rounded w-fit">
                    R/R: {aiRecommendation.riskReward.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-1 max-w-none lg:max-w-md xl:max-w-lg">{aiRecommendation.reasoning}</p>
                {aiRecommendation.targetPrice && aiRecommendation.stopLoss && (
                  <div className="flex space-x-4 mt-2 text-xs text-gray-400">
                    <span>Entry: {aiRecommendation.entryPrice.toFixed(4)}</span>
                    <span className="text-green-400">Target: {aiRecommendation.targetPrice.toFixed(4)}</span>
                    <span className="text-red-400">Stop: {aiRecommendation.stopLoss.toFixed(4)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-left lg:text-right flex-shrink-0">
              <div className="text-2xl lg:text-3xl font-bold text-white">{aiRecommendation.confidence.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Confidence</div>
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${aiRecommendation.confidence}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Quick Trade Section */}
      <div className="mb-6 bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900 rounded-xl border border-gray-600 p-4 md:p-6 relative overflow-hidden shadow-2xl">
        {/* Success overlay */}
        {tradeSuccess && (
          <div className="absolute inset-0 bg-green-500/10 border-2 border-green-400 rounded-xl animate-pulse z-10">
            <div className="flex items-center justify-center h-full">
              <div className="bg-gray-800 rounded-lg p-3 border border-green-400">
                <div className="flex items-center space-x-2 text-green-400">
                  <Zap className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Trade Active!</span>
                  {countdown && (
                    <span className="text-xs">
                      {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Target className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Quick Trade Terminal</h3>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400 hidden sm:inline">Live</span>
            </div>
          </div>
          {getPriceMovementIcon()}
        </div>

        <div className="space-y-4">
          {/* Trade Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {/* Stake Amount */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-4 border border-green-500/20 backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                  <DollarSign className="h-3 w-3 text-green-400" />
                </div>
                <label className="text-xs font-medium text-green-300">Stake Amount</label>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-700/50 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300 backdrop-blur-sm"
                  placeholder="10.00"
                  min="1"
                  step="0.01"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-xs">
                  {user?.currency || 'USD'}
                </span>
              </div>
              {/* Quick amount buttons */}
              <div className="flex space-x-1 mt-2">
                {['5', '10', '25', '50'].map((quickAmount) => (
                  <button
                    key={quickAmount}
                    onClick={() => setAmount(quickAmount)}
                    className="flex-1 px-1 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 text-xs rounded transition-colors backdrop-blur-sm"
                  >
                    ${quickAmount}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-xl p-4 border border-yellow-500/20 backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Clock className="h-3 w-3 text-yellow-400" />
                </div>
                <label className="text-xs font-medium text-yellow-300">Duration</label>
              </div>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-gray-700/50 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all duration-300 backdrop-blur-sm"
              >
                <option value="1">1 minute</option>
                <option value="2">2 minutes</option>
                <option value="3">3 minutes</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
              </select>
              <div className="mt-2 flex items-center justify-center">
                <div className="flex items-center space-x-1 text-yellow-400">
                  <Clock className="h-2 w-2" />
                  <span className="text-xs hidden sm:inline">{duration}m expiry</span>
                </div>
              </div>
            </div>

            {/* Current Price Display */}
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20 backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Activity className="h-3 w-3 text-blue-400" />
                </div>
                <label className="text-xs font-medium text-blue-300">Current Price</label>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-mono font-bold transition-all duration-300 ${getPriceMovementClass()}`}>
                  {currentPrice ? currentPrice.toFixed(4) : '---'}
                </div>
                <div className="flex items-center justify-center space-x-2 mt-2">
                  {getPriceMovementIcon()}
                  <span className="text-xs text-gray-400 hidden sm:inline">{selectedSymbol}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trade Summary */}
          <div className="bg-gray-750/50 rounded-xl p-4 border border-gray-600/50 backdrop-blur-sm">
            {isLoadingProposal && (
              <div className="flex items-center justify-center py-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                <span className="text-sm text-gray-400">Getting live prices...</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 backdrop-blur-sm">
                <div className="text-xs text-gray-400 mb-1">Payout</div>
                <div className={`text-base font-bold text-green-400 transition-all duration-300 ${profitAnimation ? 'animate-pulse scale-110' : ''}`}>
                  ${potentialPayout}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 backdrop-blur-sm">
                <div className="text-xs text-gray-400 mb-1">Profit</div>
                <div className={`text-base font-bold text-green-400 transition-all duration-300 ${profitAnimation ? 'animate-pulse scale-110' : ''}`}>
                  +${potentialProfit}
                </div>
              </div>
            </div>
          </div>

          {/* Trade Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Trade Higher Button */}
            <button
              onClick={() => handleTradeAction('CALL')}
              disabled={isTrading || !user || !currentPrice || isLoadingProposal}
              className="group relative disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-3 rounded-xl transition-all duration-300 flex flex-col items-center justify-center space-y-1 transform hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl bg-gradient-to-r from-green-600 via-green-700 to-green-800 hover:from-green-700 hover:via-green-800 hover:to-green-900 shadow-green-500/25 overflow-hidden"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 -top-10 -left-10 bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12 w-6 h-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-700"></div>
              
              {isTrading && selectedContract === 'CALL' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="text-sm">Placing...</span>
                </>
              ) : isLoadingProposal ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="text-sm">Loading...</span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-1">
                    <TrendingUp className="h-5 w-5 animate-bounce" />
                  </div>
                  <span className="text-base font-bold">Higher</span>
                  <Zap className="h-3 w-3 animate-pulse opacity-75" />
                </>
              )}
            </button>

            {/* Trade Lower Button */}
            <button
              onClick={() => handleTradeAction('PUT')}
              disabled={isTrading || !user || !currentPrice || isLoadingProposal}
              className="group relative disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-3 rounded-xl transition-all duration-300 flex flex-col items-center justify-center space-y-1 transform hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 shadow-red-500/25 overflow-hidden"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 -top-10 -left-10 bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12 w-6 h-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-700"></div>
              
              {isTrading && selectedContract === 'PUT' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="text-sm">Placing...</span>
                </>
              ) : isLoadingProposal ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="text-sm">Loading...</span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-1">
                    <TrendingDown className="h-5 w-5 animate-bounce" />
                  </div>
                  <span className="text-base font-bold">Lower</span>
                  <Zap className="h-3 w-3 animate-pulse opacity-75" />
                </>
              )}
            </button>
          </div>

          {/* Status Messages */}
          {!user && (
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">Please log in to place trades</span>
            </div>
          )}

          {(!currentPrice || !proposalData) && user && !isLoadingProposal && (
            <div className="flex items-center justify-center space-x-2 text-sm text-yellow-400">
              <Activity className="h-4 w-4 animate-pulse" />
              <span className="text-xs">Waiting for market data...</span>
            </div>
          )}

          {/* Risk Warning */}
          <div className="text-center">
            <p className="text-xs text-gray-500 leading-relaxed hidden sm:block">
              ⚠️ <strong>Risk Warning:</strong> Trading involves substantial risk of loss. Only trade with money you can afford to lose.
            </p>
          </div>
        </div>
      </div>

      {/* Market Sentiment */}
      {!isCollectingData && (
        <div className="mb-6">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center">
          <Activity className="h-4 w-4 mr-2 text-blue-400" />
          Market Sentiment
        </h4>
        <div className="bg-gray-750 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">Overall: {marketSentiment.overall}</span>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              marketSentiment.overall === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
              marketSentiment.overall === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {marketSentiment.overall}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Bullish</span>
              <span className="text-white">{marketSentiment.bullish.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-green-400 transition-all duration-300"
                style={{ width: `${marketSentiment.bullish}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-400">Bearish</span>
              <span className="text-white">{marketSentiment.bearish.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-red-400 transition-all duration-300"
                style={{ width: `${marketSentiment.bearish}%` }}
              ></div>
            </div>
          </div>
        </div>
      )};
    </div>
  );
};

export default AssetAnalysis;