// Lightweight trending topics fetchers using public endpoints (no API keys)
// Sources: Reddit (r/news, r/worldnews, r/technology, r/sports), Hacker News Top Stories
// Returns a de-duplicated list of recent trending headlines suitable for LLM conditioning.

export const getTrendingTopics = async (): Promise<string[]> => {
  try {
    const [reddit, hn] = await Promise.all([
      fetchRedditHeadlines(['news', 'worldnews', 'technology', 'sports'], 5),
      fetchHackerNewsTitles(10),
    ]);

    const combined = [...reddit, ...hn]
      .map((t) => sanitize(t))
      .filter(Boolean);

    // De-duplicate while preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const t of combined) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(t);
      }
    }

    // Limit to a reasonable number to keep prompts compact
    return deduped.slice(0, 20);
  } catch (e) {
    console.error('Trending fetch error:', e);
    return [];
  }
};

const fetchRedditHeadlines = async (subs: string[], perSub: number): Promise<string[]> => {
  const headers: HeadersInit = {
    'User-Agent': 'ProactiveAI/1.0 (+https://example.com)'
  };
  try {
    const results = await Promise.all(
      subs.map(async (sub) => {
        const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${perSub}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return [] as string[];
        const data = await res.json();
        const children = data?.data?.children || [];
        return children
          .map((c: any) => c?.data?.title as string)
          .filter((t: any) => typeof t === 'string');
      })
    );
    return results.flat();
  } catch (e) {
    console.warn('Reddit fetch error:', e);
    return [];
  }
};

const fetchHackerNewsTitles = async (limit: number): Promise<string[]> => {
  try {
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topRes.ok) return [];
    const ids: number[] = await topRes.json();
    const pick = ids.slice(0, limit);
    const items = await Promise.all(
      pick.map(async (id) => {
        try {
          const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!r.ok) return '';
          const j = await r.json();
          return (j?.title as string) || '';
        } catch {
          return '';
        }
      })
    );
    return items.filter(Boolean);
  } catch (e) {
    console.warn('HN fetch error:', e);
    return [];
  }
};

const sanitize = (s: string): string =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
