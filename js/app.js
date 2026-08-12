/**
 * app.js - Main Application Controller for SPB
 * Handles UI interactions, tab switching, drag-drop ingestion, table rendering, and search filtering.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabViews = document.querySelectorAll('.tab-view');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const processBtn = document.getElementById('processBtn');
  const resetBtn = document.getElementById('resetBtn');
  const activeFileName = document.getElementById('activeFileName');
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
  
  // Settings & Modal Elements
  const settingsPill = document.getElementById('settingsPill');
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

  // --- Initial Setup ---
  setupSettingsModalListeners();
  renderFAQSection();
  await checkAIServiceStatus();
  await loadAndRenderPosts();

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
    if (settingsPill) {
      settingsPill.addEventListener('click', () => {
        settingsModal.classList.add('active');
        updateModalState();
      });
    }

    const selectAIBtn = document.getElementById('selectAIBtn');
    if (selectAIBtn) {
      selectAIBtn.addEventListener('click', () => {
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

    if (caps.activeProvider === 'window.ai') {
      if (caps.windowAI) {
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Chrome Built-in AI';
      } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Chrome Built-in AI (Not Ready)';
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

    // Toggle maroon select AI button visibility and process button readiness
    if (selectAIBtn) {
      selectAIBtn.style.display = ready ? 'none' : 'block';
    }

    // Enable processBtn if file is loaded AND AI model is ready
    if (parsedRawRows && parsedRawRows.length > 0) {
      processBtn.disabled = !ready;
    } else {
      processBtn.disabled = true;
    }
  }

  // --- Drag and Drop File Upload ---
  dropzone.addEventListener('click', () => fileInput.click());
  
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
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
      filePreviewCard.style.display = 'block';

      progressStatusText.textContent = `File ready! Found ${parsedRawRows.length} unique rows (${uniqueCount} new to analyze, ${cachedCount} in cache).`;
    } catch (err) {
      alert('Error parsing spreadsheet file: ' + err.message);
    }
  }

  // --- Process File & Batch Analyze with Concurrency & Row Limit ---
  processBtn.addEventListener('click', async () => {
    if (parsedRawRows.length === 0) return;

    // Check user-specified max row limit
    let rowLimit = parseInt(maxRowsInput.value, 10);
    let rowsToProcess = parsedRawRows;

    if (!isNaN(rowLimit) && rowLimit > 0) {
      rowsToProcess = parsedRawRows.slice(0, rowLimit);
    }

    processBtn.disabled = true;
    progressContainer.style.display = 'block';

    let processedCount = 0;
    const total = rowsToProcess.length;
    const BATCH_SIZE = 3; // Process 3 posts concurrently for 3x-5x speed boost

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = rowsToProcess.slice(i, i + BATCH_SIZE);

      await Promise.all(chunk.map(async (raw, idx) => {
        const itemIndex = i + idx;
        const hashId = await window.postStorage.generateHashId(raw.linkToPost, raw.date, raw.name, raw.postText);

        // Check cache first
        let cachedPost = await window.postStorage.getPost(hashId);

        if (!cachedPost) {
          progressStatusText.textContent = `Analyzing posts (${processedCount + 1}/${total}) via AI...`;
          
          try {
            const aiAnalysis = await window.aiService.analyzePost(raw);
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

    progressStatusText.textContent = `✅ Successfully processed ${processedCount} posts!`;
    await checkAIServiceStatus();

    // Switch to data browser tab
    document.querySelector('[data-tab="dataView"]').click();
    await loadAndRenderPosts();
  });

  // --- Reset All Cached Data ---
  resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all saved post analyses from browser storage?')) {
      await window.postStorage.clearAllPosts();
      parsedRawRows = [];
      processBtn.disabled = true;
      activeFileName.textContent = '';
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

    allPosts.forEach(p => {
      topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1;
      if (p.starred) starredCount++;
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

    Object.keys(topicCounts).forEach(topic => {
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
      const matchesTopic = currentFilterTopic === 'All' || 
        (currentFilterTopic === 'Starred' ? p.starred : p.topic === currentFilterTopic);
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
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
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
        linksList.push(`• <a href="${escapeHtml(p.linkToPost)}" target="_blank" rel="noopener" class="body-link">Post ↗</a>`);
      }
      if (p.linkInsidePost && p.linkInsidePost !== 'None') {
        const urls = p.linkInsidePost.split(',').map(u => u.trim());
        urls.forEach(url => {
          const displayUrl = url.length > 25 ? url.slice(0, 23) + '...' : url;
          linksList.push(`• <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="body-link">${escapeHtml(displayUrl)} ↗</a>`);
        });
      }
      const linksHtml = linksList.length > 0 ? linksList.join('<br>') : '<span style="color: var(--text-muted);">None</span>';

      tr.innerHTML = `
        <td style="white-space: nowrap; font-size: 0.85rem;">${p.date || 'N/A'}</td>
        <td style="max-width: 220px;">${nameAndTitleHtml}</td>
        <td style="max-width: 280px;">${postSummaryHtml}</td>
        <td style="font-size: 0.825rem; min-width: 110px; white-space: nowrap;">${linksHtml}</td>
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
          
          const parentRow = e.target.closest('tr');
          if (isChecked) {
            parentRow.classList.add('row-read');
          } else {
            parentRow.classList.remove('row-read');
          }
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
    
    const combinedTopics = Array.from(new Set([...existingTopics, ...defaultTopics]));

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
