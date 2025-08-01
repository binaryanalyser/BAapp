import React from 'react';
import { BookOpen } from 'lucide-react';

interface OrderBookProps {
  symbol: string;
}

const OrderBook: React.FC<OrderBookProps> = ({ symbol }) => {
  // Mock order book data
  const orders = {
    buy: [
      { price: 1234.56, amount: 0.5 },
      { price: 1234.45, amount: 1.2 },
      { price: 1234.34, amount: 0.8 },
      { price: 1234.23, amount: 2.1 },
      { price: 1234.12, amount: 1.5 },
    ],
    sell: [
      { price: 1234.67, amount: 0.7 },
      { price: 1234.78, amount: 1.1 },
      { price: 1234.89, amount: 0.9 },
      { price: 1235.00, amount: 1.8 },
      { price: 1235.11, amount: 2.3 },
    ]
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white">Order Book</h4>
        <BookOpen className="h-5 w-5 text-gray-400" />
      </div>

      <div className="space-y-4">
        {/* Sell Orders */}
        <div>
          <h5 className="text-sm font-medium text-red-400 mb-2">Sell Orders</h5>
          <div className="space-y-1">
            {orders.sell.reverse().map((order, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-red-400 font-mono">{order.price.toFixed(2)}</span>
                <span className="text-gray-300">{order.amount.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Price */}
        <div className="border-t border-b border-gray-600 py-2">
          <div className="text-center">
            <div className="text-lg font-mono text-white">1234.61</div>
            <div className="text-xs text-gray-400">Current Price</div>
          </div>
        </div>

        {/* Buy Orders */}
        <div>
          <h5 className="text-sm font-medium text-green-400 mb-2">Buy Orders</h5>
          <div className="space-y-1">
            {orders.buy.map((order, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-green-400 font-mono">{order.price.toFixed(2)}</span>
                <span className="text-gray-300">{order.amount.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBook;