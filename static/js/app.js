// Application State
let allReleases = [];
let filteredReleases = [];
let currentFilterType = 'all';
let currentSearchQuery = '';
let currentSortOrder = 'newest';
let lastUpdatedTime = '';

// Active update being tweeted
let activeTweetData = {
    summary: '',
    date: '',
    type: '',
    link: ''
};

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    syncText: document.getElementById('sync-text'),
    themeToggle: document.getElementById('theme-toggle'),
    iconSun: document.querySelector('.icon-sun'),
    iconMoon: document.querySelector('.icon-moon'),
    
    searchInput: document.getElementById('search-input'),
    typeFilters: document.getElementById('type-filters'),
    sortSelect: document.getElementById('sort-select'),
    
    statDays: document.getElementById('stat-days'),
    statTotal: document.getElementById('stat-total'),
    
    badgeAll: document.getElementById('badge-all'),
    badgeFeature: document.getElementById('badge-feature'),
    badgeIssue: document.getElementById('badge-issue'),
    badgeChanged: document.getElementById('badge-changed'),
    badgeDeprecation: document.getElementById('badge-deprecation'),
    badgeOther: document.getElementById('badge-other'),
    
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    btnErrorRetry: document.getElementById('btn-error-retry'),
    warningState: document.getElementById('warning-state'),
    warningMessage: document.getElementById('warning-message'),
    emptyState: document.getElementById('empty-state'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    releasesContainer: document.getElementById('releases-container'),
    
    // Modal elements
    tweetModal: document.getElementById('tweet-modal'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCount: document.getElementById('char-count'),
    charLimit: document.getElementById('char-limit'),
    lengthWarning: document.getElementById('length-warning'),
    tweetRefLink: document.getElementById('tweet-ref-link'),
    hashtagCheckboxes: document.querySelectorAll('.hashtag-pill input'),
    btnModalClose: document.getElementById('btn-close-modal'),
    btnModalCopy: document.getElementById('btn-modal-copy'),
    btnModalTweet: document.getElementById('btn-modal-tweet'),
    
    toastContainer: document.getElementById('toast-container')
};

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleases();
    setupEventListeners();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
    showToast(`Switched to ${newTheme} mode`);
}

function updateThemeIcons(theme) {
    if (theme === 'dark') {
        elements.iconSun.style.display = 'block';
        elements.iconMoon.style.display = 'none';
    } else {
        elements.iconSun.style.display = 'none';
        elements.iconMoon.style.display = 'block';
    }
}

// Fetch Release Notes
async function fetchReleases(forceRefresh = false) {
    setLoading(true);
    elements.errorState.style.display = 'none';
    elements.warningState.style.display = 'none';
    
    const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        allReleases = data.entries || [];
        lastUpdatedTime = data.last_updated;
        
        if (data.warning) {
            elements.warningState.style.display = 'block';
            elements.warningMessage.textContent = data.warning;
        }
        
        updateSyncStatus();
        processAndRender();
        
    } catch (error) {
        console.error("Fetch error:", error);
        elements.errorState.style.display = 'block';
        elements.errorMessage.textContent = error.message || "Failed to communicate with the Flask API.";
        setLoading(false);
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        elements.loadingState.style.display = 'flex';
        elements.releasesContainer.style.display = 'none';
        elements.btnRefresh.classList.add('syncing');
        elements.btnRefresh.disabled = true;
    } else {
        elements.loadingState.style.display = 'none';
        elements.releasesContainer.style.display = 'block';
        elements.btnRefresh.classList.remove('syncing');
        elements.btnRefresh.disabled = false;
    }
}

function updateSyncStatus() {
    if (!lastUpdatedTime) {
        elements.syncText.textContent = 'Not synced';
        return;
    }
    
    const date = new Date(lastUpdatedTime);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    elements.syncText.textContent = `Synced at ${timeStr}`;
}

// Filter and Process Data
function processAndRender() {
    // 1. Filter releases
    filteredReleases = [];
    
    allReleases.forEach(day => {
        // Filter the individual updates in this day
        const matchingUpdates = day.updates.filter(update => {
            // Filter by category type
            const normalizedType = getNormalizedType(update.type);
            const matchesType = (currentFilterType === 'all') || (normalizedType === currentFilterType);
            
            // Filter by search query
            const matchesSearch = !currentSearchQuery || 
                update.content.toLowerCase().includes(currentSearchQuery.toLowerCase()) || 
                update.type.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
                day.date.toLowerCase().includes(currentSearchQuery.toLowerCase());
                
            return matchesType && matchesSearch;
        });
        
        // Only include days that have at least one matching update
        if (matchingUpdates.length > 0) {
            filteredReleases.push({
                ...day,
                updates: matchingUpdates
            });
        }
    });
    
    // 2. Sort releases
    sortData();
    
    // 3. Update UI Badges & Stats
    updateStatsAndBadges();
    
    // 4. Render releases
    renderReleases();
    
    setLoading(false);
}

