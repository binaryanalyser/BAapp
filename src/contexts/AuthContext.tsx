const handleTokenLogin = async (authToken: string, method: 'oauth' | 'token' = 'token') => {
  try {
    setIsLoading(true);
    if (!derivAPI.getConnectionStatus()) {
      await derivAPI.connect();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const response: AuthResponse = await derivAPI.authorize(authToken);

    if (!response.authorize) throw new Error('Authorization failed');

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
    setToken(authToken);
    setLoginMethod(method);
    setIsAuthenticated(true);
    localStorage.setItem('deriv_token', authToken);
    localStorage.setItem('deriv_login_method', method);

    if (response.authorize.account_list && method === 'oauth') {
      const accounts: AccountListItem[] = response.authorize.account_list.map((account: any) => ({
        loginid: account.loginid,
        currency: account.currency,
        is_virtual: account.is_virtual,
        email: account.email,
        account_type: account.account_type,
        broker: account.broker,
        is_disabled: account.is_disabled,
        landing_company_name: account.landing_company_name
      }));

      const accountBalances: Record<string, number> = {};

      for (const account of accounts) {
        try {
          const res = await derivAPI.sendRequest({
            authorize: authToken,
            loginid: account.loginid
          });

          if (res.authorize) {
            account.balance = res.authorize.balance || 0;
            accountBalances[account.loginid] = account.balance;
          }
        } catch (err) {
          console.warn(`Failed to fetch balance for ${account.loginid}`, err);
        }
      }

      setAccountList(accounts);
      setAccountBalances(accountBalances);
    } else if (method === 'token') {
      setAccountList(null);
      setAccountBalances({});
    }

  } catch (error) {
    console.error('Authorization failed:', error);
    if (error instanceof Error && error.message.includes('InvalidToken')) {
      localStorage.removeItem('deriv_token');
      localStorage.removeItem('deriv_login_method');
      setUser(null);
      setToken(null);
      setLoginMethod(null);
      setIsAuthenticated(false);
    }
    throw error;
  } finally {
    setIsLoading(false);
  }
};

export const useAuth = () => {