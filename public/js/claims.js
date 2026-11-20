/**
 * Claims Client Handlers (Student Submission, Student Claim Tracking, Admin Review)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Setup Submit Claim Page
  const submitClaimForm = document.getElementById('submit-claim-form');
  if (submitClaimForm) {
    requireAuth('STUDENT');
    await loadClaimItemPreview();
    submitClaimForm.addEventListener('submit', handleSubmitClaim);
  }

  // Setup My Claims Page
  const myClaimsRoot = document.getElementById('my-claims-root');
  if (myClaimsRoot) {
    requireAuth('STUDENT');
    await loadMyClaims();
  }

  // Setup Admin Claims Management Page
  const adminClaimsRoot = document.getElementById('admin-claims-root');
  if (adminClaimsRoot) {
    requireAuth('ADMIN');
    setupAdminClaimsFilters();
    await loadAdminClaims();
  }
});

// Load Item Preview on Submit Claim Page
async function loadClaimItemPreview() {
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('item_id');
  const previewContainer = document.getElementById('claim-item-preview');
  const hiddenInput = document.getElementById('claim-item-id-input');

  if (!itemId) {
    window.location.href = '/pages/browse-items.html';
    return;
  }

  if (hiddenInput) hiddenInput.value = itemId;

  try {
    const res = await fetch(`/api/items/${itemId}`);
    const data = await res.json();

    if (!data.success || data.item.item_type !== 'FOUND') {
      previewContainer.innerHTML = '<div class="alert alert-danger">This item is not eligible for claiming.</div>';
      return;
    }

    const { item, userClaim, isOwner } = data;

    if (isOwner) {
      previewContainer.innerHTML = '<div class="alert alert-warning">You cannot claim an item you reported.</div>';
      document.getElementById('submit-claim-btn').disabled = true;
      return;
    }

    if (userClaim) {
      previewContainer.innerHTML = `
        <div class="alert alert-info">
          You have already submitted a claim for this item (Status: <strong>${userClaim.claim_status}</strong>).
        </div>
      `;
      document.getElementById('submit-claim-btn').disabled = true;
      return;
    }

    previewContainer.innerHTML = `
      <div style="display: flex; gap: 1rem; align-items: center; background: var(--slate-50); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--slate-200); margin-bottom: 1.5rem;">
        <div style="font-size: 2.5rem;">📦</div>
        <div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--slate-900);">${escapeHtml(item.title)}</h4>
          <p style="font-size: 0.85rem; color: var(--slate-600); margin-top: 0.2rem;">
            Found on <strong>${formatDate(item.item_date)}</strong> at <strong>${escapeHtml(item.location_name)}</strong>
          </p>
        </div>
      </div>
    `;
  } catch (err) {
    showToast('Failed to load item info for claim', 'error');
  }
}

// Handle Claim Form Submission (Calls Procedure SubmitClaim)
async function handleSubmitClaim(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('submit-claim-btn');

  const itemId = form.item_id.value;
  const claimMessage = form.claim_message.value.trim();

  if (!claimMessage) {
    showToast('Please provide identifying details in your claim message', 'warning');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = 'Submitting claim...';

  try {
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, claim_message: claimMessage })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message || 'Claim submitted successfully!', 'success');
      setTimeout(() => {
        window.location.href = '/pages/my-claims.html';
      }, 700);
    } else {
      showToast(data.message || 'Failed to submit claim.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerText = 'Submit Ownership Claim';
    }
  } catch (err) {
    showToast('Network error submitting claim', 'error');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Submit Ownership Claim';
  }
}

// Load Student's Claims
async function loadMyClaims() {
  const container = document.getElementById('my-claims-list');
  if (!container) return;

  try {
    const res = await fetch('/api/claims/my-claims');
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--slate-400); padding: 3rem;">
            You have not submitted any ownership claims yet.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = data.data.map(c => `
      <tr>
        <td>
          <a href="/pages/item-details.html?id=${c.item_id}" style="font-weight: 600;">${escapeHtml(c.item_title)}</a>
          <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(c.category_name)} • ${escapeHtml(c.location_name)}</div>
        </td>
        <td style="max-width: 250px; font-size: 0.85rem;">
          <div style="max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(c.claim_message)}
          </div>
        </td>
        <td>${formatDate(c.claim_date)}</td>
        <td>
          <span class="badge ${c.claim_status === 'APPROVED' ? 'badge-claimed' : (c.claim_status === 'REJECTED' ? 'badge-lost' : 'badge-pending')}">
            ${c.claim_status}
          </span>
        </td>
        <td style="font-size: 0.825rem; color: var(--slate-600); max-width: 200px;">
          ${escapeHtml(c.admin_note || 'Under administrative review')}
          ${c.handover_id ? `<div style="color: var(--success); font-weight: 600; margin-top: 0.25rem;">✓ Handover Complete (${formatDate(c.handover_date)})</div>` : ''}
        </td>
        <td>
          <a href="/pages/item-details.html?id=${c.item_id}" class="btn btn-secondary btn-sm">Item Details</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load claims', 'error');
  }
}

// Admin Claims Management
function setupAdminClaimsFilters() {
  const form = document.getElementById('admin-claims-filter-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      loadAdminClaims();
    });
    form.querySelectorAll('select, input').forEach(el => {
      el.addEventListener('change', () => loadAdminClaims());
    });
  }
}

async function loadAdminClaims() {
  const container = document.getElementById('admin-claims-table-body');
  if (!container) return;

  container.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading claims...</td></tr>';

  const form = document.getElementById('admin-claims-filter-form');
  const params = new URLSearchParams();
  if (form) {
    if (form.status?.value) params.set('status', form.status.value);
    if (form.search?.value) params.set('search', form.search.value);
  }

  try {
    const res = await fetch(`/api/claims?${params.toString()}`);
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--slate-400); padding: 3rem;">No claims matching the criteria.</td></tr>';
      return;
    }

    container.innerHTML = data.data.map(c => `
      <tr>
        <td>#${c.claim_id}</td>
        <td>
          <a href="/pages/item-details.html?id=${c.item_id}" target="_blank" style="font-weight: 600;">${escapeHtml(c.item_title)}</a>
          <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(c.category_name)} • ${escapeHtml(c.location_name)}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(c.claimant_name)}</div>
          <div style="font-size: 0.775rem; color: var(--slate-500);">${escapeHtml(c.claimant_email)}</div>
        </td>
        <td style="max-width: 250px; font-size: 0.85rem;">
          ${escapeHtml(c.claim_message)}
        </td>
        <td>${formatDate(c.claim_date)}</td>
        <td>
          <span class="badge ${c.claim_status === 'APPROVED' ? 'badge-claimed' : (c.claim_status === 'REJECTED' ? 'badge-lost' : 'badge-pending')}">
            ${c.claim_status}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            ${c.claim_status === 'PENDING' ? `
              <button onclick="promptApproveClaim(${c.claim_id})" class="btn btn-primary btn-sm">Approve</button>
              <button onclick="promptRejectClaim(${c.claim_id})" class="btn btn-danger btn-sm">Reject</button>
            ` : `
              ${c.claim_status === 'APPROVED' && !c.handover_id ? `
                <a href="/pages/handovers.html" class="btn btn-outline-primary btn-sm">Handover</a>
              ` : `<span style="font-size: 0.8rem; color: var(--slate-400);">Finalized</span>`}
            `}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load claims', 'error');
  }
}

// Admin Approve Claim Prompt
function promptApproveClaim(claimId) {
  const note = prompt('Enter administrative verification note (optional):', 'Ownership verified by administrator inspection.');
  if (note === null) return; // User cancelled

  fetch(`/api/claims/${claimId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_note: note })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        loadAdminClaims();
      } else {
        showToast(data.message || 'Failed to approve claim', 'error');
      }
    })
    .catch(() => showToast('Error approving claim', 'error'));
}

// Admin Reject Claim Prompt
function promptRejectClaim(claimId) {
  const note = prompt('Enter reason for rejecting claim:', 'Identifying characteristics do not match.');
  if (note === null) return;

  fetch(`/api/claims/${claimId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_note: note })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        loadAdminClaims();
      } else {
        showToast(data.message || 'Failed to reject claim', 'error');
      }
    })
    .catch(() => showToast('Error rejecting claim', 'error'));
}
