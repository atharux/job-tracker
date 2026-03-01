/**
 * Serverless function to parse resumes using Claude API
 * This keeps the API key secure on the backend
 * 
 * Deploy this to Vercel, Netlify, or your preferred serverless platform
 * Set ANTHROPIC_API_KEY in your environment variables
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Resume content is required' });
  }

  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(503).json({ 
      error: 'AI parsing service not configured',
      allowManualEntry: true 
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Analyze this resume and extract structured data. Return ONLY valid JSON with this exact structure:

{
  "summary": "Professional summary text (optional)",
  "experience": [
    {
      "company": "Company Name",
      "position": "Job Title",
      "location": "City, State (optional)",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "achievements": ["Achievement 1", "Achievement 2"],
      "technologies": ["Tech 1", "Tech 2"] (optional)
    }
  ],
  "education": [
    {
      "institution": "School Name",
      "degree": "Degree Name",
      "field": "Field of Study",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM",
      "gpa": "3.8" (optional),
      "honors": ["Honor 1", "Honor 2"] (optional)
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "languages": ["language1", "language2"],
    "tools": ["tool1", "tool2"]
  },
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "YYYY-MM",
      "expiryDate": "YYYY-MM" (optional),
      "credentialId": "ID123" (optional)
    }
  ]
}

Resume content:
${content.substring(0, 10000)}`
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Claude API error:', errorData);
      return res.status(response.status).json({ 
        error: 'AI parsing failed',
        allowManualEntry: true 
      });
    }

    const data = await response.json();
    const messageContent = data.content?.[0]?.text || '';
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = messageContent;
    if (messageContent.includes('```json')) {
      jsonText = messageContent.split('```json')[1].split('```')[0].trim();
    } else if (messageContent.includes('```')) {
      jsonText = messageContent.split('```')[1].split('```')[0].trim();
    }
    
    // Parse and validate JSON
    const parsedData = JSON.parse(jsonText);
    
    // Validate required fields
    if (!parsedData.experience && !parsedData.education && !parsedData.skills) {
      return res.status(400).json({ 
        error: 'No valid resume data extracted',
        allowManualEntry: true 
      });
    }

    return res.status(200).json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    console.error('Resume parsing error:', error);
    return res.status(500).json({ 
      error: 'Failed to parse resume',
      allowManualEntry: true,
      details: error.message
    });
  }
}
