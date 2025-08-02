import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Activity, Target, Zap, AlertCircle } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useAuth } from '../../contexts/AuthContext';
import TradingSignals from './TradingSignals';
import QuickTrade from './QuickTrade';

interface AssetAnalysisProps {
  selectedSymbol: string;
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol }) => {
  // All hooks must be called at the top level, unconditionally
  const { ticks, subscribeTo, unsubscribeFrom, isConnected } = useWebSocket();
  const { user, isAuthenticated } = useAuth();
  
  // State hooks - all called unconditionally
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<'BUY' | 'SELL' | 'NEUTRAL'>('NEUTRAL');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Subscribe to symbol ticks
  useEffect(() => {
    if (isConnected && selectedSymbol) {
      subscribeTo(selectedSymbol);
      return () => {
        unsubscribeFrom(selectedSymbol);
      };
    }
  }, [isConnected, selectedSymbol, subscribeTo, unsubscribeFrom]);

  // Update price data when ticks change
  useEffect(() => {
    const tickData = ticks[selectedSymbol];
    if (tickData && tickData.price) {
      setCurrentPrice(tickData.price);
      setPriceHistory(prev => {
        const newHistory = [...prev, tickData.price].slice(-50); // Keep last 50 prices
        return newHistory;
      });
      setLastUpdate(Date.now());
    }
  }, [ticks, selectedSymbol]);

  // Perform analysis when price history changes
  useEffect(() => {
    if (priceHistory.length >= 10) {
      performAnalysis();
    }
  }, [priceHistory]);

  const performAnalysis = () => {
    setIsAnalyzing(true);
    
    // Simulate analysis delay
    setTimeout(() => {
      const recent = priceHistory.slice(-10);
      const older = priceHistory.slice(-20, -10);
      
      if (recent.length === 0 || older.length === 0) {
        setIsAnalyzing(false);
        return;
      }
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      
      const trend = recentAvg > olderAvg ? 'upward' : recentAvg < olderAvg ? 'downward' : 'sideways';
      const strength = Math.abs((recentAvg - olderAvg) / olderAvg) * 100;
      
      let newRecommendation: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
      let newConfidence = Math.min(strength * 10, 95);
      
      if (trend === 'upward' && strength > 0.01) {
        newRecommendation = 'BUY';
        setAnalysisResult(`Strong upward trend detected. Price has increased by ${strength.toFixed(3)}% in recent ticks.`);
      } else if (trend === 'downward' && strength > 0.01) {
        newRecommendation = 'SELL';
        setAnalysisResult(`Strong downward trend detected. Price has decreased by ${strength.toFixed(3)}% in recent ticks.`);
      } else {
        newRecommendation = 'NEUTRAL';
        setAnalysisResult(`Market is moving sideways with low volatility. No clear trend detected.`);
        newConfidence = Math.max(newConfidence, 30);
      }
      
      setRecommendation(newRecommendation);
      setConfidence(Math.round(newConfidence));
      setIsAnalyzing(false);
    }, 1500);
  };

  const getRecommendationColor = () => {
    switch (recommendation) {
      case 'BUY': return 'text-green-400';
      case 'SELL': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getRecommendationIcon = () => {
    switch (recommendation) {
      case 'BUY': return <TrendingUp className="h-5 w-5 text-green-400" />;
      case 'SELL': return <TrendingDown className="h-5 w-5 text-red-400" />;
      default: return <Activity className="h-5 w-5 text-yellow-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Asset Analysis Card */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6 text-blue-400" />
            <h3 className="text-xl font-semibold text-white">AI Analysis - {selectedSymbol}</h3>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-400">Live</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span className="text-sm text-red-400">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Current Price */}
        <div className="mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-2">
              {currentPrice ? currentPrice.toFixed(4) : '---'}
            </div>
            <div className="text-sm text-gray-400">
              Current Price • Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Analysis Result */}
        <div className="bg-gray-750 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              {getRecommendationIcon()}
              <span className={`font-semibold ${getRecommendationColor()}`}>
                {recommendation}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">Confidence:</span>
              <span className={`font-bold ${getRecommendationColor()}`}>
                {confidence}%
              </span>
            </div>
          </div>
          
          {isAnalyzing ? (
            <div className="flex items-center space-x-2 text-blue-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm">Analyzing market conditions...</span>
            </div>
          ) : (
            <p className="text-gray-300 text-sm leading-relaxed">
              {analysisResult || 'Waiting for sufficient price data to perform analysis...'}
            </p>
          )}
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">
              {priceHistory.length}
            </div>
            <div className="text-xs text-gray-400">Data Points</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-400">
              {priceHistory.length >= 10 ? 'Ready' : 'Loading'}
            </div>
            <div className="text-xs text-gray-400">Analysis Status</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {isConnected ? 'Online' : 'Offline'}
            </div>
            <div className="text-xs text-gray-400">Connection</div>
          </div>
        </div>
      </div>

      {/* Trading Signals */}
      <TradingSignals selectedAsset={selectedSymbol} />

      {/* Quick Trade */}
      <QuickTrade selectedAsset={selectedSymbol} />
    </div>
  );
};

export default AssetAnalysis;