import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface User {
  id: string;
  deriv_loginid: string;
  deriv_token: string;
  email?: string;
  fullname?: string;
  currency: string;
  balance: number;
  is_virtual: boolean;
  country?: string;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
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
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
}