interface DerivResponse {
  [key: string]: any;
  error?: {
    code: string;
    message: string;
  };
}

class DerivAPI {
  private ws: WebSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private messageId = 1;
  private callbacks: Map<number, (data: any) => void> = new Map();
  private tickCallback: ((data: any) => void) | null = null;
  private connectionCallback: ((connected: boolean) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      
      this.ws.onopen = () => {
        this.connectionPromise = null;
        this.reconnectAttempts = 0;
        this.connectionCallback?.(true);
        console.log('WebSocket connected successfully');
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.tick) {
          this.tickCallback?.(data);
        }

        if (data.req_id && this.callbacks.has(data.req_id)) {
          const callback = this.callbacks.get(data.req_id);
          callback?.(data);
          this.callbacks.delete(data.req_id);
        }
        
        // Handle subscription confirmations
        if (data.msg_type === 'tick' && data.tick) {
          this.tickCallback?.(data);
        }
      };

      this.ws.onclose = () => {
        this.connectionPromise = null;
        this.connectionCallback?.(false);
        console.log('WebSocket closed');
        
        // Auto-reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch(error => {
              console.warn('Reconnection attempt failed:', error);
            });
          }, delay);
        } else {
          console.warn('Max reconnection attempts reached');
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.connectionPromise = null;
        reject(new Error('WebSocket connection failed'));
      };
    });

    return this.connectionPromise;
  }

  private async sendRequest(request: any): Promise<DerivResponse> {
    try {
      await this.connect();
    } catch (error) {
      console.warn('Failed to connect for request, retrying...', error);
      // Try once more
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      const reqId = this.messageId++;
      request.req_id = reqId;

      this.callbacks.set(reqId, resolve);
      
      setTimeout(() => {
        if (this.callbacks.has(reqId)) {
          this.callbacks.delete(reqId);
          reject(new Error('Request timeout'));
        }
      }, 15000); // Increase timeout to 15 seconds

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(request));
      } else {
        this.callbacks.delete(reqId);
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  async authorize(token: string): Promise<DerivResponse> {
    return this.sendRequest({
      authorize: token
    });
  }

  async getBalance(): Promise<DerivResponse> {
    return this.sendRequest({
      balance: 1
    });
  }

  async subscribeTicks(symbol: string): Promise<DerivResponse> {
    return this.sendRequest({
      ticks: symbol,
      subscribe: 1
    });
  }

  async unsubscribeTicks(symbol: string): Promise<DerivResponse> {
    return this.sendRequest({
      forget_all: 'ticks'
    });
  }

  async buyContract(parameters: {
    contract_type: string;
    symbol: string;
    duration: number;
    duration_unit: string;
    amount: number;
    basis: string;
  }): Promise<DerivResponse> {
    return this.sendRequest({
      buy: 1,
      parameters
    });
  }

  async getActiveSymbols(): Promise<DerivResponse> {
    return this.sendRequest({
      active_symbols: 'brief'
    });
  }

  async getProfitTable(): Promise<DerivResponse> {
    return this.sendRequest({
      profit_table: 1,
      description: 1,
      limit: 50
    });
  }

  async getPortfolio(): Promise<DerivResponse> {
    return this.sendRequest({
      portfolio: 1
    });
  }

  async getProposal(parameters: any): Promise<DerivResponse> {
    return this.sendRequest(parameters);
  }

  async subscribeToContract(contractId: string, callback: (data: any) => void): Promise<void> {
    this.contractCallbacks.set(contractId, callback);
    await this.sendRequest({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    });
  }

  onTick(callback: (data: any) => void) {
    this.tickCallback = callback;
  }

  onConnection(callback: (connected: boolean) => void) {
    this.connectionCallback = callback;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;
    this.callbacks.clear();
  }
}

export const derivAPI = new DerivAPI();