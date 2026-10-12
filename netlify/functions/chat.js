```javascript
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Use POST to send a message." }),
    };
  }

  try {
    const { message, messages } = JSON.parse(event.body || "{}");

    if (!process.env.GEMINI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "AI server is not configured. Check the GEMINI_API_KEY setting in Netlify.",
        }),
      };
    }

    const conversation = Array.isArray(messages)
      ? messages
          .filter(
            (item) =>
              ["user", "assistant"].includes(item.role) &&
              typeof item.content === "string"
          )
          .slice(-12)
      : typeof message === "string"
        ? [{ role: "user", content: message }]
        : [];

    if (
      conversation.length === 0 ||
      conversation.some((item) => item.content.length > 10000)
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Please send a valid message." }),
      };
    }

    const contents = conversation.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "You are Aether AI, a helpful, friendly assistant. Answer directly and clearly. Keep simple greetings and simple questions short. For coding requests, provide working code in readable code blocks. Never claim to have performed actions you did not perform.",
              },
            ],
            },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data.error?.message);

      return {
        statusCode: 502,
        body: JSON.stringify({
          error:
            response.status === 429
              ? "AI usage limit reached. Please try again later."
              : "The AI service could not answer. Check your Gemini API settings.",
        }),
      };
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "The AI returned an empty response. Try again." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    console.error("Chat function error:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong on the AI server." }),
    };
  }
};
```
