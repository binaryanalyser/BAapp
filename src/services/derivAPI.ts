// Deriv API WebSocket service
export interface TickData {
  price: number;
  epoch: number;
  symbol: string;
  quote: number;
}

export interface AuthResponse {
  authorize: {
    account_list: Array<{
      account_type: string;
      broker: string;
      currency: string;
      email: string;
      fullname: string;
      is_disabled: number;
      is_virtual: number;
      landing_company_name: string;
      loginid: string;
    }>;
    balance: number;
    country: string;
    currency: string;
    email: string;
    fullname: string;
    is_virtual: number;
    landing_company_fullname: string;
    landing_company_name: string;
    local_currencies: Record<string, any>;
    loginid: string;
    preferred_language: string;
    scopes: string[];
    upgradeable_landing_companies: string[];
    user_id: number;
  };
}

export interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    id: string;
    loginid: string;
  };
}

export interface ContractResponse {
  buy: {
    balance_after: number;
    buy_price: number;
    contract_id: number;
    longcode: string;
    payout: number;
    purchase_time: number;
    shortcode: string;
    start_time: number;
    transaction_id: number;
  };
}

class DerivAPI {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private tickListeners: Array<(data: TickData) => void> = [];
  private connectionListeners: Array<(connected: boolean) => void> = [];
  private subscriptions = new Map<string, string>(); // symbol -> subscription_id
  private readonly APP_ID = '88454';
  private readonly WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=88454`;
  private requestCallbacks = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private requestId = 1;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.isConnecting = true;
        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
          console.log('WebSocket connected to Deriv API');
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.connectionListeners.forEach(listener => listener(true));
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleResponse(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket connection failed:', {
            error,
            url: this.WS_URL,
            timestamp: new Date().toISOString()
          });
          this.isConnecting = false;
          this.connectionListeners.forEach(listener => listener(false));
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.isConnecting = false;
          this.connectionListeners.forEach(listener => listener(false));
          
          // Auto-reconnect if not a clean close and we haven't exceeded max attempts
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => {
              this.connect().catch(error => {
                console.error('Reconnection failed:', error);
              });
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleResponse(data: any): void {
    // Handle request callbacks first
    if (data.req_id && this.requestCallbacks.has(data.req_id)) {
      const callback = this.requestCallbacks.get(data.req_id)!;
      clearTimeout(callback.timeout);
      this.requestCallbacks.delete(data.req_id);
      
      if (data.error) {
        // Handle "already subscribed" as success, not an error
        if (data.error.message?.includes('already subscribed')) {
          console.warn('Already subscribed:', data.error.message);
          callback.resolve(data);
          return;
        }
        
        const errorMessage = data.error.message || 'API Error';
        console.error('API Error Response:', data.error);
        callback.reject(new Error(errorMessage));
      } else {
        callback.resolve(data);
      }
      return;
    }

    if (data.error) {
      // Handle "already subscribed" as a warning, not an error
      if (data.error.message?.includes('already subscribed')) {
        console.warn('Subscription already exists:', data.error.message);
        return;
      }
      // Handle authorization errors specifically
      if (data.error.code === 'InvalidToken') {
        console.error('Invalid token detected, user needs to re-authenticate');
        // Don't auto-logout here, let the auth context handle it
      }
      console.error('API Error:', data.error);
      return;
    }

    // Handle tick data
    if (data.tick) {
      const tickData: TickData = {
        price: data.tick.quote,
        epoch: data.tick.epoch,
        symbol: data.tick.symbol,
        quote: data.tick.quote
      };
      this.tickListeners.forEach(listener => listener(tickData));
    }

    // Handle subscription confirmation
    if (data.ticks_history || data.tick) {
      const symbol = data.echo_req?.ticks || data.tick?.symbol;
      if (symbol && data.subscription?.id) {
        this.subscriptions.set(symbol, data.subscription.id);
      }
    }
  }

  private sendRequest(request: any, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        // Try to reconnect if not connected
        this.connect().then(() => {
          // Retry the request after reconnection
          this.sendRequestInternal(request, timeout, resolve, reject);
        }).catch(error => {
          reject(new Error('WebSocket is not connected and reconnection failed: ' + error.message));
        });
        return;
      }

      this.sendRequestInternal(request, timeout, resolve, reject);
    });
  }

  private sendRequestInternal(request: any, timeout: number, resolve: Function, reject: Function): void {
      const reqId = this.requestId++;
      request.req_id = reqId;

      const timeoutHandle = setTimeout(() => {
        this.requestCallbacks.delete(reqId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.requestCallbacks.set(reqId, { resolve, reject, timeout: timeoutHandle });
      this.ws.send(JSON.stringify(request));
  }

  async authorize(token: string): Promise<AuthResponse> {
    try {
      const response = await this.sendRequest({ authorize: token });
      if (response.error) {
        throw new Error(response.error.message || 'Authorization failed');
      }
      return response;
    } catch (error) {
      console.error('Authorization request failed:', error);
      throw error;
    }
  }

  async getBalance(): Promise<BalanceResponse> {
    return this.sendRequest({ balance: 1, subscribe: 1 });
  }

  async subscribeTicks(symbol: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    // Check if already subscribed
    if (this.subscriptions.has(symbol)) {
      console.log(`Already subscribed to ${symbol}`);
      return;
    }

    try {
      const response = await this.sendRequest({ ticks: symbol, subscribe: 1 });
      if (response.subscription?.id) {
        this.subscriptions.set(symbol, response.subscription.id);
      }
    } catch (error: any) {
      // Handle "already subscribed" as success
      if (error.message?.includes('already subscribed')) {
        console.warn(`Already subscribed to ${symbol}, treating as success`);
        return;
      }
      throw error;
    }
  }

  async unsubscribeTicks(symbol: string): Promise<void> {
    const subscriptionId = this.subscriptions.get(symbol);
    if (!subscriptionId) {
      console.log(`No subscription found for ${symbol}`);
      return;
    }

    await this.sendRequest({ forget: subscriptionId });
    this.subscriptions.delete(symbol);
  }

  async buyContract(contractId: string, price: number): Promise<ContractResponse> {
    return this.sendRequest({ 
      buy: contractId,
      price: price
    });
  }

  async getContractsFor(symbol: string): Promise<any> {
    return this.sendRequest({ 
      contracts_for: symbol,
      currency: 'USD'
    });
  }

  async getProposal(parameters: any): Promise<any> {
    return this.sendRequest({ proposal: 1, ...parameters });
  }

  async getPortfolio(): Promise<any> {
    return this.sendRequest({ portfolio: 1 });
  }

  async subscribeToPortfolio(): Promise<any> {
    return this.sendRequest({ 
      portfolio: 1, 
      subscribe: 1 
    });
  }

  async switchAccount(loginid: string): Promise<any> {
    return this.sendRequest({ 
      authorize: this.getStoredToken(),
      loginid: loginid 
    });
  }

  private getStoredToken(): string {
    // Get the token from localStorage or current session
    return localStorage.getItem('deriv_token') || '';
  }

  async sellContract(contractId: number): Promise<any> {
    return this.sendRequest({ sell: contractId });
  }

  async getProposalOpenContract(contractId: number): Promise<any> {
    return this.sendRequest({ 
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    });
  }

  async getStatement(options: {
    description?: number;
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<any> {
    return this.sendRequest({
      statement: 1,
      description: options.description || 1,
      limit: options.limit || 50,
      offset: options.offset || 0,
      ...(options.date_from && { date_from: options.date_from }),
      ...(options.date_to && { date_to: options.date_to })
    });
  }

  async getProfitTable(options: {
    description?: number;
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
    contract_type?: string[];
  } = {}): Promise<any> {
    return this.sendRequest({
      profit_table: 1,
      description: options.description || 1,
      limit: options.limit || 50,
      offset: options.offset || 0,
      ...(options.date_from && { date_from: options.date_from }),
      ...(options.date_to && { date_to: options.date_to }),
      ...(options.contract_type && { contract_type: options.contract_type })
    });
  }

  async getTransactions(options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<any> {
    return this.sendRequest({
      transactions: 1,
      limit: options.limit || 50,
      offset: options.offset || 0
    });
  }

  async getPortfolio(): Promise<any> {
    return this.sendRequest({ portfolio: 1 });
  }

  async getProposalOpenContract(contractId: number): Promise<any> {
    return this.sendRequest({ 
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    });
  }

  async sellContract(contractId: number): Promise<any> {
    return this.sendRequest({ sell: contractId });
  }

  disconnect(): void {
    // Clear all pending callbacks
    this.requestCallbacks.forEach(callback => {
      clearTimeout(callback.timeout);
      callback.reject(new Error('Connection closed'));
    });
    this.requestCallbacks.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.subscriptions.clear();
    }
  }

  // Event listeners
  onTick(callback: (data: TickData) => void): void {
    this.tickListeners.push(callback);
  }

  offTick(callback: (data: TickData) => void): void {
    const index = this.tickListeners.indexOf(callback);
    if (index > -1) {
      this.tickListeners.splice(index, 1);
    }
  }

  onConnection(callback: (connected: boolean) => void): void {
    this.connectionListeners.push(callback);
  }

  offConnection(callback: (connected: boolean) => void): void {
    const index = this.connectionListeners.indexOf(callback);
    if (index > -1) {
      this.connectionListeners.splice(index, 1);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const derivAPI = new DerivAPI();
export default derivAPI;