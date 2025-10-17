# RSS Article Description Fix

## Problem

AI was saying it doesn't have access to article data, even though we're pulling articles from RSS feeds. The RSS feeds include article descriptions/summaries, but we weren't passing them to the AI.

## Root Cause

The feed system was fetching `article.description` from RSS feeds but:
1. ❌ Not storing it in the `ProactiveTopic` object
2. ❌ Not saving it to the database (`feed_topics` table)
3. ❌ Not passing it to the AI in the chat context

## Solution

### 1. Added `source_description` Field

**Updated Type Definition:**
- Added `source_description?: string` to `ProactiveTopic` interface

**Updated Feed Service:**
- `refreshInterestsFeed()` - Now includes `source_description: a.description`
- `refreshForYouFeed()` - Now includes `source_description: article.description`
- `fetchNextBatch()` - Now includes `source_description: article.description`
- `insertBatchTopics()` - Now accepts and stores `source_description`

### 2. Pass Description to AI

**Updated discover.tsx:**
```typescript
const newsContext = topic.source_title ? {
  title: topic.source_title,
  description: topic.source_description,  // ✅ Now included!
  url: topic.source_url,
  category: topic.category,
} : undefined;
```

**Updated AI Service:**
- Now has 3 levels of article context:
  1. **Full content** (from articleFetcher) - Most detailed
  2. **RSS description** (from feed) - Good summary ✅ NEW!
  3. **Title only** - Minimal context

**AI Prompt with RSS Description:**
```
IMPORTANT: You are discussing this specific article. Base your responses on 
the article summary below. Do NOT make assumptions beyond what's provided.

Article Title: [title]
Category: [category]

Article Summary/Description:
[RSS feed description]

This is a summary from the RSS feed. Discuss what's mentioned in the summary 
and acknowledge if the user asks about details not covered in the summary.
```

### 3. Database Migration

**Run this SQL:**
```sql
-- File: src/database/migrations/add_source_description_to_feed_topics.sql
ALTER TABLE feed_topics 
ADD COLUMN IF NOT EXISTS source_description TEXT;
```

## Files Modified

1. ✅ `src/types/index.ts` - Added `source_description` to ProactiveTopic
2. ✅ `src/services/feedService.ts` - Store and pass description in all feed types
3. ✅ `app/discover.tsx` - Pass description to chat context
4. ✅ `src/services/ai.ts` - Use description in AI prompt
5. ✅ `src/database/migrations/add_source_description_to_feed_topics.sql` - Database schema

## Testing

### Before Fix
```
User: "What does the article say about X?"
AI: "I don't have access to the full article content..."
```

### After Fix
```
User: "What does the article say about X?"
AI: "According to the article summary, [discusses X based on RSS description]"
```

### Test Steps

1. **Run the migration:**
   ```sql
   -- In Supabase SQL Editor
   ALTER TABLE feed_topics ADD COLUMN IF NOT EXISTS source_description TEXT;
   ```

2. **Refresh the feeds:**
   - Pull to refresh on For You tab
   - Pull to refresh on Interests tab
   - New topics will have descriptions

3. **Test with AI:**
   - Click any article/topic
   - Start chatting
   - Ask specific questions about the article
   - AI should reference the article summary

4. **Verify logs:**
   ```
   [ChatContext] news_context: {
     title: "...",
     description: "...",  // ✅ Should be present
     url: "...",
     category: "..."
   }
   ```

## What AI Now Has

### RSS Feed Articles (Most Common)
- ✅ **Title**: Full article title
- ✅ **Description**: 1-3 paragraph summary from RSS feed
- ✅ **URL**: Link to full article
- ✅ **Category**: Article category

**Example Description:**
```
"Scientists have discovered a new method for carbon capture that could 
reduce atmospheric CO2 by 30%. The breakthrough uses a novel catalyst 
that makes the process more energy-efficient and cost-effective than 
previous methods. Researchers say it could be deployed at scale within 
5 years."
```

### With Article Fetcher (Optional Enhancement)
- ✅ **Full Content**: Complete article text (5000 chars max)
- Only fetched if URL is accessible
- Falls back to RSS description if fetch fails

## Benefits

1. **Better AI Responses**: AI can now discuss article details from RSS summary
2. **No External Calls Needed**: RSS description is already in the feed
3. **Faster**: No need to fetch full article for basic discussions
4. **Fallback Ready**: Can still fetch full content if needed

## Migration Path

### For Existing Topics (Already in DB)

Existing topics in `feed_topics` table won't have `source_description`. They will:
- ✅ Still work (description is optional)
- ✅ AI will use title only for old topics
- ✅ New topics after migration will have descriptions

### To Backfill (Optional)

If you want to add descriptions to existing topics:
```sql
-- This would require re-fetching from RSS feeds
-- Not recommended - just refresh feeds instead
```

## Notes

- RSS descriptions are typically 100-300 characters
- Quality varies by RSS source (some are better than others)
- Description is stored in database for offline access
- AI can make reasonable inferences from the summary
- Full article fetching still available as enhancement

## Future Improvements

1. **Cache descriptions** for faster loading
2. **Improve RSS parsing** to get better summaries
3. **Fetch full content** in background for popular articles
4. **Show description** in UI before starting chat
5. **Extract key points** from description for quick reference

## Troubleshooting

### AI still says no access

**Check:**
1. Did you run the migration?
2. Did you refresh the feeds (pull to refresh)?
3. Are new topics being created with descriptions?

**Verify:**
```sql
SELECT source_title, source_description 
FROM feed_topics 
WHERE source_description IS NOT NULL 
LIMIT 5;
```

### Descriptions are empty

**Possible causes:**
- RSS feed doesn't include descriptions
- RSS parsing failed
- Network error during feed fetch

**Solution:**
- Check RSS feed source quality
- Try different news sources
- Verify RSS parser is working

### AI not using description

**Check logs:**
```
[AI] System prompt includes: "Article Summary/Description:"
```

If not present:
- Verify `newsContext.description` is being passed
- Check `ChatContext` is receiving description
- Verify AI service is building prompt correctly

## Summary

✅ **Fixed**: AI now has access to RSS article descriptions  
✅ **Impact**: Better, more accurate AI responses about articles  
✅ **Migration**: Simple 1-line SQL to add column  
✅ **Backward Compatible**: Old topics still work, new ones better  

The AI will now discuss articles based on their RSS summaries instead of saying it doesn't have access to the data!
