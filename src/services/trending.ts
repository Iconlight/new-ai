// Lightweight trending topics fetchers using public endpoints (no API keys)
// Sources: Reddit (r/news, r/worldnews, r/technology, r/sports), Hacker News Top Stories
// Returns a de-duplicated list of recent trending headlines suitable for LLM conditioning.

export const getTrendingTopics = async (): Promise<string[]> => {
  try {
    console.log('🔍 Fetching trending topics...');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    console.log(`📅 Date: ${yyyy}/${mm}/${dd}`);

    const [reddit, hn, wiki] = await Promise.all([
      fetchRedditHeadlines(['news', 'worldnews', 'technology', 'sports'], 5),
      fetchHackerNewsTitles(10),
      fetchWikipediaNews(`${yyyy}/${mm}/${dd}`),
    ]);
    
    console.log(`📰 Trending sources: Reddit(${reddit.length}), HN(${hn.length}), Wiki(${wiki.length})`);

    const combined = [...wiki, ...reddit, ...hn]
      .map((t) => sanitize(t))
      .filter(Boolean);
      
    console.log(`✅ Combined trending topics (${combined.length}):`, combined.slice(0, 5));

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
    const final = deduped.slice(0, 20);
    console.log(`🎯 Final trending list (${final.length}):`, final.slice(0, 3));
    return final;
  } catch (e) {
    console.error('❌ Trending fetch error:', e);
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

const fetchWikipediaNews = async (ymd: string): Promise<string[]> => {
  // Wikipedia Featured feed includes an "In the news" section for the given date
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${ymd}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const news = data?.news as Array<{ story?: string; links?: Array<{ title?: string }> }> | undefined;
    if (!news || !Array.isArray(news)) return [];

    const items: string[] = [];
    for (const n of news) {
      if (n?.story) items.push(n.story);
      const linkTitles = (n?.links || []).map((l: any) => l?.title).filter((t: any) => typeof t === 'string');
      items.push(...linkTitles);
    }
    return items;
  } catch (e) {
    console.warn('Wikipedia fetch error:', e);
    return [];
  }
};

const sanitize = (s: string): string =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
