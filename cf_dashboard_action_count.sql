SELECT event_name, COUNT(*) as occurrences, as total_posts_involved
FROM analytics_events 
GROUP BY event_name;
