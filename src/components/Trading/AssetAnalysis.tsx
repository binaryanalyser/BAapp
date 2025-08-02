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
        return <TrendingUp className="h-6 w