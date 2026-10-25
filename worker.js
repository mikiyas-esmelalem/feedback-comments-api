
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "feedback-comments-api",
        databaseConfigured: Boolean(env.DB)
      }, { headers });
    }

    if (url.pathname === "/api/db-test") {
      try {
        const result = await env.DB
          .prepare("SELECT COUNT(*) AS total FROM feedback")
          .first();

        return Response.json({
          ok: true,
          databaseConnected: true,
          feedbackCount: result.total
        }, { headers });
      } catch (error) {
        return Response.json({
          ok: false,
          error: "Database test failed. Check the DB binding and feedback table."
        }, { status: 500, headers });
      }
    }

    return Response.json({
      ok: true,
      message: "Feedback & Comments API is running."
    }, { headers });
  }
};
