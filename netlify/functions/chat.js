exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "POST required." }),
    };
  }

  try {
    const { messages, message } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "GEMINI_API_KEY is missing in Netlify environment variables.",
        }),
      };
    }

    const history = Array.isArray(messages)
      ? messages
          .filter(
            (m) =>
              m &&
              ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string"
          )
          .slice(-12)
      : typeof message === "string"
        ? [{ role: "user", content: message }]
        : [];

    if (
      history.length === 0 ||
      history.some((m) => m.content.length > 10000)
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Please enter a valid message." }),
      };
    }

    const contents = history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "You are Aether AI, a helpful and friendly assistant. Answer directly. Keep greetings and simple questions short. For coding requests, provide useful working code in readable code blocks. Never claim to have performed actions you did not perform.",
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
      console.error("Gemini error:", response.status, data.error?.message);

      return {
        statusCode: 502,
        body: JSON.stringify({
          error:
            response.status === 429
              ? "AI usage limit reached. Try again later."
              : "Gemini could not answer. Check your API key and settings.",
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
        body: JSON.stringify({ error: "Gemini returned an empty answer." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    console.error("Aether chat error:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "The AI server encountered an error.",
      }),
    };
  }
};
