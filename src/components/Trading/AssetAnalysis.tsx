import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useTradingContext } from '../../contexts/TradingContext';
import { Brain, TrendingUp, TrendingDown, Target, Activity, Zap } from 'lucide-react';

interface AssetAnalysisProps {
  selectedSymbol: string;
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol }) => {
  // All hooks must be called unconditionally at the top level
  const { ticks } = useWebSocket();
  const { addTrade } = useTradingContext();
  
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [analysis, setAnalysis] = useState<{
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    recommendation: 'CALL' | 'PUT' | 'NEUTRAL';
    confidence: number;
    reasoning: string;
  }>({
    trend: 'neutral',
    strength: 0,
    recommendation: 'NEUTRAL',
    confidence: 0,
    reasoning: 'Analyzing market data...'
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);

  // Update current price when tick data changes
  useEffect(() => {
    const tickData = ticks[selectedSymbol];
    if (tickData && tickData.price) {
      setCurrentPrice(tickData.price);
      
      // Update price history (keep last 50 prices)
      setPriceHistory(prev => {
        const newHistory = [...prev, tickData.price].slice(-50);
        return newHistory;
      });
    }
  }, [ticks, selectedSymbol]);

  // Perform analysis when price history changes
  useEffect(() => {
    if (priceHistory.length >= 10) {
      const now = Date.now();
      // Only analyze every 5 seconds to avoid excessive calculations
      if (now - lastAnalysisTime > 5000) {
        performAnalysis();
        setLastAnalysisTime(now);
      }
    }
  }, [priceHistory, lastAnalysisTime]);

  const performAnalysis = () => {
    if (priceHistory.length < 10) return;

    setIsAnalyzing(true);

    // Simple technical analysis
    const recent = priceHistory.slice(-10);
    const older = priceHistory.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b) / older.length : recentAvg;
    
    const priceChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    // Calculate volatility
    const volatility = Math.sqrt(
      recent.reduce((sum, price) => sum + Math.pow(price - recentAvg, 2), 0) / recent.length
    ) / recentAvg;

    // Determine trend and recommendation
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let recommendation: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 50;
    let reasoning = 'Market conditions are mixed';

    if (priceChange > 0.05) {
      trend = 'bullish';
      recommendation = 'CALL';
      confidence = Math.min(75 + (priceChange * 10), 95);
      reasoning = `Strong upward momentum detected. Price increased ${priceChange.toFixed(2)}% recently.`;
    } else if (priceChange < -0.05) {
      trend = 'bearish';
      recommendation = 'PUT';
      confidence = Math.min(75 + (Math.abs(priceChange) * 10), 95);
      reasoning = `Strong downward momentum detected. Price decreased ${Math.abs(priceChange).toFixed(2)}% recently.`;
    } else {
      confidence = 40 + (volatility * 1000);
      reasoning = `Sideways movement with ${volatility > 0.002 ? 'high' : 'low'} volatility.`;
    }

    // Add volatility factor
    if (volatility > 0.003) {
      confidence += 10;
      reasoning += ' High volatility suggests potential breakout.';
    }

    setAnalysis({
      trend,
      strength: Math.abs(priceChange),
      recommendation,
      confidence: Math.round(Math.min(confidence, 95)),
      reasoning
    });

    setIsAnalyzing(false);
  };

  const handleQuickTrade = (type: 'CALL' | 'PUT') => {
    if (currentPrice === 0) return;

    const newTrade = {
      symbol: selectedSymbol,
      type: type as 'CALL' | 'PUT',
      stake: 10,
      duration: 300, // 5 minutes
      payout: 18.5,
      profit: 0,
      status: 'open' as const,
      entryTime: Date.now(),
      entryPrice: currentPrice
    };

    addTrade(newTrade);
  };

  const getTrendIcon = () => {
    switch (analysis.trend) {
      case 'bullish':
        return <TrendingUp className="h-6 w-6 text-green-400" />;
      case 'bearish':
        return <TrendingDown className="h-6 w-6 text-red-400" />;
      default:
        return <Activity className="h-6 w-6 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (analysis.trend) {
      case 'bullish':
        return 'text-green-400';
      case 'bearish':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getConfidenceColor = () => {
    if (analysis.confidence >= 80) return 'text-green-400';
    if (analysis.confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Asset Analysis</h3>
        </div>
        <div className="flex items-center space-x-2">
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-blue-400">Analyzing...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">Live Analysis</span>
            </>
          )}
        </div>
      </div>

      {/* Current Price */}
      <div className="mb-6 text-center">
        <div className="text-3xl font-bold text-white mb-2">
          {currentPrice > 0 ? currentPrice.toFixed(4) : '---'}
        </div>
        <div className="text-sm text-gray-400">{selectedSymbol} Current Price</div>
      </div>

      {/* Analysis Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-750 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Market Trend</span>
            {getTrendIcon()}
          </div>
          <div className={`text-xl font-bold capitalize ${getTrendColor()}`}>
            {analysis.trend}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Strength: {analysis.strength.toFixed(3)}%
          </div>
        </div>

        <div className="bg-gray-750 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">AI Confidence</span>
            <Target className="h-5 w-5 text-blue-400" />
          </div>
          <div className={`text-xl font-bold ${getConfidenceColor()}`}>
            {analysis.confidence}%
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Recommendation: {analysis.recommendation}
          </div>
        </div>
      </div>

      {/* Analysis Reasoning */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-white mb-3">Analysis Summary</h4>
        <div className="bg-gray-750 rounded-lg p-4">
          <p className="text-gray-300 text-sm leading-relaxed">
            {analysis.reasoning}
          </p>
        </div>
      </div>

      {/* Quick Trade Buttons */}
      {analysis.recommendation !== 'NEUTRAL' && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleQuickTrade('CALL')}
            disabled={currentPrice === 0}
            className="flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Trade Higher</span>
          </button>
          
          <button
            onClick={() => handleQuickTrade('PUT')}
            disabled={currentPrice === 0}
            className="flex items-center justify-center space-x-2 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <TrendingDown className="h-4 w-4" />
            <span>Trade Lower</span>
          </button>
        </div>
      )}

      {/* Data Points */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-blue-400 font-bold">{priceHistory.length}</div>
            <div className="text-gray-400">Data Points</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {priceHistory.length >= 10 ? 'Active' : 'Loading'}
            </div>
            <div className="text-gray-400">Analysis Status</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">
              {Math.round((Date.now() - lastAnalysisTime) / 1000)}s
            </div>
            <div className="text-gray-400">Last Update</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetAnalysis;