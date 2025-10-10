# Discover Page - Data Sources & Architecture

## Overview

The Discover page shows AI-generated conversation starters based on real-time news and user interests. It uses a two-tab system: **For You** and **Interests**.

## Data Sources

### 1. **NewsAPI** (Primary Source)
- **URL**: `https://newsapi.org/v2`
- **Usage**: Fetches top headlines from various categories
- **Categories**: technology, science, business, health, entertainment, sports, general
- **Rate Limit**: Free tier = 100 requests/day
- **Configuration**: Requires `EXPO_PUBLIC_NEWS_API_KEY` in `.env`
- **Code**: `src/services/newsService.ts` → `fetchFromNewsAPI()`

**Example Request**:
```
GET https://newsapi.org/v2/top-headlines?category=technology&country=us&pageSize=10&apiKey=YOUR_KEY
```

### 2. **RSS Feeds** (Fallback Source)
Used when NewsAPI key is not available or rate limit is exceeded.

**Sources** (45+ feeds across all categories):

- **BBC News** (Most reliable)
  - Technology, Science, Business, Health, Entertainment, General

- **Technology** (8 sources)
  - Engadget: `https://www.engadget.com/rss.xml`
  - CNET, Wired, TechCrunch, The Verge, Ars Technica, O'Reilly Radar

- **Science** (3 sources)
  - ScienceDaily: `https://www.sciencedaily.com/rss/all.xml`
  - Scientific American, New Scientist

- **Health & Medicine** (3 sources)
  - Medical News Today: `https://www.medicalnewstoday.com/rss`
  - Healthline, WebMD

- **Business & Finance** (3 sources)
  - Bloomberg: `https://feeds.bloomberg.com/markets/news.rss`
  - CNBC, Forbes

- **Entertainment** (4 sources)
  - Hollywood Reporter: `https://www.hollywoodreporter.com/feed/`
  - Variety, Entertainment Weekly, Rolling Stone

- **Sports** (3 sources)
  - ESPN: `https://www.espn.com/espn/rss/news`
  - CBS Sports, Sports Illustrated

- **Reddit** (7 subreddits)
  - r/technology, r/science, r/worldnews, r/entertainment, r/health, r/business, r/sports

- **General News** (3 sources)
  - TIME, New York Times, The Guardian

**Code**: `src/services/newsService.ts` → `fetchFromFreeSource()`

### 3. **Database Cache**
- **Table**: `news_articles` (if exists)
- **Purpose**: Offline access and reducing API calls
- **Duration**: 30 minutes cache
- **Code**: `src/services/newsService.ts` → `storeNewsInDB()`, `getStoredNews()`

## Data Flow

### Initial Load
```
User opens Discover
    ↓
loadInitialData()
    ↓
getActiveFeedTopics(userId, feedType)
    ↓
Check database for existing topics
    ↓
If empty → refreshFeed()
    ↓
NewsService.fetchCurrentNews()
    ↓
Try NewsAPI → If fails → Try RSS feeds
    ↓
Parse & cache articles
    ↓
Generate conversation starters via AI
    ↓
Store in proactive_topics table
    ↓
Display in UI
```

### Pull to Refresh
```
User pulls down
    ↓
handleRefresh()
    ↓
clearProactiveCache() - Clear all caches
    ↓
refreshFeed(userId)
    ↓
Fetch fresh news from internet
    ↓
Generate new conversation starters
    ↓
Update UI
```

## Feed Types

### **For You** Tab
- **Feed Type**: `foryou`
- **Logic**: Personalized based on user's conversation history and interests
- **AI Prompt**: Analyzes user patterns and generates relevant topics
- **Refresh**: `refreshForYouFeed(userId)`

### **Interests** Tab
- **Feed Type**: `interests`
- **Logic**: Based on user's explicitly selected interests
- **AI Prompt**: Focuses on topics matching user's interest tags
- **Refresh**: `refreshInterestsFeed(userId)`

## Skeleton Loading

### Implementation
- **Component**: `components/ui/TopicSkeleton.tsx`
- **Animation**: Shimmer effect (opacity 0.3 → 0.7)
- **Count**: 6 skeleton cards (alternating left/right)
- **Trigger**: `loading` state is `true`

### When Skeleton Shows
1. Initial page load
2. Tab switch (For You ↔ Interests)
3. Before topics are fetched from database

