# Supabase Setup Guide

Your DRJHA app is now configured to use Supabase instead of MongoDB. Follow these steps to get it working:

## Step 1: Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Click "Sign Up" and create an account
3. Create a new project

## Step 2: Get Your Credentials
Once your project is created:

1. Go to **Settings → API** (left sidebar)
2. Copy these values:
   - **Project URL** (under "Project Settings")
   - **anon public key** (under "API keys")
   - **service_role key** (under "API keys")

## Step 3: Update `.env` File
Edit your `.env` file and replace with your actual credentials:

```env
# Supabase URLs and Keys
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here

# Backend keys (from same Settings → API page)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Keep your other API keys
VITE_GOOGLE_API_KEY=your-google-api-key
VITE_MISTRAL_API_KEY=your-mistral-api-key

# JWT Secret (generate something random)
JWT_SECRET=your-super-secret-jwt-key-12345
```

## Step 4: Run Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy-paste the entire contents of `supabase/schema.sql` from your project
4. Click **Run**

This creates your database tables for:
- `profiles` (user data)
- `texts` (uploaded documents)

## Step 5: Test Authentication
Now you should be able to:
- ✅ Register a new account
- ✅ Login with your email/password
- ✅ Upload texts
- ✅ Generate quizzes

## Step 6: Enable Email Verification (Optional)
In Supabase:
1. Go to **Authentication → Providers → Email**
2. Toggle "Confirm email" if you want email verification
3. Configure email templates if desired

## Troubleshooting

### "Supabase credentials not configured"
- Make sure you added `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`
- Restart your dev server after updating `.env`

### "Invalid credentials" on login
- Double-check your credentials in `.env`
- Make sure the email/password was registered in Supabase

### Schema not created
- Check that the SQL ran without errors in the SQL Editor
- Verify tables exist under **Database → Tables**

### Still need MongoDB?
If you want to keep MongoDB as fallback or additional storage:
- The app will still work with MongoDB if you add `MONGODB_URI` to `.env`
- Supabase takes priority if both are configured

## Files Modified
- `.env` - Added Supabase credentials
- `server/config/supabase.js` - New Supabase backend client
- `server/config/database.js` - Updated to use Supabase
- `server/routes/auth.js` - Updated to Supabase authentication
- `src/services/supabaseClient.js` - New frontend Supabase client

## Next Steps
1. Get your Supabase credentials
2. Update `.env` file
3. Run the SQL schema
4. Test registration and login
5. Try uploading a text and generating a quiz!
