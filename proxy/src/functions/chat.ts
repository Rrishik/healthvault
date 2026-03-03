import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// In-memory rate limiting (resets on cold start)
const rateLimitMap = new Map<string, number[]>();

function getCorsHeaders(req: HttpRequest): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  const corsOrigin = allowed.includes(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-access-code',
  };
}

function checkRateLimit(ip: string): boolean {
  const limit = parseInt(process.env.RATE_LIMIT_PER_HOUR || '20');
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  const timestamps = rateLimitMap.get(ip)!.filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    rateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

async function chat(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders };
  }

  // Reject disallowed origins
  if (!corsHeaders['Access-Control-Allow-Origin']) {
    return {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  // Access code check
  const accessCode = process.env.ACCESS_CODE;
  if (accessCode) {
    const provided = req.headers.get('x-access-code') || '';
    if (provided !== accessCode) {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or missing access code' }),
      };
    }
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
    };
  }

  // Read environment
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, '');
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
  const maxTokens = parseInt(process.env.MAX_TOKENS || '4096');

  if (!endpoint || !deployment || !apiKey) {
    return {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy misconfigured' }),
    };
  }

  // Parse and validate body
  let body: { messages?: unknown[]; max_tokens?: number; response_format?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  if (!body?.messages || !Array.isArray(body.messages)) {
    return {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing messages array' }),
    };
  }

  // Body size limit (prevent abuse with large payloads)
  const bodyStr = JSON.stringify(body);
  if (bodyStr.length > 4_000_000) {
    return {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Request body too large (max 4MB)' }),
    };
  }

  // Validate message structure
  for (const msg of body.messages) {
    if (
      typeof msg !== 'object' ||
      msg === null ||
      typeof (msg as Record<string, unknown>).role !== 'string'
    ) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid message format: each message must have a role string' }),
      };
    }
  }

  // Build proxy request
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const proxyBody: Record<string, unknown> = {
    messages: body.messages,
    max_completion_tokens: Math.min(body.max_tokens || maxTokens, maxTokens),
  };

  if (body.response_format) {
    proxyBody.response_format = body.response_format;
  }

  try {
    const aiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(proxyBody),
    });

    const aiBody = await aiRes.text();

    return {
      status: aiRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: aiBody,
    };
  } catch (err) {
    return {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy error: ' + (err instanceof Error ? err.message : String(err)) }),
    };
  }
}

app.http('chat', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: chat,
});
