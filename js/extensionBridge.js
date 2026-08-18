/**
 * extensionBridge.js
 * Manages postMessage communication between LinkedIn Saved Post Browser (SPB)
 * and the Chrome Helper Extension.
 *
 * STRICT RULE: Never use the word 'SCRAPE'. Always use READ / COLLECT / PREP.
 */

class ExtensionBridge {
  constructor() {
    this.isInstalled = false;
    this.collectionState = 'IDLE'; // IDLE | PREPPING | PREP_COMPLETE | COLLECTING | PAUSED | COMPLETE
    this.discoveredCount = 0;
    this.collectedPosts = [];
    this.onProgressCallback = null;
    this.onStatusChangeCallback = null;

    this.initMessageListener();
  }

  /**
   * Listen for window.postMessage dispatches coming from Content Script / Extension
   */
  initMessageListener() {
    window.addEventListener('message', (event) => {
      // Security: Only accept messages originating from the same page context/extension bridge
      if (event.origin !== window.origin) return;
      if (!event.data || typeof event.data !== 'object') return;

      const { type, payload } = event.data;

      switch (type) {
        case 'LINKEDIN_EXTENSION_PONG':
          this.isInstalled = true;
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({ status: 'INSTALLED', payload });
          }
          break;

        case 'LINKEDIN_PREP_PROGRESS':
          if (this.onProgressCallback) {
            this.onProgressCallback({ stage: 'PREP', count: payload.count });
          }
          break;

        case 'LINKEDIN_PREP_COMPLETE':
          this.collectionState = 'PREP_COMPLETE';
          this.discoveredCount = payload.totalCount || 0;
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({ status: 'PREP_COMPLETE', totalCount: this.discoveredCount });
          }
          break;

        case 'LINKEDIN_READ_BATCH':
          if (payload && Array.isArray(payload.posts)) {
            this.collectedPosts.push(...payload.posts);
          }
          if (this.onProgressCallback) {
            this.onProgressCallback({
              stage: 'COLLECT',
              currentCount: this.collectedPosts.length,
              targetCount: payload.targetCount || this.discoveredCount
            });
          }
          break;

        case 'LINKEDIN_READ_COMPLETE':
          this.collectionState = 'COMPLETE';
          if (payload && Array.isArray(payload.posts)) {
            this.collectedPosts = payload.posts;
          }
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({
              status: 'COMPLETE',
              posts: this.collectedPosts
            });
          }
          break;

        case 'LINKEDIN_READ_PAUSED':
          this.collectionState = 'PAUSED';
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({ status: 'PAUSED', count: this.collectedPosts.length });
          }
          break;

        case 'LINKEDIN_READ_ERROR':
          if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback({ status: 'ERROR', error: payload.error });
          }
          break;
      }
    });
  }

  /**
   * Ping extension to test installation state using multi-vector detection
   */
  checkInstallation() {
    return new Promise((resolve) => {
      // 1. Direct DOM attribute / Window global flag check
      if (
        window.LinkedInExporterInstalled ||
        window.__LINKEDIN_COLLECTOR_INSTALLED__ ||
        document.documentElement.hasAttribute('data-linkedin-collector-installed') ||
        document.getElementById('linkedin-saved-posts-exporter-root')
      ) {
        this.isInstalled = true;
        return resolve(true);
      }

      // 2. Event listener for extension response
      const pongHandler = (event) => {
        if (event.origin !== window.origin) return;
        if (event.data && (event.data.type === 'LINKEDIN_EXTENSION_PONG' || event.data.type === 'EXPORTER_PONG')) {
          this.isInstalled = true;
          window.removeEventListener('message', pongHandler);
          resolve(true);
        }
      };
      window.addEventListener('message', pongHandler);

      // 3. Dispatch postMessage and CustomEvent pings
      window.postMessage({ type: 'SPB_PING_EXTENSION' }, window.origin);
      window.postMessage({ type: 'PING_EXPORTER' }, window.origin);
      document.dispatchEvent(new CustomEvent('SPB_PING_EXTENSION'));

      // 4. Timeout resolve
      setTimeout(() => {
        window.removeEventListener('message', pongHandler);
        resolve(this.isInstalled);
      }, 800);
    });
  }

  /**
   * Stage 1: Start Prep pass (Scrolls to count posts without full DOM parsing)
   * @param {Object} options { limit: number | null }
   */
  startPrep(options = {}) {
    this.collectionState = 'PREPPING';
    this.discoveredCount = 0;
    this.collectedPosts = [];

    console.log('[SPB Extension Bridge] 🚀 Starting LinkedIn Prep pass...', { limit: options.limit });

    window.postMessage({
      type: 'SPB_START_PREP_READ',
      payload: {
        limit: options.limit || null
      }
    }, window.origin);
  }

  /**
   * Pause ongoing Prep pass
   */
  pausePrep() {
    console.log('[SPB Extension Bridge] ⏸ Pausing Prep pass... Sending kill signal to scroll engine.');
    window.postMessage({ type: 'SPB_PAUSE_PREP' }, window.origin);
    window.postMessage({ type: 'SPB_STOP_SCROLL' }, window.origin);
    this.collectionState = 'PAUSED';
  }

  /**
   * Resume ongoing Prep pass
   */
  resumePrep() {
    console.log('[SPB Extension Bridge] ▶ Resuming Prep pass...');
    window.postMessage({ type: 'SPB_RESUME_PREP' }, window.origin);
    this.collectionState = 'PREPPING';
  }

  /**
   * Stage 2: Start Full Data Collection
   * @param {Object} options { limit: number | null }
   */
  startCollection(options = {}) {
    this.collectionState = 'COLLECTING';

    console.log('[SPB Extension Bridge] 📥 Starting Data Collection...', { limit: options.limit });

    window.postMessage({
      type: 'SPB_START_DATA_COLLECTION',
      payload: {
        limit: options.limit || null,
        startIndex: 0
      }
    }, window.origin);
  }

  /**
   * Pause ongoing collection
   */
  pauseCollection() {
    console.log('[SPB Extension Bridge] ⏸ Pausing Data Collection... Sending kill signal.');
    window.postMessage({ type: 'SPB_PAUSE_COLLECTION' }, window.origin);
    window.postMessage({ type: 'SPB_STOP_SCROLL' }, window.origin);
    this.collectionState = 'PAUSED';
  }

  /**
   * Resume collection from paused state
   */
  resumeCollection() {
    console.log('[SPB Extension Bridge] ▶ Resuming Data Collection...');
    this.collectionState = 'COLLECTING';
    window.postMessage({ type: 'SPB_RESUME_COLLECTION' }, window.origin);
  }

  /**
   * Stop collection early (That's Enough)
   */
  stopCollection() {
    console.log('[SPB Extension Bridge] ⏹ Stopping Data Collection cleanly...');
    window.postMessage({ type: 'SPB_STOP_COLLECTION' }, window.origin);
    window.postMessage({ type: 'SPB_STOP_SCROLL' }, window.origin);
    this.collectionState = 'COMPLETE';
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback({
        status: 'COMPLETE',
        posts: this.collectedPosts
      });
    }
  }
}

// Export singleton instance
window.extensionBridge = new ExtensionBridge();
