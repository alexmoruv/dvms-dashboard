/**
 * Gigachat Proxy — безопасный API proxy для хранения ключей на сервере
 * 
 * Использование:
 * POST /api/gigachat
 * Body: { messages, system?, max_tokens?, rquid? }
 * 
 * API ключ берётся из переменной окружения GIGACHAT_API_KEY (на Vercel)
 */

let tokenCache = { token: null, expiresAt: 0 };

async function getGigachatToken(apiKey, rquid) {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${apiKey}:`).toString('base64');
  
  const res = await fetch('https://auth.api.sberbank.ru/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rquid,
      'Authorization': `Basic ${credentials}`,
    },
    body: 'scope=GIGACHAT_API_PERS&grant_type=client_credentials',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gigachat auth failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = now + (data.expires_in * 1000 - 60000);
  
  return data.access_token;
}

export default async function handler(req, res) {
  // Только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GIGACHAT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Server error: GIGACHAT_API_KEY not configured in Vercel' 
      });
    }

    const { messages, system, max_tokens = 4000, rquid } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const requestRquid = rquid || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const token = await getGigachatToken(apiKey, requestRquid);

    // Формируем messages с system если нужен
    const finalMessages = [];
    if (system) {
      finalMessages.push({ role: 'system', content: system });
    }
    finalMessages.push(...messages);

    const gigachatRes = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Client-ID': requestRquid,
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: finalMessages,
        max_tokens,
        temperature: 0.7,
      }),
    });

    if (!gigachatRes.ok) {
      const error = await gigachatRes.text();
      return res.status(gigachatRes.status).json({ 
        error: `Gigachat error: ${error}` 
      });
    }

    const data = await gigachatRes.json();
    
    // Преобразуем в Claude-compatible формат
    return res.status(200).json({
      content: [
        {
          type: 'text',
          text: data.choices?.[0]?.message?.content || '',
        }
      ]
    });

  } catch (error) {
    console.error('Gigachat proxy error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
