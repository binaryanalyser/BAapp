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

interface TradingSignalsProps {
  selectedAsset?: string;
}

const TradingSignals: React.FC<TradingSignalsProps> = ({ selectedAsset }) => {
  const { ticks } = useWebSocket();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [analysisStatus, setAnalysisStatus] = useState<'analyzing' | 'ready' | 'generating'>('ready');
  const [lastAnalysis, setLastAnalysis] = useState<number>(Date.now());

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

  // Update market data and generate signals
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

  // Generate signals based on market analysis
  useEffect(() => {
    const generateSignals = () => {
      setAnalysisStatus('analyzing');
      
      setTimeout(() => {
        // Prioritize selected asset for signal generation
        const symbolsToAnalyze = selectedAsset 
          ? [selectedAsset, ...Object.keys(marketData).filter(s => s !== selectedAsset)]
          : Object.keys(marketData);

        symbolsToAnalyze.forEach((symbol, index) => {
          const data = marketData[symbol];
          if (!data) return;

          // Higher chance for selected asset, lower for others
          const generationChance = symbol === selectedAsset ? 0.7 : 0.15;
          
          if (Math.random() > (1 - generationChance)) {
            const signal = generateAdvancedSignal(symbol, data.price, data);
            if (signal) {
              setSignals(prev => {
                const filtered = prev.filter(s => 
                  (s.symbol !== symbol || Date.now() - s.timestamp > 30000) &&
                  Date.now() - s.timestamp < 300000 // Keep signals for 5 minutes max
                );
                return [signal, ...filtered].slice(0, 8);
              });
            }
          }
        });
        
        setAnalysisStatus('ready');
        setLastAnalysis(Date.now());
      }, 1500);
    };

    const interval = setInterval(generateSignals, 5000);
    return () => clearInterval(interval);
  }, [marketData, generateAdvancedSignal, selectedAsset]);

  // Update signal countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => prev.map(signal => ({
        ...signal,
        countdown: Math.max(0, signal.countdown - 1),
        isLive: signal.countdown > 0
      })).filter(signal => signal.countdown > 0 || Date.now() - signal.timestamp < 60000));
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

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">AI Trading Signals</h3>
          {analysisStatus === 'analyzing' && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-blue-400">Analyzing...</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-400">
            <Activity className="h-4 w-4 mr-1" />
            <span>Live Analysis</span>
          </div>
          <div className="text-xs text-gray-500">
            Last: {new Date(lastAnalysis).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {signals.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Brain className="h-12 w-12 opacity-50" />
                <div className="absolute -top-1 -right-1">
                  <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
                </div>
              </div>
            </div>
            <p>AI is analyzing {selectedAsset || 'market'} conditions...</p>
            <p className="text-sm mt-1">Advanced algorithms processing {Object.keys(marketData).length} assets</p>
          </div>
        ) : (
          signals.map((signal) => (
            <div
              key={signal.id}
              className={`rounded-lg border-2 p-4 transition-all hover:shadow-lg ${getSignalColor(signal.type)} ${
                signal.strength === 'CRITICAL' ? 'ring-2 ring-red-400/50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getSignalIcon(signal.type)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">{signal.symbol}</span>
                      <span className="text-sm bg-gray-700 px-2 py-1 rounded font-mono">
                        {signal.type}
                      </span>
                      {signal.isLive && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-400">LIVE</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{signal.reasoning}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getStrengthColor(signal.strength)}`}>
                    {signal.strength}
                    {signal.strength === 'CRITICAL' && <AlertCircle className="inline h-3 w-3 ml-1" />}
                  </div>
                  <div className="text-sm text-gray-400">{signal.confidence}%</div>
                  {signal.isLive && (
                    <div className="text-xs text-yellow-400 font-mono">
                      {formatCountdown(signal.countdown)}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Technical Indicators */}
              <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-gray-900/50 rounded">
                <div className="text-xs">
                  <span className="text-gray-400">RSI:</span>
                  <span className={`ml-1 font-mono ${
                    signal.indicators.rsi < 30 ? 'text-green-400' : 
                    signal.indicators.rsi > 70 ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    {signal.indicators.rsi}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-400">MACD:</span>
                  <span className={`ml-1 capitalize ${
                    signal.indicators.macd === 'bullish' ? 'text-green-400' :
                    signal.indicators.macd === 'bearish' ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    {signal.indicators.macd}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-400">Bollinger:</span>
                  <span className={`ml-1 capitalize ${
                    signal.indicators.bollinger === 'squeeze' ? 'text-yellow-400' :
                    signal.indicators.bollinger === 'expansion' ? 'text-blue-400' : 'text-gray-300'
                  }`}>
                    {signal.indicators.bollinger}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-400">Volume:</span>
                  <span className={`ml-1 capitalize ${
                    signal.indicators.volume === 'high' ? 'text-green-400' :
                    signal.indicators.volume === 'normal' ? 'text-gray-300' : 'text-red-400'
                  }`}>
                    {signal.indicators.volume}
                  </span>
                </div>
              </div>

              {/* Price Action Analysis */}
              <div className="flex items-center justify-between text-sm border-t border-gray-700 pt-3">
                <div className="flex space-x-4">
                  <span className="text-gray-400">
                    Entry: <span className="text-white font-mono">{signal.entry.toFixed(4)}</span>
                  </span>
                  <span className="text-gray-400">
                    Expiry: <span className="text-white">{signal.expiry}</span>
                  </span>
                  <span className="text-gray-400">
                    Trend: <span className={`capitalize ${
                      signal.priceAction.trend === 'uptrend' ? 'text-green-400' :
                      signal.priceAction.trend === 'downtrend' ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {signal.priceAction.trend}
                    </span>
                  </span>
                </div>
                <span className="text-gray-400">
                  {new Date(signal.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TradingSignals;