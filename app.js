// Ctrl+K: Intercept IMMEDIATELY with capture to prevent browser search bar
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (typeof openSearchPalette === 'function') {
            openSearchPalette();
        }
    }
}, true); // capture phase = runs before browser default

let data = {};

// Detect the API base URL dynamically: use localhost when testing locally, relative path in production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : '';

function updateSidebarVisibility() {
    // 1. Remove all previously added dynamic sections and links to avoid duplicates
    document.querySelectorAll('.dynamic-nav-section').forEach(el => el.remove());
    document.querySelectorAll('.dynamic-nav-link').forEach(el => el.remove());

    // 2. Map existing section header text (lowercase) to their element
    const sections = document.querySelectorAll('.nav-section');
    const sectionMap = {};
    sections.forEach(sec => {
        const h3 = sec.querySelector('h3');
        if (h3) {
            const text = h3.textContent.trim().toLowerCase();
            sectionMap[text] = sec;
        }
    });

    // 3. Dynamically insert links for any sections in data that are not already hardcoded
    Object.keys(data).forEach(key => {
        if (key === 'introduction') return;

        const existingLink = document.querySelector(`.nav-link[data-path="${key}"]`);
        if (!existingLink) {
            const sectionData = data[key];
            if (sectionData && sectionData.breadcrumb) {
                const breadcrumb = sectionData.breadcrumb.trim();
                const breadcrumbLower = breadcrumb.toLowerCase();
                let targetSection = sectionMap[breadcrumbLower];

                // If the section doesn't exist, create it dynamically
                if (!targetSection) {
                    targetSection = document.createElement('div');
                    targetSection.className = 'nav-section dynamic-nav-section';
                    
                    const h3 = document.createElement('h3');
                    h3.textContent = breadcrumb;
                    targetSection.appendChild(h3);

                    // Find the sidebar navigation element
                    const sidebarNav = document.querySelector('.sidebar-nav');
                    if (sidebarNav) {
                        // Find the copyright block/footer in the sidebar to insert before it
                        const copyrightDiv = Array.from(sidebarNav.children).find(child => 
                            child.tagName === 'DIV' && !child.classList.contains('nav-section')
                        );
                        if (copyrightDiv) {
                            sidebarNav.insertBefore(targetSection, copyrightDiv);
                        } else {
                            sidebarNav.appendChild(targetSection);
                        }
                    }
                    sectionMap[breadcrumbLower] = targetSection;
                }

                // Create and append the new nav-link
                const a = document.createElement('a');
                a.href = `#${key}`;
                a.className = 'nav-link dynamic-nav-link';
                a.setAttribute('data-path', key);
                a.textContent = sectionData.title || key;
                targetSection.appendChild(a);
            }
        }
    });

    // 4. Re-query all sections (including dynamic ones) and handle hide/show logic
    const allSections = document.querySelectorAll('.nav-section');
    allSections.forEach(section => {
        const links = section.querySelectorAll('.nav-link');
        let visibleLinksCount = 0;
        links.forEach(link => {
            const path = link.getAttribute('data-path');
            if (path && path !== 'introduction' && path !== 'forum' && path !== 'presets-pc' && path !== 'presets-mobile' && path !== 'calculator' && path !== 'bookmarks' && !data[path]) {
                link.style.display = 'none';
            } else {
                link.style.display = 'block';
                visibleLinksCount++;
            }
        });
        if (visibleLinksCount === 0) {
            section.style.display = 'none';
        } else {
            section.style.display = 'block';
        }
    });
}

async function init() {
    // 1. Try to load data from localStorage first (instant load)
    let cachedData = null;
    try {
        const localData = localStorage.getItem('websiteData');
        if (localData) {
            cachedData = JSON.parse(localData);
        }
    } catch (e) {
        console.warn('Failed to parse cached websiteData:', e);
    }

    // If cached data is found, populate and render immediately
    if (cachedData && typeof cachedData === 'object' && Object.keys(cachedData).length > 0) {
        data = cachedData;
        updateSidebarVisibility();
        setupSearch();
        renderPage();
    }

    // 2. Fetch static `./data.json` as a fast local fallback if cache is empty
    let dataLoaded = !!(data && Object.keys(data).length > 0);
    if (!dataLoaded) {
        try {
            const staticRes = await fetch('./data.json');
            if (staticRes.ok) {
                data = await staticRes.json();
                localStorage.setItem('websiteData', JSON.stringify(data));
                updateSidebarVisibility();
                setupSearch();
                renderPage();
                dataLoaded = true;
            }
        } catch (e) {
            console.error('Failed to load static data.json:', e);
        }
    }

    // 3. Trigger checkAuthStatus asynchronously in background (non-blocking)
    checkAuthStatus();

    // 4. Trigger server revalidation in background (non-blocking)
    fetchLatestData();
}

