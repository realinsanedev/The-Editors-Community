let data = {};
let currentKey = null;
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : '';


function toggleAdminPassword(btn) {
    const input = document.getElementById('loginPassword');
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
        input.type = 'password';
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
}

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
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderCategoryList(e.target.value.toLowerCase());
        });
    }

    const presetsSearchInput = document.getElementById('presetsSearchInput');
    if (presetsSearchInput) {
        presetsSearchInput.addEventListener('input', () => {
            renderAdminPresetsTable();
        });
    }

    const forumsSearchInput = document.getElementById('forumsSearchInput');
    if (forumsSearchInput) {
        forumsSearchInput.addEventListener('input', () => {
            renderAdminForumsTable();
        });
    }
}

function renderCategoryList(filterQuery = '') {
    const list = document.getElementById('categoryList');
    list.innerHTML = '';

    // Build category buckets: { 'Softwares': [{key, title}, ...], ... }
    const buckets = {};
    const uncategorised = [];

    Object.keys(data).forEach(key => {
        if (key === 'introduction') return; // handled separately as system
        const sec = data[key];
        const title = sec.title || key;

        if (filterQuery && !title.toLowerCase().includes(filterQuery) && !key.toLowerCase().includes(filterQuery)) {
            return;
        }

        const cat = (sec.breadcrumb && sec.breadcrumb.trim()) ? sec.breadcrumb.trim() : null;
        if (cat) {
            if (!buckets[cat]) buckets[cat] = [];
            buckets[cat].push({ key, title });
        } else {
            uncategorised.push({ key, title });
        }
    });

    // --- System Pages (Introduction) ---
    const intrSec = data['introduction'];
    const intrTitle = (intrSec && intrSec.title) ? intrSec.title : 'Introduction';
    if (!filterQuery || intrTitle.toLowerCase().includes(filterQuery) || 'introduction'.includes(filterQuery)) {
        const header = document.createElement('div');
        header.className = 'category-group-header';
        header.textContent = 'System Pages';
        list.appendChild(header);

        const div = document.createElement('div');
        div.className = `category-item sub-item ${'introduction' === currentKey ? 'active' : ''}`;
        div.textContent = 'Introduction';
        div.onclick = () => loadEditor('introduction');
        list.appendChild(div);
    }

    // --- Categorised Sections ---
    Object.keys(buckets).sort().forEach(cat => {
        const pages = buckets[cat];
        if (pages.length === 0) return;

        const header = document.createElement('div');
        header.className = 'category-group-header';
        header.textContent = cat;
        list.appendChild(header);

        pages.forEach(({ key, title }) => {
            const div = document.createElement('div');
            div.className = `category-item sub-item ${key === currentKey ? 'active' : ''}`;
            div.textContent = title;
            div.onclick = () => loadEditor(key);
            list.appendChild(div);
        });
    });

    // --- Uncategorised pages ---
    if (uncategorised.length > 0) {
        const header = document.createElement('div');
        header.className = 'category-group-header';
        header.textContent = 'Uncategorised';
        list.appendChild(header);
        uncategorised.forEach(({ key, title }) => {
            const div = document.createElement('div');
            div.className = `category-item sub-item ${key === currentKey ? 'active' : ''}`;
            div.textContent = title;
            div.onclick = () => loadEditor(key);
            list.appendChild(div);
        });
    }

    // --- Community Panels ---
    const panelFilter = !filterQuery;
    const presetTitle = '✦ Manage Presets';
    const forumTitle  = '✦ Manage Forums';
    const showcaseTitle = '✦ Manage Showcase';
    const usersTitle  = '✦ Manage Users';

    const specialPanels = [
        { key: '_presets',  label: presetTitle },
        { key: '_forums',   label: forumTitle },
        { key: '_showcase', label: showcaseTitle },
        { key: '_users',    label: usersTitle }
    ].filter(p => !filterQuery || p.label.toLowerCase().includes(filterQuery));

    if (specialPanels.length > 0) {
        const header = document.createElement('div');
        header.className = 'category-group-header';
        header.textContent = 'Community Panels';
        list.appendChild(header);

        specialPanels.forEach(p => {
            const div = document.createElement('div');
            div.className = `category-item sub-item ${currentKey === p.key ? 'active' : ''}`;
            div.textContent = p.label;
            div.style.borderLeft = currentKey === p.key ? '3px solid var(--accent)' : '';
            div.onclick = () => loadEditor(p.key);
            list.appendChild(div);
        });
    }
}

