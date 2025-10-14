# Google Sign-In Onboarding Flow ✅

## Confirmation

**Yes, Google sign-up users ARE properly prompted to select interests!**

The authentication flow is already correctly implemented to ensure **all users** (email/password AND Google OAuth) go through onboarding if they haven't selected interests.

---

## How It Works

### Authentication Flow for Google Sign-In

#### 1. User Signs In with Google

```typescript
// User clicks "Sign in with Google"
signInWithGoogle() → Opens Google OAuth flow
```

#### 2. Auth State Changes

```typescript
// Supabase detects new session
onAuthStateChange(event: 'SIGNED_IN', session)
  ↓
fetchUserProfile(session.user)
```

#### 3. Profile Check/Creation

**Scenario A: First-Time Google User (No Profile)**

```typescript
// Profile doesn't exist (error code: PGRST116)
if (error.code === 'PGRST116') {
  // Create profile from Google metadata
  await supabase.from('profiles').insert({
    id: authUser.id,
    email: authUser.email,
    full_name: authUser.user_metadata?.name,
    avatar_url: authUser.user_metadata?.picture,
  });
  
  // Check onboarding status
  const needsOnboarding = await checkOnboardingStatus();
  setNeedsOnboarding(needsOnboarding);  // Will be TRUE (no interests yet)
}
```

**Scenario B: Returning Google User (Has Profile)**

```typescript
// Profile exists
if (data) {
  setUser(data);
  
  // Check if user has interests
  const needsOnboarding = await checkOnboardingStatus();
  setNeedsOnboarding(needsOnboarding);  // TRUE if no interests, FALSE if has interests
}
```

#### 4. Onboarding Status Check

```typescript
const checkOnboardingStatus = async (): Promise<boolean> => {
  // Query user_interests table
  const { data } = await supabase
    .from('user_interests')
    .select('id')
    .eq('user_id', session.user.id)
    .limit(1);

  // User needs onboarding if they have NO interests
  const needsOnboarding = !data || data.length === 0;
  setNeedsOnboarding(needsOnboarding);
  return needsOnboarding;
};
```

#### 5. Routing Decision

```typescript
// app/index.tsx
useEffect(() => {
  if (!loading && session) {
    if (needsOnboarding) {
      // NO interests → Go to onboarding
      router.replace('/onboarding');
    } else {
      // HAS interests → Go to discover
      router.replace('/discover');
    }
  }
}, [session, loading, needsOnboarding]);
```

---

## Complete Flow Diagram

### First-Time Google User

```
User clicks "Sign in with Google"
  ↓
Google OAuth flow
  ↓
Supabase creates auth user
  ↓
onAuthStateChange triggered
  ↓
fetchUserProfile(authUser)
  ↓
Profile NOT found (PGRST116 error)
  ↓
Create profile from Google metadata
  - full_name: Google name
  - avatar_url: Google picture
  - email: Google email
  ↓
checkOnboardingStatus()
  ↓
Query user_interests table
  ↓
No interests found
  ↓
setNeedsOnboarding(TRUE)
  ↓
app/index.tsx checks needsOnboarding
  ↓
needsOnboarding === TRUE
  ↓
router.replace('/onboarding')
  ↓
User selects interests
  ↓
Interests saved to user_interests table
  ↓
router.push('/discover')
  ↓
✅ User can now use the app
```

### Returning Google User (Has Interests)

```
User clicks "Sign in with Google"
  ↓
Google OAuth flow
  ↓
onAuthStateChange triggered
  ↓
fetchUserProfile(authUser)
  ↓
Profile found
  ↓
setUser(profile)
  ↓
checkOnboardingStatus()
  ↓
Query user_interests table
  ↓
Interests found
  ↓
setNeedsOnboarding(FALSE)
  ↓
app/index.tsx checks needsOnboarding
  ↓
needsOnboarding === FALSE
  ↓
router.replace('/discover')
  ↓
✅ User goes directly to discover
```

### Returning Google User (No Interests - Edge Case)

```
User signed in before but never completed onboarding
  ↓
Google OAuth flow
  ↓
fetchUserProfile(authUser)
  ↓
Profile found
  ↓
checkOnboardingStatus()
  ↓
Query user_interests table
  ↓
No interests found
  ↓
setNeedsOnboarding(TRUE)
  ↓
router.replace('/onboarding')
  ↓
✅ User is prompted to select interests
```

---

## Key Implementation Details

### 1. Default State

```typescript
const [needsOnboarding, setNeedsOnboarding] = useState(true);
```

**Why default to `true`?**
- Prevents users from accessing the app before onboarding check completes
- Safe default: assume they need onboarding until proven otherwise
- Only set to `false` after confirming they have interests

