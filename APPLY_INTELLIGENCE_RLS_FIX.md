# Fix Networking Intelligence RLS Policies

## Problem
The AI can't access matched users' data because RLS (Row Level Security) policies are blocking access to:
- User conversation patterns
- User interests  
- User messages
- User profiles (names)

## Solution
Run the SQL migration that updates RLS policies to allow matched users to see each other's data.

## Steps to Apply the Fix

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Run the Migration**
   - Open the file: `src/database/migrations/fix_networking_intelligence_rls.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Success**
   - You should see a success message at the bottom
   - Look for: "✅ Networking Intelligence RLS policies updated successfully!"

### Option 2: Supabase CLI

```bash
# Make sure you're in the project directory
cd c:\Users\Ariel\Documents\new-ai

# Run the migration
supabase db push --include-all
```

## What This Migration Does

### 1. User Conversation Patterns
**Before:** Users can only see their own patterns  
**After:** Users can see patterns of people they're matched with

### 2. User Interests
**Before:** Users can only see their own interests  
**After:** Users can see interests of people they're matched with

### 3. Messages
**Before:** Users can only see messages in their own chats  
**After:** Users can see messages from matched users' chats (for AI analysis only)

### 4. Profiles
**Before:** May be blocked by RLS  
**After:** Matched users can see each other's names and avatars

### 5. Intelligence Chats
**Before:** May not have proper RLS  
**After:** Users can create, view, update, and delete their own intelligence chats

## Testing After Migration

1. **Refresh the app** (hard refresh: Ctrl+Shift+R)

2. **Click "Ask AI About Them"** on a match

3. **Check the console logs** - you should see:
   ```
   [IntelligenceChat] Profile data: { full_name: "John Doe", ... }
   [NetworkingIntelligence] Pattern data: Found
   [NetworkingIntelligence] Interests fetched: 5 ["technology", "science", ...]
   [NetworkingIntelligence] Messages fetched: 42
   ```

4. **Check the header** - should show the actual user's name instead of "User"

5. **Ask the AI a question** like:
   - "What are their interests?"
   - "What topics do they like to discuss?"
   - "What's their communication style?"

6. **The AI should now respond with actual data** instead of saying it doesn't have access

## Privacy & Security Notes

✅ **What users CAN see about matched users:**
- Communication style and patterns
- Interests and topics
- General conversation themes
- Profile name and avatar

❌ **What users CANNOT see:**
- Exact message content (only themes/patterns)
- Personal information (location, contact details)
- Private/sensitive conversations
- Unmatched users' data

The AI is instructed to:
- Summarize themes, not quote exact messages
- Respect privacy boundaries
- Redirect sensitive questions to direct connection
- Focus on intellectual compatibility

## Rollback (If Needed)

If something goes wrong, you can rollback by running:

```sql
-- Restore restrictive policies
DROP POLICY IF EXISTS "Users can view matched users patterns for intelligence" ON user_conversation_patterns;
CREATE POLICY "Users can view own conversation patterns" ON user_conversation_patterns
  FOR SELECT USING (auth.uid() = user_id);

-- Repeat for other tables as needed
```

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Check the Supabase logs in the dashboard
3. Verify the migration ran successfully
4. Make sure you're testing with actual matched users (not just any user)
