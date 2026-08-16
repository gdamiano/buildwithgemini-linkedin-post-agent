export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Setup CORS headers to allow requests from GitHub Pages
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle OPTIONS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: /event?name=...&count=...
    if (url.pathname === "/event") {
      const name = url.searchParams.get("name");
      const countStr = url.searchParams.get("count");
      const count = parseInt(countStr, 10) || 0;

      const allowedEvents = [
        "process_file_click",
        "linkedin_post_link_click",
        "linkedin_embed_link_click"
      ];

      if (!allowedEvents.includes(name)) {
        return new Response(JSON.stringify({ error: "Invalid event name" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        await env.DB.prepare(
          "INSERT INTO analytics_events (event_name, post_count) VALUES (?, ?)"
        )
        .bind(name, count)
        .run();

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Route: /report?key=...
    if (url.pathname === "/report") {
      const key = url.searchParams.get("key");
      
      // Compares with the env secret variable REPORT_SECRET_KEY, defaults to "admin"
      const secretKey = env.REPORT_SECRET_KEY || "admin";
      if (key !== secretKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        // Query daily breakdowns
        const dailyCounts = await env.DB.prepare(`
          SELECT 
            strftime('%Y-%m-%d', created_at) as date,
            event_name,
            COUNT(*) as occurrences,
            SUM(post_count) as total_posts,
            ROUND(AVG(post_count), 1) as avg_posts
          FROM analytics_events 
          GROUP BY date, event_name
          ORDER BY date DESC, event_name ASC
        `).all();

        // Query total summaries
        const totalSummaries = await env.DB.prepare(`
          SELECT 
            event_name,
            COUNT(*) as total_occurrences,
            SUM(post_count) as total_posts,
            ROUND(AVG(post_count), 1) as avg_posts
          FROM analytics_events 
          GROUP BY event_name
        `).all();

        return new Response(JSON.stringify({
          totals: totalSummaries.results,
          daily: dailyCounts.results
        }, null, 2), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
