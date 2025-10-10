import Constants from 'expo-constants';
import { getTrendingTopics } from './trending';

// Dynamically import OpenAI to avoid initialization issues
let OpenAI: any = null;
try {
  OpenAI = require('openai').default || require('openai');
} catch (error) {
  console.error('Failed to import OpenAI:', error);
}

// OpenRouter API configuration (supports many providers including DeepSeek)
const openRouterApiKey =
  Constants.expoConfig?.extra?.openRouterApiKey ||
  process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ||
  process.env.EXPO_PUBLIC_OPENAI_API_KEY; // fallback for backwards-compat

if (!openRouterApiKey) {
  throw new Error('Missing OpenRouter API key');
}

// Initialize OpenAI-compatible client with OpenRouter endpoint
let openrouter: any = null;
if (OpenAI) {
  try {
    openrouter = new OpenAI({
      apiKey: openRouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      // Required for usage in React Native / Expo environments
      dangerouslyAllowBrowser: true,
      // Optional headers recommended by OpenRouter for analytics
      defaultHeaders: {
        'HTTP-Referer': 'proactiveai://app',
        'X-Title': 'ProactiveAI',
      },
    });
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
  }
}

export interface AIResponse {
  content: string;
  error?: string;
}

export const generateAIResponse = async (
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  userInterests: string[] = [],
  newsContext?: { title: string; description?: string; url?: string; category?: string }
): Promise<AIResponse> => {
  if (!openrouter) {
    return {
      content: 'AI service is not available right now. Please try again later.',
      error: 'OpenAI client not initialized',
    };
  }

  try {
    // Extract news context from the first assistant message if not provided
    let contextInfo = newsContext;
    if (!contextInfo && messages.length > 0) {
      const firstMessage = messages.find(m => m.role === 'assistant');
      if (firstMessage?.content) {
        // Try to extract quoted title from the message
        const titleMatch = firstMessage.content.match(/"([^"]+)"/);
        if (titleMatch) {
          contextInfo = { title: titleMatch[1] };
        }
      }
    }

    const interestsContext = userInterests.length > 0 
      ? `User's interests: ${userInterests.join(', ')}.` 
      : '';

    const newsContextPrompt = contextInfo 
      ? `\n\nIMPORTANT CONTEXT: This conversation is about a specific news article/topic:
- Title: "${contextInfo.title}"
${contextInfo.description ? `- Description: ${contextInfo.description}` : ''}
${contextInfo.category ? `- Category: ${contextInfo.category}` : ''}
${contextInfo.url ? `- Source: ${contextInfo.url}` : ''}

You MUST base your responses on this specific article/topic. Do NOT use general knowledge or training data about similar topics. If the user asks about details not in the article, acknowledge that and ask them what they think or redirect to what IS in the article. Stay focused on THIS specific news story.`
      : '';

    const systemPrompt = `You are ProactiveAI, a conversational AI assistant designed to engage users in meaningful discussions about current news and topics based on their interests. ${interestsContext}

Your identity:
- Your name is "ProactiveAI" (not ChatGPT, not any other AI)
- You are a specialized news discussion assistant
- You help users explore and discuss current events

Your behavior:
- Be conversational, engaging, and thoughtful
- Ask follow-up questions to keep the conversation flowing
- Keep responses concise but informative (2-4 sentences typically)
- Show genuine interest in the user's thoughts and perspectives
- Encourage critical thinking and diverse viewpoints${newsContextPrompt}

Remember: You are ProactiveAI, and when discussing news, always stay grounded in the specific article being discussed.`;

    const completion = await openrouter.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return {
      content: completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.',
    };
  } catch (error) {
    console.error('AI Response Error:', error);
    return {
      content: 'I\'m having trouble connecting right now. Please try again later.',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const generateChatTitle = async (
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): Promise<string> => {
  if (!openrouter) {
    return 'New Conversation';
  }

  try {
    const system = `You are an assistant that generates a concise, descriptive chat title based on the conversation. 
Return only the title text, no quotes, no punctuation at the end. Keep it under 40 characters.`;

    const completion = await openrouter.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: system },
        ...messages,
        { role: 'user', content: 'Generate a short title for this conversation.' },
      ],
      max_tokens: 30,
      temperature: 0.5,
    });

    const title = completion.choices[0]?.message?.content?.trim() || 'New Conversation';
    // sanitize to single line, reasonable length
    return title.split('\n')[0].slice(0, 60);
  } catch (error) {
    console.error('Title Generation Error:', error);
    return 'New Conversation';
  }
};

