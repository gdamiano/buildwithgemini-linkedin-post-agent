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
        // 1. Insert the new event
        await env.DB.prepare(
          "INSERT INTO analytics_events (event_name, post_count) VALUES (?, ?)"
        )
        .bind(name, count)
        .run();

        // 2. Check if this is the first event in the last 1 hour
        const cooldownCheck = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM analytics_events WHERE created_at > datetime('now', '-1 hour')"
        ).first();

        // If count is exactly 1, it means this event was the first one in the last hour.
        if (cooldownCheck && cooldownCheck.count === 1 && env.DISCORD_WEBHOOK_URL) {
          // Fetch today's counts (X analyses, Y link clicks) in UTC
          const stats = await env.DB.prepare(`
            SELECT 
              SUM(CASE WHEN event_name = 'process_file_click' THEN 1 ELSE 0 END) as analyses,
              SUM(CASE WHEN event_name IN ('linkedin_post_link_click', 'linkedin_embed_link_click') THEN 1 ELSE 0 END) as links
            FROM analytics_events
            WHERE strftime('%Y-%m-%d', created_at) = strftime('%Y-%m-%d', 'now')
          `).first();

          const analysesToday = stats ? (stats.analyses || 0) : 0;
          const linksToday = stats ? (stats.links || 0) : 0;

          // Mention format in Discord requires <@USER_ID>. If env.DISCORD_USER_ID is not provided, fall back to literal "@pogoofgo".
          const mention = env.DISCORD_USER_ID ? `<@${env.DISCORD_USER_ID}>` : "@pogoofgo";
          const discordMessage = `${mention} **LinkedIn SPB:** New use detected. ${analysesToday} analyses and ${linksToday} link clicks today so far.`;

          // Post to Discord (running asynchronously via ctx.waitUntil so the client response is not delayed)
          ctx.waitUntil(
            fetch(env.DISCORD_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: discordMessage })
            })
            .catch(e => console.error("Discord webhook failed:", e))
          );
        }

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

    // Route: /debug
    if (url.pathname === "/debug") {
      let cooldownCount = 0;
      try {
        const cooldownCheck = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM analytics_events WHERE created_at > datetime('now', '-1 hour')"
        ).first();
        cooldownCount = cooldownCheck ? cooldownCheck.count : 0;
      } catch (err) {
        cooldownCount = "Database Error: " + err.message;
      }

      return new Response(JSON.stringify({
        has_webhook_url: !!env.DISCORD_WEBHOOK_URL,
        has_user_id: !!env.DISCORD_USER_ID,
        webhook_url_length: env.DISCORD_WEBHOOK_URL ? env.DISCORD_WEBHOOK_URL.length : 0,
        cooldown_events_last_hour: cooldownCount,
        database_bound: !!env.DB
      }, null, 2), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
