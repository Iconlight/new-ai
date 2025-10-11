# Discover Page Improvements - Proposed Approach

## Issues Identified

### 1. ❌ Skeleton Loading Missing in Interests Tab
**Problem**: Only "For You" tab shows skeleton loading, "Interests" tab doesn't
**Impact**: Inconsistent UX, users see blank screen during loading

### 2. ❌ Slow Refresh & Same Content
**Problem**: Pull-to-refresh takes too long and shows same content
**Root Causes**:
- Cache not being cleared properly
- Fetching from 45+ RSS feeds sequentially (some timeout at 10s each)
- Same batch being retrieved instead of new one
- No deduplication between refreshes

### 3. ❌ Limited to 24 Feeds Per Tab
**Problem**: Only 24 topics shown despite having 45+ sources
**Impact**: Users miss out on diverse content

### 4. ❌ Interests Tab Not Randomized
**Problem**: Topics grouped by category (all tech, then all science, etc.)
**Impact**: Boring, predictable feed order

## Proposed Solutions

### Solution 1: Add Skeleton Loading to Interests Tab ✅

**Change**: Add `loading` state to `loadTodaysTopics()` function

**Implementation**:
```typescript
const loadTodaysTopics = async () => {
  if (!user) return;
  try {
    setLoading(true); // Add this
    const topics = await getActiveFeedTopics(user.id, 'interests');
    setTodaysTopics(topics);
    if (topics.length === 0) {
      await refreshInterestsFeed(user.id);
      const fresh = await getActiveFeedTopics(user.id, 'interests');
      setTodaysTopics(fresh);
    }
  } catch (error) {
    console.error('Error loading topics:', error);
  } finally {
    setLoading(false); // Add this
  }
};
```

**Benefit**: Consistent UX across both tabs

---

### Solution 2: Optimize RSS Feed Fetching ⚡

**Problem**: Sequential fetching of 45+ feeds is slow

**Current Flow**:
```
Fetch Feed 1 (up to 10s timeout)
  ↓
Fetch Feed 2 (up to 10s timeout)
  ↓
... (45+ times)
  ↓
Total: Up to 450 seconds worst case!
```

**Proposed Approach**:

#### A. Parallel Fetching with Batching
```typescript
// Fetch feeds in parallel batches of 10
const BATCH_SIZE = 10;
const FEED_TIMEOUT = 5000; // Reduce to 5s

for (let i = 0; i < rssSources.length; i += BATCH_SIZE) {
  const batch = rssSources.slice(i, i + BATCH_SIZE);
  const results = await Promise.allSettled(
    batch.map(source => fetchWithTimeout(source, FEED_TIMEOUT))
  );
  // Process successful results
}
```

**Benefits**:
- 10 feeds fetched simultaneously
- 5s timeout instead of 10s
- Total time: ~30-40 seconds instead of 450s
- Failed feeds don't block others

#### B. Smart Source Selection
Instead of fetching ALL 45+ sources every time:

```typescript
// Rotate through sources to ensure variety
const selectSources = (allSources: Source[], count: number = 20) => {
  const lastUsed = getLastUsedSources(); // From cache
  const available = allSources.filter(s => !lastUsed.includes(s.url));
  
  // Mix: 70% new sources + 30% reliable sources (BBC, etc.)
  const reliable = allSources.filter(s => RELIABLE_SOURCES.includes(s.url));
  const selected = [
    ...shuffle(available).slice(0, count * 0.7),
    ...shuffle(reliable).slice(0, count * 0.3)
  ];
  
  saveLastUsedSources(selected.map(s => s.url));
  return selected;
};
```

**Benefits**:
- Fetch only 20 sources per refresh (instead of 45+)
- Rotate sources for variety
- Always include reliable sources
- Much faster (20-30s instead of 450s)

---

### Solution 3: Implement Infinite Scroll with Smart Pagination 📊

**Current**: 24 topics per tab (hardcoded), no pagination

