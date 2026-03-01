// Netlify Function to proxy AI API calls (avoids CORS)

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { provider, systemPrompt, userMessage } = JSON.parse(event.body);

  try {
    if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
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
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: err })
        };
      }

      const data = await response.json();
      return {
        statusCode: 200,
        body: JSON.stringify({ content: data.content?.map(b => b.text || '').join('') || '' })
      };
    }

    if (provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: err })
        };
      }

      const data = await response.json();
      return {
        statusCode: 200,
        body: JSON.stringify({ content: data.choices?.[0]?.message?.content || '' })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid provider' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
