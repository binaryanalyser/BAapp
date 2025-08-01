import { supabase, User, Trade, UserSession } from '../lib/supabase';

export class SupabaseService {
  // User management
  async createOrUpdateUser(userData: {
    deriv_loginid: string;
    deriv_token: string;
    email?: string;
    fullname?: string;
    currency?: string;
    balance?: number;
    is_virtual?: boolean;
    country?: string;
  }): Promise<User | null> {
    try {
      // First, try to find existing user
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('deriv_loginid', userData.deriv_loginid)
        .single();

      if (existingUser) {
        // Update existing user
        const { data, error } = await supabase
          .from('users')
          .update({
            deriv_token: userData.deriv_token,
            email: userData.email,
            fullname: userData.fullname,
            currency: userData.currency || 'USD',
            balance: userData.balance || 0,
            is_virtual: userData.is_virtual ?? true,
            country: userData.country,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new user
        const { data, error } = await supabase
          .from('users')
          .insert({
            deriv_loginid: userData.deriv_loginid,
            deriv_token: userData.deriv_token,
            email: userData.email,
            fullname: userData.fullname,
            currency: userData.currency || 'USD',
            balance: userData.balance || 0,
            is_virtual: userData.is_virtual ?? true,
            country: userData.country
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error creating/updating user:', error);
      return null;
    }
  }

  async getUserByLoginId(loginid: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('deriv_loginid', loginid)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async updateUserBalance(userId: string, balance: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ balance, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating user balance:', error);
      return false;
    }
  }

  // Trading history management
  async saveTrade(tradeData: {
    user_id: string;
    symbol: string;
    type: 'CALL' | 'PUT' | 'DIGITMATCH' | 'DIGITDIFF';
    stake: number;
    duration?: number;
    payout: number;
    profit: number;
    status: 'won' | 'lost' | 'open';
    entry_time: string;
    exit_time?: string;
    entry_price?: number;
    exit_price?: number;
    contract_id?: string;
    barrier?: string;
  }): Promise<Trade | null> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving trade:', error);
      return null;
    }
  }

  async updateTrade(tradeId: string, updates: Partial<Trade>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', tradeId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating trade:', error);
      return false;
    }
  }

  async getUserTrades(userId: string, limit?: number): Promise<Trade[]> {
    try {
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user trades:', error);
      return [];
    }
  }

  async getOpenTrades(userId: string): Promise<Trade[]> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching open trades:', error);
      return [];
    }
  }

  // Session management
  async createSession(userId: string, sessionToken: string, expiresAt: Date): Promise<UserSession | null> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async getValidSession(sessionToken: string): Promise<UserSession | null> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  }

  async deleteSession(sessionToken: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', sessionToken);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  async cleanupExpiredSessions(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return false;
    }
  }

  // Analytics and statistics
  async getUserStats(userId: string): Promise<{
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    winRate: number;
    activeTrades: number;
  }> {
    try {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('status, profit')
        .eq('user_id', userId);

      if (error) throw error;

      const totalTrades = trades?.filter(t => t.status !== 'open').length || 0;
      const winningTrades = trades?.filter(t => t.profit > 0).length || 0;
      const totalProfit = trades?.reduce((sum, t) => sum + (t.profit || 0), 0) || 0;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const activeTrades = trades?.filter(t => t.status === 'open').length || 0;

      return {
        totalTrades,
        winningTrades,
        totalProfit,
        winRate,
        activeTrades
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return {
        totalTrades: 0,
        winningTrades: 0,
        totalProfit: 0,
        winRate: 0,
        activeTrades: 0
      };
    }
  }
}

export const supabaseService = new SupabaseService();