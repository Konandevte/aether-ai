exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { message } = JSON.parse(event.body || "{}");

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message is required." }),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "GEMINI_API_KEY environment variable is missing in Netlify.",
        }),
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: message }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || "Error communicating with Gemini API.",
        }),
      };
    }

    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated from AI.";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reply: replyText }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};