function loadEditor(key) {
    currentKey = key;
    renderCategoryList(document.getElementById('searchInput').value.toLowerCase());

    document.getElementById('emptyState').style.display = 'none';

    if (key === '_presets') {
        document.getElementById('editorForm').style.display = 'none';
        document.getElementById('presetsManager').style.display = 'block';
        document.getElementById('forumsManager').style.display = 'none';
        
        // Hide live preview panel if open
        const grid = document.querySelector('.editor-grid');
        if (grid && grid.classList.contains('split-mode')) {
            togglePreview();
        }
        
        loadAdminPresets();
        return;
    }

    if (key === '_forums') {
        document.getElementById('editorForm').style.display = 'none';
        document.getElementById('presetsManager').style.display = 'none';
        document.getElementById('forumsManager').style.display = 'block';
        document.getElementById('showcaseManager') && (document.getElementById('showcaseManager').style.display = 'none');
        document.getElementById('usersManager') && (document.getElementById('usersManager').style.display = 'none');

        // Hide live preview panel if open
        const grid = document.querySelector('.editor-grid');
        if (grid && grid.classList.contains('split-mode')) {
            togglePreview();
        }
        
        loadAdminForums();
        return;
    }

    if (key === '_showcase') {
        document.getElementById('editorForm').style.display = 'none';
        document.getElementById('presetsManager').style.display = 'none';
        document.getElementById('forumsManager').style.display = 'none';

        const grid = document.querySelector('.editor-grid');
        if (grid && grid.classList.contains('split-mode')) togglePreview();

        // Render a basic showcase posts manager (read from /api/showcase)
        showSpecialManager('showcaseManager', 'Manage Showcase', loadAdminShowcase);
        return;
    }

    if (key === '_users') {
        document.getElementById('editorForm').style.display = 'none';
        document.getElementById('presetsManager').style.display = 'none';
        document.getElementById('forumsManager').style.display = 'none';

        const grid = document.querySelector('.editor-grid');
        if (grid && grid.classList.contains('split-mode')) togglePreview();

        showSpecialManager('usersManager', 'Manage Users', loadAdminUsers);
        return;
    }

    document.getElementById('presetsManager').style.display = 'none';
    document.getElementById('forumsManager').style.display = 'none';
    document.getElementById('showcaseManager') && (document.getElementById('showcaseManager').style.display = 'none');
    document.getElementById('usersManager') && (document.getElementById('usersManager').style.display = 'none');
    document.getElementById('editorForm').style.display = 'block';

    const section = data[key] || {};
    document.getElementById('editId').value = key;
    document.getElementById('editTitle').value = section.title || '';
    document.getElementById('editBreadcrumb').value = section.breadcrumb || '';
    
    // Load Download Links
    const addBtn = document.getElementById('addDownloadLinkBtn');
    if (addBtn) {
        addBtn.textContent = key === 'useful-tutorials' ? '+ ADD NEW TUTORIAL' : '+ ADD NEW LINK';
    }
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
        const links = Array.from(linkElements).map(lel => {
            const extraElements = lel.querySelectorAll('.slink-extra-item');
            const extraLinks = Array.from(extraElements).map(eel => ({
                label: eel.querySelector('.sle-label').value,
                url: eel.querySelector('.sle-url').value
            }));
            return {
                label: lel.querySelector('.sl-label').value,
                url: lel.querySelector('.sl-url').value,
                isHighlighted: lel.querySelector('.sl-highlight').checked,
                extraLinks: extraLinks
            };
        });
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
    // Reset fields
    document.getElementById('newSectionId').value = '';
    document.getElementById('newPageTitle').value = '';
    document.getElementById('newCategoryTitleInput').value = '';
    document.getElementById('newCategoryInputWrapper').style.display = 'none';

    // Populate existing categories from breadcrumbs in data
    const cats = new Set();
    Object.values(data).forEach(sec => {
        if (sec.breadcrumb && sec.breadcrumb.trim()) cats.add(sec.breadcrumb.trim());
    });

    const select = document.getElementById('newSectionCategorySelect');
    select.innerHTML = '';

    Array.from(cats).sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });

    // Add "+ Create New Category" option at end
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Create New Category';
    select.appendChild(newOpt);

    document.getElementById('addModal').classList.add('active');
    document.getElementById('newPageTitle').focus();
}

