import React, { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, TrendingDown, Target, Activity, Zap, AlertCircle, BarChart3 } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useAuth } from '../../contexts/AuthContext';

interface AssetSignal {
  symbol: string;
  displayName: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  strength: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
  technicalIndicators: {
    rsi: number;
    macd: 'bullish' | 'bearish' | 'neutral';
    bollinger: 'squeeze' | 'expansion' | 'normal';
    momentum: number;
    volatility: number;
  };
  priceData: {
    currentPrice: number;
    priceChange: number;
    trend: 'uptrend' | 'downtrend' | 'sideways';
  };
  timestamp: number;
  expiryTime: string;
}

interface AssetAnalysisProps {
  selectedSymbol?: string;
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol }) => {
  const { ticks } = useWebSocket();
  const { user } = useAuth();
  const [signals, setSignals] = useState<AssetSignal[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [marketData, setMarketData] = useState<Record<string, { prices: number[]; volume: number; timestamp: number }>>({});
  const [analysisInterval, setAnalysisInterval] = useState<NodeJS.Timeout | null>(null);

  // Assets to analyze
  const assetsToAnalyze = [
    { symbol: 'R_10', displayName: 'Volatility 10 Index', pip: 0.001 },
    { symbol: 'R_25', displayName: 'Volatility 25 Index', pip: 0.001 },
    { symbol: 'R_50', displayName: 'Volatility 50 Index', pip: 0.0001 },
    { symbol: 'R_75', displayName: 'Volatility 75 Index', pip: 0.0001 },
    { symbol: 'R_100', displayName: 'Volatility 100 Index', pip: 0.01 },
    { symbol: 'BOOM1000', displayName: 'Boom 1000 Index', pip: 0.01 },
    { symbol: 'CRASH1000', displayName: 'Crash 1000 Index', pip: 0.01 },
    { symbol: 'STEPINDEX', displayName: 'Step Index', pip: 0.01 }
  ];

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
    
    if (avgLoss === 0) return 100;
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
    
    if (older.length === 0) return { trend: 'sideways' as const, momentum: 0, volatility: 0 };
    
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

  // Generate high-accuracy signal for an asset
  const generateAssetSignal = useCallback((asset: typeof assetsToAnalyze[0], currentPrice: number, priceHistory: number[]): AssetSignal | null => {
    if (priceHistory.length < 30) return null;
    
    const rsi = calculateRSI(priceHistory);
    const macd = calculateMACD(priceHistory);
    const bollinger = calculateBollingerBands(priceHistory);
    const priceAction = analyzePriceAction(priceHistory);
    
    let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 50;
    let reasoning = '';
    let strength: AssetSignal['strength'] = 'LOW';
    
    // Advanced signal generation with multiple confirmations
    const signals: Array<{ type: 'BUY' | 'SELL'; weight: number; reason: string }> = [];
    
    // RSI Analysis (High weight for extreme values)
    if (rsi < 25) {
      signals.push({ type: 'BUY', weight: 25, reason: 'Severely oversold (RSI < 25)' });
    } else if (rsi < 35) {
      signals.push({ type: 'BUY', weight: 15, reason: 'Oversold conditions' });
    } else if (rsi > 75) {
      signals.push({ type: 'SELL', weight: 25, reason: 'Severely overbought (RSI > 75)' });
    } else if (rsi > 65) {
      signals.push({ type: 'SELL', weight: 15, reason: 'Overbought conditions' });
    }
    
    // MACD Analysis
    if (macd === 'bullish') {
      signals.push({ type: 'BUY', weight: 20, reason: 'Bullish MACD crossover' });
    } else if (macd === 'bearish') {
      signals.push({ type: 'SELL', weight: 20, reason: 'Bearish MACD crossover' });
    }
    
    // Bollinger Bands Analysis
    if (bollinger === 'squeeze') {
      signals.push({ type: 'BUY', weight: 15, reason: 'Volatility breakout expected' });
    }
    
    // Price Action Analysis
    if (priceAction.trend === 'uptrend' && priceAction.momentum > 0.15) {
      signals.push({ type: 'BUY', weight: 20, reason: 'Strong upward momentum' });
    } else if (priceAction.trend === 'downtrend' && priceAction.momentum < -0.15) {
      signals.push({ type: 'SELL', weight: 20, reason: 'Strong downward momentum' });
    }
    
    // Volatility Analysis
    if (priceAction.volatility > 0.003) {
      signals.push({ type: 'BUY', weight: 10, reason: 'High volatility opportunity' });
    }
    
    // Calculate weighted signal
    const buyWeight = signals.filter(s => s.type === 'BUY').reduce((sum, s) => sum + s.weight, 0);
    const sellWeight = signals.filter(s => s.type === 'SELL').reduce((sum, s) => sum + s.weight, 0);
    
    if (buyWeight > sellWeight && buyWeight > 30) {
      signal = 'BUY';
      confidence = Math.min(50 + buyWeight, 95);
      reasoning = signals.filter(s => s.type === 'BUY').map(s => s.reason).slice(0, 2).join(' + ');
    } else if (sellWeight > buyWeight && sellWeight > 30) {
      signal = 'SELL';
      confidence = Math.min(50 + sellWeight, 95);
      reasoning = signals.filter(s => s.type === 'SELL').map(s => s.reason).slice(0, 2).join(' + ');
    } else {
      signal = 'NEUTRAL';
      confidence = Math.max(30, 50 - Math.abs(buyWeight - sellWeight));
      reasoning = 'Mixed signals, market consolidation expected';
    }
    
    // Determine strength based on confidence
    if (confidence >= 85) strength = 'CRITICAL';
    else if (confidence >= 75) strength = 'HIGH';
    else if (confidence >= 65) strength = 'MEDIUM';
    else strength = 'LOW';
    
    // Only return signals with reasonable confidence (lowered threshold for better signal generation)
    if (confidence < 55) return null;
    
    // Calculate price change
    const previousPrice = priceHistory[priceHistory.length - 2] || currentPrice;
    const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
    
    // Determine expiry time based on strength
    const expiryMinutes = strength === 'CRITICAL' ? 3 : strength === 'HIGH' ? 5 : 10;
    
    return {
      symbol: asset.symbol,
      displayName: asset.displayName,
      signal,
      confidence: Math.round(confidence),
      strength,
      reasoning,
      technicalIndicators: {
        rsi: Math.round(rsi),
        macd,
        bollinger,
        momentum: priceAction.momentum,
        volatility: priceAction.volatility
      },
      priceData: {
        currentPrice,
        priceChange,
        trend: priceAction.trend
      },
      timestamp: Date.now(),
      expiryTime: `${expiryMinutes}m`
    };
  }, [calculateRSI, calculateMACD, calculateBollingerBands, analyzePriceAction]);

  // Update market data from ticks
  useEffect(() => {
    Object.entries(ticks).forEach(([symbol, tick]) => {
      if (!tick || !assetsToAnalyze.find(a => a.symbol === symbol)) return;
      
      setMarketData(prev => {
        const existing = prev[symbol] || { prices: [], volume: 1, timestamp: tick.epoch };
        const newPrices = [...existing.prices, tick.price].slice(-50); // Keep last 50 prices
        
        return {
          ...prev,
          [symbol]: {
            prices: newPrices,
            volume: Math.abs(tick.price - (existing.prices[existing.prices.length - 1] || tick.price)) * 100,
            timestamp: tick.epoch
          }
        };
      });
    });
  }, [ticks]);

  // Perform analysis on all assets
  const performAnalysis = useCallback(() => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const candidateSignals: AssetSignal[] = [];
      
      assetsToAnalyze.forEach(asset => {
        const tickData = ticks[asset.symbol];
        const priceHistory = marketData[asset.symbol]?.prices || [];
        
        if (tickData && priceHistory.length >= 30) {
          const signal = generateAssetSignal(asset, tickData.price, priceHistory);
          if (signal) {
            candidateSignals.push(signal);
          }
        }
      });
      
      // Find the single highest probability signal
      let bestSignal: AssetSignal | null = null;
      
      if (candidateSignals.length > 0) {
        // Sort by confidence and strength priority
        candidateSignals.sort((a, b) => {
          // First priority: strength (CRITICAL > HIGH > MEDIUM > LOW)
          const strengthOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
          const strengthDiff = strengthOrder[b.strength] - strengthOrder[a.strength];
          if (strengthDiff !== 0) return strengthDiff;
          
          // Second priority: confidence
          return b.confidence - a.confidence;
        });
        
        bestSignal = candidateSignals[0];
      }
      
      // Set only the best signal, or empty array if none found
      setSignals(bestSignal ? [bestSignal] : []);
      setLastAnalysisTime(Date.now());
      setIsAnalyzing(false);
    }, 2000); // 2 second analysis simulation
  }, [assetsToAnalyze, ticks, marketData, generateAssetSignal, isAnalyzing]);

  // Auto-analysis every 2 minutes
  useEffect(() => {
    if (analysisInterval) {
      clearInterval(analysisInterval);
    }
    
    const interval = setInterval(() => {
      performAnalysis();
    }, 120000); // 2 minutes
    
    setAnalysisInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [performAnalysis]);

  // Initial analysis when market data is available
  useEffect(() => {
    const availableAssets = assetsToAnalyze.filter(asset => 
      ticks[asset.symbol] && marketData[asset.symbol]?.prices.length >= 30
    );
    
    if (availableAssets.length >= 3 && Date.now() - lastAnalysisTime > 60000) {
      performAnalysis();
    }
  }, [marketData, ticks, lastAnalysisTime, performAnalysis]);

  const getSignalIcon = (signal: 'BUY' | 'SELL' | 'NEUTRAL') => {
    switch (signal) {
      case 'BUY':
        return <TrendingUp className="h-5 w-5 text-green-400" />;
      case 'SELL':
        return <TrendingDown className="h-5 w-5 text-red-400" />;
      case 'NEUTRAL':
        return <Target className="h-5 w-5 text-gray-400" />;
    }
  };

  const getSignalColor = (signal: 'BUY' | 'SELL' | 'NEUTRAL') => {
    switch (signal) {
      case 'BUY':
        return 'border-green-500 bg-green-500/10';
      case 'SELL':
        return 'border-red-500 bg-red-500/10';
      case 'NEUTRAL':
        return 'border-gray-500 bg-gray-500/10';
    }
  };

  const getStrengthColor = (strength: AssetSignal['strength']) => {
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

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl border border-gray-600 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-purple-600/20 border-b border-gray-600 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 rounded-full animate-pulse opacity-20"></div>
              <Brain className="h-8 w-8 text-purple-400 relative z-10" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">AI Multi-Asset Analysis</h3>
              <p className="text-sm text-gray-300">Advanced algorithmic analysis across multiple markets</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Analysis Status */}
            <div className="flex items-center space-x-3">
              {isAnalyzing ? (
                <>
                  <div className="relative">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-400 border-t-transparent"></div>
                    <div className="absolute inset-0 animate-ping rounded-full h-5 w-5 border border-purple-400 opacity-20"></div>
                  </div>
                  <span className="text-sm text-purple-400 font-medium">Analyzing Markets...</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  <span className="text-sm text-green-400 font-medium">Analysis Complete</span>
                </>
              )}
            </div>
            
            {/* Stats */}
            <div className="hidden md:flex items-center space-x-4 text-sm">
              <div className="bg-gray-700/50 rounded-lg px-3 py-2 border border-gray-600">
                <div className="text-purple-400 font-bold">{signals.length}</div>
                <div className="text-gray-400 text-xs">Signals</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg px-3 py-2 border border-gray-600">
                <div className="text-green-400 font-bold">{assetsToAnalyze.length}</div>
                <div className="text-gray-400 text-xs">Assets</div>
              </div>
              <button
                onClick={performAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium"
              >
                {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {signals.length === 0 ? (
          <div className="text-center py-16">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full animate-pulse"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <BarChart3 className="h-16 w-16 text-purple-400 opacity-60" />
                <div className="absolute -top-2 -right-2">
                  <Zap className="h-6 w-6 text-yellow-400 animate-bounce" />
                </div>
              </div>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2">
              {isAnalyzing ? 'AI Analysis in Progress' : 'Ready for Multi-Asset Analysis'}
            </h4>
            <p className="text-gray-400 mb-4">
              {isAnalyzing ? 
                'Analyzing market conditions across multiple assets...' :
                'Click "Refresh Analysis" to start comprehensive market analysis'
              }
            </p>
            {!isAnalyzing && (
              <button
                onClick={performAnalysis}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Start Analysis
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-semibold text-white">Highest Probability Signal</h4>
              <div className="text-sm text-gray-400">
                Last updated: {new Date(lastAnalysisTime).toLocaleTimeString()}
              </div>
            </div>
            
            {/* Analysis Summary */}
            <div className="bg-gray-750 rounded-lg p-4 border border-gray-600 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Brain className="h-5 w-5 text-purple-400" />
                  <span className="text-white font-medium">Multi-Asset Analysis Complete</span>
                </div>
                <div className="text-sm text-gray-400">
                  Analyzed {assetsToAnalyze.length} assets • Showing top signal
                </div>
              </div>
            </div>
            
            {signals.map((signal) => (
              <div
                key={`${signal.symbol}-${signal.timestamp}`}
                className={`relative rounded-xl border-2 p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${getSignalColor(signal.signal)} ${
                  signal.strength === 'CRITICAL' ? 'ring-2 ring-red-400/50 animate-pulse' : ''
                }`}
              >
                {/* Best Signal Badge */}
                <div className="absolute top-4 right-4">
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    🏆 BEST SIGNAL
                  </div>
                </div>
                
                {/* Signal Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className={`absolute inset-0 rounded-full animate-pulse ${
                        signal.signal === 'BUY' ? 'bg-green-500/20' :
                        signal.signal === 'SELL' ? 'bg-red-500/20' : 'bg-gray-500/20'
                      }`}></div>
                      <div className="relative p-2 rounded-full bg-gray-700/50">
                        {getSignalIcon(signal.signal)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="text-xl font-bold text-white">{signal.symbol}</span>
                        <span className="px-3 py-1 bg-gray-700 rounded-full text-sm font-medium text-white">
                          {signal.signal}
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-400 font-medium">LIVE</span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm mb-1">{signal.displayName}</p>
                      <p className="text-gray-300 text-sm leading-relaxed max-w-md">{signal.reasoning}</p>
                      <div className="mt-2 text-xs text-yellow-400 font-medium">
                        Selected from {assetsToAnalyze.length} analyzed assets
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold mb-1 ${getStrengthColor(signal.strength)}`}>
                      {signal.strength}
                      {signal.strength === 'CRITICAL' && <AlertCircle className="inline h-4 w-4 ml-1" />}
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{signal.confidence}%</div>
                    <div className="text-sm text-yellow-400 font-mono bg-gray-700/50 px-2 py-1 rounded">
                      {signal.expiryTime}
                    </div>
                  </div>
                </div>
                
                {/* Price Information */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Current Price</div>
                    <div className="text-lg font-mono text-white">{signal.priceData.currentPrice.toFixed(4)}</div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Price Change</div>
                    <div className={`text-lg font-mono ${
                      signal.priceData.priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {signal.priceData.priceChange >= 0 ? '+' : ''}{signal.priceData.priceChange.toFixed(3)}%
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Trend</div>
                    <div className={`text-sm font-medium capitalize ${
                      signal.priceData.trend === 'uptrend' ? 'text-green-400' :
                      signal.priceData.trend === 'downtrend' ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {signal.priceData.trend}
                    </div>
                  </div>
                </div>
                
                {/* Technical Indicators */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">RSI</div>
                    <div className={`text-lg font-bold ${
                      signal.technicalIndicators.rsi < 30 ? 'text-green-400' : 
                      signal.technicalIndicators.rsi > 70 ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {signal.technicalIndicators.rsi}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">MACD</div>
                    <div className={`text-sm font-medium capitalize ${
                      signal.technicalIndicators.macd === 'bullish' ? 'text-green-400' :
                      signal.technicalIndicators.macd === 'bearish' ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {signal.technicalIndicators.macd}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Bollinger</div>
                    <div className={`text-sm font-medium capitalize ${
                      signal.technicalIndicators.bollinger === 'squeeze' ? 'text-yellow-400' :
                      signal.technicalIndicators.bollinger === 'expansion' ? 'text-blue-400' : 'text-gray-300'
                    }`}>
                      {signal.technicalIndicators.bollinger}
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Momentum</div>
                    <div className={`text-sm font-mono ${
                      signal.technicalIndicators.momentum > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {signal.technicalIndicators.momentum.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Volatility</div>
                    <div className={`text-sm font-mono ${
                      signal.technicalIndicators.volatility > 0.003 ? 'text-yellow-400' : 'text-gray-300'
                    }`}>
                      {(signal.technicalIndicators.volatility * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Signal Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-600">
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-blue-400" />
                      <span className="text-gray-400">Expiry:</span>
                      <span className="text-white font-medium">{signal.expiryTime}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-purple-400" />
                      <span className="text-gray-400">Confidence:</span>
                      <span className="text-white font-medium">{signal.confidence}%</span>
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

export default AssetAnalysis;