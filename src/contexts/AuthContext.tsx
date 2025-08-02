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
  login: (token: string) => Promise<void>;
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

  // Initialize WebSocket connection
  useEffect(() => {
    derivAPI.connect().catch(console.error);
  }, []);

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_token');
    if (savedToken) {
      handleTokenLogin(savedToken).catch(error => {
        console.error('Failed to restore session:', error);
        // Don't clear token immediately, let user try manual login
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleTokenLogin = async (authToken: string) => {
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

        // Store account list for switching
        if (response.authorize.account_list) {
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
        }

        setUser(userData);
        setToken(authToken);
        setIsAuthenticated(true);
        
        // Save token to localStorage
        localStorage.setItem('deriv_token', authToken);
        console.log('Authentication successful for:', userData.loginid);
        console.log('User data set, authentication complete');
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      // Only clear token if it's definitely invalid (not connection issues)
      if (error instanceof Error && error.message.includes('InvalidToken')) {
        localStorage.removeItem('deriv_token');
        setUser(null);
        setToken(null);
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
    await handleTokenLogin(authToken);
  };

  const switchAccount = async (loginid: string) => {
    if (!isAuthenticated || !token) {
      throw new Error('Not authenticated');
    }

    try {
      setIsLoading(true);
      console.log('Switching to account:', loginid);
      
      // Method 1: Try using 'switch' request
      try {
        const switchResponse = await derivAPI.sendRequest({
          switch: loginid
        });
        
        if (switchResponse.switch) {
          console.log('Switch successful, re-authorizing...');
          // Re-authorize to get updated account info
          const authResponse = await derivAPI.authorize(token);
          
          if (authResponse.authorize) {
            const userData: User = {
              loginid: authResponse.authorize.loginid,
              email: authResponse.authorize.email,
              fullname: authResponse.authorize.fullname,
              currency: authResponse.authorize.currency,
              balance: authResponse.authorize.balance,
              is_virtual: authResponse.authorize.is_virtual,
              country: authResponse.authorize.country
            };
            
            setUser(userData);
            console.log('Successfully switched to account:', loginid);
            return; // Success, exit early
          }
        }
      } catch (switchError) {
        console.log('Switch method failed, trying authorize with loginid...', switchError);
      }
      
      // Method 2: Try authorize with loginid parameter
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
          console.log('Successfully switched to account via authorize:', loginid);
          return; // Success, exit early
        }
      } catch (authorizeError) {
        console.log('Authorize with loginid failed:', authorizeError);
      }
      
      // Method 3: Manual account selection from stored account list
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
              updateBalance(balanceResponse.balance.balance);
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
      }
    } catch (balanceError) {
      console.warn('Failed to get balance after account switch:', balanceError);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setAccountList(null);
    localStorage.removeItem('deriv_token');
    // Don't disconnect API as it might be used by other parts of the app
    console.log('User logged out');
  };

  const updateBalance = (balance: number) => {
    if (user) {
      setUser({ ...user, balance });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    accountList,
    login,
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