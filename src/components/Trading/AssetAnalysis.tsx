import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Activity, AlertCircle, Target, BarChart3, Zap, Play, DollarSign, Clock } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { derivAPI } from '../../services/derivAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTradingContext } from '../../contexts/TradingContext';

interface AssetAnalysisProps {
  selectedAsset: string;
}

interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  description: string;
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

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedAsset }) => {
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
  } | null>(null);
  
  // Quick Trade states
  const [selectedContract, setSelectedContract] = useState('CALL');
  const [amount, setAmount] = useState<string>('10');
  const [duration, setDuration] = useState('5');
  const [isTrading, setIsTrading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const currentPrice = ticks[selectedAsset]?.tick || 0;

  // Calculate potential payout and profit
  const potentialPayout = parseFloat(String(amount || '0')) * 1.85;
  const potentialProfit = potentialPayout - parseFloat(String(amount || '0'));

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
    if (!user) return;
    
    setIsTrading(true);
    const entryTime = Date.now();
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const response = await derivAPI.buyContract({
        contract_type: selectedContract,
        symbol: selectedAsset,
        duration: parseInt(duration),
        duration_unit: 'm',
        amount: parseFloat(amount),
        basis: 'stake'
      });

      if (response.error) {
        alert(`Trade failed: ${response.error.message}`);
      } else {
        const newTrade = {
          id: tradeId,
          symbol: selectedAsset,
          type: selectedContract as 'CALL' | 'PUT' | 'DIGITMATCH' | 'DIGITDIFF',
          stake: parseFloat(amount),
          payout: 0,
          profit: 0,
          status: 'open' as const,
          entryTime,
          entryPrice: currentPrice,
          contractId: response.buy?.contract_id
        };
        
        addTrade(newTrade);
        setTradeSuccess(true);
        setCountdown(parseInt(duration) * 60);
        
        setTimeout(() => {
          const exitPrice = ticks[selectedAsset]?.tick || currentPrice;
          const isWin = Math.random() > 0.4;
          const payout = isWin ? parseFloat(amount) * 1.85 : 0;
          const profit = payout - parseFloat(amount);
          
          updateTrade(tradeId, {
            status: isWin ? 'won' : 'lost',
            exitTime: Date.now(),
            exitPrice,
            payout,
            profit
          });
        }, parseInt(duration) * 60 * 1000);
      }
    } catch (error) {
      alert('Failed to execute trade');
    } finally {
      setIsTrading(false);
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

  // Generate realistic technical analysis
  const generateTechnicalAnalysis = () => {
    const indicators: TechnicalIndicator[] = [
      {
        name: 'RSI (14)',
        value: Math.random() * 100,
        signal: 'NEUTRAL',
        strength: 'MODERATE',
        description: 'Relative Strength Index indicates momentum'
      },
      {
        name: 'MACD',
        value: (Math.random() - 0.5) * 0.002,
        signal: 'NEUTRAL',
        strength: 'MODERATE',
        description: 'Moving Average Convergence Divergence'
      },
      {
        name: 'Bollinger Bands',
        value: Math.random(),
        signal: 'NEUTRAL',
        strength: 'WEAK',
        description: 'Price volatility and trend analysis'
      },
      {
        name: 'Stochastic',
        value: Math.random() * 100,
        signal: 'NEUTRAL',
        strength: 'MODERATE',
        description: 'Momentum oscillator comparing closing price'
      },
      {
        name: 'Williams %R',
        value: Math.random() * -100,
        signal: 'NEUTRAL',
        strength: 'WEAK',
        description: 'Momentum indicator measuring overbought/oversold'
      }
    ];

    // Apply realistic logic to indicators
    indicators.forEach(indicator => {
      switch (indicator.name) {
        case 'RSI (14)':
          if (indicator.value < 30) {
            indicator.signal = 'BUY';
            indicator.strength = 'STRONG';
          } else if (indicator.value > 70) {
            indicator.signal = 'SELL';
            indicator.strength = 'STRONG';
          } else if (indicator.value < 40) {
            indicator.signal = 'BUY';
            indicator.strength = 'MODERATE';
          } else if (indicator.value > 60) {
            indicator.signal = 'SELL';
            indicator.strength = 'MODERATE';
          }
          break;
        
        case 'MACD':
          if (indicator.value > 0.0005) {
            indicator.signal = 'BUY';
            indicator.strength = 'MODERATE';
          } else if (indicator.value < -0.0005) {
            indicator.signal = 'SELL';
            indicator.strength = 'MODERATE';
          }
          break;
        
        case 'Stochastic':
          if (indicator.value < 20) {
            indicator.signal = 'BUY';
            indicator.strength = 'MODERATE';
          } else if (indicator.value > 80) {
            indicator.signal = 'SELL';
            indicator.strength = 'MODERATE';
          }
          break;
      }
    });

    return indicators;
  };

  // Generate market sentiment
  const generateMarketSentiment = (): MarketSentiment => {
    const bullish = Math.random() * 100;
    const bearish = Math.random() * (100 - bullish);
    const neutral = 100 - bullish - bearish;

    let overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullish > 50) overall = 'BULLISH';
    else if (bearish > 40) overall = 'BEARISH';

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
  const generateAIRecommendation = (indicators: TechnicalIndicator[], sentiment: MarketSentiment) => {
    const buySignals = indicators.filter(i => i.signal === 'BUY').length;
    const sellSignals = indicators.filter(i => i.signal === 'SELL').length;
    const strongSignals = indicators.filter(i => i.strength === 'STRONG').length;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 50;
    let reasoning = 'Mixed signals suggest a cautious approach';
    let timeframe = '5-15 minutes';

    if (buySignals > sellSignals && sentiment.overall === 'BULLISH') {
      action = 'BUY';
      confidence = Math.min(95, 60 + (buySignals * 10) + (strongSignals * 5) + (sentiment.bullish * 0.3));
      reasoning = `${buySignals} bullish indicators with ${sentiment.bullish.toFixed(0)}% market sentiment support upward movement`;
      timeframe = confidence > 80 ? '3-5 minutes' : '5-10 minutes';
    } else if (sellSignals > buySignals && sentiment.overall === 'BEARISH') {
      action = 'SELL';
      confidence = Math.min(95, 60 + (sellSignals * 10) + (strongSignals * 5) + (sentiment.bearish * 0.3));
      reasoning = `${sellSignals} bearish indicators with ${sentiment.bearish.toFixed(0)}% market sentiment suggest downward pressure`;
      timeframe = confidence > 80 ? '3-5 minutes' : '5-10 minutes';
    } else if (strongSignals >= 2) {
      action = buySignals > sellSignals ? 'BUY' : 'SELL';
      confidence = Math.min(85, 65 + (strongSignals * 8));
      reasoning = `${strongSignals} strong technical signals provide clear direction despite mixed sentiment`;
      timeframe = '5-15 minutes';
    }

    return { action, confidence, reasoning, timeframe };
  };

  // Perform analysis
  const performAnalysis = () => {
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const indicators = generateTechnicalAnalysis();
      const sentiment = generateMarketSentiment();
      const levels = generatePriceLevels(currentPrice);
      const recommendation = generateAIRecommendation(indicators, sentiment);

      setTechnicalIndicators(indicators);
      setMarketSentiment(sentiment);
      setPriceLevels(levels);
      setAiRecommendation(recommendation);
      setLastAnalysis(Date.now());
      setIsAnalyzing(false);
    }, 2000);
  };

  // Auto-analyze when asset changes or every 30 seconds
  useEffect(() => {
    performAnalysis();
    const interval = setInterval(performAnalysis, 30000);
    return () => clearInterval(interval);
  }, [selectedAsset, currentPrice]);

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
          {isAnalyzing && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-blue-400">Analyzing...</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{selectedAsset}</div>
          <div className="text-sm text-gray-400">
            Last: {new Date(lastAnalysis).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* AI Recommendation */}
      {aiRecommendation && (
        <div className={`rounded-lg border-2 p-4 mb-6 ${getRecommendationColor(aiRecommendation.action)}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 space-y-3 lg:space-y-0">
            <div className="flex items-center space-x-3 flex-1">
              <Target className="h-6 w-6 text-blue-400" />
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                  <span className="text-lg font-bold text-white">
                    AI Recommendation: {aiRecommendation.action}
                  </span>
                  <span className="text-sm bg-gray-700 px-2 py-1 rounded w-fit">
                    {aiRecommendation.timeframe}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-1 max-w-none lg:max-w-md xl:max-w-lg">{aiRecommendation.reasoning}</p>
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
      <div className="mb-6 bg-gray-750 rounded-lg p-6 border border-gray-600">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-white flex items-center">
            <Target className="h-5 w-5 mr-2 text-blue-400" />
            Quick Trade
          </h4>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">Live</span>
          </div>
        </div>

        {/* Barrier Selection for Digit Contracts */}
        {(selectedContract === 'DIGITMATCH' || selectedContract === 'DIGITDIFF') && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <Target className="inline h-4 w-4 mr-1" />
              Select Digit (0-9)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                <button
                  key={digit}
                  onClick={() => setBarrier(digit.toString())}
                  className={`p-3 rounded-lg text-lg font-bold transition-all duration-300 border-2 ${
                    barrier === digit.toString()
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                  }`}
                >
                  {digit}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2 text-center">
              {selectedContract === 'DIGITMATCH' ? 'Last digit will match selected number' : 'Last digit will differ from selected number'}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Contract Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">
              Contract Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
              {contractTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedContract === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedContract(type.value)}
                    className={`p-4 rounded-lg text-base font-medium transition-all duration-300 border-2 transform hover:scale-105 ${
                      isSelected
                        ? type.activeColor
                        : `${type.color} border-transparent`
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Icon className="h-5 w-5" />
                      <span>{type.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div className="max-w-md mx-auto">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <DollarSign className="inline h-4 w-4 mr-1" />
              Stake Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
              placeholder="10.00"
              min="1"
              step="0.01"
            />
            <div className="flex justify-center space-x-2 mt-3">
              {['5', '10', '25', '50'].map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => setAmount(quickAmount)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors border border-gray-600 hover:border-gray-500"
                >
                  ${quickAmount}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Selection */}
          <div className="max-w-md mx-auto">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <Clock className="inline h-4 w-4 mr-1" />
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            >
              <option value="1">1 minute</option>
              <option value="2">2 minutes</option>
              <option value="3">3 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
            </select>
          </div>

          {/* Trade Summary */}
          <div className="max-w-md mx-auto bg-gray-700 rounded-lg p-6 border border-gray-600">
            <h5 className="text-white font-medium mb-4 text-center">Trade Summary</h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Price:</span>
                <span className="text-white font-mono text-lg">{currentPrice ? currentPrice.toFixed(4) : '---'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Stake:</span>
                <span className="text-white font-medium">{amount} {user?.currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Potential Payout:</span>
                <span className="text-green-400 font-medium">
                  {potentialPayout.toFixed(2)} {user?.currency}
                  {askPrice > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      (Cost: {askPrice.toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Potential Profit:</span>
                <span className="text-green-400 font-medium">+{potentialProfit.toFixed(2)} {user?.currency}</span>
              </div>
            </div>
          </div>

          {/* Execute Trade Button */}
          <div className="max-w-md mx-auto">
            <button
              onClick={handleTrade}
              disabled={isTrading || !user || !currentPrice}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              {isTrading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="text-lg">Placing Trade...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  <span className="text-lg">Execute Trade</span>
                  <Zap className="h-5 w-5 animate-pulse" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>


      {/* Market Sentiment */}
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
      </div>

    </div>
  );
};

export default AssetAnalysis;