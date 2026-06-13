let data = {};

async function init() {
    try {
        const response = await fetch('http://localhost:3000/api/data');
        if (!response.ok) throw new Error('Network response was not ok');
        data = await response.json();
        setupSearch();
        renderPage();
        await checkAuthStatus();
    } catch (error) {
        document.getElementById('content-container').innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h2>Error Loading Data</h2>
                <p>Please make sure you are running the Node.js server.</p>
                <code>npm start</code>
            </div>
        `;
    }
}

function renderPage() {
    // If the hash is "search", we let the search function handle it
    const hash = window.location.hash.substring(1) || 'introduction';
    if (hash === 'search') return;

    const container = document.getElementById('content-container');
    const pageData = data[hash];

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
    
    // Ctrl/Cmd + K shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
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
        let found = false;

        // Extremely basic search: searching through the raw HTML content text
        for (const [key, section] of Object.entries(data)) {
            if (key === 'introduction') continue;
            
            const titleMatches = section.title && section.title.toLowerCase().includes(query);
            const contentMatches = section.content && section.content.toLowerCase().includes(query);

            if (titleMatches || contentMatches) {
                found = true;
                resultsHtml += `
                    <div style="margin-bottom: 20px; padding: 20px; background: white; border-radius: 12px; border: 1px solid #e5e7eb;">
                        <h3 style="margin-bottom: 10px; color: var(--red-brand);"><a href="#${key}" style="color: inherit; text-decoration: none;">${section.title}</a></h3>
                        <p style="font-size: 14px; color: #666;">Matched in section: ${section.breadcrumb}</p>
                        <a href="#${key}" style="display: inline-block; margin-top: 10px; color: #000; font-weight: 600; text-decoration: none; border-bottom: 1px solid #000;">View Section</a>
                    </div>
                `;
            }
        }

        if (!found) {
            resultsHtml += `<p>No results found for your query.</p>`;
        }

        container.innerHTML = resultsHtml;
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
            const res = await fetch('http://localhost:3000/api/users/profile', {
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
        document.getElementById('navProfilePic').src = currentUser.profilePic ? `http://localhost:3000${currentUser.profilePic}` : 'https://api.dicebear.com/6.x/initials/svg?seed=' + currentUser.name;
        
        // Populate profile form
        document.getElementById('profName').value = currentUser.name || '';
        document.getElementById('profUsername').value = currentUser.username || '';
        document.getElementById('profEmail').value = currentUser.email || '';
        document.getElementById('profilePicPreview').src = currentUser.profilePic ? `http://localhost:3000${currentUser.profilePic}` : 'https://api.dicebear.com/6.x/initials/svg?seed=' + currentUser.name;
        document.getElementById('profileBannerPreview').src = currentUser.profileBanner ? `http://localhost:3000${currentUser.profileBanner}` : '';
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
        const res = await fetch('http://localhost:3000/api/users/login', {
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
    const err = document.getElementById('regError');
    try {
        const res = await fetch('http://localhost:3000/api/users/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: u, email: e, password: p, name})
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

// Profile update
async function handleProfileUpdate() {
    const name = document.getElementById('profName').value;
    const u = document.getElementById('profUsername').value;
    const e = document.getElementById('profEmail').value;
    const p = document.getElementById('profPassword').value;
    const picFile = document.getElementById('picUpload').files[0];
    const bannerFile = document.getElementById('bannerUpload').files[0];
    const err = document.getElementById('profError');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('username', u);
    formData.append('email', e);
    if (p) formData.append('password', p);
    if (picFile) formData.append('profilePic', picFile);
    if (bannerFile) formData.append('profileBanner', bannerFile);

    try {
        const token = localStorage.getItem('userToken');
        const res = await fetch('http://localhost:3000/api/users/profile', {
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
