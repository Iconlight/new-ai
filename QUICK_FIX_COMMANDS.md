# Quick Fix Commands - Run These Now

## 🚨 IMMEDIATE FIXES (Run in Order)

### 1. **Clear Metro Cache** (Most Important)
```bash
# Stop the current expo server (Ctrl+C)
# Then run:
npx expo start --clear
```

### 2. **Check Environment File**
Make sure you have a `.env` file in the project root with:
```env
EXPO_PUBLIC_SUPABASE_URL=https://xqwnwuydzkriwxxsraxm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxd253dXlkemtyeHd4eHNyYXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTQyNzQsImV4cCI6MjA3MzQ5MDI3NH0.GFmQgGbuzF7ZLDccSdxUTcBSKOJ-k7IdmM_diOgXZ4s
EXPO_PUBLIC_OPENAI_API_KEY=your_actual_openai_key_here
EXPO_PUBLIC_OPENROUTER_API_KEY=your_actual_openrouter_key_here
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_actual_anthropic_key_here
EXPO_PUBLIC_EXPO_PROJECT_ID=your_expo_project_id_here
```

### 3. **Alternative Cache Clear** (If step 1 doesn't work)
```bash
# Stop expo server first (Ctrl+C)
rm -rf node_modules/.cache
rm -rf .expo
npx expo start
```

### 4. **Check if App Loads**
- Open your device/emulator
- The app should now load without the Supabase errors
- Most "missing export" warnings should disappear

---

## 🔍 WHAT THESE COMMANDS DO

### `npx expo start --clear`
- Clears Metro bundler cache
- Fixes false "missing export" warnings
- Forces fresh compilation of all files
- Usually resolves 80% of development issues

### Environment File Check
- Ensures Supabase can connect to database
- Fixes the "Missing Supabase configuration" error
- Replace placeholder values with your actual API keys

---

## ✅ SUCCESS INDICATORS

After running these commands, you should see:
- ✅ App loads without crashing
- ✅ No "Missing Supabase configuration" errors
- ✅ Fewer or no "missing export" warnings
- ✅ Can navigate between screens

---

## 🚨 IF STILL NOT WORKING

### Check Environment Variables Are Loading:
Add this temporary debug code to `src/services/supabase.ts` (line 6):
```typescript
console.log('🔍 Debug - Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('🔍 Debug - Supabase Key:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
```

### If Variables Are Still Undefined:
1. Make sure `.env` file is in the ROOT directory (same level as `package.json`)
2. Make sure there are NO SPACES around the `=` sign
3. Restart the entire terminal/command prompt
4. Try `npx expo start --clear` again

---

## 📱 TESTING CHECKLIST

After fixes:
- [ ] App opens without crashing
- [ ] Can see the auth screen or discover screen
- [ ] No red error screens
- [ ] Console shows successful Supabase connection
- [ ] Can navigate between screens

---

**Run the commands above and let me know the results!** 🚀
