# Networking Chat Issues - Troubleshooting Guide

## Issues Identified

1. **Names showing as "User" instead of actual names**
2. **Chat title showing "Connection" instead of user name**
3. **Conversation page grayed out with no input area**

## Root Causes & Fixes Applied

### 1. Profile Data Access Issue

**Problem**: The networking service tries to fetch user names from the `profiles` table, but RLS policies may be preventing access to other users' profile data.

**Fix Applied**:
- Added RLS policy in `fix_networking_rls_policies.sql` to allow matched users to see each other's basic profile info
- Changed `.single()` to `.maybeSingle()` to handle missing data gracefully
- Added debugging logs to see what data is being fetched

### 2. Chat UI Issues

**Problem**: The networking chat screen was missing proper styling and had TypeScript errors.

**Fix Applied**:
- Fixed TypeScript errors with IMessage interface
- Added proper chat container styling
- Removed problematic listViewProps

## Steps to Resolve

### Step 1: Run Database Migration
Run the updated `fix_networking_rls_policies.sql` file in your Supabase SQL editor:

```sql
-- This will add the RLS policy to allow matched users to see each other's profiles
```

### Step 2: Check Profile Table Structure
Verify your `profiles` table exists and has the expected structure:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';
```

Expected columns:
- `id` (UUID, references auth.users)
- `full_name` (TEXT)
- `avatar_url` (TEXT, optional)

### Step 3: Test Profile Access
Test if users can see each other's profiles when matched:

```sql
-- As a matched user, try to select another user's profile
SELECT id, full_name FROM profiles WHERE id = 'other-user-uuid';
```

### Step 4: Check Console Logs
Look for these debug messages in your app console:
- "Loading header for conversation: [id]"
- "Conversation info: [object]"
- "Profile data for user [id]: [object]"
- "Profile fetch error for user [id]: [error]"

## Alternative Solutions

If the profile access issue persists, we can:

### Option A: Use Auth Metadata
Store user names in Supabase Auth user metadata instead of a separate profiles table.

### Option B: Create a Public User Info Table
Create a separate table for public user information that's accessible to matched users.

### Option C: Use User IDs as Display Names
Fall back to showing user IDs or generated names when profile data isn't accessible.

## Testing Checklist

- [ ] Can create matches between users
- [ ] Match cards show real user names (not "User")
- [ ] Communication styles appear when available
- [ ] Accepting a match navigates to chat
- [ ] Chat title shows the other user's name
- [ ] Chat input area is visible and functional
- [ ] Messages send and appear for both users
- [ ] AI icebreaker appears as system message

## Debug Commands

Run these in your browser console to debug:

```javascript
// Check current user
console.log('Current user:', user);

// Check conversation ID
console.log('Conversation ID:', conversationId);

// Check if profiles table is accessible
// (This would be in a Supabase function or SQL query)
```

## Next Steps

1. Run the database migration
2. Test with two different user accounts
3. Check console logs for any errors
4. Report back with specific error messages if issues persist

The debugging logs I added will help identify exactly where the data retrieval is failing.
