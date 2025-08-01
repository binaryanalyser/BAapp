import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import LiveTicks from '../components/Trading/LiveTicks';
import { User } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { isConnected, subscribeTo } = useWebSocket();
  const [selectedSymbols] = useState(['R_10', 'R_25', 'R_50', 'R_75', 'R_100']);

  // Move useEffect to top level, before any conditional returns
  useEffect(() => {
    if (isConnected) {
      selectedSymbols.forEach(symbol => subscribeTo(symbol));
    }
  }, [isConnected, subscribeTo]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
          <p className="text-gray-400 text-sm">
            {user ? 'Loading dashboard...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <User className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Welcome, {user?.loginid}! Analysis Overview</h1>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-gray-400">Monitor your performance and analyze market trends</p>
          </div>
        </div>

        {/* Live Ticks */}
        <div className="grid grid-cols-1 gap-6 mt-6">
          <LiveTicks symbols={selectedSymbols} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;