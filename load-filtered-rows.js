// load-filtered-rows.js
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

/**
 * Promptfoo test cases loader function.
 * Reads the dataset from the './data/' folder and constructs dynamic assertions.
 */
function getSelectedRows() {
  // Use path.resolve to find the CSV in the data folder relative to this file
  const csvPath = path.resolve(__dirname, 'data', 'linkedin-saved-posts-demo.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  
  // Parse CSV records with headers
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  // Pre-calculate ID counts to detect duplicates across the entire document
  const idCounts = {};
  records.forEach(row => {
    if (row.id) {
      idCounts[row.id] = (idCounts[row.id] || 0) + 1;
    }
  });

  // Dynamic instruction filter (driven via environment variables)
  // FILTER_MODE options:
  // - 'range': Filters by row index range (e.g. FILTER_VALUE="X:Y" -> "0:3")
  // - 'id': Filters by specific string ID (e.g. FILTER_VALUE="000000000000000b")
  // - 'date': Filters by date range (e.g. FILTER_VALUE="YYYY-MM-DD:YYYY-MM-DD" -> "2026-08-11:2026-08-12")
  // - 'default': Evaluates all rows in the dataset
  const filterMode = process.env.FILTER_MODE || 'default';
  const filterValue = process.env.FILTER_VALUE || '';

  let selectedRecords = [];

  if (filterMode === 'range') {
    const [start, end] = filterValue.split(':').map(Number);
    selectedRecords = records.slice(start, end + 1);
  } else if (filterMode === 'id') {
    selectedRecords = records.filter(row => row.id === filterValue);
  } else if (filterMode === 'date') {
    const [startStr, endStr] = filterValue.split(':');
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    // Add end of day buffer to end date to ensure inclusive filtering
    endDate.setHours(23, 59, 59, 999);

    selectedRecords = records.filter(row => {
      const rowDate = new Date(row.date);
      return !isNaN(rowDate) && rowDate >= startDate && rowDate <= endDate;
    });
  } else {
    selectedRecords = records;
  }

  // Check if API keys are explicitly set and verify they are not default placeholder strings.
  const getCleanEnvVar = (name) => {
    const val = process.env[name];
    return (val && val.trim() !== '' && !val.includes('your-api-key')) ? val : null;
  };

  const geminiKey = getCleanEnvVar('GEMINI_API_KEY');
  const openaiKey = getCleanEnvVar('OPENAI_API_KEY');
  const hasLLMKey = geminiKey || openaiKey;

  // Use the correct Promptfoo Google AI Studio provider: google:gemini-1.5-flash
  const graderProvider = geminiKey ? 'google:gemini-1.5-flash' : 'openai:gpt-4o-mini';

  // Map each selected row into the Promptfoo test case structure
  return selectedRecords.map((row, index) => {
    const isDuplicated = idCounts[row.id] > 1;

    // Set up standard deterministic (zero-token) assertions
    const assertions = [
      // a. Duplicate ID Check (Deterministic)
      {
        type: 'javascript',
        value: `context.vars.is_duplicated === false`,
        metric: 'Duplicate ID Check'
      },
      // b. Valid Date Check (Deterministic)
      {
        type: 'javascript',
        value: `!isNaN(Date.parse(context.vars.date))`,
        metric: 'Valid Date Check'
      },
      // c. Job Title Check (Deterministic) - Fails if "NA" or "N/A"
      {
        type: 'javascript',
        value: `context.vars.jobTitle !== 'NA' && context.vars.jobTitle !== 'N/A'`,
        metric: 'Job Title Check'
      }
    ];

    // e. High Value Takeaway Check (Semantic/LLM Rubric assertion)
    // Only appended if a valid API key is present in the environment
    if (hasLLMKey) {
      assertions.push({
        type: 'llm-rubric',
        value: 'The postSummary identifies a useful high-value takeaway, such as a job posting, hiring notice, or usable resource (e.g., learning events, tools, or guides).',
        metric: 'High Value Takeaway',
        provider: graderProvider
      });
    }

    return {
      description: `Row #${index} - ID: ${row.id || 'N/A'} (Author: ${row.name || 'Unknown'})`,
      vars: {
        record_content: JSON.stringify(row),
        id: row.id,
        date: row.date,
        jobTitle: row.jobTitle,
        linkInsidePost: row.linkInsidePost,
        postSummary: row.postSummary,
        is_duplicated: isDuplicated
      },
      assert: assertions
    };
  });
}

module.exports = { getSelectedRows };
