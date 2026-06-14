let data = {};
let currentKey = null;
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : '';


async function init() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        showLoginScreen();
        return;
    }

    try {
        const response = await fetch(API_BASE + '/api/data');
        data = await response.json();
        
        document.getElementById('loginModal').classList.remove('active');
        setupSearch();
        renderCategoryList();
        populateCategoryChips();
    } catch (error) {
        showToast('Failed to load data. Is the server running?', true);
    }
}

window.existingSoftwareCategories = [];

function populateCategoryChips() {
    const bCats = new Set();
    const sCats = new Set();
    Object.values(data).forEach(sec => {
        if (sec.breadcrumb) bCats.add(sec.breadcrumb);
        if (sec.softwareGroups) {
            sec.softwareGroups.forEach(g => {
                if (g.title) sCats.add(g.title.trim());
            });
        }
        
        // Extract from legacy raw HTML content
        if (sec.content) {
            const matches = sec.content.match(/<h3 class="software-group-title">(.*?)<\/h3>/g);
            if (matches) {
                matches.forEach(m => {
                    const title = m.replace(/<h3 class="software-group-title">/, '').replace(/<\/h3>/, '').trim();
                    if (title) sCats.add(title);
                });
            }
        }
    });
    
    // Update breadcrumb chips
    const bList = document.getElementById('breadcrumbChips');
    if (bList) {
        bList.innerHTML = '';
        Array.from(bCats).sort().forEach(c => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cat-chip';
            chip.textContent = c;
            chip.onclick = () => { document.getElementById('editBreadcrumb').value = c; };
            bList.appendChild(chip);
        });
    }
    
    // Update global software categories and existing UI chips
    window.existingSoftwareCategories = Array.from(sCats).sort();
    
    document.querySelectorAll('.sg-chips').forEach(container => {
        const input = container.parentElement.querySelector('.sg-title');
        container.innerHTML = '';
        window.existingSoftwareCategories.forEach(c => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cat-chip';
            chip.textContent = c;
            chip.onclick = () => { input.value = c; };
            container.appendChild(chip);
        });
    });
}

function showLoginScreen() {
    document.getElementById('loginModal').classList.add('active');
}

document.getElementById('loginBtn').addEventListener('click', async () => {
    const user = document.getElementById('loginUsername').value;
    const pass = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    try {
        const res = await fetch(API_BASE + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        const json = await res.json();
        if (json.success) {
            localStorage.setItem('adminToken', json.token);
            errorEl.style.display = 'none';
            if (Object.keys(data).length === 0) {
                init();
            } else {
                document.getElementById('loginModal').classList.remove('active');
            }
        } else {
            errorEl.textContent = json.message || 'Invalid credentials';
            errorEl.style.display = 'block';
        }
    } catch (e) {
        errorEl.textContent = 'Server error. Is it running?';
        errorEl.style.display = 'block';
    }
});

// initCodeMirror omitted


function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        renderCategoryList(e.target.value.toLowerCase());
    });
}

function renderCategoryList(filterQuery = '') {
    const list = document.getElementById('categoryList');
    list.innerHTML = '';

    Object.keys(data).forEach(key => {
        const title = data[key].title || key;
        
        if (filterQuery && !title.toLowerCase().includes(filterQuery) && !key.toLowerCase().includes(filterQuery)) {
            return;
        }

        const div = document.createElement('div');
        div.className = `category-item ${key === currentKey ? 'active' : ''}`;
        div.textContent = title;
        div.onclick = () => loadEditor(key);
        list.appendChild(div);
    });
}

function loadEditor(key) {
    currentKey = key;
    renderCategoryList(document.getElementById('searchInput').value.toLowerCase());

    const section = data[key];
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('editorForm').style.display = 'block';

    document.getElementById('editId').value = key;
    document.getElementById('editTitle').value = section.title || '';
    document.getElementById('editBreadcrumb').value = section.breadcrumb || '';
    
    // Load Download Links
    const dlContainer = document.getElementById('downloadLinksContainer');
    dlContainer.innerHTML = '';
    const dlinks = section.downloadLinks || [];
    dlinks.forEach(link => addDownloadLink(link));
    
    // Load Software Links
    const sgContainer = document.getElementById('softwareGroupsContainer');
    sgContainer.innerHTML = '';
    
    let sgroups = section.softwareGroups || [];
    // Migration: If no softwareGroups exist but softwareLinks exist, convert them
    if (sgroups.length === 0 && section.softwareLinks && section.softwareLinks.length > 0) {
        const grouped = {};
        section.softwareLinks.forEach(link => {
            const cat = link.subCategory || 'General';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(link);
        });
        sgroups = Object.keys(grouped).map(cat => ({ title: cat, links: grouped[cat] }));
    }
    sgroups.forEach(group => addSoftwareGroup(group));
    
    // Refresh editor omitted
    
    if (typeof initSortables === 'function') initSortables();
    if (typeof updatePreview === 'function') updatePreview();
}

