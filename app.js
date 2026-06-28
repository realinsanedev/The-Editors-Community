// Theme Toggle Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}
initTheme();

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    }
}

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
    
    // Apply custom category names before mapping
    if (data._categories) {
        Object.entries(data._categories).forEach(([id, newName]) => {
            if (newName && newName.trim() !== '') {
                const h3 = document.querySelector(`.nav-section h3[data-category-id="${id}"]`);
                if (h3) h3.textContent = newName.trim();
            }
        });
    }

    sections.forEach(sec => {
        const h3 = sec.querySelector('h3');
        if (h3) {
            const id = h3.getAttribute('data-category-id') || h3.textContent;
            const text = id.trim().toLowerCase();
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
            if (path && path !== 'introduction' && path !== 'forum' && path !== 'presets-pc' && path !== 'presets-mobile' && path !== 'calculator' && path !== 'bookmarks' && path !== 'useful-tutorials' && path !== 'showcase' && !data[path]) {
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

function showToast(message, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.color = '#ffffff';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '500';
        toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        toast.style.zIndex = '9999';
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#ef4444' : '#10b981';
    
    // Show toast
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 50);

    // Hide toast
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
}

async function init() {
    // Check for OAuth token or error in URL query
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('oauth_token');
    const authError = urlParams.get('error');

    if (oauthToken) {
        localStorage.setItem('userToken', oauthToken);
        showToast('Signed in successfully!');
        // Clean URL query params
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    } else if (authError) {
        showToast(decodeURIComponent(authError), true);
        // Clean URL query params
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

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
    if (hash === 'showcase') {
        renderShowcase();
        return;
    }
    if (hash === 'useful-tutorials') {
        renderUsefulTutorials();
        return;
    }
    if (hash === 'leaderboard') {
        renderLeaderboard();
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
    // Strip legacy disclaimer text from page content (now handled by site footer)
    let cleanContent = (pageData.content || '').replace(/<p[^>]*>all content provided on this website[\s\S]*?<\/p>/gi, '');
    html += cleanContent;
    
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
                    
                    let itemHtml = `<a href="${sUrl}" style="${highlightStyle}" target="_blank">${sLabel}</a>`;
                    
                    if (link.extraLinks && link.extraLinks.length > 0) {
                        link.extraLinks.forEach(ext => {
                            const extLabel = ext.label ? ext.label.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Link';
                            const extUrl = ext.url ? ext.url.replace(/"/g, '&quot;') : '#';
                            itemHtml += ` <span style="color: #64748b; margin: 0 4px; font-weight: 500;">/</span> <a href="${extUrl}" style="${highlightStyle}" target="_blank">${extLabel}</a>`;
                        });
                    }
                    
                    html += `<li>${itemHtml}</li>`;
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
            const sUrl = link.url ? link.url.replace(/"/g, '&quot;') : '#';
 
            html += `
                <a href="${sUrl}" target="_blank" class="dlink-card">
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
                <p style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Tip: Type <strong>/</strong> for navigation shortcuts</p>
            </div>
        `;
        return;
    }

    // Intercept slash commands
    if (query.startsWith('/')) {
        const SLASH_COMMANDS = [
            { name: '/presets-pc', path: 'presets-pc', desc: 'Browse PC presets, transitions, and projects' },
            { name: '/presets-mobile', path: 'presets-mobile', desc: 'Browse mobile presets, XMLs, and templates' },
            { name: '/calculator', path: 'calculator', desc: 'Calculate video bitrates and estimated file size' },
            { name: '/tutorials', path: 'useful-tutorials', desc: 'Watch useful video editing tutorials' },
            { name: '/forum', path: 'forum', desc: 'Help Forum to ask questions and get help' },
            { name: '/bookmarks', path: 'bookmarks', desc: 'View your bookmarked presets and resources' },
            { name: '/leaderboard', path: 'leaderboard', desc: 'View creator ranks and shared presets stats' },
            { name: '/dashboard', path: 'introduction', desc: 'Go back to dashboard' }
        ];

        const matched = SLASH_COMMANDS.filter(cmd => 
            cmd.name.startsWith(query) || 
            cmd.desc.toLowerCase().includes(query.substring(1))
        );

        let html = '';
        if (matched.length > 0) {
            html += `<div class="search-palette-group-title">Slash Commands</div>`;
            matched.forEach(cmd => {
                const index = currentResults.length;
                currentResults.push({
                    type: 'command',
                    key: cmd.path,
                    title: cmd.name,
                    subtitle: cmd.desc,
                    category: 'Command'
                });
                html += `
                    <div class="search-palette-item" data-index="${index}" onclick="handlePaletteSelect(${index})">
                        <div class="search-palette-item-left">
                            <div class="search-palette-item-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                            </div>
                            <div>
                                <div class="search-palette-item-title" style="color: #6622ba; font-weight: 700;">${cmd.name}</div>
                                <div class="search-palette-item-desc">${cmd.desc}</div>
                            </div>
                        </div>
                        <span class="search-palette-item-badge">Run</span>
                    </div>
                `;
            });
        }

        if (currentResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="search-palette-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280; margin-bottom: 16px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <p>No commands found for "${query}"</p>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = html;
        }
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

    if (item.type === 'section' || item.type === 'command') {
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
    container.innerHTML = getLoadingHTML('Loading forums...');
    
    const forums = await fetchForums();
    lastForumsJSON = JSON.stringify(forums);
    
    let html = `
        <div class="preset-hub-hero" style="background: linear-gradient(135deg, #1b0f2e, #130a21); border: 1px solid rgba(139, 92, 246, 0.15); margin-bottom: 30px;">
            <div class="preset-hub-hero-content">
                <div>
                    <div class="preset-hub-platform-pill pc" style="margin-bottom: 12px;">✦ Forum</div>
                    <h1>Community Help Forum</h1>
                    <p style="color: rgba(255,255,255,0.7);">Ask questions, share tips, and help other editors.</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; align-items: flex-end;">
                    <button class="preset-hub-share-btn" onclick="openModal('forumPostModal')" style="font-size: 15px; padding: 12px 24px; box-shadow: 0 4px 15px rgba(102, 34, 186, 0.4);">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display:inline; margin-bottom:-4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Create Post
                    </button>
                </div>
            </div>
        </div>
    `;

    if (forums.length === 0) {
        html += `<div class="empty-state" style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px; color: #64748b;">No posts yet. Be the first to ask a question!</div>`;
    } else {
        html += `<div class="forum-list stagger-in">`;
        forums.forEach(post => {
            const dateStr = new Date(post.createdAt).toLocaleDateString();
            const safeTitle = post.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeContent = post.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const authorRole = post.authorRole || 'member';
            
            html += `
                <div class="forum-post-card" onclick="window.location.hash = 'forum-post-${post.id}'">
                    <div class="forum-post-header">
                        <img src="${post.authorAvatar && post.authorAvatar.startsWith('http') ? post.authorAvatar : API_BASE + (post.authorAvatar || '/avatar.png')}" class="forum-avatar" loading="lazy">
                        <div>
                            <div class="forum-author">${post.authorName} ${getRoleBadgeHtml(authorRole)}</div>
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
        container.innerHTML = getLoadingHTML('Loading post...');
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
    const authorRole = post.authorRole || 'member';

    let html = `
        <a href="#forum" style="color: #64748b; text-decoration: none; display: inline-block; margin-bottom: 24px;">&larr; Back to Forum</a>
        
        <div class="thread-original-post">
            <div class="forum-post-header">
                <img src="${post.authorAvatar && post.authorAvatar.startsWith('http') ? post.authorAvatar : API_BASE + (post.authorAvatar || '/avatar.png')}" class="forum-avatar" loading="lazy">
                <div>
                    <div class="forum-author">${post.authorName} ${getRoleBadgeHtml(authorRole)}</div>
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
        const rRole = reply.authorRole || 'member';
        html += `
            <div class="reply-bubble">
                <img src="${reply.authorAvatar && reply.authorAvatar.startsWith('http') ? reply.authorAvatar : API_BASE + (reply.authorAvatar || '/avatar.png')}" class="forum-avatar" loading="lazy">
                <div class="reply-content-box">
                    <div class="reply-header">
                        <div class="forum-author">${reply.authorName} ${getRoleBadgeHtml(rRole)}</div>
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
    container.innerHTML = getLoadingHTML('Loading presets...');

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
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <a href="#leaderboard" class="btn-premium-prime" style="line-height: 1;">
                            <svg class="prime-icon" width="14" height="14" viewBox="0 0 24 24" style="vertical-align: middle;">
                                <defs>
                                    <linearGradient id="prime-trophy-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="#ffffff" />
                                        <stop offset="100%" stop-color="#d8b4fe" />
                                    </linearGradient>
                                </defs>
                                <path d="M3 4c0 0 0 8 9 8s9-8 9-8H3zm5 12c0-2 8-2 8 0v2H8v-2z" fill="url(#prime-trophy-grad)" />
                            </svg>
                            <span class="prime-text">Leaderboard</span>
                        </a>
                        <a href="#${otherHash}" class="preset-hub-switch-btn">${otherLabel}</a>
                    </div>
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

            const previewUrl = preset.previewUrl || '';
            let previewHtml = '';
            if (previewUrl) {
                const ytId = getYouTubeId(previewUrl);
                if (ytId) {
                    const presetIndex = preset.id;
                    previewHtml = `
                        <div class="preset-preview-container" id="preset-preview-${presetIndex}" onclick="playYouTubeEmbed('${ytId}', 'preset-preview-${presetIndex}')">
                            <img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" alt="${safeTitle}" class="preset-preview-media">
                            <div class="preset-play-overlay">
                                <div class="play-btn-circle small">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 1px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (previewUrl.match(/\.(mp4|webm|ogg)/i) || (previewUrl.includes('res.cloudinary.com') && previewUrl.includes('/video/upload/'))) {
                    previewHtml = `
                        <div class="preset-preview-container">
                            <video src="${previewUrl}" class="preset-preview-media" autoplay muted loop playsinline></video>
                        </div>
                    `;
                } else {
                    previewHtml = `
                        <div class="preset-preview-container">
                            <img src="${previewUrl}" alt="${safeTitle}" class="preset-preview-media" loading="lazy">
                        </div>
                    `;
                }
            }

            html += `
                <div class="preset-card cat-${catClass}">
                    ${previewHtml}
                    <div class="preset-card-inner">
                        <div class="preset-badge-row">
                            <span class="preset-badge ${badgeClass}">${preset.category}</span>
                            <span class="preset-badge platform ${platClass}">${preset.platform}</span>
                        </div>
                        <h3 class="preset-title">${safeTitle}</h3>
                        <p class="preset-desc">${safeDesc}</p>
                        <div class="preset-author-section">
                            <img src="${preset.authorAvatar && preset.authorAvatar.startsWith('http') ? preset.authorAvatar : API_BASE + (preset.authorAvatar || '/avatar.png')}" class="preset-author-avatar" loading="lazy">
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
    document.getElementById('presetUploadPreviewUrl').value = '';
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
    const previewUrl = document.getElementById('presetUploadPreviewUrl').value.trim();
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
    formData.append('previewUrl', previewUrl);

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

function makeCustomSelectHTML(selectId, options, currentValue, onChangeAttr) {
    const currentOption = options.find(opt => opt.value === currentValue) || options[0];
    const triggerText = currentOption ? currentOption.label : '';
    
    let optionsHtml = '';
    options.forEach(opt => {
        const isSelected = opt.value === currentValue ? 'selected' : '';
        optionsHtml += `
            <div class="custom-select-option ${isSelected}" data-value="${opt.value}" 
                 onclick="selectCustomOption('${selectId}', '${opt.value}', \`${opt.label.replace(/'/g, "\\'")}\`)">
                ${opt.label}
            </div>
        `;
    });
    
    return `
        <div class="custom-select-wrapper" id="wrapper-${selectId}">
            <select id="${selectId}" style="display: none;" ${onChangeAttr}>
                ${options.map(opt => `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
            <div class="custom-select-trigger" onclick="toggleCustomSelect('wrapper-${selectId}')">
                <span class="custom-select-text">${triggerText}</span>
                <svg class="custom-select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="custom-select-options">
                ${optionsHtml}
            </div>
        </div>
    `;
}

function toggleCustomSelect(wrapperId) {
    const el = document.getElementById(wrapperId);
    if (!el) return;
    
    // Close other dropdowns
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        if (wrapper.id !== wrapperId) {
            wrapper.classList.remove('active');
        }
    });
    
    el.classList.toggle('active');
}

function selectCustomOption(selectId, value, labelText) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    
    selectEl.value = value;
    
    // Update trigger text
    const wrapper = document.getElementById('wrapper-' + selectId);
    if (wrapper) {
        const textEl = wrapper.querySelector('.custom-select-text');
        if (textEl) textEl.textContent = labelText;
        
        // Update selected class
        wrapper.querySelectorAll('.custom-select-option').forEach(opt => {
            if (opt.getAttribute('data-value') === value) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
        
        wrapper.classList.remove('active');
    }
    
    // Trigger onchange event
    const event = new Event('change', { bubbles: true });
    selectEl.dispatchEvent(event);
}

function syncCustomSelect(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    const value = selectEl.value;
    const wrapper = document.getElementById('wrapper-' + selectId);
    if (wrapper) {
        const option = selectEl.querySelector(`option[value="${value}"]`);
        const labelText = option ? option.textContent : value;
        
        const textEl = wrapper.querySelector('.custom-select-text');
        if (textEl) textEl.textContent = labelText;
        
        wrapper.querySelectorAll('.custom-select-option').forEach(opt => {
            if (opt.getAttribute('data-value') === value) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    }
}

// Global click listener to close custom dropdowns
document.addEventListener('click', (e) => {
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('active');
        }
    });
});

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
                            ${makeCustomSelectHTML('ratioPreset', [
                                { value: '1920x1080', label: '16:9 Full HD (1920 x 1080)' },
                                { value: '1080x1920', label: '9:16 Vertical TikTok (1080 x 1920)' },
                                { value: '1080x1080', label: '1:1 Square (1080 x 1080)' },
                                { value: '1080x1350', label: '4:5 Instagram Portrait (1080 x 1350)' },
                                { value: '1920x803', label: '2.39:1 CinemaScope (1920 x 803)' },
                                { value: 'custom', label: 'Custom Resolution' }
                            ], '1920x1080', 'onchange="applyRatioPreset(this.value)"')}
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
                            ${makeCustomSelectHTML('ratioOverlay', [
                                { value: 'none', label: 'None (Clean Output)' },
                                { value: 'safe90', label: '90% Action Safe Zone' },
                                { value: 'safe80', label: '80% Title Safe Zone' },
                                { value: 'thirds', label: 'Rule of Thirds Grid' },
                                { value: 'social', label: '9:16 Center Safe (for 16:9 videos)' },
                                { value: 'tiktok', label: 'TikTok / Reels UI Overlay (9:16)' }
                            ], 'none', 'onchange="drawRatioVisualizer()"')}
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
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label>Resolution</label>
                                ${makeCustomSelectHTML('calcResolution', [
                                    { value: '1080p', label: '1080p Full HD' },
                                    { value: '4K', label: '4K UHD' },
                                    { value: '8K', label: '8K UHD' }
                                ], '1080p', 'onchange="recalcBitrate()"')}
                            </div>
                            <div class="form-group">
                                <label>Framerate (FPS)</label>
                                ${makeCustomSelectHTML('calcFps', [
                                    { value: '23.976', label: '23.976 fps' },
                                    { value: '24', label: '24 fps (Cinema)' },
                                    { value: '25', label: '25 fps (PAL)' },
                                    { value: '29.97', label: '29.97 fps' },
                                    { value: '30', label: '30 fps' },
                                    { value: '50', label: '50 fps' },
                                    { value: '59.94', label: '59.94 fps' },
                                    { value: '60', label: '60 fps' }
                                ], '30', 'onchange="recalcBitrate()"')}
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Video Codec</label>
                            ${makeCustomSelectHTML('calcCodec', [
                                { value: 'H.264', label: 'H.264 / AVC (Standard Web)' },
                                { value: 'HEVC', label: 'H.265 / HEVC (Highly Compressed)' },
                                { value: 'ProRes422HQ', label: 'Apple ProRes 422 HQ (Editing)' },
                                { value: 'ProRes4444', label: 'Apple ProRes 4444 (Mastering / Alpha)' },
                                { value: 'DNxHR', label: 'Avid DNxHR HQ (Editing)' },
                                { value: 'REDCODE', label: 'REDCODE RAW 8:1 (Cinema)' },
                                { value: 'custom', label: 'Custom Bitrate...' }
                            ], 'H.264', 'onchange="recalcBitrate()"')}
                        </div>
                        <div class="form-group">
                            <div class="bitrate-display">
                                <label>Target Bitrate</label>
                                <span class="bitrate-value-pill" id="bitrateVal">10 Mbps</span>
                            </div>
                            <input type="range" id="sizeBitrate" min="1" max="1000" value="10" class="form-control" oninput="updateSizeBitrate(this.value, true)">
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
                            <div class="calc-output-val" id="sizeOutput">750 MB</div>
                            <div class="calc-output-desc" id="dataRateVal">Data Rate: ~1.25 MB/s</div>
                            <div class="calc-output-desc" style="margin-top: 12px; font-size: 11px; opacity: 0.7;">Actual compression sizes vary. Audio tracks not included.</div>
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
                            ${makeCustomSelectHTML('timecodeFps', [
                                { value: '23.976', label: '23.976 fps (Film)' },
                                { value: '24', label: '24 fps (Standard Cinema)' },
                                { value: '25', label: '25 fps (PAL / Europe)' },
                                { value: '29.97', label: '29.97 fps (NTSC Broadcast)' },
                                { value: '30', label: '30 fps (Standard Web)' },
                                { value: '50', label: '50 fps (High Rate PAL)' },
                                { value: '59.94', label: '59.94 fps (High Rate Broadcast)' },
                                { value: '60', label: '60 fps (Gaming / High FPS)' }
                            ], '30', 'onchange="convertTimecodeFields(\'timecode\')"')}
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
    recalcBitrate();
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
    syncCustomSelect('ratioPreset');
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
    
    let cropText = '';
    if (width / height > 9 / 16) {
        // Wider than 9:16, show vertical crop offset (9:16 vertical crop)
        const vCropW = Math.round(height * (9 / 16));
        const margin = Math.round((width - vCropW) / 2);
        cropText = `<div style="font-size: 11px; color: #a78bfa; margin-top: 6px; font-weight: 500;">
            TikTok Crop: <strong>${vCropW} x ${height}</strong> (Crop ${margin}px off left/right sides)
        </div>`;
    } else if (width / height < 9 / 16) {
        // Narrower than 9:16, show top/bottom margins
        const vCropH = Math.round(width / (9 / 16));
        const margin = Math.round((height - vCropH) / 2);
        cropText = `<div style="font-size: 11px; color: #a78bfa; margin-top: 6px; font-weight: 500;">
            TikTok Fit: <strong>${width} x ${vCropH}</strong> (Crop ${margin}px off top/bottom sides)
        </div>`;
    }
    
    results.innerHTML = `Aspect Ratio: <span>${ratioText}</span> (${width} x ${height})${cropText}`;

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
    } else if (overlay === 'tiktok') {
        let rectX = x;
        let rectY = y;
        let rectW = boxW;
        let rectH = boxH;

        const targetRatio = 9 / 16;
        if (customRatio > targetRatio) {
            rectW = boxH * targetRatio;
            rectX = x + (boxW - rectW) / 2;
            svgHtml += `
                <rect x="${x}" y="${y}" width="${rectX - x}" height="${boxH}" fill="#000" opacity="0.65"></rect>
                <rect x="${rectX + rectW}" y="${y}" width="${x + boxW - (rectX + rectW)}" height="${boxH}" fill="#000" opacity="0.65"></rect>
            `;
        } else {
            rectH = boxW / targetRatio;
            rectY = y + (boxH - rectH) / 2;
            svgHtml += `
                <rect x="${x}" y="${y}" width="${boxW}" height="${rectY - y}" fill="#000" opacity="0.65"></rect>
                <rect x="${x}" y="${rectY + rectH}" width="${boxW}" height="${y + boxH - (rectY + rectH)}" fill="#000" opacity="0.65"></rect>
            `;
        }

        svgHtml += `
            <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="none" stroke="#ef4444" stroke-width="0.8" opacity="0.8"></rect>
        `;

        const rightAlign = rectX + rectW - 6;
        const startY = rectY + rectH * 0.4;
        const gapY = rectH * 0.085;
        const leftAlign = rectX + 5;
        const bottomY = rectY + rectH - 18;

        svgHtml += `
            <!-- Top Tabs -->
            <text x="${rectX + rectW/2}" y="${rectY + 8}" fill="#ffffff" font-size="3" font-weight="700" text-anchor="middle" opacity="0.8">Following  |  For You</text>
            
            <!-- Profile circle -->
            <circle cx="${rightAlign}" cy="${startY}" r="3.2" fill="#ffffff" opacity="0.9"></circle>
            <circle cx="${rightAlign}" cy="${startY}" r="2" fill="#6622ba"></circle>
            
            <!-- Heart (Like) -->
            <path d="M ${rightAlign} ${startY + gapY - 1} C ${rightAlign - 2.5} ${startY + gapY - 3} ${rightAlign - 2.5} ${startY + gapY} ${rightAlign} ${startY + gapY + 2} C ${rightAlign + 2.5} ${startY + gapY} ${rightAlign + 2.5} ${startY + gapY - 3} ${rightAlign} ${startY + gapY - 1}" fill="#ef4444" opacity="0.9"></path>
            <text x="${rightAlign}" y="${startY + gapY + 3.5}" fill="#ffffff" font-size="2" text-anchor="middle" font-weight="700" opacity="0.9">124K</text>
            
            <!-- Comment -->
            <circle cx="${rightAlign}" cy="${startY + gapY * 2}" r="2.2" fill="#ffffff" opacity="0.9"></circle>
            <path d="M ${rightAlign - 1} ${startY + gapY * 2 + 1} L ${rightAlign - 2} ${startY + gapY * 2 + 3} L ${rightAlign} ${startY + gapY * 2 + 1.8}" fill="#ffffff" opacity="0.9"></path>
            <text x="${rightAlign}" y="${startY + gapY * 2 + 4.5}" fill="#ffffff" font-size="2" text-anchor="middle" font-weight="700" opacity="0.9">852</text>
            
            <!-- Bookmark -->
            <polygon points="${rightAlign - 1.5},${startY + gapY * 3 - 2} ${rightAlign + 1.5},${startY + gapY * 3 - 2} ${rightAlign + 1.5},${startY + gapY * 3 + 2} ${rightAlign},${startY + gapY * 3 + 0.8} ${rightAlign - 1.5},${startY + gapY * 3 + 2}" fill="#eab308" opacity="0.95"></polygon>
            <text x="${rightAlign}" y="${startY + gapY * 3 + 4.5}" fill="#ffffff" font-size="2" text-anchor="middle" font-weight="700" opacity="0.9">45K</text>
            
            <!-- Share -->
            <path d="M ${rightAlign - 1} ${startY + gapY * 4 + 1} C ${rightAlign - 1} ${startY + gapY * 4 + 1} ${rightAlign + 1} ${startY + gapY * 4 + 1} ${rightAlign + 1} ${startY + gapY * 4 - 1} L ${rightAlign} ${startY + gapY * 4 - 1} L ${rightAlign + 2} ${startY + gapY * 4 - 3} L ${rightAlign + 4} ${startY + gapY * 4 - 1} L ${rightAlign + 3} ${startY + gapY * 4 - 1} C ${rightAlign + 3} ${startY + gapY * 4 + 2} ${rightAlign - 1} ${startY + gapY * 4 + 2} ${rightAlign - 1} ${startY + gapY * 4 + 1}" fill="#ffffff" opacity="0.9"></path>
            <text x="${rightAlign}" y="${startY + gapY * 4 + 4.5}" fill="#ffffff" font-size="2" text-anchor="middle" font-weight="700" opacity="0.9">12K</text>

            <!-- Bottom Left Metadata -->
            <text x="${leftAlign}" y="${bottomY}" fill="#ffffff" font-size="3" font-weight="800" opacity="0.95">@editor_community</text>
            <text x="${leftAlign}" y="${bottomY + 4}" fill="#ffffff" font-size="2.5" opacity="0.85">Curated resources for video editors #editing</text>
            <text x="${leftAlign}" y="${bottomY + 8}" fill="#ffffff" font-size="2" opacity="0.75">♫ Original Sound - Editor Community</text>
        `;
    }

    svg.innerHTML = svgHtml;
}

// Size sub-logic
function getBitrateForConfig(resVal, codecVal, fpsVal) {
    const fps = Number(fpsVal) || 30;
    
    // Normalize FPS for rough estimation tiers
    let fpsFactor = fps / 24;
    
    if (codecVal === 'H.264') {
        const base = resVal === '1080p' ? 10 : (resVal === '4K' ? 40 : 80);
        return Math.round(base * (fps > 45 ? 1.5 : 1));
    }
    if (codecVal === 'HEVC') {
        const base = resVal === '1080p' ? 5 : (resVal === '4K' ? 20 : 40);
        return Math.round(base * (fps > 45 ? 1.5 : 1));
    }
    if (codecVal === 'ProRes422HQ') {
        const base = resVal === '1080p' ? 176 : (resVal === '4K' ? 707 : 2828);
        return Math.round(base * fpsFactor);
    }
    if (codecVal === 'ProRes4444') {
        const base = resVal === '1080p' ? 264 : (resVal === '4K' ? 1060 : 4240);
        return Math.round(base * fpsFactor);
    }
    if (codecVal === 'DNxHR') {
        const base = resVal === '1080p' ? 145 : (resVal === '4K' ? 580 : 2320);
        return Math.round(base * fpsFactor);
    }
    if (codecVal === 'REDCODE') {
        const base = resVal === '1080p' ? 35 : (resVal === '4K' ? 140 : 560);
        return Math.round(base * fpsFactor);
    }
    return 12; // default fallback
}

function recalcBitrate() {
    const res = document.getElementById('calcResolution').value;
    const codec = document.getElementById('calcCodec').value;
    const fps = document.getElementById('calcFps').value;
    
    if (codec === 'custom') return;
    
    const calculatedBitrate = getBitrateForConfig(res, codec, fps);
    updateSizeBitrate(calculatedBitrate, false);
}

function updateSizeBitrate(val, isUserSlide = false) {
    const pill = document.getElementById('bitrateVal');
    if (pill) pill.textContent = val + ' Mbps';
    
    const slider = document.getElementById('sizeBitrate');
    if (slider) {
        slider.value = val;
        const pct = ((val - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.setProperty('--range-progress', pct + '%');
    }
    
    if (isUserSlide) {
        const codecSelect = document.getElementById('calcCodec');
        if (codecSelect) {
            codecSelect.value = 'custom';
            syncCustomSelect('calcCodec');
        }
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
    const dataRateVal = document.getElementById('dataRateVal');
    if (!sizeOutput) return;

    const formatNum = (n) => {
        if (n >= 1000) return n.toFixed(1);
        if (n >= 100) return Math.round(n).toString();
        return n.toFixed(1);
    };

    if (totalMegabytes >= 1024 * 1024) {
        sizeOutput.textContent = `${formatNum(totalMegabytes / (1024 * 1024))} TB`;
    } else if (totalMegabytes >= 1024) {
        sizeOutput.textContent = `${formatNum(totalMegabytes / 1024)} GB`;
    } else {
        sizeOutput.textContent = `${formatNum(totalMegabytes)} MB`;
    }

    if (dataRateVal) {
        const dataRateMBs = bitrate / 8;
        if (dataRateMBs >= 1024) {
            dataRateVal.innerHTML = `Data Rate: <strong>${formatNum(dataRateMBs / 1024)} GB/s</strong> (${bitrate} Mbps)`;
        } else {
            dataRateVal.innerHTML = `Data Rate: <strong>${formatNum(dataRateMBs)} MB/s</strong> (${bitrate} Mbps)`;
        }
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

function getLoadingHTML(text = 'Loading...') {
    return `
        <div class="spinner-container">
            <div class="spinner"></div>
            <div class="spinner-text">${text}</div>
        </div>
    `;
}

function getSoftwareClass(software) {
    if (!software) return '';
    const name = software.toLowerCase();
    if (name.includes('after') || name.includes('ae')) return 'ae';
    if (name.includes('premiere') || name.includes('pr')) return 'pr';
    if (name.includes('davinci') || name.includes('resolve')) return 'davinci';
    if (name.includes('blender')) return 'blender';
    if (name.includes('photoshop') || name.includes('ps')) return 'ps';
    if (name.includes('capcut')) return 'capcut';
    if (name.includes('alight')) return 'alight';
    if (name.includes('vn')) return 'vn';
    if (name.includes('inshot')) return 'inshot';
    return '';
}

function getYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function renderUsefulTutorials() {
    const container = document.getElementById('content-container');
    const pageData = data['useful-tutorials'] || {};
    const tutorials = pageData.downloadLinks || [];

    // Toggle centered layout
    container.classList.remove('intro-centered');

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-path') === 'useful-tutorials') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    let wrapper = document.getElementById('tutorials-page-wrapper');
    if (!wrapper) {
        let html = `
            <div id="tutorials-page-wrapper">
                <div class="preset-hub-hero">
                    <span class="preset-hub-platform-pill pc" style="background: rgba(102, 34, 186, 0.25); color: #c4b5fd; border: 1px solid rgba(196, 181, 253, 0.2);">Tutorial Directory</span>
                    <h1>Master Your Craft</h1>
                    <p style="color: rgba(255,255,255,0.75); font-size: 14px; margin-top: 6px;">Handpicked, high-quality video tutorials to level up your editing, visual effects, and design skills.</p>
                </div>
                
                <div class="preset-controls-bar">
                    <div class="preset-search-box">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
                        <input type="text" id="tutorial-search-input" placeholder="Search tutorials...">
                    </div>
                    <div class="preset-filters-bar" id="tutorial-category-filters">
                        <!-- Dynamic filter buttons -->
                    </div>
                </div>

                <div id="tutorials-grid-container">
                    <!-- Dynamic tutorial cards -->
                </div>
            </div>
        `;
        container.innerHTML = html;
        wrapper = document.getElementById('tutorials-page-wrapper');

        const searchInput = document.getElementById('tutorial-search-input');
        searchInput.addEventListener('input', () => {
            updateFilteredTutorials(tutorials);
        });
    }

    // Populate category filters
    const categories = ['All', ...new Set(tutorials.map(item => item.quality || 'General').filter(Boolean))];
    const filtersBar = document.getElementById('tutorial-category-filters');
    
    if (!filtersBar.dataset.activeCategory) {
        filtersBar.dataset.activeCategory = 'All';
    }

    filtersBar.innerHTML = categories.map(cat => {
        const isActive = filtersBar.dataset.activeCategory === cat;
        return `
            <button class="preset-filter-btn ${isActive ? 'active' : ''}" data-category="${cat}">
                ${cat}
            </button>
        `;
    }).join('');

    filtersBar.querySelectorAll('.preset-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filtersBar.querySelectorAll('.preset-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtersBar.dataset.activeCategory = btn.dataset.category;
            updateFilteredTutorials(tutorials);
        });
    });

    updateFilteredTutorials(tutorials);
    injectBookmarkStars();
}

function updateFilteredTutorials(tutorials) {
    const searchInput = document.getElementById('tutorial-search-input');
    const filtersBar = document.getElementById('tutorial-category-filters');
    const gridContainer = document.getElementById('tutorials-grid-container');
    if (!gridContainer) return;

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const activeCategory = filtersBar ? filtersBar.dataset.activeCategory : 'All';

    const filtered = tutorials.filter(item => {
        const matchesSearch = (item.label || '').toLowerCase().includes(query) ||
                              (item.quality || '').toLowerCase().includes(query);
        const matchesCategory = activeCategory === 'All' || (item.quality || 'General') === activeCategory;
        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        gridContainer.innerHTML = `<div class="bookmarks-empty" style="margin-top: 40px; text-align: center; width: 100%;">No tutorials match your search or filter criteria.</div>`;
        return;
    }

    let html = `
        <div class="tutorials-grid stagger-in" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; margin-top: 20px;">
    `;

    filtered.forEach((item, index) => {
        const label = item.label || 'Tutorial Video';
        const software = item.quality || 'General';
        const duration = item.size || 'Video';
        const url = item.url || '#';
        const videoId = getYouTubeId(url);
        const softwareClass = getSoftwareClass(software);

        if (videoId) {
            html += `
                <div class="tutorial-card cat-${softwareClass}">
                    <div class="tutorial-player-container" id="yt-player-container-${index}" onclick="playYouTubeEmbed('${videoId}', 'yt-player-container-${index}')">
                        <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${label}" class="tutorial-thumbnail">
                        <div class="tutorial-duration-badge">${duration}</div>
                        <div class="tutorial-play-overlay">
                            <div class="play-btn-circle">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </div>
                        </div>
                    </div>
                    <div class="tutorial-info">
                        <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
                            <span class="preset-badge platform ${softwareClass}">${software}</span>
                        </div>
                        <h3 class="tutorial-card-title">${label}</h3>
                        <div style="margin-top: auto; display: flex; gap: 10px; width: 100%;">
                            <a href="${url}" target="_blank" class="tutorial-watch-btn">
                                Watch on YouTube
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 2px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="dlink-card" style="margin-bottom: 0;">
                    <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 24px; color: #111;">${label}</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="preset-badge platform ${softwareClass}">${software}</span>
                        <a href="${url}" target="_blank" class="preset-download-btn">Open Link</a>
                    </div>
                </div>
            `;
        }
    });

    html += `</div>`;
    gridContainer.innerHTML = html;
}

function playYouTubeEmbed(videoId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" style="width: 100%; height: 100%; border: none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    `;
}

// Creator Profiles & Leaderboard logic
async function renderLeaderboard() {
    const container = document.getElementById('content-container');
    container.innerHTML = getLoadingHTML('Loading leaderboard...');

    // Toggle centered layout
    container.classList.remove('intro-centered');

    // Update active nav links (remove active from all sidebar links)
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const allPresets = await fetchPresets();

    // Group presets by author
    const creatorsMap = {};
    allPresets.forEach(preset => {
        const authorId = preset.authorId || 'anonymous';
        const authorName = preset.authorName || 'Anonymous';
        const authorAvatar = preset.authorAvatar || 'https://api.dicebear.com/6.x/initials/svg?seed=Anon';
        
        if (!creatorsMap[authorName]) {
            creatorsMap[authorName] = {
                authorId: authorId,
                authorName: authorName,
                authorAvatar: authorAvatar,
                totalPresets: 0,
                totalLikes: 0,
                totalDownloads: 0,
                presets: []
            };
        }
        
        creatorsMap[authorName].totalPresets += 1;
        creatorsMap[authorName].totalLikes += preset.upvotes ? preset.upvotes.length : 0;
        creatorsMap[authorName].totalDownloads += preset.downloadsCount || 0;
        creatorsMap[authorName].presets.push(preset);
    });

    const creators = Object.values(creatorsMap);

    // Sort creators by totalLikes desc, then totalDownloads desc
    creators.sort((a, b) => b.totalLikes - a.totalLikes || b.totalDownloads - a.totalDownloads);

    let html = `
        <div id="leaderboard-page-wrapper">
            <div class="preset-hub-hero" style="background: linear-gradient(135deg, #160a2b, #220f40); border: 1px solid rgba(139, 92, 246, 0.2); box-shadow: 0 10px 30px rgba(139, 92, 246, 0.08);">
                <span class="btn-premium-prime" style="pointer-events: none; border-radius: 20px; padding: 6px 14px; font-size: 11.5px; border-width: 1px; box-shadow: 0 0 8px rgba(139,92,246,0.2); margin-bottom: 12px; line-height: 1; align-self: flex-start; max-width: max-content;">
                    <svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 4px;">
                        <defs>
                            <linearGradient id="prime-trophy-grad-badge" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#ffffff" />
                                <stop offset="100%" stop-color="#d8b4fe" />
                            </linearGradient>
                        </defs>
                        <path d="M3 4c0 0 0 8 9 8s9-8 9-8H3zm5 12c0-2 8-2 8 0v2H8v-2z" fill="url(#prime-trophy-grad-badge)" />
                    </svg>
                    <span class="prime-text" style="font-size: 11px;">Contributor Standings</span>
                </span>
                <h1>Community Leaderboard</h1>
                <p style="color: rgba(255,255,255,0.75); font-size: 14px; margin-top: 6px;">Recognizing top preset creators, tools contributors, and asset builders in the Editors Community.</p>
            </div>
            
            <div class="leaderboard-table-container stagger-in" style="margin-top: 30px; background: var(--modal-bg); border-radius: 16px; border: 1px solid var(--card-border); padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); overflow-x: auto;">
                <table class="leaderboard-table" style="width: 100%; border-collapse: collapse; text-align: left; min-width: 500px;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--sidebar-border); color: var(--text-secondary); font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                            <th style="padding: 12px 16px; width: 80px; text-align: center;">Rank</th>
                            <th style="padding: 12px 16px;">Creator</th>
                            <th style="padding: 12px 16px; text-align: center;">Presets Shared</th>
                            <th style="padding: 12px 16px; text-align: center;">Total Upvotes</th>
                            <th style="padding: 12px 16px; text-align: center;">Downloads</th>
                            <th style="padding: 12px 16px; text-align: center;">Portfolio</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (creators.length === 0) {
        html += `
            <tr>
                <td colspan="6" style="padding: 40px; text-align: center; color: var(--text-secondary);">No presets shared yet. Be the first to share one!</td>
            </tr>
        `;
    } else {
        creators.forEach((c, idx) => {
            const rank = idx + 1;
            let rankHtml = '';
            if (rank === 1) {
                rankHtml = '<span class="rank-badge gold" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #fef08a; color: #854d0e; font-weight: 800; border: 2.5px solid #eab308; box-shadow: 0 4px 10px rgba(234,179,8,0.25);">1</span>';
            } else if (rank === 2) {
                rankHtml = '<span class="rank-badge silver" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #e2e8f0; color: #475569; font-weight: 800; border: 2.5px solid #cbd5e1; box-shadow: 0 4px 10px rgba(203,213,225,0.25);">2</span>';
            } else if (rank === 3) {
                rankHtml = '<span class="rank-badge bronze" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #ffedd5; color: #9a3412; font-weight: 800; border: 2.5px solid #fdba74; box-shadow: 0 4px 10px rgba(253,186,116,0.25);">3</span>';
            } else {
                rankHtml = `<span style="font-weight: 700; color: var(--text-secondary); font-size: 14px;">${rank}</span>`;
            }

            html += `
                <tr style="border-bottom: 1px solid var(--sidebar-border); transition: background-color 0.2s;" class="leaderboard-row">
                    <td style="padding: 16px; text-align: center; vertical-align: middle;">${rankHtml}</td>
                    <td style="padding: 16px; vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="openCreatorProfile('${encodeURIComponent(c.authorName)}')">
                            <img src="${c.authorAvatar}" alt="${c.authorName}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--sidebar-border);">
                            <div>
                                <div style="font-weight: 700; color: var(--text-primary); font-size: 14.5px;">${c.authorName}</div>
                                <div style="font-size: 11.5px; color: var(--text-secondary);">Community Editor</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 16px; text-align: center; font-weight: 600; color: var(--text-primary); font-size: 14px; vertical-align: middle;">${c.totalPresets}</td>
                    <td style="padding: 16px; text-align: center; font-weight: 600; color: #ec4899; font-size: 14px; vertical-align: middle;">
                        <div style="display: inline-flex; align-items: center; gap: 4px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="color: #ec4899;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            ${c.totalLikes}
                        </div>
                    </td>
                    <td style="padding: 16px; text-align: center; font-weight: 600; color: #a855f7; font-size: 14px; vertical-align: middle;">${c.totalDownloads}</td>
                    <td style="padding: 16px; text-align: center; vertical-align: middle;">
                        <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-color: rgba(102, 34, 186, 0.15); color: var(--red-brand);" onclick="openCreatorProfile('${encodeURIComponent(c.authorName)}')">
                            View Profile
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

async function openCreatorProfile(encodedUsername) {
    const username = decodeURIComponent(encodedUsername);
    const modal = document.getElementById('creatorProfileModal');
    
    // Reset fields to loading placeholders
    document.getElementById('creatorFullName').textContent = username;
    document.getElementById('creatorUsername').textContent = username;
    document.getElementById('creatorBio').textContent = 'Loading profile details...';
    document.getElementById('creatorPic').src = 'https://api.dicebear.com/6.x/initials/svg?seed=' + username;
    document.getElementById('creatorBanner').src = '';
    document.getElementById('creatorStatPresets').textContent = '-';
    document.getElementById('creatorStatLikes').textContent = '-';
    document.getElementById('creatorStatDownloads').textContent = '-';
    document.getElementById('creatorPortfolioGrid').innerHTML = getLoadingHTML('Loading portfolio...');
    
    modal.classList.add('active');

    let publicProfile = null;
    try {
        const response = await fetch(API_BASE + `/api/users/public/${username}`);
        if (response.ok) {
            const resData = await response.json();
            if (resData.success) {
                publicProfile = resData.user;
            }
        }
    } catch (e) {
        console.warn('Could not fetch public profile from server, using aggregated presets metadata:', e);
    }

    const allPresets = await fetchPresets();
    const creatorPresets = allPresets.filter(p => p.authorName === username);

    const totalPresets = creatorPresets.length;
    let totalLikes = 0;
    let totalDownloads = 0;

    creatorPresets.forEach(p => {
        totalLikes += p.upvotes ? p.upvotes.length : 0;
        totalDownloads += p.downloadsCount || 0;
    });

    // Populate profile details
    if (publicProfile) {
        document.getElementById('creatorFullName').textContent = publicProfile.name || username;
        document.getElementById('creatorBio').textContent = publicProfile.bio || 'This editor has not added a bio yet.';
        if (publicProfile.profilePic) {
            document.getElementById('creatorPic').src = publicProfile.profilePic;
        }
        if (publicProfile.profileBanner) {
            document.getElementById('creatorBanner').src = publicProfile.profileBanner;
        }
    } else {
        document.getElementById('creatorFullName').textContent = username;
        document.getElementById('creatorBio').textContent = 'Community Preset Contributor.';
    }

    document.getElementById('creatorStatPresets').textContent = totalPresets;
    document.getElementById('creatorStatLikes').textContent = totalLikes;
    document.getElementById('creatorStatDownloads').textContent = totalDownloads;

    // Render presets list in profile modal
    const grid = document.getElementById('creatorPortfolioGrid');
    if (creatorPresets.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-secondary);">No presets shared yet.</div>';
    } else {
        grid.innerHTML = creatorPresets.map(preset => {
            const likesCount = preset.upvotes ? preset.upvotes.length : 0;
            const downloads = preset.downloadsCount || 0;
            
            return `
                <div class="preset-card" style="border: 1px solid var(--sidebar-border); background: var(--sidebar-bg); border-radius: 12px; overflow: hidden; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${preset.title}">${preset.title}</div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 30px;">${preset.description}</div>
                    <div style="margin-top: auto; display: flex; align-items: center; justify-content: space-between;">
                        <span class="preset-badge platform ${preset.platform === 'Other' ? 'pc' : preset.platform.toLowerCase().replace(' ', '')}" style="font-size: 9.5px; padding: 3px 6px;">${preset.platform}</span>
                        <div style="display: flex; gap: 8px; font-size: 11px; color: var(--text-secondary); font-weight: 700;">
                            <span style="display: flex; align-items: center; gap: 2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="color: #ec4899;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>${likesCount}</span>
                            <span style="display: flex; align-items: center; gap: 2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #a855f7;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${downloads}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

/* =============================================
   Showcase Video Feed & Comments Logic
   ============================================= */

async function fetchShowcases() {
    try {
        const res = await fetch(API_BASE + '/api/showcase');
        const data = await res.json();
        return data.success ? data.posts : [];
    } catch (e) {
        console.error("Error fetching showcases:", e);
        return [];
    }
}

function openShowcaseUploadModal() {
    openModal('showcasePostModal');
    document.getElementById('showcaseUploadTitle').value = '';
    document.getElementById('showcaseUploadDesc').value = '';
    document.getElementById('showcaseUploadVideoUrl').value = '';
    document.getElementById('showcaseUploadError').style.display = 'none';
}

async function handleShowcaseUpload() {
    const title = document.getElementById('showcaseUploadTitle').value.trim();
    const description = document.getElementById('showcaseUploadDesc').value.trim();
    const videoUrl = document.getElementById('showcaseUploadVideoUrl').value.trim();
    const err = document.getElementById('showcaseUploadError');
    const submitBtn = document.getElementById('showcaseSubmitBtn');

    if (!title || !description || !videoUrl) {
        err.textContent = "Title, description, and video URL are required.";
        err.style.display = 'block';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Posting...';

    const token = localStorage.getItem('userToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(API_BASE + '/api/showcase', {
            method: 'POST',
            headers,
            body: JSON.stringify({ title, description, videoUrl })
        });
        const d = await res.json();
        if (d.success) {
            closeModals();
            renderShowcase();
        } else {
            err.textContent = d.message;
            err.style.display = 'block';
        }
    } catch (e) {
        err.textContent = "Network error while uploading showcase post.";
        err.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Post Edit';
    }
}

async function likeShowcasePost(postId, btn) {
    if (!currentUser) {
        openModal('loginModal');
        return;
    }

    const token = localStorage.getItem('userToken');
    try {
        const res = await fetch(API_BASE + `/api/showcase/${postId}/like`, {
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
            btn.querySelector('.showcase-like-count').textContent = d.upvotes.length;
        }
    } catch (e) {
        console.error("Error liking showcase post:", e);
    }
}

function toggleShowcaseComments(postId) {
    const commentsSec = document.getElementById(`showcase-comments-${postId}`);
    if (commentsSec) {
        commentsSec.classList.toggle('open');
    }
}

async function submitShowcaseComment(postId, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    const token = localStorage.getItem('userToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(API_BASE + `/api/showcase/${postId}/comment`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content })
        });
        const d = await res.json();
        if (d.success) {
            input.value = '';
            
            // Remove 'no comments yet' text if present
            const commentsSec = document.getElementById(`showcase-comments-${postId}`);
            const noComments = commentsSec ? commentsSec.querySelector('.showcase-no-comments') : null;
            if (noComments) {
                noComments.remove();
            }

            // Refresh showcase comments list in-place
            const commentsList = document.getElementById(`showcase-comments-list-${postId}`);
            if (commentsList) {
                const comment = d.comment;
                const avatar = comment.authorAvatar;
                const bubble = document.createElement('div');
                bubble.className = 'showcase-comment-bubble';
                bubble.innerHTML = `
                    <img src="${avatar.startsWith('http') ? avatar : API_BASE + avatar}" class="showcase-comment-avatar">
                    <div class="showcase-comment-body">
                        <div class="showcase-comment-author">${comment.authorName}</div>
                        <div class="showcase-comment-text">${parseCommentTimestamps(comment.content, postId)}</div>
                    </div>
                `;
                commentsList.appendChild(bubble);
                commentsList.scrollTop = commentsList.scrollHeight;

                // Update comments count on card
                const countBadge = document.querySelector(`.showcase-comment-count[data-post-id="${postId}"]`);
                if (countBadge) {
                    const currentCount = parseInt(countBadge.textContent) || 0;
                    countBadge.textContent = currentCount + 1;
                }
            }
        }
    } catch (e) {
        console.error("Error submitting comment:", e);
    }
}

async function deleteShowcasePost(postId) {
    if (!confirm("Are you sure you want to delete this edit showcase post?")) return;

    const token = localStorage.getItem('userToken');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(API_BASE + `/api/showcase/${postId}`, {
            method: 'DELETE',
            headers
        });
        const d = await res.json();
        if (d.success) {
            renderShowcase();
        } else {
            alert(d.message);
        }
    } catch (e) {
        console.error("Error deleting showcase post:", e);
    }
}

function parseCommentTimestamps(content, postId) {
    if (!content) return '';
    // Matches MM:SS or HH:MM:SS format
    const regex = /\b(?:([0-5]?\d):)?([0-5]?\d):([0-5]\d)\b/g;
    return content.replace(regex, (match, hrs, mins, secs) => {
        let totalSeconds = 0;
        if (hrs !== undefined) {
            totalSeconds = parseInt(hrs) * 3600 + parseInt(mins) * 60 + parseInt(secs);
        } else {
            totalSeconds = parseInt(mins) * 60 + parseInt(secs);
        }
        return `<span class="timestamp-btn" onclick="seekShowcaseVideo('${postId}', ${totalSeconds})">${match}</span>`;
    });
}

function seekShowcaseVideo(postId, seconds) {
    // Try YouTube iframe
    const iframe = document.querySelector(`#showcase-video-${postId} iframe`);
    if (iframe) {
        if (iframe.src.includes('youtube.com')) {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'seekTo',
                args: [seconds, true]
            }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'playVideo',
                args: []
            }), '*');
        } else if (iframe.src.includes('vimeo.com')) {
            iframe.contentWindow.postMessage(JSON.stringify({
                method: 'seekTo',
                value: seconds
            }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({
                method: 'play'
            }), '*');
        }
    }

    // Try HTML5 video element
    const video = document.querySelector(`#showcase-video-${postId} video`);
    if (video) {
        video.currentTime = seconds;
        video.play();
    }
}

function getVimeoId(url) {
    if (!url) return null;
    const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|showcase\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
    const match = url.match(regExp);
    return match ? match[4] : null;
}

async function renderShowcase() {
    const container = document.getElementById('content-container');
    container.innerHTML = getLoadingHTML('Loading video edits...');

    // Toggle centered layout
    container.classList.remove('intro-centered');

    // Update active nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-path') === 'showcase') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    const posts = await fetchShowcases();

    let html = `
        <div class="preset-hub-hero" style="background: linear-gradient(135deg, #0e051a, #1b0735); border: 1px solid rgba(139, 92, 246, 0.15);">
            <div class="preset-hub-hero-content">
                <div>
                    <span class="preset-hub-platform-pill pc" style="background: rgba(139, 92, 246, 0.2); color: #d8b4fe;">Edit Feed</span>
                    <h1>Video Edits Showcase</h1>
                    <p>Share your edits, get peer reviews, and leave frame-by-frame timestamped feedback.</p>
                </div>
                <button class="preset-hub-share-btn" onclick="openShowcaseUploadModal()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Share Your Edit
                </button>
            </div>
        </div>
    `;

    if (posts.length === 0) {
        html += `<div style="text-align: center; padding: 60px; background: var(--card-bg); border: 1.5px solid var(--card-border); border-radius: 16px; color: var(--text-secondary);">No edits shared yet. Be the first to show off your work!</div>`;
        container.innerHTML = html;
        return;
    }

    html += `<div class="showcase-grid stagger-in">`;

    posts.forEach(post => {
        const dateStr = new Date(post.createdAt).toLocaleDateString();
        const safeTitle = post.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeDesc = post.description.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const isLiked = currentUser && post.upvotes && post.upvotes.includes(currentUser.id);
        const upvotesCount = post.upvotes ? post.upvotes.length : 0;
        const commentsCount = post.comments ? post.comments.length : 0;
        const authorRole = post.authorRole || 'member';

        // Render video embed based on platform
        let videoHtml = '';
        const ytId = getYouTubeId(post.videoUrl);
        const vimeoId = getVimeoId(post.videoUrl);

        if (ytId) {
            videoHtml = `<iframe src="https://www.youtube.com/embed/${ytId}?enablejsapi=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        } else if (vimeoId) {
            videoHtml = `<iframe src="https://player.vimeo.com/video/${vimeoId}?api=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        } else {
            // Direct video link fallback
            videoHtml = `<video src="${post.videoUrl}" controls playsinline></video>`;
        }

        const isAuthor = currentUser && (post.authorId === currentUser.id);

        html += `
            <div class="showcase-card">
                <div class="showcase-video-wrapper" id="showcase-video-${post.id}">
                    ${videoHtml}
                </div>
                <div class="showcase-card-body">
                    <h3 class="showcase-card-title">${safeTitle}</h3>
                    <p class="showcase-card-desc">${safeDesc}</p>
                </div>
                <div class="showcase-card-footer">
                    <div class="showcase-author-section">
                        <img src="${post.authorAvatar && post.authorAvatar.startsWith('http') ? post.authorAvatar : API_BASE + (post.authorAvatar || '/avatar.png')}" class="showcase-author-avatar" loading="lazy">
                        <div>
                            <div class="showcase-author-name">${post.authorName} ${getRoleBadgeHtml(authorRole)}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">${dateStr}</div>
                        </div>
                    </div>
                    <div class="showcase-actions">
                        <button class="showcase-action-btn ${isLiked ? 'liked' : ''}" onclick="likeShowcasePost('${post.id}', this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span class="showcase-like-count">${upvotesCount}</span>
                        </button>
                        <button class="showcase-action-btn" onclick="toggleShowcaseComments('${post.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span class="showcase-comment-count" data-post-id="${post.id}">${commentsCount}</span>
                        </button>
                        ${isAuthor || (currentUser && currentUser.username === 'admin') ? `
                            <button class="showcase-action-btn" style="color: #ef4444;" onclick="deleteShowcasePost('${post.id}')" title="Delete Post">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Comments Section -->
                <div class="showcase-comments-section" id="showcase-comments-${post.id}">
                    <div class="showcase-comments-list" id="showcase-comments-list-${post.id}">
                        ${post.comments && post.comments.length > 0 ? post.comments.map(c => {
                            const cAvatar = c.authorAvatar || 'https://api.dicebear.com/6.x/initials/svg?seed=Anon';
                            const cRole = c.authorRole || 'member';
                            return `
                                <div class="showcase-comment-bubble">
                                    <img src="${cAvatar.startsWith('http') ? cAvatar : API_BASE + cAvatar}" class="showcase-comment-avatar" loading="lazy">
                                    <div class="showcase-comment-body">
                                        <div class="showcase-comment-author">${c.authorName} ${getRoleBadgeHtml(cRole)}</div>
                                        <div class="showcase-comment-text">${parseCommentTimestamps(c.content, post.id)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('') : `<div style="text-align: center; font-size: 12px; color: var(--text-secondary); padding: 10px 0;" class="showcase-no-comments">No comments yet. Leave a review!</div>`}
                    </div>
                    <div class="showcase-comment-form">
                        <input type="text" class="showcase-comment-input" id="showcase-comment-input-${post.id}" placeholder="Type feedback... (Include time like 0:45)">
                        <button class="showcase-comment-submit" onclick="submitShowcaseComment('${post.id}', 'showcase-comment-input-${post.id}')">Submit</button>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}



// ==========================================
// NEW COMMUNITY FEATURES LOGIC
// ==========================================

// --- 1. GLOBAL SEARCH LOGIC ---
let searchDebounceTimeout = null;
async function performSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    if (!query || query.trim().length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Type to start searching...</div>';
        return;
    }

    if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
    
    searchDebounceTimeout = setTimeout(async () => {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Searching...</div>';
        try {
            const res = await fetch(API_BASE + '/api/search?q=' + encodeURIComponent(query));
            const data = await res.json();
            
            if (!data.success || data.results.length === 0) {
                resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">No results found.</div>';
                return;
            }

            let html = '';
            data.results.forEach(item => {
                let iconSvg = '';
                if (item.type === 'preset') iconSvg = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>';
                else if (item.type === 'showcase') iconSvg = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                else if (item.type === 'forum') iconSvg = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

                html += `
                    <a href="${item.route}" class="search-result-item" onclick="closeModal('searchModal')">
                        <div class="search-result-icon">${iconSvg}</div>
                        <div>
                            <div class="title">${item.title}</div>
                            <div class="meta">${item.type.charAt(0).toUpperCase() + item.type.slice(1)} • by ${item.authorName}</div>
                        </div>
                    </a>
                `;
            });
            resultsContainer.innerHTML = html;
        } catch (err) {
            resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Error performing search.</div>';
        }
    }, 300);
}

// --- 2. NOTIFICATIONS LOGIC ---
let unreadNotifsCount = 0;

async function fetchNotifications() {
    if (!currentUser) return;
    try {
        const res = await fetch(API_BASE + '/api/notifications', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        const data = await res.json();
        if (data.success) {
            renderNotifications(data.notifications);
        }
    } catch (err) {
        console.error('Failed to fetch notifications:', err);
    }
}

function renderNotifications(notifs) {
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    
    if (notifs.length === 0) {
        list.innerHTML = `
            <div class="notif-empty" style="padding: 30px; text-align: center; color: #64748b;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 10px;"><path stroke-linecap="round" stroke-linejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path stroke-linecap="round" stroke-linejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <p>No notifications yet</p>
            </div>`;
        badge.style.display = 'none';
        return;
    }

    unreadNotifsCount = notifs.filter(n => !n.read).length;
    if (unreadNotifsCount > 0) {
        badge.textContent = unreadNotifsCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    let html = '';
    notifs.forEach(n => {
        let iconSvg = '';
        if (n.type === 'like') iconSvg = '<svg width="18" height="18" fill="currentColor" stroke="none" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>';
        else if (n.type === 'reply' || n.type === 'comment') iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
        
        html += `
            <a href="${n.link}" class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
                <div class="notif-item-icon" style="${n.type === 'like' ? 'color: #ef4444; background: rgba(239, 68, 68, 0.1);' : ''}">${iconSvg}</div>
                <div class="notif-item-content">
                    <p>${n.message}</p>
                    <span class="notif-item-time">${new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
            </a>
        `;
    });
    list.innerHTML = html;
}

function toggleNotifPanel(e) {
    if (e) e.stopPropagation();
    document.getElementById('notifPanel').classList.toggle('active');
}
document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const bellBtn = document.getElementById('notifBellBtn');
    if (panel && panel.classList.contains('active') && !panel.contains(e.target) && !bellBtn.contains(e.target)) {
        panel.classList.remove('active');
    }
});

async function markNotifRead(id) {
    try {
        await fetch(API_BASE + '/api/notifications/' + id + '/read', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        fetchNotifications();
    } catch (err) {
        console.error(err);
    }
}
async function markAllNotifsRead() {
    try {
        await fetch(API_BASE + '/api/notifications/read-all', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        fetchNotifications();
    } catch (err) {
        console.error(err);
    }
}

// Check notifications every 30 seconds if logged in
setInterval(() => {
    if (currentUser) fetchNotifications();
}, 30000);

// --- 3. USER PROFILE LOGIC ---
async function renderProfile() {
    const container = document.getElementById('profileContainer');
    if (!currentUser) {
        container.innerHTML = '<div style="text-align:center; padding: 50px;"><h2>Please log in to view your profile.</h2></div>';
        return;
    }

    container.innerHTML = getLoadingHTML('Loading your profile...');

    try {
        // We will fetch user's own presets, showcase, and forum posts from the API
        const [presetsRes, showcaseRes, forumsRes] = await Promise.all([
            fetch(API_BASE + '/api/presets'),
            fetch(API_BASE + '/api/showcase'),
            fetch(API_BASE + '/api/forums')
        ]);
        
        const presets = (await presetsRes.json()).presets || [];
        const showcase = (await showcaseRes.json()).posts || [];
        const forums = (await forumsRes.json()).forums || [];

        const myPresets = presets.filter(p => p.authorId === currentUser.id);
        const myShowcase = showcase.filter(s => s.authorId === currentUser.id);
        const myForums = forums.filter(f => f.authorId === currentUser.id);

        let html = `
            <div class="profile-hero" style="${currentUser.profileBanner ? `background: linear-gradient(rgba(27,15,46,0.8), rgba(19,10,33,0.9)), url('${currentUser.profileBanner}') center/cover;` : ''}">
                <div class="profile-avatar-wrapper">
                    <img src="${currentUser.profilePic || 'https://api.dicebear.com/6.x/initials/svg?seed=' + currentUser.username}" alt="Profile">
                </div>
                <div>
                    <h1 style="font-size: 32px; margin-bottom: 5px;">${currentUser.username} ${getRoleBadgeHtml(currentUser.role)}</h1>
                    <p style="color: rgba(255,255,255,0.7); margin-bottom: 10px;">${currentUser.bio || 'No bio provided yet.'}</p>
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="openModal('profileModal')">Edit Profile</button>
                    
                    <div class="profile-stats">
                        <div class="stat-block">
                            <div class="num">${myPresets.length}</div>
                            <div class="label">Presets</div>
                        </div>
                        <div class="stat-block">
                            <div class="num">${myShowcase.length}</div>
                            <div class="label">Showcase</div>
                        </div>
                        <div class="stat-block">
                            <div class="num">${myForums.length}</div>
                            <div class="label">Forum Posts</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="profile-tabs">
                <div class="profile-tab active" id="tab-presets" onclick="switchProfileTab('presets')">My Presets</div>
                <div class="profile-tab" id="tab-showcase" onclick="switchProfileTab('showcase')">My Showcase</div>
                <div class="profile-tab" id="tab-forums" onclick="switchProfileTab('forums')">My Forum Posts</div>
            </div>
            
            <div id="profileTabContent">
                <!-- Preset Tab Content -->
                <div id="ptab-presets">
                    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 20px;">
                        <h3>Uploaded Presets</h3>
                        <button class="btn btn-primary" onclick="openModal('userUploadPresetModal')">Upload New Preset</button>
                    </div>
                    ${myPresets.length === 0 ? '<p style="color: #64748b;">You haven\'t uploaded any presets yet.</p>' : 
                        '<div class="preset-grid">' + myPresets.map(p => `
                            <div class="preset-card">
                                <h3>${p.title}</h3>
                                <p>${p.description}</p>
                                <a href="${p.platformType === 'mobile' ? '#presets-mobile' : '#presets-pc'}" class="btn btn-outline">View in Hub</a>
                            </div>
                        `).join('') + '</div>'
                    }
                </div>
                
                <div id="ptab-showcase" style="display:none;">
                    <h3>Showcase Uploads</h3>
                    ${myShowcase.length === 0 ? '<p style="color: #64748b;">You haven\'t posted anything to the showcase yet.</p>' : 
                        '<div class="preset-grid">' + myShowcase.map(s => `
                            <div class="preset-card">
                                <h3>${s.title}</h3>
                                <a href="#showcase" class="btn btn-outline">View Showcase</a>
                            </div>
                        `).join('') + '</div>'
                    }
                </div>
                
                <div id="ptab-forums" style="display:none;">
                    <h3>Forum Threads</h3>
                    ${myForums.length === 0 ? '<p style="color: #64748b;">You haven\'t posted any forum threads yet.</p>' : 
                        '<div class="forum-list">' + myForums.map(f => `
                            <div class="forum-post-card" onclick="window.location.hash='#forum-post-${f.id}'" style="cursor:pointer; margin-bottom:10px;">
                                <div class="forum-author-info">
                                    <div class="forum-author">${f.title}</div>
                                    <div class="forum-date">${new Date(f.createdAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                        `).join('') + '</div>'
                    }
                </div>
            </div>
        `;
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color:red; text-align:center;">Failed to load profile data.</div>';
    }
}

function switchProfileTab(tabName) {
    document.querySelectorAll('.profile-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    
    document.getElementById('ptab-presets').style.display = 'none';
    document.getElementById('ptab-showcase').style.display = 'none';
    document.getElementById('ptab-forums').style.display = 'none';
    
    document.getElementById('ptab-' + tabName).style.display = 'block';
}

// Hook into existing hash router
const originalHashChange = window.onhashchange;
window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash === '#profile') {
        document.querySelectorAll('.page-section').forEach(el => el.style.display = 'none');
        document.getElementById('profile').style.display = 'block';
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        const profileLink = document.getElementById('sidebarProfileLink');
        if (profileLink) profileLink.querySelector('a').classList.add('active');
        renderProfile();
    }
});

// Show/Hide sidebar profile link based on auth
function updateSidebarAuth() {
    const sidebarProfileLink = document.getElementById('sidebarProfileLink');
    if (sidebarProfileLink) {
        sidebarProfileLink.style.display = currentUser ? 'block' : 'none';
    }
}

// Modify updateAuthUI to trigger updateSidebarAuth and fetchNotifications
const originalUpdateAuthUI = updateAuthUI;
updateAuthUI = function() {
    originalUpdateAuthUI();
    updateSidebarAuth();
    if (currentUser) {
        fetchNotifications();
    }
}

// --- 4. USER UPLOAD PRESET LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const userPresetForm = document.getElementById('userUploadPresetForm');
    if (userPresetForm) {
        userPresetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('userPresetSubmitBtn');
            submitBtn.textContent = 'Uploading...';
            submitBtn.disabled = true;

            const formData = new FormData();
            formData.append('title', document.getElementById('userPresetTitle').value);
            formData.append('description', document.getElementById('userPresetDesc').value);
            formData.append('category', document.getElementById('userPresetCategory').value);
            formData.append('platform', 'Universal'); // Hardcoded default, can expand later
            formData.append('platformType', document.getElementById('userPresetPlatform').value);
            formData.append('previewUrl', document.getElementById('userPresetPreview').value || '');
            
            const fileInput = document.getElementById('userPresetFile');
            const externalUrl = document.getElementById('userPresetUrl').value;

            if (fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            } else if (externalUrl) {
                formData.append('externalUrl', externalUrl);
            } else {
                alert('Please upload a file or provide an external link.');
                submitBtn.textContent = 'Submit Preset';
                submitBtn.disabled = false;
                return;
            }

            try {
                const res = await fetch(API_BASE + '/api/presets', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    closeModal('userUploadPresetModal');
                    userPresetForm.reset();
                    if (window.location.hash === '#profile') renderProfile();
                    showToast('Preset uploaded successfully!');
                } else {
                    alert(data.message || 'Upload failed');
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred');
            } finally {
                submitBtn.textContent = 'Submit Preset';
                submitBtn.disabled = false;
            }
        });
    }
});
