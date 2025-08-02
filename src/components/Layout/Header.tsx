import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, User, LogOut, Menu, X, ChevronDown, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout, accountList, switchAccount, isLoading } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});


  const navigation = [
    { name: 'Analysis', href: '/', icon: BarChart3 },
    { name: 'Signals', href: '/trading', icon: BarChart3 },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Update account balances when accountList changes
  useEffect(() => {
    if (accountList) {
      const balances: Record<string, number> = {};
      accountList.forEach(account => {
        balances[account.loginid] = account.balance || 0;
      });
      setAccountBalances(balances);
    }
  }, [accountList]);

  // Update current user's balance in the account list
  useEffect(() => {
    if (user && accountList) {
      setAccountBalances(prev => ({
        ...prev,
        [user.loginid]: user.balance
      }));
    }
  }, [user?.balance, user?.loginid, accountList]);
  const handleAccountSwitch = async (loginid: string) => {
    if (loginid === user?.loginid) {
      setIsAccountDropdownOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      await switchAccount(loginid);
      setIsAccountDropdownOpen(false);
    } catch (error) {
      console.error('Failed to switch account:', error);
      alert('Failed to switch account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSwitching(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.account-dropdown')) {
        setIsAccountDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get display balance for an account
  const getAccountBalance = (account: any) => {
    // Use the most recent balance from our local state, fallback to account data
    return accountBalances[account.loginid] ?? account.balance ?? 0;
  };

  // Format balance for display
  const formatBalance = (balance: number, currency: string) => {
    return `${balance.toFixed(2)} ${currency}`;
  };
  return (
    <header className="fixed top-0 w-full bg-gray-800 border-b border-gray-700 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              <span className="text-xl font-bold text-white">Binary Analyzer</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2">
                {/* Account Switcher */}
                {accountList && accountList.length > 1 && (
                  <div className="relative account-dropdown">
                    <button
                      onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                      disabled={isSwitching || isLoading}
                      className="flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {isSwitching ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {user.loginid}
                        {user.is_virtual ? ' (Demo)' : ' (Real)'}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isAccountDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
                        <div className="p-2">
                                  isCurrentAccount
                            Switch Account ({accountList.length} available)
                          </div>
                          {accountList.map((account) => (
                            const accountBalance = getAccountBalance(account);
                            const isCurrentAccount = account.loginid === user.loginid;
                            <button
                              key={account.loginid}
                              onClick={() => handleAccountSwitch(account.loginid)}
                                      {isCurrentAccount && (
                                        <div className="text-xs bg-green-500 text-white px-2 py-1 rounded">
                                          ACTIVE
                                        </div>
                                      )}
                              disabled={isSwitching}
                              className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                                      {account.is_virtual ? 'Demo Account' : 'Real Account'} • {account.currency}
                                  ? 'bg-blue-600 text-white'
                                  : 'hover:bg-gray-700 text-gray-300'
                              } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    <div className="text-sm font-mono font-bold">
                                      {formatBalance(accountBalance, account.currency)}
                                <div>
                                    {isCurrentAccount && (
                                      <div className="text-xs text-green-400 mt-1">Current</div>
                                    )}
                                    {!isCurrentAccount && accountBalance !== (account.balance || 0) && (
                                      <div className="text-xs text-yellow-400 mt-1">Updated</div>
                                    {account.is_virtual ? 'Demo Account' : 'Real Account'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-mono">
                                    {account.balance?.toFixed(2) || '0.00'} {account.currency}
                                  </div>
                                  {account.loginid === user.loginid && (
                                    <div className="text-xs text-blue-400">Active</div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                          
                          {/* Account Summary */}
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <div className="px-3 py-2 text-xs text-gray-400">
                              <div className="flex justify-between items-center">
                                <span>Total Accounts:</span>
                                <span className="font-medium">{accountList.length}</span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span>Demo Accounts:</span>
                                <span className="font-medium">
                                  {accountList.filter(acc => acc.is_virtual).length}
                                </span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span>Real Accounts:</span>
                                <span className="font-medium">
                                  {accountList.filter(acc => !acc.is_virtual).length}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Current Account Info */}
                <div className="text-right">
                  {(!accountList || accountList.length <= 1) && (
                    <div className="text-sm text-gray-300">{user.loginid}</div>
                  )}
                  <div className="text-xs text-green-400">
                    {formatBalance(user.balance, user.currency)}
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <User className="h-4 w-4" />
                <span>Login</span>
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-gray-800 border-t border-gray-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;