async function fetchLatestData() {
    try {
        const response = await fetch(API_BASE + '/api/data');
        if (response.ok) {
            const freshData = await response.json();
            const freshDataStr = JSON.stringify(freshData);
            const currentDataStr = JSON.stringify(data);

            if (freshDataStr !== currentDataStr) {
                console.log('Site data updated from API. Re-rendering...');
                data = freshData;
                localStorage.setItem('websiteData', freshDataStr);
                
                // Update sidebar, search, and page content
                updateSidebarVisibility();
                setupSearch();
                renderPage();
            }
        }
    } catch (e) {
        console.warn('Could not revalidate website data from API:', e);
        // If no data could be loaded at all, display error
        if (!data || Object.keys(data).length === 0) {
            document.getElementById('content-container').innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <h2>Error Loading Data</h2>
                    <p>Could not load website data. Please try refreshing.</p>
                </div>
            `;
        }
    }
}

function renderPage() {
    // If the hash is "search", we let the search function handle it
    const hash = window.location.hash.substring(1) || 'introduction';
    if (hash === 'search') return;

    const container = document.getElementById('content-container');

    // Trigger smooth transition animation
    container.classList.remove('fade-in-content');
    void container.offsetWidth; // trigger reflow
    container.classList.add('fade-in-content');

    if (hash === 'forum') {
        renderForumList(true);
        startForumPolling();
        return;
    }
    if (hash.startsWith('forum-post-')) {
        const postId = hash.split('forum-post-')[1];
        renderForumPost(postId, true);
        startForumPolling();
        return;
    }

    // Stop polling if we leave the forum sections
    stopForumPolling();

    // Toggle centered layout for intro page
    if (hash === 'introduction') {
        container.classList.add('intro-centered');
    } else {
        container.classList.remove('intro-centered');
    }

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-path') === hash) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    if (hash === 'presets-pc') {
        renderPresetHub('pc');
        return;
    }
    if (hash === 'presets-mobile') {
        renderPresetHub('mobile');
        return;
    }
    if (hash === 'calculator') {
        renderCalculator();
        return;
    }
    if (hash === 'bookmarks') {
        renderBookmarks();
        return;
    }

    const pageData = data[hash];

    if (!pageData) {
        container.innerHTML = `<h1>Page not found</h1>`;
        return;
    }

    let html = '';
    
    if (pageData.breadcrumb && pageData.title) {
        html += `<div class="page-breadcrumbs">${pageData.breadcrumb}</div>`;
        html += `<h1 class="page-title">${pageData.title}</h1>`;
    }

    html += pageData.content;
    
    // Determine if this is a software/plugin page (routes download through download page)
    const isSoftwareOrPluginPage = ['windows-softwares', 'mac-softwares', 'windows-plug-ins', 'mac-plug-ins', 'blender-addons'].includes(hash);

    if (pageData.softwareGroups && pageData.softwareGroups.length > 0) {
        pageData.softwareGroups.forEach(group => {
            html += `<div class="software-group" style="margin-top: 30px; margin-bottom: 40px;">`;
            if (group.title) {
                const safeCat = group.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `<h3 class="software-group-title">${safeCat}</h3>`;
            }
            html += `<ul class="software-list stagger-in">`;
            if (group.links) {
                group.links.forEach(link => {
                    const sLabel = link.label ? link.label.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Link';
                    const sUrl = link.url ? link.url.replace(/"/g, '&quot;') : '#';
                    const highlightStyle = link.isHighlighted ? 'color: #6622ba; border-bottom-color: #6622ba;' : '';
                    if (isSoftwareOrPluginPage && sUrl !== '#') {
                        const encUrl  = encodeURIComponent(sUrl);
                        const encName = encodeURIComponent(link.label || 'Download');
                        const encCat  = encodeURIComponent(pageData.title || hash);
                        const encSect = encodeURIComponent(pageData.breadcrumb || 'Software');
                        const encFrom = encodeURIComponent(window.location.pathname + window.location.hash);
                        html += `<li><a href="/download?url=${encUrl}&name=${encName}&cat=${encCat}&section=${encSect}&from=${encFrom}" style="${highlightStyle}" data-raw-url="${sUrl}" class="sw-dl-link">${sLabel}</a></li>`;
                    } else {
                        html += `<li><a href="${sUrl}" style="${highlightStyle}" target="_blank">${sLabel}</a></li>`;
                    }
                });
            }
            html += `</ul></div>`;
        });
    }
    
    if (pageData.downloadLinks && pageData.downloadLinks.length > 0) {
        html += `<div class="download-section" style="margin-top: 40px;">
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 20px; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download Links
                    </h3>
                    <div class="download-links-grid stagger-in" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">`;
        
        pageData.downloadLinks.forEach(link => {
            // Encode the values for safety
            const sLabel = link.label ? link.label.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Download';
            const sQuality = link.quality ? link.quality.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            const sSize = link.size ? link.size.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            const rawUrl = link.url || '#';
            const sUrl = rawUrl.replace(/"/g, '&quot;');

            // Route through download page for software/plugin pages
            let cardHref = sUrl;
            if (isSoftwareOrPluginPage && rawUrl !== '#') {
                const encUrl  = encodeURIComponent(rawUrl);
                const encName = encodeURIComponent(link.label || 'Download');
                const encCat  = encodeURIComponent(pageData.title || hash);
                const encSect = encodeURIComponent(pageData.breadcrumb || 'Software');
                const encFrom = encodeURIComponent(window.location.pathname + window.location.hash);
                cardHref = `/download?url=${encUrl}&name=${encName}&cat=${encCat}&section=${encSect}&from=${encFrom}`;
            }
 
            html += `
                <a href="${cardHref}" data-raw-url="${sUrl}" class="dlink-card${isSoftwareOrPluginPage && rawUrl !== '#' ? ' sw-dl-link' : ''}" ${!isSoftwareOrPluginPage || rawUrl === '#' ? 'target="_blank"' : ''}>
                    <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 24px; color: #111; font-family: 'Space Grotesk', sans-serif;">${sLabel}</h4>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748b;">
                        ${sQuality ? `<span style="background: #f1f5f9; padding: 6px 12px; border-radius: 8px; font-weight: 600;">${sQuality}</span>` : '<span></span>'}
                        ${sSize ? `<span style="background: #f1f5f9; padding: 6px 12px; border-radius: 8px; font-weight: 600;">${sSize}</span>` : '<span></span>'}
                    </div>
                </a>
            `;
        });
        
        html += `   </div>
                </div>`;
    }
    
    container.innerHTML = html;
    injectBookmarkStars();
}

let selectedIndex = -1;
let currentResults = [];

function openSearchPalette() {
    const modal = document.getElementById('searchPaletteModal');
    const input = document.getElementById('paletteSearchInput');
    const sidebarInput = document.querySelector('.search-box input');
    
    if (sidebarInput) sidebarInput.value = ''; // clear sidebar input
    modal.classList.add('active');
    setTimeout(() => input.focus(), 50);
    renderPaletteResults('');
}

function closeSearchPalette() {
    const modal = document.getElementById('searchPaletteModal');
    const input = document.getElementById('paletteSearchInput');
    modal.classList.remove('active');
    input.value = '';
    selectedIndex = -1;
    currentResults = [];
}

function renderPaletteResults(query) {
    const resultsContainer = document.getElementById('paletteSearchResults');
    selectedIndex = -1;
    currentResults = [];

    if (!query) {
        resultsContainer.innerHTML = `
            <div class="search-palette-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6622ba; margin-bottom: 16px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <p>Type to search software, plugins, resources...</p>
            </div>
        `;
        return;
    }

    let sections = [];
    let items = [];

    for (const [key, section] of Object.entries(data)) {
        if (key === 'introduction') continue;

        // 1. Check section title
        const sectionTitle = section.title || key;
        if (sectionTitle.toLowerCase().includes(query)) {
            sections.push({
                type: 'section',
                key: key,
                title: sectionTitle,
                breadcrumb: section.breadcrumb || 'Directory'
            });
        }

        // 2. Check software groups
        if (section.softwareGroups) {
            section.softwareGroups.forEach(group => {
                const groupTitle = group.title || '';
                const groupTitleMatches = groupTitle.toLowerCase().includes(query);
                if (group.links) {
                    group.links.forEach(link => {
                        const label = link.label || '';
                        if (groupTitleMatches || label.toLowerCase().includes(query)) {
                            items.push({
                                type: 'link',
                                key: key,
                                title: label,
                                subtitle: groupTitle || 'Software',
                                url: link.url,
                                category: section.breadcrumb || 'Software'
                            });
                        }
                    });
                }
            });
        }

        // 3. Check download links
        if (section.downloadLinks) {
            section.downloadLinks.forEach(link => {
                const label = link.label || '';
                const quality = link.quality || '';
                if (label.toLowerCase().includes(query) || quality.toLowerCase().includes(query)) {
                    items.push({
                        type: 'download',
                        key: key,
                        title: label,
                        subtitle: `${quality} ${link.size || ''}`.trim(),
                        url: link.url,
                        category: section.breadcrumb || 'Downloads'
                    });
                }
            });
        }

        // 4. Check raw HTML text content for internal links
        if (section.content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = section.content;
            
            // Check matching <a> tags
            const aTags = tempDiv.querySelectorAll('a');
            aTags.forEach(a => {
                const href = a.getAttribute('href');
                if (href && href !== '#' && !href.includes('discord.com/invite')) {
                    const textContent = a.textContent || '';
                    if (textContent.toLowerCase().includes(query)) {
                        let groupTitle = 'Resource';
                        const groupDiv = a.closest('.software-group');
                        if (groupDiv) {
                            const h3 = groupDiv.querySelector('h3, .software-group-title');
                            if (h3) groupTitle = h3.textContent;
                        }
                        items.push({
                            type: 'link',
                            key: key,
                            title: textContent,
                            subtitle: groupTitle,
                            url: href,
                            category: section.breadcrumb || 'Resource'
                        });
                    }
                }
            });
        }
    }

    const maxResults = 15;
    let html = '';

    if (sections.length > 0) {
        html += `<div class="search-palette-group-title">Sections</div>`;
        sections.forEach(sec => {
            if (currentResults.length >= maxResults) return;
            const index = currentResults.length;
            currentResults.push(sec);
            html += `
                <div class="search-palette-item" data-index="${index}" onclick="handlePaletteSelect(${index})">
                    <div class="search-palette-item-left">
                        <div class="search-palette-item-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        </div>
                        <div>
                            <div class="search-palette-item-title">${sec.title}</div>
                            <div class="search-palette-item-desc">${sec.breadcrumb} section</div>
                        </div>
                    </div>
                    <span class="search-palette-item-badge">Go to</span>
                </div>
            `;
        });
    }

    if (items.length > 0) {
        html += `<div class="search-palette-group-title">Downloads & Resources</div>`;
        items.forEach(it => {
            if (currentResults.length >= maxResults) return;
            const index = currentResults.length;
            currentResults.push(it);
            html += `
                <div class="search-palette-item" data-index="${index}" onclick="handlePaletteSelect(${index})">
                    <div class="search-palette-item-left">
                        <div class="search-palette-item-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </div>
                        <div>
                            <div class="search-palette-item-title">${it.title}</div>
                            <div class="search-palette-item-desc">${it.category} &bull; ${it.subtitle}</div>
                        </div>
                    </div>
                    <span class="search-palette-item-badge">Select</span>
                </div>
            `;
        });
    }

    if (currentResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="search-palette-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280; margin-bottom: 16px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <p>No results found for "${query}"</p>
            </div>
        `;
    } else {
        resultsContainer.innerHTML = html;
    }
}

function handlePaletteSelect(index) {
    const item = currentResults[index];
    if (!item) return;

    if (item.type === 'section') {
        window.location.hash = '#' + item.key;
        closeSearchPalette();
    } else {
        window.location.hash = '#' + item.key;
        closeSearchPalette();
        setTimeout(() => {
            highlightMatchedResource(item.title);
        }, 150);
    }
}

function highlightMatchedResource(titleText) {
    const container = document.getElementById('content-container');
    if (!container) return;

    const links = container.querySelectorAll('a, li, .dlink-card');
    let targetElement = null;

    for (let el of links) {
        const text = el.textContent || '';
        if (text.toLowerCase().includes(titleText.toLowerCase())) {
            targetElement = el.closest('.dlink-card') || el.closest('li') || el;
            break;
        }
    }

    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.remove('item-highlighted');
        void targetElement.offsetWidth; // trigger reflow
        targetElement.classList.add('item-highlighted');
    }
}

function setupSearch() {
    const sidebarSearchBox = document.querySelector('.search-box');
    const sidebarSearchInput = document.querySelector('.search-box input');
    
    if (sidebarSearchBox) {
        sidebarSearchBox.addEventListener('click', (e) => {
            openSearchPalette();
        });
    }

    if (sidebarSearchInput) {
        sidebarSearchInput.addEventListener('focus', (e) => {
            e.preventDefault();
            sidebarSearchInput.blur();
            openSearchPalette();
        });
    }

    const paletteInput = document.getElementById('paletteSearchInput');
    if (paletteInput) {
        paletteInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            renderPaletteResults(query);
        });

        paletteInput.addEventListener('keydown', (e) => {
            const items = document.querySelectorAll('.search-palette-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectedIndex < items.length - 1) {
                    if (selectedIndex >= 0) items[selectedIndex].classList.remove('selected');
                    selectedIndex++;
                    items[selectedIndex].classList.add('selected');
                    items[selectedIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedIndex > 0) {
                    items[selectedIndex].classList.remove('selected');
                    selectedIndex--;
                    items[selectedIndex].classList.add('selected');
                    items[selectedIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
                handlePaletteSelect(activeIndex);
            }
        });
    }

    // Keyboard global listener for Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearchPalette();
        }
    });

    // Click outside backdrop to close
    const overlay = document.getElementById('searchPaletteModal');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeSearchPalette();
            }
        });
    }
}

window.addEventListener('hashchange', renderPage);
window.addEventListener('DOMContentLoaded', init);

// Auth and User State
let currentUser = null;

async function checkAuthStatus() {
    const token = localStorage.getItem('userToken');
    if (token) {
        try {
            const res = await fetch(API_BASE + '/api/users/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                updateAuthUI();
                return;
            } else {
                localStorage.removeItem('userToken');
            }
        } catch (e) {
            console.error('Failed to fetch profile', e);
        }
    }
    currentUser = null;
    updateAuthUI();
}

function updateAuthUI() {
    const unauthSection = document.getElementById('unauthSection');
    const authSection = document.getElementById('authSection');
    const notifBellSection = document.getElementById('notifBellSection');

    if (currentUser) {
        unauthSection.style.display = 'none';
        authSection.style.display = 'flex';
        if (notifBellSection) notifBellSection.style.display = 'flex';
        document.getElementById('navUserName').textContent = currentUser.username;
        document.getElementById('navProfilePic').src = currentUser.profilePic ? (currentUser.profilePic.startsWith('http') ? currentUser.profilePic : `${API_BASE}${currentUser.profilePic}`) : 'https://api.dicebear.com/6.x/initials/svg?seed=' + currentUser.name;

        // Populate profile form
        document.getElementById('profName').value = currentUser.name || '';
        document.getElementById('profUsername').value = currentUser.username || '';
        document.getElementById('profEmail').value = currentUser.email || '';
        document.getElementById('profilePicPreview').src = currentUser.profilePic ? (currentUser.profilePic.startsWith('http') ? currentUser.profilePic : `${API_BASE}${currentUser.profilePic}`) : 'https://api.dicebear.com/6.x/initials/svg?seed=' + currentUser.name;
        document.getElementById('profileBannerPreview').src = currentUser.profileBanner ? (currentUser.profileBanner.startsWith('http') ? currentUser.profileBanner : `${API_BASE}${currentUser.profileBanner}`) : '';
        document.getElementById('profBio').value = currentUser.bio || '';
        document.getElementById('profBioCount').textContent = (currentUser.bio || '').length;
        startNotifPolling();
    } else {
        unauthSection.style.display = 'block';
        authSection.style.display = 'none';
        if (notifBellSection) notifBellSection.style.display = 'none';
        stopNotifPolling();
    }
    injectBookmarkStars();

    // Re-render bookmarks page if active, to sync guest -> authenticated bookmarks
    const hash = window.location.hash.substring(1) || 'introduction';
    if (hash === 'bookmarks') {
        renderBookmarks();
    }
}

// Modal handling
function openModal(id) {
    closeModals();
    document.getElementById(id).classList.add('active');
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    // clear errors
    document.querySelectorAll('.error-msg').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
}

// Login
async function handleLogin() {
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    const err = document.getElementById('loginError');
    try {
        const res = await fetch(API_BASE + '/api/users/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: u, password: p})
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('userToken', data.token);
            currentUser = data.user;
            updateAuthUI();
            closeModals();
        } else {
            err.textContent = data.message;
            err.style.display = 'block';
        }
    } catch(e) {
        err.textContent = 'Network error';
        err.style.display = 'block';
    }
}

// Register
async function handleRegister() {
    const name = document.getElementById('regName').value;
    const u = document.getElementById('regUsername').value;
    const e = document.getElementById('regEmail').value;
    const p = document.getElementById('regPassword').value;
    const picFile = document.getElementById('regPicUpload').files[0];
    const bannerFile = document.getElementById('regBannerUpload').files[0];
    const err = document.getElementById('regError');
    
    if (picFile && picFile.size > 2 * 1024 * 1024) {
        err.textContent = "Profile picture size must be under 2MB.";
        err.style.display = 'block';
        return;
    }
    if (bannerFile && bannerFile.size > 2 * 1024 * 1024) {
        err.textContent = "Profile banner size must be under 2MB.";
        err.style.display = 'block';
        return;
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('username', u);
    formData.append('email', e);
    formData.append('password', p);
    if (picFile) formData.append('profilePic', picFile);
    if (bannerFile) formData.append('profileBanner', bannerFile);

    try {
        const res = await fetch(API_BASE + '/api/users/register', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('userToken', data.token);
            currentUser = data.user;
            updateAuthUI();
            closeModals();
        } else {
            err.textContent = data.message;
            err.style.display = 'block';
        }
    } catch(e) {
        err.textContent = 'Network error: Make sure the backend server is running.';
        err.style.display = 'block';
    }
}

// Profile update
async function handleProfileUpdate() {
    const name = document.getElementById('profName').value;
    const u = document.getElementById('profUsername').value;
    const e = document.getElementById('profEmail').value;
    const p = document.getElementById('profPassword').value;
    const picFile = document.getElementById('picUpload').files[0];
    const bannerFile = document.getElementById('bannerUpload').files[0];
    const err = document.getElementById('profError');

    if (picFile && picFile.size > 2 * 1024 * 1024) {
        err.textContent = "Profile picture size must be under 2MB.";
        err.style.display = 'block';
        return;
    }
    if (bannerFile && bannerFile.size > 2 * 1024 * 1024) {
        err.textContent = "Profile banner size must be under 2MB.";
        err.style.display = 'block';
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('username', u);
    formData.append('email', e);
    formData.append('bio', document.getElementById('profBio').value);
    if (p) formData.append('password', p);
    if (picFile) formData.append('profilePic', picFile);
    if (bannerFile) formData.append('profileBanner', bannerFile);

    try {
        const token = localStorage.getItem('userToken');
        const res = await fetch(API_BASE + '/api/users/profile', {
            method: 'POST',
            headers: {'Authorization': `Bearer ${token}`},
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            updateAuthUI();
            closeModals();
        } else {
            err.textContent = data.message;
            err.style.display = 'block';
        }
    } catch(e) {
        err.textContent = 'Network error';
        err.style.display = 'block';
    }
}

function handleLogout() {
    localStorage.removeItem('userToken');
    currentUser = null;
    updateAuthUI();
    closeModals();
}

function previewImage(input, previewId, containerId) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if (containerId) {
                const container = document.getElementById(containerId);
                if (container) {
                    // Hide any other placeholder elements inside the upload container
                    for (let child of container.children) {
                        if (child.id !== previewId) {
                            child.style.display = 'none';
                        }
                    }
                }
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Bio character counter
document.addEventListener('DOMContentLoaded', () => {
    const bioField = document.getElementById('profBio');
    const bioCount = document.getElementById('profBioCount');
    if (bioField && bioCount) {
        bioField.addEventListener('input', () => {
            bioCount.textContent = bioField.value.length;
            bioCount.parentElement.classList.toggle('near-limit', bioField.value.length >= 140);
        });
    }
});

/* =============================================
   Forum Logic
   ============================================= */

let pollInterval = null;
let lastForumsJSON = '';

function startForumPolling() {
    if (pollInterval) clearInterval(pollInterval);
    
    pollInterval = setInterval(async () => {
        const hash = window.location.hash.substring(1);
        if (hash === 'forum' || hash.startsWith('forum-post-')) {
            try {
                const res = await fetch(API_BASE + '/api/forums');
                const d = await res.json();
                if (d.success) {
                    const currentJSON = JSON.stringify(d.forums);
                    // Only update and rerender if the data actually changed
                    if (currentJSON !== lastForumsJSON) {
                        lastForumsJSON = currentJSON;
                        if (hash === 'forum') {
                            await renderForumList(false); // Silent render
                        } else {
                            const postId = hash.split('forum-post-')[1];
                            await renderForumPost(postId, false); // Silent render
                        }
                    }
                }
            } catch (e) {
                console.error("Error polling forums:", e);
            }
        }
    }, 4000); // Poll every 4 seconds for a real-time feel
}

function stopForumPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function fetchForums() {
    try {
        const res = await fetch(API_BASE + '/api/forums');
        const d = await res.json();
        return d.success ? d.forums : [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function renderForumList(showLoading = true) {
    const container = document.getElementById('content-container');
    if (showLoading) {
        container.innerHTML = `<div style="padding: 40px; text-align: center;">Loading forums...</div>`;
    }
    
    const forums = await fetchForums();
    lastForumsJSON = JSON.stringify(forums);
    
    let html = `
        <div class="forum-header">
            <div>
                <h1 class="page-title">Community Help Forum</h1>
                <p style="color: #64748b;">Ask questions, share tips, and help other editors.</p>
            </div>
            <button class="btn btn-primary" onclick="openModal('forumPostModal')">Create Post</button>
        </div>
    `;

    if (forums.length === 0) {
        html += `<div style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px; color: #64748b;">No posts yet. Be the first to ask a question!</div>`;
    } else {
        html += `<div class="forum-list stagger-in">`;
        forums.forEach(post => {
            const dateStr = new Date(post.createdAt).toLocaleDateString();
            const safeTitle = post.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeContent = post.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            html += `
                <div class="forum-post-card" onclick="window.location.hash = 'forum-post-${post.id}'">
                    <div class="forum-post-header">
                        <img src="${post.authorAvatar.startsWith('http') ? post.authorAvatar : API_BASE + post.authorAvatar}" class="forum-avatar" loading="lazy">
                        <div>
                            <div class="forum-author">${post.authorName}</div>
                            <div class="forum-date">${dateStr}</div>
                        </div>
                    </div>
                    <h3 class="forum-title">${safeTitle}</h3>
                    <p class="forum-preview">${safeContent}</p>
                    <div class="forum-meta">
                        <span>
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            ${post.replies.length} replies
                        </span>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

async function renderForumPost(postId, showLoading = true) {
    const container = document.getElementById('content-container');
    
    // Store current reply textarea input value so it doesn't clear during real-time updates!
    const replyArea = document.getElementById('replyContent');
    const unsavedReply = replyArea ? replyArea.value : '';

    if (showLoading) {
        container.innerHTML = `<div style="padding: 40px; text-align: center;">Loading post...</div>`;
    }
    
    const forums = await fetchForums();
    lastForumsJSON = JSON.stringify(forums);
    const post = forums.find(f => f.id === postId);
    
    if (!post) {
        container.innerHTML = `<h1>Post not found</h1><a href="#forum" class="btn btn-outline" style="margin-top: 20px;">Back to Forum</a>`;
        return;
    }

    const dateStr = new Date(post.createdAt).toLocaleString();
    const safeTitle = post.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeContent = post.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = `
        <a href="#forum" style="color: #64748b; text-decoration: none; display: inline-block; margin-bottom: 24px;">&larr; Back to Forum</a>
        
        <div class="thread-original-post">
            <div class="forum-post-header">
                <img src="${post.authorAvatar.startsWith('http') ? post.authorAvatar : API_BASE + post.authorAvatar}" class="forum-avatar" loading="lazy">
                <div>
                    <div class="forum-author">${post.authorName}</div>
                    <div class="forum-date">${dateStr}</div>
                </div>
            </div>
            <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">${safeTitle}</h1>
            <div class="thread-content">${safeContent}</div>
            ${post.imageUrl ? `<img src="${post.imageUrl.startsWith('http') ? post.imageUrl : API_BASE + post.imageUrl}" class="thread-image" loading="lazy">` : ''}
        </div>
        
        <div class="replies-section">
            <h3 style="margin-bottom: 24px; font-size: 20px;">${post.replies.length} Replies</h3>
            <div class="replies-list stagger-in">
    `;

    post.replies.forEach(reply => {
        const rDate = new Date(reply.createdAt).toLocaleString();
        const rContent = reply.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `
            <div class="reply-bubble">
                <img src="${reply.authorAvatar.startsWith('http') ? reply.authorAvatar : API_BASE + reply.authorAvatar}" class="forum-avatar" loading="lazy">
                <div class="reply-content-box">
                    <div class="reply-header">
                        <div class="forum-author">${reply.authorName}</div>
                        <div class="forum-date">${rDate}</div>
                    </div>
                    <div class="reply-text">${rContent}</div>
                    ${reply.imageUrl ? `<img src="${reply.imageUrl.startsWith('http') ? reply.imageUrl : API_BASE + reply.imageUrl}" class="thread-image" style="max-width: 300px;" loading="lazy">` : ''}
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
        
        <div class="reply-form">
            <h3 style="margin-bottom: 16px; font-size: 18px;">Post a Reply</h3>
            <textarea id="replyContent" class="form-control" rows="4" placeholder="Write your reply... (You can post as a guest!)" style="margin-bottom: 16px; resize: vertical; min-height: 80px;"></textarea>
            
            <div class="form-group" style="margin-bottom: 16px;">
                <label>Attach Image (Optional)</label>
                <div style="border: 2px dashed #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; cursor: pointer; background: #f8fafc;" id="replyUploadBox" onclick="document.getElementById('replyImage').click()">
                    <div style="font-size: 14px; color: #64748b; font-weight: 500;">Click to upload screenshot</div>
                    <img id="replyImagePreview" src="" style="max-width: 100%; max-height: 150px; display: none; margin-top: 16px; border-radius: 8px;">
                </div>
                <input type="file" id="replyImage" style="display: none" accept="image/*" onchange="previewImage(this, 'replyImagePreview', 'replyUploadBox')">
            </div>

            <div id="replyError" class="error-msg"></div>
            <button class="btn btn-primary" onclick="handleForumReply('${post.id}')">Submit Reply</button>
        </div>
    `;

    container.innerHTML = html;
    
    // Restore unsaved text to the reply form
    const newReplyArea = document.getElementById('replyContent');
    if (newReplyArea && unsavedReply) {
        newReplyArea.value = unsavedReply;
    }
}

async function handleForumPost() {
    const title = document.getElementById('forumPostTitle').value.trim();
    const content = document.getElementById('forumPostContent').value.trim();
    const image = document.getElementById('forumPostImage').files[0];
    const err = document.getElementById('forumPostError');

    if (image && image.size > 2 * 1024 * 1024) {
        err.textContent = "Attached image size must be under 2MB.";
        err.style.display = 'block';
        return;
    }

    if (!title || !content) {
        err.textContent = "Title and description are required.";
        err.style.display = 'block';
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    if (image) formData.append('image', image);

    const token = localStorage.getItem('userToken');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(API_BASE + '/api/forums', {
            method: 'POST',
            headers,
            body: formData
        });
        const d = await res.json();
        if (d.success) {
            closeModals();
            document.getElementById('forumPostTitle').value = '';
            document.getElementById('forumPostContent').value = '';
            document.getElementById('forumPostImage').value = '';
            document.getElementById('forumPostImagePreview').style.display = 'none';
            renderForumList();
        } else {
            err.textContent = d.message;
            err.style.display = 'block';
        }
    } catch (e) {
        err.textContent = "Network error while posting.";
        err.style.display = 'block';
    }
}

async function handleForumReply(postId) {
    const content = document.getElementById('replyContent').value.trim();
    const image = document.getElementById('replyImage').files[0];
    const err = document.getElementById('replyError');

    if (image && image.size > 2 * 1024 * 1024) {
        err.textContent = "Attached image size must be under 2MB.";
        err.style.display = 'block';
        return;
    }

    if (!content) {
        err.textContent = "Reply content is required.";
        err.style.display = 'block';
        return;
    }

    const formData = new FormData();
    formData.append('content', content);
    if (image) formData.append('image', image);

    const token = localStorage.getItem('userToken');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(API_BASE + '/api/forums/' + postId + '/reply', {
            method: 'POST',
            headers,
            body: formData
        });
        const d = await res.json();
        if (d.success) {
            renderForumPost(postId);
        } else {
            err.textContent = d.message;
            err.style.display = 'block';
        }
    } catch (e) {
        err.textContent = "Network error while replying.";
        err.style.display = 'block';
    }
}

// Show/Hide password toggle function
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.classList.add('visible');
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
        input.type = 'password';
        btn.classList.remove('visible');
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
}

// Mobile Sidebar Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebarClose = document.getElementById('sidebarCloseBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebar = document.querySelector('.sidebar');

    function openSidebar() {
        if (sidebar) sidebar.classList.add('active');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
        document.body.classList.add('sidebar-open');
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    }

    if (menuToggle) menuToggle.addEventListener('click', openSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // Close sidebar drawer when a navigation link is clicked on mobile
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
        sidebarNav.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link && window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    }
});

/* =============================================
   Preset Sharing Hub Logic
   ============================================= */
let activePresetCategory = 'All';
let presetUploadSource = 'link';
let presetPlatformType = 'pc'; // 'pc' | 'mobile'
let activeSortOrder = 'newest'; // 'newest' | 'liked' | 'downloaded' | 'rated'

async function fetchPresets() {
    try {
        const res = await fetch(API_BASE + '/api/presets');
        const data = await res.json();
        return data.success ? data.presets : [];
    } catch (e) {
        console.error("Error fetching presets:", e);
        return [];
    }
}

async function renderPresetHub(platformType = 'pc') {
    const container = document.getElementById('content-container');
    container.innerHTML = `<div style="padding: 40px; text-align: center;">Loading presets...</div>`;

    const allPresets = await fetchPresets();

    // Filter by platformType — support old presets that don't have the field (default to 'pc')
    const presets = allPresets.filter(p => (p.platformType || 'pc') === platformType);

    const isPCHub = platformType === 'pc';
    const hubLabel = isPCHub ? 'PC Presets' : 'Mobile Presets';
    const hubIcon = isPCHub ? '✦' : '✦';
    const hubDesc = isPCHub
        ? 'Community presets for After Effects, Premiere Pro, DaVinci Resolve, Blender & more.'
        : 'Community presets for CapCut, Alight Motion, VN Editor, InShot & more.';
    const otherHash = isPCHub ? 'presets-mobile' : 'presets-pc';
    const otherLabel = isPCHub ? '✦ Mobile Presets' : '✦ PC Presets';

    // Count per category
    const cats = ['All', 'LUTs', 'Transitions', 'Project Files', 'SFX/Assets'];
    const counts = {};
    cats.forEach(c => counts[c] = c === 'All' ? presets.length : presets.filter(p => p.category === c).length);

    let html = `
        <div class="preset-hub-hero">
            <div class="preset-hub-hero-content">
                <div>
                    <div class="preset-hub-platform-pill ${isPCHub ? 'pc' : 'mobile'}">${hubIcon} ${hubLabel}</div>
                    <h1>Preset Hub</h1>
                    <p>${hubDesc}</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; align-items: flex-end;">
                    <button class="preset-hub-share-btn" onclick="openPresetUploadModal('${platformType}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Share a Preset
                    </button>
                    <a href="#${otherHash}" class="preset-hub-switch-btn">${otherLabel}</a>
                </div>
            </div>
        </div>

        <div class="preset-controls-bar">
            <div class="preset-search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="presetSearchInput" placeholder="Search presets..." oninput="filterPresetsBySearch()">
            </div>
            <div class="preset-filters-bar">
                ${cats.map(cat => `
                    <button class="preset-filter-btn ${activePresetCategory === cat ? 'active' : ''}" onclick="filterPresets('${cat}', '${platformType}')">
                        ${cat}
                        <span class="preset-count-badge">${counts[cat]}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    // Sort bar
    html += `
        <div class="preset-sort-bar">
            <span class="sort-label">Sort by</span>
            <button class="preset-sort-btn ${activeSortOrder === 'newest' ? 'active' : ''}" onclick="sortPresets('newest','${platformType}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Newest
            </button>
            <button class="preset-sort-btn ${activeSortOrder === 'liked' ? 'active' : ''}" onclick="sortPresets('liked','${platformType}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="${activeSortOrder === 'liked' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                Most Liked
            </button>
            <button class="preset-sort-btn ${activeSortOrder === 'downloaded' ? 'active' : ''}" onclick="sortPresets('downloaded','${platformType}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Most Downloaded
            </button>
            <button class="preset-sort-btn ${activeSortOrder === 'rated' ? 'active' : ''}" onclick="sortPresets('rated','${platformType}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="${activeSortOrder === 'rated' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Top Rated
            </button>
        </div>
    `;


    // Filter presets
    const filteredPresets = activePresetCategory === 'All'
        ? presets
        : presets.filter(p => p.category === activePresetCategory);

    // Apply sort
    const sortedPresets = [...filteredPresets];
    if (activeSortOrder === 'liked') {
        sortedPresets.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));
    } else if (activeSortOrder === 'downloaded') {
        sortedPresets.sort((a, b) => (b.downloadsCount || 0) - (a.downloadsCount || 0));
    } else if (activeSortOrder === 'rated') {
        sortedPresets.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    } else {
        sortedPresets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (filteredPresets.length === 0) {
        html += `<div class="bookmarks-empty" style="margin-top: 20px;">No presets found in this category. Be the first to share one!</div>`;
    } else {
        html += `<div class="preset-grid stagger-in">`;
        sortedPresets.forEach(preset => {
            const dateStr = new Date(preset.createdAt).toLocaleDateString();
            const safeTitle = preset.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeDesc = preset.description.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const catClass = preset.category.toLowerCase().replace(/[^a-z]/g, '');
            const isLiked = currentUser && preset.upvotes && preset.upvotes.includes(currentUser.id);
            const upvotesCount = preset.upvotes ? preset.upvotes.length : 0;

            const pLower = preset.platform.toLowerCase();
            const platClass = pLower.includes('after') ? 'ae' :
                              pLower.includes('premiere') ? 'pr' :
                              pLower.includes('photo') ? 'ps' :
                              pLower.includes('blender') ? 'blender' :
                              pLower.includes('davinci') ? 'davinci' :
                              pLower.includes('capcut') ? 'capcut' :
                              pLower.includes('alight') ? 'alight' :
                              pLower.includes('vn') ? 'vn' :
                              pLower.includes('inshot') ? 'inshot' : 'other';

            // Badge class for category
            const badgeClass = preset.category.toLowerCase().replace(/\//g, '').replace(/\s+/g, '');

            html += `
                <div class="preset-card cat-${catClass}">
                    <div class="preset-card-inner">
                        <div class="preset-badge-row">
                            <span class="preset-badge ${badgeClass}">${preset.category}</span>
                            <span class="preset-badge platform ${platClass}">${preset.platform}</span>
                        </div>
                        <h3 class="preset-title">${safeTitle}</h3>
                        <p class="preset-desc">${safeDesc}</p>
                        <div class="preset-author-section">
                            <img src="${preset.authorAvatar.startsWith('http') ? preset.authorAvatar : API_BASE + preset.authorAvatar}" class="preset-author-avatar" loading="lazy">
                            <div class="preset-author-info">
                                <div class="preset-author-name">${preset.authorName}</div>
                                <div class="preset-date">${dateStr}</div>
                            </div>
                        </div>
                    </div>
                    <div class="preset-footer-row">
                        <div class="preset-footer-left">
                            <div class="preset-stats">
                                <button class="preset-stat-btn ${isLiked ? 'liked' : ''}" onclick="likePreset('${preset.id}', this)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                    <span class="like-count">${upvotesCount}</span>
                                </button>
                                <span style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-size: 12px; padding: 4px 8px;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span class="dl-count">${preset.downloadsCount || 0}</span>
                                </span>
                            </div>
                            <div class="preset-rating" data-preset-id="${preset.id}">
                                ${renderStarsContent(preset.avgRating || 0, preset.ratings || [], preset.id)}
                            </div>
                        </div>
                        <a href="#" class="preset-download-btn" onclick="downloadPreset(event, '${preset.id}', '${preset.downloadUrl}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Download
                        </a>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

function filterPresets(category, platformType) {
    activePresetCategory = category;
    renderPresetHub(platformType || 'pc');
}

function filterPresetsBySearch() {
    const q = (document.getElementById('presetSearchInput').value || '').toLowerCase();
    const cards = document.querySelectorAll('.preset-card');
    cards.forEach(card => {
        const title = (card.querySelector('.preset-title') || {}).textContent || '';
        const desc = (card.querySelector('.preset-desc') || {}).textContent || '';
        const badge = (card.querySelector('.preset-badge') || {}).textContent || '';
        const matches = !q || title.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || badge.toLowerCase().includes(q);
        card.style.display = matches ? '' : 'none';
    });
}

function openPresetUploadModal(platformType) {
    openModal('presetUploadModal');
    presetUploadSource = 'link';
    presetPlatformType = platformType || 'pc';
    switchPresetSource('link');
    selectPresetPlatformType(presetPlatformType);
    document.getElementById('presetUploadTitle').value = '';
    document.getElementById('presetUploadDesc').value = '';
    document.getElementById('presetUploadLink').value = '';
    document.getElementById('presetUploadFile').value = '';
    document.getElementById('presetFileBoxText').textContent = 'Click to select file (under 2MB)';
    document.getElementById('presetUploadError').style.display = 'none';

    // Update platform dropdown based on type
    const platformSelect = document.getElementById('presetUploadPlatform');
    const pcOptions = ['After Effects', 'Premiere Pro', 'Photoshop', 'Davinci Resolve', 'Blender', 'Other'];
    const mobileOptions = ['CapCut', 'VN Editor', 'Alight Motion', 'InShot', 'Other'];
    const opts = presetPlatformType === 'mobile' ? mobileOptions : pcOptions;
    platformSelect.innerHTML = opts.map(o => `<option value="${o}">${o}</option>`).join('');
}

function selectPresetPlatformType(type) {
    presetPlatformType = type;
    const pcBtn = document.getElementById('platformTypePC');
    const mobileBtn = document.getElementById('platformTypeMobile');
    if (pcBtn && mobileBtn) {
        pcBtn.classList.toggle('active', type === 'pc');
        mobileBtn.classList.toggle('active', type === 'mobile');
    }
    // Also switch the platform dropdown options
    const platformSelect = document.getElementById('presetUploadPlatform');
    if (platformSelect) {
        const pcOptions = ['After Effects', 'Premiere Pro', 'Photoshop', 'Davinci Resolve', 'Blender', 'Other'];
        const mobileOptions = ['CapCut', 'VN Editor', 'Alight Motion', 'InShot', 'Other'];
        const opts = type === 'mobile' ? mobileOptions : pcOptions;
        platformSelect.innerHTML = opts.map(o => `<option value="${o}">${o}</option>`).join('');
    }
}

function switchPresetSource(source) {
    presetUploadSource = source;
    const linkBtn = document.getElementById('togglePresetLink');
    const fileBtn = document.getElementById('togglePresetFile');
    const linkContainer = document.getElementById('presetLinkContainer');
    const fileContainer = document.getElementById('presetFileContainer');

    if (source === 'link') {
        linkBtn.style.borderColor = '#6622ba';
        linkBtn.style.backgroundColor = 'rgba(102, 34, 186, 0.05)';
        linkBtn.style.fontWeight = '600';
        fileBtn.style.borderColor = '#d1d5db';
        fileBtn.style.backgroundColor = 'transparent';
        fileBtn.style.fontWeight = '500';
        linkContainer.style.display = 'block';
        fileContainer.style.display = 'none';
    } else {
        fileBtn.style.borderColor = '#6622ba';
        fileBtn.style.backgroundColor = 'rgba(102, 34, 186, 0.05)';
        fileBtn.style.fontWeight = '600';
        linkBtn.style.borderColor = '#d1d5db';
        linkBtn.style.backgroundColor = 'transparent';
        linkBtn.style.fontWeight = '500';
        fileContainer.style.display = 'block';
        linkContainer.style.display = 'none';
    }
}

function handlePresetFileSelect(input) {
    const boxText = document.getElementById('presetFileBoxText');
    if (input.files && input.files[0]) {
        boxText.textContent = `Selected: ${input.files[0].name} (${(input.files[0].size / 1024 / 1024).toFixed(2)} MB)`;
    } else {
        boxText.textContent = 'Click to select file (under 2MB)';
    }
}

async function handlePresetUpload() {
    const title = document.getElementById('presetUploadTitle').value.trim();
    const description = document.getElementById('presetUploadDesc').value.trim();
    const category = document.getElementById('presetUploadCategory').value;
    const platform = document.getElementById('presetUploadPlatform').value;
    const linkVal = document.getElementById('presetUploadLink').value.trim();
    const fileInput = document.getElementById('presetUploadFile');
    const err = document.getElementById('presetUploadError');
    const submitBtn = document.getElementById('presetSubmitBtn');

    if (!title || !description) {
        err.textContent = "Title and description are required.";
        err.style.display = 'block';
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('platform', platform);
    formData.append('platformType', presetPlatformType);

    if (presetUploadSource === 'link') {
        if (!linkVal) {
            err.textContent = "Please provide an external download link.";
            err.style.display = 'block';
            return;
        }
        formData.append('externalUrl', linkVal);
    } else {
        const file = fileInput.files[0];
        if (!file) {
            err.textContent = "Please upload a preset file.";
            err.style.display = 'block';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            err.textContent = "File size must be under 2MB.";
            err.style.display = 'block';
            return;
        }
        formData.append('file', file);
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Uploading...';

    const token = localStorage.getItem('userToken');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(API_BASE + '/api/presets', {
            method: 'POST',
            headers,
            body: formData
        });
        const d = await res.json();
        if (d.success) {
            closeModals();
            renderPresetHub();
        } else {
            err.textContent = d.message;
            err.style.display = 'block';
        }
    } catch (e) {
        err.textContent = "Network error while uploading preset.";
        err.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Share Preset';
    }
}

async function likePreset(presetId, btn) {
    if (!currentUser) {
        openModal('loginModal');
        return;
    }

    const token = localStorage.getItem('userToken');
    try {
        const res = await fetch(API_BASE + `/api/presets/${presetId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const d = await res.json();
        if (d.success) {
            const isLiked = d.upvotes.includes(currentUser.id);
            btn.classList.toggle('liked', isLiked);
            btn.querySelector('svg').setAttribute('fill', isLiked ? 'currentColor' : 'none');
            btn.querySelector('.like-count').textContent = d.upvotes.length;
        }
    } catch (e) {
        console.error("Error liking preset:", e);
    }
}

async function downloadPreset(e, presetId, downloadUrl) {
    e.preventDefault();
    window.open(downloadUrl, '_blank');

    try {
        await fetch(API_BASE + `/api/presets/${presetId}/download`, {
            method: 'POST'
        });
    } catch (err) {
        console.error("Error tracking download:", err);
    }
}


/* =============================================
   Star Rating Helpers
   ============================================= */

function renderStarsContent(avgRating, ratings, presetId) {
    const userRating = currentUser && ratings ? ratings.find(r => r.userId === currentUser.id) : null;
    const userRatingVal = userRating ? userRating.value : 0;
    const totalRatings = ratings ? ratings.length : 0;

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        const filled = avgRating >= i - 0.3;
        const userFilled = i <= userRatingVal;
        starsHtml += `<button class="star-btn${filled || userFilled ? ' filled' : ''}${userFilled ? ' user-rated' : ''}" onclick="ratePreset(event,'${presetId}',${i})" title="Rate ${i} star${i > 1 ? 's' : ''}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="${filled || userFilled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>`;
    }

    const displayRating = avgRating > 0 ? avgRating.toFixed(1) : '—';
    return `<div class="stars-row">${starsHtml}</div><span class="rating-info">${displayRating} <span class="rating-count-sm">(${totalRatings})</span></span>`;
}

function sortPresets(order, platformType) {
    activeSortOrder = order;
    renderPresetHub(platformType || 'pc');
}

async function ratePreset(e, presetId, rating) {
    e.stopPropagation();
    e.preventDefault();
    if (!currentUser) {
        openModal('loginModal');
        return;
    }
    const token = localStorage.getItem('userToken');
    try {
        const res = await fetch(API_BASE + `/api/presets/${presetId}/rate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rating })
        });
        const d = await res.json();
        if (d.success) {
            // Update just this card's stars in-place without full re-render
            const ratingDiv = document.querySelector(`.preset-rating[data-preset-id="${presetId}"]`);
            if (ratingDiv) {
                ratingDiv.innerHTML = renderStarsContent(d.avgRating, d.ratings, presetId);
            }
        }
    } catch (err) {
        console.error('Error rating preset:', err);
    }
}

/* =============================================
   Notification System
   ============================================= */

let notifPollInterval = null;
let notifPanelOpen = false;

async function fetchNotifications() {
    const token = localStorage.getItem('userToken');
    if (!token || !currentUser) return [];
    try {
        const res = await fetch(API_BASE + '/api/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        return d.success ? d.notifications : [];
    } catch (e) {
        return [];
    }
}

async function loadAndRenderNotifs() {
    const notifs = await fetchNotifications();
    const unread = notifs.filter(n => !n.read).length;

    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }

    const list = document.getElementById('notifList');
    if (!list) return;

    if (notifs.length === 0) {
        list.innerHTML = `
            <div class="notif-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }

    list.innerHTML = notifs.map(n => {
        const dateStr = new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const likeIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        const replyIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6622ba" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
        const icon = n.type === 'like' ? likeIcon : replyIcon;
        return `
            <a class="notif-item${n.read ? '' : ' unread'}" href="${n.link || '#'}" onclick="markNotifRead('${n.id}')">
                <div class="notif-icon ${n.type}">${icon}</div>
                <div class="notif-content">
                    <p class="notif-msg">${n.message}</p>
                    <span class="notif-date">${dateStr}</span>
                </div>
                ${!n.read ? '<span class="notif-dot"></span>' : ''}
            </a>
        `;
    }).join('');
}

function toggleNotifPanel(e) {
    e.stopPropagation();
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    notifPanelOpen = !notifPanelOpen;
    panel.classList.toggle('open', notifPanelOpen);
    if (notifPanelOpen) loadAndRenderNotifs();
}

function closeNotifPanel() {
    notifPanelOpen = false;
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.remove('open');
}

async function markNotifRead(notifId) {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
        await fetch(API_BASE + `/api/notifications/${notifId}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadAndRenderNotifs();
    } catch (e) {}
}

async function markAllNotifsRead() {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
        await fetch(API_BASE + '/api/notifications/read-all', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadAndRenderNotifs();
    } catch (e) {}
}

function startNotifPolling() {
    if (notifPollInterval) clearInterval(notifPollInterval);
    loadAndRenderNotifs();
    notifPollInterval = setInterval(loadAndRenderNotifs, 30000);
}

function stopNotifPolling() {
    if (notifPollInterval) {
        clearInterval(notifPollInterval);
        notifPollInterval = null;
    }
    closeNotifPanel();
}

// Close notif panel on outside click & copy password handling
document.addEventListener('click', (e) => {
    if (notifPanelOpen && !e.target.closest('#notifBellSection')) {
        closeNotifPanel();
    }

    const copyBtn = e.target.closest('.password-copy-badge');
    if (copyBtn) {
        const password = copyBtn.getAttribute('data-password') || 'star';
        navigator.clipboard.writeText(password).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <span>Copied!</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy password:', err);
        });
    }
});

/* =============================================
   Editing Toolkit & Calculator Logic
   ============================================= */
let activeCalcTab = 'ratio';

function renderCalculator() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="calculator-hero">
            <h1>Editing Calculator</h1>
            <p>A precision workspace for aspect ratios, file sizes, and timecode calculations.</p>
            <div class="calculator-hero-pills">
                <span class="calculator-hero-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                    Ratio Visualizer
                </span>
                <span class="calculator-hero-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Size Estimator
                </span>
                <span class="calculator-hero-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Timecode Converter
                </span>
            </div>
        </div>

        <div class="calculator-container">
            <div class="calculator-tabs">
                <button class="calculator-tab-btn ${activeCalcTab === 'ratio' ? 'active' : ''}" onclick="switchCalcTab('ratio')">
                    <span class="calculator-tab-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                    </span>
                    Ratio Visualizer
                </button>
                <button class="calculator-tab-btn ${activeCalcTab === 'size' ? 'active' : ''}" onclick="switchCalcTab('size')">
                    <span class="calculator-tab-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </span>
                    Size Estimator
                </button>
                <button class="calculator-tab-btn ${activeCalcTab === 'timecode' ? 'active' : ''}" onclick="switchCalcTab('timecode')">
                    <span class="calculator-tab-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </span>
                    Timecode Converter
                </button>
            </div>

            <!-- Tab 1: Ratio Visualizer -->
            <div class="calculator-content-pane ${activeCalcTab === 'ratio' ? 'active' : ''}" id="pane-ratio">
                <div class="grid-2col">
                    <div class="calc-sidebar">
                        <div class="form-group">
                            <label>Base Format Preset</label>
                            <select id="ratioPreset" class="form-control" onchange="applyRatioPreset(this.value)">
                                <option value="1920x1080">16:9 Full HD (1920 x 1080)</option>
                                <option value="1080x1920">9:16 Vertical TikTok (1080 x 1920)</option>
                                <option value="1080x1080">1:1 Square (1080 x 1080)</option>
                                <option value="1080x1350">4:5 Instagram Portrait (1080 x 1350)</option>
                                <option value="1920x803">2.39:1 CinemaScope (1920 x 803)</option>
                                <option value="custom">Custom Resolution</option>
                            </select>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label>Width (px)</label>
                                <input type="number" id="ratioWidth" class="form-control" value="1920" oninput="calcCustomRatio()">
                            </div>
                            <div class="form-group">
                                <label>Height (px)</label>
                                <input type="number" id="ratioHeight" class="form-control" value="1080" oninput="calcCustomRatio()">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Framing Overlay Guide</label>
                            <select id="ratioOverlay" class="form-control" onchange="drawRatioVisualizer()">
                                <option value="none">None (Clean Output)</option>
                                <option value="safe90">90% Action Safe Zone</option>
                                <option value="safe80">80% Title Safe Zone</option>
                                <option value="thirds">Rule of Thirds Grid</option>
                                <option value="social">9:16 Center Safe (for 16:9 videos)</option>
                            </select>
                        </div>
                    </div>
                    <div class="calc-preview-card">
                        <div class="svg-crop-container">
                            <svg id="ratioSvg" viewBox="0 0 160 90">
                                <!-- Drawn dynamically via JS -->
                            </svg>
                        </div>
                        <div class="calc-results-badge" id="ratioResults">Aspect Ratio: <span>16:9</span></div>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Size Estimator -->
            <div class="calculator-content-pane ${activeCalcTab === 'size' ? 'active' : ''}" id="pane-size">
                <div class="grid-2col">
                    <div class="calc-sidebar">
                        <div class="form-group">
                            <label>Codec / Bitrate Preset</label>
                            <select id="sizePreset" class="form-control" onchange="applySizePreset(this.value)">
                                <option value="12">YouTube 1080p H.264 (~12 Mbps)</option>
                                <option value="45">YouTube 4K H.264 (~45 Mbps)</option>
                                <option value="8">Standard Streaming (~8 Mbps)</option>
                                <option value="220">ProRes 422 HQ 1080p (~220 Mbps)</option>
                                <option value="330">ProRes 4444 1080p (~330 Mbps)</option>
                                <option value="custom">Custom Bitrate</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <div class="bitrate-display">
                                <label>Target Bitrate</label>
                                <span class="bitrate-value-pill" id="bitrateVal">12 Mbps</span>
                            </div>
                            <input type="range" id="sizeBitrate" min="1" max="500" value="12" class="form-control" oninput="updateSizeBitrate(this.value)">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label>Hours</label>
                                <input type="number" id="sizeHrs" class="form-control" value="0" min="0" oninput="estimateFileSize()">
                            </div>
                            <div class="form-group">
                                <label>Minutes</label>
                                <input type="number" id="sizeMins" class="form-control" value="10" min="0" max="59" oninput="estimateFileSize()">
                            </div>
                            <div class="form-group">
                                <label>Seconds</label>
                                <input type="number" id="sizeSecs" class="form-control" value="0" min="0" max="59" oninput="estimateFileSize()">
                            </div>
                        </div>
                    </div>
                    <div class="calc-preview-card">
                        <div class="calc-output-card">
                            <div class="calc-output-label">Estimated File Size</div>
                            <div class="calc-output-val" id="sizeOutput">900 MB</div>
                            <div class="calc-output-desc">At standard 8 bits per Byte. Actual compression sizes may vary.</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Timecode Converter -->
            <div class="calculator-content-pane ${activeCalcTab === 'timecode' ? 'active' : ''}" id="pane-timecode">
                <div class="grid-2col">
                    <div class="calc-sidebar">
                        <div class="form-group">
                            <label>Frame Rate (FPS)</label>
                            <select id="timecodeFps" class="form-control" onchange="convertTimecodeFields('timecode')">
                                <option value="23.976">23.976 fps (Film)</option>
                                <option value="24">24 fps (Standard Cinema)</option>
                                <option value="25">25 fps (PAL / Europe)</option>
                                <option value="29.97">29.97 fps (NTSC Broadcast)</option>
                                <option value="30">30 fps (Standard Web)</option>
                                <option value="50">50 fps (High Rate PAL)</option>
                                <option value="59.94">59.94 fps (High Rate Broadcast)</option>
                                <option value="60">60 fps (Gaming / High FPS)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Timecode (HH:MM:SS:FF)</label>
                            <input type="text" id="timecodeVal" class="form-control" value="00:00:10:00" placeholder="00:00:00:00" oninput="convertTimecodeFields('timecode')">
                        </div>
                        <div class="form-group">
                            <label>Total Frame Count</label>
                            <input type="number" id="framecodeVal" class="form-control" value="300" min="0" oninput="convertTimecodeFields('frames')">
                        </div>
                    </div>
                    <div class="calc-preview-card">
                        <div class="calc-output-card">
                            <div class="calc-output-label">Conversion Result</div>
                            <div class="calc-output-val" style="font-size: 32px; letter-spacing: -1px;" id="timecodeOutput">300 Frames</div>
                            <div class="calc-output-desc">Frame-accurate based on selected FPS parameter.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // Draw initial SVG ratio box & init slider
    drawRatioVisualizer();
    updateSizeBitrate(12);
}

function switchCalcTab(tab) {
    activeCalcTab = tab;
    document.querySelectorAll('.calculator-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tab.replace('ratio', 'visualizer').replace('size', 'estimator').replace('timecode', 'converter').split(' ')[0].toLowerCase()));
    });
    document.querySelectorAll('.calculator-content-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    const selectedPane = document.getElementById(`pane-${tab}`);
    if (selectedPane) selectedPane.classList.add('active');

    if (tab === 'ratio') drawRatioVisualizer();
    if (tab === 'size') estimateFileSize();
    if (tab === 'timecode') convertTimecodeFields('timecode');
}

// Ratio sub-logic
function applyRatioPreset(val) {
    if (val === 'custom') return;
    const [w, h] = val.split('x').map(Number);
    document.getElementById('ratioWidth').value = w;
    document.getElementById('ratioHeight').value = h;
    drawRatioVisualizer();
}

function calcCustomRatio() {
    document.getElementById('ratioPreset').value = 'custom';
    drawRatioVisualizer();
}

function drawRatioVisualizer() {
    const width = Number(document.getElementById('ratioWidth').value) || 1920;
    const height = Number(document.getElementById('ratioHeight').value) || 1080;
    const overlay = document.getElementById('ratioOverlay').value;
    const results = document.getElementById('ratioResults');
    const svg = document.getElementById('ratioSvg');

    if (!svg) return;

    // Calculate aspect ratio text
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(width, height);
    const rW = width / divisor;
    const rH = height / divisor;
    
    let ratioText = `${rW}:${rH}`;
    if ((width/height).toFixed(3) === '2.391' || (width/height).toFixed(2) === '2.39') ratioText = '2.39:1 (CinemaScope)';
    else if ((width/height).toFixed(3) === '1.850' || (width/height).toFixed(2) === '1.85') ratioText = '1.85:1 (Flat)';
    
    results.innerHTML = `Aspect Ratio: <span>${ratioText}</span> (${width} x ${height})`;

    const baseW = 160;
    const baseH = 90;
    
    let boxW, boxH;
    const screenRatio = baseW / baseH;
    const customRatio = width / height;

    if (customRatio > screenRatio) {
        boxW = baseW - 10;
        boxH = boxW / customRatio;
    } else {
        boxH = baseH - 10;
        boxW = boxH * customRatio;
    }

    const x = (baseW - boxW) / 2;
    const y = (baseH - boxH) / 2;

    let svgHtml = `
        <rect width="${baseW}" height="${baseH}" fill="#0f172a" opacity="0.4"></rect>
        
        <!-- Viewfinder Outer Box -->
        <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" fill="none" stroke="#6622ba" stroke-width="1.5"></rect>
        <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" fill="rgba(102,34,186,0.06)"></rect>
        
        <!-- Viewfinder Corners -->
        <!-- Top-Left -->
        <path d="M ${x + 4} ${y} L ${x} ${y} L ${x} ${y + 4}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.95"></path>
        <!-- Top-Right -->
        <path d="M ${x + boxW - 4} ${y} L ${x + boxW} ${y} L ${x + boxW} ${y + 4}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.95"></path>
        <!-- Bottom-Left -->
        <path d="M ${x} ${y + boxH - 4} L ${x} ${y + boxH} L ${x + 4} ${y + boxH}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.95"></path>
        <!-- Bottom-Right -->
        <path d="M ${x + boxW - 4} ${y + boxH} L ${x + boxW} ${y + boxH} L ${x + boxW} ${y + boxH - 4}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.95"></path>
        
        <!-- Center Viewfinder Crosshair -->
        <line x1="${x + boxW/2 - 3}" y1="${y + boxH/2}" x2="${x + boxW/2 + 3}" y2="${y + boxH/2}" stroke="#ffffff" stroke-width="0.4" opacity="0.75"></line>
        <line x1="${x + boxW/2}" y1="${y + boxH/2 - 3}" x2="${x + boxW/2}" y2="${y + boxH/2 + 3}" stroke="#ffffff" stroke-width="0.4" opacity="0.75"></line>
    `;

    if (overlay === 'safe90') {
        const offX = boxW * 0.05;
        const offY = boxH * 0.05;
        svgHtml += `<rect x="${x + offX}" y="${y + offY}" width="${boxW - (offX*2)}" height="${boxH - (offY*2)}" fill="none" stroke="#ef4444" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.8"></rect>`;
        svgHtml += `<text x="${x + offX + 2}" y="${y + offY + 6}" fill="#ef4444" font-size="3" font-weight="600" opacity="0.7">90% Action Safe</text>`;
    } else if (overlay === 'safe80') {
        const offX = boxW * 0.1;
        const offY = boxH * 0.1;
        svgHtml += `<rect x="${x + offX}" y="${y + offY}" width="${boxW - (offX*2)}" height="${boxH - (offY*2)}" fill="none" stroke="#ef4444" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.8"></rect>`;
        svgHtml += `<text x="${x + offX + 2}" y="${y + offY + 6}" fill="#ef4444" font-size="3" font-weight="600" opacity="0.7">80% Title Safe</text>`;
    } else if (overlay === 'thirds') {
        const w3 = boxW / 3;
        const h3 = boxH / 3;
        svgHtml += `
            <line x1="${x + w3}" y1="${y}" x2="${x + w3}" y2="${y + boxH}" stroke="#ffffff" stroke-width="0.4" opacity="0.4"></line>
            <line x1="${x + (w3*2)}" y1="${y}" x2="${x + (w3*2)}" y2="${y + boxH}" stroke="#ffffff" stroke-width="0.4" opacity="0.4"></line>
            <line x1="${x}" y1="${y + h3}" x2="${x + boxW}" y2="${y + h3}" stroke="#ffffff" stroke-width="0.4" opacity="0.4"></line>
            <line x1="${x}" y1="${y + (h3*2)}" x2="${x + boxW}" y2="${y + (h3*2)}" stroke="#ffffff" stroke-width="0.4" opacity="0.4"></line>
        `;
    } else if (overlay === 'social' && customRatio > 1) {
        const targetRatio = 9/16;
        const cropW = boxH * targetRatio;
        const cropX = x + (boxW - cropW) / 2;
        svgHtml += `
            <rect x="${x}" y="${y}" width="${cropX - x}" height="${boxH}" fill="#000" opacity="0.65"></rect>
            <rect x="${cropX + cropW}" y="${y}" width="${x + boxW - (cropX + cropW)}" height="${boxH}" fill="#000" opacity="0.65"></rect>
            <rect x="${cropX}" y="${y}" width="${cropW}" height="${boxH}" fill="none" stroke="#22c55e" stroke-width="1"></rect>
            <text x="${cropX + 2}" y="${y + 6}" fill="#22c55e" font-size="3" font-weight="700">9:16 Center Safe</text>
        `;
    }

    svg.innerHTML = svgHtml;
}

// Size sub-logic
function applySizePreset(val) {
    if (val === 'custom') return;
    document.getElementById('sizeBitrate').value = val;
    updateSizeBitrate(val);
}

function updateSizeBitrate(val) {
    const pill = document.getElementById('bitrateVal');
    if (pill) pill.textContent = val + ' Mbps';
    const slider = document.getElementById('sizeBitrate');
    if (slider) {
        slider.value = val;
        // Update the visual fill on the range slider
        const pct = ((val - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.setProperty('--range-progress', pct + '%');
    }
    estimateFileSize();
}

function estimateFileSize() {
    const bitrate = Number(document.getElementById('sizeBitrate').value) || 12;
    const hrs = Number(document.getElementById('sizeHrs').value) || 0;
    const mins = Number(document.getElementById('sizeMins').value) || 10;
    const secs = Number(document.getElementById('sizeSecs').value) || 0;

    const totalSeconds = (hrs * 3600) + (mins * 60) + secs;
    const totalMegabits = bitrate * totalSeconds;
    const totalMegabytes = totalMegabits / 8;

    const sizeOutput = document.getElementById('sizeOutput');
    if (!sizeOutput) return;

    const formatNum = (n) => {
        if (n >= 1000) return n.toFixed(1);
        if (n >= 100) return Math.round(n).toString();
        return n.toFixed(1);
    };

    if (totalMegabytes >= 1024) {
        sizeOutput.textContent = `${formatNum(totalMegabytes / 1024)} GB`;
    } else {
        sizeOutput.textContent = `${formatNum(totalMegabytes)} MB`;
    }
}

// Timecode Converter sub-logic
function convertTimecodeFields(source) {
    const fps = Number(document.getElementById('timecodeFps').value) || 24;
    const tcField = document.getElementById('timecodeVal');
    const fField = document.getElementById('framecodeVal');
    const outputText = document.getElementById('timecodeOutput');

    if (!outputText) return;

    if (source === 'timecode') {
        const tc = tcField.value.trim();
        const parts = tc.split(/[:;]/).map(Number);
        
        if (parts.length === 4 && parts.every(num => !isNaN(num))) {
            const [h, m, s, f] = parts;
            const totalFrames = Math.round(((h * 3600) + (m * 60) + s) * fps) + f;
            fField.value = totalFrames;
            outputText.textContent = `${totalFrames} Frames`;
        } else {
            outputText.textContent = 'Invalid Timecode Format';
        }
    } else {
        const frames = Math.max(0, parseInt(fField.value) || 0);
        const totalSeconds = Math.floor(frames / fps);
        const f = Math.round(frames % fps);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        const pad = (num, len = 2) => String(num).padStart(len, '0');
        const formattedTimecode = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
        
        tcField.value = formattedTimecode;
        outputText.textContent = formattedTimecode;
    }
}


/* =============================================
   Bookmarks/Favorites Page Logic
   ============================================= */
function renderBookmarks() {
    const container = document.getElementById('content-container');
    const bookmarks = getBookmarks();

    let html = `
        <h1 class="page-title">My Bookmarked Resources</h1>
        <p style="color: #64748b; margin-bottom: 30px;">Quick-access folder of downloads and presets you've starred.</p>
    `;

    if (bookmarks.length === 0) {
        html += `
            <div class="bookmarks-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6622ba; margin-bottom: 16px;">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <h3 style="font-size: 18px; font-weight: 700; color: #111; margin-bottom: 8px;">No Bookmarks Found</h3>
                <p>Click the star icon next to any software, plugin, or preset to save it here.</p>
            </div>
        `;
        container.innerHTML = html;
        return;
    }

    const softwareBookmarks = bookmarks.filter(b => b.type === 'software');
    const downloadBookmarks = bookmarks.filter(b => b.type === 'download');
    const presetBookmarks = bookmarks.filter(b => b.type === 'preset');

    html += `<div class="bookmarks-grid stagger-in">`;

    if (softwareBookmarks.length > 0) {
        html += `
            <div class="bookmarks-cat-section">
                <h3 class="bookmarks-cat-title">Software Installers</h3>
                <ul class="software-list" style="margin-left: 0;">
        `;
        softwareBookmarks.forEach(b => {
            html += `
                <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-right: 0;">
                    <a href="${b.url}" target="_blank" style="font-size: 16px;">${b.title}</a>
                    <button class="preset-filter-btn" style="padding: 4px 10px; font-size: 11px; margin-left: 10px;" onclick="unbookmarkItemAndReload('${b.title}', '${b.url}')">Remove</button>
                </li>
            `;
        });
        html += `
                </ul>
            </div>
        `;
    }

    if (downloadBookmarks.length > 0) {
        html += `
            <div class="bookmarks-cat-section">
                <h3 class="bookmarks-cat-title">Plugins & Website Links</h3>
                <div class="download-links-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
        `;
        downloadBookmarks.forEach(b => {
            html += `
                <div class="dlink-card" style="position: relative; margin-bottom: 0;">
                    <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 24px; color: #111; font-family: 'Space Grotesk', sans-serif;">${b.title}</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <a href="${b.url}" target="_blank" class="preset-download-btn" style="padding: 6px 12px;">Go to Link</a>
                        <button class="preset-filter-btn" style="padding: 4px 10px; font-size: 11px;" onclick="unbookmarkItemAndReload('${b.title}', '${b.url}')">Remove</button>
                    </div>
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    }

    if (presetBookmarks.length > 0) {
        html += `
            <div class="bookmarks-cat-section">
                <h3 class="bookmarks-cat-title">Starred Presets</h3>
                <div class="preset-grid">
        `;
        presetBookmarks.forEach(b => {
            html += `
                <div class="preset-card" style="margin-bottom: 0;">
                    <div>
                        <h3 class="preset-title">${b.title}</h3>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
                        <a href="${b.url}" target="_blank" class="preset-download-btn" style="padding: 6px 12px;">Download</a>
                        <button class="preset-filter-btn" style="padding: 4px 10px; font-size: 11px;" onclick="unbookmarkItemAndReload('${b.title}', '${b.url}')">Remove</button>
                    </div>
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

async function unbookmarkItemAndReload(title, url) {
    if (currentUser) {
        const token = localStorage.getItem('userToken');
        const item = currentUser.bookmarks.find(b => b.title === title || b.url === url);
        if (item) {
            await toggleBookmarkItem(item.type, item.key, title, url, null);
        }
    } else {
        await toggleBookmarkItem(null, null, title, url, null);
    }
    renderBookmarks();
}


/* =============================================
   Shared Bookmark Helpers
   ============================================= */
function getBookmarks() {
    if (currentUser) {
        return currentUser.bookmarks || [];
    } else {
        try {
            return JSON.parse(localStorage.getItem('guest_bookmarks')) || [];
        } catch (e) {
            return [];
        }
    }
}

function isBookmarked(title, url) {
    const list = getBookmarks();
    return list.some(item => (item.url === url && url !== '#') || item.title === title);
}

function injectBookmarkStars() {
    const container = document.getElementById('content-container');
    if (!container) return;

    const hash = window.location.hash.substring(1) || 'introduction';

    // 1. Process download cards (.dlink-card)
    const dlinkCards = container.querySelectorAll('.dlink-card');
    dlinkCards.forEach(card => {
        const titleEl = card.querySelector('h4');
        const title = titleEl ? titleEl.textContent.trim() : 'Download';
        const url = card.getAttribute('href');
        
        if (card.querySelector('.bookmark-star')) return;

        const star = document.createElement('button');
        star.className = 'bookmark-star' + (isBookmarked(title, url) ? ' bookmarked' : '');
        star.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
        `;
        star.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await toggleBookmarkItem('download', hash, title, url, star);
        });
        card.style.position = 'relative';
        card.appendChild(star);
    });

    // 2. Process list items in .software-list
    const softwareItems = container.querySelectorAll('.software-list li');
    softwareItems.forEach(li => {
        const link = li.querySelector('a');
        if (!link) return;
        const title = link.textContent.trim();
        const url = link.getAttribute('href');

        if (li.querySelector('.bookmark-star')) return;

        const star = document.createElement('button');
        star.className = 'bookmark-star' + (isBookmarked(title, url) ? ' bookmarked' : '');
        star.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
        `;
        star.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await toggleBookmarkItem('software', hash, title, url, star);
        });
        li.appendChild(star);
    });
}

async function toggleBookmarkItem(type, key, title, url, starBtn) {
    if (currentUser) {
        const token = localStorage.getItem('userToken');
        try {
            const res = await fetch(API_BASE + '/api/users/bookmarks/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type, key, title, url })
            });
            const data = await res.json();
            if (data.success) {
                currentUser.bookmarks = data.bookmarks;
                if (starBtn) {
                    starBtn.classList.toggle('bookmarked', isBookmarked(title, url));
                }
            } else {
                console.error("Error toggling bookmark:", data.message);
            }
        } catch (e) {
            console.error("Network error toggling bookmark:", e);
        }
    } else {
        try {
            let bookmarks = JSON.parse(localStorage.getItem('guest_bookmarks')) || [];
            const index = bookmarks.findIndex(item => (item.url === url && url !== '#') || item.title === title);
            if (index === -1) {
                bookmarks.push({ type, key, title, url, bookmarkedAt: new Date().toISOString() });
            } else {
                bookmarks.splice(index, 1);
            }
            localStorage.setItem('guest_bookmarks', JSON.stringify(bookmarks));
            if (starBtn) {
                starBtn.classList.toggle('bookmarked', isBookmarked(title, url));
            }
        } catch (e) {
            console.error("Error toggling guest bookmark:", e);
        }
    }
}

