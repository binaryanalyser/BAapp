interface AuthorizeResponse {
  authorize?: {
    loginid: string;
    email: string;
    currency: string;
    country: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

interface BalanceResponse {
  balance?: {
    balance: number;
    currency: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

interface TickData {
  tick: number;
  epoch: number;
  symbol: string;
}

interface ConnectionCallback {
  (isConnected: boolean): void;
}

interface TickCallback {
  (tickData: TickData): void;
}

class DerivAPI {
  private ws: WebSocket | null = null;
  private app_id = '3738';
  private api_url = 'wss://ws.derivws.com/websockets/v3';
  private connectionCallbacks: ConnectionCallback[] = [];
  private tickCallbacks: TickCallback[] = [];
  private subscriptions: Set<string> = new Set();

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.api_url}?app_id=${this.app_id}`);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected to Deriv API');
          this.connectionCallbacks.forEach(callback => callback(true));
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle tick data
            if (data.tick) {
              const tickData: TickData = {
                tick: data.tick.quote,
                epoch: data.tick.epoch,
                symbol: data.tick.symbol
              };
              this.tickCallbacks.forEach(callback => callback(tickData));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket connection failed:', {
            error,
            readyState: this.ws?.readyState,
            url: `${this.api_url}?app_id=${this.app_id}`,
            timestamp: new Date().toISOString()
          });
          this.connectionCallbacks.forEach(callback => callback(false));
          reject(new Error('WebSocket connection failed'));
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.connectionCallbacks.forEach(callback => callback(false));
          this.ws = null;
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  private send(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const requestId = Math.random().toString(36).substring(7);
      const message = { ...data, req_id: requestId };

      const handleResponse = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          if (response.req_id === requestId) {
            this.ws?.removeEventListener('message', handleResponse);
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      };

      this.ws.addEventListener('message', handleResponse);
      this.ws.send(JSON.stringify(message));

      // Timeout after 10 seconds
      setTimeout(() => {
        this.ws?.removeEventListener('message', handleResponse);
        reject(new Error('Request timeout'));
      }, 10000);
    });
  }

  async authorize(token: string): Promise<AuthorizeResponse> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect();
      }
      
      const response = await this.send({
        authorize: token
      });
      
      return response;
    } catch (error) {
      console.error('Authorization failed:', error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Authorization failed',
          code: 'AUTH_ERROR'
        }
      };
    }
  }

  async getBalance(): Promise<BalanceResponse> {
    try {
      const response = await this.send({
        balance: 1
      });
      
      return response;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to get balance',
          code: 'BALANCE_ERROR'
        }
      };
    }
  }

  async subscribeTicks(symbol: string): Promise<void> {
    try {
      if (this.subscriptions.has(symbol)) {
        return; // Already subscribed
      }

      await this.send({
        ticks: symbol,
        subscribe: 1
      });

      this.subscriptions.add(symbol);
      console.log(`Subscribed to ticks for ${symbol}`);
    } catch (error) {
      console.error(`Failed to subscribe to ticks for ${symbol}:`, error);
    }
  }

  async unsubscribeTicks(symbol: string): Promise<void> {
    try {
      if (!this.subscriptions.has(symbol)) {
        return; // Not subscribed
      }

      await this.send({
        forget_all: 'ticks'
      });

      this.subscriptions.delete(symbol);
      console.log(`Unsubscribed from ticks for ${symbol}`);
    } catch (error) {
      console.error(`Failed to unsubscribe from ticks for ${symbol}:`, error);
    }
  }

  async buyContract(contractData: any): Promise<any> {
    try {
      const response = await this.send({
        buy: 1,
        ...contractData
      });
      
      return response;
    } catch (error) {
      console.error('Failed to buy contract:', error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to buy contract',
          code: 'BUY_ERROR'
        }
      };
    }
  }

  // Event listener methods
  onTick(callback: TickCallback): void {
    this.tickCallbacks.push(callback);
  }

  offTick(callback: TickCallback): void {
    const index = this.tickCallbacks.indexOf(callback);
    if (index > -1) {
      this.tickCallbacks.splice(index, 1);
    }
  }

  onConnection(callback: ConnectionCallback): void {
    this.connectionCallbacks.push(callback);
  }

  offConnection(callback: ConnectionCallback): void {
    const index = this.connectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.connectionCallbacks.splice(index, 1);
    }
  }
}

// Export singleton instance
export const derivAPI = new DerivAPI();