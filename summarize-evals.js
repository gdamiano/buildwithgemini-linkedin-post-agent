// summarize-evals.js
const fs = require('fs');
const path = require('path');

// ==========================================
// CUSTOMIZABLE METRIC THRESHOLDS
// Define threshold ranges per assertion metric name.
// Format: { red: X, yellow: Y }
// - Pass rates STRICTLY LESS THAN 'red' will be colored Red.
// - Pass rates >= 'red' but STRICTLY LESS THAN 'yellow' will be colored Yellow.
// - Pass rates >= 'yellow' (up to 100%) will be colored Green.
// ==========================================
const METRIC_THRESHOLDS = {
  "Duplicate ID Check": { red: 50, yellow: 90 },
  "Valid Date Check": { red: 80, yellow: 100 },
  "Job Title Check": { red: 60, yellow: 85 },
  "High Value Takeaway": { red: 50, yellow: 90 },
  
  // Fallback defaults for any unlisted metrics
  "default": { red: 50, yellow: 90 }
};

function summarize() {
  const reportPath = path.resolve(__dirname, 'evals', 'eval_report.json');
  if (!fs.existsSync(reportPath)) {
    console.error(`Error: Could not find report file at ${reportPath}. Please run evaluations first.`);
    process.exit(1);
  }

  try {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    
    // Extract results from Promptfoo's nested schema
    const results = data.results?.results || data.results || [];
    
    if (results.length === 0) {
      console.log('No evaluation results found in the report.');
      return;
    }

    const metrics = {};

    results.forEach(result => {
      const compResults = result.gradingResult?.componentResults || [];
      compResults.forEach(comp => {
        const metricName = comp.assertion?.metric || 'Unknown Assertion';
        if (!metrics[metricName]) {
          metrics[metricName] = { passed: 0, total: 0 };
        }
        metrics[metricName].total += 1;
        if (comp.pass) {
          metrics[metricName].passed += 1;
        }
      });
    });

    console.log('\n=== Evaluation Metrics Summary ===\n');

    Object.entries(metrics).forEach(([metricName, stats]) => {
      const passRate = (stats.passed / stats.total) * 100;
      const formattedRate = `${passRate.toFixed(0)}%`;
      const ratio = `${stats.passed} of ${stats.total}`;

      // Retrieve custom thresholds for the metric (or use default fallback)
      const thresholds = METRIC_THRESHOLDS[metricName] || METRIC_THRESHOLDS["default"];

      // Determine color based on custom thresholds
      // ANSI colors: Red = \x1b[31m, Yellow = \x1b[33m, Green = \x1b[32m
      let colorCode = '\x1b[32m'; // Default to Green
      if (passRate < thresholds.red) {
        colorCode = '\x1b[31m'; // Red
      } else if (passRate < thresholds.yellow) {
        colorCode = '\x1b[33m'; // Yellow
      }
      
      const resetCode = '\x1b[0m';

      console.log(`Passing "${metricName}": ${colorCode}${ratio} | ${formattedRate}${resetCode}`);
    });
    console.log('');
  } catch (err) {
    console.error('Error parsing evaluation report:', err.message);
  }
}

summarize();
