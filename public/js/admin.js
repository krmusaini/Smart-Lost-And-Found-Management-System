/**
 * Administrative Management Modules (Users, Categories, Locations, Handovers, Analytics)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Manage Users Page
  if (document.getElementById('manage-users-root')) {
    requireAuth('ADMIN');
    setupUserFilters();
    await loadUsersList();
  }

  // Manage Categories Page
  if (document.getElementById('manage-categories-root')) {
    requireAuth('ADMIN');
    await loadCategoriesList();
    setupCategoryForm();
  }

  // Manage Locations Page
  if (document.getElementById('manage-locations-root')) {
    requireAuth('ADMIN');
    await loadLocationsList();
    setupLocationForm();
  }

  // Manage Items Page
  if (document.getElementById('manage-items-root')) {
    requireAuth('ADMIN');
    await loadAdminItemsList();
  }

  // Handovers Page
  if (document.getElementById('handovers-root')) {
    requireAuth('ADMIN');
    await loadPendingHandovers();
    await loadCompletedHandovers();
    setupHandoverForm();
  }

  // Reports & Analytics Page
  if (document.getElementById('reports-root')) {
    requireAuth('ADMIN');
    await loadAdvancedReports();
    setupReportsFilter();
  }
});

/* =====================================================================
   MODULE: USERS MANAGEMENT
   ===================================================================== */
function setupUserFilters() {
  const form = document.getElementById('users-filter-form');
  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); loadUsersList(); });
    form.querySelectorAll('select, input').forEach(el => el.addEventListener('change', () => loadUsersList()));
  }
}

async function loadUsersList() {
  const container = document.getElementById('users-table-body');
  if (!container) return;

  const form = document.getElementById('users-filter-form');
  const params = new URLSearchParams();
  if (form) {
    if (form.role?.value) params.set('role', form.role.value);
    if (form.search?.value) params.set('search', form.search.value);
  }

  try {
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--slate-400); padding: 3rem;">No users found.</td></tr>';
      return;
    }

    container.innerHTML = data.data.map(u => `
      <tr>
        <td>#${u.user_id}</td>
        <td style="font-weight: 600;">${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="user-role-tag">${u.role}</span></td>
        <td><strong>${u.items_reported}</strong> report(s)</td>
        <td><strong>${u.items_recovered}</strong> recovered</td>
        <td>
          <button onclick="handleToggleUserRole(${u.user_id}, '${u.role === 'ADMIN' ? 'STUDENT' : 'ADMIN'}')" class="btn btn-secondary btn-sm">
            ${u.role === 'ADMIN' ? 'Demote to Student' : 'Promote to Admin'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load users list', 'error');
  }
}

async function handleToggleUserRole(userId, newRole) {
  showConfirmDialog({
    title: 'Confirm Role Change',
    message: `Are you sure you want to change this user's role to ${newRole}?`,
    confirmText: 'Change Role',
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          loadUsersList();
        } else {
          showToast(data.message || 'Failed to update role', 'error');
        }
      } catch (err) {
        showToast('Error updating role', 'error');
      }
    }
  });
}

/* =====================================================================
   MODULE: CATEGORIES MANAGEMENT
   ===================================================================== */
async function loadCategoriesList() {
  const container = document.getElementById('categories-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/categories');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No categories found.</td></tr>';
      return;
    }

    container.innerHTML = data.data.map(c => `
      <tr>
        <td>#${c.category_id}</td>
        <td style="font-weight: 600;">${escapeHtml(c.category_name)}</td>
        <td style="color: var(--slate-600);">${escapeHtml(c.description || 'N/A')}</td>
        <td><span class="badge badge-open">${c.item_count} items</span></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button onclick="promptEditCategory(${c.category_id}, '${escapeHtml(c.category_name)}', '${escapeHtml(c.description || '')}')" class="btn btn-secondary btn-sm">Edit</button>
            <button onclick="handleDeleteCategory(${c.category_id})" class="btn btn-danger btn-sm" ${c.item_count > 0 ? 'disabled title="Cannot delete category linked to items"' : ''}>Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load categories', 'error');
  }
}

function setupCategoryForm() {
  const form = document.getElementById('add-category-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = form.category_name.value.trim();
      const desc = form.description.value.trim();

      try {
        const res = await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_name: name, description: desc })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          form.reset();
          loadCategoriesList();
        } else {
          showToast(data.message || 'Failed to create category', 'error');
        }
      } catch (err) {
        showToast('Error saving category', 'error');
      }
    });
  }
}

function promptEditCategory(id, currentName, currentDesc) {
  const newName = prompt('Update Category Name:', currentName);
  if (!newName) return;
  const newDesc = prompt('Update Category Description:', currentDesc);

  fetch(`/api/admin/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_name: newName, description: newDesc })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        loadCategoriesList();
      } else {
        showToast(data.message || 'Update failed', 'error');
      }
    });
}