function sortData() {
    filteredReleases.sort((a, b) => {
        // Parse date strings, or fall back to updated timestamp
        const dateA = new Date(a.updated || a.date);
        const dateB = new Date(b.updated || b.date);
        
        if (currentSortOrder === 'newest') {
            return dateB - dateA;
        } else {
            return dateA - dateB;
        }
    });
}

function getNormalizedType(rawType) {
    const type = rawType.toLowerCase();
    if (type.includes('feature')) return 'Feature';
    if (type.includes('issue') || type.includes('bug') || type.includes('fix')) return 'Issue';
    if (type.includes('change') || type.includes('updat')) return 'Changed';
    if (type.includes('deprecat')) return 'Deprecation';
    return 'Other';
}

function updateStatsAndBadges() {
    // Calculate total and category counts based on current search query (to show matching counts), 
    // or based on all data. Let's do total counts based on search query, which feels very dynamic.
    let totalCount = 0;
    let counts = {
        Feature: 0,
        Issue: 0,
        Changed: 0,
        Deprecation: 0,
        Other: 0
    };
    
    allReleases.forEach(day => {
        day.updates.forEach(update => {
            // If it matches the text search, count it
            const matchesSearch = !currentSearchQuery || 
                update.content.toLowerCase().includes(currentSearchQuery.toLowerCase()) || 
                update.type.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
                day.date.toLowerCase().includes(currentSearchQuery.toLowerCase());
                
            if (matchesSearch) {
                totalCount++;
                const normalized = getNormalizedType(update.type);
                counts[normalized] = (counts[normalized] || 0) + 1;
            }
        });
    });
    
    // Update Sidebar Badges
    elements.badgeAll.textContent = totalCount;
    elements.badgeFeature.textContent = counts.Feature;
    elements.badgeIssue.textContent = counts.Issue;
    elements.badgeChanged.textContent = counts.Changed;
    elements.badgeDeprecation.textContent = counts.Deprecation;
    elements.badgeOther.textContent = counts.Other;
    
    // Update Stats panel
    elements.statDays.textContent = filteredReleases.length;
    
    // Count active parsed updates
    let activeUpdatesCount = 0;
    filteredReleases.forEach(d => activeUpdatesCount += d.updates.length);
    elements.statTotal.textContent = activeUpdatesCount;
}

