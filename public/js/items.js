/**
 * Items Client Handlers (Reporting, Discovery, Filtering, Details)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Populate dropdowns if forms exist
  const catSelect = document.getElementById('item-category-select');
  const locSelect = document.getElementById('item-location-select');
  if (catSelect || locSelect) {
    await loadMetadataDropdowns();
  }

  // Setup Report Lost / Found Forms
  const reportForm = document.getElementById('report-item-form');
  if (reportForm) {
    requireAuth();
    reportForm.addEventListener('submit', handleReportItemSubmit);
    setupImagePreview();
  }

  // Setup Browse Items Page
  const browseContainer = document.getElementById('browse-items-grid');
  if (browseContainer) {
    await loadMetadataDropdowns();
    setupBrowseFilters();
    await fetchBrowseItems(1);
  }

  // Setup Item Details Page
  const detailsRoot = document.getElementById('item-details-root');
  if (detailsRoot) {
    await loadItemDetails();
  }

  // Setup My Reports Page
  const myReportsRoot = document.getElementById('my-reports-root');
  if (myReportsRoot) {
    requireAuth();
    await loadMyReports();
  }
});

// Load Categories & Locations into Dropdowns
async function loadMetadataDropdowns() {
  try {
    const res = await fetch('/api/items/metadata');
    const data = await res.json();
    if (!data.success) return;

    const catSelects = document.querySelectorAll('.category-dropdown');
    const locSelects = document.querySelectorAll('.location-dropdown');

    catSelects.forEach(sel => {
      const currentVal = sel.value;
      const defaultOption = sel.firstElementChild ? sel.firstElementChild.outerHTML : '<option value="">All Categories</option>';
      sel.innerHTML = defaultOption + data.categories.map(c => `
        <option value="${c.category_id}" ${currentVal == c.category_id ? 'selected' : ''}>${escapeHtml(c.category_name)}</option>
      `).join('');
    });

    locSelects.forEach(sel => {
      const currentVal = sel.value;
      const defaultOption = sel.firstElementChild ? sel.firstElementChild.outerHTML : '<option value="">All Locations</option>';
      sel.innerHTML = defaultOption + data.locations.map(l => `
        <option value="${l.location_id}" ${currentVal == l.location_id ? 'selected' : ''}>${escapeHtml(l.location_name)} (${escapeHtml(l.building_name || '')})</option>
      `).join('');
    });
  } catch (err) {
    console.error('Failed to load categories/locations metadata:', err);
  }
}

// Setup photo preview
function setupImagePreview() {
  const fileInput = document.getElementById('item-image-input');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImg = document.getElementById('image-preview');

  if (fileInput && previewContainer && previewImg) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => {
          previewImg.src = e.target.result;
          previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        previewContainer.style.display = 'none';
      }
    });
  }
}

// Submit Lost or Found Report (Calls Procedure SubmitItemReport)
async function handleReportItemSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Submitting report...';

  const formData = new FormData(form);

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message || 'Report submitted successfully!', 'success');
      setTimeout(() => {
        window.location.href = `/pages/item-details.html?id=${data.item_id}`;
      }, 700);
    } else {
      showToast(data.message || 'Submission failed.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerText = 'Submit Report';
    }
  } catch (err) {
    showToast('Network error submitting report.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Submit Report';
  }
}

// Setup search & filters on Browse page
let browseCurrentPage = 1;
function setupBrowseFilters() {
  const filterForm = document.getElementById('browse-filters-form');
  if (filterForm) {
    filterForm.addEventListener('submit', e => {
      e.preventDefault();
      fetchBrowseItems(1);
    });

    const inputs = filterForm.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', () => fetchBrowseItems(1));
    });

    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterForm.reset();
        fetchBrowseItems(1);
      });
    }
  }
}

// Fetch Items with Filters & Pagination
async function fetchBrowseItems(page = 1) {
  browseCurrentPage = page;
  const grid = document.getElementById('browse-items-grid');
  const paginationContainer = document.getElementById('browse-pagination');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--slate-400);">Loading items...</div>';

  const filterForm = document.getElementById('browse-filters-form');
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', 9);

  if (filterForm) {
    if (filterForm.q?.value) params.set('q', filterForm.q.value);
    if (filterForm.type?.value) params.set('type', filterForm.type.value);
    if (filterForm.category_id?.value) params.set('category_id', filterForm.category_id.value);
    if (filterForm.location_id?.value) params.set('location_id', filterForm.location_id.value);
    if (filterForm.status?.value) params.set('status', filterForm.status.value);
  }

  try {
    const res = await fetch(`/api/items?${params.toString()}`);
    const data = await res.json();

    if (data.success) {
      renderBrowseItems(data.data);
      renderPagination(data.pagination);
    } else {
      grid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger); text-align: center;">${escapeHtml(data.message)}</div>`;
    }
  } catch (err) {
    grid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align: center;">Failed to load items.</div>';
  }
}

function renderBrowseItems(items) {
  const grid = document.getElementById('browse-items-grid');
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: var(--radius-lg); border: 1px solid var(--slate-200);">
        <p style="font-size: 1.1rem; font-weight: 600; color: var(--slate-700);">No items found</p>
        <p style="color: var(--slate-500); font-size: 0.9rem; margin-top: 0.25rem;">Try adjusting your search criteria or filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => `
    <div class="item-card">
      <div class="item-card-image">
        ${item.image_url
          ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">`
          : `<div class="placeholder-icon">${item.item_type === 'LOST' ? '🔍' : '📦'}</div>`}
      </div>
      <div class="item-card-body">
        <div class="item-card-header">
          <span class="badge ${item.item_type === 'LOST' ? 'badge-lost' : 'badge-found'}">${item.item_type}</span>
          <span class="badge badge-${item.status.toLowerCase()}">${item.status}</span>
        </div>
        <h3 class="item-card-title">${escapeHtml(item.title)}</h3>
        <p class="item-card-desc">${escapeHtml(item.description || 'No description provided.')}</p>
        <div class="item-card-meta">
          <div>📁 <strong>Category:</strong> ${escapeHtml(item.category_name)}</div>
          <div>📍 <strong>Location:</strong> ${escapeHtml(item.location_name)}</div>
          <div>📅 <strong>Date:</strong> ${formatDate(item.item_date)}</div>
        </div>
        <div class="item-card-footer">
          <a href="/pages/item-details.html?id=${item.item_id}" class="btn btn-outline-primary btn-sm" style="width: 100%;">View Details</a>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPagination({ page, totalPages, total }) {
  const container = document.getElementById('browse-pagination');
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = `<div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 2rem;">`;

  if (page > 1) {
    html += `<button class="btn btn-secondary btn-sm" onclick="fetchBrowseItems(${page - 1})">← Previous</button>`;
  }

  html += `<span style="font-size: 0.875rem; color: var(--slate-600); margin: 0 0.5rem;">Page ${page} of ${totalPages} (${total} total)</span>`;

  if (page < totalPages) {
    html += `<button class="btn btn-secondary btn-sm" onclick="fetchBrowseItems(${page + 1})">Next →</button>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// Load Item Details by ID
async function loadItemDetails() {
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');

  if (!itemId) {
    window.location.href = '/pages/browse-items.html';
    return;
  }

  try {
    const res = await fetch(`/api/items/${itemId}`);
    const data = await res.json();

    if (!data.success) {
      document.getElementById('item-details-root').innerHTML = `
        <div class="alert alert-danger">${escapeHtml(data.message || 'Item not found')}</div>
        <a href="/pages/browse-items.html" class="btn btn-secondary">Back to Listings</a>
      `;
      return;
    }

    const { item, userClaim, isOwner } = data;
    renderItemDetailsPage(item, userClaim, isOwner);
  } catch (err) {
    showToast('Failed to load item details', 'error');
  }
}

function renderItemDetailsPage(item, userClaim, isOwner) {
  const root = document.getElementById('item-details-root');
  if (!root) return;

  const isAdmin = currentUser && currentUser.role === 'ADMIN';
  const isFound = item.item_type === 'FOUND';
  const isClaimable = isFound && ['OPEN', 'CLAIM_PENDING'].includes(item.status) && !isOwner;

  root.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <a href="/pages/browse-items.html" class="btn btn-secondary btn-sm">← Back to Listings</a>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem; background: #fff; padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--slate-200); box-shadow: var(--shadow-sm);">
      <div>
        <div style="height: 320px; background-color: var(--slate-100); border-radius: var(--radius); overflow: hidden; display: flex; align-items: center; justify-content: center;">
          ${item.image_url
            ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div style="font-size: 5rem; color: var(--slate-300);">${item.item_type === 'LOST' ? '🔍' : '📦'}</div>`}
        </div>
      </div>

      <div>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
          <span class="badge ${item.item_type === 'LOST' ? 'badge-lost' : 'badge-found'}">${item.item_type}</span>
          <span class="badge badge-${item.status.toLowerCase()}">${item.status}</span>
        </div>

        <h1 style="font-size: 1.65rem; font-weight: 700; color: var(--slate-900); margin-bottom: 0.75rem;">${escapeHtml(item.title)}</h1>

        <div style="font-size: 0.95rem; color: var(--slate-600); margin-bottom: 1.5rem; line-height: 1.6;">
          ${escapeHtml(item.description || 'No description provided.')}
        </div>

        <div style="background-color: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius); padding: 1rem; margin-bottom: 1.5rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
            <div><strong>Category:</strong> ${escapeHtml(item.category_name)}</div>
            <div><strong>Location:</strong> ${escapeHtml(item.location_name)}</div>
            <div><strong>Building:</strong> ${escapeHtml(item.building_name || 'N/A')}</div>
            <div><strong>Floor:</strong> ${escapeHtml(item.floor_number || 'N/A')}</div>
            <div><strong>Date Reported:</strong> ${formatDate(item.item_date)}</div>
            <div><strong>Reported By:</strong> ${escapeHtml(item.reporter_name)}</div>
          </div>
        </div>

        <div id="item-actions-box">
          ${userClaim ? `
            <div class="alert alert-info" style="margin-bottom: 1rem;">
              <strong>Your Claim Status:</strong> <span class="badge badge-${userClaim.claim_status.toLowerCase()}">${userClaim.claim_status}</span>
              ${userClaim.admin_note ? `<div style="font-size: 0.8rem; margin-top: 0.4rem;"><strong>Admin Note:</strong> ${escapeHtml(userClaim.admin_note)}</div>` : ''}
            </div>
          ` : ''}

          ${isClaimable && !userClaim ? `
            <a href="/pages/submit-claim.html?item_id=${item.item_id}" class="btn btn-primary btn-lg" style="width: 100%; margin-bottom: 0.75rem;">
              Claim Ownership of This Item
            </a>
          ` : ''}

          ${(isOwner || isAdmin) && item.status !== 'CLAIMED' && item.status !== 'CLOSED' ? `
            <button onclick="handleCloseReport(${item.item_id})" class="btn btn-secondary btn-sm">Close This Report</button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// Close Report confirmation
function handleCloseReport(itemId) {
  showConfirmDialog({
    title: 'Close Item Report',
    message: 'Are you sure you want to close this item report? It will no longer appear in active discovery.',
    confirmText: 'Yes, Close Report',
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/items/${itemId}/close`, { method: 'PATCH' });
        const data = await res.json();
        if (data.success) {
          showToast('Report closed successfully', 'success');
          loadItemDetails();
        } else {
          showToast(data.message || 'Failed to close report', 'error');
        }
      } catch (err) {
        showToast('Network error closing report', 'error');
      }
    }
  });
}

// Load My Reports
async function loadMyReports() {
  const container = document.getElementById('my-reports-list');
  if (!container) return;

  try {
    const res = await fetch('/api/items/my-reports');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--slate-400); padding: 3rem;">
            You have not submitted any reports yet.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = data.data.map(r => `
      <tr>
        <td><span class="badge ${r.item_type === 'LOST' ? 'badge-lost' : 'badge-found'}">${r.item_type}</span></td>
        <td>
          <a href="/pages/item-details.html?id=${r.item_id}" style="font-weight: 600;">${escapeHtml(r.title)}</a>
          <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(r.category_name)} • ${escapeHtml(r.location_name)}</div>
        </td>
        <td>${formatDate(r.item_date)}</td>
        <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
        <td>
          <span style="font-size: 0.85rem; color: var(--slate-700);">
            ${r.item_type === 'FOUND' ? `${r.claim_count} claim(s)` : `${r.match_count} match(es)`}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <a href="/pages/item-details.html?id=${r.item_id}" class="btn btn-secondary btn-sm">View</a>
            ${r.status === 'OPEN' ? `<button onclick="handleCloseReport(${r.item_id})" class="btn btn-secondary btn-sm">Close</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load reports', 'error');
  }
}