function toggleNewCategoryInput() {
    const sel = document.getElementById('newSectionCategorySelect');
    const wrapper = document.getElementById('newCategoryInputWrapper');
    wrapper.style.display = sel.value === '__new__' ? 'block' : 'none';
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
    const select = document.getElementById('newSectionCategorySelect');
    const isNewCat = select.value === '__new__';

    // Resolve the parent category breadcrumb
    let breadcrumb = '';
    if (isNewCat) {
        breadcrumb = document.getElementById('newCategoryTitleInput').value.trim();
        if (!breadcrumb) return showToast('Please enter a name for the new category.', true);
    } else {
        breadcrumb = select.value;
    }

    // Page title
    const pageTitle = document.getElementById('newPageTitle').value.trim();
    if (!pageTitle) return showToast('Please enter a page title.', true);

    // Page ID
    let id = document.getElementById('newSectionId').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!id) {
        // Auto-generate from title
        id = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (!id) return showToast('Please enter a valid Page ID.', true);
    if (data[id]) return showToast(`A page with ID "${id}" already exists.`, true);

    data[id] = {
        title: pageTitle,
        breadcrumb: breadcrumb,
        content: '<p>Content goes here...</p>',
        downloadLinks: [],
        softwareGroups: []
    };

    closeModals();
    loadEditor(id);
    document.getElementById('searchInput').value = '';
    renderCategoryList();
    showToast(`Page "${pageTitle}" created under ${breadcrumb}!`);
});

