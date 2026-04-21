import express from 'express';
import { supabase, getUserByEmail, createUserProfile, getUserById } from '../config/supabase.js';
import { isSupabaseConnected } from '../config/supabase.js';

const router = express.Router();

// Fallback in-memory auth when Supabase is not connected
const fallbackUsers = new Map();

/**
 * Register new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check if Supabase is connected
    if (!isSupabaseConnected()) {
      // Fallback: in-memory storage
      if (fallbackUsers.has(email)) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const userId = `user_${Date.now()}`;
      const user = {
        _id: userId,
        username,
        email,
        password, // Note: NOT hashed in fallback
        avatar: '👧',
        level: 1,
        xp: 0,
        badges: [],
        stats: {
          readingTime: 0,
          quizzesPassed: 0,
          bestStreak: 0
        }
      };
      fallbackUsers.set(email, user);

      return res.status(201).json({
        message: 'User registered successfully (offline mode)',
        user: {
          id: userId,
          username,
          email,
          level: 1,
          xp: 0,
          avatar: '👧'
        }
      });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    // Create user profile
    const profile = await createUserProfile(authData.user.id, email, username);

    if (!profile) {
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Generate session token
    const { data: sessionData } = await supabase.auth.admin.createSession(authData.user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        level: profile.level,
        xp: profile.xp,
        avatar: profile.avatar
      },
      token: sessionData?.session?.access_token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if Supabase is connected
    if (!isSupabaseConnected()) {
      // Fallback: check in-memory users
      const user = fallbackUsers.get(email);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      return res.json({
        message: 'Login successful (offline mode)',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          level: user.level,
          xp: user.xp,
          avatar: user.avatar
        },
        token: `offline_token_${user._id}`
      });
    }

    // Login via Supabase
    const { data, error } = await supabase.auth.admin.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get user profile
    const profile = await getUserById(data.user.id);

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        level: profile.level,
        xp: profile.xp,
        avatar: profile.avatar,
        stats: profile.stats,
        badges: profile.badges
      },
      token: data.session.access_token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user (via token)
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!isSupabaseConnected()) {
      return res.status(503).json({ error: 'Service unavailable' });
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user profile
    const profile = await getUserById(data.user.id);

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        level: profile.level,
        xp: profile.xp,
        avatar: profile.avatar,
        stats: profile.stats,
        badges: profile.badges
      }
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Logout (client-side removes token)
 */
router.post('/logout', async (req, res) => {
  // Token removal is handled on client side
  res.json({ message: 'Logged out successfully' });
});

export default router;
        username: user.username,
        email: user.email,
        level: user.level,
        xp: user.xp,
        avatar: user.avatar,
        stats: user.stats,
        badges: user.badges
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