export const generateProactiveConversationStarters = async (
  userInterests: string[],
  currentDate: string
): Promise<string[]> => {
  if (!openrouter) {
    return [
      "What's something new you've learned recently that excited you?",
      "If you could have a conversation with anyone from history, who would it be and why?",
      "What's a small change you've made recently that had a big impact on your day?"
    ];
  }
  // Fetch trending topics to ground the suggestions in today's news/social media
  let trendingList: string[] = [];
  try {
    console.log('🔄 Getting trending topics for AI generation...');
    trendingList = await getTrendingTopics();
    console.log(`📊 Got ${trendingList.length} trending topics for AI`);
  } catch (e) {
    console.error('⚠️ Failed to get trending topics:', e);
    trendingList = [];
  }

  // Fallback: ask the model for today's trending headlines if web sources failed
  if (trendingList.length === 0) {
    try {
      const fallbackPrompt = `List 10 of the most discussed trending headlines/topics from the internet and social media today (${currentDate}).
Return ONLY a JSON array of short headline strings.`;
      const comp = await openrouter.chat.completions.create({
        model: 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: fallbackPrompt }],
        max_tokens: 200,
        temperature: 0.3,
      });
      const raw = comp.choices[0]?.message?.content || '';
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          trendingList = arr.filter((x) => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        // naive line split fallback
        trendingList = raw.split('\n').map((l: string) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean).slice(0, 10);
      }
    } catch {
      // ignore
    }
  }

  const trendingSummary = trendingList
    .slice(0, 10)
    .map((t, i) => `- ${t}`)
    .join('\n');
    
  console.log('🎯 User interests:', userInterests);
  console.log('📰 Trending summary length:', trendingSummary.length);

  const extractStartersFromResponse = (raw: string): string[] => {
    if (!raw) return [];
    const clean = raw.trim();

    const stripCodeFences = (s: string) => {
      const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      return fence ? fence[1].trim() : s;
    };

    const tryJsonArray = (s: string): string[] | null => {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === 'string' ? item : (item?.text ?? '')))
            .map((t) => String(t).trim())
            .filter(Boolean);
        }
        return null;
      } catch {
        return null;
      }
    };

    // 1) Remove code fences and try JSON
    let attempt = stripCodeFences(clean);
    let arr = tryJsonArray(attempt);
    if (arr && arr.length) return arr;

    // 2) If contains brackets, try to extract balanced JSON array
    const first = attempt.indexOf('[');
    const last = attempt.lastIndexOf(']');
    if (first !== -1 && last !== -1 && last > first) {
      const between = attempt.slice(first, last + 1);
      arr = tryJsonArray(between);
      if (arr && arr.length) return arr;
    }

    // 3) Fallback: parse bullet/numbered lines
    const bullets: string[] = [];
    const bulletRegex = /^(?:[-*]|\d+[.)])\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = bulletRegex.exec(attempt)) !== null) {
      const item = m[1].trim();
      if (item) bullets.push(item);
    }
    if (bullets.length) return bullets;

    // 4) Last resort: split lines
    return attempt
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean);
  };
  try {
    const mode = userInterests && userInterests.length > 0 ? 'interests' : 'foryou';
    const baseInstructions = `Generate 3 engaging conversation starters for today (${currentDate}).
Ground them in CURRENT trending topics from the internet and social media (see list below), and keep them timely.
${mode === 'interests' ? `Also personalize to these user interests: ${userInterests.join(', ')}. Each starter must explicitly mention at least one of the user's interests by name.` : 'Do not assume any user-specific interests.'}
Each starter must explicitly mention at least one of the trending items by name from the list below (no placeholders), be 1–2 sentences, and spark discussion.
Return ONLY a JSON array of strings.`;

    const prompt = `${baseInstructions}\n\nTrending highlights:\n${trendingSummary || '- (no trending available, still generate timely, general topics)'}\n`;
    
    console.log('🤖 Sending prompt to AI (length:', prompt.length, ')');
    console.log('🔑 Using API key ending in:', openRouterApiKey?.slice(-6) || 'NONE');

    const completion = await openrouter.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.5,
    });

    const response = completion.choices[0]?.message?.content || '';
    const starters = extractStartersFromResponse(response).slice(0, 3);
    if (starters.length) return starters;

    return [
      "What's something new you've learned recently that excited you?",
      "If you could have a conversation with anyone from history, who would it be and why?",
      "What's a small change you've made recently that had a big impact on your day?"
    ];
  } catch (error) {
    console.error('❌ Proactive Generation Error:', error);
    if (error instanceof Error && error.message.includes('401')) {
      console.error('🔐 API Key issue detected. Check EXPO_PUBLIC_OPENROUTER_API_KEY');
    }
    return [
      "What's something new you've learned recently that excited you?",
      "If you could have a conversation with anyone from history, who would it be and why?",
      "What's a small change you've made recently that had a big impact on your day?"
    ];
  }
};
