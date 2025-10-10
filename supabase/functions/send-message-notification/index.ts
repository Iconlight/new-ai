import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  conversationId: string;
  senderId: string;
  content: string;
}

// Basic runtime validation for Expo push token
const isExpoPushToken = (token: string) => 
  token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const payload: NotificationPayload = await req.json();
    const { conversationId, senderId, content } = payload;

    console.log('[Edge Function] Processing notification:', { conversationId, senderId });

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get conversation details to find the recipient
    const { data: conversation, error: convError } = await supabase
      .from('networking_conversations')
      .select('user_id_1, user_id_2')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[Edge Function] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine recipient (the user who is NOT the sender)
    const recipientId = conversation.user_id_1 === senderId 
      ? conversation.user_id_2 
      : conversation.user_id_1;

    console.log('[Edge Function] Recipient:', recipientId);

    // Get sender's profile for the notification
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', senderId)
      .single();

    const senderName = senderProfile?.full_name || 
                       senderProfile?.email?.split('@')[0] || 
                       'Someone';

    console.log('[Edge Function] Sender name:', senderName);

    // Check if recipient has notifications enabled
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('notification_enabled')
      .eq('user_id', recipientId)
      .maybeSingle();

    if (preferences?.notification_enabled === false) {
      console.log('[Edge Function] User has notifications disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Notifications disabled for user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active push tokens for the recipient
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('push_token, device_type')
      .eq('user_id', recipientId)
      .eq('is_active', true);

    if (tokensError || !tokens || tokens.length === 0) {
      console.log('[Edge Function] No active tokens found for user');
      return new Response(
        JSON.stringify({ success: true, message: 'No active tokens' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Edge Function] Found', tokens.length, 'tokens');

    // Filter valid Expo push tokens
    const validTokens = tokens
      .map(t => t.push_token)
      .filter((t): t is string => !!t && isExpoPushToken(t));

    if (validTokens.length === 0) {
      console.log('[Edge Function] No valid Expo tokens');
      return new Response(
        JSON.stringify({ success: true, message: 'No valid tokens' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Truncate long messages for notification
    const truncatedContent = content.length > 100
      ? content.substring(0, 97) + '...'
      : content;

    // Build deep link
    const deepLink = `proactiveai://networking/chat/${conversationId}?name=${encodeURIComponent(senderName)}`;

    // Prepare push notifications
    const notifications = validTokens.map(token => ({
      to: token,
      title: `💬 ${senderName}`,
      body: truncatedContent,
      data: {
        type: 'networking_message',
        conversationId,
        senderId,
        senderName,
        deepLink,
      },
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      // Android-specific notification styling
      android: {
        channelId: 'default',
        color: '#8B5CF6',
        priority: 'high',
        sound: 'default',
      },
      // iOS-specific notification styling
      ios: {
        sound: 'default',
        _displayInForeground: true,
      },
    }));

    // Send to Expo Push API
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notifications),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Edge Function] Expo push failed:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send push notification', details: errorText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('[Edge Function] Push sent successfully:', result);

    return new Response(
      JSON.stringify({ success: true, sent: validTokens.length, result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Edge Function] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
