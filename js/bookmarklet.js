/**
 * bookmarklet.js - SPB Bookmarklet Generator & Collector Injector
 * Generates a clean executable JavaScript bookmarklet for 1-click execution directly on LinkedIn.
 *
 * STRICT RULE: Never use the word 'SCRAPE'. Always use READ / COLLECT / PREP.
 */

(function () {
  function buildBookmarkletCode() {
    const targetOrigin = window.location.origin;

    const rawScript = `(function(){
  if(window.__SPB_COLLECTOR_ACTIVE__){
    alert('SPB Collector is already running on this page!');
    return;
  }
  window.__SPB_COLLECTOR_ACTIVE__ = true;

  var TARGET_ORIGIN = "${targetOrigin}";

  var overlay = document.createElement('div');
  overlay.id = 'spb-bookmarklet-overlay';
  overlay.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;width:370px;background:#ffffff;border:2.5px solid #2563eb;border-radius:12px;box-shadow:0 12px 35px rgba(0,0,0,0.25);padding:18px;font-family:system-ui,-apple-system,sans-serif;color:#1e293b;';

  overlay.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong style="font-size:14px;color:#2563eb;display:flex;align-items:center;gap:5px;">🔷 SPB Post Collector</strong><button id="spb-close-btn" style="border:none;background:none;font-size:18px;cursor:pointer;color:#64748b;font-weight:bold;">&times;</button></div><div id="spb-status-text" style="font-size:12.5px;color:#475569;margin-bottom:10px;line-height:1.4;background:#eff6ff;padding:10px;border-radius:8px;border:1px solid #bfdbfe;">Ready to read saved posts. Click <strong>Start Prep</strong> below.</div><div id="spb-progress-container" style="display:none;margin-bottom:12px;"><div style="background:#e2e8f0;border-radius:20px;height:8px;overflow:hidden;"><div id="spb-progress-fill" style="background:#2563eb;width:0%;height:100%;transition:width 0.3s ease;"></div></div></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button id="spb-prep-btn" style="flex:1;background:#2563eb;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">Start Prep</button><button id="spb-pause-btn" style="display:none;flex:1;background:#f59e0b;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">⏸ Pause</button><button id="spb-resume-btn" style="display:none;flex:1;background:#2563eb;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">▶ Resume</button><button id="spb-cancel-btn" style="display:none;background:#ef4444;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">❌ Cancel</button><button id="spb-finish-btn" style="display:none;background:#22c55e;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;">🏁 Finish</button><button id="spb-send-btn" style="display:none;width:100%;background:#22c55e;color:#fff;border:none;padding:9px 12px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;">🚀 Send to SPB App</button></div>';

  document.body.appendChild(overlay);

  var isPaused = false;
  var collectedMap = {};
  var collectedPosts = [];

  var statusText = document.getElementById('spb-status-text');
  var progressContainer = document.getElementById('spb-progress-container');
  var progressFill = document.getElementById('spb-progress-fill');
  var prepBtn = document.getElementById('spb-prep-btn');
  var pauseBtn = document.getElementById('spb-pause-btn');
  var resumeBtn = document.getElementById('spb-resume-btn');
  var cancelBtn = document.getElementById('spb-cancel-btn');
  var finishBtn = document.getElementById('spb-finish-btn');
  var sendBtn = document.getElementById('spb-send-btn');
  var closeBtn = document.getElementById('spb-close-btn');

  closeBtn.onclick = function(){
    overlay.remove();
    window.__SPB_COLLECTOR_ACTIVE__ = false;
  };

  function readPostsFromDOM(){
    // Robust selectors supporting multiple viewport layouts and LinkedIn structures
    var selectors = [
      'div[data-view-name*="search-entity-result"]',
      'div[data-chameleon-result-urn]',
      'div[data-urn*="urn:li:activity"]',
      'li.search-results-container li',
      'li.reusable-search__result-container',
      'div.entity-result',
      'div.update-components-text'
    ];

    var postNodes = document.querySelectorAll(selectors.join(', '));

    postNodes.forEach(function(node){
      try {
        // 1. Extract Author Name and Profile Link dynamically by inspecting all profile links in the card node
        var authorName = 'LinkedIn Member';
        var profileLink = '';
        var allInLinks = node.querySelectorAll('a[href*="/in/"]');
        
        for (var idx = 0; idx < allInLinks.length; idx++) {
          var linkText = allInLinks[idx].innerText.trim();
          // The profile link wrapping the name always has actual text (more than just a space/empty)
          if (linkText && linkText.length > 2 && !linkText.includes('View profile') && !linkText.includes('LinkedIn Member')) {
            // Strip out sub-lines or badges like "• 2nd" if they got pulled in
            authorName = linkText.split(String.fromCharCode(10))[0].split('•')[0].split('—')[0].trim();
            profileLink = allInLinks[idx].href;
            break;
          }
        }
        
        // Fallback name capture if no profile link has text
        if (authorName === 'LinkedIn Member' && allInLinks.length > 0) {
          var nameSpan = node.querySelector('span[dir="ltr"] span, span[dir="ltr"]');
          if (nameSpan) {
            authorName = nameSpan.innerText.trim();
          }
        }

        // 2. Extract Job Title / Headline
        // Typically lives in a separate div/subtitle line near the actor metadata
        var headlineText = '';
        var headlineEl = node.querySelector('.entity-result__primary-subtitle, [class*="primary-subtitle"], [class*="caption"] div');
        if (headlineEl) {
          headlineText = headlineEl.innerText.trim();
        } else {
          // Fallback: look for standard typography elements that don't match the author's name
          var divs = node.querySelectorAll('div, span, p');
          for (var d = 0; d < divs.length; d++) {
            var el = divs[d];
            var txt = el.innerText.trim();
            var className = el.className || '';
            
            // Ignore screen-reader accessibility items, indicators, and status strings
            if (className.indexOf('visually-hidden') !== -1 || className.indexOf('presence') !== -1 || txt.toLowerCase().indexOf('status is') === 0) {
              continue;
            }
            
            // Job titles are short single-lines describing roles, excluding name, text summaries, or date stamps
            if (txt && txt.length > 5 && txt.length < 120 && txt !== authorName && !txt.includes('•') && !txt.includes('see more') && el.children.length === 0) {
              headlineText = txt;
              break;
            }
          }
        }
        
        // If still empty, search for the obfuscated selector from the 2026 outerHTML
        if (!headlineText) {
          var obfuscatedSubtitleEl = node.querySelector('div[class*="yfXCimFlSHnTwQurnVGYCTByIGZyAMhA"]');
          if (obfuscatedSubtitleEl) {
            headlineText = obfuscatedSubtitleEl.innerText.trim();
          }
        }
        
        // Clean headline from bad characters
        headlineText = headlineText.split(String.fromCharCode(10))[0].replace(/•/g, '').trim();
        var fullAuthorTitle = authorName + (headlineText ? (' — ' + headlineText) : '');

        // 3. Post Body Text Summary
        var textEl = node.querySelector('p.entity-result__content-summary, .entity-result__summary, [class*="content-summary"]');
        var summaryText = textEl ? textEl.innerText.replace('see more', '').replace('…see more', '').trim() : '';

        // 4. Post Permalink
        var permalinkEl = node.querySelector('a[href*="/feed/update/"], a[href*="activity"], a[href*="/news/"]');
        var permalink = permalinkEl ? permalinkEl.href : profileLink;

        // 5. Saved Date
        var dateEl = node.querySelector('p.t-black--light span, time, [class*="caption"]');
        var postDate = dateEl ? dateEl.innerText.trim().split('•')[0].trim() : new Date().toISOString().split('T')[0];

        if (summaryText && summaryText.length > 10) {
          // Accumulate posts in map to prevent loss when LinkedIn prunes DOM elements
          if (!collectedMap[summaryText]) {
            try {
              node.style.outline = '2px solid #2563eb';
              node.style.outlineOffset = '2px';
            } catch(e){}

            collectedMap[summaryText] = {
              // Pure raw data fields for app processor
              date: postDate,
              name: authorName,
              jobTitle: headlineText || 'N/A',
              postText: summaryText,
              linkToPost: permalink,
              profileLink: profileLink,

              // User-facing table display fields
              Date: postDate,
              'Name & Title': profileLink ? ('<a href="' + profileLink + '">' + authorName + '</a>' + (headlineText ? ('<br><small style="color:#64748b;">' + headlineText + '</small>') : '')) : fullAuthorTitle,
              'Post Summary': summaryText,
              Links: permalink ? ('• <a href="' + permalink + '" target="_blank">Post ↗</a>') : ''
            };
          }
        }
      } catch(err) {
        console.warn('Error parsing individual post card node', err);
      }
    });

    // Convert map to flat array
    var results = [];
    for (var key in collectedMap) {
      if (collectedMap.hasOwnProperty(key)) {
        results.push(collectedMap[key]);
      }
    }
    return results;
  }

  prepBtn.onclick = function(){
    prepBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    progressContainer.style.display = 'block';

    statusText.innerHTML = '⏳ <strong>Prepping LinkedIn DOM...</strong><br>Reading saved post count...';

    var lastScrollHeight = 0;
    var sameHeightCount = 0;
    var pageCount = 1;

    var scrollInterval = setInterval(function(){
      if (isPaused) return;

      // Scroll window
      window.scrollBy(0, 600);
      
      // Scroll scrollable main layout containers if they exist
      var scrollableElements = document.querySelectorAll('.scaffold-layout__main, main, .search-results-container, [class*="scaffold-layout"]');
      scrollableElements.forEach(function(el) {
        if (el) el.scrollTop += 600;
      });

      pageCount++;
      var currentBatch = readPostsFromDOM();
      collectedPosts = currentBatch;

      if (collectedPosts.length > 0) {
        statusText.innerHTML = '⚡ <strong>Reading saved posts...</strong><br>Found <strong style="color:#2563eb;">' + collectedPosts.length + ' posts</strong> in <strong>' + pageCount + ' pages</strong> so far!';
        var percentage = Math.min(100, Math.round((collectedPosts.length / 100) * 100));
        progressFill.style.width = percentage + '%';
      } else {
        statusText.innerHTML = '⏳ Scrolling feed (page ' + pageCount + ')... Searching for post elements...';
      }

      // Check if we hit the absolute bottom of the feed (stable height across 3 passes)
      var currentScrollHeight = document.body.offsetHeight;
      var isAtBottom = (window.innerHeight + window.scrollY) >= (currentScrollHeight - 150);

      if (currentScrollHeight === lastScrollHeight && isAtBottom) {
        sameHeightCount++;
      } else {
        sameHeightCount = 0;
      }
      lastScrollHeight = currentScrollHeight;

      if (sameHeightCount >= 3 && collectedPosts.length > 0) {
        clearInterval(scrollInterval);
        finishReading();
      }
    }, 950);

    pauseBtn.onclick = function(){
      isPaused = true;
      pauseBtn.style.display = 'none';
      
      // Switch to 3 buttons: Resume, Cancel, Finish
      resumeBtn.style.display = 'inline-block';
      cancelBtn.style.display = 'inline-block';
      finishBtn.style.display = 'inline-block';

      statusText.innerHTML = '⏸ <strong>Reading paused.</strong><br>Found <strong style="color:#2563eb;">' + collectedPosts.length + ' posts</strong> in <strong>' + pageCount + ' pages</strong> so far.';
    };

    resumeBtn.onclick = function(){
      isPaused = false;
      resumeBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      finishBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-block';
      statusText.innerHTML = '⚡ <strong>Resuming post read...</strong><br>Found <strong style="color:#2563eb;">' + collectedPosts.length + ' posts</strong> in <strong>' + pageCount + ' pages</strong>...';
    };

    cancelBtn.onclick = function(){
      clearInterval(scrollInterval);
      overlay.remove();
      window.__SPB_COLLECTOR_ACTIVE__ = false;
    };

    finishBtn.onclick = function(){
      clearInterval(scrollInterval);
      finishReading();
    };

    function finishReading(){
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      finishBtn.style.display = 'none';
      sendBtn.style.display = 'block';
      progressFill.style.width = '100%';
      statusText.innerHTML = '🎉 <strong>Read Complete!</strong><br>Collected <strong style="color:#16a34a;">' + collectedPosts.length + ' posts</strong> in <strong>' + pageCount + ' pages</strong>. Click <strong>Send to SPB App</strong> below.';
    }
  };

  sendBtn.onclick = function(){
    try {
      var jsonString = JSON.stringify(collectedPosts);
      
      // Try to pass via URL query parameter if payload is small enough (~5KB)
      if (jsonString.length < 5000) {
        var transferUrl = TARGET_ORIGIN + '?import=' + encodeURIComponent(jsonString);
        window.open(transferUrl, '_blank');
      } else {
        // Fallback: Use browser Blob to trigger a real file download
        var blob = new Blob([jsonString], { type: 'application/json' });
        var blobUrl = window.URL.createObjectURL(blob);
        
        // Generate dynamic timestamp: YYYY-MM-DD_HH-MM
        var now = new Date();
        var yyyy = now.getFullYear();
        var mm = String(now.getMonth() + 1).padStart(2, '0');
        var dd = String(now.getDate()).padStart(2, '0');
        var hh = String(now.getHours()).padStart(2, '0');
        var min = String(now.getMinutes()).padStart(2, '0');
        var timestamp = yyyy + '-' + mm + '-' + dd + '_' + hh + '-' + min;
        var fileName = "spb_linkedin_import_" + collectedPosts.length + "-posts_" + timestamp + ".json";

        var downloadAnchor = document.createElement('a');
        downloadAnchor.href = blobUrl;
        downloadAnchor.download = fileName;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        
        // Clean up
        document.body.removeChild(downloadAnchor);
        window.URL.revokeObjectURL(blobUrl);

        alert('🎉 Collected posts downloaded to your computer as "' + fileName + '"!\\n\\nJust drag and drop this file into the SPB App upload box.');
        window.open(TARGET_ORIGIN, '_blank');
      }
    } catch (e) {
      alert('Error exporting post data: ' + e.message);
    }
  };
})();`;

    return 'javascript:' + encodeURIComponent(rawScript);
  }

  function initBookmarklet() {
    var bookmarkletLink = document.getElementById('bookmarkletLink');
    if (bookmarkletLink) {
      bookmarkletLink.href = buildBookmarkletCode();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookmarklet);
  } else {
    initBookmarklet();
  }
})();