**Proposed**: 
- **Initial load**: 20 topics (fast)
- **Infinite scroll**: Load 15 more when user scrolls near bottom
- **Smart deduplication**: Track shown articles to prevent repeats
- **Source rotation**: Use different sources for each page

**Implementation**:

#### A. State Management (discover.tsx)
```typescript
const [forYouTopics, setForYouTopics] = useState<ProactiveTopic[]>([]);
const [todaysTopics, setTodaysTopics] = useState<ProactiveTopic[]>([]);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [shownArticleIds, setShownArticleIds] = useState<Set<string>>(new Set());
const [currentPage, setCurrentPage] = useState(0);
```

#### B. Scroll Detection
```typescript
const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
  const paddingToBottom = 500; // Trigger 500px before bottom
  
  const isNearBottom = 
    layoutMeasurement.height + contentOffset.y >= 
    contentSize.height - paddingToBottom;
  
  if (isNearBottom && !loadingMore && hasMore) {
    loadMoreTopics();
  }
};
```

#### C. Load More Function
```typescript
const loadMoreTopics = async () => {
  if (!user || loadingMore || !hasMore) return;
  
  setLoadingMore(true);
  try {
    const feedType = activeTab === 'interests' ? 'interests' : 'foryou';
    const nextPage = currentPage + 1;
    
    // Fetch next batch with exclusions
    const newTopics = await fetchNextBatch(
      user.id, 
      feedType, 
      nextPage,
      Array.from(shownArticleIds) // Exclude already shown
    );
    
    if (newTopics.length === 0) {
      setHasMore(false);
      return;
    }
    
    // Update shown IDs
    const newIds = new Set(shownArticleIds);
    newTopics.forEach(t => {
      if (t.source_url) newIds.add(t.source_url);
    });
    setShownArticleIds(newIds);
    
    // Append new topics
    if (activeTab === 'interests') {
      setTodaysTopics(prev => [...prev, ...newTopics]);
    } else {
      setForYouTopics(prev => [...prev, ...newTopics]);
    }
    
    setCurrentPage(nextPage);
  } catch (error) {
    console.error('Error loading more topics:', error);
  } finally {
    setLoadingMore(false);
  }
};
```

#### D. Feed Service Changes (feedService.ts)
```typescript
// New function for paginated fetching
export async function fetchNextBatch(
  userId: string,
  feedType: FeedType,
  page: number,
  excludeUrls: string[] = []
): Promise<ProactiveTopic[]> {
  const ITEMS_PER_PAGE = 15;
  const SOURCES_PER_PAGE = 10; // Rotate through 10 sources per page
  
  // Get rotated sources for this page
  const sources = getSourcesForPage(page, SOURCES_PER_PAGE);
  
  // Fetch articles from these sources
  const articles = await fetchFromSpecificSources(sources);
  
  // Filter out already shown articles
  const newArticles = articles.filter(a => !excludeUrls.includes(a.url));
  
  // Shuffle and take ITEMS_PER_PAGE
  const shuffled = newArticles.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, ITEMS_PER_PAGE);
  
  // Convert to topics
  return selected.map(article => ({
    id: `feed-${article.id}-${page}`,
    topic: `${getCategoryEmoji(article.category)} ${article.category}`,
    message: buildStarter({ feedType, ...article }),
    source_url: article.url,
    source_title: article.title,
    category: article.category,
    // ... other fields
  }));
}

// Source rotation logic
const getSourcesForPage = (page: number, count: number): RSSSource[] => {
  const allSources = [...rssSources]; // All 45+ sources
  const startIndex = (page * count) % allSources.length;
  
  // Circular rotation through sources
  const selected = [];
  for (let i = 0; i < count; i++) {
    const index = (startIndex + i) % allSources.length;
    selected.push(allSources[index]);
  }
  
  return selected;
};
```