function handleDeleteCategory(id) {
  showConfirmDialog({
    title: 'Delete Category',
    message: 'Are you sure you want to delete this category?',
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          loadCategoriesList();
        } else {
          showToast(data.message || 'Cannot delete category', 'error');
        }
      } catch (err) {
        showToast('Error deleting category', 'error');
      }
    }
  });
}

/* =====================================================================
   MODULE: LOCATIONS MANAGEMENT
   ===================================================================== */
async function loadLocationsList() {
  const container = document.getElementById('locations-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/locations');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No locations found.</td></tr>';
      return;
    }

    container.innerHTML = data.data.map(l => `
      <tr>
        <td>#${l.location_id}</td>
        <td style="font-weight: 600;">${escapeHtml(l.location_name)}</td>
        <td>${escapeHtml(l.building_name || 'N/A')}</td>
        <td>${escapeHtml(l.floor_number || 'N/A')}</td>
        <td><span class="badge badge-open">${l.item_count} items</span></td>
        <td>
          <button onclick="handleDeleteLocation(${l.location_id})" class="btn btn-danger btn-sm" ${l.item_count > 0 ? 'disabled title="Cannot delete location associated with items"' : ''}>Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load locations', 'error');
  }
}

function setupLocationForm() {
  const form = document.getElementById('add-location-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const location_name = form.location_name.value.trim();
      const building_name = form.building_name.value.trim();
      const floor_number = form.floor_number.value.trim();
      const description = form.description.value.trim();

      try {
        const res = await fetch('/api/admin/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location_name, building_name, floor_number, description })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          form.reset();
          loadLocationsList();
        } else {
          showToast(data.message || 'Failed to add location', 'error');
        }
      } catch (err) {
        showToast('Error adding location', 'error');
      }
    });
  }
}

function handleDeleteLocation(id) {
  showConfirmDialog({
    title: 'Delete Location',
    message: 'Are you sure you want to delete this campus location?',
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/admin/locations/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          loadLocationsList();
        } else {
          showToast(data.message || 'Cannot delete location', 'error');
        }
      } catch (err) {
        showToast('Error deleting location', 'error');
      }
    }
  });
}

/* =====================================================================
   MODULE: ITEM HANDOVERS (Stored Procedure RecordItemHandover)
   ===================================================================== */
async function loadPendingHandovers() {
  const selectEl = document.getElementById('handover-claim-select');
  const alertContainer = document.getElementById('pending-handovers-alert');
  if (!selectEl) return;

  try {
    const res = await fetch('/api/handovers/pending');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      selectEl.innerHTML = '<option value="">No approved claims awaiting handover</option>';
      selectEl.disabled = true;
      if (alertContainer) {
        alertContainer.innerHTML = '<div class="alert alert-info">There are currently no approved claims pending physical handover.</div>';
      }
      return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML = '<option value="">Select an Approved Claim to Process...</option>' + data.data.map(c => `
      <option value="${c.claim_id}" data-item-id="${c.item_id}" data-item-title="${escapeHtml(c.item_title)}" data-claimant="${escapeHtml(c.claimant_name)}">
        Claim #${c.claim_id}: ${escapeHtml(c.item_title)} → Recipient: ${escapeHtml(c.claimant_name)} (${escapeHtml(c.claimant_email)})
      </option>
    `).join('');
  } catch (err) {
    showToast('Failed to load pending handovers', 'error');
  }
}

function setupHandoverForm() {
  const form = document.getElementById('record-handover-form');
  const selectEl = document.getElementById('handover-claim-select');

  if (form && selectEl) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const selectedOption = selectEl.options[selectEl.selectedIndex];
      const claimId = selectEl.value;
      const itemId = selectedOption.getAttribute('data-item-id');
      const remarks = form.remarks.value.trim();

      if (!claimId || !itemId) {
        showToast('Please select a valid approved claim', 'warning');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Executing Transaction...';

      try {
        const res = await fetch('/api/handovers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, claim_id: claimId, remarks })
        });
        const data = await res.json();

        if (data.success) {
          showToast(data.message, 'success');
          form.reset();
          await loadPendingHandovers();
          await loadCompletedHandovers();
        } else {
          showToast(data.message || 'Handover execution failed', 'error');
        }
      } catch (err) {
        showToast('Error recording handover', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Record Handover & Mark Claimed';
      }
    });
  }
}

async function loadCompletedHandovers() {
  const container = document.getElementById('completed-handovers-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/handovers');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--slate-400); padding: 3rem;">No completed handovers recorded yet.</td></tr>';
      return;
    }

    container.innerHTML = data.data.map(h => `
      <tr>
        <td>#${h.handover_id}</td>
        <td>
          <a href="/pages/item-details.html?id=${h.item_id}" target="_blank" style="font-weight: 600;">${escapeHtml(h.item_title)}</a>
          <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(h.category_name)} • Found by ${escapeHtml(h.original_reporter_name)}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(h.claimant_name)}</div>
          <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(h.claimant_email)}</div>
        </td>
        <td>${escapeHtml(h.admin_name)}</td>
        <td>${new Date(h.handover_date).toLocaleString()}</td>
        <td style="font-size: 0.85rem; color: var(--slate-600); max-width: 250px;">${escapeHtml(h.handover_remarks || 'Handover completed')}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load handover history', 'error');
  }
}

