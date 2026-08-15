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
  }
};
