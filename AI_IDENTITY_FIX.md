# AI Identity & News Context Fix

## Problems Fixed

### 1. ❌ AI Identified as ChatGPT
**Problem**: When users asked "what AI model are you?", the AI responded "ChatGPT" instead of "ProactiveAI"

**Solution**: Updated system prompt to explicitly define AI identity as "ProactiveAI"

### 2. ❌ AI Responded Outside News Context
**Problem**: AI would use general training data instead of staying focused on the specific news article being discussed

**Solution**: Added news context tracking and enforcement in system prompt

## Changes Made

### 1. **Updated AI System Prompt** (`src/services/ai.ts`)

**Before**:
```typescript
const systemPrompt = `You are a proactive AI assistant that engages users in meaningful conversations based on their interests...`;
```

**After**:
```typescript
const systemPrompt = `You are ProactiveAI, a conversational AI assistant designed to engage users in meaningful discussions about current news and topics based on their interests.

Your identity:
- Your name is "ProactiveAI" (not ChatGPT, not any other AI)
- You are a specialized news discussion assistant
- You help users explore and discuss current events

Your behavior:
- Be conversational, engaging, and thoughtful
- Ask follow-up questions to keep the conversation flowing
- Keep responses concise but informative (2-4 sentences typically)
- Show genuine interest in the user's thoughts and perspectives
- Encourage critical thinking and diverse viewpoints

IMPORTANT CONTEXT: This conversation is about a specific news article/topic:
- Title: "${contextInfo.title}"
- Description: ${contextInfo.description}
- Category: ${contextInfo.category}
- Source: ${contextInfo.url}

You MUST base your responses on this specific article/topic. Do NOT use general knowledge or training data about similar topics. If the user asks about details not in the article, acknowledge that and ask them what they think or redirect to what IS in the article. Stay focused on THIS specific news story.

Remember: You are ProactiveAI, and when discussing news, always stay grounded in the specific article being discussed.`;
```

### 2. **Added News Context Parameter** (`src/services/ai.ts`)

```typescript
export const generateAIResponse = async (
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  userInterests: string[] = [],
  newsContext?: { title: string; description?: string; url?: string; category?: string }
): Promise<AIResponse>
```

The function now:
- Accepts optional `newsContext` parameter
- Extracts news context from first assistant message if not provided
- Includes news context in system prompt
- Enforces staying grounded in the specific article

### 3. **Updated Chat Type** (`src/types/index.ts`)

Added `news_context` field to Chat interface:
```typescript
export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  news_context?: {
    title: string;
    description?: string;
    url?: string;
    category?: string;
  };
}
```

### 4. **Updated ProactiveTopic Type** (`src/types/index.ts`)

Added source fields:
```typescript
export interface ProactiveTopic {
  // ... existing fields
  source_url?: string;
  source_title?: string;
  source_type?: string;
  category?: string;
}
```

### 5. **Updated ChatContext** (`src/contexts/ChatContext.tsx`)

**`startChatWithAI` function**:
- Now accepts `newsContext` parameter
- Stores news context in database when creating chat
- Passes context to AI for all responses

**`sendMessage` function**:
- Retrieves news context from `currentChat`
- Passes to `generateAIResponse()` for every message

### 6. **Updated Discover Page** (`app/discover.tsx`)

```typescript
const handleStartTopic = async (topic: ProactiveTopic) => {
  // Extract news context from topic
  const newsContext = topic.source_title ? {
    title: topic.source_title,
    url: topic.source_url,
    category: topic.category,
  } : undefined;
  
  const newChat = await startChatWithAI(topic.message, topic.topic, newsContext);
  // ...
};
```

### 7. **Database Migration** (`src/database/migrations/add_news_context_to_chats.sql`)

```sql
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS news_context JSONB;

CREATE INDEX IF NOT EXISTS idx_chats_news_context ON chats USING GIN (news_context);
```

## How It Works Now

### Conversation Flow

```
1. User taps topic in Discover
   ↓
2. Topic includes news article metadata:
   - source_title: "Article Title"
   - source_url: "https://..."
   - category: "technology"
   ↓
3. Chat created with news_context stored
   ↓
4. AI receives system prompt with:
   - Identity: "You are ProactiveAI"
   - News context: Article title, description, URL, category
   - Instruction: "Stay grounded in THIS specific article"
   ↓
5. User asks questions
   ↓
6. AI responds based on:
   - The specific news article context
   - User's question
   - Conversation history
   ↓
7. AI stays focused on the article throughout conversation
```

### Example Conversation

**User**: "What AI model are you?"

**Before**: "I'm ChatGPT, an AI assistant..."

**After**: "I'm ProactiveAI, a conversational AI designed to help you explore and discuss current news and topics!"

---

**User**: "Tell me more about this technology"

**Before**: *Uses general knowledge about the technology*

**After**: "Based on this article about [specific topic], it mentions [specific details from article]. What aspect interests you most?"

---

**User**: "What are the implications?"

**Before**: *General implications from training data*

**After**: "The article highlights [specific points from article]. What do you think about [specific aspect mentioned in article]?"

## Testing

### Test AI Identity
1. Start any conversation
2. Ask: "What AI model are you?"
3. Expected: "I'm ProactiveAI..."

### Test News Context Grounding
1. Start conversation from news topic
2. Ask questions about the topic
3. Expected: AI references specific article details
4. Ask about details not in article
5. Expected: AI acknowledges limitation and redirects to article content

### Test Context Persistence
1. Start conversation from news topic
2. Have multi-turn conversation
3. Expected: AI maintains news context throughout
4. Check database: `news_context` field populated

## Database Query Examples

### Check chats with news context
```sql
SELECT id, title, news_context 
FROM chats 
WHERE news_context IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

### Find chats about specific category
```sql
SELECT id, title, news_context->>'title' as article_title
FROM chats 
WHERE news_context->>'category' = 'technology'
ORDER BY created_at DESC;
```

## Files Modified

1. ✅ `src/services/ai.ts` - Updated system prompt and added news context parameter
2. ✅ `src/types/index.ts` - Added news_context to Chat and source fields to ProactiveTopic
3. ✅ `src/contexts/ChatContext.tsx` - Pass news context to AI
4. ✅ `app/discover.tsx` - Extract and pass news context when starting chat
5. ✅ `src/database/migrations/add_news_context_to_chats.sql` - Database migration

## Migration Steps

1. **Run database migration**:
   ```sql
   -- In Supabase SQL Editor
   -- Run: src/database/migrations/add_news_context_to_chats.sql
   ```

2. **Rebuild app** (to include TypeScript changes):
   ```bash
   # Clear cache
   npm start -- --clear
   
   # Or rebuild
   eas build --profile development --platform android
   ```

3. **Test**:
   - Start new conversation from Discover
   - Ask "What AI are you?"
   - Ask questions about the news topic
   - Verify AI stays grounded in article

## Benefits

✅ **Clear Identity**: AI now correctly identifies as ProactiveAI
✅ **Grounded Responses**: AI stays focused on specific news articles
✅ **Better UX**: Users get relevant, article-specific responses
✅ **Context Persistence**: News context maintained throughout conversation
✅ **Accurate Information**: AI doesn't hallucinate details not in article

## Summary

The AI now:
1. **Knows its identity** - "ProactiveAI" not "ChatGPT"
2. **Stays grounded** - Responds based on specific news article
3. **Maintains context** - Remembers article throughout conversation
4. **Acknowledges limits** - Admits when details aren't in article
5. **Redirects appropriately** - Brings conversation back to article content

Users will now have more focused, relevant conversations about the specific news they're interested in! 🎉
