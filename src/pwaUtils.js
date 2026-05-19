// PWA Utilities for BRIKX
// Handles: Install prompts, Push notifications, Daily challenges, Offline sync

// ============================================
// INSTALL PROMPT
// ============================================

let deferredInstallPrompt = null;

// Capture the beforeinstallprompt event
export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('Install prompt ready');
    
    // Notify listeners that install is available
    window.dispatchEvent(new CustomEvent('installAvailable'));
  });

  // Listen for app installed
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    deferredInstallPrompt = null;
    
    // Save installation date
    localStorage.setItem('brikx_installed_date', Date.now());
    
    // Show thank you notification if permission granted
    if (Notification.permission === 'granted') {
      showNotification('Welcome to BRIKX!', 'Thanks for installing. Let\'s play!');
    }
  });
}

// Show the install prompt
export async function showInstallPrompt() {
  if (!deferredInstallPrompt) {
    return { outcome: 'not-available' };
  }

  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  
  deferredInstallPrompt = null;
  
  return result;
}

// Check if app is installed
export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Check if install prompt is available
export function isInstallAvailable() {
  return deferredInstallPrompt !== null;
}


// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Request notification permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'not-supported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Subscribe to push notifications
export async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      return subscription;
    }

    // For demo purposes, we'll use a vapid key placeholder
    // In production, generate your own VAPID keys
    const vapidPublicKey = 'BMxzWGqrThLEa6VF3dURVQGLYP8xXGJQJqNRHPFJsOr9q1VqK7C2hl5hLXkXQMR4JkFm8VqJa3nPQqLJ9F8p1nY';
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // In production, send subscription to your backend server
    console.log('Push subscription:', JSON.stringify(subscription));
    
    localStorage.setItem('brikx_push_subscription', JSON.stringify(subscription));
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      localStorage.removeItem('brikx_push_subscription');
      console.log('Unsubscribed from push notifications');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

// Show local notification
export function showNotification(title, body, options = {}) {
  if (Notification.permission !== 'granted') {
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body: body,
        icon: '/brikx512.png',
        badge: '/brikx192.png',
        vibrate: [200, 100, 200],
        tag: 'brikx-notification',
        ...options
      });
    });
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


// ============================================
// DAILY CHALLENGES
// ============================================

// Daily challenge types
const CHALLENGE_TYPES = [
  { 
    id: 'sprint_master', 
    name: 'Sprint Master', 
    description: 'Complete Sprint mode in under 3 minutes',
    icon: '⚡',
    check: (gameData) => gameData.mode === 'sprint' && gameData.time < 180000,
    reward: 500
  },
  { 
    id: 'combo_king', 
    name: 'Combo King', 
    description: 'Achieve a 15x combo',
    icon: '🔥',
    check: (gameData) => gameData.maxCombo >= 15,
    reward: 300
  },
  { 
    id: 'line_clearer', 
    name: 'Line Clearer', 
    description: 'Clear 50 lines in one game',
    icon: '📏',
    check: (gameData) => gameData.lines >= 50,
    reward: 250
  },
  { 
    id: 'high_scorer', 
    name: 'High Scorer', 
    description: 'Score 15,000 points in one game',
    icon: '🏆',
    check: (gameData) => gameData.score >= 15000,
    reward: 400
  },
  { 
    id: 'marathon_survivor', 
    name: 'Marathon Survivor', 
    description: 'Survive 10 minutes in Marathon mode',
    icon: '🏃',
    check: (gameData) => gameData.mode === 'marathon' && gameData.time >= 600000,
    reward: 600
  },
  { 
    id: 'perfect_start', 
    name: 'Perfect Start', 
    description: 'Clear 4 lines with your first piece (Tetris)',
    icon: '✨',
    check: (gameData) => gameData.firstMoveTetris === true,
    reward: 1000
  },
  { 
    id: 'piece_master', 
    name: 'Piece Master', 
    description: 'Place 100 pieces in one game',
    icon: '🧱',
    check: (gameData) => gameData.piecesPlaced >= 100,
    reward: 350
  }
];

