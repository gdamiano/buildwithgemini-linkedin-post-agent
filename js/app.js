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
  
  // Settings & Modal
  const settingsPill = document.getElementById('settingsPill');
  const settingsModal = document.getElementById('settingsModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const providerSelect = document.getElementById('providerSelect');
  const geminiKeyInput = document.getElementById('geminiKeyInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  let parsedRawRows = [];
  let currentFilterTopic = 'All';

  // --- Initial Setup ---
  await checkAIServiceStatus();
  await loadAndRenderPosts();

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

  // --- Settings Modal ---
  settingsPill.addEventListener('click', () => settingsModal.classList.add('active'));
  closeModalBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

  saveSettingsBtn.addEventListener('click', async () => {
    const selectedProvider = providerSelect.value;
    window.aiService.setProvider(selectedProvider);
    window.aiService.setGeminiApiKey(geminiKeyInput.value);
    await checkAIServiceStatus();
    settingsModal.classList.remove('active');
  });

  async function checkAIServiceStatus() {
    const caps = await window.aiService.checkCapabilities();
    providerSelect.value = caps.activeProvider;
    geminiKeyInput.value = window.aiService.geminiApiKey;

    if (caps.activeProvider === 'window.ai') {
      if (caps.windowAI) {
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Chrome Built-in AI';
      } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'window.ai (Simulated Fallback)';
      }
    } else if (caps.activeProvider === 'gemini') {
      statusDot.className = 'status-dot active';
      statusText.textContent = 'Gemini API Key Active';
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Simulator Mode';
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

  async function handleSelectedFile(file) {
    activeFileName.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    try {
      parsedRawRows = await window.fileParser.parseSpreadsheet(file);
      processBtn.disabled = false;
      progressStatusText.textContent = `File ready. Found ${parsedRawRows.length} post rows.`;
    } catch (err) {
      alert('Error parsing spreadsheet file: ' + err.message);
    }
  }

  // --- Process File & Batch Analyze with Concurrency ---
  processBtn.addEventListener('click', async () => {
    if (parsedRawRows.length === 0) return;

    processBtn.disabled = true;
    progressContainer.style.display = 'block';

    let processedCount = 0;
    const total = parsedRawRows.length;
    const BATCH_SIZE = 3; // Process 3 posts concurrently for 3x-5x speed boost

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = parsedRawRows.slice(i, i + BATCH_SIZE);

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
    processBtn.disabled = false;

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
    allPosts.forEach(p => {
      topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1;
    });

    topicChipsContainer.innerHTML = '';

    // "All" chip
    const allChip = document.createElement('div');
    allChip.className = `topic-chip ${currentFilterTopic === 'All' ? 'active' : ''}`;
    allChip.innerHTML = `All Posts <span class="chip-count">${allPosts.length}</span>`;
    allChip.addEventListener('click', () => {
      currentFilterTopic = 'All';
      loadAndRenderPosts();
    });
    topicChipsContainer.appendChild(allChip);

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
      const matchesTopic = currentFilterTopic === 'All' || p.topic === currentFilterTopic;
      const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(searchTerm) ||
        p.jobTitle.toLowerCase().includes(searchTerm) ||
        p.postSummary.toLowerCase().includes(searchTerm) ||
        p.topic.toLowerCase().includes(searchTerm);
      
      return matchesTopic && matchesSearch;
    });

    postsTableBody.innerHTML = '';

    if (filtered.length === 0) {
      postsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
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

      const postLinkHtml = p.linkToPost ? 
        `<a href="${escapeHtml(p.linkToPost)}" target="_blank" rel="noopener">View Post 🔗</a>` : 'N/A';

      // Format links inside body as clickable <a> tags
      let linksInsideBodyHtml = 'None';
      if (p.linkInsidePost && p.linkInsidePost !== 'None') {
        const urls = p.linkInsidePost.split(',').map(u => u.trim());
        linksInsideBodyHtml = urls.map(url => {
          const displayUrl = url.length > 30 ? url.slice(0, 28) + '...' : url;
          return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="body-link">${escapeHtml(displayUrl)} ↗</a>`;
        }).join('<br>');
      }

      tr.innerHTML = `
        <td style="white-space: nowrap;">${p.date || 'N/A'}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td style="color: var(--text-muted);">${escapeHtml(p.jobTitle)}</td>
        <td>
          <div style="font-weight: 600; margin-bottom: 0.2rem;">${escapeHtml(p.postSummary)}</div>
          <span style="font-size: 0.75rem; background-color: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px;">${escapeHtml(p.topic)}</span>
        </td>
        <td style="font-size: 0.8rem; word-break: break-all;">${linksInsideBodyHtml}</td>
        <td style="white-space: nowrap;">${postLinkHtml}</td>
        <td>
          <div class="sentiment-cell">
            <div><span class="badge ${badgeClass}">${escapeHtml(p.sentiment)}</span></div>
            <div class="sentiment-reason">${escapeHtml(p.sentimentReason)}</div>
          </div>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <input type="checkbox" class="read-checkbox" data-id="${p.id}" ${p.read ? 'checked' : ''}>
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
  }

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
