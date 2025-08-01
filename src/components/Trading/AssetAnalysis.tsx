import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import TradingSignals from './TradingSignals';
import QuickTrade from './QuickTrade';
import { BarChart3, TrendingUp, TrendingDown, Activity, Target, Zap } from 'lucide-react';

interface AssetAnalysisProps {
  selectedSymbol: string;
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol }) => {
  const { ticks, subscribeTo } = useWebSocket();
  const [priceMovement, setPriceMovement] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [previousPrice, setPreviousPrice] = useState<number>(0);

  const currentTick = ticks[selectedSymbol];
  const currentPrice = currentTick?.price || 0;

  // Subscribe to the selected symbol
  useEffect(() => {
    if (selectedSymbol) {
      subscribeTo(selectedSymbol);
    }
  }, [selectedSymbol, subscribeTo]);

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

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-400" />
          <div>
            <h3 className="text-xl font-semibold text-white">{selectedSymbol} Analysis</h3>
            <div className="flex items-center space-x-2 mt-1">
              {getPriceMovementIcon()}
              <span className={`font-mono font-medium transition-all duration-300 ${getPriceMovementClass()}`}>
                {currentPrice ? currentPrice.toFixed(4) : '---'}
              </span>
              <span className="text-xs text-gray-400">Live Price</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-400">Live Data</span>
        </div>
      </div>

      {/* AI Signals Section */}
      <div className="mb-6">
        <TradingSignals selectedAsset={selectedSymbol} />
      </div>

      {/* Quick Trade Section */}
      <div className="border-t border-gray-700 pt-6">
        <div className="flex items-center space-x-3 mb-4">
          <Zap className="h-5 w-5 text-yellow-400" />
          <h4 className="text-lg font-semibold text-white">Quick Trade</h4>
          <span className="text-xs text-gray-400">Execute trades based on AI signals</span>
        </div>
        <QuickTrade selectedAsset={selectedSymbol} />
      </div>
    </div>
  );
};

export default AssetAnalysis;