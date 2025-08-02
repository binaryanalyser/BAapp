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

  // Initialize WebSocket connection
  useEffect(() => {
    derivAPI.connect().catch(console.error);
  }, []);

  // Fetch balances for all accounts when account list is available
  useEffect(() => {
    const fetchAccountBalances = async () => {
      if (accountList && accountList.length > 1 && loginMethod === 'oauth') {
        console.log('Fetching balances for all accounts...');
        
        // Try to get fresh balance for current account
        if (user && isAuthenticated) {
          try {
            const balanceResponse = await derivAPI.getBalance();
            if (balanceResponse.balance) {
              const freshBalance = balanceResponse.balance.balance;
              updateBalance(freshBalance);
            }
          } catch (error) {
            console.warn('Failed to fetch current account balance:', error);
          }
        }
      }
    };

    fetchAccountBalances();
  }, [accountList, user?.loginid, isAuthenticated, loginMethod]);
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
            balance: account.balance,
            email: account.email,
            account_type: account.account_type,
            broker: account.broker,
            is_disabled: account.is_disabled,
            landing_company_name: account.landing_company_name
          }));
          setAccountList(accounts);
          console.log('Account list loaded:', accounts.length, 'accounts');
        } else if (method === 'token') {
          // For token login, don't store account list to prevent switching
          setAccountList(null);
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
      
      // Try authorize with loginid parameter to switch account
      try {
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
          
          // Update the account list with fresh balance data
          if (response.authorize.account_list) {
            const updatedAccounts: AccountListItem[] = response.authorize.account_list.map((account: any) => ({
              loginid: account.loginid,
              currency: account.currency,
              is_virtual: account.is_virtual,
              balance: account.balance,
              email: account.email,
              account_type: account.account_type,
              broker: account.broker,
              is_disabled: account.is_disabled,
              landing_company_name: account.landing_company_name
            }));
            setAccountList(updatedAccounts);
            
            // Update local balance tracking
            setAccountBalances(prev => {
              const newBalances = { ...prev };
              updatedAccounts.forEach(acc => {
                newBalances[acc.loginid] = acc.balance || 0;
              });
              return newBalances;
            });
          }
          
          console.log('Successfully switched to account via authorize:', loginid);
          return; // Success, exit early
        }
      } catch (authorizeError) {
        console.log('Authorize with loginid failed:', authorizeError);
      }
      
      // Fallback: Manual account selection from stored account list
      if (accountList) {
        const targetAccount = accountList.find(acc => acc.loginid === loginid);
        if (targetAccount) {
          const userData: User = {
            loginid: targetAccount.loginid,
            email: targetAccount.email || user?.email || '',
            fullname: user?.fullname || '',
            currency: targetAccount.currency,
            balance: targetAccount.balance || 0,
            is_virtual: targetAccount.is_virtual,
            country: user?.country || ''
          };
          
          setUser(userData);
          console.log('Switched to account via local data:', loginid);
          
          // Try to get fresh balance
          try {
            const balanceResponse = await derivAPI.getBalance();
            if (balanceResponse.balance) {
              const freshBalance = balanceResponse.balance.balance;
              updateBalance(freshBalance);
              
              // Update the account list with the fresh balance
              setAccountList(prevList => 
                prevList ? prevList.map(acc => 
                  acc.loginid === loginid 
                    ? { ...acc, balance: freshBalance }
                    : acc
                ) : prevList
              );
              
              // Update local balance tracking
              setAccountBalances(prev => ({
                ...prev,
                [loginid]: freshBalance
              }));
            }
          } catch (balanceError) {
            console.warn('Failed to get balance after local switch:', balanceError);
          }
          return; // Success
        }
      }
      
      throw new Error('All account switch methods failed');
      
    } catch (error) {
      console.error('Account switch failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get updated balance for the new account
  const getUpdatedBalance = async () => {
    try {
      const balanceResponse = await derivAPI.getBalance();
      if (balanceResponse.balance) {
        updateBalance(balanceResponse.balance.balance);
        
        // Update the account list with the fresh balance
        if (user) {
          setAccountList(prevList => 
            prevList ? prevList.map(acc => 
              acc.loginid === user.loginid 
                ? { ...acc, balance: balanceResponse.balance.balance }
                : acc
            ) : prevList
          );
        }
      }
    } catch (balanceError) {
      console.warn('Failed to get balance after account switch:', balanceError);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setLoginMethod(null);
    setIsAuthenticated(false);
    setAccountList(null);
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_login_method');
    // Don't disconnect API as it might be used by other parts of the app
    console.log('User logged out');
  };

  const updateBalance = (balance: number) => {
    if (user) {
      setUser({ ...user, balance });
      
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