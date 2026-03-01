// Cloudflare Worker to proxy AI API calls (avoids CORS)

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        },
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const { provider, systemPrompt, userMessage, apiKey } = await request.json();

      let response;

      if (provider === 'claude') {
        // Use user's key if provided, otherwise use worker env key (if available)
        const claudeKey = apiKey || env.ANTHROPIC_API_KEY;
        
        if (!claudeKey) {
          return new Response(JSON.stringify({ 
            error: { 
              message: 'No API key provided. Please add your Anthropic API key in Settings or use Groq (free).' 
            } 
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          return new Response(JSON.stringify({ error: err }), {
            status: response.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({
            content: data.content?.map((b) => b.text || '').join('') || '',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      if (provider === 'groq') {
        // Use user's key if provided, otherwise use worker env key
        const groqKey = apiKey || env.GROQ_API_KEY;
        
        if (!groqKey) {
          return new Response(JSON.stringify({ 
            error: { 
              message: 'No API key provided. Get a free key at https://console.groq.com/' 
            } 
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          return new Response(JSON.stringify({ error: err }), {
            status: response.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({
            content: data.choices?.[0]?.message?.content || '',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      return new Response(JSON.stringify({ error: 'Invalid provider' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
