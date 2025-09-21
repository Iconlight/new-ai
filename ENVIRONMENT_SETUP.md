# Environment Setup

## 🔐 Security Notice
**NEVER commit your `.env` file to GitHub!** It contains sensitive API keys that should remain private.

## Setup Instructions

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your actual API keys in `.env`:**

### Required API Keys:

#### Supabase (Database)
- Go to [supabase.com](https://supabase.com)
- Create a new project
- Get your `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from Project Settings > API

#### OpenRouter (AI)
- Go to [openrouter.ai](https://openrouter.ai)
- Create an account and get your API key
- Set `EXPO_PUBLIC_OPENROUTER_API_KEY`

#### Optional APIs:
- **News API**: Get free key from [newsapi.org](https://newsapi.org) for trending topics
- **Expo Project ID**: For push notifications (get from Expo dashboard)

## 🚨 If Your Keys Were Compromised:

1. **Immediately revoke/regenerate** all exposed API keys
2. **Update your `.env`** file with new keys
3. **Never commit the `.env`** file again (it's now in `.gitignore`)

## File Structure:
- `.env` - Your actual keys (NEVER commit this)
- `.env.example` - Template showing required variables (safe to commit)
