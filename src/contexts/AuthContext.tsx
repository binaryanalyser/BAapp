import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI, AuthResponse } from '../services/derivAPI';

interface AccountListItem {
  loginid: string;
  currency: string;
  is_virtual: number;
  balance?: number;
  email?: string;
  account_type?: string;
  broker?: string;
  is_disabled?: number;
  landing_company_name?: string;
}

interface User {
  loginid: string;
  email: string;
  fullname: string;
  currency: string;
  balance: number;
  is_virtual: number;
  country: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accountList: AccountListItem[] | null;
  loginMethod: 'oauth' | 'token' | null;
  accountBalances: Record<string, number>;
  login: (token: string) => Promise<void>;
  loginWithOAuth: (token: string) => Promise<void>;
  logout: () => void;
  updateBalance: (balance: number) => void;
  switchAccount: (loginid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accountList, setAccountList] = useState<AccountListItem[] | null>(null);
  const [loginMethod, setLoginMethod] = useState<'oauth' | 'token' | null>(null);
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

  // Initialize WebSocket connection
  useEffect(() => {
    derivAPI.connect().catch(console.error);
  }, []);

  // Fetch balances for all accounts when account list is available
  useEffect(() => {
    const fetchAccountBalances = async () => {
      if (accountList && accountList.length > 0 && loginMethod === 'oauth' && token) {
        console.log('Fetching balances for all accounts...');
        
        try {
          // Get balance for all accounts using the balance call
          const balanceResponse = await derivAPI.sendRequest({
            balance: 1,
            account: 'all'
          });
          
          const freshBalances: Record<string, number> = {};
          
          if (balanceResponse.balance) {
            // Handle single account balance response
            if (balanceResponse.balance.loginid) {
              freshBalances[balanceResponse.balance.loginid] = balanceResponse.balance.balance;
            }
          }
          
          // For OAuth, we need to get balances for each account individually
          for (const account of accountList) {
            try {
              console.log(`Fetching balance for account: ${account.loginid}`);
              
              // Switch to account and get balance
              const accountResponse = await derivAPI.sendRequest({
                authorize: token,
                loginid: account.loginid
              });
              
              if (accountResponse.authorize && accountResponse.authorize.balance !== undefined) {
                freshBalances[account.loginid] = accountResponse.authorize.balance;
                console.log(`Balance for ${account.loginid}: ${accountResponse.authorize.balance} ${account.currency}`);
              } else {
                // Fallback to account list balance
                freshBalances[account.loginid] = account.balance || 0;
                console.warn(`Could not fetch fresh balance for ${account.loginid}, using cached balance`);
              }
            } catch (error) {
              console.warn(`Failed to fetch balance for account ${account.loginid}:`, error);
              // Use the balance from account list as fallback
              freshBalances[account.loginid] = account.balance || 0;
            }
          }
          
          // Update all balances at once
          setAccountBalances(freshBalances);
          
          // Update the account list with fresh balances
          setAccountList(prevList => 
            prevList ? prevList.map(acc => ({
              ...acc,
              balance: freshBalances[acc.loginid] || acc.balance || 0
            })) : prevList
          );
          
          // Update current user's balance if it's in the fresh balances
          if (user && freshBalances[user.loginid] !== undefined) {
            setUser(prevUser => prevUser ? {
              ...prevUser,
              balance: freshBalances[user.loginid]
            } : prevUser);
          }
          
          // Switch back to current user's account
          if (user) {
            try {
              await derivAPI.sendRequest({
                authorize: token,
                loginid: user.loginid
              });
              console.log(`Switched back to current account: ${user.loginid}`);
            } catch (error) {
              console.warn('Failed to switch back to current account:', error);
            }
          }
          
          console.log('All account balances fetched:', freshBalances);
        } catch (error) {
          console.error('Failed to fetch account balances:', error);
          // Initialize with account list balances as fallback
          const fallbackBalances: Record<string, number> = {};
          accountList.forEach(account => {
            fallbackBalances[account.loginid] = account.balance || 0;
          });
          setAccountBalances(fallbackBalances);
        }
      }
    };

    // Only fetch balances when we have all required data and haven't fetched yet
    if (accountList && loginMethod === 'oauth' && token && Object.keys(accountBalances).length === 0) {
      fetchAccountBalances();
    }
  }, [accountList, loginMethod, token, accountBalances, user]);

  // Subscribe to balance updates for current account
  useEffect(() => {
    const subscribeToBalance = async () => {
      if (isAuthenticated && user && token) {
        try {
          console.log('Subscribing to balance updates for:', user.loginid);
          await derivAPI.subscribeToBalance();
        } catch (error) {
          console.warn('Failed to subscribe to balance updates:', error);
        }
      }
    };

    subscribeToBalance();
  }, [isAuthenticated, user, token]);

  // Listen for balance updates
  useEffect(() => {
    const handleBalanceUpdate = (balanceData: any) => {
      if (balanceData.loginid && user && balanceData.loginid === user.loginid) {
        console.log('Balance update received:', balanceData);
        updateBalance(balanceData.balance);
      }
    };

    derivAPI.onBalanceUpdate(handleBalanceUpdate);

    return () => {
      derivAPI.offBalanceUpdate(handleBalanceUpdate);
    };
  }, [user]);