// Get daily challenge (deterministic based on date)
export function getDailyChallenge() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const challengeIndex = dayOfYear % CHALLENGE_TYPES.length;
  
  const challenge = CHALLENGE_TYPES[challengeIndex];
  const storageKey = `brikx_daily_challenge_${dayOfYear}`;
  const saved = localStorage.getItem(storageKey);
  
  if (saved) {
    return JSON.parse(saved);
  }
  
  const newChallenge = {
    ...challenge,
    date: today.toISOString().split('T')[0],
    dayOfYear: dayOfYear,
    completed: false,
    storageKey: storageKey
  };
  
  localStorage.setItem(storageKey, JSON.stringify(newChallenge));
  
  return newChallenge;
}

// Check if game data completes the daily challenge
export function checkDailyChallenge(gameData) {
  const challenge = getDailyChallenge();
  
  if (challenge.completed) {
    return { success: false, challenge: challenge };
  }
  
  const success = challenge.check(gameData);
  
  if (success) {
    challenge.completed = true;
    challenge.completedAt = Date.now();
    localStorage.setItem(challenge.storageKey, JSON.stringify(challenge));
    
    // Update total rewards
    const totalRewards = parseInt(localStorage.getItem('brikx_total_rewards') || '0');
    localStorage.setItem('brikx_total_rewards', (totalRewards + challenge.reward).toString());
    
    // Show notification
    if (Notification.permission === 'granted') {
      showNotification(
        '🎉 Daily Challenge Complete!',
        `${challenge.name} - Earned ${challenge.reward} points!`,
        { tag: 'challenge-complete' }
      );
    }
    
    return { success: true, challenge: challenge };
  }
  
  return { success: false, challenge: challenge };
}

// Schedule daily challenge notification for tomorrow
export function scheduleDailyChallengeNotification() {
  if (Notification.permission !== 'granted') {
    return;
  }

  // Check if we should show reminder (once per day)
  const lastReminder = parseInt(localStorage.getItem('brikx_last_challenge_reminder') || '0');
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (now - lastReminder < oneDay) {
    return; // Already reminded today
  }

  // Show reminder notification
  setTimeout(() => {
    const challenge = getDailyChallenge();
    if (!challenge.completed) {
      showNotification(
        '🎯 Daily Challenge',
        `Don't forget: ${challenge.name} - ${challenge.description}`,
        { tag: 'daily-reminder' }
      );
      localStorage.setItem('brikx_last_challenge_reminder', now.toString());
    }
  }, 5000); // Show after 5 seconds
}


// ============================================
// OFFLINE SYNC
// ============================================

// Queue high score for offline sync
export async function queueHighScore(scoreData) {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    if (!registration.active) {
      return false;
    }

    // Send score to service worker for queuing
    registration.active.postMessage({
      type: 'QUEUE_HIGH_SCORE',
      score: scoreData
    });

    // Register sync if supported
    if ('sync' in registration) {
      await registration.sync.register('sync-high-scores');
      console.log('Background sync registered');
    }

    return true;
  } catch (error) {
    console.error('Failed to queue high score:', error);
    return false;
  }
}

// Listen for sync messages from service worker
export function initSyncListener(callback) {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_HIGH_SCORES') {
      console.log('Received synced high scores:', event.data.scores);
      callback(event.data.scores);
    }
  });
}

// Check if offline
export function isOffline() {
  return !navigator.onLine;
}

// Listen for online/offline events
export function initNetworkListener(onOnline, onOffline) {
  window.addEventListener('online', () => {
    console.log('Back online');
    onOnline && onOnline();
  });

  window.addEventListener('offline', () => {
    console.log('Gone offline');
    onOffline && onOffline();
  });
}


// ============================================
// GLOBAL LEADERBOARD
// ============================================

// API base URL - adjust based on deployment
const LEADERBOARD_API_BASE = process.env.REACT_APP_API_URL || '/api/leaderboard';

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return {
    success: response.ok,
    error: text || `Request failed with status ${response.status}`
  };
}

// Get a unique device ID for anonymous submissions
function getDeviceId() {
  let deviceId = localStorage.getItem('brikx_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('brikx_device_id', deviceId);
  }
  return deviceId;
}