document.getElementById('saveBtn').addEventListener('click', async () => {
    if (!currentKey) return;

    // Extract download links from DOM
    const linkElements = document.querySelectorAll('#downloadLinksContainer .dlink-item');
    const downloadLinks = Array.from(linkElements).map(el => ({
        label: el.querySelector('.dl-label').value,
        quality: el.querySelector('.dl-quality').value,
        size: el.querySelector('.dl-size').value,
        url: el.querySelector('.dl-url').value
    }));

    // Extract software groups from DOM
    const groupElements = document.querySelectorAll('#softwareGroupsContainer .sgroup-item');
    const softwareGroups = Array.from(groupElements).map(el => {
        const title = el.querySelector('.sg-title').value;
        const linkElements = el.querySelectorAll('.slink-item');
        const links = Array.from(linkElements).map(lel => ({
            label: lel.querySelector('.sl-label').value,
            url: lel.querySelector('.sl-url').value,
            isHighlighted: lel.querySelector('.sl-highlight').checked
        }));
        return { title, links };
    });

    data[currentKey] = {
        title: document.getElementById('editTitle').value,
        breadcrumb: document.getElementById('editBreadcrumb').value,
        content: (data[currentKey] && data[currentKey].content) || '', // Safely preserve existing content
        downloadLinks: downloadLinks,
        softwareGroups: softwareGroups
    };

    await saveData();
    renderCategoryList(document.getElementById('searchInput').value.toLowerCase());
});

async function saveData() {
    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(API_BASE + '/api/data', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('Changes saved successfully!');
            populateCategoryChips();
        } else if (res.status === 401) {
            showToast('Session expired. Please log in again.', true);
            localStorage.removeItem('adminToken');
            showLoginScreen();
        } else {
            showToast('Failed to save data. Server returned an error.', true);
        }
    } catch (e) {
        showToast('Failed to save data! Network error.', true);
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = isError ? 'var(--danger)' : 'var(--success)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Modal Logic
function openAddModal() {
    document.getElementById('newSectionId').value = '';
    document.getElementById('addModal').classList.add('active');
    document.getElementById('newSectionId').focus();
}

function openDeleteModal() {
    if (!currentKey || currentKey === 'introduction') {
        showToast('Cannot delete the introduction section.', true);
        return;
    }
    document.getElementById('deleteModal').classList.add('active');
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m.id !== 'loginModal') m.classList.remove('active');
    });
}

document.getElementById('confirmAddBtn').addEventListener('click', () => {
    let id = document.getElementById('newSectionId').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!id) return showToast('Please enter a valid ID', true);
    if (data[id]) return showToast('This ID already exists', true);

    data[id] = { title: 'New Section', breadcrumb: 'Category', content: '<p>Content goes here...</p>' };
    closeModals();
    loadEditor(id);
    // Clear search so the new item shows up
    document.getElementById('searchInput').value = '';
    renderCategoryList();
});

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (currentKey && currentKey !== 'introduction') {
        delete data[currentKey];
        currentKey = null;
        document.getElementById('editorForm').style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
        closeModals();
        await saveData();
        renderCategoryList(document.getElementById('searchInput').value.toLowerCase());
    }
});

// Close modals on clicking overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModals();
    });
});

init();