### When Skeleton Hides
- Topics loaded successfully
- Empty state (no topics available)

## Caching Strategy

### News Cache
- **Duration**: 30 minutes
- **Location**: In-memory (`NewsService.cachedNews`)
- **Clear**: Manual via `clearProactiveCache()` or pull-to-refresh

### Topic Cache
- **Duration**: Until manually refreshed
- **Location**: Database (`proactive_topics` table)
- **Clear**: `clearProactiveCache()` deletes old topics

## API Keys & Configuration

### Required Environment Variables

Create `.env` file:
```env
# Optional - for better news quality
EXPO_PUBLIC_NEWS_API_KEY=your_newsapi_key_here

# Required - for AI conversation generation
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_key_here
```

### Get NewsAPI Key
1. Go to https://newsapi.org/
2. Sign up for free account
3. Copy API key
4. Add to `.env` as `EXPO_PUBLIC_NEWS_API_KEY`

**Free Tier Limits**:
- 100 requests/day
- 1 request/second
- Developer use only

## Error Handling

### Fallback Chain
```
NewsAPI
  ↓ (if fails)
RSS Feeds
  ↓ (if fails)
Cached News
  ↓ (if fails)
Database Stored News
  ↓ (if fails)
Empty State
```

### Timeout Protection
- RSS feed requests timeout after 10 seconds
- Prevents hanging on slow/dead feeds
- Automatically tries next source

## Performance Optimizations

### 1. **Caching**
- News cached for 30 minutes
- Reduces API calls by ~95%
- Faster subsequent loads

### 2. **Lazy Loading**
- Only fetch when tab is active
- `useFocusEffect` refreshes on screen focus

### 3. **Skeleton Loading**
- Immediate visual feedback
- Perceived performance improvement
- Better UX than blank screen

### 4. **Parallel Fetching**
- Multiple RSS feeds fetched concurrently
- Reduces total load time

## Monitoring & Debugging

### Check News Fetch
```typescript
// In newsService.ts
console.log('📡 Fetching real news from RSS feeds...');
console.log(`📡 Fetching from ${source.url}...`);
```

### Check Feed Generation
```typescript
// In feedService.ts
console.log('🔄 Refreshing For You feed...');
console.log('✅ Generated X topics');
```

### Check Cache Status
```typescript
// In discover.tsx
console.log('[Discover] Loading topics...');
console.log('[Discover] Topics loaded:', topics.length);
```

## Troubleshooting

### No topics showing
1. **Check internet connection**
2. **Verify API keys** in `.env`
3. **Check console logs** for errors
4. **Try pull-to-refresh** to force fetch
5. **Clear app cache** and restart

### Slow loading
1. **Check network speed**
2. **RSS feeds may be slow** (10s timeout)
3. **NewsAPI rate limit** may be exceeded
4. **Try switching tabs** to trigger refresh

### Stale content
1. **Pull down to refresh** - forces fresh fetch
2. **Cache duration** is 30 minutes
3. **Switch tabs** to see different content

## Future Enhancements

Potential improvements:
- [ ] Add more news sources (Reddit, HackerNews)
- [ ] Implement pagination for older topics
- [ ] Add topic filtering by category
- [ ] Support custom RSS feed URLs
- [ ] Add trending topics section
- [ ] Implement topic voting/feedback
- [ ] Cache images for offline viewing
- [ ] Add search functionality

## Summary

✅ **Primary**: NewsAPI (100 requests/day)
✅ **Fallback**: 45+ RSS feeds across all categories
  - Technology: Engadget, CNET, Wired, TechCrunch, The Verge, Ars Technica
  - Science: ScienceDaily, Scientific American, New Scientist
  - Health: Medical News Today, Healthline, WebMD
  - Business: Bloomberg, CNBC, Forbes
  - Entertainment: Hollywood Reporter, Variety, EW, Rolling Stone
  - Sports: ESPN, CBS Sports, Sports Illustrated
  - Reddit: 7 major subreddits
  - General: BBC, TIME, NYT, The Guardian
✅ **Cache**: 30-minute in-memory + database storage
✅ **Loading**: Skeleton animation for better UX
✅ **Refresh**: Pull-to-refresh clears all caches
✅ **Personalization**: Two feed types (For You & Interests)
