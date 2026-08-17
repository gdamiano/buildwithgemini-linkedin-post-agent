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
    question: "What if I want to share a question, suggestion, problem or compliment?",
    answer: "Let me know what you think! <a href='https://www.linkedin.com/in/gregorydamiano/' target='_blank' rel='noopener' style='color: var(--primary); font-weight: 600; text-decoration: underline;'>Find me on LinkedIn</a> (of course!)"
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
    question: "How are the category tags generated?",
    answer: "The LLM is prompted to do some pattern matching, and build tags based on the posts you load.<br></br>You may edit the tag for any logged post, to fix AI misses or create your own categories."
  },
  {
    question: "How do I spot job postings?",
    answer: "The AI is specifically told to reserve a 'Hiring' tag for posts that describe having an open role."
  },
  {
    question: "Why was this app made?",
    answer: "I keep saving LinkedIn posts to build a knowledge base for nice tips... I just broke 200, which I'm sure is tiny compared to some peoples' collections! When I want to find those tips, the ones I want will be buried under page loads and long scrolling, and the LinkedIn site doesn't have many sorting features.<br></br>I made this app to give LinkedIn users the value of finding and reviewing the posts they need without losing time to painful scanning."
  },
  {
    question: "Was this app made in a hackathon?",
    answer: "Yes! A first edition was built at the 'Build With Google' Gemini training seminar, as part of a 2-hour challenge to build and present."
  },
  {
	question: "Does this app track me?",
	answer: "It does not track you.<br></br>This app uses Cloudflare ONLY to count two actions the site takes; it NEVER identifies, follows or tracks a visitor or your information.<br></br>If you're curious, I watch the number of times links to LinkedIn posts are clicked, as this is the ultimate purpose for the app, and I also watch the number of times the 'process file' button is pressed. These are the two 'funnel steps' in the user journey that I consider signs that the app is giving users value."
  }
];