// Function to add a download link UI block
function addDownloadLink(link = {}) {
    const container = document.getElementById('downloadLinksContainer');
    const div = document.createElement('div');
    div.className = 'dlink-item';
    
    // Helper to safely encode attribute values to prevent XSS issues when loading saved values
    const safeVal = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    div.innerHTML = `
        <div class="drag-handle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </div>
        <button type="button" class="remove-btn" onclick="this.parentElement.remove(); if(typeof updatePreview === 'function') updatePreview();">×</button>
        <div class="form-group" style="margin-bottom: 16px;">
            <label>LINK LABEL (E.G. PART 1)</label>
            <input type="text" class="form-control dl-label" placeholder="Varanasi Official Trailer" value="${safeVal(link.label)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
        </div>
        <div class="dlink-grid">
            <div class="form-group" style="margin-bottom: 0;">
                <label>QUALITY</label>
                <input type="text" class="form-control dl-quality" placeholder="1080P HEVC" value="${safeVal(link.quality)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>FILE SIZE</label>
                <input type="text" class="form-control dl-size" placeholder="e.g. 1.2 GB" value="${safeVal(link.size)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>DOWNLOAD URL</label>
                <input type="text" class="form-control dl-url" placeholder="https://mega.nz/..." value="${safeVal(link.url)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            </div>
        </div>
    `;
    
    container.appendChild(div);
}

// Function to add a software group UI block
function addSoftwareGroup(group = {}) {
    const container = document.getElementById('softwareGroupsContainer');
    const div = document.createElement('div');
    div.className = 'dlink-item sgroup-item';
    div.style.background = 'rgba(255, 255, 255, 0.45)';
    
    const groupId = 'sg-' + Math.random().toString(36).substr(2, 9);
    div.id = groupId;

    const safeVal = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    div.innerHTML = `
        <div class="drag-handle-group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </div>
        <button type="button" class="remove-btn" onclick="this.parentElement.remove(); if(typeof updatePreview === 'function') updatePreview();">×</button>
        <div class="form-group" style="margin-bottom: 16px;">
            <label style="color: var(--accent);">CATEGORY TITLE (e.g. Adobe After Effects)</label>
            <input type="text" class="form-control sg-title" style="border-color: rgba(102, 34, 186, 0.15); font-weight: bold;" placeholder="e.g. Adobe After Effects" value="${safeVal(group.title)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            <div class="category-chips sg-chips"></div>
        </div>
        
        <div class="sg-links-container" style="padding-left: 20px; border-left: 2px solid rgba(102, 34, 186, 0.15); margin-bottom: 16px;">
            <!-- Links for this group -->
        </div>
        
        <button type="button" class="btn btn-outline" style="border-style: dashed; padding: 8px 16px; font-size: 12px; border-radius: 16px; color: var(--text-secondary);" onclick="addLinkToGroup('${groupId}')">
            + ADD LINK TO THIS CATEGORY
        </button>
    `;
    
    container.appendChild(div);
    
    // Populate chips for this new group
    const chipsContainer = div.querySelector('.sg-chips');
    const input = div.querySelector('.sg-title');
    if (window.existingSoftwareCategories) {
        window.existingSoftwareCategories.forEach(c => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cat-chip';
            chip.textContent = c;
            chip.onclick = () => { input.value = c; };
            chipsContainer.appendChild(chip);
        });
    }
    
    const linksContainer = div.querySelector('.sg-links-container');
    const links = group.links || [];
    links.forEach(link => appendLinkToContainer(linksContainer, link));
    
    if (window.Sortable) {
        new Sortable(linksContainer, {
            animation: 150,
            handle: '.drag-handle-link',
            onEnd: () => { if(typeof updatePreview === 'function') updatePreview(); }
        });
    }
}

function addLinkToGroup(groupId) {
    const container = document.getElementById(groupId).querySelector('.sg-links-container');
    appendLinkToContainer(container, {});
}

function appendLinkToContainer(container, link = {}) {
    const div = document.createElement('div');
    div.className = 'slink-item';
    div.style.position = 'relative';
    div.style.marginBottom = '12px';
    div.style.padding = '12px';
    div.style.background = 'rgba(255, 255, 255, 0.3)';
    div.style.border = '1.5px solid rgba(102, 34, 186, 0.08)';
    div.style.borderRadius = '8px';
    
    const safeVal = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const checkboxId = 'hl-' + Math.random().toString(36).substr(2, 9);

    div.innerHTML = `
        <div class="drag-handle-link" style="left: -15px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </div>
        <button type="button" class="remove-btn" style="top: -8px; right: -8px; width: 20px; height: 20px; font-size: 12px;" onclick="this.parentElement.remove(); if(typeof updatePreview === 'function') updatePreview();">×</button>
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 8px;">
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px;">VERSION LABEL</label>
                <input type="text" class="form-control sl-label" style="padding: 8px 12px; font-size: 13px;" placeholder="e.g. AE 2025" value="${safeVal(link.label)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px;">LINK URL</label>
                <input type="text" class="form-control sl-url" style="padding: 8px 12px; font-size: 13px;" placeholder="https://..." value="${safeVal(link.url)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" class="sl-highlight" id="${checkboxId}" ${link.isHighlighted ? 'checked' : ''} style="width: 14px; height: 14px; accent-color: var(--accent);" onchange="if(typeof updatePreview === 'function') updatePreview()">
            <label for="${checkboxId}" style="margin: 0; cursor: pointer; color: var(--text-secondary); font-size: 11px; letter-spacing: 0;">Highlight (Red Underline)</label>
        </div>
    `;
    
    container.appendChild(div);
}