async function sha256Hex(input) {
  if (!window.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function getStableProfileKey() {
  const cached = localStorage.getItem('brikx_profile_key');
  if (cached && /^[a-f0-9]{32,64}$/i.test(cached)) {
    return cached.toLowerCase();
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown-tz';
  const fingerprintParts = [
    navigator.userAgent || 'ua',
    navigator.language || 'lang',
    navigator.platform || 'platform',
    `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    `${navigator.hardwareConcurrency || 0}`,
    `${navigator.deviceMemory || 0}`,
    timezone
  ];

  const fingerprint = fingerprintParts.join('|');
  const profileKey = (await sha256Hex(fingerprint)).slice(0, 48);
  localStorage.setItem('brikx_profile_key', profileKey);
  return profileKey;
}

export async function saveCloudProfileSnapshot(snapshot) {
  try {
    if (!snapshot || typeof snapshot !== 'object') {
      return { success: false, error: 'Invalid profile snapshot.' };
    }

    const profileKey = await getStableProfileKey();
    const response = await fetch(`${LEADERBOARD_API_BASE}/profile-save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        profileKey,
        snapshot
      })
    });

    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to save profile.' };
    }

    return {
      success: true,
      updatedAt: data.updatedAt,
      profileKey
    };
  } catch (error) {
    console.error('Failed to save cloud profile snapshot:', error);
    return { success: false, error: error.message };
  }
}

