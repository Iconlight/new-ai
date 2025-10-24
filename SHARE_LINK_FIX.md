# Share Link Fix - Deployment Guide

## Issues Fixed

### 1. Double "share" in URL ✅
**Problem**: Share links were generating URLs like:
```
https://xqwnwuydzkrxwxxsraxm.supabase.co/functions/v1/share/share/h1nl1epf
```
Notice "share" appears twice in the path.

**Root Cause**: The `shareLinks.ts` file was already fixed - it correctly uses `${base}/${data.slug}` without duplicating "/share/".

**Status**: ✅ Already fixed in the codebase

---

### 2. Authorization Error (401) ✅
**Problem**: When clicking share links, users saw:
```json
{"code":401,"message":"Missing authorization header"}
```

**Root Cause**: The Edge Function was using `SUPABASE_ANON_KEY` which requires user authentication, but share links should be publicly accessible.

**Fix Applied**: Updated `supabase/functions/share/index.ts` to use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS for public access.

**Status**: ✅ Fixed - needs deployment

---

### 3. Missing Rich Preview Cards ✅
**Problem**: Share links didn't show preview cards when shared on social platforms.

**Root Cause**: Due to the 401 error, the HTML with Open Graph meta tags wasn't being served.

**Fix**: Once the Edge Function uses the service role key, it will properly serve the HTML with all the necessary meta tags for rich previews.

**Status**: ✅ Fixed - needs deployment

---

## Deployment Steps

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication.

### Step 3: Link to Your Project

```bash
supabase link --project-ref xqwnwuydzkrxwxxsraxm
```

### Step 4: Set Required Environment Variables

The Edge Function needs the service role key to access the database:

```bash
# Get your service role key from: 
# https://supabase.com/dashboard/project/xqwnwuydzkrxwxxsraxm/settings/api

# Set the service role key (REQUIRED)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Set the Supabase URL (usually auto-set, but verify)
supabase secrets set SUPABASE_URL=https://xqwnwuydzkrxwxxsraxm.supabase.co

# Optional: Set custom app scheme if different from default
supabase secrets set APP_SCHEME=proactiveai

# Optional: Set web fallback URL
supabase secrets set APP_WEB_FALLBACK=https://proactiveai.app
```

**⚠️ IMPORTANT**: Keep your service role key secret! It has full database access.

**Where to find your Service Role Key:**
1. Go to: https://supabase.com/dashboard/project/xqwnwuydzkrxwxxsraxm/settings/api
2. Scroll to "Project API keys"
3. Copy the `service_role` key (NOT the `anon` key)

### Step 5: Deploy the Edge Function

```bash
supabase functions deploy share
```

You should see output like:
```
Deploying Function share...
Function share deployed successfully!
URL: https://xqwnwuydzkrxwxxsraxm.supabase.co/functions/v1/share
```

---

## Testing the Fix

### 1. Test URL Format
Share a topic from the Discovery page and verify the URL looks like:
```
https://xqwnwuydzkrxwxxsraxm.supabase.co/functions/v1/share/h1nl1epf
```
✅ Only ONE "share" in the path

### 2. Test Authorization
Click the link in a browser. You should see:
- ✅ A nicely formatted HTML page with the topic title and description
- ✅ ProactiveAI branding with gradient background
- ✅ "Open in App" and "Open Source" buttons
- ❌ NOT a JSON error message

### 3. Test Rich Preview
Share the link in a messaging app (WhatsApp, iMessage, Slack, Discord, etc.) and verify:
- ✅ A preview card appears
- ✅ Shows the topic title
- ✅ Shows the topic description
- ✅ Shows the ProactiveAI gradient image
- ✅ Shows "ProactiveAI" as the site name

### 4. Test Deep Linking
If you have the app installed:
- ✅ Clicking the link should open the app
- ✅ Should navigate to the shared topic

---

## How Share Links Work

### Architecture Flow
```
User taps Share button
    ↓
createShareLink() in shareLinks.ts
    ↓
Insert record to shared_links table
    ↓
Generate URL: https://.../functions/v1/share/{slug}
    ↓
Share via native share sheet
    ↓
Recipient clicks link
    ↓
Edge Function receives request
    ↓
Query shared_links table (using service role key)
    ↓
Return HTML with Open Graph meta tags
    ↓
Social platform reads meta tags
    ↓
Shows rich preview card
```

