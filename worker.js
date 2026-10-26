
const SITE = "https://feedbackandcomments.pages.dev";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": SITE,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    }
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (origin && origin !== SITE) {
      return Response.json(
        { ok: false, error: "Origin not allowed" },
        { status: 403 }
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": SITE,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Vary": "Origin"
        }
      });
    }

    if (request.method === "GET" &&
        url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "feedback-comments-api",
        databaseConfigured: Boolean(env.DB)
      });
    }

    if (request.method === "GET" &&
        url.pathname === "/api/db-test") {
      try {
        const result = await env.DB
          .prepare("SELECT COUNT(*) AS total FROM feedback")
          .first();

        return json({
          ok: true,
          databaseConnected: true,
          feedbackCount: result.total
        });
      } catch {
        return json({
          ok: false,
          error: "Database test failed"
        }, 500);
      }
    }

    if (request.method === "POST" &&
        url.pathname === "/api/feedback") {
      let body;

      try {
        if (Number(request.headers.get("Content-Length") || 0) > 12000) {
          return json({ ok: false, error: "Request too large" }, 413);
        }

        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
      }

      const categories = [
        "General Feedback",
        "Suggestion",
        "Complaint",
        "Question",
        "Report a Problem"
      ];

      const category = body.category;
      const message = typeof body.message === "string"
        ? body.message.trim()
        : "";
      const contact = typeof body.contact === "string"
        ? body.contact.trim()
        : "";

      const rating = body.rating == null || body.rating === ""
        ? null
        : Number(body.rating);

      if (!categories.includes(category)) {
        return json({ ok: false, error: "Invalid category" }, 400);
      }

      if (!message || message.length > 5000) {
        return json({
          ok: false,
          error: "Message must contain 1–5000 characters"
        }, 400);
      }

      if (contact.length > 200) {
        return json({ ok: false, error: "Contact is too long" }, 400);
      }

      if (rating !== null &&
          (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        return json({ ok: false, error: "Rating must be 1–5" }, 400);
      }

      const ticketId = crypto.randomUUID();
      const accessCode = crypto.randomUUID();
      const accessHash = await sha256(accessCode);

      try {
        await env.DB.prepare(`
          INSERT INTO feedback
            (id, access_hash, category, rating, message, contact)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          ticketId,
          accessHash,
          category,
          rating,
          message,
          contact || null
                ).run();

        // Send a Telegram notification after saving feedback
        try {
          const telegramResponse = await fetch(
            `https://api.telegram.org/bot${env.8967372662:AAHxMYgFCmM_1nUlTJmygW9KE52soxBGvZU`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                chat_id: env.942827410,
                text:
                  "📩 NEW FEEDBACK\n\n" +
                  "Ticket: " + ticketId + "\n" +
                  "Category: " + category + "\n" +
                  "Rating: " + (rating ?? "Not provided") + "\n" +
                  "Message: " + message + "\n" +
                  "Contact: " + (contact || "Not provided"),
                protect_content: true
              })
            }
          );

          if (!telegramResponse.ok) {
  const telegramError = await telegramResponse.text();
  console.error(
    "Telegram notification failed:",
    telegramResponse.status,
    telegramError
  );
}
        } catch (error) {
          console.error("Telegram notification request failed");
        }

        return json({
          ok: true,
          message: "Feedback saved",
          ticketId,
          accessCode
        }, 201);
      } catch {
        return json({
          ok: false,
          error: "Could not save feedback"
        }, 500);
      }
    }

    return json({
      ok: false,
      error: "Not found"
    }, 404);
  }
};