export async function loadCloudProfileSnapshot() {
  try {
    const profileKey = await getStableProfileKey();
    const response = await fetch(`${LEADERBOARD_API_BASE}/profile-load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ profileKey })
    });

    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.error || 'No cloud profile found.' };
    }

    return {
      success: true,
      snapshot: data.snapshot || null,
      updatedAt: data.updatedAt,
      profileKey
    };
  } catch (error) {
    console.error('Failed to load cloud profile snapshot:', error);
    return { success: false, error: error.message };
  }
}

function buildTelemetryPayload({
  sessionId,
  deviceId,
  mode,
  score,
  lines,
  level,
  durationMs
}) {
  return [
    sessionId || 'nosession',
    deviceId,
    mode,
    score,
    lines,
    level,
    durationMs
  ].join('|');
}

function parseSessionToken(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string' || !sessionToken.includes('.')) return null;
  const [payloadB64] = sessionToken.split('.');
  if (!payloadB64) return null;

  try {
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

export async function createLeaderboardSession(mode = 'classic') {
  try {
    const payload = {
      mode: ['classic', 'sprint', 'marathon'].includes(mode) ? mode : 'classic',
      deviceId: getDeviceId(),
      clientStartedAt: new Date().toISOString()
    };

    const response = await fetch(`${LEADERBOARD_API_BASE}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!data.success || !data.sessionToken) {
      return { success: false, error: data.error || 'Unable to create leaderboard session.' };
    }

    return {
      success: true,
      sessionToken: data.sessionToken,
      sessionId: data.sessionId,
      expiresAt: data.expiresAt
    };
  } catch (error) {
    console.error('Error creating leaderboard session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit a score to the global leaderboard
 * @param {Object} scoreData - Game score data
 * @returns {Promise<Object>} - Response from server with rank
 */
export async function submitScoreToLeaderboard(scoreData) {
  try {
    const { name, avatar, score, lines, level, mode, durationMs, sessionToken } = scoreData;
    
    // Validate score
    if (!name || score === undefined || score < 0) {
      console.warn('Invalid score data:', scoreData);
      return { success: false, error: 'Invalid score data' };
    }
    
    const deviceId = getDeviceId();
    const normalizedMode = mode || 'classic';
    let effectiveSessionToken = sessionToken || '';
    if (!effectiveSessionToken) {
      const sessionResult = await createLeaderboardSession(normalizedMode);
      if (sessionResult.success && sessionResult.sessionToken) {
        effectiveSessionToken = sessionResult.sessionToken;
      }
    }

    const parsedSession = parseSessionToken(effectiveSessionToken);
    const telemetryPayload = buildTelemetryPayload({
      sessionId: parsedSession?.sid || 'nosession',
      deviceId,
      mode: normalizedMode,
      score: Math.max(0, parseInt(score) || 0),
      lines: Math.max(0, parseInt(lines) || 0),
      level: Math.max(1, parseInt(level) || 1),
      durationMs: Math.max(0, parseInt(durationMs) || 0)
    });
    const telemetryHash = await sha256Hex(telemetryPayload);

    const payload = {
      name: name || 'Player',
      avatar: avatar || '🎮',
      score: Math.max(0, parseInt(score) || 0),
      lines: Math.max(0, parseInt(lines) || 0),
      level: Math.max(1, parseInt(level) || 1),
      mode: normalizedMode,
      durationMs: Math.max(0, parseInt(durationMs) || 0),
      clientTimestamp: new Date().toISOString(),
      deviceId,
      sessionToken: effectiveSessionToken,
      telemetryHash
    };
    
    const response = await fetch(`${LEADERBOARD_API_BASE}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Score submitted successfully. Rank:', data.rank);
      return { 
        success: true, 
        rank: data.rank,
        entry: data.entry,
        message: data.message
      };
    } else {
      console.error('Score submission failed:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error submitting score to leaderboard:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch global leaderboard entries
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Leaderboard entries and metadata
 */
export async function fetchGlobalLeaderboard(options = {}) {
  try {
    const { limit = 10, mode = 'all', scope = 'all' } = options;
    
    const params = new URLSearchParams({
      limit: Math.min(limit, 100),
      mode: ['classic', 'sprint', 'marathon'].includes(mode) ? mode : 'all',
      scope: ['all', 'weekly', 'monthly'].includes(scope) ? scope : 'all'
    });
    
    const response = await fetch(`${LEADERBOARD_API_BASE}/get?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await parseApiResponse(response);

    if (!response.ok || !data?.success) {
      const fallbackError = data?.error || `Leaderboard request failed (${response.status})`;
      console.error('Failed to fetch leaderboard:', fallbackError);
      return { success: false, entries: [], error: fallbackError };
    }
    
    if (data.success) {
      return {
        success: true,
        entries: data.entries || [],
        total: data.total || 0,
        scope: data.scope || 'all',
        timestamp: data.timestamp
      };
    } else {
      console.error('Failed to fetch leaderboard:', data.error);
      return { success: false, entries: [], error: data.error };
    }
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    return { success: false, entries: [], error: error.message };
  }
}

/**
 * Get a player's rank and stats on the global leaderboard
 * @param {string} playerName - Player name
 * @param {string} mode - Game mode (optional)
 * @returns {Promise<Object>} - Player's rank and stats
 */
export async function getPlayerLeaderboardStats(playerName, mode = 'all', scope = 'all') {
  try {
    const params = new URLSearchParams({
      name: playerName,
      mode: ['classic', 'sprint', 'marathon'].includes(mode) ? mode : 'all',
      scope: ['all', 'weekly', 'monthly'].includes(scope) ? scope : 'all'
    });
    
    const response = await fetch(`${LEADERBOARD_API_BASE}/player?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await parseApiResponse(response);

    if (!response.ok || !data?.success) {
      const fallbackError = data?.error || `Player leaderboard request failed (${response.status})`;
      console.error('Failed to fetch player stats:', fallbackError);
      return { success: false, error: fallbackError };
    }
    
    if (data.success) {
      return {
        success: true,
        player: data.player,
        bestEntry: data.bestEntry,
        rank: data.rank,
        totalSubmissions: data.totalSubmissions,
        scope: data.scope || 'all',
        allEntries: data.allEntries || []
      };
    } else {
      console.error('Failed to fetch player stats:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error fetching player leaderboard stats:', error);
    return { success: false, error: error.message };
  }
}


// ============================================
// INITIALIZATION
// ============================================

// Initialize all PWA features
export function initPWA() {
  initInstallPrompt();
  scheduleDailyChallengeNotification();
  
  // Check for pending sync on page load
  if (navigator.onLine) {
    navigator.serviceWorker.ready.then((registration) => {
      if ('sync' in registration) {
        registration.sync.getTags().then((tags) => {
          if (tags.includes('sync-high-scores')) {
            console.log('Pending sync found, will trigger when possible');
          }
        });
      }
    });
  }
}
