/**
 * Article Content Fetcher
 * Fetches full article content from URLs for AI context
 */

export interface ArticleContent {
  title: string;
  content: string;
  excerpt: string;
  url: string;
  error?: string;
}

/**
 * Fetch article content from a URL
 * Uses a web scraping service or fallback methods
 */
export async function fetchArticleContent(url: string): Promise<ArticleContent | null> {
  if (!url) {
    return null;
  }

  try {
    console.log('[ArticleFetcher] 📰 Fetching full article from:', url);

    // Try using a free article extraction API
    // Option 1: Mercury Parser API (if available)
    // Option 2: Jina AI Reader (free tier available)
    // Option 3: Direct fetch with basic parsing

    // Using Jina AI Reader - free and works well
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(jinaUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Return-Format': 'text', // Get clean text
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[ArticleFetcher] ⚠️ Jina AI failed with status:', response.status);
        console.warn('[ArticleFetcher] 🔄 Trying direct fetch as fallback...');
        return await fetchArticleDirectly(url);
      }

      const text = await response.text();
      
      // Check if we got meaningful content
      if (!text || text.length < 100) {
        console.warn('[ArticleFetcher] ⚠️ Content too short, trying direct fetch');
        return await fetchArticleDirectly(url);
      }
      
      // Extract title and content from the response
      const lines = text.split('\n').filter(line => line.trim());
      const title = lines[0] || 'Article';
      const content = lines.slice(1).join('\n').trim();
      
      // Create excerpt (first 200 characters)
      const excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');

      console.log('[ArticleFetcher] ✅ Successfully fetched article:', {
        title: title.substring(0, 50) + '...',
        contentLength: content.length,
        hasContent: content.length > 0,
      });

      return {
        title,
        content,
        excerpt,
        url,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[ArticleFetcher] ⏱️ Jina AI timeout, trying direct fetch');
      } else {
        console.warn('[ArticleFetcher] ⚠️ Jina AI error:', fetchError);
      }
      return await fetchArticleDirectly(url);
    }
  } catch (error) {
    console.error('[ArticleFetcher] ❌ Error fetching article:', error);
    return {
      title: 'Article',
      content: '',
      excerpt: '',
      url,
      error: error instanceof Error ? error.message : 'Failed to fetch article',
    };
  }
}

/**
 * Fallback: Direct fetch and basic HTML parsing
 */
async function fetchArticleDirectly(url: string): Promise<ArticleContent | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProactiveAI/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Basic HTML parsing - extract text from common article tags
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Article';

    // Try to extract main content from common article containers
    const contentPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
    ];

    let contentHtml = '';
    for (const pattern of contentPatterns) {
      const match = html.match(pattern);
      if (match) {
        contentHtml = match[1];
        break;
      }
    }

    // If no content found, use body
    if (!contentHtml) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      contentHtml = bodyMatch ? bodyMatch[1] : html;
    }

    // Strip HTML tags and clean up
    const content = contentHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');

    return {
      title,
      content: content.substring(0, 5000), // Limit to 5000 chars
      excerpt,
      url,
    };
  } catch (error) {
    console.error('[ArticleFetcher] Direct fetch failed:', error);
    return null;
  }
}

/**
 * Batch fetch multiple articles
 */
export async function fetchMultipleArticles(urls: string[]): Promise<Map<string, ArticleContent>> {
  const results = new Map<string, ArticleContent>();
  
  // Fetch in parallel with limit
  const BATCH_SIZE = 3;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const promises = batch.map(url => fetchArticleContent(url));
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach((result, index) => {
      if (result) {
        results.set(batch[index], result);
      }
    });
  }
  
  return results;
}
