// Deriv API WebSocket service
export interface TickData {
  tick: number;
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
  private readonly WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${this.APP_ID}`;

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
          this.connectionListeners.forEach(listener => listener(true));
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleResponse(JSON.parse(event.data));
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
          console.log('WebSocket connection closed');
          this.isConnected = false;
          this.isConnecting = false;
          this.connectionListeners.forEach(listener => listener(false));
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleResponse(data: any): void {
    if (data.error) {
      // Handle "already subscribed" as a warning, not an error
      if (data.error.message?.includes('already subscribed')) {
        console.warn('Subscription already exists:', data.error.message);
        return;
      }
      console.error('API Error:', data.error);
      return;
    }

    // Handle tick data
    if (data.tick) {
      const tickData: TickData = {
        tick: data.tick.quote,
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

  async authorize(token: string): Promise<AuthResponse> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const request = {
        authorize: token,
        req_id: Date.now()
      };

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.req_id === request.req_id) {
          this.ws?.removeEventListener('message', handleMessage);
          if (data.error) {
            reject(new Error(data.error.message));
          } else {
            resolve(data);
          }
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this.ws?.send(JSON.stringify(request));
    });
  }

  async getBalance(): Promise<BalanceResponse> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const request = {
        balance: 1,
        subscribe: 1,
        req_id: Date.now()
      };

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.req_id === request.req_id) {
          this.ws?.removeEventListener('message', handleMessage);
          if (data.error) {
            reject(new Error(data.error.message));
          } else {
            resolve(data);
          }
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this.ws?.send(JSON.stringify(request));
    });
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

    return new Promise((resolve, reject) => {
      const request = {
        ticks: symbol,
        subscribe: 1,
        req_id: Date.now()
      };

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.req_id === request.req_id) {
          this.ws?.removeEventListener('message', handleMessage);
          if (data.error) {
            // Handle "already subscribed" as success
            if (data.error.message?.includes('already subscribed')) {
              console.warn(`Already subscribed to ${symbol}, treating as success`);
              resolve();
            } else {
              reject(new Error(`Failed to subscribe to ticks for ${symbol}: ${data.error.message}`));
            }
          } else {
            if (data.subscription?.id) {
              this.subscriptions.set(symbol, data.subscription.id);
            }
            resolve();
          }
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this.ws?.send(JSON.stringify(request));
    });
  }

  async unsubscribeTicks(symbol: string): Promise<void> {
    const subscriptionId = this.subscriptions.get(symbol);
    if (!subscriptionId) {
      console.log(`No subscription found for ${symbol}`);
      return;
    }

    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const request = {
        forget: subscriptionId,
        req_id: Date.now()
      };

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.req_id === request.req_id) {
          this.ws?.removeEventListener('message', handleMessage);
          if (data.error) {
            reject(new Error(data.error.message));
          } else {
            this.subscriptions.delete(symbol);
            resolve();
          }
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this.ws?.send(JSON.stringify(request));
    });
  }

  async buyContract(parameters: any): Promise<ContractResponse> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const request = {
        buy: 1,
        parameters,
        price: parameters.amount,
        req_id: Date.now()
      };

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.req_id === request.req_id) {
          this.ws?.removeEventListener('message', handleMessage);
          if (data.error) {
            reject(new Error(data.error.message));
          } else {
            resolve(data);
          }
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this.ws?.send(JSON.stringify(request));
    });
  }

  disconnect(): void {
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