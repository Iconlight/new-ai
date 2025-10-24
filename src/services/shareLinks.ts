import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

export interface SharePayload {
  itemType: 'topic';
  itemId: string;
  userId?: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  category?: string | null;
  newsContext?: { title: string; description?: string; url?: string; category?: string; content?: string };
}

function getShareBaseUrl(): string | null {
  const extra = (Constants.expoConfig as any)?.extra || {};
  // Support accidental nesting at extra.extra.shareBaseUrl as well
  const base = extra.shareBaseUrl || extra?.extra?.shareBaseUrl || process.env.EXPO_PUBLIC_SHARE_BASE_URL || null;
  if (!base) return null;
  // remove trailing slash
  return String(base).replace(/\/$/, '');
}

function randomSlug(len = 8) {
  // base36 slug from secure random
  const bytes = Crypto.getRandomBytes(8);
  return Array.from(bytes)
    .map((b) => (b % 36).toString(36))
    .join('')
    .slice(0, len);
}

export async function createShareLink(payload: SharePayload): Promise<{ url: string; slug: string } | null> {
  try {
    const slug = randomSlug(10);

    const { data, error } = await supabase
      .from('shared_links')
      .insert({
        slug,
        item_type: payload.itemType,
        item_id: payload.itemId,
        user_id: payload.userId || null,
        title: payload.title,
        description: payload.description || null,
        image_url: payload.imageUrl || null,
        source_url: payload.sourceUrl || null,
        category: payload.category || null,
        news_context: payload.newsContext || null,
      })
      .select('slug')
      .single();

    if (error || !data) {
      console.error('[ShareLinks] Error creating shared link:', error);
      return null;
    }

    const base = getShareBaseUrl();
    // Prefer public web base for rich previews; then fallback to original article; then app scheme
    // Note: base already includes '/share' path, so just append the slug
    const webUrl = base ? `${base}/${data.slug}` : (payload.sourceUrl || null);
    const url = webUrl || `${(Constants.expoConfig as any)?.scheme}://share/${data.slug}`;
    return { url, slug: data.slug };
  } catch (e) {
    console.error('[ShareLinks] Exception creating shared link:', e);
    return null;
  }
}

export async function fetchSharedLink(slug: string) {
  const { data, error } = await supabase
    .from('shared_links')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('[ShareLinks] Error fetching shared link:', error);
    return null;
  }
  return data;
}
