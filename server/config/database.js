import { isSupabaseConnected } from './supabase.js';

export const connectDB = async () => {
  try {
    // Check if Supabase is configured
    if (isSupabaseConnected()) {
      console.log('✅ Supabase connected successfully');
      return true;
    } else {
      console.warn('⚠️  Supabase not configured');
      console.warn('⚠️  Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env');
      console.warn('⚠️  Server will run with limited functionality');
      return false;
    }
  } catch (error) {
    console.warn('⚠️  Database connection error:', error.message);
    return false;
  }
};

export const isDatabaseConnected = () => {
  return isSupabaseConnected();
};
