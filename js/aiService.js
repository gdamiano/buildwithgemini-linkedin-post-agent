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
  "topic": "Concise topic group (e.g. Hiring, Job Search Advice, AI & Machine Learning, Cloud & Infrastructure, Product Design & UX, Product Strategy & Leadership, Industry Insights). IMPORTANT TOPIC RULES: 1. Posts offering actual open jobs/roles MUST have the distinct topic tag 'Hiring'. 2. Posts containing career guidance, resume tips, or job hunting advice without an explicit job opening offered MUST have the topic tag 'Job Search Advice'.",
  "postSummary": "5 to 20 word summary of the post content. IMPORTANT HIRING RULE: If this is a hiring/recruitment post, you MUST format the summary strictly as: 'Hiring [Job Title] at [Company]'",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "sentimentReason": "1-sentence contextual explanation for the sentiment rating"
}
`;

class AIService {
  constructor() {
    this.currentProvider = localStorage.getItem('SPB_AI_PROVIDER') || 'window.ai';
    this.geminiApiKey = localStorage.getItem('SPB_GEMINI_API_KEY') || '';
    this.geminiModel = localStorage.getItem('SPB_GEMINI_MODEL') || 'gemini-3.5-flash-lite';
    this.openaiApiKey = localStorage.getItem('SPB_OPENAI_API_KEY') || '';
    this.openaiModel = localStorage.getItem('SPB_OPENAI_MODEL') || 'gpt-4o-mini';
  }

  setProvider(provider) {
    this.currentProvider = provider;
    localStorage.setItem('SPB_AI_PROVIDER', provider);
  }

  setGeminiApiKey(key) {
    this.geminiApiKey = key.trim();
    localStorage.setItem('SPB_GEMINI_API_KEY', this.geminiApiKey);
  }

  setGeminiModel(model) {
    this.geminiModel = model;
    localStorage.setItem('SPB_GEMINI_MODEL', model);
  }

  setOpenAIApiKey(key) {
    this.openaiApiKey = key.trim();
    localStorage.setItem('SPB_OPENAI_API_KEY', this.openaiApiKey);
  }

  setOpenAIModel(model) {
    this.openaiModel = model;
    localStorage.setItem('SPB_OPENAI_MODEL', model);
  }

  async checkCapabilities() {
    let isWindowAIAvailable = false;

    // Synchronous environment check for Chrome Built-in AI
    if (typeof LanguageModel !== 'undefined' || typeof window.LanguageModel !== 'undefined' || typeof window.ai !== 'undefined') {
      isWindowAIAvailable = true;
    }

    return {
      windowAI: isWindowAIAvailable,
      geminiKey: !!this.geminiApiKey,
      openaiKey: !!this.openaiApiKey,
      activeProvider: this.currentProvider
    };
  }

  async analyzePost(rawPost) {
    if (this.currentProvider === 'window.ai') {
      return this.analyzeWithWindowAI(rawPost);
    } else if (this.currentProvider === 'gemini') {
      return this.analyzeWithGeminiAPI(rawPost);
    } else if (this.currentProvider === 'openai') {
      return this.analyzeWithOpenAIAPI(rawPost);
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
      throw new Error('Chrome Built-in AI failed or is unavailable. Please select another AI engine in Settings.');
    }
  }

  /**
   * 2. Direct Gemini REST API Adapter (User API Key)
   */
  async analyzeWithGeminiAPI(rawPost) {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key missing. Please enter your API Key in Settings.');
    }

    const modelName = this.geminiModel || 'gemini-3.5-flash-lite';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.geminiApiKey}`;

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
   * 3. Direct OpenAI REST API Adapter
   */
  async analyzeWithOpenAIAPI(rawPost) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key missing. Please enter your API Key in Settings.');
    }

    const modelName = this.openaiModel || 'gpt-4o-mini';
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const promptText = `Post Author: ${rawPost.name} (${rawPost.jobTitle})\nPost Content:\n${rawPost.postText}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_CONSTRAINTS },
          { role: 'user', content: promptText }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'OpenAI API call failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
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

    if (textLower.includes('hiring') || textLower.includes('open role') || textLower.includes('we are looking for') || textLower.includes('join our team')) {
      topic = 'Hiring';
      summary = `Hiring ${rawPost.jobTitle || 'Software Professional'} at TechCorp`;
      sentiment = 'Positive';
      sentimentReason = 'Promotes open career roles and growth opportunities.';
    } else if (textLower.includes('resume') || textLower.includes('interview') || textLower.includes('career advice') || textLower.includes('job search') || textLower.includes('job hunting') || textLower.includes('job') || textLower.includes('career')) {
      topic = 'Job Search Advice';
      summary = 'Shares career guidance, interview strategy, and job search best practices.';
      sentiment = 'Positive';
      sentimentReason = 'Offers practical tips for navigating career transitions.';
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