### 2. Onboarding Check Always Runs

```typescript
// For NEW Google users (after profile creation)
const needsOnboarding = await checkOnboardingStatus();
setNeedsOnboarding(needsOnboarding);

// For EXISTING users (after profile fetch)
const needsOnboarding = await checkOnboardingStatus();
setNeedsOnboarding(needsOnboarding);
```

**Result**: Every user, regardless of sign-in method, gets checked

### 3. Profile Creation from Google Metadata

```typescript
const fullName = authUser.user_metadata?.full_name || 
                authUser.user_metadata?.name || 
                authUser.email?.split('@')[0] || 
                'User';

await supabase.from('profiles').insert({
  id: authUser.id,
  email: authUser.email,
  full_name: fullName,
  avatar_url: authUser.user_metadata?.avatar_url || 
              authUser.user_metadata?.picture,
});
```

**Google provides**:
- `user_metadata.name` → User's full name
- `user_metadata.picture` → Profile picture URL
- `email` → Email address

### 4. Routing Logic

```typescript
if (!loading && !hasRedirected.current) {
  if (session) {
    if (needsOnboarding) {
      router.replace('/onboarding');  // ← Google users without interests go here
    } else {
      router.replace('/discover');
    }
  } else {
    router.replace('/(auth)');
  }
}
```

---

## Edge Cases Handled

### 1. ✅ First-Time Google User
- Profile created automatically
- Onboarding check runs
- User redirected to onboarding
- **Result**: User selects interests before accessing app

### 2. ✅ Returning Google User with Interests
- Profile exists
- Onboarding check finds interests
- User redirected to discover
- **Result**: User goes directly to app

### 3. ✅ Returning Google User without Interests
- Profile exists (signed in before)
- Onboarding check finds NO interests
- User redirected to onboarding
- **Result**: User must select interests

### 4. ✅ Profile Query Timeout
```typescript
if (error.code === 'TIMEOUT') {
  // Set minimal user data from auth metadata
  const minimalUser = { /* ... */ };
  setUser(minimalUser);
  
  // Still try to check onboarding status
  const needsOnboarding = await checkOnboardingStatus();
  setNeedsOnboarding(needsOnboarding);
}
```
- **Result**: Even if profile query times out, onboarding check still runs

---

## Testing Scenarios

### Test 1: New Google User
1. Clear app data
2. Sign in with Google (first time)
3. **Expected**: Redirected to onboarding page
4. Select interests
5. **Expected**: Redirected to discover page

### Test 2: Returning Google User (Has Interests)
1. Sign in with Google (already has interests)
2. **Expected**: Redirected directly to discover page

### Test 3: Returning Google User (No Interests)
1. Sign in with Google (profile exists but no interests)
2. **Expected**: Redirected to onboarding page
3. Select interests
4. **Expected**: Redirected to discover page

### Test 4: Email/Password User (Comparison)
1. Sign up with email/password
2. **Expected**: Redirected to onboarding page
3. Select interests
4. **Expected**: Redirected to discover page

---

## Files Involved

### 1. `src/contexts/AuthContext.tsx`
- ✅ `needsOnboarding` defaults to `true`
- ✅ `checkOnboardingStatus()` queries `user_interests` table
- ✅ `fetchUserProfile()` creates profile for new Google users
- ✅ `fetchUserProfile()` always calls `checkOnboardingStatus()`

### 2. `app/index.tsx`
- ✅ Checks `needsOnboarding` state
- ✅ Routes to `/onboarding` if `needsOnboarding === true`
- ✅ Routes to `/discover` if `needsOnboarding === false`

### 3. `app/onboarding.tsx`
- ✅ Allows user to select interests
- ✅ Saves interests to `user_interests` table
- ✅ Redirects to `/discover` after saving

---

## Summary

### Question
> Have you ensured that even if someone signs up with Google and does not have interests they will be prompted first to select interests?

### Answer
**YES! ✅**

The flow is already correctly implemented:

1. **Google sign-in creates profile** (if first time)
2. **Onboarding check ALWAYS runs** (for all users)
3. **No interests = redirect to onboarding** (regardless of sign-in method)
4. **Has interests = redirect to discover** (skip onboarding)

### Key Points
- ✅ **All users checked** - Email/password AND Google OAuth
- ✅ **Default to onboarding** - `needsOnboarding` starts as `true`
- ✅ **Database-driven** - Checks `user_interests` table
- ✅ **Handles edge cases** - Timeouts, missing profiles, etc.

**Google users are treated exactly the same as email/password users when it comes to onboarding!** 🎉
