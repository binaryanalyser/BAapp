interface DerivAPIResponse {
  error?: {
    code: string;
    message: string;
  };
  [key: string]: any;
}

interface BuyContractParams {
  contract_type: string;
  symbol: string;
  duration: number;
  duration_unit: string;
  amount: number;
  basis: string;
  barrier?: string;
}

class DerivAPI {
  private ws: WebSocket | null = null;
  private requestId = 1;
  private callbacks: Map<number, (response: any) => void> = new Map();
  private isConnecting = false;

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnection = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            resolve();
          } else if (!this.isConnecting) {
            resolve();
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=3738');

        this.ws.onopen = () => {
          console.log('Deriv WebSocket connected');
          this.isConnecting = false;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const reqId = data.req_id;
            
            if (reqId && this.callbacks.has(reqId)) {
              const callback = this.callbacks.get(reqId);
              if (callback) {
                callback(data);
                this.callbacks.delete(reqId);
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Deriv WebSocket error details:', {
            error,
            readyState: this.ws?.readyState,
            url: this.ws?.url,
            timestamp: new Date().toISOString(),
            message: 'WebSocket connection failed - check network connectivity and app_id validity'
          });
          this.isConnecting = false;
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          console.log('Deriv WebSocket closed:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.clear();
  }

  private async sendRequest(request: any): Promise<any> {
    await this.connect();
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      const requestWithId = { ...request, req_id: reqId };

      this.callbacks.set(reqId, (response) => {
        resolve(response);
      });

      try {
        this.ws!.send(JSON.stringify(requestWithId));
      } catch (error) {
        this.callbacks.delete(reqId);
        reject(error);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.callbacks.has(reqId)) {
          this.callbacks.delete(reqId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async authorize(token: string): Promise<DerivAPIResponse> {
    return this.sendRequest({
      authorize: token
    });
  }

  async getBalance(): Promise<DerivAPIResponse> {
    return this.sendRequest({
      balance: 1
    });
  }

  async buyContract(params: BuyContractParams): Promise<DerivAPIResponse> {
    const request: any = {
      buy: 1,
      price: params.amount,
      parameters: {
        contract_type: params.contract_type,
        symbol: params.symbol,
        duration: params.duration,
        duration_unit: params.duration_unit,
        amount: params.amount,
        basis: params.basis
      }
    };

    if (params.barrier) {
      request.parameters.barrier = params.barrier;
    }

    return this.sendRequest(request);
  }

  async getActiveSymbols(): Promise<DerivAPIResponse> {
    return this.sendRequest({
      active_symbols: 'brief'
    });
  }

  async subscribeTicks(symbol: string): Promise<DerivAPIResponse> {
    return this.sendRequest({
      ticks: symbol,
      subscribe: 1
    });
  }

  async unsubscribeTicks(subscriptionId: string): Promise<DerivAPIResponse> {
    return this.sendRequest({
      forget: subscriptionId
    });
  }

  async getCandles(symbol: string, granularity: number = 60): Promise<DerivAPIResponse> {
    return this.sendRequest({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: 1000,
      end: 'latest',
      granularity,
      style: 'candles'
    });
  }

  async getServerTime(): Promise<DerivAPIResponse> {
    return this.sendRequest({
      time: 1
    });
  }
}

export const derivAPI = new DerivAPI();