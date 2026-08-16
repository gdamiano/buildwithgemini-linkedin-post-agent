SELECT event_name, COUNT(*) as occurrences, SUM(post_count) as total_posts_involved
FROM analytics_events 
GROUP BY event_name;
