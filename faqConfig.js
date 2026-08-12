/**
 * faqConfig.js - Editable FAQ Questions & Answers Configuration
 * You can edit questions, answers, and add new FAQ items directly in this text file!
 */

window.FAQ_CONFIG = [
  {
    question: "What makes this free to use? Can I really use it without paying?",
    answer: "With Chrome Built-In AI (window.LanguageModel), the application is 100% free, running the Gemini Nano AI model in your web browser. This is a free Chrome service offered by Google. There are zero costs, zero subscriptions, and zero credit cards required.<br><br>You can use other existing AI subscriptions, the usage is minimal and should stay within free caps."
  },
  {
    question: "How is my LinkedIn data kept secure and private?",
    answer: "Post contents and profile data never leave your physical device. All spreadsheet parsing, deduplication, and IndexedDB data caching happen entirely inside your local browser. No third-party server or cloud database has access to your saved posts."
  },
  {
    question: "How do I create a CSV or Excel file of my saved LinkedIn posts?",
    answer: "You can use the free browser tool <a href='https://chromewebstore.google.com/detail/linkedin-saved-posts-expo/fcpdebjamdlbegjmaecakjcpjafgibkm' target='_blank' rel='noopener' style='color: var(--primary); font-weight: 600; text-decoration: underline;'>LinkedIn Saved Posts Exporter</a> from the Chrome Web Store to export your saved items into a .csv or .xlsx spreadsheet file with one click.<br><br>This tool sorts post data into the columns that are used by LinkedIn Saved Posts Browser."
  },
  {
    question: "What happens if I close my browser tab?",
    answer: "All your processed posts, category tags, sentiment ratings, and read/starred statuses remain safely stored in your browser's IndexedDB storage. When you return to the site later, your directory reloads instantly without using any additional AI tokens."
  },
  {
    question: "Processing is kind of slow.",
    answer: "Model and source can play a big role. If you're using Chrome Built-In AI, switching to Gemini or another provider may be 50% faster or more."
  },
  {
    question: "Can I use my own Gemini API Key instead of Chrome Built-in AI?",
    answer: "Yes! Click the ⚙️ AI Engine status pill in the top-right corner to open Settings. You can enter your free Google AI Studio Gemini API Key anytime to switch from local Chrome AI to cloud Gemini models."
  },
  {
    question: "Does Safari or any other browser have a built-in AI?",
    answer: "I don't know yet! I haven't researched it. It's something I could potentially add!"
  },
  {
    question: "Why was this app made?",
    answer: "The creator, Greg, keeps saving LinkedIn posts... dozens of posts. Too many posts! Greg just wants to find the topics he saved, but the LinkedIn site doesn't have many sorting features.<br></br>This app was created to give LinkedIn users the added value of organizing their save posts without manual steps or long reads."
  },
  {
    question: "Was this app made in a hackathon?",
    answer: "Yes! A first edition was built at the 'Build With Google' Gemini training seminar, as part of a 2-hour challenge to build and present."
  }
];
