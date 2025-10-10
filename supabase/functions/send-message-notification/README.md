# Send Message Notification Edge Function

This Edge Function sends push notifications when new networking messages are created.

## Purpose

- Sends push notifications via Expo Push API
- Called automatically by database trigger on message insert
- Handles recipient lookup, token validation, and notification preferences

## Deployment

```bash
# Deploy this function
supabase functions deploy send-message-notification

# View logs
supabase functions logs send-message-notification
```

## Environment Variables

The function automatically has access to:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access

These are provided by Supabase automatically.

## Request Format

```json
{
  "conversationId": "uuid",
  "senderId": "uuid",
  "content": "Message text"
}
```

## Response Format

Success:
```json
{
  "success": true,
  "sent": 2,
  "result": { ... }
}
```

Error:
```json
{
  "error": "Error message",
  "details": "..."
}
```

## Testing

Test the function locally:

```bash
# Start local Supabase
supabase start

# Serve the function locally
supabase functions serve send-message-notification

# Test with curl
curl -X POST http://localhost:54321/functions/v1/send-message-notification \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test-id",
    "senderId": "test-sender",
    "content": "Test message"
  }'
```

## How It Works

1. Receives notification request from database trigger
2. Fetches conversation to determine recipient
3. Gets sender's profile for display name
4. Checks recipient's notification preferences
5. Fetches active push tokens for recipient
6. Sends push notification via Expo Push API
7. Returns success/failure status

## Error Handling

- Returns 404 if conversation not found
- Returns 200 with message if notifications disabled
- Returns 200 with message if no tokens found
- Logs errors but doesn't fail the message insert
