import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Activity, Star } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface Asset {
  symbol: string;
  display_name: string;
  market: string;
  submarket: string;
  is_trading_suspended: boolean;
  pip: number;
}

interface AssetSelectorProps {
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
}

const AssetSelector: React.FC<AssetSelectorProps> = ({ selectedAsset, onAssetChange }) => {
  const { ticks } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>(['VIX10', 'VIX25', 'VIX50']);

  // Popular trading assets with categories
  const assets: Asset[] = [
    // Volatility Indices
    { symbol: 'VIX10', display_name: 'Volatility 10 Index', market: 'synthetic_index', submarket: 'random_index', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'VIX25', display_name: 'Volatility 25 Index', market: 'synthetic_index', submarket: 'random_index', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'VIX50', display_name: 'Volatility 50 Index', market: 'synthetic_index', submarket: 'random_index', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'VIX75', display_name: 'Volatility 75 Index', market: 'synthetic_index', submarket: 'random_index', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'VIX100', display_name: 'Volatility 100 Index', market: 'synthetic_index', submarket: 'random_index', is_trading_suspended: false, pip: 0.01 },
    
    // Step Indices
    { symbol: 'STEPINDEX', display_name: 'Step Index', market: 'synthetic_index', submarket: 'step_index', is_trading_suspended: false, pip: 0.01 },
    
    // Crash/Boom Indices
    { symbol: 'BOOM1000', display_name: 'Boom 1000 Index', market: 'synthetic_index', submarket: 'crash_boom', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'CRASH1000', display_name: 'Crash 1000 Index', market: 'synthetic_index', submarket: 'crash_boom', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'BOOM500', display_name: 'Boom 500 Index', market: 'synthetic_index', submarket: 'crash_boom', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'CRASH500', display_name: 'Crash 500 Index', market: 'synthetic_index', submarket: 'crash_boom', is_trading_suspended: false, pip: 0.01 },
    
    // Jump Indices
    { symbol: 'JD10', display_name: 'Jump 10 Index', market: 'synthetic_index', submarket: 'jump_index', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'JD25', display_name: 'Jump 25 Index', market: 'synthetic_index', submarket: 'jump_index', is_trading_suspended: false, pip: 0.01 },
    
    // Forex (Major Pairs)
    { symbol: 'frxEURUSD', display_name: 'EUR/USD', market: 'forex', submarket: 'major_pairs', is_trading_suspended: false, pip: 0.00001 },
    { symbol: 'frxGBPUSD', display_name: 'GBP/USD', market: 'forex', submarket: 'major_pairs', is_trading_suspended: false, pip: 0.00001 },
    { symbol: 'frxUSDJPY', display_name: 'USD/JPY', market: 'forex', submarket: 'major_pairs', is_trading_suspended: false, pip: 0.001 },
    { symbol: 'frxAUDUSD', display_name: 'AUD/USD', market: 'forex', submarket: 'major_pairs', is_trading_suspended: false, pip: 0.00001 },
    
    // Commodities
    { symbol: 'frxXAUUSD', display_name: 'Gold/USD', market: 'commodities', submarket: 'metals', is_trading_suspended: false, pip: 0.01 },
    { symbol: 'frxXAGUSD', display_name: 'Silver/USD', market: 'commodities', submarket: 'metals', is_trading_suspended: false, pip: 0.001 },
  ];

  const categories = [
    { value: 'all', label: 'All Assets', count: assets.length },
    { value: 'favorites', label: 'Favorites', count: favoriteAssets.length },
    { value: 'synthetic_index', label: 'Synthetic Indices', count: assets.filter(a => a.market === 'synthetic_index').length },
    { value: 'forex', label: 'Forex', count: assets.filter(a => a.market === 'forex').length },
    { value: 'commodities', label: 'Commodities', count: assets.filter(a => a.market === 'commodities').length },
  ];

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedCategory === 'all') return matchesSearch;
    if (selectedCategory === 'favorites') return matchesSearch && favoriteAssets.includes(asset.symbol);
    return matchesSearch && asset.market === selectedCategory;
  });

  const toggleFavorite = (symbol: string) => {
    setFavoriteAssets(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const getCurrentPrice = (symbol: string) => {
    return ticks[symbol]?.tick || 0;
  };

  const getPriceChange = (symbol: string) => {
    // Mock price change calculation
    return (Math.random() - 0.5) * 0.002;
  };

  const getMarketStatus = (asset: Asset) => {
    if (asset.is_trading_suspended) return { status: 'Closed', color: 'text-red-400' };
    return { status: 'Open', color: 'text-green-400' };
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Select Trading Asset</h3>
        <Activity className="h-5 w-5 text-blue-400" />
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search assets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === category.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {category.label} ({category.count})
          </button>
        ))}
      </div>

      {/* Asset List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredAssets.map((asset) => {
          const currentPrice = getCurrentPrice(asset.symbol);
          const priceChange = getPriceChange(asset.symbol);
          const marketStatus = getMarketStatus(asset);
          const isSelected = selectedAsset === asset.symbol;
          const isFavorite = favoriteAssets.includes(asset.symbol);

          return (
            <div
              key={asset.symbol}
              onClick={() => onAssetChange(asset.symbol)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-750'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(asset.symbol);
                    }}
                    className="text-gray-400 hover:text-yellow-400 transition-colors"
                  >
                    <Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </button>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-white">{asset.display_name}</span>
                      <span className="text-xs bg-gray-600 px-2 py-1 rounded font-mono">
                        {asset.symbol}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-400 capitalize">
                        {asset.submarket.replace('_', ' ')}
                      </span>
                      <span className={`text-xs ${marketStatus.color}`}>
                        {marketStatus.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {currentPrice > 0 && (
                    <>
                      <div className="font-mono text-white font-medium">
                        {currentPrice.toFixed(asset.pip === 0.00001 ? 5 : asset.pip === 0.001 ? 3 : 2)}
                      </div>
                      <div className={`flex items-center space-x-1 text-sm ${
                        priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {priceChange >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-mono">
                          {priceChange >= 0 ? '+' : ''}{(priceChange * 100).toFixed(3)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAssets.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No assets found matching your search</p>
        </div>
      )}
    </div>
  );
};

export default AssetSelector;