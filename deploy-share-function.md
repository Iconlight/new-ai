# Deploy Share Function - Step by Step

## Current Issue
You're getting `{"code":401,"message":"Missing authorization header"}` because the Edge Function on Supabase is still running the OLD version that uses `SUPABASE_ANON_KEY`.

## Solution
Deploy the updated Edge Function that uses `SUPABASE_SERVICE_ROLE_KEY`.

---

## Step 1: Check if Supabase CLI is Installed

Open PowerShell/Terminal and run:
```bash
supabase --version
```

**If not installed**, install it:
```bash
npm install -g supabase
```

---

## Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window. Login with your Supabase account.

---

## Step 3: Link to Your Project

```bash
cd c:\Users\Ariel\Documents\new-ai
supabase link --project-ref xqwnwuydzkriwxxsraxm
```

When prompted, enter your database password (from Supabase dashboard).

---

## Step 4: Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/xqwnwuydzkriwxxsraxm/settings/api
2. Scroll to "Project API keys"
3. Copy the **`service_role`** key (the long one, NOT the anon key)
4. Keep this window open - you'll need it in the next step

---

## Step 5: Set Environment Variables

Run these commands (replace `your_service_role_key_here` with the actual key from Step 4):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

supabase secrets set SUPABASE_URL=https://xqwnwuydzkriwxxsraxm.supabase.co

supabase secrets set APP_SCHEME=proactiveai
```

---

## Step 6: Deploy the Edge Function

```bash
supabase functions deploy share
```

You should see:
```
Deploying Function share...
Function share deployed successfully!
URL: https://xqwnwuydzkriwxxsraxm.supabase.co/functions/v1/share
```

---

## Step 7: Test the Fix

1. **Generate a new share link** from your app (share a topic from Discovery page)
2. **Click the link** in a browser
3. **Expected result**: You should see a nice HTML page with:
   - ProactiveAI branding
   - The topic title
   - The topic description
   - "Open in App" button
   - NOT a JSON error!

4. **Share the link** in WhatsApp/iMessage/Slack
5. **Expected result**: A preview card should appear with the topic info

---

## Troubleshooting

### "supabase: command not found"
Install the CLI:
```bash
npm install -g supabase
```

### "Failed to link project"
Make sure you're using the correct project ref: `xqwnwuydzkriwxxsraxm`

### Still getting 401 error after deployment
1. Check if secrets were set:
   ```bash
   supabase secrets list
   ```
   You should see `SUPABASE_SERVICE_ROLE_KEY` in the list

2. Check Edge Function logs:
   ```bash
   supabase functions logs share --tail
   ```

3. Make sure you deployed AFTER setting the secrets

### "Cannot find service_role key"
The service role key is in your Supabase dashboard:
- Go to: Settings → API
- Look for "Project API keys"
- Copy the `service_role` key (NOT the `anon` key)

---

## Quick Command Reference

```bash
# Check if CLI is installed
supabase --version

# Login
supabase login

# Link project
supabase link --project-ref xqwnwuydzkriwxxsraxm

# Set secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key_here
supabase secrets set SUPABASE_URL=https://xqwnwuydzkriwxxsraxm.supabase.co

# Deploy
supabase functions deploy share

# Check logs
supabase functions logs share --tail

# List secrets
supabase secrets list
```

---

## Why This Fixes the Issue

**Before (causing 401 error):**
```typescript
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {...});
```
❌ Anon key requires user authentication → 401 error for public links

**After (fixes the issue):**
```typescript
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {...});
```
✅ Service role key bypasses RLS → public links work without authentication

---

**Need Help?** Check the logs: `supabase functions logs share --tail`
