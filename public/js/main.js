/**
 * Smart Student Lost & Found Management System
 * Core Client Library (Session, Navbar, Toasts, Confirmation Modals)
 */

const API_BASE = '/api';

// Current active session state
let currentUser = null;

// Initialize global application state
document.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
  setupNavbar();
  highlightActiveNav();
});

// Check authentication state from server
async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`);
    const data = await res.json();
    if (data.success && data.authenticated) {
      currentUser = data.user;
    } else {
      currentUser = null;
    }
    updateNavUI();
    return currentUser;
  } catch (error) {
    console.error('Session check failed:', error);
    currentUser = null;
    updateNavUI();
    return null;
  }
}

// Update Navbar based on user session role
function updateNavUI() {
  const authNav = document.getElementById('nav-auth-section');
  const studentNavItems = document.querySelectorAll('.student-only');
  const adminNavItems = document.querySelectorAll('.admin-only');
  const publicNavItems = document.querySelectorAll('.public-only');

  if (currentUser) {
    // Hide public-only links (e.g. login, register)
    publicNavItems.forEach(el => el.style.display = 'none');

    if (currentUser.role === 'ADMIN') {
      adminNavItems.forEach(el => el.style.display = 'block');
      studentNavItems.forEach(el => el.style.display = 'none');
    } else {
      studentNavItems.forEach(el => el.style.display = 'block');
      adminNavItems.forEach(el => el.style.display = 'none');
    }

    if (authNav) {
      const dashboardLink = currentUser.role === 'ADMIN' ? '/admin-dashboard.html' : '/student-dashboard.html';
      authNav.innerHTML = `
        <a href="${dashboardLink}" class="user-badge">
          <span>${escapeHtml(currentUser.name)}</span>
          <span class="user-role-tag">${currentUser.role}</span>
        </a>
        <button onclick="handleLogout()" class="btn btn-secondary btn-sm" title="Log out">Sign Out</button>
      `;
    }
  } else {
    studentNavItems.forEach(el => el.style.display = 'none');
    adminNavItems.forEach(el => el.style.display = 'none');
    publicNavItems.forEach(el => el.style.display = 'block');

    if (authNav) {
      authNav.innerHTML = `
        <a href="/login.html" class="btn btn-secondary btn-sm">Log In</a>
        <a href="/register.html" class="btn btn-primary btn-sm">Register</a>
      `;
    }
  }
}

// Log out user
async function handleLogout() {
  try {
    const res = await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Logged out successfully', 'info');
      currentUser = null;
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 400);
    }
  } catch (err) {
    showToast('Failed to log out', 'error');
  }
}

// Highlight current page in navbar
function highlightActiveNav() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
}

// Setup common navbar events
function setupNavbar() {
  // Can be extended for mobile hamburger toggle if needed
}

// Show Toast Notification
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Show Generic Confirmation Modal
function showConfirmDialog({ title, message, confirmText = 'Confirm', onConfirm }) {
  let backdrop = document.getElementById('global-confirm-modal');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'global-confirm-modal';
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-content">
      <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--slate-900);">${escapeHtml(title)}</h3>
      <p style="font-size: 0.9rem; color: var(--slate-600); margin-bottom: 1.5rem;">${escapeHtml(message)}</p>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button id="modal-cancel-btn" class="btn btn-secondary btn-sm">Cancel</button>
        <button id="modal-confirm-btn" class="btn btn-danger btn-sm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;

  backdrop.classList.add('active');

  document.getElementById('modal-cancel-btn').onclick = () => {
    backdrop.classList.remove('active');
  };

  document.getElementById('modal-confirm-btn').onclick = () => {
    backdrop.classList.remove('active');
    if (typeof onConfirm === 'function') onConfirm();
  };
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Utility: Format Date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Route Protection Helper
function requireAuth(allowedRole = null) {
  checkSession().then(user => {
    if (!user) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (allowedRole && user.role !== allowedRole) {
      if (user.role === 'ADMIN') {
        window.location.href = '/admin-dashboard.html';
      } else {
        window.location.href = '/student-dashboard.html';
      }
    }
  });
}
