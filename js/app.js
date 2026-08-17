/**
 * app.js - Main Application Controller for SPB
 * Handles UI interactions, tab switching, drag-drop ingestion, table rendering, and search filtering.
 */

// --- Analytics Configuration ---
// Set this to your Cloudflare Worker URL (e.g. 'https://spb-analytics.yourusername.workers.dev')
const TRACKING_URL = 'https://buildwithgemini-linkedin-post-agent.greg-damiano.workers.dev';

async function trackEvent(eventName, count = 0) {
  if (!TRACKING_URL) return; // Silent return if tracking is not configured
  try {
    const url = new URL(`${TRACKING_URL}/event`);
    url.searchParams.set('name', eventName);
    url.searchParams.set('count', count.toString());
    
    // Fire background request to log the event
    fetch(url.toString(), { mode: 'cors' }).catch(err => console.warn('Analytics network error:', err));
  } catch (err) {
    console.warn('Analytics error:', err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabViews = document.querySelectorAll('.tab-view');
  const fileInput = document.getElementById('fileInput');
  const chooseFileBtn = document.getElementById('chooseFileBtn');
  const processBtn = document.getElementById('processBtn');
  const resetBtn = document.getElementById('resetBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressStatusText = document.getElementById('progressStatusText');
  const topicChipsContainer = document.getElementById('topicChipsContainer');
  const postsTableBody = document.getElementById('postsTableBody');
  const searchInput = document.getElementById('searchInput');
  const totalPostsCount = document.getElementById('totalPostsCount');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportXlsxBtn = document.getElementById('exportXlsxBtn');
  const faqAccordionContainer = document.getElementById('faqAccordionContainer');
  
  // Step cards and controls
  const step3Card = document.getElementById('step3Card');
  const modelSpeed = document.getElementById('modelSpeed');
  const modelCost = document.getElementById('modelCost');

  // Settings & Modal Elements
  const aiSettingsBtn = document.getElementById('aiSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  const providerCards = document.querySelectorAll('.provider-card');
  const modalGeminiKeyInput = document.getElementById('modalGeminiKeyInput');
  const modalGeminiModelSelect = document.getElementById('modalGeminiModelSelect');
  const modalOpenAIKeyInput = document.getElementById('modalOpenAIKeyInput');
  const modalOpenAIModelSelect = document.getElementById('modalOpenAIModelSelect');

  const badgeWindowAIAvail = document.getElementById('badgeWindowAIAvail');
  const badgeGeminiAvail = document.getElementById('badgeGeminiAvail');
  const badgeOpenAIAvail = document.getElementById('badgeOpenAIAvail');

  let parsedRawRows = [];
  let currentFilterTopic = 'All';
  let isProcessing = false;
  let isPaused = false;

  // --- Browser Detection & Customization ---
  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox") && !ua.includes("Seamonkey")) {
      return "Firefox";
    } else if (ua.includes("Edg")) {
      return "Edge";
    } else if (ua.includes("Chrome") && !ua.includes("Chromium")) {
      return "Chrome";
    } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
      return "Safari";
    }
    return "Other";
  }

  function adjustUIForBrowser() {
    const browser = detectBrowser();
    const manifest = window.AI_CONFIG.browserManifest[browser] || window.AI_CONFIG.browserManifest['Other'];
    const cardWindowAI = document.getElementById('cardWindowAI');
    if (!cardWindowAI) return;
    
    if (!manifest.supported) {
      cardWindowAI.classList.add('disabled');
    } else {
      cardWindowAI.classList.remove('disabled');
    }
    
    const titleEl = cardWindowAI.querySelector('.provider-title');
    const setupMetaEl = cardWindowAI.querySelector('.provider-meta:last-child');
    
    if (titleEl) {
      titleEl.textContent = manifest.label;
    }
    if (setupMetaEl) {
      setupMetaEl.innerHTML = `<strong>Setup:</strong> ${manifest.setupHtml}`;
    }
  }

  // --- Initial Setup ---
  adjustUIForBrowser();
  setupSettingsModalListeners();
  renderFAQSection();
  await checkAIServiceStatus();
  await loadAndRenderPosts();
  checkBookmarkletPayload();

  async function checkBookmarkletPayload() {
    try {
      // 1. Check URL query parameters first (Direct Zero-Step transfer)
      const urlParams = new URLSearchParams(window.location.search);
      let payloadStr = urlParams.get('import');
      
      if (payloadStr) {
        // Clean URL to hide transfer string from layout address bar
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // 2. Check localStorage as fallback
        payloadStr = localStorage.getItem('SPB_BOOKMARKLET_PAYLOAD');
        if (payloadStr) {
          localStorage.removeItem('SPB_BOOKMARKLET_PAYLOAD');
        }
      }

      if (payloadStr) {
        let rawPosts;
        try {
          rawPosts = JSON.parse(payloadStr);
        } catch (parseErr) {
          console.warn('Failed to parse import payload JSON:', parseErr);
          alert('⚠️ The imported bookmarklet post data was malformed or incomplete. Please try collecting again.');
          return;
        }

        if (Array.isArray(rawPosts) && rawPosts.length > 0) {
          // Normalize bookmarklet items to the app's internal format
          const normalized = [];
          for (const raw of rawPosts) {
            // Read raw properties directly if generated by newer bookmarklet versions
            let name = raw.name || 'LinkedIn Member';
            let jobTitle = raw.jobTitle || 'N/A';
            let profileLink = raw.profileLink || '';
            let linkToPost = raw.linkToPost || '';
            
            // Fallback to parsing HTML string formats if new properties are absent
            if (!raw.name && !raw.postText) {
              const nameTitleHtml = raw['Name & Title'] || '';
              if (nameTitleHtml.includes('<a')) {
                const hrefMatch = nameTitleHtml.match(/href="([^"]+)"/);
                // Extract text inside anchor, or fall back to small text content if empty anchor
                const textMatch = nameTitleHtml.match(/>([^<]+)<\/a>/);
                if (hrefMatch) profileLink = hrefMatch[1];
                if (textMatch && textMatch[1].trim()) {
                  name = textMatch[1].trim();
                } else {
                  // Fallback: strip HTML and extract name before job title divider
                  const cleanText = nameTitleHtml.replace(/<[^>]*>/g, '').trim();
                  name = cleanText.split('•')[0].split('—')[0].trim();
                }
                
                const titleMatch = nameTitleHtml.match(/<small[^>]*>([^<]+)<\/small>/);
                if (titleMatch) {
                  const titleClean = titleMatch[1].split('•')[0].trim();
                  jobTitle = titleClean;
                }
              } else if (nameTitleHtml.includes('—')) {
                const parts = nameTitleHtml.split('—');
                name = parts[0].trim();
                jobTitle = parts[1].trim();
              } else {
                name = nameTitleHtml || 'LinkedIn Member';
              }

              const linksHtml = raw.Links || '';
              const linkHrefMatch = linksHtml.match(/href="([^"]+)"/);
              if (linkHrefMatch) {
                linkToPost = linkHrefMatch[1];
              }
            }

            const postText = raw.postText || raw['Post Summary'] || '';
            const linkInsidePost = window.fileParser ? window.fileParser.extractUrlsFromText(postText) : 'None';
            
            // Normalize relative dates
            const rawDate = raw.date || raw.Date || new Date().toISOString().split('T')[0];
            const formattedDate = window.fileParser ? window.fileParser.formatDate(rawDate) : rawDate;

            normalized.push({
              date: formattedDate,
              name,
              jobTitle,
              linkToPost,
              profileLink,
              postText,
              linkInsidePost
            });
          }

          // Deduplicate incoming posts against Cache
          let cachedCount = 0;
          let uniqueCount = 0;
          const seenHashes = new Set();
          const uniqueRows = [];

          for (const item of normalized) {
            const hashId = await window.postStorage.generateHashId(item.linkToPost, item.date, item.name, item.postText);
            if (seenHashes.has(hashId)) continue;
            seenHashes.add(hashId);
            uniqueRows.push(item);

            const isCached = await window.postStorage.getPost(hashId);
            if (isCached) {
              cachedCount++;
            } else {
              uniqueCount++;
            }
          }

          parsedRawRows = uniqueRows;

          // Update UI Preview Card
          const filePreviewCard = document.getElementById('filePreviewCard');
          const previewFileName = document.getElementById('previewFileName');
          const previewTotalRows = document.getElementById('previewTotalRows');
          const previewUniqueRows = document.getElementById('previewUniqueRows');
          const previewCachedRows = document.getElementById('previewCachedRows');
          
          if (filePreviewCard) {
            previewFileName.textContent = `📌 1-Click Bookmarklet Import`;
            previewTotalRows.textContent = parsedRawRows.length;
            previewUniqueRows.textContent = uniqueCount;
            previewCachedRows.textContent = cachedCount;
            filePreviewCard.style.display = 'flex';
          }

          if (progressStatusText) {
            progressStatusText.textContent = `Bookmarklet posts ready! Loaded ${parsedRawRows.length} posts (${uniqueCount} new to analyze, ${cachedCount} in cache).`;
          }

          await checkAIServiceStatus();

          const confirmAnalyze = confirm(`🎉 Received ${parsedRawRows.length} saved posts from your 1-Click Bookmarklet! Would you like to analyze and summarize them now?`);
          if (confirmAnalyze) {
            const processBtn = document.getElementById('processBtn');
            if (processBtn && !processBtn.disabled) {
              processBtn.click();
            } else {
              alert('AI API Key is missing. Please click the Settings icon in the top right to configure your API key first!');
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not process bookmarklet payload', e);
    }
  }

  function setupSettingsModalListeners() {
    // Track provider card selection
    providerCards.forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'A') return;
        selectCard(card.getAttribute('data-provider'));
      });
    });

    // Focus inside inputs automatically selects that card
    if (modalGeminiKeyInput) modalGeminiKeyInput.addEventListener('focus', () => selectCard('gemini'));
    if (modalGeminiModelSelect) modalGeminiModelSelect.addEventListener('focus', () => selectCard('gemini'));
    if (modalOpenAIKeyInput) modalOpenAIKeyInput.addEventListener('focus', () => selectCard('openai'));
    if (modalOpenAIModelSelect) modalOpenAIModelSelect.addEventListener('focus', () => selectCard('openai'));

    // Open Settings Modal
    if (aiSettingsBtn) {
      aiSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        updateModalState();
      });
    }

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', async () => {
        window.aiService.setProvider(selectedProvider);
        window.aiService.setGeminiApiKey(modalGeminiKeyInput.value);
        window.aiService.setGeminiModel(modalGeminiModelSelect.value);
        window.aiService.setOpenAIApiKey(modalOpenAIKeyInput.value);
        window.aiService.setOpenAIModel(modalOpenAIModelSelect.value);

        await checkAIServiceStatus();
        settingsModal.classList.remove('active');
      });
    }
  }

  // --- Dynamic FAQ Section Renderer ---
  function renderFAQSection() {
    if (!faqAccordionContainer || !window.FAQ_CONFIG) return;
    faqAccordionContainer.innerHTML = '';

    window.FAQ_CONFIG.forEach((faqItem, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'faq-item';
      itemEl.innerHTML = `
        <div class="faq-question">
          <span style="font-weight: 600;">Q. ${escapeHtml(faqItem.question)}</span>
          <span class="faq-toggle-icon">▼</span>
        </div>
        <div class="faq-answer">
          <div>${faqItem.answer}</div>
        </div>
      `;

      const questionEl = itemEl.querySelector('.faq-question');
      questionEl.addEventListener('click', () => {
        const isOpen = itemEl.classList.contains('active');
        // Close all other FAQ items for a clean accordion effect
        document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('active'));
        if (!isOpen) {
          itemEl.classList.add('active');
        }
      });

      faqAccordionContainer.appendChild(itemEl);
    });
  }

  // --- Tab Navigation ---
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabViews.forEach(v => v.classList.remove('active'));
      
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  function selectCard(provider) {
    selectedProvider = provider;
    providerCards.forEach(card => {
      if (card.classList.contains('disabled')) {
        card.classList.remove('selected');
        return;
      }
      if (card.getAttribute('data-provider') === provider) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  async function updateModalState() {
    const caps = await window.aiService.checkCapabilities();
    selectedProvider = caps.activeProvider;
    if (selectedProvider === 'window.ai' && !caps.windowAI) {
      selectedProvider = 'mock';
    }
    selectCard(selectedProvider);

    modalGeminiKeyInput.value = window.aiService.geminiApiKey;
    modalGeminiModelSelect.value = window.aiService.geminiModel;
    modalOpenAIKeyInput.value = window.aiService.openaiApiKey;
    modalOpenAIModelSelect.value = window.aiService.openaiModel;

    // Toggle "Available" status indicators
    if (caps.windowAI) {
      badgeWindowAIAvail.classList.add('show');
    } else {
      badgeWindowAIAvail.classList.remove('show');
    }

    if (caps.geminiKey) {
      badgeGeminiAvail.classList.add('show');
    } else {
      badgeGeminiAvail.classList.remove('show');
    }

    if (caps.openaiKey) {
      badgeOpenAIAvail.classList.add('show');
    } else {
      badgeOpenAIAvail.classList.remove('show');
    }
  }

  async function isAIReady() {
    const caps = await window.aiService.checkCapabilities();
    if (caps.activeProvider === 'window.ai') {
      return caps.windowAI;
    } else if (caps.activeProvider === 'gemini') {
      return caps.geminiKey;
    } else if (caps.activeProvider === 'openai') {
      return caps.openaiKey;
    } else if (caps.activeProvider === 'mock') {
      return true;
    }
    return false;
  }

  async function checkAIServiceStatus() {
    const caps = await window.aiService.checkCapabilities();
    const ready = await isAIReady();
    const browser = detectBrowser();

    if (caps.activeProvider === 'window.ai') {
      const manifest = window.AI_CONFIG.browserManifest[browser] || window.AI_CONFIG.browserManifest['Other'];
      if (caps.windowAI) {
        statusDot.className = 'status-dot active';
        statusText.textContent = manifest.supported ? manifest.label : 'Chrome Built-in AI';
      } else {
        statusDot.className = 'status-dot';
        if (!manifest.supported) {
          statusText.textContent = 'Confirm AI Provider';
        } else {
          statusText.textContent = `${manifest.label} (Not Ready)`;
        }
      }
    } else if (caps.activeProvider === 'gemini') {
      if (caps.geminiKey) {
        statusDot.className = 'status-dot active';
        statusText.textContent = `Gemini (${window.aiService.geminiModel})`;
      } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Gemini API (Key Needed)';
      }
    } else if (caps.activeProvider === 'openai') {
      if (caps.openaiKey) {
        statusDot.className = 'status-dot active';
        statusText.textContent = `OpenAI (${window.aiService.openaiModel})`;
      } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'OpenAI API (Key Needed)';
      }
    } else {
      statusDot.className = 'status-dot active';
      statusText.textContent = 'Simulator Mode';
    }

    // Sync Model Select indicators in Step 4
    syncModelIndicators();

    // Toggle warning class on the settings button chip based on readiness
    if (aiSettingsBtn) {
      if (ready) {
        aiSettingsBtn.classList.remove('warning');
      } else {
        aiSettingsBtn.classList.add('warning');
      }
    }

    // Enable processBtn if file is loaded AND AI model is ready (and not currently processing)
    if (parsedRawRows && parsedRawRows.length > 0) {
      if (!isProcessing) {
        processBtn.disabled = !ready;
      }
    } else {
      processBtn.disabled = true;
    }
  }

  // --- Drag and Drop & File Upload handlers ---
  if (chooseFileBtn) {
    chooseFileBtn.addEventListener('click', () => fileInput.click());
  }

  // File dragover on step3Card or document body
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (step3Card) step3Card.classList.add('dragover');
  });

  document.body.addEventListener('dragleave', () => {
    if (step3Card) step3Card.classList.remove('dragover');
  });

  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (step3Card) step3Card.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleSelectedFile(e.target.files[0]);
    }
  });

  const filePreviewCard = document.getElementById('filePreviewCard');
  const previewFileName = document.getElementById('previewFileName');
  const previewTotalRows = document.getElementById('previewTotalRows');
  const previewUniqueRows = document.getElementById('previewUniqueRows');
  const previewCachedRows = document.getElementById('previewCachedRows');
  const maxRowsInput = document.getElementById('maxRowsInput');

  async function handleSelectedFile(file) {
    try {
      parsedRawRows = await window.fileParser.parseSpreadsheet(file);
      await checkAIServiceStatus();

      // Deduplicate file internally and check cache status instantly (non-LLM)
      let cachedCount = 0;
      let uniqueCount = 0;
      const seenHashes = new Set();
      const uniqueFileRows = [];

      for (const raw of parsedRawRows) {
        const hashId = await window.postStorage.generateHashId(raw.linkToPost, raw.date, raw.name, raw.postText);
        if (seenHashes.has(hashId)) continue; // Ignore duplicate rows inside same file
        seenHashes.add(hashId);
        uniqueFileRows.push(raw);

        const isCached = await window.postStorage.getPost(hashId);
        if (isCached) {
          cachedCount++;
        } else {
          uniqueCount++;
        }
      }

      // Replace parsedRawRows with deduplicated rows
      parsedRawRows = uniqueFileRows;

      // Update UI Preview Card
      previewFileName.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      previewTotalRows.textContent = parsedRawRows.length;
      previewUniqueRows.textContent = uniqueCount;
      previewCachedRows.textContent = cachedCount;
      filePreviewCard.style.display = 'flex';

      progressStatusText.textContent = `File ready! Found ${parsedRawRows.length} unique rows (${uniqueCount} new to analyze, ${cachedCount} in cache).`;
    } catch (err) {
      alert('Error parsing spreadsheet file: ' + err.message);
    }
  }

  // --- Process File & Batch Analyze with Concurrency & Row Limit ---
  processBtn.addEventListener('click', async () => {
    // If it's already running, click behaves as Pause / Resume toggle
    if (isProcessing) {
      if (isPaused) {
        // Resume
        isPaused = false;
        processBtn.textContent = 'Pause';
        processBtn.className = 'btn btn-warning';
        progressStatusText.textContent = 'Resuming AI analysis...';
      } else {
        // Pause
        isPaused = true;
        processBtn.textContent = 'Resume Posts';
        processBtn.className = 'btn btn-primary';
        progressStatusText.textContent = '⏸ AI analysis paused. Click Resume to continue.';
      }
      return;
    }

    if (parsedRawRows.length === 0) return;

    // Fetch existing topics before starting the process
    let existingTopics = [];
    try {
      const allPosts = await window.postStorage.getAllPosts();
      existingTopics = Array.from(new Set(allPosts.map(p => p.topic).filter(Boolean)));
    } catch (err) {
      console.warn('Failed to retrieve existing topics for classification context:', err);
    }

    // Check user-specified max row limit
    let rowLimit = parseInt(maxRowsInput.value, 10);
    let rowsToProcess = parsedRawRows;

    if (!isNaN(rowLimit) && rowLimit > 0) {
      rowsToProcess = parsedRawRows.slice(0, rowLimit);
    }

    // Track the process click with the count of rows being processed
    trackEvent('process_file_click', rowsToProcess.length);

    isProcessing = true;
    isPaused = false;
    processBtn.disabled = false;
    processBtn.textContent = 'Pause';
    processBtn.className = 'btn btn-warning';

    progressContainer.style.display = 'block';
    progressContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    let processedCount = 0;
    const total = rowsToProcess.length;
    const BATCH_SIZE = 3; // Process 3 posts concurrently for 3x-5x speed boost

    for (let i = 0; i < total; i += BATCH_SIZE) {
      // Pause loop check
      while (isProcessing && isPaused) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (!isProcessing) break; // Check if reset was clicked while paused

      const chunk = rowsToProcess.slice(i, i + BATCH_SIZE);

      await Promise.all(chunk.map(async (raw, idx) => {
        const itemIndex = i + idx;
        const hashId = await window.postStorage.generateHashId(raw.linkToPost, raw.date, raw.name, raw.postText);

        // Check cache first
        let cachedPost = await window.postStorage.getPost(hashId);

        if (!cachedPost) {
          progressStatusText.textContent = `Analyzing posts (${processedCount + 1}/${total}) via AI...`;
          
          try {
            const aiAnalysis = await window.aiService.analyzePost(raw, existingTopics);
            cachedPost = {
              id: hashId,
              date: raw.date,
              name: raw.name,
              jobTitle: raw.jobTitle,
              topic: aiAnalysis.topic || 'Industry Insights',
              postSummary: aiAnalysis.postSummary || 'Summary unavailable',
              linkInsidePost: raw.linkInsidePost,
              linkToPost: raw.linkToPost,
              sentiment: aiAnalysis.sentiment || 'Neutral',
              sentimentReason: aiAnalysis.sentimentReason || 'Standard post text.',
              read: false,
              analyzedAt: new Date().toISOString()
            };
            await window.postStorage.savePost(cachedPost);
          } catch (err) {
            console.error(`Error analyzing row ${itemIndex}:`, err);
          }
        }

        processedCount++;
        const percent = Math.round((processedCount / total) * 100);
        progressBarFill.style.width = `${percent}%`;
      }));
    }

    if (isProcessing) {
      progressStatusText.textContent = `✅ Successfully processed ${processedCount} posts!`;
      isProcessing = false;
      isPaused = false;
      processBtn.textContent = 'Process Posts';
      processBtn.className = 'btn btn-primary';
      await checkAIServiceStatus();

      // Switch to data browser tab
      document.querySelector('[data-tab="dataView"]').click();
      await loadAndRenderPosts();
    }
  });

  // --- Reset All Cached Data ---
  resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all saved post analyses from browser storage?')) {
      await window.postStorage.clearAllPosts();
      parsedRawRows = [];
      processBtn.disabled = true;
      processBtn.textContent = 'Process Posts';
      processBtn.className = 'btn btn-primary';
      isProcessing = false;
      isPaused = false;
      if (filePreviewCard) filePreviewCard.style.display = 'none';
      progressContainer.style.display = 'none';
      await loadAndRenderPosts();
    }
  });

  // --- Load & Render Posts ---
  async function loadAndRenderPosts() {
    const allPosts = await window.postStorage.getAllPosts();
    totalPostsCount.textContent = allPosts.length;

    renderTopicChips(allPosts);
    renderTableRows(allPosts);
  }

  // --- Topic Chips (TOC) ---
  function renderTopicChips(allPosts) {
    const topicCounts = {};
    let starredCount = 0;
    let readCount = 0;
    let unreadCount = 0;

    allPosts.forEach(p => {
      topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1;
      if (p.starred) starredCount++;
      if (p.read) {
        readCount++;
      } else {
        unreadCount++;
      }
    });

    topicChipsContainer.innerHTML = '';

    // "All Posts" chip
    const allChip = document.createElement('div');
    allChip.className = `topic-chip ${currentFilterTopic === 'All' ? 'active' : ''}`;
    allChip.innerHTML = `All Posts <span class="chip-count">${allPosts.length}</span>`;
    allChip.addEventListener('click', () => {
      currentFilterTopic = 'All';
      loadAndRenderPosts();
    });
    topicChipsContainer.appendChild(allChip);

    // "Star Posts" chip (Right after All Posts)
    const starChip = document.createElement('div');
    starChip.className = `topic-chip ${currentFilterTopic === 'Starred' ? 'active' : ''}`;
    starChip.style.backgroundColor = currentFilterTopic === 'Starred' ? '#f59e0b' : '#fef3c7';
    starChip.style.color = currentFilterTopic === 'Starred' ? '#ffffff' : '#b45309';
    starChip.style.borderColor = '#fde68a';
    starChip.innerHTML = `⭐ Star Posts <span class="chip-count">${starredCount}</span>`;
    starChip.addEventListener('click', () => {
      currentFilterTopic = 'Starred';
      loadAndRenderPosts();
    });
    topicChipsContainer.appendChild(starChip);

    // "Unread" chip (Right after Star Posts)
    const unreadChip = document.createElement('div');
    unreadChip.className = `topic-chip ${currentFilterTopic === 'Unread' ? 'active' : ''}`;
    unreadChip.style.backgroundColor = currentFilterTopic === 'Unread' ? '#3b82f6' : '#dbeafe';
    unreadChip.style.color = currentFilterTopic === 'Unread' ? '#ffffff' : '#1d4ed8';
    unreadChip.style.borderColor = '#bfdbfe';
    unreadChip.innerHTML = `✉️ Unread <span class="chip-count">${unreadCount}</span>`;
    unreadChip.addEventListener('click', () => {
      currentFilterTopic = 'Unread';
      loadAndRenderPosts();
    });
    topicChipsContainer.appendChild(unreadChip);

    // "Read" chip (Right after Unread)
    const readChip = document.createElement('div');
    readChip.className = `topic-chip ${currentFilterTopic === 'Read' ? 'active' : ''}`;
    readChip.style.backgroundColor = currentFilterTopic === 'Read' ? '#64748b' : '#f1f5f9';
    readChip.style.color = currentFilterTopic === 'Read' ? '#ffffff' : '#475569';
    readChip.style.borderColor = '#e2e8f0';
    readChip.innerHTML = `👁️ Read <span class="chip-count">${readCount}</span>`;
    readChip.addEventListener('click', () => {
      currentFilterTopic = 'Read';
      loadAndRenderPosts();
    });
    topicChipsContainer.appendChild(readChip);

    Object.keys(topicCounts).sort((a, b) => a.localeCompare(b)).forEach(topic => {
      const chip = document.createElement('div');
      chip.className = `topic-chip ${currentFilterTopic === topic ? 'active' : ''}`;
      chip.innerHTML = `${topic} <span class="chip-count">${topicCounts[topic]}</span>`;
      chip.addEventListener('click', () => {
        currentFilterTopic = topic;
        loadAndRenderPosts();
      });
      topicChipsContainer.appendChild(chip);
    });
  }

  // --- Render Data Table ---
  function renderTableRows(allPosts) {
    const searchTerm = searchInput.value.toLowerCase().trim();

    const filtered = allPosts.filter(p => {
      let matchesTopic = false;
      if (currentFilterTopic === 'All') {
        matchesTopic = true;
      } else if (currentFilterTopic === 'Starred') {
        matchesTopic = p.starred;
      } else if (currentFilterTopic === 'Unread') {
        matchesTopic = !p.read;
      } else if (currentFilterTopic === 'Read') {
        matchesTopic = p.read;
      } else {
        matchesTopic = (p.topic === currentFilterTopic);
      }
      
      const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(searchTerm) ||
        p.jobTitle.toLowerCase().includes(searchTerm) ||
        p.postSummary.toLowerCase().includes(searchTerm) ||
        p.topic.toLowerCase().includes(searchTerm);
      
      return matchesTopic && matchesSearch;
    });

    // Sort by Topic (Tag) alphabetically, then by Date descending
    filtered.sort((a, b) => {
      const topicCompare = (a.topic || '').localeCompare(b.topic || '');
      if (topicCompare !== 0) return topicCompare;
      
      // Secondary sort: Date descending (newest first)
      let timeA = 0;
      let timeB = 0;
      if (a.date && a.date !== 'N/A') {
        const parsed = new Date(a.date).getTime();
        if (!isNaN(parsed)) timeA = parsed;
      }
      if (b.date && b.date !== 'N/A') {
        const parsed = new Date(b.date).getTime();
        if (!isNaN(parsed)) timeB = parsed;
      }
      return timeB - timeA;
    });

    postsTableBody.innerHTML = '';

    if (filtered.length === 0) {
      postsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No saved posts found matching criteria. Import a file or adjust filters.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement('tr');
      if (p.read) {
        tr.classList.add('row-read');
      }

      const badgeClass = p.sentiment === 'Positive' ? 'badge-positive' : 
                         p.sentiment === 'Negative' ? 'badge-negative' : 'badge-neutral';

      // Name & Title combined cell (Uses hyperlink ONLY if Profile column URL exists; otherwise static text)
      const nameHtml = p.profileLink ? 
        `<a href="${escapeHtml(p.profileLink)}" target="_blank" rel="noopener" class="author-name-link">${escapeHtml(p.name)}</a>` :
        `<strong style="color: var(--text-main);">${escapeHtml(p.name)}</strong>`;

      const nameAndTitleHtml = `
        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
          <div>${nameHtml}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.3;">${escapeHtml(p.jobTitle)}</div>
        </div>
      `;

      // Post Summary & Topic combined cell
      const postSummaryHtml = `
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${escapeHtml(p.postSummary)}</div>
          <div><span class="topic-pill-tag">${escapeHtml(p.topic)}</span></div>
        </div>
      `;

      // Combined Links column (Post link + embedded body links)
      let linksList = [];
      if (p.linkToPost) {
        linksList.push(`• <a href="${escapeHtml(p.linkToPost)}" target="_blank" rel="noopener" class="body-link" data-link-type="post">Post ↗</a>`);
      }
      if (p.linkInsidePost && p.linkInsidePost !== 'None') {
        const urls = p.linkInsidePost.split(',').map(u => u.trim());
        urls.forEach(url => {
          let cleanUrl = url.replace(/https?:\/\/(www\.)?/, '');
          const displayUrl = cleanUrl.length > 6 ? cleanUrl.slice(0, 6) + '...' : cleanUrl;
          linksList.push(`• <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="body-link" data-link-type="embed" title="${escapeHtml(url)}">${escapeHtml(displayUrl)} ↗</a>`);
        });
      }
      const linksHtml = linksList.length > 0 ? linksList.join('<br>') : '<span style="color: var(--text-muted);">None</span>';

      tr.innerHTML = `
        <td style="white-space: nowrap; font-size: 0.85rem;">${p.date || 'N/A'}</td>
        <td style="max-width: 220px;">${nameAndTitleHtml}</td>
        <td style="max-width: 280px;">${postSummaryHtml}</td>
        <td style="font-size: 0.825rem;">${linksHtml}</td>
        <td>
          <div class="sentiment-cell">
            <div><span class="badge ${badgeClass}">${escapeHtml(p.sentiment)}</span></div>
            <div class="sentiment-reason">${escapeHtml(p.sentimentReason)}</div>
          </div>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <input type="checkbox" class="read-checkbox" data-id="${p.id}" ${p.read ? 'checked' : ''}>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <button class="btn-icon star-btn ${p.starred ? 'starred' : ''}" data-id="${p.id}" title="${p.starred ? 'Starred reminder' : 'Star post'}">
            ${p.starred ? '⭐' : '☆'}
          </button>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <button class="btn-icon edit-btn" data-id="${p.id}" title="Edit Category Topic">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: 0 auto; color: var(--text-muted);">
              <!-- Tag base -->
              <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l4.71-4.71c.94-.94.94-2.48 0-3.42L12 2Z"></path>
              <path d="M7 7h.01"></path>
              <!-- Pencil over tag -->
              <path d="m16 5 3 3"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </td>
      `;

      postsTableBody.appendChild(tr);
    });

    // Add event listeners to Read checkboxes
    document.querySelectorAll('.read-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const postId = e.target.getAttribute('data-id');
        const isChecked = e.target.checked;
        
        const targetPost = await window.postStorage.getPost(postId);
        if (targetPost) {
          targetPost.read = isChecked;
          await window.postStorage.savePost(targetPost);
          await loadAndRenderPosts();
        }
      });
    });

    // Add event listeners to Star buttons
    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const postId = e.target.closest('.star-btn').getAttribute('data-id');
        const targetPost = await window.postStorage.getPost(postId);
        if (targetPost) {
          targetPost.starred = !targetPost.starred;
          await window.postStorage.savePost(targetPost);
          await loadAndRenderPosts();
        }
      });
    });

    // Add event listeners to Edit Category buttons (Pencil over Tag SVG icon)
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const postId = e.target.closest('.edit-btn').getAttribute('data-id');
        editingPostId = postId;
        await openCategoryEditModal(postId);
      });
    });

    // Add event listener to delegate body-link clicks for analytics
    if (postsTableBody) {
      postsTableBody.addEventListener('click', async (e) => {
        const link = e.target.closest('a');
        if (link && link.classList.contains('body-link')) {
          const type = link.getAttribute('data-link-type');
          const eventName = type === 'post' ? 'linkedin_post_link_click' : 'linkedin_embed_link_click';
          
          let savedPostsCount = 0;
          try {
            const allPosts = await window.postStorage.getAllPosts();
            savedPostsCount = allPosts.length;
          } catch (err) {
            console.warn('Failed to retrieve post count for analytics', err);
          }
          
          trackEvent(eventName, savedPostsCount);
        }
      });
    }
  }

  // --- Category Edit Modal Logic ---
  let editingPostId = null;
  const categoryEditModal = document.getElementById('categoryEditModal');
  const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
  const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
  const saveCategoryBtn = document.getElementById('saveCategoryBtn');
  const categorySelect = document.getElementById('categorySelect');
  const customCategoryGroup = document.getElementById('customCategoryGroup');
  const customCategoryInput = document.getElementById('customCategoryInput');

  async function openCategoryEditModal(postId) {
    const post = await window.postStorage.getPost(postId);
    if (!post) return;

    const allPosts = await window.postStorage.getAllPosts();
    const existingTopics = Array.from(new Set(allPosts.map(p => p.topic).filter(Boolean)));
    
    // Ensure standard default topics are also present
    const defaultTopics = [
      'Product Design & UX',
      'AI & Machine Learning',
      'Cloud & Infrastructure',
      'Career & Hiring Opportunities',
      'Product Strategy & Leadership',
      'Industry Insights & Updates'
    ];
    
    const combinedTopics = Array.from(new Set([...existingTopics, ...defaultTopics])).sort((a, b) => a.localeCompare(b));

    categorySelect.innerHTML = '';
    combinedTopics.forEach(top => {
      const opt = document.createElement('option');
      opt.value = top;
      opt.textContent = top;
      if (top === post.topic) opt.selected = true;
      categorySelect.appendChild(opt);
    });

    // Add Write-in Option at the bottom
    const writeInOpt = document.createElement('option');
    writeInOpt.value = '__WRITE_IN__';
    writeInOpt.textContent = '✏️ + Write-in new category...';
    categorySelect.appendChild(writeInOpt);

    customCategoryGroup.style.display = 'none';
    customCategoryInput.value = '';
    categoryEditModal.classList.add('active');
  }

  categorySelect.addEventListener('change', () => {
    if (categorySelect.value === '__WRITE_IN__') {
      customCategoryGroup.style.display = 'block';
      customCategoryInput.focus();
    } else {
      customCategoryGroup.style.display = 'none';
    }
  });

  const closeCategoryModal = () => categoryEditModal.classList.remove('active');
  closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
  cancelCategoryBtn.addEventListener('click', closeCategoryModal);

  saveCategoryBtn.addEventListener('click', async () => {
    if (!editingPostId) return;

    let selectedTopic = categorySelect.value;
    if (selectedTopic === '__WRITE_IN__') {
      selectedTopic = customCategoryInput.value.trim();
      if (!selectedTopic) {
        alert('Please enter a custom category name.');
        return;
      }
    }

    const post = await window.postStorage.getPost(editingPostId);
    if (post) {
      post.topic = selectedTopic;
      await window.postStorage.savePost(post);
      closeCategoryModal();
      await loadAndRenderPosts();
    }
  });

  function syncModelIndicators() {
    const provider = window.aiService.currentProvider || 'window.ai';
    const ratings = window.AI_CONFIG && window.AI_CONFIG.ratings;
    const modelInfo = ratings && ratings[provider];
    
    if (modelInfo) {
      if (modelSpeed) modelSpeed.textContent = modelInfo.speed || 'N/A';
      if (modelCost) modelCost.textContent = modelInfo.cost || 'N/A';
    }
  }

  // Call sync initial state
  syncModelIndicators();

  searchInput.addEventListener('input', () => loadAndRenderPosts());

  // --- Export CSV & XLSX ---
  exportCsvBtn.addEventListener('click', async () => {
    const allPosts = await window.postStorage.getAllPosts();
    if (allPosts.length === 0) return alert('No post data to export!');
    
    const worksheet = XLSX.utils.json_to_sheet(allPosts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Saved Posts');
    XLSX.writeFile(workbook, 'LinkedIn_Saved_Posts_Curated.csv', { bookType: 'csv' });
  });

  exportXlsxBtn.addEventListener('click', async () => {
    const allPosts = await window.postStorage.getAllPosts();
    if (allPosts.length === 0) return alert('No post data to export!');
    
    const worksheet = XLSX.utils.json_to_sheet(allPosts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Saved Posts');
    XLSX.writeFile(workbook, 'LinkedIn_Saved_Posts_Curated.xlsx');
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
