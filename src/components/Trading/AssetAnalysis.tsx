import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import TradingSignals from './TradingSignals';
import QuickTrade from './QuickTrade';
import TradingChart from './TradingChart';
import { BarChart3, TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';

interface AssetAnalysisProps {
  selectedSymbol: string;
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol }) => {
  const { ticks, subscribeTo } = useWebSocket();
  const [activeTab, setActiveTab] = useState<'signals' | 'trade' | 'chart'>('signals');
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

  const tabs = [
    { id: 'signals', label: 'AI Signals', icon: Target },
    { id: 'trade', label: 'Quick Trade', icon: TrendingUp },
    { id: 'chart', label: 'Chart', icon: BarChart3 }
  ];

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

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white border border-gray-500'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'signals' && (
          <TradingSignals selectedAsset={selectedSymbol} />
        )}
        
        {activeTab === 'trade' && (
          <QuickTrade selectedAsset={selectedSymbol} />
        )}
        
        {activeTab === 'chart' && (
          <div className="bg-gray-750 rounded-lg p-4">
            <TradingChart symbol={selectedSymbol} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetAnalysis;