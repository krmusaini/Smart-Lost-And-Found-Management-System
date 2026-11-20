/**
 * Smart Item Matches Client Handlers
 */

document.addEventListener('DOMContentLoaded', async () => {
  const matchesRoot = document.getElementById('matches-root');
  if (matchesRoot) {
    const user = await checkSession();
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    if (user.role === 'ADMIN') {
      await loadAdminMatches();
      const triggerBtn = document.getElementById('trigger-matching-btn');
      if (triggerBtn) {
        triggerBtn.addEventListener('click', handleTriggerMatching);
      }
    } else {
      await loadStudentMatches();
    }
  }
});

// Load Student Matches
async function loadStudentMatches() {
  const container = document.getElementById('student-matches-container');
  const countEl = document.getElementById('matches-count-badge');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--slate-400);">Scanning lost & found records for potential matches...</div>';

  try {
    const res = await fetch('/api/matches/my-matches');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      if (countEl) countEl.innerText = '0 Matches';
      container.innerHTML = `
        <div style="background: #fff; padding: 3rem; text-align: center; border-radius: var(--radius-lg); border: 1px solid var(--slate-200);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔍</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800);">No Potential Matches Found</h3>
          <p style="color: var(--slate-500); font-size: 0.9rem; max-width: 500px; margin: 0.5rem auto 1.5rem auto;">
            Our automated rule-based matching algorithm checks reports based on category, date, location proximity, and keywords. As new lost and found reports are submitted, potential matches will automatically appear here.
          </p>
          <a href="/pages/browse-items.html" class="btn btn-secondary btn-sm">Browse All Active Listings</a>
        </div>
      `;
      return;
    }

    if (countEl) countEl.innerText = `${data.data.length} Match(es) Found`;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${data.data.map(m => `
          <div class="card" style="margin-bottom: 0; border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span class="badge ${m.match_score >= 80 ? 'badge-claimed' : 'badge-pending'}" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;">
                  ⭐ ${m.match_score}% Match Score
                </span>
                <span style="font-size: 0.85rem; color: var(--slate-500);">Category: <strong>${escapeHtml(m.category_name)}</strong></span>
              </div>
              <span class="badge badge-${m.match_status.toLowerCase()}">${m.match_status}</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; background: var(--slate-50); padding: 1.25rem; border-radius: var(--radius); border: 1px solid var(--slate-200); margin-bottom: 1rem;">
              <div>
                <span class="badge ${m.my_item_type === 'LOST' ? 'badge-lost' : 'badge-found'}" style="margin-bottom: 0.5rem;">
                  Your Report (${m.my_item_type})
                </span>
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--slate-900);">${escapeHtml(m.my_item_title)}</h4>
                <a href="/pages/item-details.html?id=${m.my_item_id}" class="btn btn-secondary btn-sm" style="margin-top: 0.75rem;">View Your Report</a>
              </div>

              <div>
                <span class="badge ${m.matched_item_type === 'LOST' ? 'badge-lost' : 'badge-found'}" style="margin-bottom: 0.5rem;">
                  Potential Match (${m.matched_item_type})
                </span>
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--slate-900);">${escapeHtml(m.matched_item_title)}</h4>
                <div style="font-size: 0.825rem; color: var(--slate-600); margin: 0.3rem 0;">
                  📍 Location: ${escapeHtml(m.matched_item_location)} • 📅 Date: ${formatDate(m.matched_item_date)}
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                  <a href="/pages/item-details.html?id=${m.matched_item_id}" class="btn btn-outline-primary btn-sm">Inspect Details</a>
                  ${m.matched_item_type === 'FOUND' ? `
                    <a href="/pages/submit-claim.html?item_id=${m.matched_item_id}" class="btn btn-primary btn-sm">Claim This Item</a>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    showToast('Failed to load item matches', 'error');
  }
}

// Load Admin Matches
async function loadAdminMatches() {
  const container = document.getElementById('admin-matches-table-body');
  if (!container) return;

  container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading potential matches...</td></tr>';

  try {
    const res = await fetch('/api/matches');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--slate-400); padding: 3rem;">No smart matches registered in ItemMatches table. Click "Run Matching Engine" above.</td></tr>';
      return;
    }

    container.innerHTML = data.data.map(m => `
      <tr>
        <td>#${m.match_id}</td>
        <td>
          <div style="font-weight: 600;">⭐ ${m.match_score}%</div>
          <span class="badge badge-${m.match_status.toLowerCase()}">${m.match_status}</span>
        </td>
        <td>
          <a href="/pages/item-details.html?id=${m.lost_item_id}" target="_blank" style="font-weight: 600; color: #991b1b;">
            [LOST #${m.lost_item_id}] ${escapeHtml(m.lost_title)}
          </a>
          <div style="font-size: 0.775rem; color: var(--slate-500);">
            By: ${escapeHtml(m.lost_reporter_name)} (${escapeHtml(m.lost_location)})
          </div>
        </td>
        <td>
          <a href="/pages/item-details.html?id=${m.found_item_id}" target="_blank" style="font-weight: 600; color: #0f766e;">
            [FOUND #${m.found_item_id}] ${escapeHtml(m.found_title)}
          </a>
          <div style="font-size: 0.775rem; color: var(--slate-500);">
            By: ${escapeHtml(m.found_reporter_name)} (${escapeHtml(m.found_location)})
          </div>
        </td>
        <td>${formatDate(m.created_at)}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            ${m.match_status !== 'CONFIRMED' ? `
              <button onclick="handleUpdateMatchStatus(${m.match_id}, 'CONFIRMED')" class="btn btn-primary btn-sm">Confirm</button>
            ` : ''}
            ${m.match_status !== 'DISMISSED' ? `
              <button onclick="handleUpdateMatchStatus(${m.match_id}, 'DISMISSED')" class="btn btn-secondary btn-sm">Dismiss</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load system matches', 'error');
  }
}

// Admin Trigger Matching Engine (Calls Procedure GenerateItemMatches)
async function handleTriggerMatching() {
  const btn = document.getElementById('trigger-matching-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Executing MySQL Procedure...';
  }

  try {
    const res = await fetch('/api/matches/trigger', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast(`Matching procedure executed! ${data.matches_created} match record(s) processed.`, 'success');
      await loadAdminMatches();
    } else {
      showToast(data.message || 'Failed to trigger matching', 'error');
    }
  } catch (err) {
    showToast('Network error triggering matching procedure', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ Run Matching Engine';
    }
  }
}

// Admin Update Match Status
async function handleUpdateMatchStatus(matchId, status) {
  try {
    const res = await fetch(`/api/matches/${matchId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadAdminMatches();
    } else {
      showToast(data.message || 'Status update failed', 'error');
    }
  } catch (err) {
    showToast('Failed to update match status', 'error');
  }
}
