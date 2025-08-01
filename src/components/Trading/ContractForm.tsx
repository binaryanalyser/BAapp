import React, { useState } from 'react';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { derivAPI } from '../../services/derivAPI';

interface ContractFormProps {
  symbol: string;
}

const ContractForm: React.FC<ContractFormProps> = ({ symbol }) => {
  const [contractType, setContractType] = useState('CALL');
  const [stake, setStake] = useState('10');
  const [duration, setDuration] = useState('5');
  const [barrier, setBarrier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await derivAPI.buyContract({
        contract_type: contractType,
        symbol,
        duration: parseInt(duration),
        duration_unit: 'm',
        amount: parseFloat(stake),
        basis: 'stake'
      });

      if (response.error) {
        alert(`Error: ${response.error.message}`);
      } else {
        alert('Contract purchased successfully!');
        // Reset form
        setStake('10');
        setDuration('5');
        setBarrier('');
      }
    } catch (error) {
      alert('Failed to purchase contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contractTypes = [
    { value: 'CALL', label: 'Rise', icon: TrendingUp, color: 'text-green-400' },
    { value: 'PUT', label: 'Fall', icon: TrendingDown, color: 'text-red-400' },
    { value: 'DIGITMATCH', label: 'Matches', icon: Calculator, color: 'text-blue-400' },
    { value: 'DIGITDIFF', label: 'Differs', icon: Calculator, color: 'text-yellow-400' }
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h4 className="text-lg font-semibold text-white mb-4">New Contract</h4>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contract Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Contract Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {contractTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setContractType(type.value)}
                  className={`p-3 rounded border-2 transition-colors flex items-center justify-center space-x-2 ${
                    contractType === type.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${type.color}`} />
                  <span className="text-sm text-white">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stake */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Stake Amount
          </label>
          <input
            type="number"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="10.00"
            min="1"
            step="0.01"
            required
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Duration (minutes)
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1">1 minute</option>
            <option value="2">2 minutes</option>
            <option value="3">3 minutes</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
          </select>
        </div>

        {/* Barrier (for digit contracts) */}
        {(contractType === 'DIGITMATCH' || contractType === 'DIGITDIFF') && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Barrier (last digit)
            </label>
            <select
              value={barrier}
              onChange={(e) => setBarrier(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select digit</option>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                <option key={digit} value={digit}>{digit}</option>
              ))}
            </select>
          </div>
        )}

        {/* Payout Calculation */}
        <div className="bg-gray-700 rounded p-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Stake:</span>
            <span className="text-white">${stake}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Potential Payout:</span>
            <span className="text-green-400">${(parseFloat(stake || '0') * 1.85).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Potential Profit:</span>
            <span className="text-green-400">${(parseFloat(stake || '0') * 0.85).toFixed(2)}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          {isSubmitting ? 'Purchasing...' : 'Purchase Contract'}
        </button>
      </form>
    </div>
  );
};

export default ContractForm;