#### E. Loading Indicator at Bottom
```typescript
// In discover.tsx ScrollView content
{currentTopics.map((topic, idx) => (
  <TopicCard key={topic.id} topic={topic} />
))}

{loadingMore && (
  <View style={styles.loadingMore}>
    <ActivityIndicator size="large" color="#C084FC" />
    <Text style={styles.loadingText}>Loading more topics...</Text>
  </View>
)}

{!hasMore && currentTopics.length > 0 && (
  <View style={styles.endMessage}>
    <Text style={styles.endText}>🎉 You've seen all available topics!</Text>
    <Text style={styles.endSubtext}>Pull down to refresh for new content</Text>
  </View>
)}
```

**Benefits**:
- ✅ **Infinite content** - Never run out of topics
- ✅ **No duplicates** - Tracks shown articles
- ✅ **Fast initial load** - Only 20 topics first
- ✅ **Source variety** - Rotates through all 45+ sources
- ✅ **Smooth UX** - Loads before user reaches bottom
- ✅ **Efficient** - Only fetches 10 sources per page (not all 45+)

---

### Solution 4: Randomize Interests Feed 🎲

**Problem**: Topics grouped by category

**Current Flow**:
```
[Tech 1, Tech 2, Tech 3, Science 1, Science 2, Health 1, Health 2...]
```

**Proposed Flow**:
```
[Tech 1, Health 1, Science 1, Tech 2, Science 2, Health 2, Tech 3...]
```

**Implementation**:

```typescript
// In feedService.ts - after selecting articles
const items = selected.map((a) => ({
  topic: `Focused: ${a.category || 'topic'}`,
  message: buildStarter({...}),
  // ... other fields
}));

// SHUFFLE the items before inserting
const shuffledItems = items.sort(() => Math.random() - 0.5);

await insertBatchTopics(uid, 'interests', batchId, shuffledItems);
```

**Benefits**:
- Mixed, TikTok-style feed
- Prevents category fatigue
- More engaging experience

---

### Solution 5: Force New Batch on Refresh 🔄

**Problem**: Refresh shows same content (same batch retrieved)

**Current Issue**:
```typescript
// getActiveFeedTopics always gets LATEST batch
// Even after refresh, it's the same batch!
```

**Proposed Solution**:

#### A. Delete Old Batches on Refresh
```typescript
// In refreshInterestsFeed() and refreshForYouFeed()
// BEFORE creating new batch:

// Delete old batches for this feed type
await supabase
  .from('feed_batches')
  .delete()
  .eq('user_id', uid)
  .eq('feed_type', feedType);

// Now create new batch
const batchId = await createBatch(uid, feedType, {...});
```

#### B. Mark Batches as Stale
```typescript
// Add 'is_active' column to feed_batches
// On refresh, mark old batches as inactive
await supabase
  .from('feed_batches')
  .update({ is_active: false })
  .eq('user_id', uid)
  .eq('feed_type', feedType);

// Create new active batch
const batchId = await createBatch(uid, feedType, { is_active: true });

// In getActiveFeedTopics, only fetch active batches
.eq('is_active', true)
```

**Benefits**:
- Guaranteed new content on refresh
- Clean database (no old batches accumulating)
- Clear separation between refreshes

---

## Implementation Priority

### Phase 1: Quick Wins (15 minutes)
1. ✅ Add skeleton loading to Interests tab
2. ✅ Randomize interests feed order
3. ✅ Delete old batches on refresh

### Phase 2: Performance (30 minutes)
4. ⚡ Implement parallel RSS fetching with batching
5. ⚡ Reduce timeout to 5 seconds
6. ⚡ Smart source selection (20 sources for initial load)

### Phase 3: Infinite Scroll (45 minutes)
7. 📊 Add scroll detection and pagination state
8. 📊 Implement `fetchNextBatch()` with source rotation
9. 📊 Add deduplication tracking
10. 📊 Add loading indicators (bottom spinner, end message)
11. 📊 Reset state on tab switch and refresh

---

## Expected Results

### Before:
- ❌ Interests tab: No skeleton loading
- ❌ Refresh: 450s worst case, same content
- ❌ Limited: 24 topics per tab
- ❌ Boring: Grouped by category
- ❌ No pagination: Can't load more