/* =====================================================================
   MODULE: ADVANCED SQL REPORTS & ANALYTICS
   ===================================================================== */
function setupReportsFilter() {
  const form = document.getElementById('reports-filter-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      loadAdvancedReports();
    });
  }
}

async function loadAdvancedReports() {
  const form = document.getElementById('reports-filter-form');
  const params = new URLSearchParams();
  if (form) {
    if (form.year?.value) params.set('year', form.year.value);
    if (form.month?.value) params.set('month', form.month.value);
  }

  try {
    const res = await fetch(`/api/admin/reports?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const { monthlyTrends, categoryBreakdown, activeStudents, unclaimedItems } = data;

    // 1. Render Monthly Trends (Query 8: CTE)
    const trendsContainer = document.getElementById('report-monthly-trends-body');
    if (trendsContainer) {
      trendsContainer.innerHTML = monthlyTrends.map(t => `
        <tr>
          <td style="font-weight: 600;">${t.report_month}</td>
          <td>${t.lost_items}</td>
          <td>${t.found_items}</td>
          <td><strong style="color: var(--success);">${t.recovered_items}</strong></td>
          <td>${t.total_items}</td>
          <td><span class="badge ${t.recovery_rate >= 50 ? 'badge-claimed' : 'badge-pending'}">${t.recovery_rate}%</span></td>
        </tr>
      `).join('');
    }

    // 2. Render Most Active Students (Query 9: Window Function DENSE_RANK)
    const studentsContainer = document.getElementById('report-active-students-body');
    if (studentsContainer) {
      studentsContainer.innerHTML = activeStudents.map(s => `
        <tr>
          <td><strong>#${s.rank_position}</strong></td>
          <td style="font-weight: 600;">${escapeHtml(s.student_name)}</td>
          <td>${escapeHtml(s.email)}</td>
          <td>${s.total_items_reported}</td>
          <td>${s.total_claims_made}</td>
          <td><span class="badge badge-open">${s.activity_score} pts</span></td>
        </tr>
      `).join('');
    }

    // 3. Render Category Recovery Breakdown (Query 5: GROUP BY / Aggregates)
    const catContainer = document.getElementById('report-category-breakdown-body');
    if (catContainer) {
      catContainer.innerHTML = categoryBreakdown.map(c => `
        <tr>
          <td style="font-weight: 600;">${escapeHtml(c.category_name)}</td>
          <td>${c.total_reports}</td>
          <td>${c.lost_count}</td>
          <td>${c.found_count}</td>
          <td><strong>${c.recovered_count}</strong></td>
          <td><span class="badge ${c.recovery_rate >= 50 ? 'badge-claimed' : 'badge-open'}">${c.recovery_rate}%</span></td>
        </tr>
      `).join('');
    }

    // 4. Render Unclaimed Found Items (Query 6: Subquery NOT EXISTS)
    const unclaimedContainer = document.getElementById('report-unclaimed-items-body');
    if (unclaimedContainer) {
      unclaimedContainer.innerHTML = unclaimedItems.map(u => `
        <tr>
          <td>#${u.item_id}</td>
          <td><a href="/pages/item-details.html?id=${u.item_id}" target="_blank" style="font-weight: 600;">${escapeHtml(u.title)}</a></td>
          <td>${escapeHtml(u.category_name)}</td>
          <td>${escapeHtml(u.location_name)}</td>
          <td>${formatDate(u.item_date)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    showToast('Failed to load SQL analytical reports', 'error');
  }
}

// Load Admin Item Reports List
async function loadAdminItemsList() {
  const container = document.getElementById('admin-items-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/items?status=ALL&limit=50');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--slate-400); padding: 3rem;">No items recorded in database.</td></tr>';
      return;
    }

    container.innerHTML = data.data.map(i => `
      <tr>
        <td>#${i.item_id}</td>
        <td><span class="badge ${i.item_type === 'LOST' ? 'badge-lost' : 'badge-found'}">${i.item_type}</span></td>
        <td>
          <a href="/pages/item-details.html?id=${i.item_id}" target="_blank" style="font-weight: 600;">${escapeHtml(i.title)}</a>
          <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(i.category_name)} • ${escapeHtml(i.location_name)}</div>
        </td>
        <td>${escapeHtml(i.reporter_name)}</td>
        <td>${formatDate(i.item_date)}</td>
        <td><span class="badge badge-${i.status.toLowerCase()}">${i.status}</span></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <a href="/pages/item-details.html?id=${i.item_id}" class="btn btn-secondary btn-sm">Inspect</a>
            ${i.status === 'OPEN' ? `<button onclick="handleCloseReport(${i.item_id})" class="btn btn-secondary btn-sm">Close</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load item reports', 'error');
  }
}