// Auto-fill Page ID from title while typing
document.addEventListener('DOMContentLoaded', () => {
    const pageTitleInput = document.getElementById('newPageTitle');
    const pageIdInput = document.getElementById('newSectionId');
    if (pageTitleInput && pageIdInput) {
        pageTitleInput.addEventListener('input', () => {
            // Only auto-fill if the user hasn't manually typed an ID
            if (!pageIdInput.dataset.manuallyEdited) {
                pageIdInput.value = pageTitleInput.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }
        });
        pageIdInput.addEventListener('input', () => {
            pageIdInput.dataset.manuallyEdited = pageIdInput.value ? 'true' : '';
        });
    }
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

    const isTutorial = currentKey === 'useful-tutorials';
    const labelTitle = isTutorial ? 'TUTORIAL TITLE' : 'LINK LABEL (E.G. PART 1)';
    const labelPlaceholder = isTutorial ? 'E.g. Seamless Zoom In Premiere Pro' : 'Varanasi Official Trailer';
    const qualityLabel = isTutorial ? 'SOFTWARE / CATEGORY' : 'QUALITY';
    const qualityPlaceholder = isTutorial ? 'E.g. Premiere Pro' : '1080P HEVC';
    const sizeLabel = isTutorial ? 'VIDEO DURATION' : 'FILE SIZE';
    const sizePlaceholder = isTutorial ? 'E.g. 12 mins' : 'e.g. 1.2 GB';
    const urlLabel = isTutorial ? 'YOUTUBE VIDEO URL' : 'DOWNLOAD URL';
    const urlPlaceholder = isTutorial ? 'https://www.youtube.com/watch?v=...' : 'https://mega.nz/...';

    div.innerHTML = `
        <div class="drag-handle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </div>
        <button type="button" class="remove-btn" onclick="this.parentElement.remove(); if(typeof updatePreview === 'function') updatePreview();">×</button>
        <div class="form-group" style="margin-bottom: 16px;">
            <label>${labelTitle}</label>
            <input type="text" class="form-control dl-label" placeholder="${labelPlaceholder}" value="${safeVal(link.label)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
        </div>
        <div class="dlink-grid">
            <div class="form-group" style="margin-bottom: 0;">
                <label>${qualityLabel}</label>
                <input type="text" class="form-control dl-quality" placeholder="${qualityPlaceholder}" value="${safeVal(link.quality)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>${sizeLabel}</label>
                <input type="text" class="form-control dl-size" placeholder="${sizePlaceholder}" value="${safeVal(link.size)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>${urlLabel}</label>
                <input type="text" class="form-control dl-url" placeholder="${urlPlaceholder}" value="${safeVal(link.url)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
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
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <input type="checkbox" class="sl-highlight" id="${checkboxId}" ${link.isHighlighted ? 'checked' : ''} style="width: 14px; height: 14px; accent-color: var(--accent);" onchange="if(typeof updatePreview === 'function') updatePreview()">
            <label for="${checkboxId}" style="margin: 0; cursor: pointer; color: var(--text-secondary); font-size: 11px; letter-spacing: 0;">Highlight (Red Underline)</label>
        </div>

        <div class="sl-extra-links-container" style="margin-top: 8px; border-top: 1px dashed rgba(102, 34, 186, 0.15); padding-top: 8px;">
            <!-- Sub-links container -->
        </div>
        
        <button type="button" class="btn btn-outline" style="border-style: dotted; padding: 4px 10px; font-size: 10px; border-radius: 12px; margin-top: 6px; color: var(--text-secondary);" onclick="addExtraLinkRow(this)">
            + Add Sub-Link (e.g. Mirror, Version 2, etc.)
        </button>
    `;
    
    container.appendChild(div);

    const extraContainer = div.querySelector('.sl-extra-links-container');
    const extraLinks = link.extraLinks || [];
    extraLinks.forEach(ext => appendExtraLinkRow(extraContainer, ext));
}

window.addExtraLinkRow = function(btn) {
    const slinkItem = btn.closest('.slink-item');
    const container = slinkItem.querySelector('.sl-extra-links-container');
    appendExtraLinkRow(container, {});
};

window.appendExtraLinkRow = function(container, ext = {}) {
    const div = document.createElement('div');
    div.className = 'slink-extra-item';
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.marginBottom = '6px';
    div.style.alignItems = 'center';
    
    const safeVal = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    div.innerHTML = `
        <input type="text" class="form-control sle-label" style="padding: 6px 10px; font-size: 12px; width: 100px; display: inline-block;" placeholder="Label (e.g. 2)" value="${safeVal(ext.label)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
        <input type="text" class="form-control sle-url" style="padding: 6px 10px; font-size: 12px; flex: 1; display: inline-block;" placeholder="Sub-Link URL https://..." value="${safeVal(ext.url)}" oninput="if(typeof updatePreview === 'function') updatePreview()">
        <button type="button" class="remove-btn" style="position: static; transform: none; width: 18px; height: 18px; line-height: 18px; font-size: 11px; flex-shrink: 0;" onclick="this.parentElement.remove(); if(typeof updatePreview === 'function') updatePreview();">×</button>
    `;
    
    container.appendChild(div);
    if (typeof updatePreview === 'function') updatePreview();
};

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
        const links = Array.from(linkEls).map(lel => {
            const extraElements = lel.querySelectorAll('.slink-extra-item');
            const extraLinks = Array.from(extraElements).map(eel => ({
                label: eel.querySelector('.sle-label').value,
                url: eel.querySelector('.sle-url').value
            }));
            return {
                label: lel.querySelector('.sl-label').value,
                url: lel.querySelector('.sl-url').value,
                isHighlighted: lel.querySelector('.sl-highlight').checked,
                extraLinks: extraLinks
            };
        });
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
            <link rel="stylesheet" href="main.css">
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

    // Copy password handler for interactive banner in preview pane
    document.addEventListener('click', (e) => {
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
});

/* =============================================
   Presets Manager Logic
   ============================================= */
let adminPresets = [];
let activePresetFilterType = 'all';
let presetIdToDelete = null;

async function loadAdminPresets() {
    const tbody = document.getElementById('presetsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="spinner-container"><div class="spinner"></div><span>Loading presets...</span></div></td></tr>`;
    }
    try {
        const res = await fetch(API_BASE + '/api/presets');
        const json = await res.json();
        if (json.success) {
            adminPresets = json.presets || [];
            renderAdminPresetsTable();
        } else {
            showToast('Failed to load presets.', true);
        }
    } catch (e) {
        console.error('Error fetching presets:', e);
        showToast('Network error loading presets.', true);
    }
}

function renderAdminPresetsTable() {
    const tbody = document.getElementById('presetsTableBody');
    const countEl = document.getElementById('presetsCount');
    if (!tbody) return;

    tbody.innerHTML = '';
    const searchQuery = document.getElementById('presetsSearchInput') ? document.getElementById('presetsSearchInput').value.toLowerCase().trim() : '';

    const filtered = adminPresets.filter(preset => {
        // Filter by platform type (pc vs mobile)
        if (activePresetFilterType !== 'all') {
            const type = preset.platformType || 'pc';
            if (type !== activePresetFilterType) return false;
        }

        // Filter by search query
        if (searchQuery) {
            const title = (preset.title || '').toLowerCase();
            const author = (preset.authorName || '').toLowerCase();
            const platform = (preset.platform || '').toLowerCase();
            const category = (preset.category || '').toLowerCase();
            if (!title.includes(searchQuery) && !author.includes(searchQuery) && !platform.includes(searchQuery) && !category.includes(searchQuery)) {
                return false;
            }
        }
        return true;
    });

    countEl.textContent = `${filtered.length} presets shown (${adminPresets.length} total)`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 30px;">No presets found.</td></tr>`;
        return;
    }

    filtered.forEach(preset => {
        const tr = document.createElement('tr');
        const dateStr = new Date(preset.createdAt).toLocaleDateString();
        const type = preset.platformType || 'pc';
        
        tr.innerHTML = `
            <td style="font-weight: 600;">${preset.title}</td>
            <td style="color: var(--text-secondary);">${preset.authorName || 'Anonymous'}</td>
            <td><span class="preset-type-badge pc" style="background: #f1f5f9; color: #475569;">${preset.category}</span></td>
            <td><span class="preset-type-badge pc" style="background: #f1f5f9; color: #475569;">${preset.platform}</span></td>
            <td><span class="preset-type-badge ${type}">${type}</span></td>
            <td style="color: var(--text-secondary);">${dateStr}</td>
            <td style="text-align: right;">
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px; border-radius: 6px;" onclick="openDeletePresetModal('${preset.id}', '${preset.title.replace(/'/g, "\\'")}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterPresetsByType(type) {
    activePresetFilterType = type;
    
    // Toggle active class on buttons
    document.getElementById('filterPresetTypeAll').classList.remove('active');
    document.getElementById('filterPresetTypePc').classList.remove('active');
    document.getElementById('filterPresetTypeMobile').classList.remove('active');

    if (type === 'all') document.getElementById('filterPresetTypeAll').classList.add('active');
    if (type === 'pc') document.getElementById('filterPresetTypePc').classList.add('active');
    if (type === 'mobile') document.getElementById('filterPresetTypeMobile').classList.add('active');

    renderAdminPresetsTable();
}

function openDeletePresetModal(id, title) {
    presetIdToDelete = id;
    const titleEl = document.getElementById('deletePresetTitle');
    if (titleEl) titleEl.textContent = `"${title}"`;
    document.getElementById('deletePresetModal').classList.add('active');
}

async function confirmDeletePreset() {
    if (!presetIdToDelete) return;
    
    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(`${API_BASE}/api/presets/${presetIdToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const json = await res.json();
        if (json.success) {
            showToast('Preset deleted successfully!');
            closeModals();
            loadAdminPresets();
        } else {
            showToast(json.message || 'Failed to delete preset.', true);
        }
    } catch (e) {
        console.error('Error deleting preset:', e);
        showToast('Network error deleting preset.', true);
    }
    presetIdToDelete = null;
}

// Attach event listeners for preset and forum deletion confirmation on load
document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmDeletePresetBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmDeletePreset);
    }

    const confirmForumBtn = document.getElementById('confirmDeleteForumBtn');
    if (confirmForumBtn) {
        confirmForumBtn.addEventListener('click', confirmDeleteForum);
    }
});

