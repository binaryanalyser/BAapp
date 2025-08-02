import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Target, Brain, Activity, Clock, Zap, AlertTriangle } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface AssetAnalysisProps {
  selectedSymbol: string;
}

interface AnalysisSignal {
  id: string;
  type: 'CALL' | 'PUT' | 'MATCH' | 'DIFFER';
  strength: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  reasoning: string;
  timestamp: number;
  duration: number; // in seconds
  isActive: boolean;
}

interface MarketCondition {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  momentum: number;
  support: number;
  resistance: number;
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol }) => {
  const { ticks, subscribeTo } = useWebSocket();
  const [currentSignal, setCurrentSignal] = useState<AnalysisSignal | null>(null);
  const [marketCondition, setMarketCondition] = useState<MarketCondition | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [analysisInterval, setAnalysisInterval] = useState<number>(5); // minutes
  const [nextAnalysisCountdown, setNextAnalysisCountdown] = useState<number>(0);
  const [isWaitingForNextAnalysis, setIsWaitingForNextAnalysis] = useState<boolean>(false);

  // Subscribe to WebSocket data for the selected symbol
  useEffect(() => {
    subscribeTo(selectedSymbol);
  }, [selectedSymbol, subscribeTo]);

  // Reset price history when symbol changes
  useEffect(() => {
    setPriceHistory([]);
    setCurrentSignal(null);
    setCountdown(0);
    setLastAnalysisTime(0);
    setNextAnalysisCountdown(0);
    setIsWaitingForNextAnalysis(false);
  }, [selectedSymbol]);

  // Update price history when new ticks arrive
  useEffect(() => {
    const tick = ticks[selectedSymbol];
    if (tick && typeof tick.price === 'number') {
      setPriceHistory(prev => {
        const newHistory = [...prev, tick.price].slice(-100); // Keep last 100 prices
        return newHistory;
      });
    }
  }, [ticks, selectedSymbol]);

  // Calculate technical indicators
  const calculateTechnicalIndicators = useCallback((prices: number[]) => {
    if (prices.length < 10) return null; // Reduced from 20 to 10

    const recent = prices.slice(-10); // Reduced from 20 to 10
    const current = prices[prices.length - 1];
    
    // Simple Moving Average
    const sma = recent.reduce((sum, price) => sum + price, 0) / recent.length;
    
    // RSI calculation
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < recent.length; i++) {
      const change = recent[i] - recent[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / (recent.length - 1);
    const avgLoss = losses / (recent.length - 1);
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // Volatility
    const variance = recent.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / recent.length;
    const volatility = Math.sqrt(variance) / sma;

    // Support and Resistance
    const support = Math.min(...recent);
    const resistance = Math.max(...recent);

    // Trend determination
    const shortTerm = recent.slice(-3).reduce((sum, price) => sum + price, 0) / 3; // Reduced from 5 to 3
    const longTerm = recent.slice(-8).reduce((sum, price) => sum + price, 0) / 8; // Reduced from 15 to 8
    
    let trend: MarketCondition['trend'] = 'NEUTRAL';
    if (shortTerm > longTerm * 1.0005) trend = 'BULLISH'; // Reduced threshold from 1.001 to 1.0005
    else if (shortTerm < longTerm * 0.9995) trend = 'BEARISH'; // Reduced threshold from 0.999 to 0.9995

    // Volatility classification
    let volClass: MarketCondition['volatility'] = 'MEDIUM';
    if (volatility > 0.002) volClass = 'HIGH'; // Reduced from 0.003 to 0.002
    else if (volatility < 0.0005) volClass = 'LOW'; // Reduced from 0.001 to 0.0005

    // Momentum
    const momentum = ((current - recent[0]) / recent[0]) * 100;

    return {
      rsi,
      sma,
      volatility,
      trend,
      volClass,
      momentum,
      support,
      resistance
    };
  }, []);

  // Generate analysis signal
  const generateSignal = useCallback((indicators: any, currentPrice: number): AnalysisSignal | null => {
    if (!indicators) return null;

    let signalType: AnalysisSignal['type'] = 'CALL';
    let confidence = 40; // Reduced base confidence from 50 to 40
    let strength: AnalysisSignal['strength'] = 'LOW';
    let reasoning = '';
    let duration = 300; // 5 minutes default

    // RSI-based signals
    if (indicators.rsi < 40 && indicators.trend === 'BULLISH') { // Increased from 30 to 40
      signalType = 'CALL';
      confidence += 25;
      reasoning = 'RSI oversold with bullish trend';
      strength = 'HIGH';
      duration = 300; // 5 minutes
    } else if (indicators.rsi > 60 && indicators.trend === 'BEARISH') { // Decreased from 70 to 60
      signalType = 'PUT';
      confidence += 25;
      reasoning = 'RSI overbought with bearish trend';
      strength = 'HIGH';
      duration = 300; // 5 minutes
    } else if (indicators.trend === 'BULLISH' && indicators.momentum > 0.05) { // Reduced from 0.1 to 0.05
      signalType = 'CALL';
      confidence += 20; // Increased from 15 to 20
      reasoning = 'Strong bullish momentum detected';
      strength = 'MEDIUM';
      duration = 180; // 3 minutes
    } else if (indicators.trend === 'BEARISH' && indicators.momentum < -0.05) { // Reduced from -0.1 to -0.05
      signalType = 'PUT';
      confidence += 20; // Increased from 15 to 20
      reasoning = 'Strong bearish momentum detected';
      strength = 'MEDIUM';
      duration = 180; // 3 minutes
    } else if (indicators.trend === 'BULLISH') {
      signalType = 'CALL';
      confidence += 10;
      reasoning = 'Bullish trend detected';
      strength = 'LOW';
      duration = 120; // 2 minutes
    } else if (indicators.trend === 'BEARISH') {
      signalType = 'PUT';
      confidence += 10;
      reasoning = 'Bearish trend detected';
      strength = 'LOW';
      duration = 120; // 2 minutes
    }

    // High volatility digit signals
    if (indicators.volClass === 'HIGH' && Math.random() > 0.4) { // Increased chance from 0.6 to 0.4
      const lastDigit = Math.floor((currentPrice * 10000) % 10);
      signalType = Math.random() > 0.5 ? 'MATCH' : 'DIFFER';
      confidence += 20;
      reasoning = `High volatility detected. Last digit: ${lastDigit}`;
      strength = 'MEDIUM';
      duration = 120; // 2 minutes
    } else if (indicators.volClass === 'MEDIUM' && Math.random() > 0.7) { // Added medium volatility signals
      const lastDigit = Math.floor((currentPrice * 10000) % 10);
      signalType = Math.random() > 0.5 ? 'MATCH' : 'DIFFER';
      confidence += 15;
      reasoning = `Medium volatility detected. Last digit: ${lastDigit}`;
      strength = 'LOW';
      duration = 90; // 1.5 minutes
    }

    // Additional signal generation based on price action
    if (Math.abs(indicators.momentum) > 0.02) { // Any significant momentum
      confidence += 10;
      reasoning += ' + Price momentum confirmation';
    }

    // RSI extreme conditions (more lenient)
    if (indicators.rsi < 45) {
      signalType = 'CALL';
      confidence += 8;
      reasoning += ' + RSI approaching oversold';
    } else if (indicators.rsi > 55) {
      signalType = 'PUT';
      confidence += 8;
      reasoning += ' + RSI approaching overbought';
    }

    // Adjust strength based on confidence
    if (confidence >= 80) strength = 'CRITICAL'; // Reduced from 85 to 80
    else if (confidence >= 65) strength = 'HIGH'; // Reduced from 75 to 65
    else if (confidence >= 50) strength = 'MEDIUM'; // Reduced from 65 to 50
    else strength = 'LOW';

    // Only generate signals with reasonable confidence
    if (confidence < 45) return null; // Reduced from 60 to 45

    return {
      id: `${selectedSymbol}-${Date.now()}`,
      type: signalType,
      strength,
      confidence: Math.min(confidence, 95),
      reasoning,
      timestamp: Date.now(),
      duration,
      isActive: true
    };
  }, [selectedSymbol]);

  // Perform analysis
  const performAnalysis = useCallback(() => {
    if (priceHistory.length < 10) return; // Reduced from 20 to 10
    if (currentSignal && countdown > 0) return; // Don't analyze if signal is active
    if (isWaitingForNextAnalysis && nextAnalysisCountdown > 0) return; // Don't analyze during countdown

    const now = Date.now();
    const timeSinceLastAnalysis = now - lastAnalysisTime;
    const minInterval = analysisInterval * 60 * 1000; // Convert to milliseconds

    // Don't analyze too frequently
    if (timeSinceLastAnalysis < minInterval && lastAnalysisTime > 0) {
      // Start countdown if not already started
      if (!isWaitingForNextAnalysis) {
        const remainingTime = Math.ceil((minInterval - timeSinceLastAnalysis) / 1000);
        setNextAnalysisCountdown(remainingTime);
        setIsWaitingForNextAnalysis(true);
      }
      return;
    }

    setIsAnalyzing(true);
    setIsWaitingForNextAnalysis(false);
    setNextAnalysisCountdown(0);
    
    setTimeout(() => {
      const currentPrice = priceHistory[priceHistory.length - 1];
      const indicators = calculateTechnicalIndicators(priceHistory);
      
      if (indicators) {
        // Update market condition
        setMarketCondition({
          trend: indicators.trend,
          volatility: indicators.volClass,
          momentum: indicators.momentum,
          support: indicators.support,
          resistance: indicators.resistance
        });

        // Generate new signal
        const newSignal = generateSignal(indicators, currentPrice);
        if (newSignal) {
          setCurrentSignal(newSignal);
          setCountdown(newSignal.duration);
          setLastAnalysisTime(now);
          // Start countdown for next analysis after signal expires
          const nextAnalysisTime = analysisInterval * 60; // seconds
          setNextAnalysisCountdown(newSignal.duration + nextAnalysisTime);
          setIsWaitingForNextAnalysis(true);
          console.log(`New signal generated for ${selectedSymbol}:`, newSignal);
        } else {
          // No signal generated, start countdown for next analysis
          setLastAnalysisTime(now);
          const nextAnalysisTime = analysisInterval * 60; // seconds
          setNextAnalysisCountdown(nextAnalysisTime);
          setIsWaitingForNextAnalysis(true);
        }
      }
      
      setIsAnalyzing(false);
    }, 1000); // Reduced analysis delay from 2000ms to 1000ms
  }, [priceHistory, currentSignal, countdown, lastAnalysisTime, analysisInterval, isWaitingForNextAnalysis, nextAnalysisCountdown, calculateTechnicalIndicators, generateSignal]);

  // Auto-analysis when symbol changes or enough price data is available
  useEffect(() => {
    if (priceHistory.length >= 10 && !currentSignal && !isAnalyzing && !isWaitingForNextAnalysis) { // Reduced from 20 to 10
      const timer = setTimeout(() => {
        performAnalysis();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedSymbol, priceHistory.length, currentSignal, isAnalyzing, isWaitingForNextAnalysis, performAnalysis]);

  // Countdown timer for active signal
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          const newCount = prev - 1;
          if (newCount === 0) {
            setCurrentSignal(null);
            console.log(`Signal expired for ${selectedSymbol}, ready for new analysis`);
            // Don't immediately analyze, wait for the analysis interval countdown
          }
          return newCount;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown, selectedSymbol, performAnalysis]);

  // Next analysis countdown timer
  useEffect(() => {
    if (isWaitingForNextAnalysis && nextAnalysisCountdown > 0) {
      const interval = setInterval(() => {
        setNextAnalysisCountdown(prev => {
          const newCount = prev - 1;
          if (newCount === 0) {
            setIsWaitingForNextAnalysis(false);
            // Trigger analysis after countdown
            if (priceHistory.length >= 10 && !currentSignal && !isAnalyzing) { // Reduced from 20 to 10
              setTimeout(() => {
                performAnalysis();
              }, 1000);
            }
          }
          return Math.max(0, newCount);
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWaitingForNextAnalysis, nextAnalysisCountdown, priceHistory.length, currentSignal, isAnalyzing, performAnalysis]);

  // Manual analysis trigger
  const handleManualAnalysis = useCallback(() => {
    if (priceHistory.length >= 10 && !currentSignal && !isAnalyzing && !isWaitingForNextAnalysis) { // Reduced from 20 to 10
      performAnalysis();
    }
  }, [priceHistory.length, currentSignal, isAnalyzing, isWaitingForNextAnalysis, performAnalysis]);

  // Reset countdown when interval changes
  useEffect(() => {
    if (!currentSignal && !isAnalyzing && lastAnalysisTime > 0) {
      const now = Date.now();
      const timeSinceLastAnalysis = now - lastAnalysisTime;
      const minInterval = analysisInterval * 60 * 1000;
      
      if (timeSinceLastAnalysis < minInterval) {
        const remaining = Math.ceil((minInterval - timeSinceLastAnalysis) / 1000);
        setNextAnalysisCountdown(remaining);
        setIsWaitingForNextAnalysis(true);
      } else {
        setNextAnalysisCountdown(0);
        setIsWaitingForNextAnalysis(false);
        // Can analyze immediately
        if (priceHistory.length >= 10) { // Reduced from 20 to 10
          setTimeout(() => {
            performAnalysis();
          }, 500);
        }
      }
    }
  }, [analysisInterval, currentSignal, isAnalyzing, lastAnalysisTime, priceHistory.length, performAnalysis]);

  // Legacy next analysis countdown (kept for compatibility)
  useEffect(() => {
    if (isWaitingForNextAnalysis) {
      const interval = setInterval(() => {
        
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWaitingForNextAnalysis]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSignalIcon = (type: AnalysisSignal['type']) => {
    switch (type) {
      case 'CALL': return <TrendingUp className="h-6 w-6 text-green-400" />;
      case 'PUT': return <TrendingDown className="h-6 w-6 text-red-400" />;
      case 'MATCH': return <Target className="h-6 w-6 text-blue-400" />;
      case 'DIFFER': return <Target className="h-6 w-6 text-yellow-400" />;
    }
  };

  const getSignalColor = (type: AnalysisSignal['type']) => {
    switch (type) {
      case 'CALL': return 'border-green-500 bg-green-500/10';
      case 'PUT': return 'border-red-500 bg-red-500/10';
      case 'MATCH': return 'border-blue-500 bg-blue-500/10';
      case 'DIFFER': return 'border-yellow-500 bg-yellow-500/10';
    }
  };

  const getStrengthColor = (strength: AnalysisSignal['strength']) => {
    switch (strength) {
      case 'CRITICAL': return 'text-red-400';
      case 'HIGH': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-gray-400';
    }
  };

  const currentPrice = ticks[selectedSymbol]?.price || 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">AI Asset Analysis</h3>
          <div className="text-sm text-gray-400">({selectedSymbol})</div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Analysis Interval Selector */}
          <select
            value={analysisInterval}
            onChange={(e) => setAnalysisInterval(parseInt(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={currentSignal && countdown > 0}
          >
            <option value={2}>2 min interval</option>
            <option value={3}>3 min interval</option>
            <option value={5}>5 min interval</option>
            <option value={10}>10 min interval</option>
          </select>
          
          {isAnalyzing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-blue-400">Analyzing...</span>
            </div>
          ) : currentSignal && countdown > 0 ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">Signal Active</span>
            </div>
          ) : isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-yellow-400">Next: {formatTime(nextAnalysisCountdown)}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400">Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Current Price */}
      <div className="mb-6 p-4 bg-gray-750 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Current Price:</span>
          <span className="text-2xl font-mono font-bold text-white">
            {currentPrice ? currentPrice.toFixed(4) : '---'}
          </span>
        </div>
      </div>

      {/* Market Condition */}
      {marketCondition && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Trend</div>
            <div className={`font-medium ${
              marketCondition.trend === 'BULLISH' ? 'text-green-400' :
              marketCondition.trend === 'BEARISH' ? 'text-red-400' : 'text-gray-300'
            }`}>
              {marketCondition.trend}
            </div>
          </div>
          
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Volatility</div>
            <div className={`font-medium ${
              marketCondition.volatility === 'HIGH' ? 'text-red-400' :
              marketCondition.volatility === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {marketCondition.volatility}
            </div>
          </div>
          
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Momentum</div>
            <div className={`font-medium ${
              marketCondition.momentum > 0.1 ? 'text-green-400' :
              marketCondition.momentum < -0.1 ? 'text-red-400' : 'text-gray-300'
            }`}>
              {marketCondition.momentum > 0 ? '+' : ''}{marketCondition.momentum.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Active Signal */}
      {currentSignal ? (
        <div className={`rounded-lg border-2 p-6 ${getSignalColor(currentSignal.type)} ${
          currentSignal.strength === 'CRITICAL' ? 'animate-pulse' : ''
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 rounded-full bg-gray-700/50">
                {getSignalIcon(currentSignal.type)}
              </div>
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <span className="text-xl font-bold text-white">{currentSignal.type}</span>
                  <span className={`text-sm font-medium ${getStrengthColor(currentSignal.strength)}`}>
                    {currentSignal.strength}
                  </span>
                  {currentSignal.strength === 'CRITICAL' && (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <p className="text-gray-300 text-sm">{currentSignal.reasoning}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-white mb-1">{currentSignal.confidence}%</div>
              <div className="text-lg font-mono text-yellow-400 bg-gray-700/50 px-3 py-2 rounded">
                {formatTime(countdown)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Active</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  currentSignal.type === 'CALL' ? 'bg-green-400' :
                  currentSignal.type === 'PUT' ? 'bg-red-400' :
                  currentSignal.type === 'MATCH' ? 'bg-blue-400' : 'bg-yellow-400'
                }`}
                style={{ 
                  width: `${100 - (countdown / currentSignal.duration) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="mb-4">
            {isAnalyzing ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            ) : isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? (
              <div className="relative">
                <Clock className="h-12 w-12 text-yellow-400 mx-auto opacity-50" />
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  {Math.ceil(nextAnalysisCountdown / 60)}
                </div>
              </div>
            ) : (
              <Brain className="h-12 w-12 text-gray-400 mx-auto opacity-50" />
            )}
          </div>
          <h4 className="text-lg font-medium text-white mb-2">
            {isAnalyzing ? 'Analyzing Market Conditions' : 
             priceHistory.length < 10 ? 'Collecting Market Data' : // Reduced from 20 to 10
             isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? 'Waiting for Next Analysis' : 'Ready for Analysis'}
          </h4>
          <p className="text-gray-400 text-sm">
            {isAnalyzing ? `Analyzing ${selectedSymbol} price patterns and indicators...` :
             priceHistory.length < 10 ? `Need ${10 - priceHistory.length} more price points` : // Reduced from 20 to 10
             isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? `Next analysis in ${formatTime(nextAnalysisCountdown)}` :
             'Click to start manual analysis'}
          </p>
          
          {/* Countdown Progress Bar for Next Analysis */}
          {isWaitingForNextAnalysis && nextAnalysisCountdown > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Next Analysis</span>
                <span>{formatTime(nextAnalysisCountdown)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-3 rounded-full transition-all duration-1000 ease-linear"
                  style={{ 
                    width: `${100 - (nextAnalysisCountdown / (analysisInterval * 60)) * 100}%` 
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Waiting for {analysisInterval} minute interval
              </div>
            </div>
          )}
          
          {/* Progress Bar for Market Data Collection */}
          {priceHistory.length < 10 && ( // Reduced from 20 to 10
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Collecting Market Data</span>
                <span>{priceHistory.length}/10</span> {/* Reduced from 20 to 10 */}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(priceHistory.length / 10) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                {priceHistory.length === 0 ? 'Waiting for price data...' :
                 priceHistory.length < 5 ? 'Initial data collection...' :
                 priceHistory.length < 8 ? 'Building price history...' : // Reduced from 15 to 8
                 'Almost ready for analysis...'}
              </div>
            </div>
          )}
          
          {!isAnalyzing && priceHistory.length >= 10 && !isWaitingForNextAnalysis && ( // Reduced from 20 to 10
            <button
              onClick={handleManualAnalysis}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Zap className="inline h-4 w-4 mr-2" />
              Analyze Now
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetAnalysis;