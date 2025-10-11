import { supabase } from './supabase';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  relevanceScore?: number;
}

export interface TrendingTopic {
  topic: string;
  category: string;
  relevance: number;
  articles: NewsArticle[];
}

// Using NewsAPI as the primary source - you'll need to add EXPO_PUBLIC_NEWS_API_KEY to your .env
const NEWS_API_KEY = process.env.EXPO_PUBLIC_NEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

// Fallback to free news sources if NewsAPI key is not available
const FREE_NEWS_SOURCES = [
  'https://rss.cnn.com/rss/edition.rss',
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://www.reddit.com/r/worldnews/.rss'
];

export class NewsService {
  private static instance: NewsService;
  private cachedNews: NewsArticle[] = [];
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  // Clear cached news to force fresh fetch
  async clearCache(): Promise<void> {
    console.log('🗑️ Clearing news cache...');
    this.cachedNews = [];
    this.lastFetch = null;
  }

  // Get all RSS sources (for pagination)
  getAllSources(): Array<{url: string, category: string}> {
    return this.rssSources;
  }

  // Fetch from specific sources (for pagination)
  async fetchFromSources(sources: Array<{url: string, category: string}>): Promise<NewsArticle[]> {
    return this.fetchFromSpecificSources(sources);
  }

  async fetchCurrentNews(categories: string[] = ['general', 'technology', 'science', 'business', 'health', 'entertainment', 'sports']): Promise<NewsArticle[]> {
    // Return cached news if still fresh
    if (this.cachedNews.length > 0 && this.lastFetch && 
        Date.now() - this.lastFetch.getTime() < this.CACHE_DURATION) {
      return this.cachedNews;
    }

    try {
      let articles: NewsArticle[] = [];

      if (NEWS_API_KEY) {
        articles = await this.fetchFromNewsAPI(categories);
        // If API returns nothing (rate limit/network), fallback to free source
        if (!articles || articles.length === 0) {
          articles = await this.fetchFromFreeSource();
        }
      } else {
        articles = await this.fetchFromFreeSource();
      }

      this.cachedNews = articles;
      this.lastFetch = new Date();
      
      // Store in database for offline access
      await this.storeNewsInDB(articles);
      
      return articles;
    } catch (error) {
      console.error('Error fetching news:', error);
      // Return cached news or database fallback
      return this.cachedNews.length > 0 ? this.cachedNews : await this.getStoredNews();
    }
  }

  private async fetchFromNewsAPI(categories: string[]): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    
    for (const category of categories) {
      try {
        const response = await fetch(
          `${NEWS_API_BASE_URL}/top-headlines?category=${category}&country=us&pageSize=10&apiKey=${NEWS_API_KEY}`
        );
        
        if (!response.ok) continue;
        
        const data = await response.json();
        
        const categoryArticles: NewsArticle[] = data.articles?.map((article: any) => ({
          id: `${article.source.id || 'unknown'}-${Date.now()}-${Math.random()}`,
          title: article.title,
          description: article.description || '',
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt,
          category: category,
        })) || [];
        
        articles.push(...categoryArticles);
      } catch (error) {
        console.error(`Error fetching ${category} news:`, error);
      }
    }
    
    return articles;
  }

  private async fetchFromFreeSource(sourcesToFetch?: typeof this.rssSources): Promise<NewsArticle[]> {
    console.log('📡 Fetching real news from RSS feeds...');
    
    // Use provided sources or all sources
    const rssSources = sourcesToFetch || this.rssSources;
    
    return this.fetchFromSpecificSources(rssSources);
  }

  // All RSS sources (moved to class property for reusability)
  // Ordered by speed/reliability - fast sources first for better initial load
  private rssSources = [
      // BBC feeds (most reliable and FAST - prioritized)
      { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'technology' },
      { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'science' },
      { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'business' },
      { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', category: 'health' },
      { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'general' },
      
      // Reddit (FAST - prioritized)
      { url: 'https://www.reddit.com/r/technology/.rss', category: 'technology' },
      { url: 'https://www.reddit.com/r/science/.rss', category: 'science' },
      { url: 'https://www.reddit.com/r/worldnews/.rss', category: 'general' },
      { url: 'https://www.reddit.com/r/business/.rss', category: 'business' },
      { url: 'https://www.reddit.com/r/health/.rss', category: 'health' },
      
      // Technology
      { url: 'https://www.engadget.com/rss.xml', category: 'technology' },
      { url: 'https://rss.cnet.com/rss/news/', category: 'technology' },
      { url: 'https://feeds.feedburner.com/oreilly/radar', category: 'technology' },
      { url: 'https://www.wired.com/feed/rss', category: 'technology' },
      { url: 'https://feeds.feedburner.com/TechCrunch/', category: 'technology' },
      { url: 'https://www.theverge.com/rss/index.xml', category: 'technology' },
      { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'technology' },
      
      // Science
      { url: 'https://www.sciencedaily.com/rss/all.xml', category: 'science' },
      { url: 'https://www.scientificamerican.com/feed/', category: 'science' },
      { url: 'https://www.newscientist.com/feed/home', category: 'science' },
      
      // Health & Medicine
      { url: 'https://www.medicalnewstoday.com/rss', category: 'health' },
      { url: 'https://www.healthline.com/rss', category: 'health' },
      { url: 'https://www.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', category: 'health' },
      
      // Business & Finance
      { url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'business' },
      { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'business' },
      { url: 'https://www.forbes.com/real-time/feed2/', category: 'business' },
      
      // Entertainment
      { url: 'https://www.hollywoodreporter.com/feed/', category: 'entertainment' },
      { url: 'https://variety.com/feed/', category: 'entertainment' },
      { url: 'https://ew.com/feed/', category: 'entertainment' },
      { url: 'https://www.rollingstone.com/feed/', category: 'entertainment' },
      
      // Sports
      { url: 'https://www.espn.com/espn/rss/news', category: 'sports' },
      { url: 'https://www.cbssports.com/rss/headlines/', category: 'sports' },
      { url: 'https://www.si.com/rss/si_topstories.rss', category: 'sports' },
      
      // More Reddit (diverse topics)
      { url: 'https://www.reddit.com/r/entertainment/.rss', category: 'entertainment' },
      { url: 'https://www.reddit.com/r/sports/.rss', category: 'sports' },
      
      // General News
      { url: 'https://feeds.feedburner.com/time/topstories', category: 'general' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'general' },
      { url: 'https://www.theguardian.com/world/rss', category: 'general' },
    ];

  // Parallel fetching with batching for better performance
  private async fetchFromSpecificSources(sources: Array<{url: string, category: string}>): Promise<NewsArticle[]> {
    const BATCH_SIZE = 15; // Fetch 15 sources in parallel (increased for speed)
    const TIMEOUT_MS = 3000; // Reduced to 3 seconds for faster loading
    const articles: NewsArticle[] = [];
    
    console.log(`📡 Fetching from ${sources.length} sources in batches of ${BATCH_SIZE}...`);
    
    // Process sources in batches
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch = sources.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sources.length / BATCH_SIZE)}`);
      
      // Fetch batch in parallel using Promise.allSettled
      const batchPromises = batch.map(source => this.fetchSingleSource(source, TIMEOUT_MS));
      const results = await Promise.allSettled(batchPromises);
      
      // Collect successful results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          articles.push(...result.value);
          console.log(`✅ Got ${result.value.length} articles from ${batch[index].url}`);
        } else if (result.status === 'rejected') {
          console.warn(`⚠️ Failed to fetch ${batch[index].url}`);
        }
      });
    }
    
    console.log(`📰 Total articles fetched: ${articles.length} from ${sources.length} sources`);
    return articles;
  }

  // Fetch a single RSS source with timeout
  private async fetchSingleSource(source: {url: string, category: string}, timeoutMs: number): Promise<NewsArticle[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'ProactiveAI/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      return this.parseRSSFeed(xmlText, source.category);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  private parseRSSFeed(xmlText: string, category: string): NewsArticle[] {
    const articles: NewsArticle[] = [];
    
    try {
      // Simple XML parsing for RSS feeds
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      const titleRegex = /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i;
      const descRegex = /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i;
      const linkRegex = /<link[^>]*>(.*?)<\/link>/i;
      const pubDateRegex = /<pubDate[^>]*>(.*?)<\/pubDate>/i;
      
      let match;
      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemXml = match[1];
        
        const titleMatch = titleRegex.exec(itemXml);
        const descMatch = descRegex.exec(itemXml);
        const linkMatch = linkRegex.exec(itemXml);
        const pubDateMatch = pubDateRegex.exec(itemXml);
        
        const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
        const description = (descMatch?.[1] || descMatch?.[2] || '').trim();
        const url = (linkMatch?.[1] || '').trim();
        const pubDate = (pubDateMatch?.[1] || '').trim();
        
        if (title && url) {
          articles.push({
            id: `rss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: this.cleanHtml(title),
            description: this.cleanHtml(description),
            url,
            source: this.extractSourceFromUrl(url),
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            category,
          });
        }
      }
    } catch (error) {
      console.error('Error parsing RSS feed:', error);
    }
    
    return articles;
  }

  private cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private extractSourceFromUrl(url: string): string {
    try {
      const domain = new URL(url).hostname;
      if (domain.includes('bbc.co.uk')) return 'BBC News';
      if (domain.includes('cnn.com')) return 'CNN';
      if (domain.includes('reuters.com')) return 'Reuters';
      if (domain.includes('natgeo.com')) return 'National Geographic';
      if (domain.includes('cnet.com')) return 'CNET';
      return domain.replace('www.', '');
    } catch {
      return 'Unknown Source';
    }
  }

  private async storeNewsInDB(articles: NewsArticle[]): Promise<void> {
    try {
      const newsData = articles.map(article => ({
        external_id: article.id,
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source,
        published_at: article.publishedAt,
        category: article.category,
        created_at: new Date().toISOString(),
      }));

      await supabase
        .from('news_articles')
        .upsert(newsData, { onConflict: 'external_id' });
    } catch (error) {
      console.error('Error storing news in database:', error);
    }
  }

  private async getStoredNews(): Promise<NewsArticle[]> {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('published_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return data?.map(article => ({
        id: article.external_id,
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source,
        publishedAt: article.published_at,
        category: article.category,
      })) || [];
    } catch (error) {
      console.error('Error fetching stored news:', error);
      return [];
    }
  }

  async getTrendingTopics(userInterests: string[]): Promise<TrendingTopic[]> {
    const news = await this.fetchCurrentNews();
    
    // Group news by category, including all trending topics (not just user interests)
    const topicMap = new Map<string, { articles: NewsArticle[], relevance: number }>();
    
    news.forEach(article => {
      const relevance = this.calculateRelevance(article, userInterests);
      const topic = article.category;
      
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { articles: [], relevance: 0 });
      }
      const existing = topicMap.get(topic)!;
      existing.articles.push(article);
      existing.relevance = Math.max(existing.relevance, relevance);
    });

    return Array.from(topicMap.entries()).map(([topic, data]) => ({
      topic,
      category: topic,
      relevance: data.relevance,
      articles: data.articles.slice(0, 3), // Top 3 articles per topic
    })).sort((a, b) => b.relevance - a.relevance);
  }

  // New method for broader trending topics (not filtered by user interests)
  async getGeneralTrendingTopics(): Promise<TrendingTopic[]> {
    const news = await this.fetchCurrentNews();
    
    // Group all news by category without filtering
    const topicMap = new Map<string, { articles: NewsArticle[], relevance: number }>();
    
    news.forEach(article => {
      const topic = article.category;
      const baseRelevance = this.getBaseRelevance(article);
      
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { articles: [], relevance: 0 });
      }
      const existing = topicMap.get(topic)!;
      existing.articles.push(article);
      existing.relevance = Math.max(existing.relevance, baseRelevance);
    });

    return Array.from(topicMap.entries()).map(([topic, data]) => ({
      topic,
      category: topic,
      relevance: data.relevance,
      articles: data.articles.slice(0, 3),
    })).sort((a, b) => b.relevance - a.relevance);
  }

  private getBaseRelevance(article: NewsArticle): number {
    // Base relevance without user interest filtering
    const categoryBoosts: Record<string, number> = {
      'technology': 0.8,
      'science': 0.7,
      'business': 0.6,
      'health': 0.7,
      'general': 0.5,
      'entertainment': 0.4,
      'sports': 0.4,
      'environment': 0.6,
    };
    
    return categoryBoosts[article.category] || 0.5;
  }

  private calculateRelevance(article: NewsArticle, userInterests: string[]): number {
    const text = `${article.title} ${article.description}`.toLowerCase();
    let relevance = 0;
    
    userInterests.forEach(interest => {
      if (text.includes(interest.toLowerCase())) {
        relevance += 0.5;
      }
    });
    
    // Boost for certain categories
    const categoryBoosts: Record<string, number> = {
      'technology': 0.3,
      'science': 0.3,
      'business': 0.2,
      'health': 0.4,
    };
    
    relevance += categoryBoosts[article.category] || 0.1;
    
    return Math.min(relevance, 1.0);
  }

}

export const newsService = NewsService.getInstance();