// Render release cards in the feed
function renderReleases() {
    elements.releasesContainer.innerHTML = '';
    
    if (filteredReleases.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.releasesContainer.style.display = 'none';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.releasesContainer.style.display = 'block';
    
    filteredReleases.forEach((day, dayIndex) => {
        const dayBlock = document.createElement('div');
        dayBlock.className = 'day-block';
        // Add a delay for list entrance animation
        dayBlock.style.animationDelay = `${dayIndex * 0.05}s`;
        
        // Node for timeline
        const timelineNode = document.createElement('div');
        timelineNode.className = 'day-timeline-node';
        dayBlock.appendChild(timelineNode);
        
        // Header (Date and direct link icon)
        const header = document.createElement('div');
        header.className = 'day-header';
        
        const dateTitle = document.createElement('h2');
        dateTitle.className = 'day-date';
        dateTitle.textContent = day.date;
        header.appendChild(dateTitle);
        
        if (day.link) {
            const linkIcon = document.createElement('a');
            linkIcon.className = 'day-link-icon';
            linkIcon.href = day.link;
            linkIcon.target = '_blank';
            linkIcon.title = 'View original release notes';
            linkIcon.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41 9.83-9.83V9h2V3h-6z"/>
                </svg>
            `;
            header.appendChild(linkIcon);
        }
        
        dayBlock.appendChild(header);
        
        // List of updates under this day
        const updateList = document.createElement('div');
        updateList.className = 'update-list';
        
        day.updates.forEach(update => {
            const card = createUpdateCard(update, day);
            updateList.appendChild(card);
        });
        
        dayBlock.appendChild(updateList);
        elements.releasesContainer.appendChild(dayBlock);
    });
}

function createUpdateCard(update, day) {
    const card = document.createElement('div');
    card.className = 'update-card';
    
    const normalizedType = getNormalizedType(update.type);
    card.style.setProperty('--type-color', `var(--color-${normalizedType.toLowerCase()})`);
    card.style.setProperty('--type-bg', `var(--color-${normalizedType.toLowerCase()}-bg)`);
    card.style.setProperty('--type-border', `var(--color-${normalizedType.toLowerCase()}-border)`);
    
    // Card header
    const header = document.createElement('div');
    header.className = 'update-card-header';
    
    const tag = document.createElement('span');
    tag.className = 'update-type-tag';
    
    // Set appropriate icon based on category type
    let iconSvg = '';
    switch(normalizedType) {
        case 'Feature':
            iconSvg = '<svg class="icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>';
            break;
        case 'Issue':
            iconSvg = '<svg class="icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
            break;
        case 'Changed':
            iconSvg = '<svg class="icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg>';
            break;
        case 'Deprecation':
            iconSvg = '<svg class="icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
            break;
        default:
            iconSvg = '<svg class="icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>';
    }
    
    tag.innerHTML = `${iconSvg} ${update.type}`;
    header.appendChild(tag);
    
    // Actions container
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    
    // Copy Direct Link Button
    const btnLink = document.createElement('button');
    btnLink.className = 'btn btn-secondary btn-xs';
    btnLink.title = 'Copy Link to Clipboard';
    btnLink.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
    `;
    btnLink.addEventListener('click', (e) => {
        e.stopPropagation();
        const fullLink = `${day.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes'}#${day.date.replace(/ /g, '_').replace(/,/g, '')}`;
        copyToClipboard(fullLink, "Link copied!");
    });
    actions.appendChild(btnLink);
    
    // Tweet Button
    const btnTweet = document.createElement('button');
    btnTweet.className = 'btn btn-primary btn-xs';
    btnTweet.title = 'Compose tweet for this update';
    btnTweet.innerHTML = `
        <!-- Minimalist X Logo SVG -->
        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        <span>Tweet</span>
    `;
    btnTweet.addEventListener('click', (e) => {
        e.stopPropagation();
        openTweetModal(update, day);
    });
    actions.appendChild(btnTweet);
    
    header.appendChild(actions);
    card.appendChild(header);
    
    // Card Body (Parsed HTML)
    const body = document.createElement('div');
    body.className = 'update-card-body';
    body.innerHTML = update.content;
    
    // Ensure all links in content open in a new tab
    const contentLinks = body.querySelectorAll('a');
    contentLinks.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.addEventListener('click', (e) => e.stopPropagation());
    });
    
    card.appendChild(body);
    
    return card;
}

// Event Listeners Setup
function setupEventListeners() {
    // Refresh buttons
    elements.btnRefresh.addEventListener('click', () => fetchReleases(true));
    elements.btnErrorRetry.addEventListener('click', () => fetchReleases(true));
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        processAndRender();
    });
    
    // Category pills click
    elements.typeFilters.addEventListener('click', (e) => {
        const pillButton = e.target.closest('.pill');
        if (!pillButton) return;
        
        // Toggle active status
        document.querySelectorAll('#type-filters .pill').forEach(btn => btn.classList.remove('active'));
        pillButton.classList.add('active');
        
        currentFilterType = pillButton.dataset.type;
        processAndRender();
    });
    
    // Sort dropdown change
    elements.sortSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        processAndRender();
    });
    
    // Clear filters button
    elements.btnClearFilters.addEventListener('click', () => {
        elements.searchInput.value = '';
        currentSearchQuery = '';
        
        document.querySelectorAll('#type-filters .pill').forEach(btn => btn.classList.remove('active'));
        elements.badgeAll.parentElement.classList.add('active');
        currentFilterType = 'all';
        
        processAndRender();
    });
    
    // Modal Event Listeners
    elements.btnModalClose.addEventListener('click', closeTweetModal);
    elements.btnModalCopy.addEventListener('click', copyTweetText);
    elements.btnModalTweet.addEventListener('click', triggerTweetIntent);
    
    // Close modal on outside click
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetModal();
        }
    });
    
    // Modal Textarea Input for character counting
    elements.tweetTextarea.addEventListener('input', updateCharCounter);
    
    // Hashtags selection toggle
    elements.hashtagCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            rebuildTweetText();
        });
    });
}

