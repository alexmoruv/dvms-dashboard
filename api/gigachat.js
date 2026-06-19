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

// Генерация UUID v4 для заголовка RqUID
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getGigachatToken(apiKey, rquid) {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  // Authorization Key из личного кабинета — это уже готовая base64-строка,
  // передаём её как есть, без повторного кодирования
  const res = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rquid,
      'Authorization': `Basic ${apiKey}`,
    },
    body: 'scope=GIGACHAT_API_PERS',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gigachat auth failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  tokenCache.token = data.access_token;
  // expires_at приходит в миллисекундах (Unix timestamp), либо expires_in в секундах
  tokenCache.expiresAt = data.expires_at
    ? data.expires_at - 60000
    : now + (1800 * 1000 - 60000);

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

    const requestRquid = uuidv4();
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