/* =============================================
   Forums Manager Logic
   ============================================= */
let adminForums = [];
let forumIdToDelete = null;

async function loadAdminForums() {
    const tbody = document.getElementById('forumsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="spinner-container"><div class="spinner"></div><span>Loading forums...</span></div></td></tr>`;
    }
    try {
        const res = await fetch(API_BASE + '/api/forums');
        const json = await res.json();
        if (json.success) {
            adminForums = json.forums || [];
            renderAdminForumsTable();
        } else {
            showToast('Failed to load forums.', true);
        }
    } catch (e) {
        console.error('Error fetching forums:', e);
        showToast('Network error loading forums.', true);
    }
}

function renderAdminForumsTable() {
    const tbody = document.getElementById('forumsTableBody');
    const countEl = document.getElementById('forumsCount');
    if (!tbody) return;

    tbody.innerHTML = '';
    const searchQuery = document.getElementById('forumsSearchInput') ? document.getElementById('forumsSearchInput').value.toLowerCase().trim() : '';

    const filtered = adminForums.filter(post => {
        if (searchQuery) {
            const title = (post.title || '').toLowerCase();
            const content = (post.content || '').toLowerCase();
            const author = (post.authorName || '').toLowerCase();
            if (!title.includes(searchQuery) && !content.includes(searchQuery) && !author.includes(searchQuery)) {
                return false;
            }
        }
        return true;
    });

    countEl.textContent = `${filtered.length} posts shown (${adminForums.length} total)`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px;">No forum posts found.</td></tr>`;
        return;
    }

    filtered.forEach(post => {
        const tr = document.createElement('tr');
        const dateStr = new Date(post.createdAt).toLocaleDateString();
        
        // Truncate content preview to 60 characters
        let contentPreview = post.content || '';
        if (contentPreview.length > 60) {
            contentPreview = contentPreview.substring(0, 57) + '...';
        }
        
        tr.innerHTML = `
            <td style="font-weight: 600;">${post.title}</td>
            <td style="color: var(--text-secondary);">${post.authorName || 'Anonymous'}</td>
            <td style="color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${contentPreview}</td>
            <td><span class="preset-type-badge pc" style="background: #f1f5f9; color: #475569;">${post.replies ? post.replies.length : 0} replies</span></td>
            <td style="color: var(--text-secondary);">${dateStr}</td>
            <td style="text-align: right;">
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px; border-radius: 6px;" onclick="openDeleteForumModal('${post.id}', '${post.title.replace(/'/g, "\\'")}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openDeleteForumModal(id, title) {
    forumIdToDelete = id;
    const titleEl = document.getElementById('deleteForumTitle');
    if (titleEl) titleEl.textContent = `"${title}"`;
    document.getElementById('deleteForumModal').classList.add('active');
}

async function confirmDeleteForum() {
    if (!forumIdToDelete) return;
    
    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(`${API_BASE}/api/forums/${forumIdToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const json = await res.json();
        if (json.success) {
            showToast('Forum post deleted successfully!');
            closeModals();
            loadAdminForums();
        } else {
            showToast(json.message || 'Failed to delete forum post.', true);
        }
    } catch (e) {
        console.error('Error deleting forum post:', e);
        showToast('Network error deleting forum post.', true);
    }
    forumIdToDelete = null;
}

/* =============================================
   Generic Special Manager Renderer
   ============================================= */
function showSpecialManager(containerId, title, loaderFn) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Hide all siblings
    ['editorForm','presetsManager','forumsManager','showcaseManager','usersManager'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.id !== containerId) el.style.display = 'none';
    });

    container.style.display = 'block';
    loaderFn();
}

