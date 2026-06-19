/**
 * Tavily Search Proxy — безопасный API proxy для хранения ключей на сервере
 * 
 * Использование:
 * POST /api/tavily
 * Body: { query, search_depth?, max_results?, include_answer? }
 * 
 * API ключ берётся из переменной окружения TAVILY_API_KEY (на Vercel)
 */

export default async function handler(req, res) {
  // Только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Server error: TAVILY_API_KEY not configured in Vercel' 
      });
    }

    const { 
      query, 
      search_depth = 'advanced', 
      max_results = 8, 
      include_answer = true 
    } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth,
        max_results,
        include_answer,
      }),
    });

    if (!tavilyRes.ok) {
      const error = await tavilyRes.text();
      return res.status(tavilyRes.status).json({ 
        error: `Tavily error: ${error}` 
      });
    }

    const data = await tavilyRes.json();
    
    return res.status(200).json({
      results: data.results || [],
      answer: data.answer || null,
    });

  } catch (error) {
    console.error('Tavily proxy error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
