# How Notifications Work in ProactiveAI

## Overview

The app uses **two types of notifications** to ensure users always receive message alerts:

1. **Remote Push Notifications** (app closed/background) - via Edge Function
2. **Local Notifications** (app open/foreground) - via realtime subscription

## Notification Flow

### When App is CLOSED or in BACKGROUND

```
User A sends message
    ↓
Message inserted into database
    ↓
Postgres trigger fires automatically
    ↓
Edge Function called via pg_net
    ↓
Edge Function sends to Expo Push API
    ↓
Expo delivers to User B's device
    ↓
User B sees notification (even if app is closed) ✅
    ↓
User B taps notification
    ↓
App opens to the chat screen
```

**Key Points:**
- ✅ Works when app is completely closed
- ✅ Works when app is in background
- ✅ Reliable - handled by server, not client
- ✅ No dependency on sender's app state

### When App is OPEN (Foreground)

```
User A sends message
    ↓
Message inserted into database
    ↓
User B's app receives via Realtime subscription
    ↓
Local notification scheduled immediately
    ↓
User B sees notification banner
    ↓
User B taps notification
    ↓
Chat screen opens/focuses
```

**Key Points:**
- ✅ Instant notification (no server round-trip)
- ✅ Works even if remote push fails
- ✅ Provides redundancy

## Why Both?

| Scenario | Remote Push | Local Notification |
|----------|-------------|-------------------|
| App closed | ✅ Works | ❌ Can't work |
| App background | ✅ Works | ⚠️ May work |
| App foreground | ✅ Works | ✅ Works (faster) |
| Sender on web | ✅ Works | ✅ Works |
| Sender offline | ✅ Works | ✅ Works |

**Result:** Users always get notifications, regardless of app state! 🎉

## Notification Icon Configuration

### Android
The notification icon is configured in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#8B5CF6"
        }
      ]
    ]
  }
}
```

**Requirements for Android notification icon:**
- Must be a **transparent PNG** (no background)
- Should be **white/light colored** (Android applies color tint)
- Recommended size: **96x96px** (xxxhdpi)
- Stored in: `assets/images/notification-icon.png`

### iOS
iOS uses the app icon automatically. No separate notification icon needed.

## Building for Production

### ⚠️ Important: Expo Go Limitation

**Remote push notifications DO NOT work in Expo Go on SDK 54.**

You must build with:
- **EAS Dev Client** (for development)
- **Production build** (for release)

### Build Commands

```bash
# Development build (recommended for testing)
eas build --profile development --platform android
eas build --profile development --platform ios

# Production build
eas build --profile production --platform android
eas build --profile production --platform ios
```

### Install Dev Client

After building, install the `.apk` (Android) or `.ipa` (iOS) on your device. This build includes:
- ✅ Full push notification support
- ✅ Proper notification icons
- ✅ Deep linking
- ✅ All native features

## Testing Notifications

### Test Remote Push (App Closed)

1. Build and install Dev Client or Production build
2. Close the app completely
3. Have another user send you a message
4. You should receive a notification ✅
5. Tap notification → app opens to chat

### Test Local Notification (App Open)

1. Open the app
2. Navigate to a chat screen
3. Have another user send you a message
4. You should see a notification banner ✅
5. Tap notification → chat focuses

### Verify Edge Function

Check Edge Function logs in Supabase Dashboard:
- Go to **Edge Functions** → `send-message-notification` → **Logs**
- You should see successful push sends
- Look for: `"Push sent successfully"`

### Verify Push Tokens

Check that users have valid push tokens:

```sql
SELECT 
  user_id, 
  push_token, 
  device_type, 
  is_active,
  updated_at
FROM user_push_tokens
WHERE is_active = true
ORDER BY updated_at DESC;
```

Valid tokens start with: `ExponentPushToken[` or `ExpoPushToken[`

## Troubleshooting

### No notifications when app is closed

**Cause:** Running in Expo Go
**Solution:** Build with EAS Dev Client or Production build

### Notification icon not showing (Android)

**Cause:** Icon not configured or wrong format
**Solution:** 
1. Ensure `notification-icon.png` is transparent PNG
2. Rebuild the app after updating `app.json`
3. Icon changes require a new build (not just reload)

### Notifications work in foreground but not background

**Cause:** Missing notification permissions
**Solution:**
```typescript
// Check permissions
const { status } = await Notifications.getPermissionsAsync();
if (status !== 'granted') {
  await Notifications.requestPermissionsAsync();
}
```

### Edge Function not being called

**Cause:** Trigger not configured or pg_net not enabled
**Solution:**
1. Verify pg_net is enabled: Dashboard → Database → Extensions
2. Check trigger exists:
   ```sql
   SELECT * FROM pg_trigger 
   WHERE tgname = 'trigger_notify_new_networking_message';
   ```
3. Check Edge Function config:
   ```sql
   SELECT * FROM edge_function_config 
   WHERE function_name = 'send-message-notification';
   ```

### Notifications received but don't open chat

**Cause:** Deep linking not configured
**Solution:** Ensure `scheme: "proactiveai"` is in `app.json` and rebuild

## Notification Data Structure

### Remote Push Notification

```json
{
  "to": "ExponentPushToken[...]",
  "title": "💬 John Doe",
  "body": "Hey, how are you?",
  "data": {
    "type": "networking_message",
    "conversationId": "uuid-here",
    "senderId": "uuid-here",
    "senderName": "John Doe",
    "deepLink": "proactiveai://networking/chat/uuid?name=John%20Doe"
  },
  "sound": "default",
  "priority": "high",
  "channelId": "default",
  "android": {
    "channelId": "default",
    "color": "#8B5CF6",
    "priority": "high"
  },
  "ios": {
    "sound": "default",
    "_displayInForeground": true
  }
}
```

### Local Notification

```typescript
{
  content: {
    title: "💬 John Doe",
    body: "Hey, how are you?",
    data: {
      type: "networking_message",
      conversationId: "uuid-here",
      senderName: "John Doe"
    },
    sound: "default",
    color: "#8B5CF6" // Android only
  },
  trigger: null // Immediate
}
```

## Notification Handling

The app handles notification taps in `src/contexts/NotificationContext.tsx`:

```typescript
Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification?.request?.content?.data;
  
  if (data?.type === 'networking_message') {
    router.push({
      pathname: `/networking/chat/${data.conversationId}`,
      params: { name: data.senderName || 'User' }
    });
  }
});
```

## Summary

✅ **Remote push** ensures notifications when app is closed
✅ **Local notifications** provide instant alerts when app is open
✅ **Edge Function** makes remote push reliable and independent
✅ **Proper icon configuration** ensures branded notifications
✅ **Deep linking** opens the correct chat on tap

Users will receive notifications in all scenarios! 🚀
