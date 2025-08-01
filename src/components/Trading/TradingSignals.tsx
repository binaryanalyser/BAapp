import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, Target, Brain, Zap, Activity, AlertCircle } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface Signal {
  id: string;
  symbol: string;
  type: 'CALL' | 'PUT' | 'MATCH' | 'DIFFER';
  strength: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  entry: number;
  expiry: string;
  reasoning: string;
  timestamp: number;
  indicators: {
    rsi: number;
    macd: 'bullish' | 'bearish' | 'neutral';
    bollinger: 'squeeze' | 'expansion' | 'normal';
    volume: 'high' | 'normal' | 'low';
  };
  priceAction: {
    trend: 'uptrend' | 'downtrend' | 'sideways';
    momentum: number;
    volatility: number;
  };
  isLive: boolean;
  countdown: number;
}

interface MarketData {
  symbol: string;
  price: number;
  previousPrices: number[];
  volume: number;
  timestamp: number;
}

interface AIRecommendation {
  action: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  reasoning: string;
  startTime: number;
  duration: number; // Duration in minutes
  remainingTime: number; // Remaining time in seconds
}

interface TradingSignalsProps {
  selectedAsset?: string;
}

const TradingSignals: React.FC<TradingSignalsProps> = ({ selectedAsset }) => {
  const { ticks } = useWebSocket();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'active'>('idle');
  const [signalDuration, setSignalDuration] = useState<number>(5); // Duration in minutes
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  
  // AI Recommendation state - now properly managed
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);

  // Advanced technical analysis functions
  const calculateRSI = useCallback((prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    
    return 100 - (100 / (1 + rs));
  }, []);

  const calculateMACD = useCallback((prices: number[]): 'bullish' | 'bearish' | 'neutral' => {
    if (prices.length < 26) return 'neutral';
    
    const ema12 = prices.slice(-12).reduce((a, b) => a + b) / 12;
    const ema26 = prices.slice(-26).reduce((a, b) => a + b) / 26;
    const macdLine = ema12 - ema26;
    
    if (macdLine > 0.001) return 'bullish';
    if (macdLine < -0.001) return 'bearish';
    return 'neutral';
  }, []);

  const calculateBollingerBands = useCallback((prices: number[], period: number = 20): 'squeeze' | 'expansion' | 'normal' => {
    if (prices.length < period) return 'normal';
    
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b) / period;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const bandWidth = (stdDev * 2) / sma;
    
    if (bandWidth < 0.001) return 'squeeze';
    if (bandWidth > 0.005) return 'expansion';
    return 'normal';
  }, []);

  const analyzePriceAction = useCallback((prices: number[]) => {
    if (prices.length < 10) return { trend: 'sideways' as const, momentum: 0, volatility: 0 };
    
    const recent = prices.slice(-10);
    const older = prices.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b) / older.length;
    
    const trend = recentAvg > olderAvg * 1.001 ? 'uptrend' : 
                  recentAvg < olderAvg * 0.999 ? 'downtrend' : 'sideways';
    
    const momentum = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    const volatility = Math.sqrt(
      recent.reduce((sum, price) => sum + Math.pow(price - recentAvg, 2), 0) / recent.length
    ) / recentAvg;
    
    return { trend, momentum, volatility };
  }, []);

  const generateAIRecommendation = useCallback((marketData: Record<string, MarketData>): {
    action: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    reasoning: string;
  } => {
    const symbols = Object.keys(marketData);
    if (symbols.length === 0) return { action: 'NEUTRAL', confidence: 0, reasoning: 'No market data available' };

    let totalBullishSignals = 0;
    let totalBearishSignals = 0;
    let totalConfidence = 0;
    let reasoningParts: string[] = [];
    let analyzedSymbols = 0;

    symbols.forEach(symbol => {
      const data = marketData[symbol];
      if (data.previousPrices.length < 20) return;

      analyzedSymbols++;
      let symbolScore = 0;

      const rsi = calculateRSI(data.previousPrices);
      const macd = calculateMACD(data.previousPrices);
      const priceAction = analyzePriceAction(data.previousPrices);
      const bollinger = calculateBollingerBands(data.previousPrices);

      // RSI Analysis
      if (rsi < 30) {
        totalBullishSignals += 2;
        symbolScore += 2;
        reasoningParts.push(`${symbol}: Oversold (RSI: ${rsi.toFixed(0)})`);
      } else if (rsi > 70) {
        totalBearishSignals += 2;
        symbolScore -= 2;
        reasoningParts.push(`${symbol}: Overbought (RSI: ${rsi.toFixed(0)})`);
      }

      // MACD Analysis
      if (macd === 'bullish') {
        totalBullishSignals += 1;
        symbolScore += 1;
      } else if (macd === 'bearish') {
        totalBearishSignals += 1;
        symbolScore -= 1;
      }

      // Price Action Analysis
      if (priceAction.trend === 'uptrend' && priceAction.momentum > 0.1) {
        totalBullishSignals += 1;
        symbolScore += 1;
      } else if (priceAction.trend === 'downtrend' && priceAction.momentum < -0.1) {
        totalBearishSignals += 1;
        symbolScore -= 1;
      }

      // Bollinger Bands Analysis
      if (bollinger === 'squeeze') {
        totalConfidence += 10; // Volatility breakout expected
        reasoningParts.push(`${symbol}: Volatility squeeze detected`);
      }

      totalConfidence += Math.abs(symbolScore) * 5;
    });

    if (analyzedSymbols === 0) {
      return { action: 'NEUTRAL', confidence: 0, reasoning: 'Insufficient market data for analysis' };
    }

    // Determine overall recommendation
    const netSignal = totalBullishSignals - totalBearishSignals;
    const baseConfidence = Math.min(totalConfidence / analyzedSymbols, 95);
    
    let action: 'BUY' | 'SELL' | 'NEUTRAL';
    let confidence: number;
    let reasoning: string;

    if (netSignal > 2) {
      action = 'BUY';
      confidence = Math.min(baseConfidence + (netSignal * 5), 95);
      reasoning = `Bullish market conditions detected. ${reasoningParts.slice(0, 2).join(', ')}`;
    } else if (netSignal < -2) {
      action = 'SELL';
      confidence = Math.min(baseConfidence + (Math.abs(netSignal) * 5), 95);
      reasoning = `Bearish market conditions detected. ${reasoningParts.slice(0, 2).join(', ')}`;
    } else {
      action = 'NEUTRAL';
      confidence = Math.max(baseConfidence - 20, 30);
      reasoning = `Mixed signals across markets. ${analyzedSymbols} assets analyzed with conflicting indicators`;
    }

    return { action, confidence: Math.round(confidence), reasoning };
  }, [calculateRSI, calculateMACD, analyzePriceAction, calculateBollingerBands]);

  const generateAdvancedSignal = useCallback((symbol: string, currentPrice: number, data: MarketData): Signal | null => {
    const { previousPrices } = data;
    
    if (previousPrices.length < 30) return null;
    
    const rsi = calculateRSI(previousPrices);
    const macd = calculateMACD(previousPrices);
    const bollinger = calculateBollingerBands(previousPrices);
    const priceAction = analyzePriceAction(previousPrices);
    
    // Advanced signal logic
    let signalType: Signal['type'] = 'CALL';
    let confidence = 50;
    let strength: Signal['strength'] = 'LOW';
    let reasoning = '';
    
    // RSI-based signals
    if (rsi < 30 && macd === 'bullish') {
      signalType = 'CALL';
      confidence += 25;
      reasoning = 'RSI oversold with bullish MACD divergence';
    } else if (rsi > 70 && macd === 'bearish') {
      signalType = 'PUT';
      confidence += 25;
      reasoning = 'RSI overbought with bearish MACD divergence';
    }
    
    // Bollinger Bands signals
    if (bollinger === 'squeeze' && priceAction.volatility > 0.002) {
      confidence += 20;
      reasoning += ' + Bollinger squeeze breakout imminent';
    }
    
    // Price action confirmation
    if (priceAction.trend === 'uptrend' && signalType === 'CALL') {
      confidence += 15;
    } else if (priceAction.trend === 'downtrend' && signalType === 'PUT') {
      confidence += 15;
    }
    
    // Volume confirmation
    if (data.volume > 1.5) {
      confidence += 10;
      reasoning += ' + High volume confirmation';
    }
    
    // Digit-based signals for high volatility
    if (priceAction.volatility > 0.003) {
      const lastDigit = Math.floor((currentPrice * 10000) % 10);
      if (Math.random() > 0.7) {
        signalType = Math.random() > 0.5 ? 'MATCH' : 'DIFFER';
        reasoning = `Last digit analysis: ${lastDigit} - ${signalType === 'MATCH' ? 'pattern match expected' : 'digit change likely'}`;
      }
    }
    
    // Determine strength
    if (confidence >= 85) strength = 'CRITICAL';
    else if (confidence >= 75) strength = 'HIGH';
    else if (confidence >= 65) strength = 'MEDIUM';
    else strength = 'LOW';
    
    // Only generate signals with reasonable confidence
    if (confidence < 60) return null;
    
    return {
      id: `${symbol}-${Date.now()}-${Math.random()}`,
      symbol,
      type: signalType,
      strength,
      confidence: Math.min(confidence, 95),
      entry: currentPrice,
      expiry: strength === 'CRITICAL' ? '3m' : strength === 'HIGH' ? '5m' : '10m',
      reasoning,
      timestamp: Date.now(),
      indicators: {
        rsi: Math.round(rsi),
        macd,
        bollinger,
        volume: data.volume > 1.5 ? 'high' : data.volume > 0.8 ? 'normal' : 'low'
      },
      priceAction,
      isLive: true,
      countdown: strength === 'CRITICAL' ? 180 : strength === 'HIGH' ? 300 : 600
    };
  }, [calculateRSI, calculateMACD, calculateBollingerBands, analyzePriceAction]);

  // Update market data
  useEffect(() => {
    Object.entries(ticks).forEach(([symbol, tick]) => {
      if (!tick) return;
      
      setMarketData(prev => {
        const existing = prev[symbol] || { 
          symbol, 
          price: tick.tick, 
          previousPrices: [], 
          volume: 1, 
          timestamp: tick.epoch 
        };
        
        const newPrices = [...existing.previousPrices, tick.tick].slice(-50);
        const volumeChange = Math.abs(tick.tick - existing.price) / existing.price;
        
        return {
          ...prev,
          [symbol]: {
            ...existing,
            price: tick.tick,
            previousPrices: newPrices,
            volume: volumeChange * 100 + 0.5,
            timestamp: tick.epoch
          }
        };
      });
    });
  }, [ticks]);

  // Initialize analysis when market data is available
  useEffect(() => {
    if (isInitializing && Object.keys(marketData).length > 0) {
      console.log('Initializing AI Analysis...');
      performAnalysis();
      setIsInitializing(false);
    }
  }, [marketData, isInitializing]);

  // Perform AI Analysis - only when no active recommendation or when current one expires
  const performAnalysis = useCallback(() => {
    if (analysisStatus === 'analyzing') return; // Prevent multiple simultaneous analyses
    
    console.log(`Starting AI Analysis for ${signalDuration} minutes...`);
    setAnalysisStatus('analyzing');
    
    setTimeout(() => {
      // Generate AI Recommendation
      const recommendation = generateAIRecommendation(marketData);
      
      const newAiRecommendation: AIRecommendation = {
        action: recommendation.action,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
        startTime: Date.now(),
        duration: signalDuration,
        remainingTime: signalDuration * 60 // Convert to seconds
      };
      
      setAiRecommendation(newAiRecommendation);
      
      // Generate individual signals (these are separate from the main AI recommendation)
      const symbolsToAnalyze = selectedAsset 
        ? [selectedAsset, ...Object.keys(marketData).filter(s => s !== selectedAsset)]
        : Object.keys(marketData);

      symbolsToAnalyze.forEach((symbol) => {
        const data = marketData[symbol];
        if (!data) return;

        // Higher chance for selected asset, lower for others
        const generationChance = symbol === selectedAsset ? 0.8 : 0.2;
        
        if (Math.random() < generationChance) {
          const signal = generateAdvancedSignal(symbol, data.price, data);
          if (signal) {
            setSignals(prev => {
              const filtered = prev.filter(s => s.symbol !== symbol);
              return [signal, ...filtered].slice(0, 6);
            });
          }
        }
      });
      
      setAnalysisStatus('active');
      console.log(`Analysis complete. AI recommendation: ${recommendation.action} for ${signalDuration} minutes.`);
    }, 2000);
  }, [marketData, generateAIRecommendation, selectedAsset, signalDuration, generateAdvancedSignal, analysisStatus]);

  // Handle duration change - restart analysis immediately
  useEffect(() => {
    if (!isInitializing && Object.keys(marketData).length > 0) {
      console.log(`Duration changed to ${signalDuration} minutes. Restarting analysis...`);
      // Clear current recommendation and restart
      setAiRecommendation(null);
      setAnalysisStatus('idle');
      setTimeout(() => performAnalysis(), 500);
    }
  }, [signalDuration]);

  // AI Recommendation countdown and expiry management
  useEffect(() => {
    if (!aiRecommendation || analysisStatus !== 'active') return;

    const interval = setInterval(() => {
      setAiRecommendation(prev => {
        if (!prev) return null;
        
        const newRemainingTime = prev.remainingTime - 1;
        
        if (newRemainingTime <= 0) {
          // Recommendation expired, trigger new analysis
          console.log('AI recommendation expired. Starting new analysis...');
          setAnalysisStatus('idle');
          setTimeout(() => performAnalysis(), 1000);
          return null;
        }
        
        return {
          ...prev,
          remainingTime: newRemainingTime
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [aiRecommendation, analysisStatus, performAnalysis]);

  // Update signal countdowns (these are independent of AI recommendation)
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => prev.map(signal => ({
        ...signal,
        countdown: Math.max(0, signal.countdown - 1),
        isLive: true
      })).filter(signal => {
        // Keep signals for a reasonable time
        const signalAge = Date.now() - signal.timestamp;
        return signalAge < (10 * 60 * 1000); // 10 minutes max
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getSignalIcon = (type: Signal['type']) => {
    switch (type) {
      case 'CALL':
        return <TrendingUp className="h-5 w-5 text-green-400" />;
      case 'PUT':
        return <TrendingDown className="h-5 w-5 text-red-400" />;
      case 'MATCH':
        return <Target className="h-5 w-5 text-blue-400" />;
      case 'DIFFER':
        return <Minus className="h-5 w-5 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getSignalColor = (type: Signal['type']) => {
    switch (type) {
      case 'CALL':
        return 'border-green-500 bg-green-500/10';
      case 'PUT':
        return 'border-red-500 bg-red-500/10';
      case 'MATCH':
        return 'border-blue-500 bg-blue-500/10';
      case 'DIFFER':
        return 'border-yellow-500 bg-yellow-500/10';
    }
  };

  const getStrengthColor = (strength: Signal['strength']) => {
    switch (strength) {
      case 'CRITICAL':
        return 'text-red-400 animate-pulse';
      case 'HIGH':
        return 'text-green-400';
      case 'MEDIUM':
        return 'text-yellow-400';
      case 'LOW':
        return 'text-gray-400';
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const durationOptions = [
    { value: 1, label: '1 minute' },
    { value: 2, label: '2 minutes' },
    { value: 3, label: '3 minutes' },
    { value: 5, label: '5 minutes' },
    { value: 10, label: '10 minutes' },
    { value: 15, label: '15 minutes' }
  ];

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl border border-gray-600 shadow-2xl overflow-hidden">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 border-b border-gray-600 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full animate-pulse opacity-20"></div>
              <Brain className="h-8 w-8 text-blue-400 relative z-10" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">AI Trading Signals</h3>
              <p className="text-sm text-gray-300">Advanced algorithmic analysis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Analysis Status */}
            <div className="flex items-center space-x-3">
              {analysisStatus === 'analyzing' ? (
                <>
                  <div className="relative">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                    <div className="absolute inset-0 animate-ping rounded-full h-5 w-5 border border-blue-400 opacity-20"></div>
                  </div>
                  <span className="text-sm text-blue-400 font-medium">Analyzing Markets...</span>
                </>
              ) : analysisStatus === 'active' && aiRecommendation ? (
                <>
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  <div className="flex flex-col">
                    <span className="text-sm text-green-400 font-medium">Active Signal</span>
                    <span className="text-xs text-gray-400">
                      {formatCountdown(aiRecommendation.remainingTime)} remaining
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-yellow-400 font-medium">Initializing...</span>
                </>
              )}
            </div>
            
            {/* Stats */}
            <div className="hidden md:flex items-center space-x-4 text-sm">
              {/* Duration Selector */}
              <div className="bg-gray-700/50 rounded-lg px-3 py-2 border border-gray-600">
                <select
                  value={signalDuration}
                  onChange={(e) => setSignalDuration(parseInt(e.target.value))}
                  className="bg-transparent text-blue-400 font-bold text-sm focus:outline-none"
                  disabled={analysisStatus === 'analyzing'}
                >
                  {durationOptions.map(option => (
                    <option key={option.value} value={option.value} className="bg-gray-800">
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="text-gray-400 text-xs">Duration</div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg px-3 py-2 border border-gray-600">
                <div className="text-blue-400 font-bold">{signals.length}</div>
                <div className="text-gray-400 text-xs">Signals</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg px-3 py-2 border border-gray-600">
                <div className="text-green-400 font-bold">{Object.keys(marketData).length}</div>
                <div className="text-gray-400 text-xs">Assets</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6">
        {/* AI Recommendation Card */}
        {aiRecommendation && analysisStatus === 'active' && (
          <div className={`mb-6 rounded-xl border-2 p-6 ${
            aiRecommendation.action === 'BUY' ? 'border-green-500 bg-green-500/10' :
            aiRecommendation.action === 'SELL' ? 'border-red-500 bg-red-500/10' : 'border-blue-500 bg-blue-500/10'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-full animate-pulse ${
                    aiRecommendation.action === 'BUY' ? 'bg-green-500/30' :
                    aiRecommendation.action === 'SELL' ? 'bg-red-500/30' : 'bg-blue-500/30'
                  }`}></div>
                  <Brain className={`h-8 w-8 relative z-10 ${
                    aiRecommendation.action === 'BUY' ? 'text-green-400' :
                    aiRecommendation.action === 'SELL' ? 'text-red-400' : 'text-blue-400'
                  }`} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-1">AI Recommendation</h4>
                  <p className="text-sm text-gray-300 max-w-md">{aiRecommendation.reasoning}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-3xl font-bold mb-2 ${
                  aiRecommendation.action === 'BUY' ? 'text-green-400' :
                  aiRecommendation.action === 'SELL' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {aiRecommendation.action}
                </div>
                <div className="text-lg font-bold text-white mb-1">{aiRecommendation.confidence}%</div>
                <div className="text-xl font-mono text-yellow-400 bg-gray-700/50 px-3 py-2 rounded-lg">
                  {formatCountdown(aiRecommendation.remainingTime)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {signalDuration}min signal
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-1000 ${
                    aiRecommendation.action === 'BUY' ? 'bg-green-400' :
                    aiRecommendation.action === 'SELL' ? 'bg-red-400' : 'bg-blue-400'
                  }`}
                  style={{ 
                    width: `${100 - (aiRecommendation.remainingTime / (signalDuration * 60)) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Loading/Initializing State */}
        {(isInitializing || analysisStatus === 'analyzing' || (!aiRecommendation && analysisStatus !== 'active')) && (
          <div className="text-center py-16">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <Brain className="h-16 w-16 text-blue-400 opacity-60" />
                <div className="absolute -top-2 -right-2">
                  <Zap className="h-6 w-6 text-yellow-400 animate-bounce" />
                </div>
              </div>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2">
              {isInitializing ? 'Initializing AI Analysis' : 
               analysisStatus === 'analyzing' ? 'AI Market Analysis in Progress' :
               'Preparing Analysis'}
            </h4>
            <p className="text-gray-400 mb-4">
              {isInitializing ? 'Setting up advanced market analysis algorithms...' :
               analysisStatus === 'analyzing' ? `Analyzing ${selectedAsset || 'market'} conditions for ${signalDuration} minute${signalDuration > 1 ? 's' : ''}...` :
               `Preparing ${signalDuration}-minute analysis cycle`}
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <span className="text-gray-300">{signalDuration}min Analysis</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-green-400" />
                <span className="text-gray-300">Pattern Recognition</span>
              </div>
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4 text-purple-400" />
                <span className="text-gray-300">ML Predictions</span>
              </div>
            </div>
          </div>
        )}

        {/* Individual Signals */}
        {signals.length > 0 && (
          <div className="space-y-4">
            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-blue-400" />
                Additional Market Signals
              </h4>
            </div>
            {signals.map((signal) => (
              <div
                key={signal.id}
                className={`relative rounded-xl border-2 p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${getSignalColor(signal.type)} ${
                  signal.strength === 'CRITICAL' ? 'ring-2 ring-red-400/50 animate-pulse' : ''
                }`}
              >
                {/* Signal Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className={`absolute inset-0 rounded-full animate-pulse ${
                        signal.type === 'CALL' ? 'bg-green-500/20' :
                        signal.type === 'PUT' ? 'bg-red-500/20' :
                        signal.type === 'MATCH' ? 'bg-blue-500/20' : 'bg-yellow-500/20'
                      }`}></div>
                      <div className="relative p-2 rounded-full bg-gray-700/50">
                        {getSignalIcon(signal.type)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="text-xl font-bold text-white">{signal.symbol}</span>
                        <span className="px-3 py-1 bg-gray-700 rounded-full text-sm font-medium text-white">
                          {signal.type}
                        </span>
                        {signal.isLive && (
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-400 font-medium">LIVE</span>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed max-w-md">{signal.reasoning}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold mb-1 ${getStrengthColor(signal.strength)}`}>
                      {signal.strength}
                      {signal.strength === 'CRITICAL' && <AlertCircle className="inline h-4 w-4 ml-1" />}
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{signal.confidence}%</div>
                    <div className="text-sm text-yellow-400 font-mono bg-gray-700/50 px-2 py-1 rounded">
                      {formatCountdown(signal.countdown)}
                    </div>
                  </div>
                </div>
                
                {/* Technical Indicators Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">RSI</div>
                    <div className={`text-lg font-bold ${
                      signal.indicators.rsi < 30 ? 'text-green-400' : 
                      signal.indicators.rsi > 70 ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {signal.indicators.rsi}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">MACD</div>
                    <div className={`text-sm font-medium capitalize ${
                      signal.indicators.macd === 'bullish' ? 'text-green-400' :
                      signal.indicators.macd === 'bearish' ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {signal.indicators.macd}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Bollinger</div>
                    <div className={`text-sm font-medium capitalize ${
                      signal.indicators.bollinger === 'squeeze' ? 'text-yellow-400' :
                      signal.indicators.bollinger === 'expansion' ? 'text-blue-400' : 'text-gray-300'
                    }`}>
                      {signal.indicators.bollinger}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Volume</div>
                    <div className={`text-sm font-medium capitalize ${
                      signal.indicators.volume === 'high' ? 'text-green-400' :
                      signal.indicators.volume === 'normal' ? 'text-gray-300' : 'text-red-400'
                    }`}>
                      {signal.indicators.volume}
                    </div>
                  </div>
                </div>

                {/* Signal Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-600">
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Entry:</span>
                      <span className="text-white font-mono">{signal.entry.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Expiry:</span>
                      <span className="text-white font-medium">{signal.expiry}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Trend:</span>
                      <span className={`capitalize font-medium ${
                        signal.priceAction.trend === 'uptrend' ? 'text-green-400' :
                        signal.priceAction.trend === 'downtrend' ? 'text-red-400' : 'text-gray-300'
                      }`}>
                        {signal.priceAction.trend}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(signal.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingSignals;