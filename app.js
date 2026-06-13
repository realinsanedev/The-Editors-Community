// Ctrl+K: Intercept IMMEDIATELY with capture to prevent browser search bar
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
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

function setupSearch() {
    const searchInput = document.querySelector('.search-box input');
    const searchBox = document.querySelector('.search-box');
    
    // Focus/blur visual feedback
    searchInput.addEventListener('focus', () => {
        searchBox.classList.add('focused');
    });
    searchInput.addEventListener('blur', () => {
        searchBox.classList.remove('focused');
    });

    // Search input handler
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const container = document.getElementById('content-container');
        
        if (query === '') {
            window.location.hash = 'introduction';
            renderPage();
            return;
        }

        window.location.hash = 'search';
        
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

        let resultsHtml = `<div class="page-breadcrumbs">Search</div><h1 class="page-title">Results for "${query}"</h1>`;
        
        let sectionsMatched = '';
        let linksMatched = '';
        const seenUrls = new Set();

        for (const [key, section] of Object.entries(data)) {
            if (key === 'introduction') continue;
            
            // 1. Search in title
            const titleMatches = section.title && section.title.toLowerCase().includes(query);
            
            let matchedLinks = [];

            // 2. Search in structured softwareGroups
            if (section.softwareGroups) {
                section.softwareGroups.forEach(group => {
                    const groupTitleMatches = group.title && group.title.toLowerCase().includes(query);
                    if (group.links) {
                        group.links.forEach(link => {
                            if (groupTitleMatches || (link.label && link.label.toLowerCase().includes(query))) {
                                matchedLinks.push({
                                    group: group.title || 'Software',
                                    label: link.label,
                                    url: link.url,
                                    breadcrumb: section.breadcrumb || 'Link'
                                });
                            }
                        });
                    }
                });
            }

            // 3. Search in structured downloadLinks
            if (section.downloadLinks) {
                section.downloadLinks.forEach(link => {
                    if ((link.label && link.label.toLowerCase().includes(query)) ||
                        (link.quality && link.quality.toLowerCase().includes(query))) {
                        matchedLinks.push({
                            group: 'Download',
                            label: link.label,
                            url: link.url,
                            breadcrumb: section.breadcrumb || 'Download'
                        });
                    }
                });
            }

            // 4. Search in raw HTML content
            let contentTextMatches = false;
            if (section.content) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = section.content;
                
                if (tempDiv.textContent.toLowerCase().includes(query)) {
                    contentTextMatches = true;
                }

                // Find specific links
                const aTags = tempDiv.querySelectorAll('a');
                aTags.forEach(a => {
                    const href = a.getAttribute('href');
                    // Skip discord links and empty links for direct matches unless explicitly searched for Discord
                    if (href && href !== '#' && !href.includes('discord.com/invite')) {
                        if (a.textContent.toLowerCase().includes(query)) {
                            let groupTitle = 'Resource';
                            const groupDiv = a.closest('.software-group');
                            if (groupDiv) {
                                const h3 = groupDiv.querySelector('h3, .software-group-title');
                                if (h3) groupTitle = h3.textContent;
                            }
                            matchedLinks.push({
                                group: groupTitle,
                                label: a.textContent,
                                url: href,
                                breadcrumb: section.breadcrumb || 'Resource'
                            });
                        }
                    }
                });
                
                // Find matching groups
                const h3Tags = tempDiv.querySelectorAll('.software-group-title, .software-group h3');
                h3Tags.forEach(h3 => {
                    if (h3.textContent.toLowerCase().includes(query)) {
                        const groupDiv = h3.closest('.software-group');
                        if (groupDiv) {
                            const linksInGroup = groupDiv.querySelectorAll('a');
                            linksInGroup.forEach(a => {
                                const href = a.getAttribute('href');
                                if (href && href !== '#' && !href.includes('discord.com/invite')) {
                                    matchedLinks.push({
                                        group: h3.textContent,
                                        label: a.textContent,
                                        url: href,
                                        breadcrumb: section.breadcrumb || 'Resource'
                                    });
                                }
                            });
                        }
                    }
                });
            }

            // Render matched links for this section
            matchedLinks.forEach(link => {
                if (link.url && !seenUrls.has(link.url)) {
                    seenUrls.add(link.url);
                    const safeLabel = link.label ? link.label.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Link';
                    const safeGroup = link.group ? link.group.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
                    
                    linksMatched += `
                        <a href="${link.url}" target="_blank" class="search-result-card link-card hover-lift" style="display: block; margin-bottom: 16px; padding: 20px; background: white; border-radius: 12px; border: 1px solid #e5e7eb; text-decoration: none; color: inherit; transition: all 0.2s;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${link.breadcrumb} &bull; ${safeGroup}</div>
                                    <h4 style="font-size: 16px; font-weight: 600; color: #111; margin: 0;">${safeLabel}</h4>
                                </div>
                                <div class="icon-wrap" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #e0e7ff; border-radius: 50%; color: #4338ca; transition: background 0.2s;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </div>
                            </div>
                        </a>
                    `;
                }
            });

            // If the section title matched, or content matched (but maybe no specific link was extracted)
            if (titleMatches || contentTextMatches) {
                sectionsMatched += `
                    <div class="search-result-card" style="margin-bottom: 16px; padding: 20px; background: white; border-radius: 12px; border: 1px solid #e5e7eb; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Section &bull; ${section.breadcrumb || 'General'}</div>
                                <h3 style="margin-bottom: 8px; font-size: 18px; margin-top: 0;"><a href="#${key}" style="color: #111; text-decoration: none;">${section.title || key}</a></h3>
                                <a href="#${key}" style="display: inline-block; font-size: 14px; font-weight: 600; color: #4338ca; text-decoration: none;">View Section &rarr;</a>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        if (sectionsMatched !== '' || linksMatched !== '') {
            if (linksMatched !== '') {
                resultsHtml += `<h3 style="margin: 24px 0 16px 0; font-size: 16px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Direct Downloads</h3>`;
                resultsHtml += `<div class="search-results-links">` + linksMatched + `</div>`;
            }
            if (sectionsMatched !== '') {
                resultsHtml += `<h3 style="margin: 24px 0 16px 0; font-size: 16px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Related Sections</h3>`;
                resultsHtml += `<div class="search-results-sections">` + sectionsMatched + `</div>`;
            }
        } else {
            resultsHtml += `
                <div style="text-align: center; padding: 60px 20px;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <h3 style="font-size: 18px; color: #475569; margin-bottom: 8px; margin-top: 0;">No results found</h3>
                    <p style="color: #94a3b8; margin: 0;">We couldn't find anything matching "${query}". Try adjusting your search.</p>
                </div>
            `;
        }

        container.innerHTML = resultsHtml + `
            <style>
                .search-result-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.06) !important;
                    border-color: #cbd5e1 !important;
                }
                .link-card:hover .icon-wrap {
                    background: #c7d2fe !important;
                }
            </style>
        `;
    });
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

function previewImage(input, previewId) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(previewId).src = e.target.result;
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