// Preview & Sortable Logic

function togglePreview() {
    const grid = document.querySelector('.editor-grid');
    const preview = document.getElementById('previewContainer');
    const container = document.querySelector('.admin-container');
    if (grid.classList.contains('split-mode')) {
        grid.classList.remove('split-mode');
        preview.style.display = 'none';
        container.style.maxWidth = '1200px';
    } else {
        grid.classList.add('split-mode');
        preview.style.display = 'flex';
        container.style.maxWidth = '98%';
        updatePreview();
    }
}

function updatePreview() {
    const grid = document.querySelector('.editor-grid');
    if (!grid || !grid.classList.contains('split-mode')) return;

    const title = document.getElementById('editTitle').value || 'Section Title';
    const breadcrumb = document.getElementById('editBreadcrumb').value || 'Category';
    const content = data[currentKey] ? (data[currentKey].content || '') : '';
    
    const linkElements = document.querySelectorAll('#downloadLinksContainer .dlink-item');
    const downloadLinks = Array.from(linkElements).map(el => ({
        label: el.querySelector('.dl-label').value,
        quality: el.querySelector('.dl-quality').value,
        size: el.querySelector('.dl-size').value,
        url: el.querySelector('.dl-url').value
    }));

    const groupElements = document.querySelectorAll('#softwareGroupsContainer .sgroup-item');
    const softwareGroups = Array.from(groupElements).map(el => {
        const title = el.querySelector('.sg-title').value;
        const linkEls = el.querySelectorAll('.slink-item');
        const links = Array.from(linkEls).map(lel => ({
            label: lel.querySelector('.sl-label').value,
            url: lel.querySelector('.sl-url').value,
            isHighlighted: lel.querySelector('.sl-highlight').checked
        }));
        return { title, links };
    });

    let html = '';
    
    if (breadcrumb && title) {
        html += `<div class="page-breadcrumbs">${breadcrumb}</div>`;
        html += `<h1 class="page-title">${title}</h1>`;
    }

    html += content;
    
    if (softwareGroups && softwareGroups.length > 0) {
        softwareGroups.forEach(group => {
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
    
    if (downloadLinks && downloadLinks.length > 0) {
        html += `<div class="download-section" style="margin-top: 40px;">
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 20px; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download Links
                    </h3>
                    <div class="download-links-grid stagger-in" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">`;
        
        downloadLinks.forEach(link => {
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

    const iframeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="styles.css">
            <style>
                body { background: #fff; padding: 20px; font-family: 'Inter Tight', sans-serif; color: #000; margin: 0; overflow-x: hidden; }
                #content-container { max-width: 100%; margin: 0 auto; }
            </style>
        </head>
        <body>
            <div id="content-container">${html}</div>
        </body>
        </html>
    `;

    const frame = document.getElementById('previewFrame');
    if (frame) frame.srcdoc = iframeHtml;
}

function initSortables() {
    if (!window.Sortable) return;

    const dlContainer = document.getElementById('downloadLinksContainer');
    if (dlContainer && !dlContainer.sortable) {
        dlContainer.sortable = new Sortable(dlContainer, {
            animation: 150,
            handle: '.drag-handle',
            onEnd: updatePreview
        });
    }

    const sgContainer = document.getElementById('softwareGroupsContainer');
    if (sgContainer && !sgContainer.sortable) {
        sgContainer.sortable = new Sortable(sgContainer, {
            animation: 150,
            handle: '.drag-handle-group',
            onEnd: updatePreview
        });
    }
}

// Add input listeners to trigger update preview
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('editTitle').addEventListener('input', updatePreview);
    document.getElementById('editBreadcrumb').addEventListener('input', updatePreview);
});
