interface TickData {
  id: string;
  symbol: string;
  tick: number;
  epoch: number;
  quote: number;
}

interface AuthResponse {
  authorize: {
    account_list: Array<{
      account_type: string;
      broker: string;
      currency: string;
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

interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    id: string;
    loginid: string;
  };
}

type TickCallback = (tick: TickData) => void;
type ConnectionCallback = (isConnected: boolean) => void;

class DerivAPI {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private tickCallbacks: TickCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private subscriptions = new Set<string>();

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=88454');
        
        this.ws.onopen = () => {
          console.log('WebSocket connected successfully');
          this.isConnected = true;
          this.connectionCallbacks.forEach(callback => callback(true));
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.tick) {
              const tickData: TickData = {
                id: data.tick.id,
                symbol: data.tick.symbol,
                tick: data.tick.quote,
                epoch: data.tick.epoch,
                quote: data.tick.quote
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
            url: 'wss://ws.derivws.com/websockets/v3?app_id=88454',
            timestamp: new Date().toISOString()
          });
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          this.connectionCallbacks.forEach(callback => callback(false));
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
      this.isConnected = false;
      this.subscriptions.clear();
    }
  }

  private send(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const messageWithId = { ...message, req_id: Date.now() };
      
      const handleResponse = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.req_id === messageWithId.req_id) {
            this.ws?.removeEventListener('message', handleResponse);
            if (data.error) {
              reject(new Error(data.error.message));
            } else {
              resolve(data);
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      this.ws.addEventListener('message', handleResponse);
      this.ws.send(JSON.stringify(messageWithId));
    });
  }

  async authorize(token: string): Promise<AuthResponse> {
    try {
      const response = await this.send({
        authorize: token
      });
      return response;
    } catch (error) {
      console.error('Authorization failed:', error);
      throw new Error(`Authorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw error;
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
      throw error;
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
      throw error;
    }
  }

  async buyContract(contractType: string, symbol: string, amount: number, duration: number): Promise<any> {
    try {
      const response = await this.send({
        buy: 1,
        price: amount,
        parameters: {
          contract_type: contractType,
          symbol: symbol,
          duration: duration,
          duration_unit: 't',
          amount: amount,
          basis: 'stake'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to buy contract:', error);
      throw error;
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

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const derivAPI = new DerivAPI();
export default derivAPI;