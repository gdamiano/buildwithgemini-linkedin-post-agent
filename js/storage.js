/**
 * storage.js - IndexedDB Post Store for SPB
 * Manages caching analyzed post records locally in the user's browser.
 */

const DB_NAME = 'SPB_PostStore';
const DB_VERSION = 1;
const STORE_NAME = 'posts';

class PostStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('topic', 'topic', { unique: false });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('analyzedAt', 'analyzedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Generates a 16-character SHA-256 hash ID for deduplication
   */
  async generateHashId(postLink, date, author, textContent) {
    let cleanLink = (postLink || '').trim().toLowerCase();
    try {
      if (cleanLink && (cleanLink.startsWith('http://') || cleanLink.startsWith('https://'))) {
        const urlObj = new URL(cleanLink);
        // Keep origin and pathname, drop search parameters/query and hash
        cleanLink = urlObj.origin + urlObj.pathname;
      }
    } catch (e) {
      // Fallback if URL parsing fails
    }
    // Remove trailing slashes
    cleanLink = cleanLink.replace(/\/+$/, '');

    const rawString = cleanLink;
    const msgBuffer = new TextEncoder().encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 16);
  }

  async getPost(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async savePost(postRecord) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        ...postRecord,
        updatedAt: new Date().toISOString()
      };
      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPosts() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllPosts() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePost(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
}

window.postStorage = new PostStorage();
