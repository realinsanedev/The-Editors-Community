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
    const sections = document.querySelectorAll('.nav-section');
    sections.forEach(section => {
        const links = section.querySelectorAll('.nav-link');
        let visibleLinksCount = 0;
        links.forEach(link => {
            const path = link.getAttribute('data-path');
            if (path && path !== 'introduction' && path !== 'forum' && !data[path]) {
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
    try {
        // Try the API first, then fall back to loading data.json directly
        let response;
        try {
            response = await fetch(API_BASE + '/api/data');
        } catch(e) {
            // API not available, load data.json as a static file
            response = await fetch('./data.json');
        }
        if (!response.ok) {
            // API returned an error, try static file
            response = await fetch('./data.json');
        }
        if (!response.ok) throw new Error('Could not load data');
        data = await response.json();
        updateSidebarVisibility();
        setupSearch();
        renderPage();
        await checkAuthStatus();
    } catch (error) {
        document.getElementById('content-container').innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h2>Error Loading Data</h2>
                <p>Could not load website data. Please try refreshing.</p>
            </div>
        `;
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

    const pageData = data[hash];

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
    
    if (pageData.softwareGroups && pageData.softwareGroups.length > 0) {
        pageData.softwareGroups.forEach(group => {
            html += `<div class="software-group" style="margin-top: 30px; margin-bottom: 40px;">`;
            if (group.title) {
                const safeCat = group.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `<h3 class="software-group-title">${safeCat}</h3>`;
            }
            html += `<ul class="software-list">`;
            if (group.links) {
                group.links.forEach(link => {
                    const sLabel = link.label ? link.label.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Link';
                    const sUrl = link.url ? link.url.replace(/"/g, '&quot;') : '#';
                    const highlightStyle = link.isHighlighted ? 'color: #6622ba; border-bottom-color: #6622ba;' : '';
                    html += `<li><a href="${sUrl}" style="${highlightStyle}" target="_blank">${sLabel}</a></li>`;
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
                    <div class="download-links-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">`;
        
        pageData.downloadLinks.forEach(link => {
            // Encode the values for safety
            const sLabel = link.label ? link.label.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Download';
            const sQuality = link.quality ? link.quality.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            const sSize = link.size ? link.size.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            const sUrl = link.url ? link.url.replace(/"/g, '&quot;') : '#';

            html += `
                <a href="${sUrl}" target="_blank" class="dlink-card hover-lift" style="display: block; background: transparent; border: 1.5px solid #111; border-radius: 12px; padding: 24px; text-decoration: none; color: inherit; transition: all 0.2s;">
                    <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 24px; color: #111; font-family: 'Space Grotesk', sans-serif;">${sLabel}</h4>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748b;">
                        ${sQuality ? `<span style="background: #f1f5f9; padding: 6px 12px; border-radius: 8px; font-weight: 600;">${sQuality}</span>` : '<span></span>'}
                        ${sSize ? `<span style="background: #f1f5f9; padding: 6px 12px; border-radius: 8px; font-weight: 600;">${sSize}</span>` : '<span></span>'}
                    </div>
                </a>
            `;
        });
        
        html += `   </div>
                </div>
                <style>
                    .dlink-card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                        background: white !important;
                    }
                </style>`;
    }
    
    container.innerHTML = html;
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
    
    if (currentUser) {
        unauthSection.style.display = 'none';
        authSection.style.display = 'flex';
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
    } else {
        unauthSection.style.display = 'block';
        authSection.style.display = 'none';
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
        forums.forEach(post => {
            const dateStr = new Date(post.createdAt).toLocaleDateString();
            const safeTitle = post.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeContent = post.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            html += `
                <div class="forum-post-card" onclick="window.location.hash = 'forum-post-${post.id}'">
                    <div class="forum-post-header">
                        <img src="${post.authorAvatar.startsWith('http') ? post.authorAvatar : API_BASE + post.authorAvatar}" class="forum-avatar">
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
                <img src="${post.authorAvatar.startsWith('http') ? post.authorAvatar : API_BASE + post.authorAvatar}" class="forum-avatar">
                <div>
                    <div class="forum-author">${post.authorName}</div>
                    <div class="forum-date">${dateStr}</div>
                </div>
            </div>
            <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">${safeTitle}</h1>
            <div class="thread-content">${safeContent}</div>
            ${post.imageUrl ? `<img src="${post.imageUrl.startsWith('http') ? post.imageUrl : API_BASE + post.imageUrl}" class="thread-image">` : ''}
        </div>
        
        <div class="replies-section">
            <h3 style="margin-bottom: 24px; font-size: 20px;">${post.replies.length} Replies</h3>
    `;

    post.replies.forEach(reply => {
        const rDate = new Date(reply.createdAt).toLocaleString();
        const rContent = reply.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `
            <div class="reply-bubble">
                <img src="${reply.authorAvatar.startsWith('http') ? reply.authorAvatar : API_BASE + reply.authorAvatar}" class="forum-avatar">
                <div class="reply-content-box">
                    <div class="reply-header">
                        <div class="forum-author">${reply.authorName}</div>
                        <div class="forum-date">${rDate}</div>
                    </div>
                    <div class="reply-text">${rContent}</div>
                    ${reply.imageUrl ? `<img src="${reply.imageUrl.startsWith('http') ? reply.imageUrl : API_BASE + reply.imageUrl}" class="thread-image" style="max-width: 300px;">` : ''}
                </div>
            </div>
        `;
    });

    html += `
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

