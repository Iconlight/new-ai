import { supabase } from './supabase';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Basic runtime validation for Expo push token
const isExpoPushToken = (token: string) => token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');

export const sendPushToUser = async (userId: string, message: PushMessage): Promise<{ success: boolean; sent: number; errors?: any[] }> => {
  try {
    // Fetch active tokens for the user
    const { data: tokens, error } = await supabase
      .from('user_push_tokens')
      .select('id, push_token, device_type, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('[push] Failed to load user tokens:', error);
      return { success: false, sent: 0, errors: [error] };
    }

    const validTokens = (tokens || []).map(t => t.push_token).filter((t): t is string => !!t && isExpoPushToken(t));
    if (validTokens.length === 0) {
      console.log(`[push] No valid active tokens for user ${userId}`);
      return { success: true, sent: 0 };
    }

    // Expo recommends batching up to 100 messages per request
    const chunks: string[][] = [];
    for (let i = 0; i < validTokens.length; i += 100) {
      chunks.push(validTokens.slice(i, i + 100));
    }

    const errors: any[] = [];
    let sentCount = 0;

    for (const chunk of chunks) {
      const payload = chunk.map(token => ({
        to: token,
        title: message.title,
        body: message.body,
        data: message.data || {},
        sound: message.sound ?? 'default',
        priority: message.priority ?? 'high',
      }));

      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[push] Expo push send failed:', response.status, text);
        errors.push({ status: response.status, message: text });
        continue;
      }

      const result = await response.json();
      // Result contains tickets; for now, count successful tickets
      const tickets = Array.isArray(result?.data) ? result.data : [];
      sentCount += tickets.length;

      // Handle any immediate errors per ticket
      tickets.forEach((t: any) => {
        if (t?.status === 'error') {
          errors.push(t);
        }
      });
    }

    return { success: errors.length === 0, sent: sentCount, errors: errors.length ? errors : undefined };
  } catch (e) {
    console.error('[push] Unexpected error sending push:', e);
    return { success: false, sent: 0, errors: [e] };
  }
};