/* =============================================
   Showcase Posts Manager
   ============================================= */
let adminShowcasePosts = [];

async function loadAdminShowcase() {
    const container = document.getElementById('showcaseManager');
    container.innerHTML = `
        <div class="presets-header-row">
            <h2 style="font-size:24px;font-weight:700;color:var(--text-primary);letter-spacing:-0.5px;margin:0;">Manage Showcase Posts</h2>
            <span style="font-size:13px;color:var(--text-secondary);font-weight:600;" id="showcaseCount">Loading...</span>
        </div>
        <div class="presets-filter-bar">
            <div style="flex-grow:1;">
                <input type="text" id="showcaseSearchInput" class="form-control" placeholder="Search by title or author..." style="padding:10px 14px;font-size:14px;" oninput="renderAdminShowcaseTable()">
            </div>
        </div>
        <div style="overflow-x:auto;margin-top:20px;border:1px solid var(--border-color);border-radius:12px;background:#fff;">
            <table class="presets-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Likes</th>
                        <th>Comments</th>
                        <th>Date</th>
                        <th style="text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody id="showcaseTableBody">
                    <tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-secondary);">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${API_BASE}/api/showcase`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        adminShowcasePosts = json.success ? json.posts : [];
        document.getElementById('showcaseCount').textContent = `${adminShowcasePosts.length} posts`;
        renderAdminShowcaseTable();
    } catch (e) {
        document.getElementById('showcaseTableBody').innerHTML =
            `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger);">Failed to load showcase posts.</td></tr>`;
    }
}

function renderAdminShowcaseTable() {
    const query = (document.getElementById('showcaseSearchInput')?.value || '').toLowerCase();
    const tbody = document.getElementById('showcaseTableBody');
    if (!tbody) return;

    const filtered = adminShowcasePosts.filter(p => {
        return !query || p.title.toLowerCase().includes(query) || (p.authorName || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-secondary);">No showcase posts found.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(post => {
        const tr = document.createElement('tr');
        const date = new Date(post.createdAt).toLocaleDateString();
        const safeTitle = (post.title || '').replace(/'/g, "\\'");
        tr.innerHTML = `
            <td style="font-weight:600;color:var(--text-primary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${post.title || '—'}</td>
            <td style="color:var(--text-secondary);">${post.authorName || 'Anonymous'}</td>
            <td><span class="preset-type-badge pc">♥ ${(post.upvotes||[]).length}</span></td>
            <td><span class="preset-type-badge pc" style="background:#f1f5f9;color:#475569;">💬 ${(post.comments||[]).length}</span></td>
            <td style="color:var(--text-secondary);">${date}</td>
            <td style="text-align:right;">
                <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;border-radius:6px;"
                    onclick="deleteShowcasePostAdmin('${post.id}', '${safeTitle}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteShowcasePostAdmin(postId, title) {
    if (!confirm(`Delete showcase post "${title}"? This cannot be undone.`)) return;
    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(`${API_BASE}/api/showcase/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            showToast('Showcase post deleted!');
            adminShowcasePosts = adminShowcasePosts.filter(p => p.id !== postId);
            document.getElementById('showcaseCount').textContent = `${adminShowcasePosts.length} posts`;
            renderAdminShowcaseTable();
        } else {
            showToast(json.message || 'Delete failed.', true);
        }
    } catch (e) {
        showToast('Network error deleting showcase post.', true);
    }
}

/* =============================================
   Users Manager
   ============================================= */
let adminUsers = [];

async function loadAdminUsers() {
    const container = document.getElementById('usersManager');
    container.innerHTML = `
        <div class="presets-header-row">
            <h2 style="font-size:24px;font-weight:700;color:var(--text-primary);letter-spacing:-0.5px;margin:0;">Manage Users</h2>
            <span style="font-size:13px;color:var(--text-secondary);font-weight:600;" id="usersCount">Loading...</span>
        </div>
        <div class="presets-filter-bar">
            <div style="flex-grow:1;">
                <input type="text" id="usersSearchInput" class="form-control" placeholder="Search by username or email..." style="padding:10px 14px;font-size:14px;" oninput="renderAdminUsersTable()">
            </div>
        </div>
        <div style="overflow-x:auto;margin-top:20px;border:1px solid var(--border-color);border-radius:12px;background:#fff;">
            <table class="presets-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th style="text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody id="usersTableBody">
                    <tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary);">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        adminUsers = json.success ? json.users : [];
        document.getElementById('usersCount').textContent = `${adminUsers.length} users`;
        renderAdminUsersTable();
    } catch (e) {
        document.getElementById('usersTableBody').innerHTML =
            `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--danger);">Failed to load users. Check that the /api/admin/users endpoint exists.</td></tr>`;
    }
}

