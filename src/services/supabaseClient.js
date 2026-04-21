import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase credentials not configured');
  console.warn('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Sign up new user
 */
export const signUp = async (email, password, username) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sign in user
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sign out user
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    return { success: !error };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get current session
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Session error:', error);
      return null;
    }
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};

/**
 * Get user profile
 */
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return null;
  }
};

/**
 * Get user texts
 */
export const getUserTexts = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('texts')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching texts:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getUserTexts:', error);
    return [];
  }
};

/**
 * Get text by ID
 */
export const getTextById = async (textId) => {
  try {
    const { data, error } = await supabase
      .from('texts')
      .select('*')
      .eq('id', textId)
      .single();

    if (error) {
      console.error('Error fetching text:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error in getTextById:', error);
    return null;
  }
};

/**
 * Create text
 */
export const createText = async (userId, textData) => {
  try {
    const { data, error } = await supabase
      .from('texts')
      .insert({
        owner_id: userId,
        ...textData
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating text:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error in createText:', error);
    return null;
  }
};

/**
 * Update text
 */
export const updateText = async (textId, updates) => {
  try {
    const { data, error } = await supabase
      .from('texts')
      .update(updates)
      .eq('id', textId)
      .select()
      .single();

    if (error) {
      console.error('Error updating text:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error in updateText:', error);
    return null;
  }
};

/**
 * Delete text
 */
export const deleteText = async (textId) => {
  try {
    const { error } = await supabase
      .from('texts')
      .delete()
      .eq('id', textId);

    if (error) {
      console.error('Error deleting text:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in deleteText:', error);
    return false;
  }
};
