/**
 * aiService.js - Pluggable AI Service Architecture for SPB
 * Supports:
 *  1. Chrome Built-in AI (`window.ai` / `window.ai.languageModel` / `window.ai.summarizer`)
 *  2. Cloud Provider (Google Gemini API via user's API Key)
 *  3. Mock/Simulator Service (for fast UI testing)
 */

const SYSTEM_PROMPT_CONSTRAINTS = `
You are an expert LinkedIn Content Curator AI. Analyze the given post text and author metadata.

Output MUST be a valid JSON object matching this schema exactly:
{
  "topic": "Concise topic group (e.g. AI & Machine Learning, Cloud & Infrastructure, Career & Hiring Opportunities, Product Design & UX, Product Strategy & Leadership, Industry Insights)",
  "postSummary": "5 to 20 word summary of the post content. IMPORTANT HIRING RULE: If this is a hiring/recruitment post, you MUST format the summary strictly as: 'Hiring [Job Title] at [Company]'",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "sentimentReason": "1-sentence contextual explanation for the sentiment rating"
}
`;

class AIService {
  constructor() {
    this.currentProvider = localStorage.getItem('SPB_AI_PROVIDER') || 'window.ai';
    this.geminiApiKey = localStorage.getItem('SPB_GEMINI_API_KEY') || '';
  }

  setProvider(provider) {
    this.currentProvider = provider;
    localStorage.setItem('SPB_AI_PROVIDER', provider);
  }

  setGeminiApiKey(key) {
    this.geminiApiKey = key.trim();
    localStorage.setItem('SPB_GEMINI_API_KEY', this.geminiApiKey);
  }

  async checkCapabilities() {
    let isWindowAIAvailable = false;

    if (typeof LanguageModel !== 'undefined' || typeof window.LanguageModel !== 'undefined') {
      try {
        const LM = typeof LanguageModel !== 'undefined' ? LanguageModel : window.LanguageModel;
        if (typeof LM.availability === 'function') {
          const avail = await LM.availability({ outputLanguage: 'en' });
          isWindowAIAvailable = (avail === 'readily' || avail === 'after-download' || avail === true || typeof avail === 'string');
        } else {
          isWindowAIAvailable = true;
        }
      } catch (e) {
        isWindowAIAvailable = true; // Class constructor is present
      }
    } else if (typeof window.ai !== 'undefined') {
      isWindowAIAvailable = true;
    }

    return {
      windowAI: isWindowAIAvailable,
      geminiKey: !!this.geminiApiKey,
      activeProvider: this.currentProvider
    };
  }

  async analyzePost(rawPost) {
    if (this.currentProvider === 'window.ai') {
      return this.analyzeWithWindowAI(rawPost);
    } else if (this.currentProvider === 'gemini') {
      return this.analyzeWithGeminiAPI(rawPost);
    } else {
      return this.analyzeWithMock(rawPost);
    }
  }

  /**
   * 1. Chrome Built-in AI (LanguageModel / window.ai) Adapter
   */
  async analyzeWithWindowAI(rawPost) {
    try {
      let session;
      const promptText = `Post Author: ${rawPost.name} (${rawPost.jobTitle})\nPost Content:\n${rawPost.postText}`;

      // Chrome standard LanguageModel API
      if (typeof LanguageModel !== 'undefined' || typeof window.LanguageModel !== 'undefined') {
        const LM = typeof LanguageModel !== 'undefined' ? LanguageModel : window.LanguageModel;
        session = await LM.create({
          outputLanguage: 'en',
          initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT_CONSTRAINTS }]
        });
      } else if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
        session = await window.ai.languageModel.create({
          systemPrompt: SYSTEM_PROMPT_CONSTRAINTS
        });
      }

      if (!session) {
        throw new Error('Could not instantiate LanguageModel session');
      }

      const responseText = await session.prompt(promptText);
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse JSON from LanguageModel');
    } catch (err) {
      console.error('LanguageModel / window.ai analysis failed:', err);
      return this.analyzeWithMock(rawPost);
    }
  }

  /**
   * 2. Direct Gemini REST API Adapter (User API Key)
   */
  async analyzeWithGeminiAPI(rawPost) {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key missing. Please enter your API Key in Settings.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`;

    const promptText = `${SYSTEM_PROMPT_CONSTRAINTS}\n\nPost Author: ${rawPost.name} (${rawPost.jobTitle})\nPost Content:\n${rawPost.postText}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Gemini API call failed');
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(candidateText);
  }

  /**
   * 3. Mock Simulator Adapter for fast testing
   */
  async analyzeWithMock(rawPost) {
    await new Promise(r => setTimeout(r, 150)); // Simulate micro-delay

    const textLower = (rawPost.postText + ' ' + rawPost.jobTitle).toLowerCase();
    
    let topic = 'Industry Insights';
    let summary = 'Key professional updates and strategic industry commentary from LinkedIn.';
    let sentiment = 'Neutral';
    let sentimentReason = 'Shares informational perspective on business trends.';

    if (textLower.includes('hiring') || textLower.includes('job') || textLower.includes('role') || textLower.includes('team')) {
      topic = 'Career & Hiring Opportunities';
      summary = `Hiring ${rawPost.jobTitle || 'Software Professional'} at TechCorp`;
      sentiment = 'Positive';
      sentimentReason = 'Promotes open career roles and growth opportunities.';
    } else if (textLower.includes('ai') || textLower.includes('llm') || textLower.includes('model') || textLower.includes('gpt')) {
      topic = 'AI & Machine Learning';
      summary = 'Explores practical implementation and advancements in generative AI tools.';
      sentiment = 'Positive';
      sentimentReason = 'Highlights innovative technical capabilities and productivity boosts.';
    } else if (textLower.includes('design') || textLower.includes('ux') || textLower.includes('ui') || textLower.includes('product')) {
      topic = 'Product Design & UX';
      summary = 'Discusses user-centered design patterns and product strategy principles.';
      sentiment = 'Positive';
      sentimentReason = 'Emphasizes improving user experience and design quality.';
    } else if (textLower.includes('cloud') || textLower.includes('aws') || textLower.includes('gcp') || textLower.includes('docker')) {
      topic = 'Cloud & Infrastructure';
      summary = 'Overview of scalable cloud deployment architecture and developer tooling.';
      sentiment = 'Neutral';
      sentimentReason = 'Technical architecture breakdown without strong emotional framing.';
    }

    return {
      topic,
      postSummary: summary,
      sentiment,
      sentimentReason
    };
  }
}

window.aiService = new AIService();
