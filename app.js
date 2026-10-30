/**
 * SnapIT — Client-Side URL Shortener Logic
 * Handles slug generation, local & global shortening, redirection,
 * localStorage persistence, QR code generation, and click analytics.
 */

(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration & State
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'snapit_links_db';
  const LEGACY_STORAGE_KEY = 'snapurl_links_db';
  const THEME_KEY = 'snapit_theme_pref';
  const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const SLUG_LENGTH = 6;

  let currentMode = 'local'; // 'local' or 'global'
  let currentActiveResult = null; // currently generated short link object
  let linksDatabase = [];

  // DOM Elements Cache
  const elements = {
    // Theme
    themeToggleBtn: document.getElementById('theme-toggle-btn'),

    // Toast
    toastContainer: document.getElementById('toast-container'),

    // Redirect overlay
    redirectScreen: document.getElementById('redirect-screen'),
    redirectTargetUrl: document.getElementById('redirect-target-url'),
    countdownTimer: document.getElementById('countdown-timer'),
    btnRedirectNow: document.getElementById('btn-redirect-now'),
    btnRedirectCancel: document.getElementById('btn-redirect-cancel'),

    // Mode tabs
    modeLocalBtn: document.getElementById('mode-local-btn'),
    modeGlobalBtn: document.getElementById('mode-global-btn'),

    // Form
    urlForm: document.getElementById('url-shorten-form'),
    longUrlInput: document.getElementById('long-url-input'),
    btnPasteUrl: document.getElementById('btn-paste-url'),
    btnClearUrl: document.getElementById('btn-clear-url'),
    urlErrorMsg: document.getElementById('url-error-msg'),
    toggleAdvancedBtn: document.getElementById('toggle-advanced-btn'),
    advancedPanel: document.getElementById('advanced-options-panel'),
    customAliasInput: document.getElementById('custom-alias-input'),
    linkTitleInput: document.getElementById('link-title-input'),
    aliasPrefixDisplay: document.getElementById('alias-prefix-display'),
    btnShorten: document.getElementById('btn-shorten'),
    btnShortenText: document.getElementById('btn-shorten-text'),
    shortenSpinner: document.getElementById('shorten-spinner'),

    // Result card
    resultContainer: document.getElementById('result-container'),
    resultModeLabel: document.getElementById('result-mode-label'),
    resultShortUrl: document.getElementById('result-short-url'),
    resultOriginalUrl: document.getElementById('result-original-url'),
    btnCopyResult: document.getElementById('btn-copy-result'),
    btnVisitResult: document.getElementById('btn-visit-result'),
    btnShowQr: document.getElementById('btn-show-qr'),
    btnShareResult: document.getElementById('btn-share-result'),

    // QR Modal
    qrModal: document.getElementById('qr-modal'),
    qrModalClose: document.getElementById('qr-modal-close'),
    qrRenderTarget: document.getElementById('qr-code-render-target'),
    qrModalUrl: document.getElementById('qr-modal-url'),
    btnDownloadQr: document.getElementById('btn-download-qr'),
    btnCopyQrLink: document.getElementById('btn-copy-qr-link'),

    // Stats
    statTotalLinks: document.getElementById('stat-total-links'),
    statTotalClicks: document.getElementById('stat-total-clicks'),
    statTopLink: document.getElementById('stat-top-link'),

    // History Table
    historyCountBadge: document.getElementById('history-count-badge'),
    searchLinksInput: document.getElementById('search-links-input'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnClearAll: document.getElementById('btn-clear-all'),
    linksTable: document.getElementById('links-table'),
    linksTableBody: document.getElementById('links-table-body'),
    emptyState: document.getElementById('empty-state')
  };

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  function init() {
    loadTheme();
    loadLinksFromStorage();
    setupEventListeners();
    updatePrefixDisplay();

    // Check if the current page was visited via a shortened redirect link (?r=slug)
    handleIncomingRedirect();

    // Initial render of stats and history table
    renderLinksTable();
    updateStats();
  }

  // ---------------------------------------------------------------------------
  // Theme Management (Dark / Light)
  // ---------------------------------------------------------------------------
  function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'theme-light') {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    if (isDark) {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      localStorage.setItem(THEME_KEY, 'theme-light');
      showToast('Switched to light theme', 'info');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      localStorage.setItem(THEME_KEY, 'theme-dark');
      showToast('Switched to dark theme', 'info');
    }
  }

  // ---------------------------------------------------------------------------
  // Storage Management
  // ---------------------------------------------------------------------------
  function loadLinksFromStorage() {
    try {
      let data = localStorage.getItem(STORAGE_KEY);
      if (!data) data = localStorage.getItem(LEGACY_STORAGE_KEY);
      linksDatabase = data ? JSON.parse(data) : [];
      if (!Array.isArray(linksDatabase)) linksDatabase = [];
    } catch (e) {
      console.error('Failed to load links from localStorage', e);
      linksDatabase = [];
    }
  }

  function saveLinksToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(linksDatabase));
    } catch (e) {
      console.error('Failed to save links to localStorage', e);
      showToast('Storage quota exceeded or unavailable', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // URL Redirection Handling (?r=slug)
  // ---------------------------------------------------------------------------
  function handleIncomingRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectSlug = urlParams.get('r');

    if (!redirectSlug) return;

    // Search for matching link in database
    const matchingLink = linksDatabase.find(item => item.slug.toLowerCase() === redirectSlug.trim().toLowerCase());

    if (matchingLink) {
      // Increment clicks count
      matchingLink.clicks = (matchingLink.clicks || 0) + 1;
      matchingLink.lastAccessed = new Date().toISOString();
      saveLinksToStorage();

      // Show sleek redirect screen
      elements.redirectScreen.classList.remove('hidden');
      elements.redirectTargetUrl.textContent = matchingLink.originalUrl;

      let remainingSeconds = 3;
      elements.countdownTimer.textContent = remainingSeconds;

      const countdownInterval = setInterval(() => {
        remainingSeconds--;
        elements.countdownTimer.textContent = remainingSeconds;
        if (remainingSeconds <= 0) {
          clearInterval(countdownInterval);
          window.location.replace(matchingLink.originalUrl);
        }
      }, 1000);

      // Go Now button
      elements.btnRedirectNow.onclick = () => {
        clearInterval(countdownInterval);
        window.location.replace(matchingLink.originalUrl);
      };

      // Cancel button
      elements.btnRedirectCancel.onclick = () => {
        clearInterval(countdownInterval);
        elements.redirectScreen.classList.add('hidden');
        // Clean URL parameter without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Redirection cancelled', 'info');
      };
    } else {
      showToast(`Link "${redirectSlug}" not found or expired`, 'error');
      // Clean query parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // ---------------------------------------------------------------------------
  // Slug & Hash Generation
  // ---------------------------------------------------------------------------
  function generateRandomSlug(length = SLUG_LENGTH) {
    let result = '';
    const charLen = BASE62_CHARS.length;
    for (let i = 0; i < length; i++) {
      result += BASE62_CHARS.charAt(Math.floor(Math.random() * charLen));
    }
    return result;
  }

  function getUniqueSlug() {
    let slug = '';
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      slug = generateRandomSlug(SLUG_LENGTH);
      attempts++;
    } while (linksDatabase.some(item => item.slug === slug) && attempts < maxAttempts);

    return slug;
  }

  // ---------------------------------------------------------------------------
  // URL Normalization & Validation
  // ---------------------------------------------------------------------------
  function sanitizeAndNormalizeUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url) return null;

    // If user forgot http:// or https://, prepend https://
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    try {
      const parsed = new URL(url);
      // Disallow pseudo-protocols or file access for security
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      // Must contain a valid dot-separated hostname
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        return null;
      }
      return parsed.href;
    } catch (err) {
      return null;
    }
  }

  function sanitizeSlug(slug) {
    return slug.trim().replace(/[^a-zA-Z0-9-_]/g, '');
  }

  // ---------------------------------------------------------------------------
  // URL Shortening Workflow
  // ---------------------------------------------------------------------------
  async function handleShortenSubmit(e) {
    e.preventDefault();
    clearUrlError();

    const rawUrl = elements.longUrlInput.value;
    const validatedUrl = sanitizeAndNormalizeUrl(rawUrl);

    if (!validatedUrl) {
      showUrlError('Please enter a valid web URL (e.g. https://example.com/page)');
      elements.longUrlInput.focus();
      return;
    }

    const rawAlias = elements.customAliasInput.value;
    let customSlug = sanitizeSlug(rawAlias);

    if (rawAlias.trim() && !customSlug) {
      showUrlError('Custom alias may only contain letters, numbers, hyphens, and underscores.');
      elements.customAliasInput.focus();
      return;
    }

    // Check alias collision
    if (customSlug) {
      const existing = linksDatabase.find(item => item.slug.toLowerCase() === customSlug.toLowerCase());
      if (existing) {
        showUrlError(`Alias "${customSlug}" is already in use. Please choose another.`);
        elements.customAliasInput.focus();
        return;
      }
    }

    const linkTitle = elements.linkTitleInput.value.trim();

    // Start loading state
    setButtonLoading(true);

    try {
      let finalSlug = '';
      let shortUrl = '';

      if (currentMode === 'local') {
        finalSlug = customSlug || getUniqueSlug();
        // Construct local redirection URL
        const currentBase = window.location.origin + window.location.pathname;
        shortUrl = `${currentBase}?r=${finalSlug}`;
      } else {
        // Global mode using TinyURL free public API
        finalSlug = customSlug || generateRandomSlug(6);
        let apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(validatedUrl)}`;
        if (customSlug) {
          apiUrl += `&alias=${encodeURIComponent(customSlug)}`;
        }

        try {
          const response = await fetch(apiUrl);
          if (!response.ok) throw new Error('API returned status ' + response.status);
          const resultText = await response.text();
          if (resultText && resultText.startsWith('http')) {
            shortUrl = resultText.trim();
            finalSlug = shortUrl.split('/').pop() || finalSlug;
          } else {
            throw new Error(resultText || 'Failed to shorten via TinyURL API');
          }
        } catch (apiErr) {
          console.warn('TinyURL API failed, falling back to local redirection mode', apiErr);
          showToast('Global API unreachable. Generated instant local link instead.', 'info');
          finalSlug = customSlug || getUniqueSlug();
          const currentBase = window.location.origin + window.location.pathname;
          shortUrl = `${currentBase}?r=${finalSlug}`;
        }
      }

      // Create new Link Record
      const newLink = {
        id: 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        slug: finalSlug,
        originalUrl: validatedUrl,
        shortUrl: shortUrl,
        title: linkTitle || getDefaultTitle(validatedUrl),
        createdAt: new Date().toISOString(),
        clicks: 0,
        mode: currentMode
      };

      // Add to front of database
      linksDatabase.unshift(newLink);
      saveLinksToStorage();

      // Show result
      currentActiveResult = newLink;
      displayResult(newLink);
      renderLinksTable();
      updateStats();

      // Reset form fields
      elements.longUrlInput.value = '';
      elements.customAliasInput.value = '';
      elements.linkTitleInput.value = '';
      elements.btnClearUrl.classList.add('hidden');

      showToast('URL shortened successfully!', 'success');
    } catch (err) {
      console.error(err);
      showUrlError('An error occurred while shortening the URL. Please try again.');
    } finally {
      setButtonLoading(false);
    }
  }

  function getDefaultTitle(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
      return 'Shortened Link';
    }
  }

  function displayResult(link) {
    elements.resultContainer.classList.remove('hidden');
    elements.resultShortUrl.textContent = link.shortUrl;
    elements.resultShortUrl.href = link.shortUrl;
    elements.resultOriginalUrl.textContent = link.originalUrl;
    elements.resultOriginalUrl.title = link.originalUrl;
    elements.resultModeLabel.textContent = link.mode === 'local' ? 'Instant Local' : 'Global Web Link';
    elements.btnVisitResult.href = link.shortUrl;

    // Reset copy button state
    resetCopyButton(elements.btnCopyResult);

    // Scroll smoothly to result
    elements.resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------------------------------------------------------------------------
  // Table Rendering & Link Management
  // ---------------------------------------------------------------------------
  function renderLinksTable(filterKeyword = '') {
    const filter = filterKeyword.trim().toLowerCase();
    const filteredLinks = linksDatabase.filter(item => {
      if (!filter) return true;
      return (
        item.originalUrl.toLowerCase().includes(filter) ||
        item.slug.toLowerCase().includes(filter) ||
        (item.title && item.title.toLowerCase().includes(filter))
      );
    });

    elements.linksTableBody.innerHTML = '';

    if (filteredLinks.length === 0) {
      elements.linksTable.classList.add('hidden');
      elements.emptyState.classList.remove('hidden');
      if (filter) {
        elements.emptyState.querySelector('h3').textContent = 'No matching links found';
        elements.emptyState.querySelector('p').textContent = 'Try searching with a different keyword.';
      } else {
        elements.emptyState.querySelector('h3').textContent = 'No shortened links yet';
        elements.emptyState.querySelector('p').textContent = 'Paste a long URL above to generate your first shortened link!';
      }
    } else {
      elements.linksTable.classList.remove('hidden');
      elements.emptyState.classList.add('hidden');

      filteredLinks.forEach(link => {
        const tr = document.createElement('tr');

        // Formatted date
        const dateStr = formatDate(link.createdAt);

        tr.innerHTML = `
          <td>
            <a href="${escapeHtml(link.shortUrl)}" target="_blank" rel="noopener noreferrer" class="table-short-link" title="Click to open">
              ${escapeHtml(link.slug)}
            </a>
            <span class="table-label">${escapeHtml(link.title || 'Untitled')}</span>
          </td>
          <td>
            <div class="table-dest-cell" title="${escapeHtml(link.originalUrl)}">
              ${escapeHtml(link.originalUrl)}
            </div>
          </td>
          <td>
            <span class="table-date-cell">${dateStr}</span>
          </td>
          <td class="text-center">
            <span class="table-clicks-badge" title="${link.clicks} clicks">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              ${link.clicks}
            </span>
          </td>
          <td>
            <div class="table-actions-cell">
              <button class="btn-table-action btn-copy-row" title="Copy Short URL" data-url="${escapeHtml(link.shortUrl)}">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button class="btn-table-action btn-qr-row" title="Show QR Code" data-url="${escapeHtml(link.shortUrl)}">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <a href="${escapeHtml(link.shortUrl)}" target="_blank" rel="noopener noreferrer" class="btn-table-action" title="Open Link">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
              <button class="btn-table-action delete-action btn-delete-row" title="Delete Link" data-id="${escapeHtml(link.id)}">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        `;

        elements.linksTableBody.appendChild(tr);
      });
    }

    elements.historyCountBadge.textContent = `${linksDatabase.length} saved`;
  }

  function updateStats() {
    const totalLinks = linksDatabase.length;
    const totalClicks = linksDatabase.reduce((sum, item) => sum + (item.clicks || 0), 0);

    elements.statTotalLinks.textContent = totalLinks.toLocaleString();
    elements.statTotalClicks.textContent = totalClicks.toLocaleString();

    if (totalLinks > 0) {
      // Find link with highest clicks
      const top = [...linksDatabase].sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];
      if (top && top.clicks > 0) {
        elements.statTopLink.textContent = `${top.slug} (${top.clicks})`;
      } else {
        elements.statTopLink.textContent = top ? top.slug : '—';
      }
    } else {
      elements.statTopLink.textContent = '—';
    }
  }

  function deleteLink(id) {
    const index = linksDatabase.findIndex(item => item.id === id);
    if (index !== -1) {
      const removed = linksDatabase.splice(index, 1)[0];
      saveLinksToStorage();
      renderLinksTable(elements.searchLinksInput.value);
      updateStats();
      showToast(`Removed "${removed.slug}"`, 'info');

      // Hide active result card if it's the one deleted
      if (currentActiveResult && currentActiveResult.id === id) {
        elements.resultContainer.classList.add('hidden');
        currentActiveResult = null;
      }
    }
  }

  function clearAllLinks() {
    if (linksDatabase.length === 0) {
      showToast('No links to clear', 'info');
      return;
    }

    if (window.confirm('Are you sure you want to clear all saved shortened links? This cannot be undone.')) {
      linksDatabase = [];
      saveLinksToStorage();
      renderLinksTable();
      updateStats();
      elements.resultContainer.classList.add('hidden');
      currentActiveResult = null;
      showToast('All links cleared', 'info');
    }
  }

  // ---------------------------------------------------------------------------
  // QR Code Generation & Modal
  // ---------------------------------------------------------------------------
  function openQrModal(url) {
    if (!url) return;
    elements.qrModal.classList.remove('hidden');
    elements.qrModalUrl.textContent = url;

    // Render Canvas via window.QRCode
    if (window.QRCode && typeof window.QRCode.renderToCanvas === 'function') {
      window.QRCode.renderToCanvas(elements.qrRenderTarget, url, {
        width: 220,
        height: 220,
        colorDark: '#0f172a',
        colorLight: '#ffffff'
      });
    }

    elements.btnCopyQrLink.setAttribute('data-url', url);
  }

  function closeQrModal() {
    elements.qrModal.classList.add('hidden');
  }

  function downloadQrPng() {
    const canvas = elements.qrRenderTarget.querySelector('canvas');
    if (!canvas) {
      showToast('QR Code canvas not available', 'error');
      return;
    }

    const imageUri = canvas.toDataURL('image/png');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = imageUri;
    downloadAnchor.download = 'snapit-qrcode.png';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    showToast('QR code PNG downloaded', 'success');
  }

  // ---------------------------------------------------------------------------
  // Export to CSV
  // ---------------------------------------------------------------------------
  function exportDatabaseToCsv() {
    if (linksDatabase.length === 0) {
      showToast('No links available to export', 'info');
      return;
    }

    const headers = ['Slug', 'Short URL', 'Destination URL', 'Title', 'Clicks', 'Created At', 'Mode'];
    const rows = linksDatabase.map(item => [
      `"${item.slug.replace(/"/g, '""')}"`,
      `"${item.shortUrl.replace(/"/g, '""')}"`,
      `"${item.originalUrl.replace(/"/g, '""')}"`,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      item.clicks || 0,
      `"${item.createdAt}"`,
      `"${item.mode}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', `snapit_export_${Date.now()}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    showToast('Exported links to CSV', 'success');
  }

  // ---------------------------------------------------------------------------
  // Clipboard Copy & Sharing
  // ---------------------------------------------------------------------------
  async function copyTextToClipboard(text, triggerBtn = null) {
    if (!text) return false;

    let successful = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        successful = true;
      } catch (err) {
        console.warn('navigator.clipboard failed, using fallback', err);
      }
    }

    if (!successful) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        successful = document.execCommand('copy');
      } catch (e) {
        successful = false;
      }
      document.body.removeChild(textArea);
    }

    if (successful) {
      showToast('Copied to clipboard!', 'success');
      if (triggerBtn) {
        const copyIcon = triggerBtn.querySelector('.copy-icon');
        const checkIcon = triggerBtn.querySelector('.check-icon');
        const textSpan = triggerBtn.querySelector('#copy-btn-text');

        if (copyIcon && checkIcon) {
          copyIcon.classList.add('hidden');
          checkIcon.classList.remove('hidden');
          if (textSpan) textSpan.textContent = 'Copied!';

          setTimeout(() => {
            copyIcon.classList.remove('hidden');
            checkIcon.classList.add('hidden');
            if (textSpan) textSpan.textContent = 'Copy';
          }, 2000);
        }
      }
      return true;
    } else {
      showToast('Could not copy automatically. Please copy manually.', 'error');
      return false;
    }
  }

  function resetCopyButton(btn) {
    if (!btn) return;
    const copyIcon = btn.querySelector('.copy-icon');
    const checkIcon = btn.querySelector('.check-icon');
    const textSpan = btn.querySelector('#copy-btn-text');
    if (copyIcon && checkIcon) {
      copyIcon.classList.remove('hidden');
      checkIcon.classList.add('hidden');
      if (textSpan) textSpan.textContent = 'Copy';
    }
  }

  async function shareShortUrl(url, title = 'Shortened Link') {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Check out this link: ${url}`,
          url: url
        });
        showToast('Shared successfully!', 'success');
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyTextToClipboard(url);
        }
      }
    } else {
      copyTextToClipboard(url);
    }
  }

  // ---------------------------------------------------------------------------
  // Paste & Input Actions
  // ---------------------------------------------------------------------------
  async function handlePaste() {
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          elements.longUrlInput.value = text.trim();
          elements.btnClearUrl.classList.remove('hidden');
          clearUrlError();
          elements.longUrlInput.focus();
          showToast('Pasted from clipboard', 'info');
        }
      } catch (e) {
        promptManualPaste();
      }
    } else {
      promptManualPaste();
    }
  }

  function promptManualPaste() {
    elements.longUrlInput.focus();
    showToast('Press Ctrl+V to paste your link', 'info');
  }

  // ---------------------------------------------------------------------------
  // Helper UI Utilities
  // ---------------------------------------------------------------------------
  function updatePrefixDisplay() {
    if (currentMode === 'local') {
      const currentHost = window.location.host || 'snap.link';
      elements.aliasPrefixDisplay.textContent = currentHost + '?r=';
    } else {
      elements.aliasPrefixDisplay.textContent = 'tinyurl.com/';
    }
  }

  function setButtonLoading(isLoading) {
    elements.btnShorten.disabled = isLoading;
    if (isLoading) {
      elements.shortenSpinner.classList.remove('hidden');
      elements.btnShortenText.textContent = 'Shortening...';
    } else {
      elements.shortenSpinner.classList.add('hidden');
      elements.btnShortenText.textContent = 'Shorten URL';
    }
  }

  function showUrlError(msg) {
    elements.urlErrorMsg.textContent = msg;
    elements.urlErrorMsg.classList.remove('hidden');
  }

  function clearUrlError() {
    elements.urlErrorMsg.textContent = '';
    elements.urlErrorMsg.classList.add('hidden');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3200);
  }

  function formatDate(isoString) {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Just now';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------------------------------------------------------------------------
  // Event Listeners Binding
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Mode tabs
    elements.modeLocalBtn.addEventListener('click', () => {
      currentMode = 'local';
      elements.modeLocalBtn.classList.add('active');
      elements.modeLocalBtn.setAttribute('aria-selected', 'true');
      elements.modeGlobalBtn.classList.remove('active');
      elements.modeGlobalBtn.setAttribute('aria-selected', 'false');
      updatePrefixDisplay();
    });

    elements.modeGlobalBtn.addEventListener('click', () => {
      currentMode = 'global';
      elements.modeGlobalBtn.classList.add('active');
      elements.modeGlobalBtn.setAttribute('aria-selected', 'true');
      elements.modeLocalBtn.classList.remove('active');
      elements.modeLocalBtn.setAttribute('aria-selected', 'false');
      updatePrefixDisplay();
    });

    // Form inputs
    elements.longUrlInput.addEventListener('input', () => {
      clearUrlError();
      if (elements.longUrlInput.value.length > 0) {
        elements.btnClearUrl.classList.remove('hidden');
      } else {
        elements.btnClearUrl.classList.add('hidden');
      }
    });

    elements.btnClearUrl.addEventListener('click', () => {
      elements.longUrlInput.value = '';
      elements.btnClearUrl.classList.add('hidden');
      clearUrlError();
      elements.longUrlInput.focus();
    });

    elements.btnPasteUrl.addEventListener('click', handlePaste);

    // Advanced toggle
    elements.toggleAdvancedBtn.addEventListener('click', () => {
      const isExpanded = elements.toggleAdvancedBtn.getAttribute('aria-expanded') === 'true';
      elements.toggleAdvancedBtn.setAttribute('aria-expanded', !isExpanded);
      if (isExpanded) {
        elements.advancedPanel.classList.add('hidden');
      } else {
        elements.advancedPanel.classList.remove('hidden');
      }
    });

    // Form submission
    elements.urlForm.addEventListener('submit', handleShortenSubmit);

    // Result card actions
    elements.btnCopyResult.addEventListener('click', () => {
      if (currentActiveResult) {
        copyTextToClipboard(currentActiveResult.shortUrl, elements.btnCopyResult);
      }
    });

    elements.btnShowQr.addEventListener('click', () => {
      if (currentActiveResult) {
        openQrModal(currentActiveResult.shortUrl);
      }
    });

    elements.btnShareResult.addEventListener('click', () => {
      if (currentActiveResult) {
        shareShortUrl(currentActiveResult.shortUrl, currentActiveResult.title);
      }
    });

    // QR Modal
    elements.qrModalClose.addEventListener('click', closeQrModal);
    elements.qrModal.addEventListener('click', (e) => {
      if (e.target === elements.qrModal) closeQrModal();
    });
    elements.btnDownloadQr.addEventListener('click', downloadQrPng);
    elements.btnCopyQrLink.addEventListener('click', () => {
      const url = elements.btnCopyQrLink.getAttribute('data-url');
      if (url) copyTextToClipboard(url);
    });

    // History Table actions (Delegated)
    elements.linksTableBody.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('button');
      if (!targetBtn) return;

      if (targetBtn.classList.contains('btn-copy-row')) {
        const url = targetBtn.getAttribute('data-url');
        copyTextToClipboard(url);
      } else if (targetBtn.classList.contains('btn-qr-row')) {
        const url = targetBtn.getAttribute('data-url');
        openQrModal(url);
      } else if (targetBtn.classList.contains('btn-delete-row')) {
        const id = targetBtn.getAttribute('data-id');
        deleteLink(id);
      }
    });

    // History Search
    elements.searchLinksInput.addEventListener('input', (e) => {
      renderLinksTable(e.target.value);
    });

    // Clear all & Export
    elements.btnClearAll.addEventListener('click', clearAllLinks);
    elements.btnExportCsv.addEventListener('click', exportDatabaseToCsv);

    // Keyboard ESC to close modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !elements.qrModal.classList.contains('hidden')) {
        closeQrModal();
      }
    });
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);
})();
