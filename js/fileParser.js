/**
 * fileParser.js - Spreadsheet file parsing for CSV and XLSX files.
 * Parses files in-browser and extracts embedded URLs from body text via Regex.
 */

class FileParser {
  /**
   * Reads an uploaded File object (.csv or .xlsx) using SheetJS
   */
  async parseSpreadsheet(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          
          const normalizedRows = rawRows.map(row => this.normalizeRow(row));
          resolve(normalizedRows);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Normalizes spreadsheet columns with priority column matching
   */
  normalizeRow(row) {
    const findValue = (possibleKeys) => {
      const keys = Object.keys(row);
      for (const key of keys) {
        const lowerKey = key.trim().toLowerCase();
        if (possibleKeys.some(p => lowerKey.includes(p))) {
          return String(row[key] || '').trim();
        }
      }
      return '';
    };

    const date = findValue(['created date', 'date', 'saved date', 'timestamp']) || 'N/A';
    const name = findValue(['author', 'name', 'posted by', 'user']) || 'LinkedIn Member';
    const jobTitle = findValue(['headline', 'job title', 'title', 'position']) || 'N/A';
    const linkToPost = findValue(['post link', 'url', 'link', 'permalink']) || '';
    const postText = findValue(['post text', 'content', 'text', 'body', 'description']) || '';

    const linkInsidePost = this.extractUrlsFromText(postText);

    return {
      date,
      name,
      jobTitle,
      linkToPost,
      postText,
      linkInsidePost
    };
  }

  /**
   * Regex extraction of body text URLs
   */
  extractUrlsFromText(text) {
    if (!text) return 'None';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    if (!matches || matches.length === 0) return 'None';
    return matches.join(', ');
  }
}

window.fileParser = new FileParser();