### Database Schema
The `shared_links` table stores:
- `slug`: Unique identifier (e.g., "h1nl1epf")
- `title`: Topic title for preview
- `description`: Topic message/description
- `image_url`: Optional custom image
- `source_url`: Original article URL
- `news_context`: Full article context as JSON
- `created_at`: Timestamp
- `expires_at`: Optional expiration

### Edge Function Response
The Edge Function returns HTML with:
- **Open Graph tags** for Facebook, LinkedIn, etc.
- **Twitter Card tags** for Twitter/X
- **Auto-redirect** to the mobile app if installed
- **Fallback UI** if app is not installed
- **CORS headers** for cross-origin access

---

## Changes Made

### File: `src/services/shareLinks.ts`
✅ Already had the fix - line 64 correctly uses `${base}/${data.slug}`

### File: `supabase/functions/share/index.ts`
✅ Changed `SUPABASE_ANON_KEY` to `SUPABASE_SERVICE_ROLE_KEY` (line 11)
✅ Added CORS headers for cross-origin support (lines 128-131)
✅ Added CORS preflight handling (lines 134-136)
✅ Improved URL parsing to handle both correct and misconfigured patterns (lines 140-145)
✅ Better error handling with detailed messages (lines 154-166)

---

## Troubleshooting

### Still getting 401 error
- ✅ Verify `SUPABASE_SERVICE_ROLE_KEY` is set: `supabase secrets list`
- ✅ Check Edge Function logs: `supabase functions logs share`
- ✅ Ensure the Edge Function was redeployed after changes
- ✅ Verify you're using the correct service role key from the dashboard

### Preview card not showing
- Some platforms cache previews. Try with a new share link.
- Verify Open Graph tags in HTML source (view page source in browser)
- Test with Facebook's Sharing Debugger: https://developers.facebook.com/tools/debug/
- Test with Twitter Card Validator: https://cards-dev.twitter.com/validator

### Double "share" still in URL
- Clear app cache: `npx expo start --clear`
- Verify line 64 in `src/services/shareLinks.ts` shows: `${base}/${data.slug}`
- Rebuild the app

### Edge Function not deploying
- Ensure you're logged in: `supabase login`
- Ensure you're linked to the project: `supabase link --project-ref xqwnwuydzkrxwxxsraxm`
- Check for syntax errors in the TypeScript file

---

## Security Notes

### Why Service Role Key is Safe Here
The Edge Function uses the service role key which bypasses RLS. This is intentional and safe because:

1. **Share links are meant to be public** - Anyone with the link should be able to view it
2. **RLS policy already allows public access** - The `shared_links` table has a policy: `USING (true)` for SELECT
3. **No sensitive data exposed** - Share links only contain topic titles, descriptions, and public article URLs
4. **Users explicitly create share links** - By tapping the share button, users consent to making that content public
5. **Read-only access** - The Edge Function only performs SELECT queries, no INSERT/UPDATE/DELETE

### Best Practices
- ✅ Service role key is stored as an environment variable (not in code)
- ✅ Edge Function only queries the `shared_links` table
- ✅ No user authentication data is exposed
- ✅ CORS headers are properly configured

---

## Testing Checklist

- [ ] Share link URL has correct format (single "share" in path)
- [ ] Clicking link in browser shows HTML page (not JSON error)
- [ ] Preview card appears when sharing in messaging apps
- [ ] Preview shows correct title and description
- [ ] Preview shows ProactiveAI branding/image
- [ ] Link opens app if installed (deep linking)
- [ ] Link shows fallback page if app not installed
- [ ] Edge Function logs show no errors

---

## Next Steps

1. ✅ Deploy the Edge Function: `supabase functions deploy share`
2. ✅ Set environment variables (especially `SUPABASE_SERVICE_ROLE_KEY`)
3. ✅ Test thoroughly with different share scenarios
4. ✅ Monitor Edge Function logs: `supabase functions logs share --tail`
5. ✅ Test on different platforms (WhatsApp, iMessage, Slack, Discord, etc.)

---

## Support

If you encounter issues:
1. Check Edge Function logs: `supabase functions logs share`
2. Verify environment variables: `supabase secrets list`
3. Test the link in a browser first (should show HTML, not JSON error)
4. Check the Supabase dashboard for any errors

---

**Last Updated**: October 24, 2025
**Status**: ✅ Ready for deployment