function renderAdminUsersTable() {
    const query = (document.getElementById('usersSearchInput')?.value || '').toLowerCase();
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const filtered = adminUsers.filter(u => {
        return !query
            || (u.username || '').toLowerCase().includes(query)
            || (u.email || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary);">No users found.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(user => {
        const tr = document.createElement('tr');
        const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';
        const isBanned = user.banned === true;
        const roleLabel = user.role || 'member';

        let roleBadgeStyle = 'background:#f1f5f9;color:#475569;';
        if (roleLabel === 'admin')   roleBadgeStyle = 'background:rgba(102,34,186,0.08);color:var(--accent);';
        if (roleLabel === 'mod')     roleBadgeStyle = 'background:rgba(16,185,129,0.08);color:var(--success);';

        tr.style.opacity = isBanned ? '0.55' : '1';

        const safeUsername = (user.username || '').replace(/'/g, "\\'");
        tr.innerHTML = `
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${user.profilePic || 'https://api.dicebear.com/6.x/initials/svg?seed=' + (user.username||'U')}"
                        style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border-color);" loading="lazy">
                    <span style="font-weight:600;color:var(--text-primary);">${user.username || '—'}</span>
                    ${isBanned ? '<span style="font-size:10px;background:#fee2e2;color:#ef4444;padding:2px 6px;border-radius:4px;font-weight:700;">BANNED</span>' : ''}
                </div>
            </td>
            <td style="color:var(--text-secondary);font-size:13px;">${user.email || '—'}</td>
            <td><span class="preset-type-badge" style="${roleBadgeStyle}">${roleLabel}</span></td>
            <td style="color:var(--text-secondary);font-size:13px;">${joined}</td>
            <td style="text-align:right;">
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button class="btn btn-outline" style="padding:5px 10px;font-size:12px;border-radius:6px;"
                        onclick="toggleBanUser('${user.id}', '${safeUsername}', ${isBanned})">
                        ${isBanned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="btn btn-danger" style="padding:5px 10px;font-size:12px;border-radius:6px;"
                        onclick="deleteUserAdmin('${user.id}', '${safeUsername}')">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function toggleBanUser(userId, username, isBanned) {
    const action = isBanned ? 'unban' : 'ban';
    if (!confirm(`${isBanned ? 'Unban' : 'Ban'} user "${username}"?`)) return;

    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}/${action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            showToast(`User "${username}" has been ${action}ned.`);
            await loadAdminUsers();
        } else {
            showToast(json.message || 'Action failed.', true);
        }
    } catch (e) {
        showToast('Network error.', true);
    }
}

async function deleteUserAdmin(userId, username) {
    if (!confirm(`Permanently delete user "${username}"? This will remove their account and cannot be undone.`)) return;

    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            showToast(`User "${username}" deleted.`);
            adminUsers = adminUsers.filter(u => u.id !== userId);
            document.getElementById('usersCount').textContent = `${adminUsers.length} users`;
            renderAdminUsersTable();
        } else {
            showToast(json.message || 'Delete failed.', true);
        }
    } catch (e) {
        showToast('Network error deleting user.', true);
    }
}

// ==========================================
// CATEGORY SETTINGS LOGIC
// ==========================================

const DEFAULT_CATEGORIES = [
    "Start Here",
    "Softwares",
    "Plugins",
    "Preset Hub",
    "Useful Websites",
    "Frequently Asked Questions"
];

function openCategorySettingsModal() {
    const form = document.getElementById('categorySettingsForm');
    form.innerHTML = '';
    
    // Initialize if undefined
    if (!data._categories) {
        data._categories = {};
    }
    
    DEFAULT_CATEGORIES.forEach(catId => {
        const currentName = data._categories[catId] || catId;
        form.innerHTML += `
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="font-size: 12px; opacity: 0.8; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Original: ${catId}</label>
                <input type="text" class="form-control" data-cat-id="${catId}" value="${currentName.replace(/"/g, '&quot;')}">
            </div>
        `;
    });
    
    document.getElementById('categorySettingsModal').classList.add('active');
}

async function saveCategorySettings() {
    const inputs = document.querySelectorAll('#categorySettingsForm input');
    
    if (!data._categories) data._categories = {};
    
    inputs.forEach(input => {
        const catId = input.getAttribute('data-cat-id');
        const val = input.value.trim();
        if (val && val !== '') {
            data._categories[catId] = val;
        } else {
            // Revert to default if blank
            delete data._categories[catId];
        }
    });
    
    // Disable button to show loading state
    const btn = document.querySelector('#categorySettingsModal .btn-primary');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;
    
    try {
        await saveData(); // Call existing function
        showToast('Category settings saved! Refresh the main site to see changes.');
        closeModals();
    } catch (e) {
        showToast('Error saving category settings.', true);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// HOMEPAGE SETTINGS LOGIC
// ==========================================

function openHomepageSettingsModal() {
    if (!data.introduction || !data.introduction.content) return;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.introduction.content, 'text/html');
    
    // Parse Main Title
    const h1 = doc.querySelector('.intro-logo h1');
    document.getElementById('hpTitle').value = h1 ? h1.textContent.trim() : '';
    
    // Parse Subtitle
    const subtitle = doc.querySelector('.intro-subtitle');
    document.getElementById('hpSubtitle').value = subtitle ? subtitle.textContent.trim() : '';
    
    // Parse Category Cards
    const cards = Array.from(doc.querySelectorAll('.category-card'));
    const container = document.getElementById('hpCardsContainer');
    container.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const card = cards[i];
        const title = card ? (card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : '') : '';
        const desc = card ? (card.querySelector('p') ? card.querySelector('p').textContent.trim() : '') : '';
        const link = card ? card.getAttribute('href') : '';
        
        container.innerHTML += `
            <div class="glass-panel" style="padding: 15px; border-radius: 8px;">
                <h5 style="margin-bottom: 10px;">Card ${i + 1}</h5>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label style="font-size: 11px;">Title</label>
                    <input type="text" class="form-control" id="hpCardTitle${i}" value="${title.replace(/"/g, '&quot;')}">
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label style="font-size: 11px;">Description</label>
                    <textarea class="form-control" id="hpCardDesc${i}" rows="2" style="font-size: 12px;">${desc.replace(/</g, '&lt;')}</textarea>
                </div>
                <div class="form-group">
                    <label style="font-size: 11px;">Link (e.g. #forum)</label>
                    <input type="text" class="form-control" id="hpCardLink${i}" value="${link.replace(/"/g, '&quot;')}">
                </div>
            </div>
        `;
    }
    
    document.getElementById('homepageSettingsModal').classList.add('active');
}

async function saveHomepageSettings() {
    const title = document.getElementById('hpTitle').value.trim();
    const subtitle = document.getElementById('hpSubtitle').value.trim();
    
    let cardsHtml = '';
    for (let i = 0; i < 4; i++) {
        const cTitle = document.getElementById(`hpCardTitle${i}`).value.trim();
        const cDesc = document.getElementById(`hpCardDesc${i}`).value.trim();
        const cLink = document.getElementById(`hpCardLink${i}`).value.trim();
        
        if (cTitle || cDesc) {
            cardsHtml += `
                <a href="${cLink}" class="category-card">
                    <h3>${cTitle}</h3>
                    <p>${cDesc}</p>
                </a>`;
        }
    }
    
    const newHtml = `<div class="intro-logo">
                      <span class="logo-the">the</span> <h1>${title}</h1>
            </div>
            <p class="intro-subtitle">${subtitle}</p>
            
            <h2 class="category-section-title">Explore by categories</h2>
            <div class="categories-grid stagger-in">${cardsHtml}
            </div>`;
            
    if (!data.introduction) data.introduction = {};
    data.introduction.content = newHtml;
    
    const btn = document.getElementById('saveHomepageBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;
    
    try {
        await saveData();
        showToast('Homepage settings saved! Refresh the main site to see changes.');
        closeModals();
    } catch (e) {
        showToast('Error saving homepage settings.', true);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
