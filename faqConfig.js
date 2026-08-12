/**
 * faqConfig.js - Editable FAQ Questions & Answers Configuration
 * You can edit questions, answers, and add new FAQ items directly in this text file!
 */

window.FAQ_CONFIG = [
  {
    question: "What makes this free to use? Can I really use it without paying?",
    answer: "Yes! The application runs 100% locally in your web browser. When using Chrome Built-in AI (window.LanguageModel), the Gemini Nano AI model runs directly on your computer's hardware. There are zero cloud server infrastructure costs, zero subscriptions, and no credit card required."
  },
  {
    question: "How is my LinkedIn data kept secure and private?",
    answer: "Your post contents and profile data never leave your physical device. All spreadsheet parsing, deduplication, and IndexedDB data caching happen entirely inside your local browser. No third-party server or cloud database has access to your saved posts."
  },
  {
    question: "How do I create a CSV or Excel file of my saved LinkedIn posts?",
    answer: "You can use a free browser tool like <a href='https://chromewebstore.google.com/detail/linkedin-saved-posts-expo/fcpdebjamdlbegjmaecakjcpjafgibkm' target='_blank' rel='noopener' style='color: var(--primary); font-weight: 600; text-decoration: underline;'>LinkedIn Saved Posts Exporter</a> from the Chrome Web Store to export your saved items into a .csv or .xlsx spreadsheet file with one click."
  },
  {
    question: "What happens if I close my browser tab?",
    answer: "All your processed posts, category tags, sentiment ratings, and read/starred statuses remain safely stored in your browser's IndexedDB storage. When you return to the site later, your directory reloads instantly without using any additional AI tokens."
  },
  {
    question: "Can I use my own Gemini API Key instead of Chrome Built-in AI?",
    answer: "Yes! Click the ⚙️ AI Engine status pill in the top-right corner to open Settings. You can enter your free Google AI Studio Gemini API Key anytime to switch from local Chrome AI to cloud Gemini models."
  }
];
