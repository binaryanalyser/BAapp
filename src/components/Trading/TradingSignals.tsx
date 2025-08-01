import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useSignalTimer } from '../../hooks/useSignalTimer';

interface SignalRecommendation {
  action: 'BUY' | 'SELL';
  confidence: number;
  reasoning: string;
  startTime: number;
  duration: number;
}

const TradingSignals = () => {
  const { ticks } = useWebSocket();
  const [signalDuration, setSignalDuration] = useState(5); // minutes
  const [aiRecommendation, setAiRecommendation] = useState<SignalRecommendation | null>(null);
  const [nextAnalysisTime, setNextAnalysisTime] = useState(Date.now() + 5 * 60 * 1000);
  const aiCountdown = aiRecommendation ? useSignalTimer(aiRecommendation.startTime, aiRecommendation.duration) : 0;

  useEffect(() => {
    const analyze = () => {
      if (Date.now() >= nextAnalysisTime) {
        const recommendation: SignalRecommendation = {
          action: Math.random() > 0.5 ? 'BUY' : 'SELL',
          confidence: Math.floor(70 + Math.random() * 25),
          reasoning: 'Mock analysis result',
          startTime: Date.now(),
          duration: signalDuration
        };
        setAiRecommendation(recommendation);
        setNextAnalysisTime(Date.now() + signalDuration * 60 * 1000);
      }
    };

    const interval = setInterval(analyze, 5000);
    return () => clearInterval(interval);
  }, [nextAnalysisTime, signalDuration]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 bg-gray-800 text-white rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">AI Recommendation</h2>
        <select
          value={signalDuration}
          onChange={(e) => {
            const newDuration = parseInt(e.target.value);
            setSignalDuration(newDuration);
            const now = Date.now();
            setNextAnalysisTime(now + newDuration * 60 * 1000);
          }}
          className="bg-gray-700 text-white px-3 py-1 rounded"
        >
          {[1, 2, 3, 5, 10, 15].map((min) => (
            <option key={min} value={min}>{min} min</option>
          ))}
        </select>
      </div>

      {aiRecommendation ? (
        <div className="space-y-2">
          <div className={`text-2xl font-bold ${aiRecommendation.action === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
            {aiRecommendation.action}
          </div>
          <div className="text-lg">{aiRecommendation.confidence}% confidence</div>
          <div className="text-sm italic text-gray-400">{aiRecommendation.reasoning}</div>
          <div className="mt-2 text-yellow-300 font-mono">{formatCountdown(aiCountdown)}</div>
        </div>
      ) : (
        <div className="text-gray-400">Waiting for analysis...</div>
      )}
    </div>
  );
};

export default TradingSignals;
