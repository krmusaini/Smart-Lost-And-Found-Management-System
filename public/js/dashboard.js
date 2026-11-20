/**
 * Dashboard Client Handlers (Student & Admin Dashboards)
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('student-dashboard-root')) {
    requireAuth('STUDENT');
    await loadStudentDashboard();
  }

  if (document.getElementById('admin-dashboard-root')) {
    requireAuth('ADMIN');
    await loadAdminDashboard();
  }
});

// Load Student Dashboard data
async function loadStudentDashboard() {
  const user = await checkSession();
  if (!user) return;

  const welcomeEl = document.getElementById('student-welcome-name');
  if (welcomeEl) welcomeEl.innerText = user.name;

  // Stored Function metric values
  const totalItemsEl = document.getElementById('stat-my-reports');
  const totalRecoveriesEl = document.getElementById('stat-my-recoveries');

  if (totalItemsEl) totalItemsEl.innerText = user.stats?.total_items || 0;
  if (totalRecoveriesEl) totalRecoveriesEl.innerText = user.stats?.total_recoveries || 0;

  // Fetch student's recent reports
  try {
    const res = await fetch('/api/items/my-reports');
    const data = await res.json();
    if (data.success) {
      renderStudentReportsList(data.data.slice(0, 5));
    }
  } catch (err) {
    console.error('Failed to load student reports:', err);
  }

  // Fetch student's recent claims
  try {
    const res = await fetch('/api/claims/my-claims');
    const data = await res.json();
    if (data.success) {
      const claimsCountEl = document.getElementById('stat-my-claims');
      if (claimsCountEl) claimsCountEl.innerText = data.data.length;
      renderStudentClaimsList(data.data.slice(0, 5));
    }
  } catch (err) {
    console.error('Failed to load student claims:', err);
  }

  // Fetch suggested matches count
  try {
    const res = await fetch('/api/matches/my-matches');
    const data = await res.json();
    if (data.success) {
      const matchesCountEl = document.getElementById('stat-my-matches');
      if (matchesCountEl) matchesCountEl.innerText = data.data.length;
    }
  } catch (err) {
    console.error('Failed to load student matches:', err);
  }
}

function renderStudentReportsList(reports) {
  const container = document.getElementById('student-recent-reports');
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--slate-400); padding: 2rem;">
          You have not submitted any reports yet. Use the buttons above to report lost or found items.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = reports.map(r => `
    <tr>
      <td>
        <span class="badge ${r.item_type === 'LOST' ? 'badge-lost' : 'badge-found'}">${r.item_type}</span>
      </td>
      <td>
        <a href="/pages/item-details.html?id=${r.item_id}" style="font-weight: 600;">${escapeHtml(r.title)}</a>
        <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(r.category_name)} • ${escapeHtml(r.location_name)}</div>
      </td>
      <td>${formatDate(r.item_date)}</td>
      <td>
        <span class="badge badge-${r.status.toLowerCase()}">${r.status}</span>
      </td>
      <td>
        <a href="/pages/item-details.html?id=${r.item_id}" class="btn btn-secondary btn-sm">View</a>
      </td>
    </tr>
  `).join('');
}

function renderStudentClaimsList(claims) {
  const container = document.getElementById('student-recent-claims');
  if (!container) return;

  if (claims.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--slate-400); padding: 2rem;">
          No ownership claims submitted yet.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = claims.map(c => `
    <tr>
      <td>
        <a href="/pages/item-details.html?id=${c.item_id}" style="font-weight: 600;">${escapeHtml(c.item_title)}</a>
        <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(c.category_name)}</div>
      </td>
      <td>${formatDate(c.claim_date)}</td>
      <td>
        <span class="badge ${c.claim_status === 'APPROVED' ? 'badge-claimed' : (c.claim_status === 'REJECTED' ? 'badge-lost' : 'badge-pending')}">
          ${c.claim_status}
        </span>
      </td>
      <td style="font-size: 0.8rem; color: var(--slate-600); max-width: 200px;">
        ${escapeHtml(c.admin_note || 'Awaiting review')}
      </td>
      <td>
        <a href="/pages/item-details.html?id=${c.item_id}" class="btn btn-secondary btn-sm">Item Details</a>
      </td>
    </tr>
  `).join('');
}

// Load Admin Dashboard data
async function loadAdminDashboard() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const { stats, categories, activity } = data;

    // Populate Key Metrics
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val !== undefined ? val : 0;
    };

    setVal('admin-stat-students', stats.total_students);
    setVal('admin-stat-lost', stats.total_lost);
    setVal('admin-stat-found', stats.total_found);
    setVal('admin-stat-open', stats.total_open);
    setVal('admin-stat-recovered', stats.total_recovered);
    setVal('admin-stat-recovery-rate', `${stats.recovery_percentage}%`);
    setVal('admin-stat-pending-claims', stats.pending_claims);
    setVal('admin-stat-approved-claims', stats.approved_claims);

    // Populate Category Distribution
    const catContainer = document.getElementById('admin-category-distribution');
    if (catContainer) {
      catContainer.innerHTML = categories.map(c => `
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.25rem;">
            <span>${escapeHtml(c.category_name)}</span>
            <span style="color: var(--slate-500);">${c.item_count} items</span>
          </div>
          <div style="height: 6px; background-color: var(--slate-100); border-radius: var(--radius-full); overflow: hidden;">
            <div style="height: 100%; width: ${stats.total_lost + stats.total_found > 0 ? (c.item_count / (stats.total_lost + stats.total_found) * 100) : 0}%; background-color: var(--primary); border-radius: var(--radius-full);"></div>
          </div>
        </div>
      `).join('');
    }

    // Populate Activity Timeline (Query 11: UNION ALL)
    const actContainer = document.getElementById('admin-recent-activity');
    if (actContainer) {
      if (activity.length === 0) {
        actContainer.innerHTML = '<li style="color: var(--slate-400); padding: 1rem 0;">No recent campus activity recorded.</li>';
      } else {
        actContainer.innerHTML = activity.map(a => `
          <li class="activity-item">
            <div class="activity-dot" style="${a.type === 'HANDOVER' ? 'background-color: var(--success);' : (a.type === 'CLAIM' ? 'background-color: var(--warning);' : '')}"></div>
            <div class="activity-content">
              <div class="activity-title">${escapeHtml(a.title)}</div>
              <div class="activity-meta">By ${escapeHtml(a.actor)} • ${new Date(a.event_time).toLocaleString()}</div>
            </div>
          </li>
        `).join('');
      }
    }
  } catch (err) {
    showToast('Failed to load administrative analytics', 'error');
  }
}
