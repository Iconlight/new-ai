# Article Context & Scroll Fix

## Issues Fixed

### 1. ✅ AI Now Has Full Article Content

**Problem:** AI was only receiving article titles/URLs, not the actual content. It would make assumptions based on its training data instead of discussing the specific article.

**Solution:**
- Created `articleFetcher.ts` service that fetches full article content from URLs
- Uses Jina AI Reader API (free) to extract clean article text
- Falls back to direct HTML parsing if needed
- Updated `ChatContext` to fetch article content before starting a chat
- Updated `generateAIResponse` to include full article in system prompt

**How it works:**
```
User clicks article → Fetch full content → Store in chat context → AI uses ONLY article content
```

**AI System Prompt Now Includes:**
```
IMPORTANT: You are discussing this specific article. Base your responses STRICTLY 
on the article content below. Do NOT use your general knowledge or make assumptions 
beyond what's in the article.

Full Article Content:
[actual article text here]

Remember: Only discuss what's explicitly mentioned in the article above.
```

### 2. ✅ Fixed Scroll-to-Load More

**Problem:** Infinite scroll wasn't triggering properly - required scrolling up then down again.

**Solution:**
- Improved scroll detection logic with better position calculation
- Reduced `scrollEventThrottle` from 400ms to 16ms (60fps)
- Added check for existing content before loading more
- Reduced trigger distance from 500px to 300px for better UX

**Changes:**
- Better scroll position calculation
- More responsive scroll events
- Added logging for debugging

## Files Modified

1. **src/services/articleFetcher.ts** (NEW)
   - Fetches full article content from URLs
   - Uses Jina AI Reader API
   - Fallback to direct HTML parsing

2. **src/services/ai.ts**
   - Updated `generateAIResponse` to accept `content` in newsContext
   - Builds system prompt with full article content
   - Instructs AI to ONLY use article content, not general knowledge

3. **src/contexts/ChatContext.tsx**
   - Imports `articleFetcher`
   - Fetches article content before creating chat
   - Stores enriched context with full article content
   - Updated type definitions to include `content` field

4. **app/discover.tsx**
   - Improved scroll handler logic
   - Reduced scroll event throttle
   - Better near-bottom detection

## Testing

### Test Article Context

1. Open discovery page
2. Click any article/topic
3. Start chatting with AI
4. Ask specific questions about the article
5. **Expected:** AI discusses only what's in the article
6. **Expected:** AI says "the article doesn't mention that" for out-of-scope questions

### Test Scroll-to-Load

1. Open discovery page (For You or Interests tab)
2. Scroll down to bottom
3. **Expected:** More topics load automatically when near bottom
4. **Expected:** Loading indicator appears
5. **Expected:** New topics appear smoothly

## Technical Details

### Article Fetching

**Jina AI Reader:**
- Free tier: 1M tokens/month
- Returns clean text without ads/navigation
- URL: `https://r.jina.ai/{article_url}`
- Response format: Plain text

**Fallback Method:**
- Direct HTTP fetch
- Basic HTML parsing
- Extracts from `<article>`, `<main>`, or `<body>` tags
- Strips scripts, styles, and HTML tags

### Performance

- Article fetching: ~1-3 seconds
- Cached in chat context (no re-fetch on subsequent messages)
- Content limited to 5000 characters to avoid token limits
- Parallel fetching with batch size of 3

### AI Token Usage

- System prompt with article: ~500-2000 tokens
- Leaves room for conversation history
- Max response: 500 tokens (unchanged)

## Monitoring

### Check if articles are being fetched:

Look for these logs in console:
```
[ChatContext] Fetching article content from: https://...
[ChatContext] Article content fetched: 2543 characters
```

### Check if AI is using article content:

Ask AI: "What specific details does the article mention about X?"
- ✅ Good: AI quotes or paraphrases from article
- ❌ Bad: AI gives general knowledge not in article

### Check scroll performance:

Look for:
```
📜 Scroll detected near bottom, loading more...
📄 Loading page 2 for foryou feed...
✅ Loaded 15 more topics (page 2)
```

## Troubleshooting

### AI still making assumptions

**Check:**
1. Is article content being fetched? (check logs)
2. Is the URL valid and accessible?
3. Is Jina AI Reader working? (test: `https://r.jina.ai/https://example.com`)

**Solution:**
- Verify article URL is not behind paywall
- Check network connectivity
- Fallback will use title/description only

### Scroll not loading more

**Check:**
1. Are there more topics available? (check `hasMoreForYou`/`hasMoreInterests`)
2. Is scroll event firing? (check console for scroll logs)
3. Is content tall enough to scroll?

**Solution:**
- Pull to refresh to reset pagination
- Check if `loadingMore` is stuck (shouldn't be)
- Verify `scrollEventThrottle` is 16

### Article fetching slow

**Normal:** 1-3 seconds per article
**Slow:** >5 seconds

**Causes:**
- Large article (>10,000 words)
- Slow website response
- Network issues

**Solution:**
- Already limited to 5000 characters
- Timeout after 10 seconds (fallback to title only)
- Consider caching fetched articles in database

## Future Improvements

1. **Cache fetched articles** in database to avoid re-fetching
2. **Batch fetch** multiple articles in background
3. **Show loading indicator** while fetching article
4. **Add article preview** before starting chat
5. **Support more article sources** (PDFs, paywalled content)
6. **Increase token limit** for longer articles (if needed)

## Notes

- Article content is stored in `news_context.content` field in chats table
- Content is passed to AI in every message of the conversation
- AI maintains context across the entire chat session
- Scroll-to-load works independently for For You and Interests tabs
