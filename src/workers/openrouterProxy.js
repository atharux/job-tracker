export default {
  async fetch(request) {
    try {
      const body = await request.json();

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${body.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: body.model,
            messages: [
              {
                role: "user",
                content: body.prompt
              }
            ]
          })
        }
      );

      const data = await response.json();

      return Response.json({
        output:
          data?.choices?.[0]?.message?.content || ""
      });
    } catch (e) {
      return Response.json(
        {
          error: e.message
        },
        {
          status: 500
        }
      );
    }
  }
};