// Helper: copy to clipboard
function copyToClipboard(text, successMsg = "Copied to clipboard!") {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showToast("Failed to copy", true);
    });
}

// Custom Toast Alerts
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isError) {
        toast.style.borderLeftColor = 'var(--color-issue)';
    }
    
    // Simple icon inside toast
    const icon = isError ? 
        `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-issue)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>` :
        `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent-primary)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
        
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Remove element after animation finishes (4s total: 3.7s delay + 0.3s transition)
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Twitter Modal Compose Logic
function openTweetModal(update, day) {
    // 1. Strip HTML tags from update content to get raw text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = update.content;
    const rawText = tempDiv.textContent || tempDiv.innerText || "";
    
    // Clean whitespace and double newlines
    let cleanText = rawText.trim()
        .replace(/\n\s*\n/g, '\n')
        .replace(/\s+/g, ' ');
        
    // 2. Prepare structured data
    activeTweetData.summary = cleanText;
    activeTweetData.date = day.date;
    activeTweetData.type = update.type;
    
    // Generate anchor link targeting the specific date block
    const anchor = day.date.replace(/ /g, '_').replace(/,/g, '');
    activeTweetData.link = `${day.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes'}#${anchor}`;
    
    // Pre-select default hashtags (just reset the checkboxes to original checked status)
    elements.hashtagCheckboxes.forEach(checkbox => {
        if (checkbox.value === '#BigQuery' || checkbox.value === '#GoogleCloud') {
            checkbox.checked = true;
        } else {
            checkbox.checked = false;
        }
    });
    
    // 3. Populate modal UI elements
    elements.tweetRefLink.href = activeTweetData.link;
    elements.tweetRefLink.textContent = activeTweetData.link;
    
    // 4. Build draft and open modal
    rebuildTweetText();
    
    elements.tweetModal.style.display = 'flex';
    elements.tweetTextarea.focus();
}

function closeTweetModal() {
    elements.tweetModal.style.display = 'none';
}

function rebuildTweetText() {
    const date = activeTweetData.date;
    const type = activeTweetData.type;
    const summary = activeTweetData.summary;
    const link = activeTweetData.link;
    
    // Collect active hashtags
    const activeHashtags = [];
    elements.hashtagCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            activeHashtags.push(checkbox.value);
        }
    });
    
    const tagsStr = activeHashtags.length > 0 ? '\n' + activeHashtags.join(' ') : '';
    
    // Header format: "BigQuery Feature (June 15, 2026): "
    const prefix = `BigQuery ${type} (${date}): `;
    
    // Calculate character allocations
    // X shortens all URLs to a t.co link that counts as exactly 23 characters.
    const urlCost = 23;
    const newlineCost = 2; // For spacing before link
    const hashtagsCost = tagsStr.length;
    
    const prefixCost = prefix.length;
    const totalAuxCost = prefixCost + urlCost + newlineCost + hashtagsCost;
    
    // Max characters available for summary
    const availableSummaryChars = 280 - totalAuxCost;
    
    let draftSummary = summary;
    if (summary.length > availableSummaryChars) {
        // Truncate summary to fit with "..." suffix
        draftSummary = summary.substring(0, availableSummaryChars - 4) + '...';
    }
    
    // Combine everything
    const fullText = `${prefix}${draftSummary}\n\n${link}${tagsStr}`;
    
    // Set textarea content
    elements.tweetTextarea.value = fullText;
    updateCharCounter();
}

function updateCharCounter() {
    const text = elements.tweetTextarea.value;
    
    // Calculate length accounting for 23-char URL standard on Twitter
    const computedLength = calculateTwitterLength(text);
    
    elements.charCount.textContent = computedLength;
    
    if (computedLength > 280) {
        elements.charCount.classList.add('char-count-warning');
        elements.lengthWarning.style.display = 'block';
        elements.btnModalTweet.disabled = true;
    } else {
        elements.charCount.classList.remove('char-count-warning');
        elements.lengthWarning.style.display = 'none';
        elements.btnModalTweet.disabled = false;
    }
}

// Compute length where URLs count as 23 characters
function calculateTwitterLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    let length = text.length;
    
    urls.forEach(url => {
        // Subtract standard link length, add 23 characters
        length = length - url.length + 23;
    });
    
    return length;
}

function copyTweetText() {
    copyToClipboard(elements.tweetTextarea.value, "Tweet text copied to clipboard!");
}

function triggerTweetIntent() {
    const text = elements.tweetTextarea.value;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    closeTweetModal();
    showToast("Opening X / Twitter...");
}
