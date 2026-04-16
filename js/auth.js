// Authentication System for Abyssal Rush
const API_BASE = '/api';

const Auth = {
  token: localStorage.getItem('abyssal_rush_token'),
  user: JSON.parse(localStorage.getItem('abyssal_rush_user') || 'null'),
  isLoggedIn: false,

  init() {
    this.isLoggedIn = !!this.token;
    if (this.token && !this.user) {
      this.fetchUser();
    }
  },

  async fetchUser() {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        localStorage.setItem('abyssal_rush_user', JSON.stringify(this.user));
        this.isLoggedIn = true;
        return data.user;
      } else {
        this.logout();
        return null;
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  },

  async login(username, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        this.isLoggedIn = true;
        localStorage.setItem('abyssal_rush_token', this.token);
        localStorage.setItem('abyssal_rush_user', JSON.stringify(this.user));
        
        // Merge local progress with server data
        this.mergeLocalProgress();
        
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  async signup(username, email, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        this.isLoggedIn = true;
        localStorage.setItem('abyssal_rush_token', this.token);
        localStorage.setItem('abyssal_rush_user', JSON.stringify(this.user));
        
        // Transfer local progress to new account
        this.mergeLocalProgress();
        
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  logout() {
    this.token = null;
    this.user = null;
    this.isLoggedIn = false;
    localStorage.removeItem('abyssal_rush_token');
    localStorage.removeItem('abyssal_rush_user');
  },

  async syncToServer() {
    if (!this.isLoggedIn || !this.token) return;

    try {
      // Get local shop data
      const localProgress = JSON.parse(localStorage.getItem('abyssal_rush_progress') || '{}');
      
      const syncData = {
        pearls: localProgress.pearls || 0,
        inventory: localProgress.inventory || [],
        equipped: localProgress.equipped || { diver: 'NEO', trail: null },
        achievements: localProgress.achievements || {},
        stats: {
          totalCrystals: localProgress.stats?.totalCrystals || 0,
          totalDeaths: localProgress.stats?.totalDeaths || 0,
          totalTime: localProgress.stats?.totalTime || 0,
          levelsCompleted: localProgress.stats?.levelsCompleted || 0,
          gamesPlayed: localProgress.stats?.gamesPlayed || 0
        }
      };

      const response = await fetch(`${API_BASE}/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(syncData)
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        localStorage.setItem('abyssal_rush_user', JSON.stringify(this.user));
        return { success: true };
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  },

  async syncFromServer() {
    if (!this.isLoggedIn || !this.token) return;

    try {
      const response = await fetch(`${API_BASE}/auth/sync`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        localStorage.setItem('abyssal_rush_user', JSON.stringify(this.user));
        
        // Update local storage with server data
        const localProgress = JSON.parse(localStorage.getItem('abyssal_rush_progress') || '{}');
        localProgress.pearls = this.user.pearls || localProgress.pearls || 0;
        localProgress.inventory = this.user.inventory || localProgress.inventory || [];
        localProgress.equipped = this.user.equipped || localProgress.equipped || { diver: 'NEO', trail: null };
        localProgress.achievements = this.user.achievements || localProgress.achievements || {};
        localStorage.setItem('abyssal_rush_progress', JSON.stringify(localProgress));
        
        return { success: true };
      }
    } catch (error) {
      console.error('Sync from server failed:', error);
    }
  },

  mergeLocalProgress() {
    const localProgress = JSON.parse(localStorage.getItem('abyssal_rush_progress') || '{}');
    
    if (this.user) {
      // Use the better of local or server data
      this.user.pearls = Math.max(this.user.pearls || 0, localProgress.pearls || 0);
      
      // Merge inventory (server takes precedence for duplicates)
      const localInv = localProgress.inventory || [];
      const serverInv = this.user.inventory || [];
      const serverIds = new Set(serverInv.map(i => i.id));
      
      for (const item of localInv) {
        if (!serverIds.has(item.id)) {
          serverInv.push(item);
        }
      }
      this.user.inventory = serverInv;
      
      // Sync back to server
      this.syncToServer();
    }
  },

  getUsername() {
    return this.user?.username || 'Guest';
  },

  getPearls() {
    return this.user?.pearls || 0;
  }
};

// Auth UI
const AuthUI = {
  show() {
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <h2>🌊 ABYSSAL RUSH</h2>
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Login</button>
          <button class="auth-tab" data-tab="signup">Sign Up</button>
        </div>
        
        <div class="auth-form" id="login-form">
          <input type="text" id="login-username" placeholder="Username" maxlength="20">
          <input type="password" id="login-password" placeholder="Password" minlength="6">
          <button class="auth-submit" id="login-btn">Dive In! 🏊</button>
          <p class="auth-error" id="login-error"></p>
        </div>
        
        <div class="auth-form hidden" id="signup-form">
          <input type="text" id="signup-username" placeholder="Username (3-20 chars)" maxlength="20">
          <input type="email" id="signup-email" placeholder="Email" maxlength="50">
          <input type="password" id="signup-password" placeholder="Password (6+ chars)" minlength="6">
          <button class="auth-submit" id="signup-btn">Join the Dive! 🤿</button>
          <p class="auth-error" id="signup-error"></p>
        </div>
        
        <button class="auth-guest" id="guest-btn">Continue as Guest 👤</button>
        <p class="auth-note">Guest progress is saved locally only</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.bindEvents();
  },

  hide() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.remove();
  },

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const formId = tab.dataset.tab + '-form';
        document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
        document.getElementById(formId).classList.remove('hidden');
      });
    });

    // Login
    document.getElementById('login-btn').addEventListener('click', async () => {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errorEl = document.getElementById('login-error');

      if (!username || !password) {
        errorEl.textContent = 'Please fill in all fields';
        return;
      }

      errorEl.textContent = 'Logging in...';
      const result = await Auth.login(username, password);

      if (result.success) {
        this.hide();
        if (window.GameState) {
          window.GameState.state = window.STATE.TITLE;
          window.GameState.menuIdx = 0;
        }
      } else {
        errorEl.textContent = result.error;
      }
    });

    // Signup
    document.getElementById('signup-btn').addEventListener('click', async () => {
      const username = document.getElementById('signup-username').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const errorEl = document.getElementById('signup-error');

      if (!username || !email || !password) {
        errorEl.textContent = 'Please fill in all fields';
        return;
      }

      if (username.length < 3) {
        errorEl.textContent = 'Username must be at least 3 characters';
        return;
      }

      if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        return;
      }

      errorEl.textContent = 'Creating account...';
      const result = await Auth.signup(username, email, password);

      if (result.success) {
        this.hide();
        if (window.GameState) {
          window.GameState.state = window.STATE.TITLE;
          window.GameState.menuIdx = 0;
        }
      } else {
        errorEl.textContent = result.error;
      }
    });

    // Guest
    document.getElementById('guest-btn').addEventListener('click', () => {
      this.hide();
      if (window.GameState) {
        window.GameState.state = window.STATE.TITLE;
        window.GameState.menuIdx = 0;
      }
    });

    // Enter key support
    document.querySelectorAll('.auth-form input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const form = input.closest('.auth-form');
          const btn = form.querySelector('.auth-submit');
          btn.click();
        }
      });
    });
  }
};

// Initialize auth on load
Auth.init();

// Auto-sync every 30 seconds if logged in
setInterval(() => {
  if (Auth.isLoggedIn) {
    Auth.syncToServer();
  }
}, 30000);

// Export for global access
window.Auth = Auth;
window.AuthUI = AuthUI;