### After:
- ✅ Both tabs: Skeleton loading
- ✅ Refresh: 20-30s, always new content
- ✅ Infinite scroll: Unlimited topics
- ✅ Engaging: Randomized, TikTok-style feed
- ✅ Smart loading: 10 sources per page, no duplicates
- ✅ Fast: Initial load 20 topics, then 15 per scroll

---

## Technical Details

### RSS Fetching Optimization

**Current**:
```typescript
for (const source of rssSources) {
  await fetch(source.url, { timeout: 10000 });
}
// Sequential: 45 × 10s = 450s worst case
```

**Proposed**:
```typescript
const fetchInBatches = async (sources, batchSize = 10) => {
  const results = [];
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(s => fetchWithTimeout(s, 5000))
    );
    results.push(...batchResults.filter(r => r.status === 'fulfilled'));
  }
  return results;
};
// Parallel batches: (20 sources / 10 per batch) × 5s = 10s
```

### Source Rotation Strategy

```typescript
// Store last used sources in AsyncStorage or Supabase
const ROTATION_KEY = 'last_used_rss_sources';
const ROTATION_WINDOW = 3; // Rotate every 3 refreshes

const getRotatedSources = (allSources, count = 20) => {
  const history = await getSourceHistory();
  const leastUsed = allSources
    .map(s => ({ ...s, uses: history[s.url] || 0 }))
    .sort((a, b) => a.uses - b.uses)
    .slice(0, count);
  
  return leastUsed;
};
```

---

## Questions to Consider

1. **Should we implement infinite scroll?** ✅ YES!
   - Pro: Unlimited content, better UX, uses all 45+ sources
   - Con: More complex, need pagination
   - **Decision: Implement in Phase 3**

2. **Should we cache successful RSS feeds?**
   - Pro: Faster subsequent loads
   - Con: Might show stale content
   - Recommendation: Yes, but with 5-minute TTL

3. **Should we show feed source attribution?**
   - Pro: Transparency, credibility
   - Con: UI clutter
   - Recommendation: Optional, show on tap

---

## Summary

### Approach:
1. **Quick fixes first**: Skeleton loading, randomization, batch cleanup
2. **Performance optimization**: Parallel fetching, smart source selection
3. **Infinite scroll**: Pagination with deduplication and source rotation

### Expected Impact:
- **Speed**: 20-30s refresh (vs 450s) ⚡
- **Content**: Unlimited topics via infinite scroll 📊
- **Variety**: Rotates through all 45+ sources 🔄
- **Engagement**: Randomized, TikTok-style feed 🎲
- **Consistency**: Skeleton loading on both tabs ✨
- **No duplicates**: Smart tracking prevents repeats 🎯

### Implementation Time:
- Phase 1: 15 minutes (Quick wins)
- Phase 2: 30 minutes (Performance)
- Phase 3: 45 minutes (Infinite scroll)
- **Total**: ~90 minutes

### How Infinite Scroll Works:

```
User opens Discover
  ↓
Load 20 topics from 20 sources (fast!)
  ↓
User scrolls down
  ↓
500px before bottom → Trigger load more
  ↓
Fetch 15 more topics from next 10 sources
  ↓
Check against shown URLs (no duplicates)
  ↓
Append to feed
  ↓
Repeat until all sources exhausted
  ↓
Show "You've seen all topics!" message
```

### Key Features:
- ✅ **Circular source rotation**: Page 0 uses sources 0-19, Page 1 uses sources 20-29, Page 5 wraps back to sources 0-9
- ✅ **Deduplication**: Tracks `source_url` to prevent showing same article twice
- ✅ **Smooth UX**: Loads 500px before bottom (user never waits)
- ✅ **Reset on refresh**: Pull-to-refresh clears everything and starts fresh
- ✅ **Per-tab state**: Each tab (For You / Interests) has independent pagination

Ready to implement? 🚀
