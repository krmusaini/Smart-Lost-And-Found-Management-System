/**
 * Authentication Client Handlers (Login, Registration, Profile)
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const profileForm = document.getElementById('profile-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  if (profileForm) {
    loadProfile();
    profileForm.addEventListener('submit', handleProfileUpdate);
  }
});

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorAlert = document.getElementById('login-error');

  if (errorAlert) errorAlert.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.innerText = 'Verifying...';

  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Login successful! Redirecting...', 'success');
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');

      setTimeout(() => {
        if (redirect) {
          window.location.href = redirect;
        } else if (data.user.role === 'ADMIN') {
          window.location.href = '/admin-dashboard.html';
        } else {
          window.location.href = '/student-dashboard.html';
        }
      }, 500);
    } else {
      if (errorAlert) {
        errorAlert.innerText = data.message || 'Login failed. Please check your credentials.';
        errorAlert.style.display = 'block';
      } else {
        showToast(data.message || 'Login failed', 'error');
      }
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
    }
  } catch (err) {
    showToast('Network error during login', 'error');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorAlert = document.getElementById('register-error');

  if (errorAlert) errorAlert.style.display = 'none';

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirm_password.value;

  if (password !== confirmPassword) {
    if (errorAlert) {
      errorAlert.innerText = 'Passwords do not match.';
      errorAlert.style.display = 'block';
    } else {
      showToast('Passwords do not match', 'error');
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = 'Creating account...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Account created successfully! Welcome.', 'success');
      setTimeout(() => {
        window.location.href = '/student-dashboard.html';
      }, 600);
    } else {
      if (errorAlert) {
        errorAlert.innerText = data.message || 'Registration failed.';
        errorAlert.style.display = 'block';
      } else {
        showToast(data.message || 'Registration failed', 'error');
      }
      submitBtn.disabled = false;
      submitBtn.innerText = 'Create Account';
    }
  } catch (err) {
    showToast('Network error during registration', 'error');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Create Account';
  }
}

async function loadProfile() {
  const user = await checkSession();
  if (!user) return;

  const form = document.getElementById('profile-form');
  if (form) {
    form.name.value = user.name || '';
    form.email.value = user.email || '';
    if (document.getElementById('profile-stat-reports')) {
      document.getElementById('profile-stat-reports').innerText = user.stats?.total_items || 0;
    }
    if (document.getElementById('profile-stat-recoveries')) {
      document.getElementById('profile-stat-recoveries').innerText = user.stats?.total_recoveries || 0;
    }
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Saving...';

  const name = form.name.value.trim();
  const current_password = form.current_password?.value || '';
  const new_password = form.new_password?.value || '';

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, current_password, new_password })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Profile updated successfully!', 'success');
      if (form.current_password) form.current_password.value = '';
      if (form.new_password) form.new_password.value = '';
      await checkSession();
    } else {
      showToast(data.message || 'Profile update failed', 'error');
    }
  } catch (err) {
    showToast('Failed to update profile', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Save Changes';
  }
}
