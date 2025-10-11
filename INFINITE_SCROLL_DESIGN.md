# Infinite Scroll Design - Visual Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      DISCOVER PAGE                          │
├─────────────────────────────────────────────────────────────┤
│  [For You Tab] [Interests Tab]                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Topic 1 (from BBC Tech)                             │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Topic 2 (from Engadget)                             │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Topic 3 (from ScienceDaily)                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                    ... (17 more)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Topic 20 (from Reddit r/technology)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ← User scrolls down ←                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔄 Loading more topics...                           │   │ ← Triggered 500px before bottom
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Topic 21 (from The Verge) ← NEW                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Topic 22 (from CNBC) ← NEW                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                    ... (13 more)                            │
│                                                             │
│  ← User keeps scrolling ←                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎉 You've seen all available topics!                │   │ ← After all sources exhausted
│  │ Pull down to refresh for new content                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Source Rotation Strategy

### Initial Load (Page 0)
```
45+ RSS Sources
├─ [0-19]  ← Used for Page 0 (20 topics)
├─ [20-29] ← Reserved for Page 1
├─ [30-39] ← Reserved for Page 2
└─ [40-44] ← Reserved for Page 3
```

### Pagination Flow
```
Page 0: Sources 0-19   → 20 topics (initial load)
Page 1: Sources 20-29  → 15 topics (scroll load)
Page 2: Sources 30-39  → 15 topics (scroll load)
Page 3: Sources 40-44  → 15 topics (scroll load)
Page 4: Sources 0-9    → 15 topics (wrap around)
Page 5: Sources 10-19  → 15 topics (wrap around)
...
```

## Deduplication System

### State Tracking
```typescript
// In discover.tsx
const [shownArticleIds, setShownArticleIds] = useState<Set<string>>(new Set());

// Example state after 2 pages:
shownArticleIds = Set([
  'https://bbc.com/article-1',
  'https://engadget.com/article-2',
  'https://sciencedaily.com/article-3',
  // ... 32 more URLs
])
```

### Filtering Logic
```
Fetch 15 articles from sources
  ↓
Filter: article.url NOT IN shownArticleIds
  ↓
If < 15 articles remain:
  - Fetch from next batch of sources
  - Repeat until 15 unique articles found
  ↓
Add new URLs to shownArticleIds
  ↓
Display to user
```

## Performance Optimization

### Parallel Fetching
```
Traditional (Sequential):
Source 1 → 10s
Source 2 → 10s
Source 3 → 10s
...
Total: 200+ seconds

Optimized (Parallel Batches):
Batch 1: [Sources 1-10] → 5s (parallel)
Batch 2: [Sources 11-20] → 5s (parallel)
Total: 10 seconds ⚡
```

### Memory Management
```typescript
// Only keep last 100 topics in memory
if (allTopics.length > 100) {
  const recentTopics = allTopics.slice(-100);
  setForYouTopics(recentTopics);
  
  // Update shownArticleIds to match
  const recentUrls = new Set(recentTopics.map(t => t.source_url));
  setShownArticleIds(recentUrls);
}
```

## User Experience Flow

### Scenario 1: Normal Scrolling
```
1. User opens Discover
   ↓ [0.5s]
2. Skeleton loading appears (6 cards)
   ↓ [20s]
3. 20 topics loaded and displayed
   ↓
4. User scrolls through topics
   ↓
5. At topic #15, "Load More" triggers
   ↓ [10s]
6. 15 more topics appear seamlessly
   ↓
7. User continues scrolling
   ↓
8. Repeat steps 5-7 until all sources used
   ↓
9. "You've seen all topics!" message
```

### Scenario 2: Pull to Refresh
```
1. User pulls down
   ↓
2. Refresh indicator appears
   ↓ [0.1s]
3. State reset:
   - shownArticleIds.clear()
   - currentPage = 0
   - hasMore = true
   - topics = []
   ↓ [20s]
4. Fresh 20 topics loaded
   ↓
5. User sees NEW content
```

### Scenario 3: Tab Switch
```
1. User on "For You" tab (page 3, 50 topics loaded)
   ↓
2. User taps "Interests" tab
   ↓ [0.1s]
3. Interests state loaded (independent):
   - Different shownArticleIds
   - Different currentPage
   - Different topics array
   ↓
4. User sees Interests feed (may be at page 0 or 2)
   ↓
5. User taps back to "For You"
   ↓
6. "For You" state restored (still at page 3, 50 topics)
```

## State Management

