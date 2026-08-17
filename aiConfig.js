/**
 * aiConfig.js
 * Configuration file for SPB AI model ratings (Speed, Cost, and Display Names).
 * Easily editable to add new models and rating rewrites.
 */

window.AI_CONFIG = {
  ratings: {
    'window.ai': {
      name: 'Chrome Built-In',
      speed: 'Slowest',
      cost: 'None'
    },
    'gemini': {
      name: 'Gemini API',
      speed: 'Faster',
      cost: '1 Request/post'
    },
    'openai': {
      name: 'OpenAI API',
      speed: 'Faster',
      cost: 'Less than $0.01/post'
    },
    'mock': {
      name: 'Offline Test Simulator',
      speed: 'Instant',
      cost: 'None'
    }
  },
  browserManifest: {
    'Chrome': {
      label: 'Chrome Built-in AI',
      supported: true,
      setupHtml: 'Open a new Chrome tab and type <code class="code-link">chrome://flags</code>. Find the setting "Prompt API" and set it to Enabled.'
    },
    'Edge': {
      label: 'Edge Built-in AI',
      supported: true,
      setupHtml: 'Supported in Edge Dev/Canary (v138+). Requires the <code class="code-link">BuiltInAIAPIsEnabled</code> policy enabled, or joining the Edge Prompt API Origin Trial.'
    },
    'Firefox': {
      label: 'Firefox Browser (Local AI Unsupported)',
      supported: false,
      setupHtml: 'Not supported yet in Firefox. Choose a Gemini or OpenAI cloud key below, or switch browsers.'
    },
    'Safari': {
      label: 'Safari Browser (Local AI Unsupported)',
      supported: false,
      setupHtml: 'Not supported yet in Safari. Choose a Gemini or OpenAI cloud key below, or switch browsers.'
    },
    'Other': {
      label: 'Browser (Local AI Unsupported)',
      supported: false,
      setupHtml: 'Not supported yet in this browser. Choose a Gemini or OpenAI cloud key below, or switch browsers.'
    }
  }
};