  // Fetch trading history and portfolio when authenticated
  useEffect(() => {
    const fetchTradingData = async () => {
      if (isAuthenticated && user && token && loginMethod === 'oauth') {
        try {
          console.log('Fetching trading data for OAuth user...');
          
          // Get portfolio (open positions)
          const portfolioResponse = await derivAPI.getPortfolio();
          console.log('Portfolio data:', portfolioResponse);
          
          // Get profit table (trading history)
          const profitResponse = await derivAPI.getProfitTable({
            limit: 50,
            description: 1
          });
          console.log('Trading history:', profitResponse);
          
        } catch (error) {
          console.warn('Failed to fetch trading data:', error);
        }
      }
    };

    // Fetch trading data after authentication
    if (isAuthenticated && user && !isLoading) {
      fetchTradingData();
    }
  }, [isAuthenticated, user, token, loginMethod, isLoading]);

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_token');
    const savedLoginMethod = localStorage.getItem('deriv_login_method') as 'oauth' | 'token' | null;
    if (savedToken) {
      handleTokenLogin(savedToken, savedLoginMethod || 'token').catch(error => {
        console.error('Failed to restore session:', error);
        // Don't clear token immediately, let user try manual login
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleTokenLogin = async (authToken: string, method: 'oauth' | 'token' = 'token') => {
    try {
      setIsLoading(true);
      console.log('Starting authentication with token...', authToken.substring(0, 10) + '...');
      
      // Ensure connection is established
      if (!derivAPI.getConnectionStatus()) {
        console.log('WebSocket not connected, establishing connection...');
        await derivAPI.connect();
        // Add a small delay to ensure connection is stable
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Authorize with the token
      console.log('Sending authorization request...');
      const response: AuthResponse = await derivAPI.authorize(authToken);
      console.log('Authorization response received:', response.authorize ? 'Success' : 'Failed');
      
      if (response.authorize) {
        const userData: User = {
          loginid: response.authorize.loginid,
          email: response.authorize.email,
          fullname: response.authorize.fullname,
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          is_virtual: response.authorize.is_virtual,
          country: response.authorize.country
        };

        // Store account list for switching (only for OAuth logins)
        if (response.authorize.account_list && method === 'oauth') {
          const accounts: AccountListItem[] = response.authorize.account_list.map((account: any) => ({
            loginid: account.loginid,
            currency: account.currency,
            is_virtual: account.is_virtual,
            balance: account.balance || 0,
            email: account.email,
            account_type: account.account_type,
            broker: account.broker,
            is_disabled: account.is_disabled,
            landing_company_name: account.landing_company_name
          }));
          setAccountList(accounts);
          
          // Initialize account balances with data from account list
          const initialBalances: Record<string, number> = {};
          accounts.forEach(account => {
            initialBalances[account.loginid] = account.balance || 0;
          });
          setAccountBalances(initialBalances);
          
          console.log('Account list loaded:', accounts.length, 'accounts');
          console.log('Initial balances set:', initialBalances);
        } else if (method === 'token') {
          // For token login, don't store account list to prevent switching
          setAccountList(null);
          setAccountBalances({});
          console.log('Token login - account switching disabled');
        }

        setUser(userData);
        setToken(authToken);
        setLoginMethod(method);
        setIsAuthenticated(true);
        
        // Save token to localStorage
        localStorage.setItem('deriv_token', authToken);
        localStorage.setItem('deriv_login_method', method);
        console.log('Authentication successful for:', userData.loginid);
        console.log('User data set, authentication complete');
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      // Only clear token if it's definitely invalid (not connection issues)
      if (error instanceof Error && error.message.includes('InvalidToken')) {
        localStorage.removeItem('deriv_token');
        localStorage.removeItem('deriv_login_method');
        setUser(null);
        setToken(null);
        setLoginMethod(null);
        setIsAuthenticated(false);
      } else {
        // For connection issues, keep the token but set loading to false
        console.warn('Connection issue during auth, keeping token for retry');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (authToken: string) => {
    await handleTokenLogin(authToken, 'token');
  };

  const loginWithOAuth = async (authToken: string) => {
    await handleTokenLogin(authToken, 'oauth');
  };

  const switchAccount = async (loginid: string) => {
    if (!isAuthenticated || !token || loginMethod !== 'oauth') {
      throw new Error('Not authenticated');
    }

    try {
      setIsLoading(true);
      console.log('Switching to account:', loginid);
      
      // Switch account using authorize with loginid
      const response = await derivAPI.sendRequest({ 
        authorize: token,
        loginid: loginid
      });
      
      if (response.authorize) {
        const userData: User = {
          loginid: response.authorize.loginid,
          email: response.authorize.email,
          fullname: response.authorize.fullname,
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          is_virtual: response.authorize.is_virtual,
          country: response.authorize.country
        };
        
        setUser(userData);
        
        // Update account balances with fresh data from the switch
        setAccountBalances(prev => ({
          ...prev,
          [loginid]: response.authorize.balance
        }));
        
        // Update the account list with fresh balance
        setAccountList(prevList => 
          prevList ? prevList.map(acc => 
            acc.loginid === loginid 
              ? { ...acc, balance: response.authorize.balance }
              : acc
          ) : prevList
        );
        
        console.log('Successfully switched to account:', loginid, 'Balance:', response.authorize.balance, response.authorize.currency);
      } else {
        throw new Error('Failed to switch account - no authorization response');
      }
      
    } catch (error) {
      console.error('Account switch failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setLoginMethod(null);
    setIsAuthenticated(false);
    setAccountList(null);
    setAccountBalances({});
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_login_method');
    // Don't disconnect API as it might be used by other parts of the app
    console.log('User logged out');
  };

  const updateBalance = (balance: number) => {
    if (user) {
      setUser({ ...user, balance });
      
      // Update account balances
      setAccountBalances(prev => ({
        ...prev,
        [user.loginid]: balance
      }));
      
      // Also update the balance in the account list
      setAccountList(prevList => 
        prevList ? prevList.map(acc => 
          acc.loginid === user.loginid 
            ? { ...acc, balance }
            : acc
        ) : prevList
      );
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    accountList,
    loginMethod,
    accountBalances,
    login,
    loginWithOAuth,
    logout,
    updateBalance,
    switchAccount
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};