### Per-Tab State
```typescript
// For You Tab State
const [forYouTopics, setForYouTopics] = useState<ProactiveTopic[]>([]);
const [forYouPage, setForYouPage] = useState(0);
const [forYouShownIds, setForYouShownIds] = useState<Set<string>>(new Set());
const [forYouHasMore, setForYouHasMore] = useState(true);

// Interests Tab State
const [interestsTopics, setInterestsTopics] = useState<ProactiveTopic[]>([]);
const [interestsPage, setInterestsPage] = useState(0);
const [interestsShownIds, setInterestsShownIds] = useState<Set<string>>(new Set());
const [interestsHasMore, setInterestsHasMore] = useState(true);

// Shared State
const [loading, setLoading] = useState(false);
const [loadingMore, setLoadingMore] = useState(false);
const [refreshing, setRefreshing] = useState(false);
```

### State Transitions
```
Initial State:
  topics: []
  page: 0
  shownIds: Set([])
  hasMore: true
  loading: true

After Initial Load:
  topics: [20 topics]
  page: 0
  shownIds: Set([20 URLs])
  hasMore: true
  loading: false

After First Scroll Load:
  topics: [35 topics]
  page: 1
  shownIds: Set([35 URLs])
  hasMore: true
  loadingMore: false

After All Sources Exhausted:
  topics: [150+ topics]
  page: 10
  shownIds: Set([150+ URLs])
  hasMore: false
  loadingMore: false

After Refresh:
  topics: [20 topics]
  page: 0
  shownIds: Set([20 URLs])
  hasMore: true
  refreshing: false
```

## API Design

### fetchNextBatch Function
```typescript
fetchNextBatch(
  userId: string,
  feedType: 'foryou' | 'interests',
  page: number,
  excludeUrls: string[]
): Promise<ProactiveTopic[]>

// Example calls:
// Page 0 (initial): fetchNextBatch(userId, 'foryou', 0, [])
// Page 1 (scroll):  fetchNextBatch(userId, 'foryou', 1, ['url1', 'url2', ...])
// Page 2 (scroll):  fetchNextBatch(userId, 'foryou', 2, ['url1', 'url2', ...])
```

### Response Structure
```typescript
[
  {
    id: 'feed-abc123-0',
    topic: '💻 Technology',
    message: 'Low-key big news: "AI breakthrough..." wild or what?',
    source_url: 'https://engadget.com/article',
    source_title: 'AI breakthrough in quantum computing',
    category: 'technology',
    interests: ['technology', 'AI'],
    // ... other fields
  },
  // ... 14 more topics
]
```

## Edge Cases Handled

### 1. Duplicate Articles
```
Problem: Same article from multiple sources
Solution: Track by source_url, filter duplicates
```

### 2. Slow/Failed Sources
```
Problem: Some RSS feeds timeout or fail
Solution: Promise.allSettled + continue with successful ones
```

### 3. No More Content
```
Problem: All sources exhausted
Solution: Set hasMore = false, show end message
```

### 4. Rapid Scrolling
```
Problem: User scrolls fast, triggers multiple loads
Solution: loadingMore flag prevents concurrent requests
```

### 5. Tab Switch During Load
```
Problem: User switches tabs while loading
Solution: Per-tab state, cancel previous requests
```

### 6. Network Failure
```
Problem: No internet connection
Solution: Show error, keep existing topics, allow retry
```

## Performance Metrics

### Target Metrics
- **Initial Load**: < 25 seconds
- **Scroll Load**: < 10 seconds
- **Memory Usage**: < 50MB for 100 topics
- **Smooth Scrolling**: 60 FPS maintained
- **No Duplicates**: 100% accuracy

### Monitoring
```typescript
// Add performance logging
console.time('fetchNextBatch');
const topics = await fetchNextBatch(...);
console.timeEnd('fetchNextBatch');

console.log('Topics loaded:', topics.length);
console.log('Unique sources:', new Set(topics.map(t => t.source_url)).size);
console.log('Memory usage:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
```

## Summary

✅ **Infinite content** - Never run out of topics
✅ **No duplicates** - Smart URL tracking
✅ **Fast loading** - Parallel fetching, smart pagination
✅ **Smooth UX** - Loads before user reaches bottom
✅ **Source variety** - Rotates through all 45+ sources
✅ **Per-tab state** - Independent pagination for each tab
✅ **Memory efficient** - Keeps only recent 100 topics
✅ **Error resilient** - Handles failures gracefully

This design provides a TikTok-style infinite feed experience! 🚀
