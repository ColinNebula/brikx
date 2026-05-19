import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './DriftRacer.css';
import {
  initPWA,
  showInstallPrompt,
  isInstalled,
  isInstallAvailable,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getDailyChallenge,
  checkDailyChallenge,
  queueHighScore,
  initSyncListener,
  isOffline,
  initNetworkListener,
  showNotification,
  createLeaderboardSession,
  submitScoreToLeaderboard,
  fetchGlobalLeaderboard,
  getPlayerLeaderboardStats,
  saveCloudProfileSnapshot,
  loadCloudProfileSnapshot
} from './pwaUtils';
import {
  THEME_DEFINITIONS,
  checkThemeUnlock,
  getUnlockedThemes,
  getActiveSeasonalThemes,
  applyTheme,
  getSavedTheme,
  getThemeProgress
} from './themes';

const hexToRgbArray = (hex, fallback = [0, 240, 240]) => {
  if (!hex || typeof hex !== 'string') return fallback;
  const sanitized = hex.replace('#', '').trim();
  if (sanitized.length !== 6) return fallback;
  const num = Number.parseInt(sanitized, 16);
  if (Number.isNaN(num)) return fallback;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const rgbAlpha = (rgb, alpha) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

const colorWithAlpha = (color, alpha) => {
  if (!color || typeof color !== 'string') return `rgba(255, 255, 255, ${alpha})`;
  const value = color.trim();

  if (value.startsWith('rgba(')) {
    const channels = value.slice(5, -1).split(',').map(part => part.trim());
    if (channels.length >= 3) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }

  if (value.startsWith('rgb(')) {
    const channels = value.slice(4, -1).split(',').map(part => part.trim());
    if (channels.length === 3) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }

  const rgb = hexToRgbArray(value, null);
  if (rgb) {
    return rgbAlpha(rgb, alpha);
  }

  return `rgba(255, 255, 255, ${alpha})`;
};

// Boost color saturation and brightness for theme enhancement
const boostColorSaturation = (rgb, saturationMultiplier = 1.2, brightnessMultiplier = 1.1) => {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let h = 0;

  if (max !== min) {
    s = l > 128 ? (max - min) / (510 - max - min) : (max - min) / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / (max - min) + 2) / 6;
        break;
      case b:
        h = ((r - g) / (max - min) + 4) / 6;
        break;
      default:
        break;
    }
  }

  // Boost saturation and lightness
  s = Math.min(1, s * saturationMultiplier);
  let newL = Math.min(1, l / 255 * brightnessMultiplier);

  const c = (1 - Math.abs(2 * newL - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  let r2 = 0, g2 = 0, b2 = 0;

  if (h < 1 / 6) { r2 = c; g2 = x; }
  else if (h < 2 / 6) { r2 = x; g2 = c; }
  else if (h < 3 / 6) { g2 = c; b2 = x; }
  else if (h < 4 / 6) { g2 = x; b2 = c; }
  else if (h < 5 / 6) { r2 = x; b2 = c; }
  else { r2 = c; b2 = x; }

  const m = newL - c / 2;
  return [
    Math.round((r2 + m) * 255),
    Math.round((g2 + m) * 255),
    Math.round((b2 + m) * 255)
  ];
};

// Increase color brightness without changing hue
const brightenColor = (rgb, factor = 1.2) => {
  return [
    Math.min(255, Math.round(rgb[0] * factor)),
    Math.min(255, Math.round(rgb[1] * factor)),
    Math.min(255, Math.round(rgb[2] * factor))
  ];
};

const drawFlower = (ctx, x, y, radius, color, alpha, rotation = 0) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(
      Math.cos((i * Math.PI * 2) / 5) * radius * 0.7,
      Math.sin((i * Math.PI * 2) / 5) * radius * 0.7,
      radius * 0.5,
      radius * 0.25,
      (i * Math.PI * 2) / 5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.fillStyle = '#fff8d6';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const getThemeVisualProfile = (themeId, category) => {
  const defaultByCategory = {
    premium: { motif: 'ribbons', pattern: 'wave-grid', animated: true },
    seasonal: { motif: 'petals', pattern: 'soft-orbit', animated: true },
    unlockable: { motif: 'ribbons', pattern: 'diagonal-grid', animated: true },
    base: { motif: 'ribbons', pattern: 'wave-grid', animated: true }
  };

  const overrides = {
    dark: { motif: 'ribbons', pattern: 'wave-grid', animated: true },
    light: { motif: 'petals', pattern: 'sun-rings', animated: true },
    neon: { motif: 'ribbons', pattern: 'wave-grid', animated: true },
    retro: { motif: 'embers', pattern: 'diagonal-grid', animated: true },
    synthwave: { motif: 'ribbons', pattern: 'soft-orbit', animated: true },
    matrix: { motif: 'embers', pattern: 'circuit', animated: true },
    ocean: { motif: 'ribbons', pattern: 'wave-grid', animated: true },
    sunset: { motif: 'embers', pattern: 'sun-rings', animated: true }
  };

  return overrides[themeId] || defaultByCategory[category] || defaultByCategory.base;
};

// Score History Chart Component
const ScoreHistoryChart = ({ history }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !history || history.length < 2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size for retina displays
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get data
    const scores = history.map(h => h.score);
    const maxScore = Math.max(...scores, 1000);
    const minScore = Math.min(...scores, 0);
    const scoreRange = maxScore - minScore || 1;
    
    // Helper to get coordinate
    const getX = (index) => padding.left + (index / (scores.length - 1)) * chartWidth;
    const getY = (score) => padding.top + chartHeight - ((score - minScore) / scoreRange) * chartHeight;
    
    // Get CSS variable colors
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent').trim() || '#00f0f0';
    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text-secondary').trim() || 'rgba(255, 255, 255, 0.8)';
    const gridColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-grid-line').trim() || 'rgba(0, 240, 240, 0.2)';
    
    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      
      // Y-axis labels
      const scoreValue = maxScore - (scoreRange / gridLines) * i;
      ctx.fillStyle = textColor;
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(scoreValue).toLocaleString(), padding.left - 10, y + 4);
    }
    
    // Draw line chart
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    scores.forEach((score, index) => {
      const x = getX(index);
      const y = getY(score);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw points with glow
    ctx.shadowBlur = 8;
    ctx.shadowColor = accentColor;
    scores.forEach((score, index) => {
      const x = getX(index);
      const y = getY(score);
      
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    
    // Draw gradient fill under line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, accentColor.replace(')', ', 0.3)').replace('rgb', 'rgba'));
    gradient.addColorStop(1, accentColor.replace(')', ', 0)').replace('rgb', 'rgba'));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(getX(0), padding.top + chartHeight);
    scores.forEach((score, index) => {
      ctx.lineTo(getX(index), getY(score));
    });
    ctx.lineTo(getX(scores.length - 1), padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();
    
    // X-axis label
    ctx.fillStyle = textColor;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Last ' + history.length + ' Games', width / 2, height - 10);
    
    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Score', 0, 0);
    ctx.restore();
    
  }, [history]);

  return (
    <canvas
      ref={canvasRef}
      className="score-history-canvas"
      style={{ width: '100%', height: '300px' }}
    />
  );
};

// Music playlist configuration (static)
const MUSIC_PLAYLIST = {
  menu: 'Sneaky_Charlie.mp3',
  classic_low: 'Cycles_of_Existence.mp3',      // Levels 1-5
  classic_mid: 'Dancing_with_a_Photon.mp3',    // Levels 6-10
  classic_high: 'Urban_Street_Speak.mp3',      // Levels 11-15
  classic_extreme: 'Nineteen_Eighty_Seven.mp3', // Levels 16+
  sprint: 'EBS.mp3',
  marathon: 'Dancing_with_a_Photon.mp3'
};

const ALL_MUSIC_TRACKS = Array.from(new Set(
  Object.values(MUSIC_PLAYLIST).filter((track) =>
    typeof track === 'string' &&
    track.toLowerCase().endsWith('.mp3') &&
    !track.toLowerCase().startsWith('mixkit-')
  )
));

// Gameplay music tracks - randomly cycle through these during gameplay
const BASE_GAMEPLAY_TRACKS = [
  'Cycles_of_Existence.mp3',
  'Urban_Street_Speak.mp3',
  'Sneaky_Charlie.mp3',
  'Nineteen_Eighty_Seven.mp3',
  'Dancing_with_a_Photon.mp3',
  'EBS.mp3'
];
const EXTRA_GAMEPLAY_TRACKS = [
  'mixkit-fairy-magic-sparkle-871.mp3',
  'mixkit-technology-alert-transition-3121.mp3'
];
const GAMEPLAY_TRACKS = Array.from(new Set([...BASE_GAMEPLAY_TRACKS, ...ALL_MUSIC_TRACKS, ...EXTRA_GAMEPLAY_TRACKS]));

const shuffleTracks = (tracks) => {
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const formatTrackLabel = (trackName) => {
  if (!trackName || typeof trackName !== 'string') return '';
  return trackName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const LEADERBOARD_STORAGE_KEY = 'brikxLeaderboard';
const MAX_LEADERBOARD_ENTRIES = 60;
const MAX_LEADERBOARD_DISPLAY = 8;

const normalizeLeaderboardEntries = (entries) => {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => ({
      name: (entry?.name || 'Player').toString().slice(0, 15).replace(/[^a-zA-Z0-9\s]/g, '') || 'Player',
      avatar: typeof entry?.avatar === 'string' && entry.avatar.trim() ? entry.avatar : '🎮',
      score: Math.max(0, Number.parseInt(entry?.score, 10) || 0),
      lines: Math.max(0, Number.parseInt(entry?.lines, 10) || 0),
      level: Math.max(1, Number.parseInt(entry?.level, 10) || 1),
      mode: ['classic', 'sprint', 'marathon'].includes(entry?.mode) ? entry.mode : 'classic',
      date: entry?.date || new Date().toISOString()
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lines !== a.lines) return b.lines - a.lines;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
};

const getTopLeaderboardEntries = (entries, limit = MAX_LEADERBOARD_DISPLAY) => {
  return normalizeLeaderboardEntries(entries).slice(0, limit);
};

const getPlayerBestRank = (entries, player, mode = 'all') => {
  const normalized = normalizeLeaderboardEntries(entries);
  const filtered = mode === 'all'
    ? normalized
    : normalized.filter((entry) => entry.mode === mode);
  const rankIndex = filtered.findIndex((entry) => entry.name === player);
  return rankIndex >= 0 ? rankIndex + 1 : null;
};

const formatModeLabel = (mode) => {
  switch (mode) {
    case 'sprint':
      return 'Sprint';
    case 'marathon':
      return 'Marathon';
    default:
      return 'Classic';
  }
};

const Brikx = () => {
  // Safe localStorage operations with validation
  const safeGetItem = (key, defaultValue = '') => {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.error('localStorage read error:', error);
      return defaultValue;
    }
  };

  const safeSetItem = (key, value) => {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      console.error('localStorage write error:', error);
    }
    return false;
  };

  const canvasRef = useRef(null);
  const canvasCtxRef = useRef(null);
  const touchButtonsRef = useRef([]);
  const menuContainerRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const stored = safeGetItem('brikxHighScore', '0');
    return parseInt(stored) || 0;
  });
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [combo, setCombo] = useState(0);
  const [lastClearWasCombo, setLastClearWasCombo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPauseHint, setShowPauseHint] = useState(false);
  const [levelFlash, setLevelFlash] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState('global');
  const [leaderboardModeFilter, setLeaderboardModeFilter] = useState('classic');
  const [leaderboardScopeFilter, setLeaderboardScopeFilter] = useState('all');
  const [showClearLeaderboardConfirm, setShowClearLeaderboardConfirm] = useState(false);
  const [rankJump, setRankJump] = useState(null);
  const [showLeaderboardClearedToast, setShowLeaderboardClearedToast] = useState(false);
  const [playerName, setPlayerName] = useState(() => {
    const name = safeGetItem('brickxPlayerName', 'Player');
    return name.slice(0, 15).replace(/[^a-zA-Z0-9\s]/g, '') || 'Player';
  });
  const [playerAvatar, setPlayerAvatar] = useState(() => {
    return safeGetItem('brickxPlayerAvatar', '🎮');
  });
  const [leaderboardEntries, setLeaderboardEntries] = useState(() => {
    const stored = safeGetItem(LEADERBOARD_STORAGE_KEY, '[]');
    try {
      return normalizeLeaderboardEntries(JSON.parse(stored));
    } catch (error) {
      return [];
    }
  });
  const lastLeaderboardRunRef = useRef('');
  const [globalLeaderboardEntries, setGlobalLeaderboardEntries] = useState([]);
  const [globalLeaderboardLoading, setGlobalLeaderboardLoading] = useState(false);
  const [globalLeaderboardError, setGlobalLeaderboardError] = useState(null);
  const [playerGlobalRank, setPlayerGlobalRank] = useState(null);
  const [lastScoreSubmitted, setLastScoreSubmitted] = useState(null);
  const [leaderboardSessionToken, setLeaderboardSessionToken] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return safeGetItem('brickxSoundEnabled', 'true') !== 'false';
  });
  const [musicEnabled, setMusicEnabled] = useState(() => {
    return safeGetItem('brickxMusicEnabled', 'true') !== 'false';
  });
  const [sfxVolume, setSfxVolume] = useState(() => {
    return parseFloat(safeGetItem('brickxSfxVolume', '0.7')) || 0.7;
  });
  const [musicVolume, setMusicVolume] = useState(() => {
    return parseFloat(safeGetItem('brickxMusicVolume', '0.5')) || 0.5;
  });
  const [nowPlayingTrack, setNowPlayingTrack] = useState('');
  const [batterySaverMode, setBatterySaverMode] = useState(() => {
    const savedMode = safeGetItem('brickxBatterySaverMode', '');
    if (savedMode === 'off' || savedMode === 'auto' || savedMode === 'on') {
      return savedMode;
    }

    // Migrate legacy boolean setting if present.
    const legacySaved = safeGetItem('brickxBatterySaverEnabled', '');
    if (legacySaved === 'true') return 'on';
    if (legacySaved === 'false') return 'off';

    return 'auto';
  });
  const [saveDataEnabled, setSaveDataEnabled] = useState(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(connection?.saveData);
  });
  const [isLowEndDevice] = useState(() => {
    const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
    const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
    return lowCpu || lowMemory;
  });

  // Detect reduced motion preference for accessibility
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const topLeaderboardEntries = useMemo(
    () => getTopLeaderboardEntries(leaderboardEntries),
    [leaderboardEntries]
  );

  const leaderboardModeEntries = useMemo(
    () => getTopLeaderboardEntries(
      leaderboardEntries.filter((entry) => entry.mode === leaderboardModeFilter)
    ),
    [leaderboardEntries, leaderboardModeFilter]
  );

  const visibleLeaderboardEntries = useMemo(() => {
    if (leaderboardView === 'global') {
      return globalLeaderboardEntries;
    } else if (leaderboardView === 'local') {
      return topLeaderboardEntries;
    } else {
      return leaderboardModeEntries;
    }
  }, [leaderboardView, globalLeaderboardEntries, topLeaderboardEntries, leaderboardModeEntries]);

  // Cursor-driven light field tracking (updates CSS vars directly — no re-render)
  useEffect(() => {
    const el = menuContainerRef.current;
    if (!el) return;
    const handleMove = (x, y) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((x - rect.left) / rect.width) * 100}%`);
      el.style.setProperty('--my', `${((y - rect.top) / rect.height) * 100}%`);
    };
    const onMouse = (e) => handleMove(e.clientX, e.clientY);
    const onTouch = (e) => { if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    el.addEventListener('mousemove', onMouse, { passive: true });
    el.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      el.removeEventListener('mousemove', onMouse);
      el.removeEventListener('touchmove', onTouch);
    };
  }, [gameStarted, gameOver]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Game modes: 'classic', 'sprint', 'marathon'
  const [gameMode, setGameMode] = useState('classic');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [sprintLinesRemaining, setSprintLinesRemaining] = useState(40);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Statistics
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState(() => {
    const stored = safeGetItem('brikxStatistics', '');
    return stored ? JSON.parse(stored) : {
      totalGames: 0,
      totalLines: 0,
      totalScore: 0,
      bestCombo: 0,
      totalPieces: 0,
      bestSprintTime: null,
      longestMarathon: 0,
      scoreHistory: [] // Array of {score, date, gameMode, level, lines}
    };
  });

  // Achievements
  const [showAchievements, setShowAchievements] = useState(false);
  const [achievements, setAchievements] = useState(() => {
    const stored = safeGetItem('brikxAchievements', '');
    return stored ? JSON.parse(stored) : {};
  });
  const [newAchievement, setNewAchievement] = useState(null);

  // Cinematic idle sequence (8s idle triggers subtle camera push-in + logo glow + particle boost)
  const [isMenuIdle, setIsMenuIdle] = useState(false);
  const idleTimerRef = useRef(null);
  const cinematicTimeoutRef = useRef(null);

  // Menu idle detection: reset on interaction, trigger cinematic after 8s
  useEffect(() => {
    if (gameStarted || gameOver || prefersReducedMotion) return; // Only on main menu

    const resetIdleTimer = () => {
      setIsMenuIdle(prev => (prev ? false : prev));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (cinematicTimeoutRef.current) clearTimeout(cinematicTimeoutRef.current);

      // Start a new idle countdown
      idleTimerRef.current = setTimeout(() => {
        setIsMenuIdle(true);
        // Return to baseline after 3.5 seconds
        cinematicTimeoutRef.current = setTimeout(() => setIsMenuIdle(false), 3500);
      }, 8000);
    };

    // Listen for meaningful interactions; avoid high-frequency move events that can flood re-renders.
    const events = ['click', 'keydown', 'touchstart', 'pointerdown', 'wheel'];
    events.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer(); // Start initial timer

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (cinematicTimeoutRef.current) clearTimeout(cinematicTimeoutRef.current);
    };
  }, [gameStarted, gameOver, prefersReducedMotion]);

  // Boost saturation during idle cinematic for enhanced visual pop
  useEffect(() => {
    if (isMenuIdle && !prefersReducedMotion) {
      gameState.current.saturationBoost = 1.8;
    }
  }, [isMenuIdle]);

  // Touch swipe detection
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const holdIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);

  // Vibration feedback for mobile
  const vibrate = useCallback((pattern = 10) => {
    if (isMobile && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        // Vibration not supported, silently fail
      }
    }
  }, [isMobile]);

  // PWA Features
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [showDailyChallenge, setShowDailyChallenge] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const leaderboardSessionStartedRef = useRef(false);
  const cloudProfileRestoreAttemptedRef = useRef(false);
  const cloudProfileSyncTimerRef = useRef(null);

  // Theme System
  const [currentTheme, setCurrentTheme] = useState(() => getSavedTheme());
  const [unlockedThemes, setUnlockedThemes] = useState({});
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [newThemeUnlocked, setNewThemeUnlocked] = useState(null);
  const [seasonalThemes, setSeasonalThemes] = useState([]);
  const [themePreviewEnabled, setThemePreviewEnabled] = useState(() => {
    return safeGetItem('brickxThemePreviewEnabled', 'true') !== 'false';
  });

  const renderThemeMiniPreview = (theme) => {
    if (!themePreviewEnabled) return null;

    const motifClass = `motif-${theme?.visual?.motif || 'default'}`;
    const patternClass = `pattern-${theme?.visual?.pattern || 'default'}`;
    const themeIdClass = `theme-id-${theme?.id || 'unknown'}`;
    const themeCategoryClass = `theme-category-${theme?.category || 'base'}`;

    return (
      <div className={`theme-live-preview ${motifClass} ${patternClass} ${themeIdClass} ${themeCategoryClass}`} aria-hidden="true">
        <div className="theme-preview-gradient" />
        <div className="theme-preview-pattern" />
        <span className="theme-preview-orb orb-a" />
        <span className="theme-preview-orb orb-b" />
        <span className="theme-preview-mote mote-a" />
        <span className="theme-preview-mote mote-b" />
      </div>
    );
  };

  // Splash Screen
  const [showSplash, setShowSplash] = useState(true);

  // Confirmation Dialog
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Avatar options with unlock requirements
  const avatarsList = {
    // Always unlocked (starter pack)
    '🎮': { unlocked: true },
    '👾': { unlocked: true },
    '🕹️': { unlocked: true },
    '😎': { unlocked: true },
    
    // Unlock with achievements
    '⭐': { achievement: 'scorer1000', name: 'Millennium' },
    '👑': { achievement: 'scorer10000', name: 'Legend' },
    '🎯': { achievement: 'lines100', name: 'Line Master' },
    '🚀': { achievement: 'lines1000', name: 'Line Legend' },
    '🔥': { achievement: 'combo5', name: 'Combo Starter' },
    '💥': { achievement: 'combo10', name: 'Combo Master' },
    '⚡': { achievement: 'speedster', name: 'Speedster' },
    '🏃': { achievement: 'marathoner', name: 'Marathoner' },
    '💎': { achievement: 'scorer1000', name: 'Millennium' },
    '🌟': { achievement: 'lines100', name: 'Line Master' },
    '💫': { achievement: 'lines1000', name: 'Line Legend' },
    '🚁': { achievement: 'combo10', name: 'Combo Master' },
    '🤖': { achievement: 'piecesPlacer', name: 'Block Builder' },
    '🧱': { achievement: 'piecesPlacer', name: 'Block Builder' },
    '🎪': { achievement: 'scorer100', name: 'Century' },
    '🎨': { achievement: 'lines10', name: 'Line Clearer' },
    '🎭': { achievement: 'combo5', name: 'Combo Starter' },
    '🦄': { achievement: 'scorer10000', name: 'Legend' },
    '👻': { achievement: 'speedster', name: 'Speedster' },
    '🐉': { achievement: 'scorer10000', name: 'Legend' },
    '🦖': { achievement: 'marathoner', name: 'Marathoner' },
    '🦁': { achievement: 'combo10', name: 'Combo Master' },
    '🐼': { achievement: 'lines1000', name: 'Line Legend' },
    '🐸': { achievement: 'lines100', name: 'Line Master' },
    '🍕': { achievement: 'scorer100', name: 'Century' },
    '🍔': { achievement: 'scorer1000', name: 'Millennium' },
    '🎂': { achievement: 'lines10', name: 'Line Clearer' },
    '🍩': { achievement: 'combo5', name: 'Combo Starter' },
    '☕': { achievement: 'piecesPlacer', name: 'Block Builder' },
    '🌈': { achievement: 'speedster', name: 'Speedster' },
    '🎸': { achievement: 'marathoner', name: 'Marathoner' },
    '🎵': { achievement: 'lines10', name: 'Line Clearer' },
    '💀': { achievement: 'scorer10000', name: 'Legend' },
    '🤡': { achievement: 'combo10', name: 'Combo Master' },
    '🥷': { achievement: 'speedster', name: 'Speedster' },
    '🧙': { achievement: 'marathoner', name: 'Marathoner' },
    '🧛': { achievement: 'scorer10000', name: 'Legend' },
    '🦸': { achievement: 'lines1000', name: 'Line Legend' },
    '🦹': { achievement: 'piecesPlacer', name: 'Block Builder' },
    '👽': { achievement: 'combo10', name: 'Combo Master' }
  };

  // Get all available avatars (unlocked + locked)
  const allAvatars = Object.keys(avatarsList);
  
  // Get unlocked avatars based on achievements
  const getUnlockedAvatars = useCallback(() => {
    return allAvatars.filter(avatar => {
      const config = avatarsList[avatar];
      if (config.unlocked) return true;
      if (config.achievement && achievements[config.achievement]?.unlocked) return true;
      return false;
    });
  }, [achievements]);
  
  const unlockedAvatars = getUnlockedAvatars();

  // Particle Pooling System for Performance
  const particlePool = useRef([]);
  const MAX_POOL_SIZE = 500;
  const MAX_ACTIVE_PARTICLES = 500;

  const getParticleFromPool = useCallback((particleData) => {
    let particle = particlePool.current.pop();
    if (!particle) {
      particle = {};
    }
    return Object.assign(particle, particleData);
  }, []);

  const returnParticleToPool = useCallback((particle) => {
    if (particlePool.current.length < MAX_POOL_SIZE) {
      particlePool.current.push(particle);
    }
  }, []);

  // Sound System using Web Audio API
  const audioContext = useRef(null);
  const sfxAudioCacheRef = useRef(new Map());
  
  // MP3 Music Player System
  const musicPlayerRef = useRef(null);
  const currentTrackRef = useRef(null);
  const gameplayTrackQueueRef = useRef([]);
  const gameplayTrackCursorRef = useRef(0);
  const musicIntensity = useRef(1);
  const gameStartedRef = useRef(gameStarted);
  const musicEnabledRef = useRef(musicEnabled);
  const previousScoreRef = useRef(score);
  
  useEffect(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Cleanup on unmount
    return () => {
      stopMusic();
    };
  }, []);

  const ensureAudioContextActive = useCallback(() => {
    if (!audioContext.current || audioContext.current.state === 'running') return;
    audioContext.current.resume().catch((err) => {
      console.warn('Audio context resume failed:', err?.message || err);
    });
  }, []);

  useEffect(() => {
    const unlockAudio = () => ensureAudioContextActive();

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [ensureAudioContextActive]);

  const playSfxFile = useCallback((fileName, volumeMultiplier = 1, label = 'SFX') => {
    if (!soundEnabled || sfxVolume <= 0) return;

    ensureAudioContextActive();

    try {
      const src = `${process.env.PUBLIC_URL}/${fileName}`;
      let baseAudio = sfxAudioCacheRef.current.get(src);

      if (!baseAudio) {
        baseAudio = new Audio(src);
        baseAudio.preload = 'auto';
        sfxAudioCacheRef.current.set(src, baseAudio);
      }

      const audio = baseAudio.cloneNode(true);
      audio.volume = Math.min(1, Math.max(0, sfxVolume * volumeMultiplier));
      audio.play().catch(err => {
        console.warn(`${label} blocked:`, err.message);
      });
    } catch (err) {
      console.error(`Error playing ${label.toLowerCase()}:`, err);
    }
  }, [soundEnabled, sfxVolume, ensureAudioContextActive]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    const scoreDelta = score - previousScoreRef.current;

    if (gameStarted && scoreDelta > 0) {
      if (scoreDelta < 100) {
        playSfxFile('mixkit-quick-positive-video-game-notification-interface-265.wav', 0.2, 'Score tick sound');
      } else {
        playSfxFile('mixkit-ethereal-fairy-win-sound-2019.wav', 0.45, 'Score sound');
      }
    }

    previousScoreRef.current = score;
  }, [gameStarted, score, playSfxFile]);

  const playSound = useCallback((type, frequency = 440, duration = 0.1, volume = 0.3) => {
    if (!soundEnabled || !audioContext.current) return;

    const ctx = audioContext.current;

    const performPlay = () => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Apply SFX volume once and clamp to keep WebAudio stable.
      const finalVolume = Math.min(1, Math.max(0.001, volume * sfxVolume));
      let gainMultiplier = 1;

      switch(type) {
        case 'move':
          oscillator.frequency.value = 200;
          gainMultiplier = 0.05;
          oscillator.type = 'square';
          break;
        case 'rotate':
          oscillator.frequency.value = 300;
          gainMultiplier = 0.08;
          oscillator.type = 'sine';
          oscillator.frequency.linearRampToValueAtTime(450, ctx.currentTime + 0.05);
          break;
        case 'drop':
          oscillator.frequency.value = 100;
          gainMultiplier = 0.2;
          oscillator.type = 'triangle';
          oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
          break;
        case 'lineClear1':
          oscillator.frequency.value = 400;
          gainMultiplier = 0.15;
          oscillator.type = 'sine';
          oscillator.frequency.linearRampToValueAtTime(550, ctx.currentTime + 0.1);
          break;
        case 'lineClear2':
          oscillator.frequency.value = 500;
          gainMultiplier = 0.18;
          oscillator.type = 'sine';
          oscillator.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.12);
          break;
        case 'lineClear3':
          oscillator.frequency.value = 600;
          gainMultiplier = 0.2;
          oscillator.type = 'sine';
          oscillator.frequency.linearRampToValueAtTime(850, ctx.currentTime + 0.15);
          break;
        case 'tetris':
          oscillator.frequency.value = 800;
          gainMultiplier = 0.25;
          oscillator.type = 'square';
          oscillator.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.2);
          break;
        case 'levelUp':
          oscillator.frequency.value = 880;
          gainMultiplier = 0.2;
          oscillator.type = 'sine';
          oscillator.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.15);
          break;
        case 'combo':
          oscillator.frequency.value = frequency;
          gainMultiplier = 0.65;
          oscillator.type = 'sine';
          break;
        case 'perfectClear':
          oscillator.frequency.value = 1200;
          gainMultiplier = 0.3;
          oscillator.type = 'square';
          break;
        case 'gameOver':
          oscillator.frequency.value = 150;
          gainMultiplier = 0.25;
          oscillator.type = 'sawtooth';
          break;
        case 'menuClick':
          oscillator.frequency.value = 600;
          gainMultiplier = 0.1;
          oscillator.type = 'sine';
          break;
        case 'achievement':
          oscillator.frequency.value = frequency;
          gainMultiplier = 0.22;
          oscillator.type = 'triangle';
          oscillator.frequency.linearRampToValueAtTime(frequency * 1.2, ctx.currentTime + Math.min(duration, 0.18));
          break;
        default:
          oscillator.frequency.value = frequency;
          gainMultiplier = 1;
          oscillator.type = 'sine';
      }

      const startGain = Math.min(1, Math.max(0.001, finalVolume * gainMultiplier));
      gainNode.gain.setValueAtTime(startGain, ctx.currentTime);
      oscillator.start(ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.stop(ctx.currentTime + duration);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(performPlay).catch(() => {});
      return;
    }

    performPlay();
  }, [soundEnabled, sfxVolume]);

  const playExplosionSound = useCallback(() => {
    if (!soundEnabled) return;
    playSfxFile('mixkit-pixel-chiptune-explosion-1692.wav', 0.6, 'Explosion sound');
  }, [soundEnabled, playSfxFile]);

  const playLineClearSound = useCallback((linesCleared) => {
    if (!soundEnabled) return;
    
    // Play explosion sound for line clears
    playExplosionSound();
    
    if (linesCleared === 1) {
      playSound('lineClear1', 400, 0.15);
    } else if (linesCleared === 2) {
      playSound('lineClear2', 500, 0.2);
      setTimeout(() => playSound('lineClear2', 600, 0.15), 100);
      setTimeout(() => playExplosionSound(), 100);
    } else if (linesCleared === 3) {
      playSound('lineClear3', 600, 0.2);
      setTimeout(() => playSound('lineClear3', 700, 0.15), 80);
      setTimeout(() => playSound('lineClear3', 800, 0.15), 160);
      setTimeout(() => playExplosionSound(), 80);
      setTimeout(() => playExplosionSound(), 160);
    } else if (linesCleared === 4) {
      // Tetris sound - special fanfare with multiple explosions
      playSound('tetris', 800, 0.2);
      setTimeout(() => playSound('tetris', 900, 0.15), 100);
      setTimeout(() => playSound('tetris', 1000, 0.15), 200);
      setTimeout(() => playSound('tetris', 1200, 0.3), 300);
      setTimeout(() => playExplosionSound(), 100);
      setTimeout(() => playExplosionSound(), 200);
      setTimeout(() => playExplosionSound(), 300);
    }
  }, [soundEnabled, playSound, playExplosionSound]);

  const playComboSound = useCallback((comboCount) => {
    if (!soundEnabled) return;
    const baseFreq = 600;
    const freq = baseFreq + (comboCount * 100);
    playSound('combo', freq, 0.15, Math.min(0.3, 0.15 + comboCount * 0.02));
  }, [soundEnabled, playSound]);

  const playComboTierStinger = useCallback((tier) => {
    if (!soundEnabled) return;

    if (tier === 5) {
      playSound('combo', 720, 0.1, 0.2);
      setTimeout(() => playSound('combo', 910, 0.12, 0.22), 90);
      return;
    }

    if (tier === 10) {
      playSound('combo', 760, 0.1, 0.22);
      setTimeout(() => playSound('combo', 980, 0.12, 0.24), 85);
      setTimeout(() => playSound('combo', 1220, 0.16, 0.26), 175);
      setTimeout(() => playSfxFile('mixkit-sci-fi-positive-notification-266.wav', 0.45, 'Mega combo stinger'), 130);
      return;
    }

    if (tier === 15) {
      playSound('combo', 900, 0.12, 0.26);
      setTimeout(() => playSound('combo', 1200, 0.14, 0.28), 80);
      setTimeout(() => playSound('combo', 1500, 0.16, 0.3), 160);
      setTimeout(() => playSound('combo', 1900, 0.22, 0.34), 250);
      setTimeout(() => playSfxFile('mixkit-fairy-magic-sparkle-871.mp3', 0.65, 'Legendary combo stinger'), 180);
    }
  }, [soundEnabled, playSound, playSfxFile]);

  const playPerfectClearSound = useCallback(() => {
    if (!soundEnabled) return;
    playSound('perfectClear', 1200, 0.2);
    setTimeout(() => playSound('perfectClear', 1400, 0.2), 150);
    setTimeout(() => playSound('perfectClear', 1600, 0.2), 300);
    setTimeout(() => playSound('perfectClear', 2000, 0.4), 450);
  }, [soundEnabled, playSound]);

  const playLevelUpSound = useCallback(() => {
    if (!soundEnabled) return;
    playSfxFile('mixkit-video-game-treasure-2066.wav', 0.6, 'Level up sound');
  }, [soundEnabled, playSfxFile]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      safeSetItem('brickxSoundEnabled', newValue.toString());
      if (newValue) {
        playSound('menuClick', 600, 0.1);
      }
      return newValue;
    });
  }, [playSound]);

  // Background Music System
  const getNextGameplayTrack = useCallback(() => {
    // Rebuild queue when depleted so every track gets a turn before repeats.
    if (gameplayTrackCursorRef.current >= gameplayTrackQueueRef.current.length) {
      const queue = shuffleTracks(GAMEPLAY_TRACKS);

      // Avoid immediate repeat across queue boundaries when possible.
      if (queue.length > 1 && queue[0] === currentTrackRef.current) {
        const swapIndex = 1 + Math.floor(Math.random() * (queue.length - 1));
        [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
      }

      gameplayTrackQueueRef.current = queue;
      gameplayTrackCursorRef.current = 0;
    }

    const nextTrack = gameplayTrackQueueRef.current[gameplayTrackCursorRef.current];
    gameplayTrackCursorRef.current += 1;
    return nextTrack;
  }, []);

  const startMusic = useCallback((trackKey = null, isGameplay = false) => {
    if (!musicEnabled) return;
    
    // Determine which track to play
    let track;
    let shouldCycle = false;
    
    if (trackKey) {
      track = MUSIC_PLAYLIST[trackKey];
    } else if (isGameplay || gameStarted) {
      // During gameplay, cycle through a shuffled queue for variety without repeats.
      track = getNextGameplayTrack();
      shouldCycle = true;
    } else {
      // Menu music
      track = MUSIC_PLAYLIST.menu;
    }

    if (!track) return;
    
    // If already playing this track, don't restart
    if (currentTrackRef.current === track && musicPlayerRef.current && !musicPlayerRef.current.paused) {
      return;
    }
    
    // Stop current music if playing
    if (musicPlayerRef.current) {
      musicPlayerRef.current.pause();
      musicPlayerRef.current.currentTime = 0;
      musicPlayerRef.current.removeEventListener('ended', musicPlayerRef.current.onEndedHandler);
    }
    
    // Create new audio element
    try {
      const audio = new Audio(`${process.env.PUBLIC_URL}/${track}`);
      audio.volume = musicVolume;
      
      if (shouldCycle) {
        // Use refs so cycling logic reads the latest game/music state.
        const onEndedHandler = () => {
          if (gameStartedRef.current && musicEnabledRef.current) {
            startMusic(null, true);
          }
        };
        audio.loop = false;
        audio.addEventListener('ended', onEndedHandler);
        audio.onEndedHandler = onEndedHandler; // Store reference for cleanup
      } else {
        // For menu music, loop continuously
        audio.loop = true;
      }
      
      // Play the track
      audio.play().catch(err => {
        console.warn('Music playback blocked:', err.message);
      });
      
      musicPlayerRef.current = audio;
      currentTrackRef.current = track;
      setNowPlayingTrack(formatTrackLabel(track));
    } catch (err) {
      console.error('Error loading music:', err);
    }
  }, [musicEnabled, musicVolume, gameStarted, getNextGameplayTrack]);

  const stopMusic = useCallback(() => {
    if (musicPlayerRef.current) {
      musicPlayerRef.current.pause();
      musicPlayerRef.current.currentTime = 0;
      musicPlayerRef.current = null;
      currentTrackRef.current = null;
    }
    setNowPlayingTrack('');
    gameplayTrackQueueRef.current = [];
    gameplayTrackCursorRef.current = 0;
  }, []);

  // Update music intensity based on level and speed
  const updateMusicIntensity = useCallback((currentLevel) => {
    // Intensity ranges from 1.0 (slow/easy) to 3.0 (fast/hard)
    const newIntensity = Math.min(3.0, 1.0 + (currentLevel - 1) * 0.15);
    musicIntensity.current = newIntensity;
    // Music now cycles randomly through gameplay tracks
  }, []);
  
  const toggleMusic = useCallback(() => {
    setMusicEnabled(prev => {
      const newValue = !prev;
      safeSetItem('brickxMusicEnabled', newValue.toString());
      if (!newValue) {
        // Stop music
        if (musicPlayerRef.current) {
          musicPlayerRef.current.pause();
          musicPlayerRef.current.currentTime = 0;
          musicPlayerRef.current = null;
          currentTrackRef.current = null;
        }
        setNowPlayingTrack('');
      } else if (gameStarted && !gameOver && !isPaused) {
        startMusic(null, true);
      }
      return newValue;
    });
  }, [gameStarted, gameOver, isPaused, startMusic]);
  
  // Update music player volume when musicVolume changes
  useEffect(() => {
    if (musicPlayerRef.current) {
      musicPlayerRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Start menu music when at main menu
  useEffect(() => {
    if (!gameStarted && !gameOver && musicEnabled && !showSplash) {
      // Small delay to ensure clean transition
      const timer = setTimeout(() => {
        // Only start menu music if not already playing it
        if (!musicPlayerRef.current || currentTrackRef.current !== MUSIC_PLAYLIST.menu) {
          startMusic('menu');
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (gameStarted || gameOver) {
      // Music will be controlled by game flow
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, gameOver, musicEnabled, showSplash]);

  // Enhanced sound effects with more variations
  const playPieceSound = useCallback((pieceType) => {
    if (!soundEnabled) return;
    
    const pieceFrequencies = {
      'I': 400,
      'O': 450,
      'T': 500,
      'S': 550,
      'Z': 600,
      'J': 650,
      'L': 700
    };
    
    const freq = pieceFrequencies[pieceType] || 500;
    playSound('move', freq, 0.08, 0.08);
  }, [soundEnabled, playSound]);

  const playCollisionSound = useCallback(() => {
    if (!soundEnabled) return;
    playSound('drop', 100, 0.2, 0.15);
  }, [soundEnabled, playSound]);

  const playRotateSuccessSound = useCallback(() => {
    if (!soundEnabled) return;
    playSfxFile('mixkit-quick-positive-video-game-notification-interface-265.wav', 0.5, 'Rotate sound');
  }, [soundEnabled, playSfxFile]);

  const playHoldSound = useCallback(() => {
    if (!soundEnabled) return;
    playSound('menuClick', 700, 0.1, 0.12);
  }, [soundEnabled, playSound]);

  const playGameOverSound = useCallback(() => {
    if (!soundEnabled) return;
    playSfxFile('mixkit-game-experience-level-increased-2062.wav', 0.5, 'Game over sound');
  }, [soundEnabled, playSfxFile]);

  // Achievement definitions with avatar rewards
  const achievementsList = {
    firstGame: { 
      name: 'First Steps', 
      description: 'Play your first game', 
      icon: '🎮', 
      requirement: () => statistics.totalGames >= 1,
      rewards: [] 
    },
    scorer100: { 
      name: 'Century', 
      description: 'Score 100 points', 
      icon: '💯', 
      requirement: () => statistics.totalScore >= 100,
      rewards: ['🎪', '🍕']
    },
    scorer1000: { 
      name: 'Millennium', 
      description: 'Score 1,000 points', 
      icon: '⭐', 
      requirement: () => statistics.totalScore >= 1000,
      rewards: ['⭐', '💎', '🍔']
    },
    scorer10000: { 
      name: 'Legend', 
      description: 'Score 10,000 points', 
      icon: '👑', 
      requirement: () => statistics.totalScore >= 10000,
      rewards: ['👑', '🦄', '🐉', '💀', '🧛']
    },
    lines10: { 
      name: 'Line Clearer', 
      description: 'Clear 10 lines', 
      icon: '📏', 
      requirement: () => statistics.totalLines >= 10,
      rewards: ['🎨', '🎂', '🎵']
    },
    lines100: { 
      name: 'Line Master', 
      description: 'Clear 100 lines', 
      icon: '🎯', 
      requirement: () => statistics.totalLines >= 100,
      rewards: ['🎯', '🌟', '🐸']
    },
    lines1000: { 
      name: 'Line Legend', 
      description: 'Clear 1,000 lines', 
      icon: '🚀', 
      requirement: () => statistics.totalLines >= 1000,
      rewards: ['🚀', '💫', '🐼', '🦸']
    },
    combo5: { 
      name: 'Combo Starter', 
      description: 'Get a 5x combo', 
      icon: '🔥', 
      requirement: () => statistics.bestCombo >= 5,
      rewards: ['🔥', '🎭', '🍩']
    },
    combo10: { 
      name: 'Combo Master', 
      description: 'Get a 10x combo', 
      icon: '💥', 
      requirement: () => statistics.bestCombo >= 10,
      rewards: ['💥', '🦁', '🤡', '👽']
    },
    speedster: { 
      name: 'Speedster', 
      description: 'Complete Sprint mode under 2 minutes', 
      icon: '⚡', 
      requirement: () => statistics.bestSprintTime && statistics.bestSprintTime < 120000,
      rewards: ['⚡', '👻', '🌈', '🥷']
    },
    marathoner: { 
      name: 'Marathoner', 
      description: 'Score 50,000 in Marathon mode', 
      icon: '🏃', 
      requirement: () => statistics.longestMarathon >= 50000,
      rewards: ['🏃', '🦖', '🎸', '🧙']
    },
    piecesPlacer: { 
      name: 'Block Builder', 
      description: 'Place 1,000 pieces', 
      icon: '🧱', 
      requirement: () => statistics.totalPieces >= 1000,
      rewards: ['🤖', '🧱', '☕', '🦹']
    }
  };

  // Check and unlock achievements
  const checkAchievements = useCallback(() => {
    const newAchievements = { ...achievements };
    let hasNew = false;
    let newlyUnlocked = null;

    Object.keys(achievementsList).forEach(key => {
      if (!newAchievements[key] && achievementsList[key].requirement()) {
        newAchievements[key] = { unlocked: true, date: new Date().toISOString() };
        hasNew = true;
        
        // Only show notification for first new achievement
        if (!newlyUnlocked) {
          const achievement = achievementsList[key];
          newlyUnlocked = {
            name: achievement.name || '',
            description: achievement.description || '',
            icon: achievement.icon || '🏆',
            key: key,
            avatarRewards: achievement.rewards || []
          };
        }
      }
    });

    if (hasNew) {
      setAchievements(newAchievements);
      safeSetItem('brikxAchievements', JSON.stringify(newAchievements));
      
      if (newlyUnlocked) {
        setNewAchievement(newlyUnlocked);
        setTimeout(() => setNewAchievement(null), 5000);
        playSound('achievement', 800, 0.3);
      }
    }
  }, [achievements, statistics, playSound]);

  // Update statistics
  const updateStatistics = useCallback((updates) => {
    const newStats = { ...statistics, ...updates };
    setStatistics(newStats);
    safeSetItem('brikxStatistics', JSON.stringify(newStats));
    checkAchievements();
  }, [statistics, checkAchievements]);

  // Detect mobile device and touch capability
  useEffect(() => {
    const checkMobile = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 1024;
      setIsMobile(hasTouch || isMobileUA || isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection || typeof connection.addEventListener !== 'function') return undefined;

    const handleConnectionChange = () => {
      setSaveDataEnabled(Boolean(connection.saveData));
    };

    connection.addEventListener('change', handleConnectionChange);
    return () => connection.removeEventListener('change', handleConnectionChange);
  }, []);

  const autoBatterySaverEnabled = isMobile && (saveDataEnabled || isLowEndDevice);
  const lowPowerMode = batterySaverMode === 'on'
    ? true
    : batterySaverMode === 'off'
      ? false
      : autoBatterySaverEnabled;

  // Initialize ambient background particles for atmospheric depth
  const initBgParticles = useCallback((canvasWidth, canvasHeight) => {
    if (lowPowerMode || prefersReducedMotion) return;
    const count = 60;
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.3 - Math.random() * 0.4,
        size: 0.8 + Math.random() * 1.6,
        alpha: 0.08 + Math.random() * 0.18,
        twinkleSpeed: 0.02 + Math.random() * 0.04,
        twinkleOffset: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.7, // parallax depth
        color: i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0, // 0=white, 1=accent, 2=warm
      });
    }
    gameState.current.bgParticles = particles;
  }, [lowPowerMode, prefersReducedMotion]);

  // Save profile changes
  const saveProfile = useCallback((name, avatar) => {
    const sanitizedName = name.trim() || 'Player';
    // Only allow unlocked avatars
    const unlocked = getUnlockedAvatars();
    const sanitizedAvatar = unlocked.includes(avatar) ? avatar : '🎮';
    setPlayerName(sanitizedName);
    setPlayerAvatar(sanitizedAvatar);
    safeSetItem('brickxPlayerName', sanitizedName);
    safeSetItem('brickxPlayerAvatar', sanitizedAvatar);
  }, [getUnlockedAvatars]);

  const buildCloudProfileSnapshot = useCallback(() => {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      playerName,
      playerAvatar,
      highScore,
      leaderboardEntries: normalizeLeaderboardEntries(leaderboardEntries),
      statistics,
      achievements,
      soundEnabled,
      musicEnabled,
      sfxVolume,
      musicVolume,
      batterySaverMode,
      currentTheme,
      themePreviewEnabled,
      deviceId: safeGetItem('brikx_device_id', '')
    };
  }, [
    playerName,
    playerAvatar,
    highScore,
    leaderboardEntries,
    statistics,
    achievements,
    soundEnabled,
    musicEnabled,
    sfxVolume,
    musicVolume,
    batterySaverMode,
    currentTheme,
    themePreviewEnabled
  ]);

  const applyCloudProfileSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;

    const normalizeVolume = (value, fallback) => {
      const parsed = Number.parseFloat(value);
      if (Number.isNaN(parsed)) return fallback;
      return Math.min(1, Math.max(0, parsed));
    };

    const normalizedName = (snapshot.playerName || 'Player').toString().slice(0, 15).replace(/[^a-zA-Z0-9\s]/g, '') || 'Player';
    const normalizedAvatar = typeof snapshot.playerAvatar === 'string' && snapshot.playerAvatar.trim()
      ? snapshot.playerAvatar.trim().slice(0, 8)
      : '🎮';

    setPlayerName(normalizedName);
    setPlayerAvatar(normalizedAvatar);
    safeSetItem('brickxPlayerName', normalizedName);
    safeSetItem('brickxPlayerAvatar', normalizedAvatar);

    if (Number.isFinite(snapshot.highScore)) {
      const normalizedHighScore = Math.max(0, Number.parseInt(snapshot.highScore, 10) || 0);
      setHighScore(normalizedHighScore);
      safeSetItem('brikxHighScore', normalizedHighScore.toString());
    }

    if (Array.isArray(snapshot.leaderboardEntries)) {
      const normalizedEntries = normalizeLeaderboardEntries(snapshot.leaderboardEntries);
      setLeaderboardEntries(normalizedEntries);
      safeSetItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(normalizedEntries));
    }

    if (snapshot.statistics && typeof snapshot.statistics === 'object' && !Array.isArray(snapshot.statistics)) {
      setStatistics(snapshot.statistics);
      safeSetItem('brikxStatistics', JSON.stringify(snapshot.statistics));
    }

    if (snapshot.achievements && typeof snapshot.achievements === 'object' && !Array.isArray(snapshot.achievements)) {
      setAchievements(snapshot.achievements);
      safeSetItem('brikxAchievements', JSON.stringify(snapshot.achievements));
    }

    if (typeof snapshot.soundEnabled === 'boolean') {
      setSoundEnabled(snapshot.soundEnabled);
      safeSetItem('brickxSoundEnabled', snapshot.soundEnabled.toString());
    }

    if (typeof snapshot.musicEnabled === 'boolean') {
      setMusicEnabled(snapshot.musicEnabled);
      safeSetItem('brickxMusicEnabled', snapshot.musicEnabled.toString());
    }

    if (snapshot.sfxVolume !== undefined) {
      const nextSfxVolume = normalizeVolume(snapshot.sfxVolume, 0.7);
      setSfxVolume(nextSfxVolume);
      safeSetItem('brickxSfxVolume', nextSfxVolume.toString());
    }

    if (snapshot.musicVolume !== undefined) {
      const nextMusicVolume = normalizeVolume(snapshot.musicVolume, 0.5);
      setMusicVolume(nextMusicVolume);
      safeSetItem('brickxMusicVolume', nextMusicVolume.toString());
    }

    if (snapshot.batterySaverMode === 'off' || snapshot.batterySaverMode === 'auto' || snapshot.batterySaverMode === 'on') {
      setBatterySaverMode(snapshot.batterySaverMode);
      safeSetItem('brickxBatterySaverMode', snapshot.batterySaverMode);
    }

    if (typeof snapshot.themePreviewEnabled === 'boolean') {
      setThemePreviewEnabled(snapshot.themePreviewEnabled);
      safeSetItem('brickxThemePreviewEnabled', snapshot.themePreviewEnabled.toString());
    }

    const themeId = typeof snapshot.currentTheme === 'string' ? snapshot.currentTheme : '';
    if (themeId && THEME_DEFINITIONS[themeId]) {
      setCurrentTheme(themeId);
      safeSetItem('brikx_theme', themeId);
    }

    if (typeof snapshot.deviceId === 'string' && snapshot.deviceId.trim()) {
      safeSetItem('brikx_device_id', snapshot.deviceId.trim().slice(0, 60));
    }
  }, []);

  useEffect(() => {
    if (cloudProfileRestoreAttemptedRef.current) return;
    cloudProfileRestoreAttemptedRef.current = true;

    const hasLocalProgress =
      (Number.parseInt(safeGetItem('brikxHighScore', '0'), 10) || 0) > 0 ||
      safeGetItem('brikxStatistics', '') !== '' ||
      safeGetItem('brikxAchievements', '') !== '' ||
      safeGetItem(LEADERBOARD_STORAGE_KEY, '[]') !== '[]';

    if (hasLocalProgress) return;

    let canceled = false;
    (async () => {
      const result = await loadCloudProfileSnapshot();
      if (!canceled && result.success && result.snapshot) {
        applyCloudProfileSnapshot(result.snapshot);
        console.log('Restored cloud profile snapshot after fresh install.');
      }
    })();

    return () => {
      canceled = true;
    };
  }, [applyCloudProfileSnapshot]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return undefined;

    const snapshot = buildCloudProfileSnapshot();
    if (cloudProfileSyncTimerRef.current) {
      clearTimeout(cloudProfileSyncTimerRef.current);
    }

    cloudProfileSyncTimerRef.current = setTimeout(async () => {
      const result = await saveCloudProfileSnapshot(snapshot);
      if (!result.success) {
        console.warn('Cloud profile sync skipped:', result.error);
      }
    }, 1400);

    return () => {
      if (cloudProfileSyncTimerRef.current) {
        clearTimeout(cloudProfileSyncTimerRef.current);
      }
    };
  }, [buildCloudProfileSnapshot]);

  // Game constants
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 35; // Upgraded from 30px for better visibility (17% larger)
  const BOARD_WIDTH = COLS * BLOCK_SIZE; // 350px
  const BOARD_HEIGHT = ROWS * BLOCK_SIZE; // 700px
  const CANVAS_WIDTH = BOARD_WIDTH + 260; // 610px total (350 + 130 hold + 130 next panels)
  const CANVAS_HEIGHT = BOARD_HEIGHT; // 700px

  // Tetromino shapes
  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  };

  const COLORS = {
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    S: '#00f000',
    Z: '#f00000',
    J: '#0000f0',
    L: '#f0a000'
  };

  // Game state
  const gameState = useRef({
    board: Array(ROWS).fill(null).map(() => Array(COLS).fill(0)),
    currentPiece: null,
    currentX: 0,
    currentY: 0,
    nextPieces: [],
    holdPiece: null,
    canHold: true,
    dropCounter: 0,
    dropInterval: 1000,
    lastTime: 0,
    lastRenderTime: 0,
    avgFrameMs: 16.67,
    colorBonusDisplay: null,
    bag: [],
    particles: [],
    bgParticles: [],
    clearingLines: [],
    clearAnimation: 0,
    scorePopups: [],
    screenShake: 0,
    gridAnimation: 0,
    pieceLockAnimation: 0,
    flashEffect: 0,
    hardDropTrail: [],
    perfectClearFlash: 0,
    comboFlash: 0,
    comboBannerBurst: null,
    chromaticAberration: 0,
    saturationBoost: 0,
    scanlineFlash: [],
    lastMoveWasTSpin: false,
    gamepadState: {
      lastButtons: [],
      lastAxes: [0, 0],
      moveDelay: 0,
      rotateDelay: 0
    }
  });

  // 7-bag randomizer for fair piece distribution
  const fillBag = useCallback(() => {
    const pieces = Object.keys(SHAPES);
    const bag = [...pieces];
    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }, [SHAPES]);

  // Get next piece from bag
  const getNextPiece = useCallback(() => {
    if (gameState.current.bag.length === 0) {
      gameState.current.bag = fillBag();
    }
    const pieceType = gameState.current.bag.pop();
    return {
      shape: SHAPES[pieceType],
      color: COLORS[pieceType],
      type: pieceType
    };
  }, [fillBag, SHAPES, COLORS]);

  // Check collision
  const checkCollision = useCallback((board, piece, offsetX, offsetY) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = offsetX + x;
          const newY = offsetY + y;
          
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          
          if (newY >= 0 && board[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }, [COLS, ROWS]);

  // Calculate ghost piece position
  // eslint-disable-next-line no-unused-vars
  const calculateGhostPosition = useCallback((board, piece, startX, startY) => {
    let ghostY = startY;
    while (!checkCollision(board, piece, startX, ghostY + 1)) {
      ghostY++;
    }
    return ghostY;
  }, [checkCollision]);

  // Rotate piece
  const rotatePiece = useCallback((piece) => {
    const rotated = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );
    return { ...piece, shape: rotated };
  }, []);

  // Merge piece to board
  const mergePiece = useCallback(() => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    
    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const boardY = currentY + y;
          const boardX = currentX + x;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            board[boardY][boardX] = currentPiece.color;
          }
        }
      });
    });
  }, [ROWS, COLS]);

  // Add score popup
  const addScorePopup = useCallback((points, text, x, y) => {
    const isHypePopup = typeof text === 'string' && (text.includes('COMBO') || text.includes('PERFECT'));
    const mobileScale = isMobile ? (isHypePopup ? 1.65 : 1.35) : (isHypePopup ? 1.2 : 1);
    gameState.current.scorePopups.push({
      points,
      text,
      x,
      y,
      life: isHypePopup ? 72 : 60,
      maxLife: isHypePopup ? 72 : 60,
      vy: isHypePopup ? -2.6 : -2,
      scale: mobileScale
    });
  }, [isMobile]);

  // Get color for combo tier
  const getComboColor = useCallback((combo) => {
    if (combo >= 15) return { color: '#ff00ff', glow: 25, name: 'LEGENDARY' };
    if (combo >= 10) return { color: '#ff0000', glow: 20, name: 'MEGA' };
    if (combo >= 5) return { color: '#ff8800', glow: 15, name: 'SUPER' };
    if (combo >= 2) return { color: '#ffff00', glow: 12, name: 'COMBO' };
    return { color: '#ffffff', glow: 10, name: '' };
  }, []);

  // Add particles for visual effects with pooling and new types
  const addLineParticles = useCallback((y, isCombo = false, isPerfect = false, comboCount = 0) => {
    const boardOffsetX = 130;
    const isHighCombo = comboCount >= 5;
    const isMegaCombo = comboCount >= 10;
    const mobileParticleScale = isMobile ? (lowPowerMode ? 1.25 : 1.55) : 1;
    
    // Reduce particle count for reduced motion preference
    const motionMultiplier = lowPowerMode ? 0.2 : prefersReducedMotion ? 0.3 : 1;
    const baseParticleCount = Math.floor((isMegaCombo ? 20 : isHighCombo ? 16 : isPerfect ? 12 : isCombo ? 8 : 6) * motionMultiplier);
    const particleTypes = ['circle', 'star', 'square', 'spark', 'diamond', 'ring', 'confetti'];
    
    for (let x = 0; x < COLS; x++) {
      const blockColor = gameState.current.board[y][x];
      const centerX = boardOffsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2;
      const centerY = y * BLOCK_SIZE + BLOCK_SIZE / 2;
      
      // Create circular explosion with multiple rings
      const rings = isPerfect ? 3 : isCombo ? 2 : 1;
      
      for (let ring = 0; ring < rings; ring++) {
        const particlesInRing = baseParticleCount + ring * (isMegaCombo ? 8 : isHighCombo ? 6 : 4);
        const ringSpeed = (isMegaCombo ? 8 : isHighCombo ? 6.5 : isPerfect ? 5 : isCombo ? 3.5 : 2.5) * (1 + ring * 0.5);
        const ringDelay = ring * 5;
        
        for (let i = 0; i < particlesInRing; i++) {
          const angle = (Math.PI * 2 * i) / particlesInRing + (ring * Math.PI / particlesInRing);
          const speed = ringSpeed + Math.random() * 2;
          const size = ((isPerfect ? 5 : isCombo ? 4 : 3) + Math.random() * 2 - ring * 0.5) * mobileParticleScale;
          
          const particle = getParticleFromPool({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: (isPerfect ? 100 : isCombo ? 80 : 60) - ringDelay,
            maxLife: isPerfect ? 100 : isCombo ? 80 : 60,
            color: blockColor,
            size: size,
            type: particleTypes[Math.floor(Math.random() * particleTypes.length)],
            rotation: angle,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            glow: true,
            trail: isPerfect || (isCombo && ring === 0),
            pulse: isPerfect || isCombo,
            ring: ring,
            bounce: isMegaCombo || isPerfect
          });
          
          if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
            gameState.current.particles.push(particle);
          }
        }
        
        // Add expanding ring wave effect
        if (isPerfect || isCombo) {
          const wave = getParticleFromPool({
            x: centerX,
            y: centerY,
            vx: 0,
            vy: 0,
            life: 40 - ring * 10,
            maxLife: 40,
            color: blockColor,
            size: 2,
            type: 'wave',
            rotation: 0,
            rotationSpeed: 0,
            glow: true,
            trail: false,
            pulse: false,
            ring: ring,
            waveRadius: 5 + ring * 10,
            waveSpeed: 4 + ring * 2,
            bounce: false
          });
          if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
            gameState.current.particles.push(wave);
          }
        }
      }
      
      // Add confetti for TETRIS or Perfect Clear
      if (isPerfect || (isCombo && comboCount >= 4)) {
        const confettiCount = Math.floor((isPerfect ? 25 : 15) * motionMultiplier);
        const comboColors = getComboColor(comboCount);
        for (let i = 0; i < confettiCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 5;
          const confetti = getParticleFromPool({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            life: 80 + Math.random() * 40,
            maxLife: 120,
            color: Math.random() > 0.3 ? comboColors.color : blockColor,
            size: (2 + Math.random() * 3) * mobileParticleScale,
            type: 'confetti',
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.5,
            glow: true,
            trail: false,
            pulse: false,
            ring: 0,
            bounce: true,
            flutter: Math.random() * 0.3
          });
          if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
            gameState.current.particles.push(confetti);
          }
        }
      }
      
      // Add burst of small particles in random directions
      if (isPerfect || isMegaCombo || isHighCombo) {
        const burstCount = Math.floor((isMegaCombo ? 30 : isHighCombo ? 22 : 15) * motionMultiplier);
        for (let i = 0; i < burstCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 6;
          const burst = getParticleFromPool({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 60 + Math.random() * 40,
            maxLife: 100,
            color: Math.random() > 0.5 ? '#ffffff' : blockColor,
            size: (1 + Math.random() * 2) * mobileParticleScale,
            type: Math.random() > 0.5 ? 'circle' : 'star',
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.4,
            glow: true,
            trail: true,
            pulse: true,
            ring: 0,
            bounce: false
          });
          if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
            gameState.current.particles.push(burst);
          }
        }
      }
      
      // Add lightning chains for mega combos
      if (isMegaCombo && x < COLS - 1) {
        const lightning = getParticleFromPool({
          x: centerX,
          y: centerY,
          x2: centerX + BLOCK_SIZE,
          y2: centerY,
          vx: 0,
          vy: 0,
          life: 20,
          maxLife: 20,
          color: getComboColor(comboCount).color,
          size: 2 * mobileParticleScale,
          type: 'lightning',
          rotation: 0,
          rotationSpeed: 0,
          glow: true,
          trail: false,
          pulse: true,
          ring: 0,
          bounce: false
        });
        if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
          gameState.current.particles.push(lightning);
        }
      }
      
      // Add extra sparkle particles for special effects
      if (isPerfect || isCombo) {
        for (let i = 0; i < (isPerfect ? 5 : 3); i++) {
          const sparkle = getParticleFromPool({
            x: centerX + (Math.random() - 0.5) * 20,
            y: centerY + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 3,
            vy: -3 - Math.random() * 4,
            life: 70,
            maxLife: 70,
            color: '#ffffff',
            size: (2 + Math.random() * 2) * mobileParticleScale,
            type: 'star',
            rotation: 0,
            rotationSpeed: 0.4,
            glow: true,
            trail: true,
            pulse: true,
            ring: 0,
            bounce: false
          });
          if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
            gameState.current.particles.push(sparkle);
          }
        }
      }
    }
  }, [COLS, BLOCK_SIZE, getParticleFromPool, getComboColor, MAX_ACTIVE_PARTICLES, prefersReducedMotion, lowPowerMode, isMobile]);

  // Spawn debris shards when a line is cleared (broken block fragments)
  const addDebrisParticles = useCallback((y, boardOffsetX) => {
    if (lowPowerMode) return;
    const motionMultiplier = prefersReducedMotion ? 0.3 : 1;
    const mobileParticleScale = isMobile ? 1.4 : 1;
    for (let x = 0; x < COLS; x++) {
      const blockColor = gameState.current.board[y][x];
      if (!blockColor) continue;
      const centerX = boardOffsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2;
      const centerY = y * BLOCK_SIZE + BLOCK_SIZE / 2;
      const shardCount = Math.floor(4 * motionMultiplier);
      for (let i = 0; i < shardCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        const shard = getParticleFromPool({
          x: centerX + (Math.random() - 0.5) * BLOCK_SIZE * 0.6,
          y: centerY + (Math.random() - 0.5) * BLOCK_SIZE * 0.6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          life: 45 + Math.random() * 30,
          maxLife: 75,
          color: blockColor,
          size: (2 + Math.random() * 3) * mobileParticleScale,
          type: 'debris',
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.35,
          glow: true,
          trail: false,
          pulse: false,
          ring: 0,
          bounce: false,
          scaleX: 0.4 + Math.random() * 0.8,
          scaleY: 0.3 + Math.random() * 0.5,
        });
        if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
          gameState.current.particles.push(shard);
        }
      }
      // Plasma burst at each block position for spectacular effect
      if (Math.random() > 0.5) {
        const plasma = getParticleFromPool({
          x: centerX, y: centerY,
          vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2,
          life: 35, maxLife: 35,
          color: blockColor, size: (5 + Math.random() * 4) * mobileParticleScale,
          type: 'plasma',
          rotation: 0, rotationSpeed: 0.08,
          glow: true, trail: false, pulse: true, ring: 0, bounce: false,
          innerColor: '#ffffff',
        });
        if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
          gameState.current.particles.push(plasma);
        }
      }
    }
  }, [COLS, BLOCK_SIZE, getParticleFromPool, MAX_ACTIVE_PARTICLES, prefersReducedMotion, lowPowerMode, isMobile]);
  const clearLines = useCallback(() => {
    const { board } = gameState.current;
    const linesToClear = [];
    let colorBonusPoints = 0;
    
    // Find all complete lines
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(cell => cell !== 0)) {
        linesToClear.push(y);
        
        // Calculate color matching bonus
        const colorGroups = {};
        board[y].forEach(color => {
          colorGroups[color] = (colorGroups[color] || 0) + 1;
        });
        
        // eslint-disable-next-line no-loop-func
        Object.values(colorGroups).forEach(count => {
          if (count >= 3) {
            colorBonusPoints += count * 50;
          }
          if (count === COLS) {
            colorBonusPoints += 500;
          }
        });
      }
    }
    
    if (linesToClear.length > 0) {
      const comboChain = lastClearWasCombo ? combo + 1 : 1;
      // Check for perfect clear
      const isPerfectClear = board.every(row => row.every(cell => cell === 0));
      const isCombo = combo > 0;
      
      // Vibration feedback based on lines cleared
      if (isPerfectClear) {
        vibrate([30, 30, 30, 30, 50]); // Triple pulse + strong
      } else if (linesToClear.length === 4) {
        vibrate([20, 20, 20, 20, 30]); // Tetris - strong pattern
      } else if (isCombo && combo > 1) {
        vibrate([15, 10, 15]); // Combo - double pulse
      } else {
        vibrate(15 * linesToClear.length); // Single pulse, duration based on lines
      }
      
      // Play appropriate sound effects
      if (isPerfectClear) {
        playPerfectClearSound();
      } else if (isCombo && combo > 1) {
        playComboSound(combo);
      } else {
        playLineClearSound(linesToClear.length);
      }
      
      // Add particles for line clear effect
      linesToClear.forEach(y => addLineParticles(y, isCombo, isPerfectClear, combo));
      
      // Add debris shards flying from each cleared cell
      const boardOffsetX = 130;
      linesToClear.forEach(y => addDebrisParticles(y, boardOffsetX));

      // Trigger scanline flash strips for each cleared row
      if (!prefersReducedMotion) {
        linesToClear.forEach(y => {
          gameState.current.scanlineFlash.push({ y, life: 18, maxLife: 18 });
        });
        // Chromatic aberration on Tetris or Perfect Clear
        if (linesToClear.length >= 4 || isPerfectClear) {
          gameState.current.chromaticAberration = isPerfectClear ? 20 : 12;
        }
        // Boost saturation for visual pop on line clears
        gameState.current.saturationBoost = isPerfectClear ? 1.5 : Math.min(1.2, linesToClear.length * 0.35);
      }
      
      // Store lines for animation
      gameState.current.clearingLines = linesToClear;
      gameState.current.clearAnimation = 15;
      
      // Remove cleared lines after brief delay
      setTimeout(() => {
        linesToClear.sort((a, b) => b - a).forEach(y => {
          board.splice(y, 1);
          board.unshift(Array(COLS).fill(0));
        });
        gameState.current.clearingLines = [];
      }, 150);
      
      const linesCleared = linesToClear.length;
      setLines(prev => prev + linesCleared);
      
      // Update statistics
      updateStatistics({
        totalLines: statistics.totalLines + linesCleared,
        bestCombo: Math.max(statistics.bestCombo, combo + 1)
      });
      
      // Sprint mode: track remaining lines
      if (gameMode === 'sprint') {
        const newRemaining = Math.max(0, sprintLinesRemaining - linesCleared);
        setSprintLinesRemaining(newRemaining);
        
        if (newRemaining === 0) {
          // Sprint completed!
          try {
            const completionTime = Date.now() - (startTime || Date.now());
            setGameOver(true);
            setGameStarted(false);
            stopMusic();
            
            // Update best sprint time
            if (!statistics.bestSprintTime || completionTime < statistics.bestSprintTime) {
              updateStatistics({ bestSprintTime: completionTime });
            }
            
            playSound('achievement', 1200, 0.5);
          } catch (error) {
            console.error('Error during sprint completion:', error);
            setGameOver(true);
            setGameStarted(false);
          }
          return;
        }
      }
      
      // Combo system
      if (lastClearWasCombo) {
        setCombo(prev => prev + 1);
      } else {
        setCombo(1);
        setLastClearWasCombo(true);
      }

      // Play tier stinger only when crossing a new combo milestone.
      if (comboChain >= 15 && combo < 15) {
        playComboTierStinger(15);
      } else if (comboChain >= 10 && combo < 10) {
        playComboTierStinger(10);
      } else if (comboChain >= 5 && combo < 5) {
        playComboTierStinger(5);
      }
      
      // Perfect clear bonus
      let perfectClearBonus = 0;
      if (isPerfectClear) {
        perfectClearBonus = 3000;
        gameState.current.colorBonusDisplay = {
          points: perfectClearBonus,
          text: 'PERFECT CLEAR!',
          time: 90
        };
      }
      
      // Score calculation
      const basePoints = [0, 100, 300, 500, 800][linesCleared] * level;
      const comboBonus = combo * 50 * level;
      const totalPoints = basePoints + colorBonusPoints + comboBonus + perfectClearBonus;
      
      // Add screen shake based on clear type
      if (isPerfectClear) {
        gameState.current.screenShake = 25;
        gameState.current.perfectClearFlash = 30; // Full-screen flash for perfect clear
      } else if (comboChain >= 15) {
        gameState.current.screenShake = isMobile ? 32 : 28;
        gameState.current.comboFlash = isMobile ? 28 : 24;
        gameState.current.comboBannerBurst = {
          life: isMobile ? 52 : 46,
          maxLife: isMobile ? 52 : 46,
          combo: comboChain
        };
      } else if (comboChain >= 10) {
        gameState.current.screenShake = isMobile ? 28 : 24;
        gameState.current.comboFlash = isMobile ? 24 : 20; // Strong flash for mega combo
      } else if (comboChain >= 5) {
        gameState.current.screenShake = isMobile ? 24 : 20;
        gameState.current.comboFlash = isMobile ? 20 : 16; // Super combo shake for 5x+
      } else if (linesCleared >= 4) {
        gameState.current.screenShake = 16; // TETRIS gets intense shake!
        gameState.current.flashEffect = 15; // White flash for Tetris
      } else if (isCombo || linesCleared >= 3) {
        gameState.current.screenShake = 12;
        gameState.current.flashEffect = 12; // Flash for triple
      } else if (linesCleared >= 2) {
        gameState.current.screenShake = 6;
        gameState.current.flashEffect = 8; // Small flash for double
      }
      
      // Add score popup
      const popupX = 130 + (COLS * BLOCK_SIZE) / 2;
      const popupY = linesToClear[0] * BLOCK_SIZE + BLOCK_SIZE / 2;
      addScorePopup(totalPoints, isPerfectClear ? 'PERFECT!' : isCombo ? `${comboChain}x COMBO!` : '', popupX, popupY);
      
      setScore(prev => {
        const newScore = prev + totalPoints;
        if (newScore > highScore) {
          setHighScore(newScore);
          safeSetItem('brikxHighScore', newScore.toString());
        }
        return newScore;
      });
      
      // Show bonus notifications
      if (colorBonusPoints > 0 && !isPerfectClear) {
        gameState.current.colorBonusDisplay = {
          points: colorBonusPoints + comboBonus,
          text: combo > 0 ? `${comboChain}x COMBO!` : 'COLOR MATCH!',
          time: 60
        };
      }
      
      // Level up
      const newLevel = Math.floor((lines + linesCleared) / 10) + 1;
      if (newLevel !== level) {
        setLevel(newLevel);
        setLevelFlash(newLevel);
        gameState.current.dropInterval = Math.max(100, 1000 - (newLevel - 1) * 100);
        
        // Update music intensity for new level
        updateMusicIntensity(newLevel);
        
        // Play level up sound
        playLevelUpSound();
        
        // Clear level flash after 2 seconds
        setTimeout(() => setLevelFlash(null), 2000);
      }
    } else {
      // Reset combo if no lines cleared
      if (lastClearWasCombo) {
        setCombo(0);
        setLastClearWasCombo(false);
      }
    }
  }, [level, lines, highScore, combo, lastClearWasCombo, ROWS, COLS, BLOCK_SIZE, addLineParticles, addDebrisParticles, addScorePopup, playLineClearSound, playComboSound, playPerfectClearSound, playLevelUpSound, playComboTierStinger, vibrate, prefersReducedMotion, isMobile]);

  // Spawn new piece
  const spawnPiece = useCallback(() => {
    const { nextPieces, board } = gameState.current;
    
    // Initialize next pieces queue if empty
    if (nextPieces.length === 0) {
      for (let i = 0; i < 5; i++) {
        nextPieces.push(getNextPiece());
      }
    }
    
    gameState.current.currentPiece = nextPieces.shift();
    nextPieces.push(getNextPiece());
    gameState.current.currentX = Math.floor(COLS / 2) - Math.floor(gameState.current.currentPiece.shape[0].length / 2);
    gameState.current.currentY = 0;
    gameState.current.canHold = true;
    
    // Update statistics
    updateStatistics({ totalPieces: statistics.totalPieces + 1 });
    
    if (checkCollision(board, gameState.current.currentPiece, gameState.current.currentX, gameState.current.currentY)) {
      try {
        setGameOver(true);
        setGameStarted(false);
        stopMusic();
        playGameOverSound();
        vibrate([50, 50, 100]); // Game over - strong double pulse
        
        // Update Marathon high score
        if (gameMode === 'marathon' && score > statistics.longestMarathon) {
          updateStatistics({ longestMarathon: score });
        }
        
        // Update total score and add to score history
        const newHistory = [...(statistics.scoreHistory || []), {
          score: score || 0,
          date: new Date().toISOString(),
          gameMode: gameMode || 'classic',
          level: level || 1,
          lines: lines || 0
        }].slice(-50); // Keep last 50 games
        
        updateStatistics({ 
          totalScore: (statistics.totalScore || 0) + (score || 0),
          scoreHistory: newHistory
        });
      } catch (error) {
        console.error('Error during game over:', error);
        // Failsafe - still set game over even if stats fail
        setGameOver(true);
        setGameStarted(false);
      }
    }
  }, [getNextPiece, checkCollision, COLS, playSound, updateStatistics, statistics.totalPieces, statistics.totalScore, statistics.longestMarathon, statistics.scoreHistory, gameMode, score, level, lines, vibrate, stopMusic, playGameOverSound]);

  // Move piece down
  const moveDown = useCallback(() => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    
    if (!checkCollision(board, currentPiece, currentX, currentY + 1)) {
      gameState.current.currentY++;
    } else {
      mergePiece();
      playCollisionSound();
      
      // Add piece lock animation
      gameState.current.pieceLockAnimation = 12;
      
      // Add lock particles at piece position
      const boardOffsetX = 130;
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const centerX = boardOffsetX + (currentX + x) * BLOCK_SIZE + BLOCK_SIZE / 2;
            const centerY = (currentY + y) * BLOCK_SIZE + BLOCK_SIZE / 2;
            
            // Small burst of particles on lock
            for (let i = 0; i < 4; i++) {
              const angle = (Math.PI * 2 * i) / 4;
              const particle = getParticleFromPool({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                life: 20,
                maxLife: 20,
                color: currentPiece.color,
                size: 2,
                type: 'spark',
                rotation: angle,
                rotationSpeed: 0.2,
                glow: true,
                trail: false,
                pulse: false,
                ring: 0,
                bounce: false
              });
              if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
                gameState.current.particles.push(particle);
              }
            }
          }
        });
      });
      
      clearLines();
      spawnPiece();
    }
  }, [checkCollision, mergePiece, clearLines, spawnPiece, playCollisionSound, BLOCK_SIZE, MAX_ACTIVE_PARTICLES, getParticleFromPool]);

  // Move piece horizontally
  const moveHorizontal = useCallback((dir) => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    const newX = currentX + dir;
    
    if (!checkCollision(board, currentPiece, newX, currentY)) {
      gameState.current.currentX = newX;
      playPieceSound(currentPiece.type);
    }
  }, [checkCollision, playPieceSound]);

  // Rotate current piece
  const rotate = useCallback(() => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    const rotated = rotatePiece(currentPiece);
    
    if (!checkCollision(board, rotated, currentX, currentY)) {
      const wasTPiece = currentPiece.shape === SHAPES.T.shape;
      gameState.current.currentPiece = rotated;
      
      // Check for T-Spin (3+ corners filled around T)
      if (wasTPiece) {
        const corners = [
          { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
          { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
        ];
        
        let filledCorners = 0;
        corners.forEach(corner => {
          const checkX = currentX + 1 + corner.dx;
          const checkY = currentY + 1 + corner.dy;
          
          if (checkX < 0 || checkX >= COLS || checkY >= ROWS || 
              (checkY >= 0 && board[checkY][checkX])) {
            filledCorners++;
          }
        });
        
        if (filledCorners >= 3) {
          gameState.current.lastMoveWasTSpin = true;
          
          // T-Spin particles
          const boardOffsetX = 130;
          const centerX = boardOffsetX + currentX * BLOCK_SIZE + (BLOCK_SIZE * 1.5);
          const centerY = currentY * BLOCK_SIZE + (BLOCK_SIZE * 1.5);
          
          for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const particle = getParticleFromPool({
              x: centerX, y: centerY,
              vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
              life: 30, maxLife: 30, color: '#ff00ff', size: 4,
              type: 'star', rotation: angle, rotationSpeed: 0.4,
              glow: true, trail: true, pulse: true, ring: 0, bounce: false
            });
            if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
              gameState.current.particles.push(particle);
            }
          }
          
          playSound('combo', 800, 0.3);
          vibrate([30, 10, 30]);
        } else {
          gameState.current.lastMoveWasTSpin = false;
        }
      }
      
      playRotateSuccessSound();
    }
  }, [checkCollision, rotatePiece, playRotateSuccessSound, SHAPES.T.shape, COLS, ROWS, BLOCK_SIZE, MAX_ACTIVE_PARTICLES, getParticleFromPool, playSound, vibrate]);

  // Hold piece
  const holdCurrentPiece = useCallback(() => {
    if (!gameState.current.canHold) return;
    
    const { currentPiece, holdPiece, board } = gameState.current;
    
    playHoldSound();
    
    if (holdPiece) {
      // Swap current with held
      gameState.current.holdPiece = currentPiece;
      gameState.current.currentPiece = holdPiece;
    } else {
      // Store current and get next
      gameState.current.holdPiece = currentPiece;
      gameState.current.currentPiece = gameState.current.nextPieces.shift();
      gameState.current.nextPieces.push(getNextPiece());
    }
    
    // Reset position
    gameState.current.currentX = Math.floor(COLS / 2) - Math.floor(gameState.current.currentPiece.shape[0].length / 2);
    gameState.current.currentY = 0;
    gameState.current.canHold = false;
    
    // Check if held piece can spawn
    if (checkCollision(board, gameState.current.currentPiece, gameState.current.currentX, gameState.current.currentY)) {
      try {
        setGameOver(true);
        setGameStarted(false);
        stopMusic();
        playGameOverSound();
        vibrate([50, 50, 100]);
      } catch (error) {
        console.error('Error during hold game over:', error);
        setGameOver(true);
        setGameStarted(false);
      }
    }
  }, [getNextPiece, checkCollision, COLS, playHoldSound, stopMusic, playGameOverSound, vibrate]);

  // Hard drop
  const hardDrop = useCallback(() => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    let dropDistance = 0;
    
    while (!checkCollision(board, currentPiece, currentX, currentY + dropDistance + 1)) {
      dropDistance++;
    }
    
    // Create hard drop trail effect
    if (dropDistance > 0) {
      const boardOffsetX = 130;
      const trailPositions = Math.min(dropDistance, 8); // Limit trail length
      
      for (let i = 0; i < trailPositions; i++) {
        const trailY = currentY + Math.floor((dropDistance * i) / trailPositions);
        gameState.current.hardDropTrail.push({
          piece: currentPiece,
          x: currentX,
          y: trailY,
          life: 15 - i * 2, // Stagger fade
          maxLife: 15,
          offsetX: boardOffsetX
        });
      }
      
      // Add impact particles at landing position
      const landY = currentY + dropDistance;
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const centerX = boardOffsetX + (currentX + x) * BLOCK_SIZE + BLOCK_SIZE / 2;
            const centerY = (landY + y) * BLOCK_SIZE + BLOCK_SIZE / 2;
            
            // Impact burst
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI * 2 * i) / 6 + Math.PI / 2; // Upward burst
              const particle = getParticleFromPool({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3 - 2,
                life: 25,
                maxLife: 25,
                color: currentPiece.color,
                size: 3,
                type: Math.random() > 0.5 ? 'star' : 'spark',
                rotation: angle,
                rotationSpeed: 0.3,
                glow: true,
                trail: true,
                pulse: false,
                ring: 0,
                bounce: false
              });
              if (gameState.current.particles.length < MAX_ACTIVE_PARTICLES) {
                gameState.current.particles.push(particle);
              }
            }
          }
        });
      });
    }
    
    gameState.current.currentY += dropDistance;
    setScore(prev => prev + dropDistance * 2);
    playSfxFile('mixkit-sci-fi-positive-notification-266.wav', 0.8, 'Hard-drop sound');
    mergePiece();
    clearLines();
    spawnPiece();
  }, [checkCollision, mergePiece, clearLines, spawnPiece, BLOCK_SIZE, MAX_ACTIVE_PARTICLES, getParticleFromPool, playSfxFile]);

  // Reset game
  const resetGame = useCallback(() => {
    gameState.current.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    gameState.current.currentPiece = null;
    gameState.current.nextPieces = [];
    gameState.current.holdPiece = null;
    gameState.current.canHold = true;
    gameState.current.dropCounter = 0;
    gameState.current.dropInterval = gameMode === 'marathon' ? 800 : 1000;
    gameState.current.colorBonusDisplay = null;
    gameState.current.bag = [];
    gameState.current.particles = [];
    gameState.current.bgParticles = [];
    gameState.current.clearingLines = [];
    gameState.current.clearAnimation = 0;
    gameState.current.chromaticAberration = 0;
    gameState.current.scanlineFlash = [];
    
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setLastClearWasCombo(false);
    setGameOver(false);
    setIsPaused(false);
    
    // Game mode specific initialization
    if (gameMode === 'sprint') {
      setSprintLinesRemaining(40);
      setStartTime(Date.now());
    } else if (gameMode === 'marathon') {
      setStartTime(Date.now());
    }
    
    // Update statistics
    updateStatistics({ totalGames: statistics.totalGames + 1 });
    
    spawnPiece();
  }, [spawnPiece, ROWS, COLS, gameMode, updateStatistics, statistics.totalGames]);

  const startCountdown = useCallback(() => {
    // Clear game over state when starting countdown
    setGameOver(false);
    setCountdown(3);
    
    // Play countdown click sound
    if (soundEnabled) {
      playSfxFile('mixkit-sci-fi-click-900.wav', 0.7, 'Countdown sound');
    }
    
    // Play start game audio
    if (soundEnabled) {
      playSfxFile('mixkit-fairy-magic-sparkle-871.mp3', 1.0, 'Start game sound');
    }
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(countdownInterval);
          // Play "GO" alarm tone
          if (soundEnabled) {
            playSfxFile('mixkit-alarm-tone-996.wav', 0.8, 'Go sound');
          }
          setTimeout(() => {
            setCountdown(null);
            setGameStarted(true);
            resetGame();
            // Start music after countdown
            setTimeout(() => {
              updateMusicIntensity(1);
              startMusic(null, true);
            }, 100);
          }, 1000); // Show "GO!" for 1 second
          return 'GO';
        }
        // Play countdown click for each number
        if (soundEnabled) {
          playSfxFile('mixkit-sci-fi-click-900.wav', 0.7, 'Countdown sound');
        }
        return prev - 1;
      });
    }, 1000);
  }, [resetGame, startMusic, updateMusicIntensity, soundEnabled, playSfxFile]);

  // Create a signed leaderboard session when a run starts.
  useEffect(() => {
    if (!gameStarted && !gameOver) {
      leaderboardSessionStartedRef.current = false;
      setLeaderboardSessionToken('');
      return;
    }

    if (gameOver) return;

    if (leaderboardSessionStartedRef.current) return;
    leaderboardSessionStartedRef.current = true;

    const bootstrapSession = async () => {
      try {
        const result = await createLeaderboardSession(gameMode || 'classic');
        if (result.success && result.sessionToken) {
          setLeaderboardSessionToken(result.sessionToken);
        } else {
          console.warn('Leaderboard session setup failed:', result.error);
        }
      } catch (error) {
        console.error('Error bootstrapping leaderboard session:', error);
      }
    };

    bootstrapSession();
  }, [gameStarted, gameOver, gameMode]);

  // Main menu handler with confirmation
  const handleQuitToMenu = useCallback(() => {
    // If game is in progress and not over, show confirmation
    if (gameStarted && !gameOver) {
      setShowQuitConfirm(true);
      return;
    }
    // Otherwise, quit immediately
    handleMainMenu();
  }, [gameStarted, gameOver]);

  const handleRestartFromPause = useCallback(() => {
    playSound('menuClick', 600, 0.1);
    setIsPaused(false);
    resetGame();
  }, [playSound, resetGame]);

  const queueMenuClickSound = useCallback(() => {
    if (!soundEnabled) return;

    const playMenuClick = () => playSound('menuClick', 600, 0.1);

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(playMenuClick);
      });
      return;
    }

    setTimeout(playMenuClick, 0);
  }, [soundEnabled, playSound]);

  // Main menu handler
  const handleMainMenu = useCallback(() => {
    stopMusic();
    setGameStarted(false);
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setLastClearWasCombo(false);
    setShowQuitConfirm(false);
    
    gameState.current.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    gameState.current.currentPiece = null;
    gameState.current.nextPieces = [];
    gameState.current.holdPiece = null;
    gameState.current.particles = [];
    gameState.current.bgParticles = [];
    gameState.current.clearingLines = [];
    gameState.current.clearAnimation = 0;
    gameState.current.chromaticAberration = 0;
    gameState.current.scanlineFlash = [];
  }, [ROWS, COLS, stopMusic]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStarted || gameOver || isPaused) {
        if (e.key === ' ' && !gameStarted) {
          startCountdown();
        }
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowLeft':
          moveHorizontal(-1);
          break;
        case 'ArrowRight':
          moveHorizontal(1);
          break;
        case 'ArrowDown':
          moveDown();
          break;
        case 'ArrowUp':
          rotate();
          break;
        case ' ':
          hardDrop();
          break;
        case 'c':
        case 'C':
        case 'Shift':
          holdCurrentPiece();
          break;
        case 'p':
        case 'P':
        case 'Escape':
          setIsPaused(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, gameOver, isPaused, moveHorizontal, moveDown, rotate, hardDrop, holdCurrentPiece, startCountdown]);

  // Gamepad support
  useEffect(() => {
    const handleGamepadConnected = (e) => {
      console.log('Gamepad connected:', e.gamepad.id);
      setGamepadConnected(true);
    };

    const handleGamepadDisconnected = (e) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      setGamepadConnected(false);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, []);

  // Gamepad input handling
  const handleGamepadInput = useCallback(() => {
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];
    
    if (!gamepad || !gameStarted || gameOver) {
      // Check for start button when not in game
      if (gamepad && !gameStarted && gamepad.buttons[9]?.pressed) {
        setGameStarted(true);
        resetGame();
      }
      return;
    }

    const gpState = gameState.current.gamepadState;
    
    // Decrease delays
    if (gpState.moveDelay > 0) gpState.moveDelay--;
    if (gpState.rotateDelay > 0) gpState.rotateDelay--;

    // Button 9: Start/Options (Pause)
    if (gamepad.buttons[9]?.pressed && !gpState.lastButtons[9]) {
      setIsPaused(prev => !prev);
    }

    if (isPaused) {
      gpState.lastButtons = gamepad.buttons.map(b => b?.pressed || false);
      return;
    }

    // D-pad or Left Stick horizontal movement
    const leftPressed = gamepad.buttons[14]?.pressed || gamepad.axes[0] < -0.5;
    const rightPressed = gamepad.buttons[15]?.pressed || gamepad.axes[0] > 0.5;
    
    if (gpState.moveDelay === 0) {
      if (leftPressed && !gpState.lastAxes[0]) {
        moveHorizontal(-1);
        gpState.moveDelay = 8;
      } else if (rightPressed && gpState.lastAxes[0] !== 1) {
        moveHorizontal(1);
        gpState.moveDelay = 8;
      }
    }

    // D-pad down or Left Stick down (Soft drop)
    const downPressed = gamepad.buttons[13]?.pressed || gamepad.axes[1] > 0.5;
    if (downPressed && !gpState.lastAxes[1]) {
      moveDown();
    }

    // Button 0: A/X (Hard drop)
    if (gamepad.buttons[0]?.pressed && !gpState.lastButtons[0]) {
      hardDrop();
    }

    // Button 1: B/Circle or Button 12: D-pad Up (Rotate)
    const upPressed = gamepad.buttons[12]?.pressed || gamepad.axes[1] < -0.5;
    if (gpState.rotateDelay === 0) {
      if ((gamepad.buttons[1]?.pressed && !gpState.lastButtons[1]) || 
          (upPressed && !gpState.lastAxes[2])) {
        rotate();
        gpState.rotateDelay = 10;
      }
    }

    // Store current state
    gpState.lastButtons = gamepad.buttons.map(b => b?.pressed || false);
    gpState.lastAxes[0] = leftPressed ? -1 : (rightPressed ? 1 : 0);
    gpState.lastAxes[1] = downPressed ? 1 : 0;
    gpState.lastAxes[2] = upPressed ? -1 : 0;
  }, [gameStarted, gameOver, isPaused, moveHorizontal, moveDown, rotate, hardDrop, resetGame]);

  // Map tetromino pieces to theme palette colors
  const getThemeBlockColors = useCallback(() => {
    const selectedTheme = THEME_DEFINITIONS[currentTheme] || THEME_DEFINITIONS.dark;
    const saturationBoost = Math.max(0, (gameState.current.saturationBoost || 0));
    const saturationMultiplier = 1 + saturationBoost * 0.4;
    
    const themeAccent = hexToRgbArray(selectedTheme?.colors?.accent, [0, 240, 240]);
    const themeSuccess = hexToRgbArray(selectedTheme?.colors?.success, [0, 240, 100]);
    const themeWarning = hexToRgbArray(selectedTheme?.colors?.warning, [240, 150, 0]);
    const themeError = hexToRgbArray(selectedTheme?.colors?.error, [240, 20, 20]);
    const themeSecondary = hexToRgbArray(selectedTheme?.colors?.secondary, [30, 10, 60]);
    
    // Map each tetromino to theme colors with saturation boost
    return {
      I: `rgb(${boostColorSaturation(themeAccent, saturationMultiplier, 1.2).join(',')})`,
      O: `rgb(${boostColorSaturation(themeWarning, saturationMultiplier, 1.2).join(',')})`,
      T: `rgb(${boostColorSaturation(themeAccent, saturationMultiplier * 0.8, 1.1).join(',')})`, // Purple-ish
      S: `rgb(${boostColorSaturation(themeSuccess, saturationMultiplier, 1.2).join(',')})`,
      Z: `rgb(${boostColorSaturation(themeError, saturationMultiplier, 1.2).join(',')})`,
      J: `rgb(${boostColorSaturation([Math.min(255, themeSecondary[0] + themeAccent[0] * 0.5), Math.min(255, themeSecondary[1] + themeAccent[1] * 0.5), Math.min(255, themeSecondary[2] + themeAccent[2] * 0.8)], saturationMultiplier, 1.1).join(',')})`,
      L: `rgb(${boostColorSaturation(themeWarning, saturationMultiplier * 0.9, 1.15).join(',')})` // Orange variant
    };
  }, [currentTheme]);

  // Draw game
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx = canvasCtxRef.current;
    if (!ctx) {
      ctx = canvas.getContext('2d');
      canvasCtxRef.current = ctx;
    }
    if (!ctx) return;
    const { board, currentPiece, currentX, currentY, holdPiece, nextPieces, clearingLines, clearAnimation, particles, scorePopups, screenShake, gridAnimation } = gameState.current;
    const avgFrameMs = gameState.current.avgFrameMs || 16.67;
    const frameStressed = avgFrameMs > (lowPowerMode ? 28 : 22);
    const severelyStressed = avgFrameMs > (lowPowerMode ? 36 : 30);

    // Update animations
    gameState.current.gridAnimation = (gridAnimation + 1) % 360;
    if (screenShake > 0) {
      gameState.current.screenShake--;
    }
    if (gameState.current.chromaticAberration > 0) {
      gameState.current.chromaticAberration--;
    }
    // Decay saturation boost over time
    if (gameState.current.saturationBoost > 0) {
      gameState.current.saturationBoost = Math.max(0, gameState.current.saturationBoost - 0.08);
    }

    // Init ambient bg particles if empty
    if (!lowPowerMode && !prefersReducedMotion && gameState.current.bgParticles.length === 0) {
      initBgParticles(CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Apply screen shake
    ctx.save();
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake * 0.5;
      const shakeY = (Math.random() - 0.5) * screenShake * 0.5;
      ctx.translate(shakeX, shakeY);
    }

    // Build dynamic background from selected theme metadata
    const selectedTheme = THEME_DEFINITIONS[currentTheme] || THEME_DEFINITIONS.dark;
    const themePrimary = hexToRgbArray(selectedTheme?.colors?.primary, [10, 5, 30]);
    const themeSecondary = hexToRgbArray(selectedTheme?.colors?.secondary, [30, 10, 60]);
    const themeAccent = hexToRgbArray(selectedTheme?.colors?.accent, [0, 240, 240]);
    const themeSuccess = hexToRgbArray(selectedTheme?.colors?.success, [0, 240, 140]);
    const themeWarning = hexToRgbArray(selectedTheme?.colors?.warning, [255, 190, 0]);
    
    // Boost saturation for better visual pop (especially during events)
    const saturationBoost = Math.max(0, (gameState.current.saturationBoost || 0));
    const saturationMultiplier = 1 + saturationBoost * 0.4;
    const boostedAccent = boostColorSaturation(themeAccent, saturationMultiplier, 1.15);
    const boostedSuccess = boostColorSaturation(themeSuccess, saturationMultiplier * 0.95, 1.08);
    const boostedWarning = boostColorSaturation(themeWarning, saturationMultiplier * 0.9, 1.05);
    const boostedPrimary = brightenColor(themePrimary, 1 + saturationBoost * 0.2);
    const boostedSecondary = brightenColor(themeSecondary, 1 + saturationBoost * 0.15);
    
    const resolvedVisual = selectedTheme?.visual || getThemeVisualProfile(currentTheme, selectedTheme?.category);
    const visualMotif = resolvedVisual?.motif || null;
    const visualPattern = resolvedVisual?.pattern || null;
    const now = Date.now() * 0.001;
    const animOffset = gridAnimation * 0.01;
    
    // Add combo-based pulsing effect to background
    const comboPulse = combo > 0 ? Math.sin(gridAnimation * 0.15) * (combo * 0.03) : 0;
    const comboIntensity = Math.min(combo * 0.1, 1);
    
    // Animated gradient background with combo effects - INCREASED OPACITY for better visibility
    const gradient = ctx.createLinearGradient(
      0, 
      Math.sin(animOffset + comboPulse) * CANVAS_HEIGHT * 0.3,
      CANVAS_WIDTH,
      CANVAS_HEIGHT + Math.cos(animOffset + comboPulse) * CANVAS_HEIGHT * 0.3
    );
    // Brighten colors during combos and boost periods
    const r1 = Math.min(255, boostedPrimary[0] + boostedAccent[0] * comboIntensity * 0.35);
    const g1 = Math.min(255, boostedPrimary[1] + boostedAccent[1] * comboIntensity * 0.35);
    const b1 = Math.min(255, boostedPrimary[2] + boostedAccent[2] * comboIntensity * 0.35);
    const rMid = Math.min(255, boostedSecondary[0] * 0.72 + boostedSuccess[0] * 0.28 + comboIntensity * 18);
    const gMid = Math.min(255, boostedSecondary[1] * 0.72 + boostedSuccess[1] * 0.28 + comboIntensity * 18);
    const bMid = Math.min(255, boostedSecondary[2] * 0.72 + boostedSuccess[2] * 0.28 + comboIntensity * 18);
    const rWarm = Math.min(255, boostedSecondary[0] * 0.7 + boostedWarning[0] * 0.3 + comboIntensity * 14);
    const gWarm = Math.min(255, boostedSecondary[1] * 0.7 + boostedWarning[1] * 0.3 + comboIntensity * 14);
    const bWarm = Math.min(255, boostedSecondary[2] * 0.7 + boostedWarning[2] * 0.3 + comboIntensity * 14);
    const r2 = Math.min(255, boostedSecondary[0] + boostedAccent[0] * comboIntensity * 0.25);
    const g2 = Math.min(255, boostedSecondary[1] + boostedAccent[1] * comboIntensity * 0.25);
    const b2 = Math.min(255, boostedSecondary[2] + boostedAccent[2] * comboIntensity * 0.25);
    gradient.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
    gradient.addColorStop(0.38, `rgb(${rMid}, ${gMid}, ${bMid})`);
    gradient.addColorStop(0.72, `rgb(${rWarm}, ${gWarm}, ${bWarm})`);
    gradient.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Add soft color wash that shifts with gameplay intensity for richer animated themes.
    const chromaVeil = ctx.createRadialGradient(
      CANVAS_WIDTH * (0.2 + Math.sin(animOffset) * 0.08),
      CANVAS_HEIGHT * (0.22 + Math.cos(animOffset * 1.1) * 0.05),
      0,
      CANVAS_WIDTH * 0.5,
      CANVAS_HEIGHT * 0.5,
      CANVAS_HEIGHT * 0.9
    );
    chromaVeil.addColorStop(0, rgbAlpha(boostedAccent, 0.1 + comboIntensity * 0.08));
    chromaVeil.addColorStop(0.5, rgbAlpha(boostedSuccess, 0.08 + comboIntensity * 0.06));
    chromaVeil.addColorStop(1, rgbAlpha(boostedWarning, 0.06 + comboIntensity * 0.05));
    ctx.fillStyle = chromaVeil;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw floating geometric shapes in background with boosted accent colors
    ctx.save();
    // Increased opacity on background shapes
    ctx.globalAlpha = lowPowerMode ? 0.08 + comboIntensity * 0.1 : 0.15 + comboIntensity * 0.2;
    const shapeCount = severelyStressed
      ? (lowPowerMode ? 2 : 3)
      : frameStressed
        ? (lowPowerMode ? 2 : 5)
        : (lowPowerMode ? 3 + Math.floor(combo * 0.2) : 8 + Math.floor(combo * 0.5));
    for (let i = 0; i < shapeCount; i++) {
      const shapeAnim = (gridAnimation + i * 60) * (0.02 + comboIntensity * 0.03); // Faster during combos
      const x = (i * CANVAS_WIDTH / shapeCount + Math.sin(shapeAnim) * (50 + combo * 5)) % CANVAS_WIDTH;
      const y = ((shapeAnim * (30 + combo * 2)) % CANVAS_HEIGHT);
      const size = (40 + Math.sin(shapeAnim * 2) * 20) * (1 + comboIntensity * 0.3); // Larger during combos
      const rotation = shapeAnim;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = `rgb(${boostedAccent[0]}, ${boostedAccent[1]}, ${boostedAccent[2]})`;
      ctx.lineWidth = 3.5;
      
      if (i % 3 === 0) {
        // Triangle
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.866, size * 0.5);
        ctx.lineTo(-size * 0.866, size * 0.5);
        ctx.closePath();
        ctx.stroke();
      } else if (i % 3 === 1) {
        // Circle
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Square
        ctx.strokeRect(-size * 0.5, -size * 0.5, size, size);
      }
      ctx.restore();
    }
    ctx.restore();

    // Pattern overlay for premium and seasonal themes
    if (visualPattern && !severelyStressed) {
      ctx.save();
      // Increased opacity for better theme visibility
      ctx.globalAlpha = lowPowerMode ? 0.08 : prefersReducedMotion ? 0.12 : 0.22;
      ctx.strokeStyle = `rgb(${boostedAccent[0]}, ${boostedAccent[1]}, ${boostedAccent[2]})`;
      ctx.lineWidth = 1.5;

      if (visualPattern === 'wave-grid' || visualPattern === 'soft-orbit') {
        const spacing = 48;
        for (let y = -spacing; y < CANVAS_HEIGHT + spacing; y += spacing) {
          ctx.beginPath();
          for (let x = -20; x <= CANVAS_WIDTH + 20; x += 20) {
            const py = y + Math.sin((x * 0.02) + now + y * 0.01) * 6;
            if (x === -20) ctx.moveTo(x, py);
            else ctx.lineTo(x, py);
          }
          ctx.stroke();
        }
      } else if (visualPattern === 'woven') {
        const spacing = 42;
        for (let x = -CANVAS_HEIGHT; x < CANVAS_WIDTH + CANVAS_HEIGHT; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x + Math.sin(now + x * 0.01) * 8, 0);
          ctx.lineTo(x + CANVAS_HEIGHT, CANVAS_HEIGHT);
          ctx.stroke();
        }
      } else if (visualPattern === 'circuit' || visualPattern === 'diagonal-grid') {
        const step = 56;
        for (let x = 20; x < CANVAS_WIDTH; x += step) {
          for (let y = 20; y < CANVAS_HEIGHT; y += step) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 20, y);
            ctx.lineTo(x + 20, y + 20);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x + 20, y + 20, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = rgbAlpha(themeAccent, 0.75);
            ctx.fill();
          }
        }
      } else if (visualPattern === 'sun-rings' || visualPattern === 'frost-stripes') {
        for (let i = 0; i < 7; i++) {
          const radius = 80 + i * 45 + Math.sin(now + i) * 8;
          ctx.beginPath();
          ctx.arc(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.45, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Animated seasonal and premium motifs
    if (visualMotif && !severelyStressed) {
      ctx.save();
      const motifCount = frameStressed
        ? (lowPowerMode ? 4 : 6)
        : (lowPowerMode ? 6 : prefersReducedMotion ? 8 : 22);
      for (let i = 0; i < motifCount; i++) {
        const speed = 16 + (i % 5) * 6;
        const baseX = ((i * 73) % CANVAS_WIDTH);
        const x = baseX + Math.sin(now * 1.2 + i * 0.7) * (12 + (i % 3) * 7);
        const y = ((now * speed * 1.7) + i * 45) % (CANVAS_HEIGHT + 120) - 60;
        const rotation = now * 0.6 + i * 0.4;
        const size = 4 + (i % 4);

        if (visualMotif === 'leaves') {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rotation);
          ctx.fillStyle = i % 2 ? rgbAlpha(boostedWarning, 0.5) : rgbAlpha(boostedSuccess, 0.45);
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 1.1, size * 0.5, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (visualMotif === 'flowers') {
          drawFlower(ctx, x, y, size, rgbAlpha(boostedAccent, 0.5), 0.45, rotation);
        } else if (visualMotif === 'petals') {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rotation);
          ctx.fillStyle = rgbAlpha(boostedAccent, 0.5);
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 1.2, size * 0.55, Math.PI / 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (visualMotif === 'snow') {
          ctx.save();
          ctx.strokeStyle = rgbAlpha(boostedAccent, 0.52);
          ctx.lineWidth = 1;
          ctx.translate(x, y);
          ctx.rotate(rotation);
          for (let s = 0; s < 3; s++) {
            ctx.beginPath();
            ctx.moveTo(-size, 0);
            ctx.lineTo(size, 0);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
          }
          ctx.restore();
        } else if (visualMotif === 'ribbons') {
          ctx.save();
          ctx.strokeStyle = rgbAlpha(themeAccent, 0.38);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 30, y);
          ctx.quadraticCurveTo(x, y - 12, x + 28, y + Math.sin(now * 2 + i) * 8);
          ctx.stroke();
          ctx.restore();
        } else if (visualMotif === 'embers') {
          ctx.save();
          ctx.fillStyle = i % 2 ? rgbAlpha(boostedWarning, 0.45) : rgbAlpha(boostedAccent, 0.38);
          ctx.beginPath();
          ctx.arc(x, CANVAS_HEIGHT - y * 0.5, size * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }
    
    // Draw ambient depth particles (star-field style depth layer)
    if (!lowPowerMode && !prefersReducedMotion && !severelyStressed && gameState.current.bgParticles.length > 0) {
      ctx.save();
      const accentR = themeAccent[0], accentG = themeAccent[1], accentB = themeAccent[2];
      gameState.current.bgParticles.forEach(bp => {
        // Twinkle effect
        const twinkle = 0.5 + 0.5 * Math.sin(now * bp.twinkleSpeed * 10 + bp.twinkleOffset);
        const a = bp.alpha * twinkle;
        // Color by type
        if (bp.color === 1) {
          ctx.fillStyle = `rgba(${accentR},${accentG},${accentB},${a})`;
        } else if (bp.color === 2) {
          ctx.fillStyle = `rgba(255,220,150,${a * 0.7})`;
        } else {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
        }
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, bp.size, 0, Math.PI * 2);
        ctx.fill();
        // Move with depth-based parallax (slower = farther)
        bp.x += bp.vx * bp.depth;
        bp.y += bp.vy * bp.depth;
        // Wrap around screen edges
        if (bp.y < -10) bp.y = CANVAS_HEIGHT + 10;
        if (bp.x < -10) bp.x = CANVAS_WIDTH + 10;
        if (bp.x > CANVAS_WIDTH + 10) bp.x = -10;
      });
      ctx.restore();
    }
    
    // Add level-based overlay glow
    if (!severelyStressed) {
      const overlayGradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.8
      );
      overlayGradient.addColorStop(0, `rgba(${themeAccent[0]}, ${themeAccent[1]}, ${themeAccent[2]}, 0.05)`);
      overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // Set up translation for main board (centered with left panel space)
    const boardOffsetX = 130; // Space for hold piece panel

    // Draw animated grid background
    ctx.save();
    ctx.translate(boardOffsetX, 0);
    ctx.strokeStyle = selectedTheme?.colors?.gridLine || `rgba(0, 240, 240, ${0.1 + Math.sin(gridAnimation * 0.05) * 0.05})`;
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK_SIZE, 0);
      ctx.lineTo(x * BLOCK_SIZE, BOARD_HEIGHT);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK_SIZE);
      ctx.lineTo(BOARD_WIDTH, y * BLOCK_SIZE);
      ctx.stroke();
    }
    ctx.restore();

    // Draw board with line clear animation
    ctx.save();
    ctx.translate(boardOffsetX, 0);
    
    // Draw danger zone indicator (top rows warning)
    const dangerThreshold = 5; // Top 5 rows
    let highestBlock = -1;
    for (let y = 0; y < dangerThreshold; y++) {
      if (board[y].some(cell => cell)) {
        highestBlock = y;
        break;
      }
    }
    
    if (highestBlock !== -1 && highestBlock < dangerThreshold) {
      // Red pulsing overlay on top rows
      const dangerAlpha = 0.15 + Math.sin(gridAnimation * 0.1) * 0.1;
      const gradient = ctx.createLinearGradient(
        0, 0, 0, dangerThreshold * BLOCK_SIZE
      );
      gradient.addColorStop(0, `rgba(255, 50, 50, ${dangerAlpha * 1.5})`);
      gradient.addColorStop(0.5, `rgba(255, 100, 0, ${dangerAlpha})`);
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, BOARD_WIDTH, dangerThreshold * BLOCK_SIZE);
      
      // Warning text
      ctx.save();
      ctx.globalAlpha = dangerAlpha * 2;
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#ff3333';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      const warningText = '⚠ DANGER ⚠';
      ctx.strokeText(warningText, BOARD_WIDTH / 2, 20);
      ctx.fillText(warningText, BOARD_WIDTH / 2, 20);
      ctx.restore();
    }
    
    board.forEach((row, y) => {
      const isClearing = clearingLines.includes(y);
      const alpha = isClearing ? Math.sin((clearAnimation / 15) * Math.PI) : 1;
      
      row.forEach((cell, x) => {
        if (cell) {
          const blockX = x * BLOCK_SIZE;
          const blockY = y * BLOCK_SIZE;
          const size = BLOCK_SIZE - 2;
          
          ctx.save();
          ctx.globalAlpha = alpha;
          
          // Main block with enhanced glow
          ctx.shadowColor = cell;
          ctx.shadowBlur = 8;
          ctx.fillStyle = cell;
          ctx.fillRect(blockX + 1, blockY + 1, size, size);
          ctx.shadowBlur = 0;
          
          // Enhanced lighting gradient (top to bottom)
          const gradient = ctx.createLinearGradient(blockX, blockY, blockX, blockY + size);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
          gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.35)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
          ctx.fillStyle = gradient;
          ctx.fillRect(blockX + 1, blockY + 1, size, size);
          
          // Specular highlight (top-left corner shine)
          const specular = ctx.createRadialGradient(
            blockX + size * 0.3, blockY + size * 0.25, 0,
            blockX + size * 0.3, blockY + size * 0.25, size * 0.5
          );
          specular.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
          specular.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
          specular.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = specular;
          ctx.fillRect(blockX + 1, blockY + 1, size, size);
          
          // Glossy edge highlight
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.strokeRect(blockX + 2, blockY + 2, size - 3, size - 3);
          
          // Deep shadow for depth
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(blockX + 1, blockY + 1, size, size);
          
          ctx.restore();
        }
      });
    });

    // Draw scanline flash effect (horizontal bright strips on cleared rows)
    if (gameState.current.scanlineFlash.length > 0) {
      gameState.current.scanlineFlash.forEach(sf => {
        const sfAlpha = (sf.life / sf.maxLife);
        const flashY = sf.y * BLOCK_SIZE;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const scanGrad = ctx.createLinearGradient(0, flashY, 0, flashY + BLOCK_SIZE);
        scanGrad.addColorStop(0, `rgba(255,255,255,0)`);
        scanGrad.addColorStop(0.3, `rgba(255,255,255,${sfAlpha * 0.9})`);
        scanGrad.addColorStop(0.5, `rgba(200,240,255,${sfAlpha})`);
        scanGrad.addColorStop(0.7, `rgba(255,255,255,${sfAlpha * 0.9})`);
        scanGrad.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, flashY - 2, BOARD_WIDTH, BLOCK_SIZE + 4);
        ctx.restore();
        sf.life--;
      });
      gameState.current.scanlineFlash = gameState.current.scanlineFlash.filter(sf => sf.life > 0);
    }

    // Draw particles
    const frameParticleCap = severelyStressed ? 140 : frameStressed ? 240 : MAX_ACTIVE_PARTICLES;
    if (particles.length > frameParticleCap) {
      const overflow = particles.splice(0, particles.length - frameParticleCap);
      overflow.forEach(p => returnParticleToPool(p));
    }

    const nextAliveParticles = [];
    const glowParticles = [];

    particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      const easeAlpha = alpha * alpha; // Ease out
      const pulseAlpha = p.pulse ? 0.5 + Math.sin((1 - alpha) * Math.PI * 4) * 0.5 : 1;
      const finalAlpha = easeAlpha * pulseAlpha;
      
      ctx.save();
      ctx.globalAlpha = finalAlpha;
      
      // Draw enhanced trail effect with multiple segments
      if (p.trail) {
        const trailSegments = lowPowerMode ? 2 : 5;
        for (let t = 0; t < trailSegments; t++) {
          const trailFactor = (t + 1) / trailSegments;
          ctx.globalAlpha = finalAlpha * 0.3 * (1 - trailFactor);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(
            p.x - p.vx * trailFactor * 3, 
            p.y - p.vy * trailFactor * 3, 
            p.size * 0.7 * (1 - trailFactor * 0.5), 
            0, Math.PI * 2
          );
          ctx.fill();
        }
        ctx.globalAlpha = finalAlpha;
      }
      
      // Apply enhanced glow effect with pulse
      if (p.glow) {
        const glowIntensity = p.pulse ? 20 + Math.sin((1 - alpha) * Math.PI * 4) * 10 : 15;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = glowIntensity * finalAlpha;
      }
      
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      
      // Draw based on particle type
      switch (p.type) {
        case 'wave':
          // Expanding ring wave
          const waveRadius = p.waveRadius + (p.maxLife - p.life) * p.waveSpeed;
          ctx.globalAlpha = finalAlpha * 0.6;
          ctx.lineWidth = 3;
          ctx.strokeStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, waveRadius, 0, Math.PI * 2);
          ctx.stroke();
          
          // Inner glow ring
          ctx.globalAlpha = finalAlpha * 0.3;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, waveRadius, 0, Math.PI * 2);
          ctx.stroke();
          break;
          
        case 'circle':
          ctx.translate(p.x, p.y);
          // Outer glow circle
          if (p.glow) {
            ctx.globalAlpha = finalAlpha * 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = finalAlpha;
          }
          // Main circle
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'ring':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.lineWidth = p.size * 0.3;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
          
        case 'square':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          break;
          
        case 'diamond':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size, 0);
          ctx.closePath();
          ctx.fill();
          break;
          
        case 'star':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const outerRadius = p.size;
            const innerRadius = p.size * 0.4;
            
            const outerX = Math.cos(angle) * outerRadius;
            const outerY = Math.sin(angle) * outerRadius;
            const innerX = Math.cos(angle + Math.PI / 5) * innerRadius;
            const innerY = Math.sin(angle + Math.PI / 5) * innerRadius;
            
            if (i === 0) ctx.moveTo(outerX, outerY);
            else ctx.lineTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
          }
          ctx.closePath();
          ctx.fill();
          break;
          
        case 'spark':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.lineWidth = p.size * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-p.size * 1.2, 0);
          ctx.lineTo(p.size * 1.2, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.2);
          ctx.lineTo(0, p.size * 1.2);
          ctx.stroke();
          break;
        
        case 'confetti':
          // Rectangular confetti with flutter
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          const confettiWidth = p.size * 0.5;
          const confettiHeight = p.size * 2;
          ctx.fillRect(-confettiWidth, -confettiHeight, confettiWidth * 2, confettiHeight * 2);
          break;
        
        case 'lightning':
          // Lightning bolt between two points
          if (p.x2 !== undefined && p.y2 !== undefined) {
            ctx.globalAlpha = finalAlpha * 0.8;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            // Jagged lightning effect
            const segments = 3;
            for (let s = 1; s <= segments; s++) {
              const t = s / segments;
              const midX = p.x + (p.x2 - p.x) * t;
              const midY = p.y + (p.y2 - p.y) * t;
              const offset = (Math.random() - 0.5) * 10;
              ctx.lineTo(midX + offset, midY + offset);
            }
            ctx.stroke();
          }
          break;
        
        case 'plasma': {
          // Pulsing energy orb with layered glow rings
          ctx.translate(p.x, p.y);
          const plasmaPhase = (1 - alpha) * Math.PI * 6;
          const plasmaSize = p.size * (1 + 0.25 * Math.sin(plasmaPhase));
          // Outer halo (additive-friendly)
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = finalAlpha * 0.18;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, plasmaSize * 2.2, 0, Math.PI * 2);
          ctx.fill();
          // Mid glow
          ctx.globalAlpha = finalAlpha * 0.35;
          ctx.beginPath();
          ctx.arc(0, 0, plasmaSize * 1.3, 0, Math.PI * 2);
          ctx.fill();
          // Core
          ctx.globalAlpha = finalAlpha;
          ctx.globalCompositeOperation = 'source-over';
          const plasmaGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, plasmaSize);
          plasmaGrad.addColorStop(0, p.innerColor || '#ffffff');
          plasmaGrad.addColorStop(0.4, p.color);
          plasmaGrad.addColorStop(1, p.color + '00');
          ctx.fillStyle = plasmaGrad;
          ctx.beginPath();
          ctx.arc(0, 0, plasmaSize, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'prism': {
          // Iridescent crystal triangle shard
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          const prismH = p.size * 2.2;
          const prismW = p.size * 1.4;
          const prismGrad = ctx.createLinearGradient(-prismW, -prismH, prismW, prismH);
          prismGrad.addColorStop(0, '#ff88cc');
          prismGrad.addColorStop(0.3, p.color);
          prismGrad.addColorStop(0.6, '#88ccff');
          prismGrad.addColorStop(1, '#ffffcc');
          ctx.fillStyle = prismGrad;
          ctx.beginPath();
          ctx.moveTo(0, -prismH);
          ctx.lineTo(prismW, prismH * 0.5);
          ctx.lineTo(-prismW, prismH * 0.5);
          ctx.closePath();
          ctx.fill();
          // Edge highlight
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          break;
        }

        case 'debris': {
          // Mini block fragment (like a piece of the board)
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          const dw = p.size * (p.scaleX || 1);
          const dh = p.size * (p.scaleY || 0.6);
          ctx.fillStyle = p.color;
          ctx.fillRect(-dw, -dh, dw * 2, dh * 2);
          // Top-face gradient
          const debrisGrad = ctx.createLinearGradient(-dw, -dh, -dw, dh);
          debrisGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
          debrisGrad.addColorStop(0.3, 'rgba(255,255,255,0.15)');
          debrisGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
          ctx.fillStyle = debrisGrad;
          ctx.fillRect(-dw, -dh, dw * 2, dh * 2);
          // Bright edge
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 0.7;
          ctx.strokeRect(-dw + 1, -dh + 1, dw * 2 - 2, dh * 2 - 2);
          break;
        }

        default:
          // Default particle rendering
          ctx.translate(p.x, p.y);
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      
      ctx.restore();
      
      // Update particle physics with bouncing
      if (p.type !== 'wave' && p.type !== 'lightning') {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98; // Air resistance
        
        // Add flutter for confetti
        if (p.type === 'confetti' && p.flutter) {
          p.vx += Math.sin(p.life * p.flutter) * 0.3;
        }
        
        p.vy += 0.15; // Gravity
        
        // Screen edge bouncing
        if (p.bounce) {
          const boardLeft = boardOffsetX;
          const boardRight = boardOffsetX + BOARD_WIDTH;
          const boardBottom = CANVAS_HEIGHT;
          
          if (p.x < boardLeft || p.x > boardRight) {
            p.vx *= -0.7;
            p.x = Math.max(boardLeft, Math.min(boardRight, p.x));
          }
          if (p.y > boardBottom) {
            p.vy *= -0.7;
            p.y = boardBottom;
            p.vx *= 0.9; // Friction on ground
          }
        }
      }
      p.rotation += p.rotationSpeed || 0;
      p.life--;

      if (p.life > 0) {
        nextAliveParticles.push(p);
        if (!lowPowerMode && p.glow && p.type !== 'wave' && p.type !== 'lightning' && p.type !== 'debris') {
          glowParticles.push(p);
        }
      } else {
        returnParticleToPool(p);
      }
    });

    gameState.current.particles = nextAliveParticles;

    // Additive glow second pass for luminous particle bloom
    if (!lowPowerMode && !frameStressed) {
      if (glowParticles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glowParticles.forEach(p => {
          const alpha = p.life / p.maxLife;
          const easeAlpha = alpha * alpha;
          ctx.globalAlpha = easeAlpha * 0.25;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.size * 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // Chromatic aberration post-process (RGB channel split on intense events)
    if (gameState.current.chromaticAberration > 0 && !lowPowerMode && !prefersReducedMotion && !frameStressed) {
      const ca = gameState.current.chromaticAberration;
      const caStrength = Math.min(ca / 20, 1) * 4;
      const boardLeft = boardOffsetX;
      const boardW = BOARD_WIDTH;
      const boardH = BOARD_HEIGHT;
      // Save the current board region as image data, then redraw shifted with color channel tinting
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.15;
      // Red channel offset (left)
      ctx.fillStyle = `rgb(255,0,0)`;
      ctx.drawImage(canvas, boardLeft, 0, boardW, boardH, boardLeft - caStrength, 0, boardW, boardH);
      // Blue channel offset (right)
      ctx.fillStyle = `rgb(0,0,255)`;
      ctx.drawImage(canvas, boardLeft, 0, boardW, boardH, boardLeft + caStrength, 0, boardW, boardH);
      ctx.restore();
    }

    // Update line clear animation
    if (clearAnimation > 0) {
      gameState.current.clearAnimation--;
    }

    // Draw hard drop trail (motion blur effect)
    if (gameState.current.hardDropTrail.length > 0) {
      gameState.current.hardDropTrail.forEach(trail => {
        const alpha = trail.life / trail.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.4; // Semi-transparent trail
        ctx.translate(trail.offsetX, 0);
        
        trail.piece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value) {
              const blockX = (trail.x + x) * BLOCK_SIZE;
              const blockY = (trail.y + y) * BLOCK_SIZE;
              const size = BLOCK_SIZE - 2;
              
              // Simple colored block with glow
              ctx.fillStyle = trail.piece.color;
              ctx.shadowColor = trail.piece.color;
              ctx.shadowBlur = 15;
              ctx.fillRect(blockX + 1, blockY + 1, size, size);
              ctx.shadowBlur = 0;
            }
          });
        });
        
        ctx.restore();
        trail.life--;
      });
      
      // Remove dead trails
      gameState.current.hardDropTrail = gameState.current.hardDropTrail.filter(t => t.life > 0);
    }

    // Apply theme colors to pieces for consistent visual theming
    const themeBlockColors = getThemeBlockColors();
    if (currentPiece) {
      currentPiece.color = themeBlockColors[currentPiece.type] || currentPiece.color;
    }
    if (nextPieces && nextPieces.length > 0) {
      nextPieces.forEach(piece => {
        if (piece) {
          piece.color = themeBlockColors[piece.type] || piece.color;
        }
      });
    }
    if (holdPiece) {
      holdPiece.color = themeBlockColors[holdPiece.type] || holdPiece.color;
    }

    // Draw current piece
    if (currentPiece && !isPaused) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const blockX = (currentX + x) * BLOCK_SIZE;
            const blockY = (currentY + y) * BLOCK_SIZE;
            const size = BLOCK_SIZE - 2;
            
            // Enhanced glow for active piece
            ctx.shadowColor = currentPiece.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = currentPiece.color;
            ctx.fillRect(blockX + 1, blockY + 1, size, size);
            ctx.shadowBlur = 0;
            
            // Enhanced lighting gradient with more shine
            const gradient = ctx.createLinearGradient(blockX, blockY, blockX, blockY + size);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
            gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.45)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
            ctx.fillStyle = gradient;
            ctx.fillRect(blockX + 1, blockY + 1, size, size);
            
            // Bright specular highlight
            const specular = ctx.createRadialGradient(
              blockX + size * 0.3, blockY + size * 0.25, 0,
              blockX + size * 0.3, blockY + size * 0.25, size * 0.6
            );
            specular.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
            specular.addColorStop(0.35, 'rgba(255, 255, 255, 0.4)');
            specular.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = specular;
            ctx.fillRect(blockX + 1, blockY + 1, size, size);
            
            // Glossy edge with pulsing effect
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(blockX + 2, blockY + 2, size - 3, size - 3);
            
            // Outer glow ring
            ctx.shadowColor = currentPiece.color;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(blockX + 1, blockY + 1, size, size);
            ctx.shadowBlur = 0;
          }
        });
      });

      // Draw ghost piece
      let ghostY = currentY;
      while (!checkCollision(board, currentPiece, currentX, ghostY + 1)) {
        ghostY++;
      }
      
      if (ghostY !== currentY) {
        const ghostPulse = 0.65 + Math.sin(gridAnimation * 0.18) * 0.2;
        currentPiece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value) {
              const blockX = (currentX + x) * BLOCK_SIZE;
              const blockY = (ghostY + y) * BLOCK_SIZE;
              const size = BLOCK_SIZE - 2;
              
              // Ghost fill with transparency
              ctx.fillStyle = colorWithAlpha(currentPiece.color, 0.2 + ghostPulse * 0.08);
              ctx.fillRect(blockX + 1, blockY + 1, size, size);

              // Soft glow layer so the marker survives high-contrast backgrounds
              ctx.shadowColor = colorWithAlpha(currentPiece.color, 0.9);
              ctx.shadowBlur = 10;
              ctx.strokeStyle = colorWithAlpha(currentPiece.color, 0.5 + ghostPulse * 0.15);
              ctx.lineWidth = 1.6;
              ctx.strokeRect(blockX + 1, blockY + 1, size, size);
              ctx.shadowBlur = 0;
              
              // Ghost marquee border
              ctx.strokeStyle = colorWithAlpha(currentPiece.color, 0.75 + ghostPulse * 0.18);
              ctx.lineWidth = 2.6;
              ctx.setLineDash([6, 3]);
              ctx.lineDashOffset = -gridAnimation * 0.6;
              ctx.strokeRect(blockX + 1, blockY + 1, size, size);

              // White contrast outline for readability on intense themes
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.32 + ghostPulse * 0.2})`;
              ctx.lineWidth = 1.1;
              ctx.setLineDash([2, 4]);
              ctx.lineDashOffset = gridAnimation * 0.4;
              ctx.strokeRect(blockX + 1.8, blockY + 1.8, size - 1.6, size - 1.6);

              ctx.lineDashOffset = 0;
              ctx.setLineDash([]);
            }
          });
        });
      }
      
      // Draw subtle preview ghost for next piece
      if (nextPieces.length > 0) {
        const nextPiece = nextPieces[0];
        const nextSpawnX = Math.floor((COLS - nextPiece.shape[0].length) / 2);
        const nextSpawnY = 0;
        
        // Calculate where next piece would land
        let nextGhostY = nextSpawnY;
        while (!checkCollision(board, nextPiece, nextSpawnX, nextGhostY + 1)) {
          nextGhostY++;
        }
        
        // Draw very faint ghost of next piece
        nextPiece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value) {
              const blockX = (nextSpawnX + x) * BLOCK_SIZE;
              const blockY = (nextGhostY + y) * BLOCK_SIZE;
              const size = BLOCK_SIZE - 2;
              
              // Ultra-faint fill
              ctx.fillStyle = colorWithAlpha(nextPiece.color, 0.07);
              ctx.fillRect(blockX + 1, blockY + 1, size, size);
              
              // Faint dotted border
              ctx.strokeStyle = colorWithAlpha(nextPiece.color, 0.38);
              ctx.lineWidth = 1.4;
              ctx.setLineDash([3, 5]);
              ctx.lineDashOffset = -gridAnimation * 0.35;
              ctx.strokeRect(blockX + 1, blockY + 1, size, size);
              ctx.lineDashOffset = 0;
              ctx.setLineDash([]);
            }
          });
        });
      }
    }

    // Draw score popups
    scorePopups.forEach(popup => {
      const alpha = popup.life / popup.maxLife;
      const popupScale = popup.scale || 1;
      const pulseBoost = 1 + Math.sin((1 - alpha) * Math.PI * 5) * 0.08;
      const effectiveScale = popupScale * pulseBoost;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round(24 * effectiveScale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.max(3, Math.round(4 * popupScale));
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = Math.max(8, 14 * popupScale);
      
      // Draw points
      const pointsText = `+${popup.points.toLocaleString()}`;
      ctx.strokeText(pointsText, popup.x, popup.y);
      ctx.fillText(pointsText, popup.x, popup.y);
      
      // Draw additional text
      if (popup.text) {
        ctx.font = `bold ${Math.round(16 * effectiveScale)}px Arial`;
        const secondaryYOffset = Math.round(25 * popupScale);
        ctx.strokeText(popup.text, popup.x, popup.y + secondaryYOffset);
        ctx.fillText(popup.text, popup.x, popup.y + secondaryYOffset);
      }
      
      ctx.restore();
      
      // Update popup
      popup.y += popup.vy * (popup.scale > 1.3 ? 1.05 : 1);
      popup.life--;
    });
    
    // Remove dead popups
    gameState.current.scorePopups = scorePopups.filter(p => p.life > 0);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK_SIZE, 0);
      ctx.lineTo(x * BLOCK_SIZE, BOARD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK_SIZE);
      ctx.lineTo(BOARD_WIDTH, y * BLOCK_SIZE);
      ctx.stroke();
    }
    
    ctx.restore(); // End board translation
    
    // Draw Combo Meter Visual
    if (combo > 0) {
      const meterX = boardOffsetX;
      const meterHeight = isMobile ? 30 : 20;
      const meterY = CANVAS_HEIGHT - (isMobile ? 62 : 50);
      const meterWidth = BOARD_WIDTH;
      const fillWidth = Math.min(1, combo / 15) * meterWidth;
      const comboInfo = getComboColor(combo);
      const comboTextScale = isMobile ? 1.55 : 1;
      const comboTextPulse = 1 + Math.sin(gridAnimation * 0.22) * (isMobile ? 0.2 : 0.08);
      const comboFontPx = Math.round(18 * comboTextScale * comboTextPulse);
      const rainbowCombo = combo >= 10;
      
      // Background with glow
      ctx.save();
      ctx.shadowColor = comboInfo.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
      
      // Fill with gradient based on combo tier
      const gradient = ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
      gradient.addColorStop(0, '#00ff00');
      gradient.addColorStop(0.3, '#ffff00');
      gradient.addColorStop(0.6, '#ff8800');
      gradient.addColorStop(0.8, '#ff0000');
      gradient.addColorStop(1, '#ff00ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(meterX, meterY, fillWidth, meterHeight);
      
      // Animated pulse overlay
      const pulseAlpha = 0.3 + Math.sin(gridAnimation * 0.2) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
      ctx.fillRect(meterX, meterY, fillWidth, meterHeight / 3);
      
      // Border with glow
      ctx.strokeStyle = comboInfo.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
      ctx.shadowBlur = 0;
      
      // Combo text
      ctx.font = `bold ${comboFontPx}px Arial`;
      ctx.fillStyle = comboInfo.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = isMobile ? 6 : 4;
      ctx.textAlign = 'center';
      const comboText = `${combo}x ${comboInfo.name}`;
      const comboTextY = meterY - (isMobile ? 10 : 5);
      ctx.shadowColor = comboInfo.color;
      ctx.shadowBlur = isMobile ? 22 : 12;
      if (rainbowCombo) {
        const rainbow = ctx.createLinearGradient(meterX, comboTextY - 10, meterX + meterWidth, comboTextY + 10);
        rainbow.addColorStop(0, '#ff4d4d');
        rainbow.addColorStop(0.2, '#ff9a3d');
        rainbow.addColorStop(0.4, '#ffee4d');
        rainbow.addColorStop(0.6, '#4dff93');
        rainbow.addColorStop(0.8, '#4dc8ff');
        rainbow.addColorStop(1, '#cc66ff');
        ctx.fillStyle = rainbow;
      }
      ctx.strokeText(comboText, meterX + meterWidth / 2, comboTextY);
      ctx.fillText(comboText, meterX + meterWidth / 2, comboTextY);
      ctx.restore();
    }
    
    // Restore screen shake transform
    ctx.restore();

    // Draw hold piece preview (left panel)
    if (holdPiece) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 110, 110);
      ctx.strokeStyle = '#00f0f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 110, 110);
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('HOLD', 15, 28);
      ctx.font = 'bold 10px Arial';
      ctx.fillText('(C)', 15, 42);
      
      const pieceSize = 20;
      const offsetX = 65 - (holdPiece.shape[0].length * pieceSize) / 2;
      const offsetY = 85 - (holdPiece.shape.length * pieceSize) / 2;
      
      holdPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const bx = offsetX + x * pieceSize;
            const by = offsetY + y * pieceSize;
            const bs = pieceSize - 2;
            
            // Base color with subtle glow
            ctx.shadowColor = holdPiece.color;
            ctx.shadowBlur = 6;
            ctx.fillStyle = holdPiece.color;
            ctx.fillRect(bx, by, bs, bs);
            ctx.shadowBlur = 0;
            
            // Lighting gradient
            const grad = ctx.createLinearGradient(bx, by, bx, by + bs);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
            grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.3)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            ctx.fillStyle = grad;
            ctx.fillRect(bx, by, bs, bs);
            
            // Specular shine
            const spec = ctx.createRadialGradient(
              bx + bs * 0.3, by + bs * 0.25, 0,
              bx + bs * 0.3, by + bs * 0.25, bs * 0.5
            );
            spec.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            spec.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
            spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = spec;
            ctx.fillRect(bx, by, bs, bs);
            
            // Border highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx + 1, by + 1, bs - 2, bs - 2);
          }
        });
      });
    }

    // Draw next pieces preview (right panel) - Show 3 pieces
    const nextPanelX = boardOffsetX + BOARD_WIDTH + 10;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(nextPanelX, 10, 110, 300);
    ctx.strokeStyle = '#00f0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(nextPanelX, 10, 110, 300);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('NEXT', nextPanelX + 5, 28);
    
    // Draw top 3 pieces with larger size
    nextPieces.slice(0, 3).forEach((piece, index) => {
      const pieceSize = 20;
      const yOffset = 60 + index * 95;
      const offsetX = nextPanelX + 55 - (piece.shape[0].length * pieceSize) / 2;
      const offsetY = yOffset - (piece.shape.length * pieceSize) / 2;
      
      // Draw piece number
      ctx.fillStyle = '#888';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(`#${index + 1}`, nextPanelX + 5, yOffset - 30);
      
      piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const bx = offsetX + x * pieceSize;
            const by = offsetY + y * pieceSize;
            const bs = pieceSize - 2;
            const baseAlpha = 1 - (index * 0.15);
            
            ctx.globalAlpha = baseAlpha;
            
            // Base color with subtle glow
            ctx.shadowColor = piece.color;
            ctx.shadowBlur = 5;
            ctx.fillStyle = piece.color;
            ctx.fillRect(bx, by, bs, bs);
            ctx.shadowBlur = 0;
            
            // Lighting gradient
            const grad = ctx.createLinearGradient(bx, by, bx, by + bs);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
            grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.3)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            ctx.fillStyle = grad;
            ctx.fillRect(bx, by, bs, bs);
            
            // Specular shine
            const spec = ctx.createRadialGradient(
              bx + bs * 0.3, by + bs * 0.25, 0,
              bx + bs * 0.3, by + bs * 0.25, bs * 0.5
            );
            spec.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
            spec.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
            spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = spec;
            ctx.fillRect(bx, by, bs, bs);
            
            // Border highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx + 1, by + 1, bs - 2, bs - 2);
            
            ctx.globalAlpha = 1;
          }
        });
      });
    });

    // Draw combo display
    if (combo > 0 && lastClearWasCombo) {
      ctx.save();
      const headlineScale = isMobile ? 1.8 : 1.15;
      const headlinePulse = 1 + Math.sin(gridAnimation * 0.3) * (isMobile ? 0.24 : 0.12);
      const headlineFontPx = Math.round(24 * headlineScale * headlinePulse);
      ctx.font = `bold ${headlineFontPx}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f0a000';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = isMobile ? 7 : 4;
      ctx.shadowColor = '#ff8c00';
      ctx.shadowBlur = isMobile ? 24 : 14;
      if (combo >= 10) {
        const rainbowHeadline = ctx.createLinearGradient(
          boardOffsetX + BOARD_WIDTH - 280,
          0,
          boardOffsetX + BOARD_WIDTH,
          0
        );
        rainbowHeadline.addColorStop(0, '#ff4d4d');
        rainbowHeadline.addColorStop(0.22, '#ff9a3d');
        rainbowHeadline.addColorStop(0.42, '#ffee4d');
        rainbowHeadline.addColorStop(0.62, '#4dff93');
        rainbowHeadline.addColorStop(0.82, '#4dc8ff');
        rainbowHeadline.addColorStop(1, '#cc66ff');
        ctx.fillStyle = rainbowHeadline;
      }
      
      const comboText = `${combo}x COMBO`;
      const comboX = boardOffsetX + BOARD_WIDTH - 10;
      const comboY = isMobile ? 42 : 30;
      ctx.strokeText(comboText, comboX, comboY);
      ctx.fillText(comboText, comboX, comboY);
      ctx.restore();
    }

    // Full-screen combo banner burst for legendary combos.
    if (gameState.current.comboBannerBurst && gameState.current.comboBannerBurst.life > 0 && !prefersReducedMotion) {
      const burst = gameState.current.comboBannerBurst;
      const progress = 1 - (burst.life / burst.maxLife);
      const alpha = Math.sin(Math.min(1, progress) * Math.PI) * 0.85;
      const pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.05;

      ctx.save();
      ctx.globalAlpha = alpha;

      const bannerGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      bannerGrad.addColorStop(0, 'rgba(255, 60, 120, 0.65)');
      bannerGrad.addColorStop(0.22, 'rgba(255, 140, 40, 0.6)');
      bannerGrad.addColorStop(0.46, 'rgba(255, 240, 60, 0.5)');
      bannerGrad.addColorStop(0.7, 'rgba(80, 255, 160, 0.5)');
      bannerGrad.addColorStop(1, 'rgba(110, 130, 255, 0.65)');
      ctx.fillStyle = bannerGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const burstText = `LEGENDARY ${burst.combo}x COMBO!`;
      const bannerFont = Math.round((isMobile ? 52 : 42) * pulse);
      ctx.font = `900 ${bannerFont}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = isMobile ? 9 : 7;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = isMobile ? 34 : 26;

      const textGrad = ctx.createLinearGradient(0, CANVAS_HEIGHT * 0.5 - 20, 0, CANVAS_HEIGHT * 0.5 + 20);
      textGrad.addColorStop(0, '#ffffff');
      textGrad.addColorStop(0.45, '#fff176');
      textGrad.addColorStop(0.75, '#ff8a65');
      textGrad.addColorStop(1, '#ef5350');
      ctx.fillStyle = textGrad;

      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT * 0.5;
      ctx.strokeText(burstText, centerX, centerY);
      ctx.fillText(burstText, centerX, centerY);

      burst.life -= 1;
      if (burst.life <= 0) {
        gameState.current.comboBannerBurst = null;
      }
      ctx.restore();
    }

    // Draw color bonus notification
    if (gameState.current.colorBonusDisplay) {
      const bonus = gameState.current.colorBonusDisplay;
      const alpha = Math.min(1, bonus.time / 30);
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0a000';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      
      const text = bonus.text || `+${bonus.points}`;
      const bonusX = boardOffsetX + BOARD_WIDTH / 2;
      const yPos = CANVAS_HEIGHT / 3 - (60 - bonus.time);
      
      ctx.strokeText(text, bonusX, yPos);
      ctx.fillText(text, bonusX, yPos);
      
      if (bonus.points) {
        ctx.font = 'bold 20px Arial';
        ctx.strokeText(`+${bonus.points}`, bonusX, yPos + 30);
        ctx.fillText(`+${bonus.points}`, bonusX, yPos + 30);
      }
      
      ctx.restore();
      
      bonus.time--;
      if (bonus.time <= 0) {
        gameState.current.colorBonusDisplay = null;
      }
    }
    
    // Draw white flash effect for line clears
    if (gameState.current.flashEffect > 0) {
      const alpha = (gameState.current.flashEffect / 15) * 0.4; // Max 40% opacity
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
      gameState.current.flashEffect--;
    }
    
    // Draw combo flash effect (colored flash for high combos)
    if (gameState.current.comboFlash > 0) {
      const alpha = (gameState.current.comboFlash / 18) * 0.5;
      const comboInfo = getComboColor(combo);
      ctx.save();
      ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.8
      );
      gradient.addColorStop(0, comboInfo.color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
      gameState.current.comboFlash--;
    }
    
    // Draw perfect clear flash (full-screen rainbow flash)
    if (gameState.current.perfectClearFlash > 0) {
      const alpha = (gameState.current.perfectClearFlash / 30) * 0.7;
      const flashPhase = (30 - gameState.current.perfectClearFlash) / 30;
      
      ctx.save();
      ctx.globalAlpha = alpha;
      
      // Rainbow gradient effect
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const hue1 = (flashPhase * 360) % 360;
      const hue2 = (flashPhase * 360 + 120) % 360;
      const hue3 = (flashPhase * 360 + 240) % 360;
      gradient.addColorStop(0, `hsl(${hue1}, 100%, 70%)`);
      gradient.addColorStop(0.5, `hsl(${hue2}, 100%, 70%)`);
      gradient.addColorStop(1, `hsl(${hue3}, 100%, 70%)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Add pulsing border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      const pulseSize = Math.sin(flashPhase * Math.PI * 4) * 20;
      ctx.strokeRect(pulseSize, pulseSize, CANVAS_WIDTH - pulseSize * 2, CANVAS_HEIGHT - pulseSize * 2);
      
      ctx.restore();
      gameState.current.perfectClearFlash--;
    }
    
    // Draw piece lock animation (scale effect on recently placed piece)
    if (gameState.current.pieceLockAnimation > 0) {
      const alpha = gameState.current.pieceLockAnimation / 12;
      const scale = 1 + (1 - alpha) * 0.15; // Slight scale increase
      
      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.translate(boardOffsetX, 0);
      
      // Draw glow effect at lock position
      const { board } = gameState.current;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (board[y][x]) {
            const centerX = x * BLOCK_SIZE + BLOCK_SIZE / 2;
            const centerY = y * BLOCK_SIZE + BLOCK_SIZE / 2;
            
            // Only draw on the top few rows (where piece just landed)
            if (y < 5) {
              const gradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, BLOCK_SIZE * scale
              );
              gradient.addColorStop(0, board[y][x]);
              gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(centerX - BLOCK_SIZE, centerY - BLOCK_SIZE, BLOCK_SIZE * 2, BLOCK_SIZE * 2);
            }
          }
        }
      }
      
      ctx.restore();
      gameState.current.pieceLockAnimation--;
    }
  }, [checkCollision, isPaused, combo, lastClearWasCombo, CANVAS_WIDTH, CANVAS_HEIGHT, BOARD_WIDTH, BOARD_HEIGHT, BLOCK_SIZE, COLS, ROWS, getComboColor, returnParticleToPool, currentTheme, prefersReducedMotion, lowPowerMode, initBgParticles, MAX_ACTIVE_PARTICLES, isMobile]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;

    let animationFrameId;
    const frameInterval = lowPowerMode ? 1000 / 30 : 1000 / 60;
    
    const gameLoop = (time = 0) => {
      const deltaTime = time - gameState.current.lastTime;
      gameState.current.lastTime = time;
      gameState.current.dropCounter += deltaTime;

      // Handle gamepad input only when a controller is connected.
      if (gamepadConnected) {
        handleGamepadInput();
      }

      // Track smoothed frame cost so draw can adapt visual complexity.
      const frameCost = deltaTime > 0 ? deltaTime : 16.67;
      gameState.current.avgFrameMs = (gameState.current.avgFrameMs * 0.9) + (frameCost * 0.1);

      if (gameState.current.dropCounter > gameState.current.dropInterval) {
        moveDown();
        gameState.current.dropCounter = 0;
      }

      if (time - gameState.current.lastRenderTime >= frameInterval) {
        draw();
        gameState.current.lastRenderTime = time;
      }
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [gameStarted, gameOver, isPaused, moveDown, draw, handleGamepadInput, lowPowerMode, gamepadConnected]);

  // Draw when paused
  useEffect(() => {
    if (isPaused) {
      draw();
    }
  }, [isPaused, draw]);

  // Handle music pause/resume
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    
    if (isPaused) {
      // Pause music
      if (musicPlayerRef.current) {
        musicPlayerRef.current.pause();
      }
    } else if (musicEnabled) {
      // Resume or start music
      if (musicPlayerRef.current && musicPlayerRef.current.paused) {
        // Resume existing track
        musicPlayerRef.current.play().catch(err => {
          console.warn('Music resume blocked:', err.message);
        });
      } else if (!musicPlayerRef.current) {
        // Start new track if no music playing
        startMusic(null, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, gameStarted, gameOver, musicEnabled]);

  // Auto-pause when tab loses focus (desktop only)
  useEffect(() => {
    // Skip auto-pause on mobile - use two-finger tap instead
    if (isMobile) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden && gameStarted && !gameOver && !isPaused) {
        setIsPaused(true);
      }
    };

    const handleBlur = () => {
      if (gameStarted && !gameOver && !isPaused) {
        setIsPaused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isMobile, gameStarted, gameOver, isPaused]);

  // Setup touch event listeners with passive: false to allow preventDefault
  useEffect(() => {
    const buttons = touchButtonsRef.current;
    if (!buttons.length || !isMobile || !gameStarted || gameOver || isPaused) return;

    const handleTouchStart = (e, callback, vibratePattern, enableHold = false, holdCallback = null) => {
      e.preventDefault();
      e.stopPropagation();
      vibrate(vibratePattern);
      callback();

      // Hold-to-move functionality for left/right buttons
      if (enableHold && holdCallback) {
        // Start auto-repeat after 300ms
        holdTimeoutRef.current = setTimeout(() => {
          holdIntervalRef.current = setInterval(() => {
            vibrate(5); // Light vibration for auto-repeat
            holdCallback();
          }, 100); // Repeat every 100ms
        }, 300);
      }
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Clear hold-to-move timers
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
    };

    const listeners = buttons.map((button, index) => {
      if (!button) return null;
      
      let callback, vibratePattern, enableHold, holdCallback;
      switch(index) {
        case 0: // Pause
          callback = () => setIsPaused(true);
          vibratePattern = 20;
          break;
        case 1: // Rotate
          callback = () => rotate();
          vibratePattern = 15;
          break;
        case 2: // Left
          callback = () => moveHorizontal(-1);
          vibratePattern = 10;
          enableHold = true;
          holdCallback = () => moveHorizontal(-1);
          break;
        case 3: // Down
          callback = () => moveDown();
          vibratePattern = 8;
          enableHold = true;
          holdCallback = () => moveDown();
          break;
        case 4: // Right
          callback = () => moveHorizontal(1);
          vibratePattern = 10;
          enableHold = true;
          holdCallback = () => moveHorizontal(1);
          break;
        case 5: // Hold piece
          callback = () => holdCurrentPiece();
          vibratePattern = 25;
          break;
        case 6: // Hard drop
          callback = () => hardDrop();
          vibratePattern = [10, 50, 30]; // Double pulse
          break;
        default: return null;
      }

      const startListener = (e) => handleTouchStart(e, callback, vibratePattern, enableHold, holdCallback);
      const endListener = (e) => handleTouchEnd(e);
      
      button.addEventListener('touchstart', startListener, { passive: false });
      button.addEventListener('touchend', endListener, { passive: false });
      button.addEventListener('touchcancel', endListener, { passive: false });
      
      return { button, startListener, endListener };
    }).filter(Boolean);

    return () => {
      // Clear any active hold timers
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      
      listeners.forEach(({ button, startListener, endListener }) => {
        button.removeEventListener('touchstart', startListener);
        button.removeEventListener('touchend', endListener);
        button.removeEventListener('touchcancel', endListener);
      });
    };
  }, [isMobile, gameStarted, gameOver, isPaused, rotate, moveHorizontal, moveDown, holdCurrentPiece, hardDrop, vibrate]);

  // Swipe gesture detection on canvas
  useEffect(() => {
    if (!isMobile || !canvasRef.current) return;

    const canvas = canvasRef.current;

    const handleTouchStart = (e) => {
      // Prevent scrolling when game is active
      if (gameStarted && !gameOver && !isPaused) {
        e.preventDefault();
      }
      
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    };

    const handleTouchMove = (e) => {
      // Prevent scrolling during active gameplay
      if (gameStarted && !gameOver && !isPaused) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      if (!gameStarted || gameOver || isPaused) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      const deltaTime = Date.now() - touchStart.current.time;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Ignore if too slow or too short
      if (deltaTime > 300 || distance < 30) return;

      e.preventDefault();

      // Ensure music keeps playing after touch interaction (mobile audio context fix)
      if (musicPlayerRef.current && musicPlayerRef.current.paused && musicEnabled && !isPaused) {
        musicPlayerRef.current.play().catch(err => {
          console.warn('Music resume after touch blocked:', err.message);
        });
      }

      // Determine swipe direction
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Vertical swipe
        if (deltaY < 0) {
          // Swipe up - rotate
          vibrate(15);
          rotate();
        } else {
          // Swipe down - hard drop
          vibrate([10, 50, 30]); // Double pulse for hard drop
          hardDrop();
        }
      } else {
        // Horizontal swipe  
        if (deltaX < 0) {
          // Swipe left
          vibrate(10);
          moveHorizontal(-1);
        } else {
          // Swipe right
          vibrate(10);
          moveHorizontal(1);
        }
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, gameStarted, gameOver, isPaused, rotate, hardDrop, moveHorizontal, vibrate, musicEnabled]);

  // Two-finger tap to pause (mobile only)
  useEffect(() => {
    if (!isMobile) return;

    let twoFingerStart = null;

    const handleTwoFingerTap = (e) => {
      // Only respond during active gameplay
      if (!gameStarted || gameOver) return;
      
      // Check if exactly 2 touches at the START
      if (e.type === 'touchstart' && e.touches.length === 2) {
        twoFingerStart = {
          x1: e.touches[0].clientX,
          y1: e.touches[0].clientY,
          x2: e.touches[1].clientX,
          y2: e.touches[1].clientY,
          time: Date.now()
        };
      }
      
      // Check on touchend if it was a tap (not a swipe)
      if (e.type === 'touchend' && twoFingerStart) {
        const deltaTime = Date.now() - twoFingerStart.time;
        
        // Must be quick (less than 300ms) to be a tap
        if (deltaTime < 300 && e.changedTouches.length > 0) {
          e.preventDefault();
          setIsPaused(prev => !prev);
          vibrate([30, 30, 30]); // Triple pulse feedback
          playSound('menuClick', 600, 0.1);
        }
        
        twoFingerStart = null;
      }
    };

    document.addEventListener('touchstart', handleTwoFingerTap, { passive: false });
    document.addEventListener('touchend', handleTwoFingerTap, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTwoFingerTap);
      document.removeEventListener('touchend', handleTwoFingerTap);
    };
  }, [isMobile, gameStarted, gameOver, vibrate, playSound]);

  // Show pause hint when game starts (mobile only)
  useEffect(() => {
    if (isMobile && gameStarted && !gameOver && !isPaused) {
      setShowPauseHint(true);
      const timer = setTimeout(() => {
        setShowPauseHint(false);
      }, 4000); // Show for 4 seconds
      return () => clearTimeout(timer);
    }
  }, [isMobile, gameStarted, gameOver, isPaused]);

  // Prevent body scroll during active gameplay
  useEffect(() => {
    if (!isMobile) return;

    const preventScroll = (e) => {
      if (gameStarted && !gameOver && !isPaused) {
        e.preventDefault();
      }
    };

    if (gameStarted && !gameOver && !isPaused) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.addEventListener('touchmove', preventScroll, { passive: false });
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [isMobile, gameStarted, gameOver, isPaused]);

  // Update elapsed time for Sprint and Marathon modes
  useEffect(() => {
    if (!gameStarted || !startTime || gameOver) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [gameStarted, startTime, gameOver]);

  // Initialize PWA features
  useEffect(() => {
    initPWA();
    
    // Load global leaderboard
    loadGlobalLeaderboard();
    
    // Load player's global rank
    if (playerName) {
      loadPlayerGlobalStats();
    }
    
    // Check if app is installed
    setIsAppInstalled(isInstalled());
    
    // Check if install prompt is available
    const handleInstallAvailable = () => {
      setCanInstall(true);
    };
    
    window.addEventListener('installAvailable', handleInstallAvailable);
    
    // Check notification permission
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
    
    // Get daily challenge
    const challenge = getDailyChallenge();
    setDailyChallenge(challenge);
    
    // Initialize network listeners
    initNetworkListener(
      () => {
        setIsOfflineMode(false);
        setShowOfflineBanner(false);
      },
      () => {
        setIsOfflineMode(true);
        setShowOfflineBanner(true);
      }
    );
    
    // Initialize sync listener
    initSyncListener((scores) => {
      console.log('High scores synced from offline queue:', scores);
      // Process synced scores if needed
    });
    
    // Initialize theme system
    applyTheme(currentTheme);
    
    // Check seasonal themes
    const seasonal = getActiveSeasonalThemes();
    setSeasonalThemes(seasonal);
    
    // Check theme unlocks on mount
    updateThemeUnlocks();
    
    return () => {
      window.removeEventListener('installAvailable', handleInstallAvailable);
    };
  }, []);

  // Update theme unlocks based on player stats
  const updateThemeUnlocks = useCallback(() => {
    const playerStats = {
      highScore: highScore,
      totalLines: statistics.totalLines,
      bestCombo: statistics.bestCombo,
      highestLevel: level,
      totalGames: statistics.totalGames,
      bestSprintTime: statistics.bestSprintTime
    };
    
    const unlocked = getUnlockedThemes(playerStats);
    setUnlockedThemes(unlocked);
    
    // Check for newly unlocked themes
    Object.keys(unlocked).forEach(themeId => {
      if (unlocked[themeId] && !unlockedThemes[themeId]) {
        const theme = THEME_DEFINITIONS[themeId];
        if (theme && theme.category !== 'base' && !theme.season) {
          // Show unlock notification
          setNewThemeUnlocked(theme);
          
          // Show notification if enabled
          if (Notification.permission === 'granted') {
            showNotification(
              '🎨 New Theme Unlocked!',
              `${theme.name} - ${theme.description}`,
              { tag: 'theme-unlock' }
            );
          }
          
          // Clear notification after 5 seconds
          setTimeout(() => setNewThemeUnlocked(null), 5000);
        }
      }
    });
  }, [highScore, statistics, level, unlockedThemes]);

  // Check theme unlocks after game over
  useEffect(() => {
    if (gameOver) {
      setTimeout(() => updateThemeUnlocks(), 1000);
    }
  }, [gameOver, updateThemeUnlocks]);

  // Apply theme when changed
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Listen for service worker updates
  useEffect(() => {
    const handleUpdate = (event) => {
      console.log('Update available!', event.detail);
      setShowUpdateBanner(true);
      setWaitingWorker(event.detail.registration?.waiting);
    };
    
    window.addEventListener('swUpdateAvailable', handleUpdate);
    
    return () => {
      window.removeEventListener('swUpdateAvailable', handleUpdate);
    };
  }, []);

  // Handle splash screen timeout and audio
  useEffect(() => {
    // Play splash audio when screen appears
    if (soundEnabled && sfxVolume > 0) {
      try {
        const splashAudio = new Audio(`${process.env.PUBLIC_URL}/mixkit-technology-alert-transition-3121.mp3`);
        splashAudio.volume = Math.min(1.0, sfxVolume); // Full SFX volume for splash
        splashAudio.play().catch(err => {
          // Autoplay might be blocked by browser
          console.warn('Splash audio autoplay blocked by browser:', err.message);
        });
      } catch (err) {
        console.error('Error loading splash audio:', err);
      }
    }

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000); // Show splash for 3 seconds
    
    return () => clearTimeout(timer);
  }, [soundEnabled, sfxVolume]);

  // Activate service worker update
  const activateUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  // Handle install prompt
  const handleInstall = async () => {
    const result = await showInstallPrompt();
    if (result.outcome === 'accepted') {
      setCanInstall(false);
      setShowInstallBanner(false);
    }
  };

  // Handle notification toggle
  const handleNotificationToggle = async () => {
    if (notificationsEnabled) {
      await unsubscribeFromPush();
      setNotificationsEnabled(false);
    } else {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        await subscribeToPush();
        setNotificationsEnabled(true);
      }
    }
  };

  // Check daily challenge on game over
  useEffect(() => {
    if (gameOver && dailyChallenge && !dailyChallenge.completed) {
      try {
        const gameData = {
          mode: gameMode || 'classic',
          score: score || 0,
          lines: lines || 0,
          maxCombo: combo || 0,
          time: startTime ? Date.now() - startTime : 0,
          piecesPlaced: statistics.totalPieces || 0
        };
        
        const result = checkDailyChallenge(gameData);
        if (result.success) {
          // Refresh daily challenge state
          setDailyChallenge(getDailyChallenge());
        }
      } catch (error) {
        console.error('Error checking daily challenge:', error);
      }
    }
  }, [gameOver, dailyChallenge, gameMode, score, lines, combo, startTime, statistics.totalPieces]);

  // Queue high score for offline sync
  useEffect(() => {
    if (gameOver && score > 0) {
      try {
        if (isOffline()) {
          queueHighScore({
            score: score || 0,
            lines: lines || 0,
            level: level || 1,
            mode: gameMode || 'classic',
            playerName: playerName || 'Player',
            date: Date.now()
          });
        }
      } catch (error) {
        console.error('Error queueing high score:', error);
      }
    }
  }, [gameOver, score, lines, level, gameMode, playerName]);

  // Persist local leaderboard entries for quick in-app ranking.
  useEffect(() => {
    safeSetItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(normalizeLeaderboardEntries(leaderboardEntries)));
  }, [leaderboardEntries]);

  // Track finished runs and add them to leaderboard once per game-over event.
  useEffect(() => {
    if (!gameOver || score <= 0) return;

    const runSignature = [score || 0, lines || 0, level || 1, gameMode || 'classic', startTime || 'nostart'].join(':');
    if (lastLeaderboardRunRef.current === runSignature) {
      return;
    }
    lastLeaderboardRunRef.current = runSignature;

    const previousPlayerBestScore = Math.max(
      0,
      ...normalizeLeaderboardEntries(leaderboardEntries)
        .filter((entry) => entry.name === (playerName || 'Player'))
        .map((entry) => entry.score)
    );
    const previousGlobalRank = getPlayerBestRank(leaderboardEntries, playerName || 'Player', 'all');

    const newEntry = {
      name: playerName || 'Player',
      avatar: playerAvatar || '🎮',
      score: score || 0,
      lines: lines || 0,
      level: level || 1,
      mode: gameMode || 'classic',
      date: new Date().toISOString()
    };

    const nextEntries = normalizeLeaderboardEntries([...(leaderboardEntries || []), newEntry]);
    const nextGlobalRank = getPlayerBestRank(nextEntries, playerName || 'Player', 'all');

    if ((score || 0) > previousPlayerBestScore && nextGlobalRank && (previousGlobalRank === null || nextGlobalRank < previousGlobalRank)) {
      setRankJump({
        from: previousGlobalRank,
        to: nextGlobalRank,
        mode: gameMode || 'classic'
      });
    }

    setLeaderboardEntries(nextEntries);
  }, [gameOver, score, lines, level, gameMode, startTime, playerName, playerAvatar, leaderboardEntries]);

  // Submit score to global leaderboard when game ends
  useEffect(() => {
    if (!gameOver || score <= 0 || !playerName) return;

    // Check if we've already submitted this exact score
    const scoreSignature = [score, lines, level, gameMode, startTime].join(':');
    if (lastScoreSubmitted === scoreSignature) return;

    setLastScoreSubmitted(scoreSignature);

    const submitScore = async () => {
      try {
        const result = await submitScoreToLeaderboard({
          name: playerName,
          avatar: playerAvatar,
          score: score,
          lines: lines,
          level: level,
          mode: gameMode,
          durationMs: elapsedTime,
          sessionToken: leaderboardSessionToken
        });

        if (result.success) {
          console.log('Score submitted to global leaderboard. Rank:', result.rank);
          // Refresh global leaderboard to show updated rankings
          setTimeout(() => loadGlobalLeaderboard(), 500);
        } else {
          console.warn('Failed to submit score to global leaderboard:', result.error);
        }
      } catch (error) {
        console.error('Error submitting score to global leaderboard:', error);
      }
    };

    submitScore();
  }, [gameOver, score, lines, level, gameMode, startTime, playerName, playerAvatar, lastScoreSubmitted, elapsedTime, leaderboardSessionToken]);

  useEffect(() => {
    if (!gameOver) {
      lastLeaderboardRunRef.current = '';
      setRankJump(null);
      setLastScoreSubmitted(null);
    }
  }, [gameOver]);

  const closeLeaderboardModal = useCallback(() => {
    setShowLeaderboard(false);
    setShowClearLeaderboardConfirm(false);
  }, []);

  const clearLeaderboard = useCallback(() => {
    setLeaderboardEntries([]);
    safeSetItem(LEADERBOARD_STORAGE_KEY, '[]');
    setShowClearLeaderboardConfirm(false);
    setShowLeaderboardClearedToast(true);
  }, []);

  // Load global leaderboard from server
  const loadGlobalLeaderboard = useCallback(async () => {
    setGlobalLeaderboardLoading(true);
    setGlobalLeaderboardError(null);
    try {
      const requestedMode = leaderboardView === 'mode' ? leaderboardModeFilter : 'all';
      const result = await fetchGlobalLeaderboard({
        limit: MAX_LEADERBOARD_DISPLAY,
        mode: requestedMode,
        scope: leaderboardScopeFilter
      });
      if (result.success) {
        setGlobalLeaderboardEntries(result.entries || []);
      } else {
        const fallbackEntries = normalizeLeaderboardEntries(topLeaderboardEntries || []);
        if (fallbackEntries.length > 0) {
          setGlobalLeaderboardEntries(fallbackEntries);
          setGlobalLeaderboardError(`Global leaderboard unavailable (${result.error || 'unknown error'}). Showing local entries.`);
        } else {
          setGlobalLeaderboardError(result.error || 'Failed to load leaderboard');
        }
      }
    } catch (error) {
      console.error('Error loading global leaderboard:', error);
      const fallbackEntries = normalizeLeaderboardEntries(topLeaderboardEntries || []);
      if (fallbackEntries.length > 0) {
        setGlobalLeaderboardEntries(fallbackEntries);
        setGlobalLeaderboardError(`Global leaderboard unavailable (${error.message}). Showing local entries.`);
      } else {
        setGlobalLeaderboardError(error.message);
      }
    } finally {
      setGlobalLeaderboardLoading(false);
    }
  }, [leaderboardView, leaderboardModeFilter, leaderboardScopeFilter, topLeaderboardEntries]);

  // Load player's global stats
  const loadPlayerGlobalStats = useCallback(async () => {
    if (!playerName) return;
    try {
      const requestedMode = leaderboardView === 'mode' ? leaderboardModeFilter : 'all';
      const result = await getPlayerLeaderboardStats(playerName, requestedMode, leaderboardScopeFilter);
      if (result.success) {
        setPlayerGlobalRank(result.rank);
      }
    } catch (error) {
      console.error('Error loading player global stats:', error);
    }
  }, [playerName, leaderboardView, leaderboardModeFilter, leaderboardScopeFilter]);

  useEffect(() => {
    if (!showLeaderboardClearedToast) return;
    const timer = setTimeout(() => setShowLeaderboardClearedToast(false), 2200);
    return () => clearTimeout(timer);
  }, [showLeaderboardClearedToast]);

  // Reload global leaderboard when mode filter changes or leaderboard is opened
  useEffect(() => {
    if (showLeaderboard) {
      loadGlobalLeaderboard();
      loadPlayerGlobalStats();
    }
  }, [showLeaderboard, leaderboardModeFilter, leaderboardScopeFilter, leaderboardView, loadGlobalLeaderboard, loadPlayerGlobalStats]);

  const shellTheme = THEME_DEFINITIONS[currentTheme] || THEME_DEFINITIONS.dark;
  const shellVisual = shellTheme.visual || getThemeVisualProfile(currentTheme, shellTheme.category);
  const shellClasses = [
    'drift-racer',
    !gameStarted ? 'menu-active' : 'game-active',
    lowPowerMode ? 'battery-saver' : '',
    `theme-id-${shellTheme.id || 'dark'}`,
    `theme-category-${shellTheme.category || 'base'}`,
    `theme-pattern-${shellVisual?.pattern || 'wave-grid'}`,
    `theme-motif-${shellVisual?.motif || 'ribbons'}`
  ].filter(Boolean).join(' ');

  const menuParticles = useMemo(() => {
    const sizes = ['particle-xs', 'particle-sm', 'particle-md', 'particle-lg', 'particle-xl'];
    const colors = ['', 'particle-warm', 'particle-cool', 'particle-white', 'particle-magenta'];
    const shapes = ['', 'particle-star', 'particle-square', 'particle-diamond'];
    const motions = ['', 'particle-wave', 'particle-spiral', 'particle-orbit', 'particle-glow'];

    const particleCount = lowPowerMode
      ? 8
      : prefersReducedMotion
        ? 12
        : isMobile
          ? 20
          : 50;

    return Array.from({ length: particleCount }, (_, index) => ({
      key: index,
      sizeClass: sizes[Math.floor(Math.random() * sizes.length)],
      colorClass: colors[Math.floor(Math.random() * colors.length)],
      shapeClass: shapes[Math.floor(Math.random() * shapes.length)],
      motionClass: motions[Math.floor(Math.random() * motions.length)],
      left: `${Math.random() * 100}%`,
      duration: `${6 + Math.random() * 8}s`,
      delay: `${Math.random() * 2}s`,
      driftX: `${(Math.random() - 0.5) * 80}px`
    }));
  }, [isMobile, lowPowerMode, prefersReducedMotion]);

  const menuFallingBlocks = useMemo(() => {
    const shapes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const colors = ['#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0a000'];

    return Array.from({ length: 8 }, (_, index) => {
      const shapeIndex = index % shapes.length;
      return {
        key: index,
        shape: shapes[shapeIndex],
        color: colors[shapeIndex],
        left: `${(index * 7 + Math.random() * 5)}%`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${8 + Math.random() * 6}s`,
        opacity: 0.15 + Math.random() * 0.1
      };
    });
  }, []);

  const renderShellMotifElements = (motif) => {
    if (motif === 'flowers') {
      return (
        <>
          <span className="theme-shell-flower shell-flower-a" />
          <span className="theme-shell-flower shell-flower-b" />
          <span className="theme-shell-flower shell-flower-c" />
        </>
      );
    }

    if (motif === 'leaves') {
      return (
        <>
          <span className="theme-shell-leaf shell-leaf-a" />
          <span className="theme-shell-leaf shell-leaf-b" />
          <span className="theme-shell-leaf shell-leaf-c" />
          <span className="theme-shell-leaf shell-leaf-d" />
        </>
      );
    }

    if (motif === 'petals') {
      return (
        <>
          <span className="theme-shell-petal shell-petal-a" />
          <span className="theme-shell-petal shell-petal-b" />
          <span className="theme-shell-petal shell-petal-c" />
          <span className="theme-shell-petal shell-petal-d" />
        </>
      );
    }

    if (motif === 'snow') {
      return (
        <>
          <span className="theme-shell-snowflake shell-snow-a" />
          <span className="theme-shell-snowflake shell-snow-b" />
          <span className="theme-shell-snowflake shell-snow-c" />
        </>
      );
    }

    if (motif === 'embers') {
      return (
        <>
          <span className="theme-shell-ember shell-ember-a" />
          <span className="theme-shell-ember shell-ember-b" />
          <span className="theme-shell-ember shell-ember-c" />
          <span className="theme-shell-ember shell-ember-d" />
        </>
      );
    }

    return (
      <>
        <span className="theme-shell-ribbon shell-ribbon-a" />
        <span className="theme-shell-ribbon shell-ribbon-b" />
      </>
    );
  };

  return (
    <div className={shellClasses} role="main" aria-label="BRIKX Game">
      {shellVisual?.animated && (
        <div className="theme-shell-overlay" aria-hidden="true">
          <div className="theme-shell-gradient" />
          <div className="theme-shell-pattern" />
          <span className="theme-shell-orb shell-orb-a" />
          <span className="theme-shell-orb shell-orb-b" />
          <span className="theme-shell-mote shell-mote-a" />
          <span className="theme-shell-mote shell-mote-b" />
          {renderShellMotifElements(shellVisual?.motif)}
        </div>
      )}

      {/* Splash Screen */}
      {showSplash && (
        <div 
          className="splash-screen" 
          onClick={() => setShowSplash(false)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowSplash(false); }}
          aria-label="Click to skip splash screen"
        >
          <div className="splash-content">
            <img 
              src={`${process.env.PUBLIC_URL}/nebulamedia.png`} 
              alt="Nebula Media" 
              className="splash-logo"
            />
            <div className="splash-text">Click to continue</div>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {showOfflineBanner && (
        <div className="offline-banner" role="alert" aria-live="polite">
          <span>📡 Offline Mode - Scores will sync when online</span>
          <button 
            onClick={() => setShowOfflineBanner(false)}
            aria-label="Dismiss offline notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Update Available Banner */}
      {showUpdateBanner && (
        <div className="update-banner" role="alert" aria-live="polite">
          <span>🎉 New version available!</span>
          <button 
            className="update-btn"
            onClick={activateUpdate}
            aria-label="Update app now"
          >
            Update Now
          </button>
          <button 
            onClick={() => setShowUpdateBanner(false)}
            aria-label="Dismiss update notification"
          >
            Later
          </button>
        </div>
      )}

      {/* Daily Challenge Banner */}
      {dailyChallenge && showDailyChallenge && !dailyChallenge.completed && !gameStarted && (
        <div className="daily-challenge-banner" role="complementary" aria-label="Daily challenge">
          <div className="challenge-content">
            <span className="challenge-icon">{dailyChallenge.icon}</span>
            <div className="challenge-info">
              <div className="challenge-title">Daily Challenge</div>
              <div className="challenge-description">{dailyChallenge.description}</div>
              <div className="challenge-reward">Reward: {dailyChallenge.reward} points</div>
            </div>
            <button 
              className="challenge-close" 
              onClick={() => setShowDailyChallenge(false)}
              aria-label="Dismiss daily challenge"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Install Prompt */}
      {canInstall && !isAppInstalled && !gameStarted && (
        <div className="install-prompt" role="complementary" aria-label="Install app prompt">
          <div className="install-content">
            <span className="install-icon">📱</span>
            <div className="install-text">
              <strong>Install BRIKX</strong>
              <p>Play offline & get daily challenges!</p>
            </div>
            <button 
              className="install-button" 
              onClick={handleInstall}
              aria-label="Install BRIKX app"
            >
              Install
            </button>
            <button 
              className="install-dismiss" 
              onClick={() => setCanInstall(false)}
              aria-label="Dismiss install prompt"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {gameStarted && (
        <div className="game-header" role="region" aria-label="Game statistics">
          <div className="stats-container">
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-info">
              <div className="stat-label">SCORE</div>
              <div className="stat-value score-animate">{score.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-label">LEVEL</div>
              <div className="stat-value">{level}</div>
              <div className="level-progress">
                <div className="level-progress-bar" style={{width: `${((lines % 10) / 10) * 100}%`}}></div>
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📏</div>
            <div className="stat-info">
              <div className="stat-label">{gameMode === 'sprint' ? 'REMAINING' : 'LINES'}</div>
              <div className="stat-value">{gameMode === 'sprint' ? sprintLinesRemaining : lines}</div>
            </div>
          </div>
          
          {gameMode === 'sprint' && startTime && (
            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-info">
                <div className="stat-label">TIME</div>
                <div className="stat-value">
                  {Math.floor((Date.now() - startTime) / 60000)}:{String(Math.floor(((Date.now() - startTime) % 60000) / 1000)).padStart(2, '0')}
                </div>
              </div>
            </div>
          )}
          
          {gameMode === 'marathon' && startTime && (
            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-info">
                <div className="stat-label">TIME</div>
                <div className="stat-value">
                  {Math.floor((Date.now() - startTime) / 60000)}:{String(Math.floor(((Date.now() - startTime) % 60000) / 1000)).padStart(2, '0')}
                </div>
              </div>
            </div>
          )}
          
          {combo > 0 && (
            <div className="stat-card combo-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-info">
                <div className="stat-label">COMBO</div>
                <div className="stat-value combo-value">{combo}x</div>
              </div>
            </div>
          )}
          
          <div className="stat-card high-score-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-info">
              <div className="stat-label">HIGH SCORE</div>
              <div className="stat-value">{highScore.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {musicEnabled && nowPlayingTrack && (
          <div className="now-playing-hud" role="status" aria-live="polite">
            <span className="now-playing-dot" aria-hidden="true" />
            <span className="now-playing-label">Now Playing:</span>
            <span className="now-playing-track">{nowPlayingTrack}</span>
          </div>
        )}
      </div>
      )}

      <div className={`game-container${!gameStarted && !gameOver ? ' menu-stage' : ''}`}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas"
        />
        
        {!gameStarted && !countdown && (
          <div className={`start-overlay${!gameOver ? ' start-overlay-immersive' : ''}`}>
            {gameOver ? (
              <>
                <div className="game-over-container">
                  <h2 className="game-over-title">💀 GAME OVER 💀</h2>
                  
                  {score === highScore && score > 0 && (
                    <div className="new-record-banner">
                      <span className="record-icon">🎉</span>
                      <span className="record-text">NEW HIGH SCORE!</span>
                      <span className="record-icon">🎉</span>
                    </div>
                  )}
                  
                  <div className="final-score-display">
                    <div className="score-label">FINAL SCORE</div>
                    <div className="score-number">{(score || 0).toLocaleString()}</div>
                  </div>

                  {rankJump && (
                    <div className="rank-jump-banner" role="status" aria-live="polite">
                      <span className="rank-jump-title">🚀 New Personal Best Rank</span>
                      <span className="rank-jump-detail">
                        {rankJump.from ? `#${rankJump.from} → #${rankJump.to}` : `Entered leaderboard at #${rankJump.to}`} • {formatModeLabel(rankJump.mode)}
                      </span>
                    </div>
                  )}
                  
                  <div className="game-over-stats">
                    <div className="stat-item">
                      <span className="stat-icon">🎯</span>
                      <span className="stat-value">{level || 1}</span>
                      <span className="stat-label">Level</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-icon">📊</span>
                      <span className="stat-value">{lines || 0}</span>
                      <span className="stat-label">Lines</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-icon">🏆</span>
                      <span className="stat-value">{(highScore || 0).toLocaleString()}</span>
                      <span className="stat-label">Best</span>
                    </div>
                  </div>

                  {topLeaderboardEntries.length > 0 && (
                    <div className="game-over-leaderboard-preview">
                      <h3 className="mini-leaderboard-title">🥇 Leaderboard</h3>
                      <div className="mini-leaderboard-list">
                        {topLeaderboardEntries.slice(0, 3).map((entry, index) => (
                          <div
                            key={`${entry.date}-${entry.score}-${index}`}
                            className={`mini-leaderboard-item ${entry.name === playerName ? 'is-current-player' : ''}`}
                          >
                            <span className="mini-rank">#{index + 1}</span>
                            <span className="mini-player">{entry.avatar} {entry.name}</span>
                            <span className="mini-score">{entry.score.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="menu-buttons">
                    <button className="menu-btn restart-btn" onClick={startCountdown}>
                      🔄 Play Again
                    </button>
                    <button className="menu-btn" onClick={() => setShowLeaderboard(true)}>
                      🥇 Leaderboard
                    </button>
                    <button className="menu-btn main-menu-btn" onClick={handleMainMenu}>
                      🏠 Main Menu
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={`main-menu immersive ${isMenuIdle ? 'cinematic-idle' : ''}`} ref={menuContainerRef} style={{ '--mx': '50%', '--my': '40%' }}>
                {/* Industry-Quality Animated Particles Background */}
                <div className="menu-background-particles">
                  {menuParticles.map((particle) => {
                    return (
                      <div
                        key={particle.key}
                        className={`particle ${particle.sizeClass} ${particle.colorClass} ${particle.shapeClass} ${particle.motionClass}`}
                        style={{
                          left: particle.left,
                          bottom: `-20px`,
                          '--duration': particle.duration,
                          '--delay': particle.delay,
                          '--drift-x': particle.driftX,
                        }}
                      />
                    );
                  })}
                </div>
                
                {/* Cursor-driven light field */}
                <div className="menu-cursor-light" aria-hidden="true" />

                {/* Volumetric god rays */}
                <div className="menu-god-rays" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`god-ray god-ray-${i}`} />
                  ))}
                </div>

                {/* Animated Falling Tetris Blocks Background */}
                <div className="falling-blocks-container">
                  {menuFallingBlocks.map((block) => {
                    return (
                      <div 
                        key={block.key} 
                        className="falling-block"
                        style={{
                          left: block.left,
                          animationDelay: block.animationDelay,
                          animationDuration: block.animationDuration,
                          opacity: block.opacity
                        }}
                      >
                        <div className="tetris-shape" style={{ color: block.color }}>
                          {block.shape === 'I' && '█\n█\n█\n█'}
                          {block.shape === 'O' && '██\n██'}
                          {block.shape === 'T' && '███\n █'}
                          {block.shape === 'S' && ' ██\n██'}
                          {block.shape === 'Z' && '██\n ██'}
                          {block.shape === 'J' && '█\n█\n██'}
                          {block.shape === 'L' && ' █\n █\n██'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Glass Morphism Center Overlay */}
                <div className="menu-glass-overlay">
                  <div className="menu-center-content">
                    <div className="title-holo-wrap">
                      <img src={`${process.env.PUBLIC_URL}/Brikx-Title.png`} alt="BRICKX" className="immersive-title" />
                    </div>
                    
                    <div className="immersive-player-info">
                      <span className="player-avatar-small">{playerAvatar}</span>
                      <span className="player-name-small">{playerName}</span>
                    </div>
                    
                    <button className="immersive-play-btn" onClick={() => { setShowModeSelect(true); queueMenuClickSound(); }}>
                      <span className="play-text-large">START GAME</span>
                    </button>
                    
                    <div className="immersive-stats">
                      <div className="immersive-stat">
                        <span className="stat-value-immersive">{highScore > 0 ? highScore.toLocaleString() : '0'}</span>
                        <span className="stat-label-immersive">HIGH SCORE</span>
                      </div>
                      {gamepadConnected && (
                        <div className="immersive-stat gamepad-status">
                          <span className="stat-icon-immersive">🎮</span>
                          <span className="stat-label-immersive">READY</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="immersive-menu-actions">
                      <button 
                        className="immersive-btn" 
                        onClick={() => { setShowProfile(true); queueMenuClickSound(); }}
                        aria-label="Open player profile"
                      >
                        👤 Profile
                      </button>
                      <button 
                        className="immersive-btn" 
                        onClick={() => {
                          setLeaderboardModeFilter(gameMode || 'classic');
                          setShowLeaderboard(true);
                          queueMenuClickSound();
                        }}
                        aria-label="View leaderboard"
                      >
                        🥇 Leaderboard
                      </button>
                      <button 
                        className="immersive-btn" 
                        onClick={() => { setShowStatistics(true); queueMenuClickSound(); }}
                        aria-label="View game statistics"
                      >
                        📊 Statistics
                      </button>
                      <button 
                        className="immersive-btn" 
                        onClick={() => { setShowAchievements(true); queueMenuClickSound(); }}
                        aria-label="View achievements"
                      >
                        🏆 Achievements
                      </button>
                      <button 
                        className="immersive-btn" 
                        onClick={() => { setShowTutorial(true); queueMenuClickSound(); }}
                        aria-label="How to play tutorial"
                      >
                        📖 Tutorial
                      </button>
                      <button 
                        className="immersive-btn" 
                        onClick={() => { setShowSettings(true); queueMenuClickSound(); }}
                        aria-label="Open settings"
                      >
                        ⚙️ Settings
                      </button>
                    </div>

                    <div className="quick-support-panel" role="group" aria-label="Support and donation links">
                      <div className="quick-support-copy">Support: <a href="mailto:support@nebula3ddev.com" onClick={() => playSound('menuClick', 600, 0.1)}>support@nebula3ddev.com</a></div>
                      <div className="quick-support-links">
                        <a href="https://github.com/ColinNebula" target="_blank" rel="noopener noreferrer" onClick={() => playSound('menuClick', 600, 0.1)}>GitHub</a>
                        <a href="https://ko-fi.com/ColinNebula" target="_blank" rel="noopener noreferrer" onClick={() => playSound('menuClick', 600, 0.1)}>Ko-fi</a>
                        <a href="https://paypal.me/ColinNebula" target="_blank" rel="noopener noreferrer" onClick={() => playSound('menuClick', 600, 0.1)}>PayPal</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {countdown && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
          </div>
        )}

        {levelFlash && (
          <div className="level-flash">
            <div className="level-flash-content">
              <div className="level-flash-title">LEVEL UP!</div>
              <div className="level-flash-number">{levelFlash}</div>
            </div>
          </div>
        )}

        {isPaused && gameStarted && (
          <div className="start-overlay pause-overlay">
            <div className="pause-overlay-fx" aria-hidden="true">
              <span className="pause-orb pause-orb-1" />
              <span className="pause-orb pause-orb-2" />
              <span className="pause-orb pause-orb-3" />
            </div>
            <div className="pause-panel">
              <img src={`${process.env.PUBLIC_URL}/Brikx-Title.png`} alt="BRICKX" className="pause-title" />
              <h2>⏸️ Paused</h2>
              <div className="menu-buttons">
                <button className="menu-btn resume-btn" onClick={() => setIsPaused(false)}>
                  ▶️ Resume
                </button>
                <button className="menu-btn restart-btn" onClick={handleRestartFromPause}>
                  🔄 Restart
                </button>
                <button className="menu-btn main-menu-btn" onClick={handleQuitToMenu}>
                  🏠 Main Menu
                </button>
              </div>
              <div className="pause-support-inline" role="group" aria-label="Support and donation links">
                <a href="mailto:support@nebula3ddev.com" onClick={() => playSound('menuClick', 600, 0.1)}>Support</a>
                <a href="https://github.com/ColinNebula" target="_blank" rel="noopener noreferrer" onClick={() => playSound('menuClick', 600, 0.1)}>GitHub</a>
                <a href="https://ko-fi.com/ColinNebula" target="_blank" rel="noopener noreferrer" onClick={() => playSound('menuClick', 600, 0.1)}>Ko-fi</a>
                <a href="https://paypal.me/ColinNebula" target="_blank" rel="noopener noreferrer" onClick={() => playSound('menuClick', 600, 0.1)}>PayPal</a>
              </div>
              <p style={{marginTop: '20px', fontSize: '0.9rem', color: '#aaa'}}>Press P or ESC to Resume</p>
            </div>
          </div>
        )}
        
        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
              <h2 className="modal-title">⚙️ Settings</h2>
              
              <div className="settings-section">
                <h3 className="settings-heading">🔊 Audio</h3>
                <div className="controls-grid">
                  <div className="control-item" style={{gridColumn: '1 / -1'}}>
                    <button 
                      className={`sound-toggle-btn ${soundEnabled ? 'enabled' : 'disabled'}`}
                      onClick={toggleSound}
                    >
                      <span className="sound-icon">{soundEnabled ? '🔊' : '🔇'}</span>
                      <span className="sound-label">Sound Effects: {soundEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                  {soundEnabled && (
                    <div className="control-item" style={{gridColumn: '1 / -1', marginTop: '8px'}}>
                      <label className="volume-label">SFX Volume: {Math.round(sfxVolume * 100)}%</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sfxVolume * 100}
                        onChange={(e) => {
                          const newVolume = parseFloat(e.target.value) / 100;
                          setSfxVolume(newVolume);
                          safeSetItem('brickxSfxVolume', newVolume.toString());
                          playSound('menuClick', 600, 0.1);
                        }}
                        className="volume-slider"
                      />
                    </div>
                  )}
                  <div className="control-item" style={{gridColumn: '1 / -1', marginTop: '12px'}}>
                    <button 
                      className={`sound-toggle-btn ${musicEnabled ? 'enabled' : 'disabled'}`}
                      onClick={toggleMusic}
                    >
                      <span className="sound-icon">{musicEnabled ? '🎵' : '🔇'}</span>
                      <span className="sound-label">Background Music: {musicEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                  {musicEnabled && (
                    <div className="control-item" style={{gridColumn: '1 / -1', marginTop: '8px'}}>
                      <label className="volume-label">Music Volume: {Math.round(musicVolume * 100)}%</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={musicVolume * 100}
                        onChange={(e) => {
                          const newVolume = parseFloat(e.target.value) / 100;
                          setMusicVolume(newVolume);
                          safeSetItem('brickxMusicVolume', newVolume.toString());
                        }}
                        className="volume-slider"
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="settings-section">
                <h3 className="settings-heading">⌨️ Keyboard Controls</h3>
                <div className="controls-grid">
                  <div className="control-item">
                    <div className="control-keys">
                      <span className="key small">←</span>
                      <span className="key small">→</span>
                    </div>
                    <div className="control-description">Move Left/Right</div>
                  </div>
                  <div className="control-item">
                    <div className="control-keys">
                      <span className="key small">↑</span>
                    </div>
                    <div className="control-description">Rotate Piece</div>
                  </div>
                  <div className="control-item">
                    <div className="control-keys">
                      <span className="key small">↓</span>
                    </div>
                    <div className="control-description">Soft Drop</div>
                  </div>
                  <div className="control-item">
                    <div className="control-keys">
                      <span className="key">SPACE</span>
                    </div>
                    <div className="control-description">Hard Drop</div>
                  </div>
                  <div className="control-item">
                    <div className="control-keys">
                      <span className="key">C</span>
                    </div>
                    <div className="control-description">Hold Piece</div>
                  </div>
                  <div className="control-item">
                    <div className="control-keys">
                      <span className="key">P</span>
                      <span className="key">ESC</span>
                    </div>
                    <div className="control-description">Pause Game</div>
                  </div>
                </div>
              </div>
              
              <div className="settings-section">
                <h3 className="settings-heading">🎮 Gamepad Controls</h3>
                <div className="controls-grid">
                  <div className="control-item">
                    <div className="control-description">🕹️ D-Pad / Left Stick</div>
                    <div className="control-label">Move & Rotate</div>
                  </div>
                  <div className="control-item">
                    <div className="control-description">A / ✕ Button</div>
                    <div className="control-label">Hard Drop</div>
                  </div>
                  <div className="control-item">
                    <div className="control-description">B / ○ Button</div>
                    <div className="control-label">Rotate</div>
                  </div>
                  <div className="control-item">
                    <div className="control-description">Start Button</div>
                    <div className="control-label">Pause</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {showTutorial && (
          <div className="modal-overlay" onClick={() => setShowTutorial(false)}>
            <div className="modal-content tutorial-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowTutorial(false)}>×</button>
              <h2 className="modal-title">📖 How to Play</h2>
              
              <div className="tutorial-section">
                <div className="tutorial-card">
                  <div className="tutorial-icon">🎮</div>
                  <h3 className="tutorial-heading">Modern Controls</h3>
                  <p className="tutorial-text">
                    Full keyboard and gamepad support. Use arrow keys to move pieces, rotate with up arrow, 
                    and hard drop with SPACE. Hold pieces with C key for strategic play.
                  </p>
                </div>
                
                <div className="tutorial-card">
                  <div className="tutorial-icon">🎨</div>
                  <h3 className="tutorial-heading">Color Match Bonus</h3>
                  <p className="tutorial-text">
                    Match 3 or more blocks of the same color in a cleared line to earn <strong>50 points per block</strong>. 
                    Clear a full line with all the same color for a massive <strong>+500 bonus</strong>!
                  </p>
                </div>
                
                <div className="tutorial-card">
                  <div className="tutorial-icon">🔥</div>
                  <h3 className="tutorial-heading">Combo System</h3>
                  <p className="tutorial-text">
                    Clear lines consecutively to build combos! Each combo multiplies your score by <strong>combo × 50 × level</strong>. 
                    The combo counter resets when you don't clear any lines.
                  </p>
                </div>
                
                <div className="tutorial-card">
                  <div className="tutorial-icon">⚡</div>
                  <h3 className="tutorial-heading">Particle Effects</h3>
                  <p className="tutorial-text">
                    Enjoy stunning visual feedback with particle systems! Regular clears spawn particles, 
                    combo clears add glow effects, and perfect clears create spectacular explosions with trails.
                  </p>
                </div>
                
                <div className="tutorial-card">
                  <div className="tutorial-icon">💎</div>
                  <h3 className="tutorial-heading">Hold Piece</h3>
                  <p className="tutorial-text">
                    Press C to hold the current piece for later use. You can only hold once per piece drop, 
                    so use it strategically to save pieces for the perfect moment!
                  </p>
                </div>
                
                <div className="tutorial-card">
                  <div className="tutorial-icon">🌟</div>
                  <h3 className="tutorial-heading">Perfect Clear</h3>
                  <p className="tutorial-text">
                    Clear the entire board for a <strong>3000 point perfect clear bonus</strong>! 
                    This is the ultimate achievement requiring precise planning and execution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Profile Modal */}
        {showProfile && (
          <div className="modal-overlay" onClick={() => setShowProfile(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowProfile(false)}>×</button>
              <h2 className="modal-title">👤 Player Profile</h2>
              
              <div className="profile-section">
                <h3 className="settings-heading">Display Name</h3>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                  onBlur={() => saveProfile(playerName, playerAvatar)}
                  className="profile-input"
                  maxLength={15}
                  placeholder="Enter your name"
                />
              </div>
              
              <div className="profile-section">
                <h3 className="settings-heading">Choose Avatar ({unlockedAvatars.length}/{allAvatars.length} Unlocked)</h3>
                <div className="avatar-grid">
                  {allAvatars.map((avatar) => {
                    const config = avatarsList[avatar];
                    const isUnlocked = unlockedAvatars.includes(avatar);
                    const achievementName = config.achievement ? achievementsList[config.achievement]?.name : null;
                    
                    return (
                      <button
                        key={avatar}
                        className={`avatar-option ${playerAvatar === avatar ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`}
                        onClick={() => {
                          if (isUnlocked) {
                            setPlayerAvatar(avatar);
                            saveProfile(playerName, avatar);
                            playSound('menuClick', 600, 0.1);
                          }
                        }}
                        title={!isUnlocked && achievementName ? `Unlock with: ${achievementName}` : ''}
                        disabled={!isUnlocked}
                      >
                        {avatar}
                        {!isUnlocked && <div className="avatar-lock">🔒</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <button 
                className="save-profile-btn"
                onClick={() => {
                  saveProfile(playerName, playerAvatar);
                  setShowProfile(false);
                  playSound('menuClick', 600, 0.1);
                }}
              >
                💾 Save Profile
              </button>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowSettings(false)} aria-label="Close settings">×</button>
              <h2 className="modal-title">⚙️ Settings</h2>
              
              <div className="settings-section">
                <h3 className="settings-heading">Audio</h3>
                <div className="setting-item">
                  <label htmlFor="sound-toggle" className="setting-label">Sound Effects</label>
                  <button 
                    id="sound-toggle"
                    className={`toggle-button ${soundEnabled ? 'active' : ''}`}
                    onClick={() => {
                      setSoundEnabled(!soundEnabled);
                      safeSetItem('brickxSoundEnabled', (!soundEnabled).toString());
                    }}
                    aria-pressed={soundEnabled}
                    aria-label="Toggle sound effects"
                  >
                    <span className="toggle-icon">{soundEnabled ? '🔊' : '🔇'}</span>
                    <span className="toggle-text">{soundEnabled ? 'On' : 'Off'}</span>
                  </button>
                </div>
              </div>
              
              <div className="settings-section">
                <h3 className="settings-heading">Notifications</h3>
                <div className="setting-item">
                  <label htmlFor="notification-toggle" className="setting-label">
                    Push Notifications
                    <span className="setting-description">Get daily challenges & reminders</span>
                  </label>
                  <button 
                    id="notification-toggle"
                    className={`toggle-button ${notificationsEnabled ? 'active' : ''}`}
                    onClick={handleNotificationToggle}
                    aria-pressed={notificationsEnabled}
                    aria-label="Toggle push notifications"
                  >
                    <span className="toggle-icon">{notificationsEnabled ? '🔔' : '🔕'}</span>
                    <span className="toggle-text">{notificationsEnabled ? 'On' : 'Off'}</span>
                  </button>
                </div>
              </div>

              {!isAppInstalled && canInstall && (
                <div className="settings-section">
                  <h3 className="settings-heading">Progressive Web App</h3>
                  <div className="setting-item">
                    <div className="setting-label">
                      Install BRIKX
                      <span className="setting-description">Play offline & get a better experience</span>
                    </div>
                    <button 
                      className="install-settings-btn"
                      onClick={handleInstall}
                      aria-label="Install BRIKX as app"
                    >
                      📱 Install App
                    </button>
                  </div>
                </div>
              )}

              <div className="settings-section">
                <h3 className="settings-heading">Themes</h3>
                <div className="setting-item">
                  <div className="setting-label">
                    Color Scheme
                    <span className="setting-description">
                      {THEME_DEFINITIONS[currentTheme]?.name || 'Dark Mode'} • 
                      {Object.values(unlockedThemes).filter(u => u).length}/{Object.keys(THEME_DEFINITIONS).length} unlocked
                    </span>
                  </div>
                  <button 
                    className="install-settings-btn"
                    onClick={() => {
                      setShowSettings(false);
                      setShowThemeSelector(true);
                    }}
                    aria-label="Open theme selector"
                  >
                    🎨 Change Theme
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h3 className="settings-heading">Accessibility</h3>
                <div className="setting-info">
                  <div className="setting-item" style={{ marginBottom: '12px' }}>
                    <label htmlFor="battery-saver-mode-auto" className="setting-label">
                      Mobile Battery Saver
                      <span className="setting-description">Off / Auto / On. Auto keeps full effects on high-end phones unless Save-Data is enabled.</span>
                    </label>
                    <div className="mode-segment" role="radiogroup" aria-label="Battery saver mode">
                      {[
                        { id: 'off', label: 'Off', icon: '⚡' },
                        { id: 'auto', label: 'Auto', icon: '🧠' },
                        { id: 'on', label: 'On', icon: '🔋' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          id={`battery-saver-mode-${mode.id}`}
                          className={`mode-segment-btn ${batterySaverMode === mode.id ? 'active' : ''}`}
                          onClick={() => {
                            setBatterySaverMode(mode.id);
                            safeSetItem('brickxBatterySaverMode', mode.id);
                          }}
                          aria-pressed={batterySaverMode === mode.id}
                          aria-label={`Set battery saver mode to ${mode.label}`}
                        >
                          <span className="toggle-icon">{mode.icon}</span>
                          <span className="toggle-text">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p>✓ Full keyboard navigation support</p>
                  <p>✓ Screen reader compatible</p>
                  <p>✓ High contrast visual design</p>
                  <p>✓ Gamepad support</p>
                </div>
              </div>

              <div className="settings-section">
                <h3 className="settings-heading">Support & Donations</h3>
                <div className="setting-info support-section-copy">
                  <p>Need help or have questions about BRIKX? Reach us anytime.</p>
                  <a
                    className="support-email-link"
                    href="mailto:support@nebula3ddev.com"
                    onClick={() => playSound('menuClick', 600, 0.1)}
                  >
                    support@nebula3ddev.com
                  </a>
                  <p>If you enjoy the game, donations help cover server costs and fund better updates.</p>
                </div>
                <div className="support-links-grid" role="group" aria-label="Support and donation links">
                  <a
                    className="support-link-card"
                    href="https://github.com/ColinNebula"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => playSound('menuClick', 600, 0.1)}
                  >
                    <span className="support-link-icon" aria-hidden="true">💻</span>
                    <span className="support-link-title">GitHub</span>
                    <span className="support-link-subtitle">@ColinNebula</span>
                  </a>
                  <a
                    className="support-link-card"
                    href="https://ko-fi.com/ColinNebula"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => playSound('menuClick', 600, 0.1)}
                  >
                    <span className="support-link-icon" aria-hidden="true">☕</span>
                    <span className="support-link-title">Ko-fi</span>
                    <span className="support-link-subtitle">@ColinNebula</span>
                  </a>
                  <a
                    className="support-link-card"
                    href="https://paypal.me/ColinNebula"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => playSound('menuClick', 600, 0.1)}
                  >
                    <span className="support-link-icon" aria-hidden="true">💙</span>
                    <span className="support-link-title">PayPal</span>
                    <span className="support-link-subtitle">@ColinNebula</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Theme Selector */}
        {showThemeSelector && (
          <div className="modal-overlay" onClick={() => setShowThemeSelector(false)}>
            <div className="modal-content themes-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowThemeSelector(false)} aria-label="Close theme selector">×</button>
              <h2 className="modal-title">🎨 Themes</h2>
              <div className="theme-preview-toggle-row">
                <label className="theme-preview-toggle" htmlFor="theme-preview-toggle">
                  <input
                    id="theme-preview-toggle"
                    type="checkbox"
                    checked={themePreviewEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setThemePreviewEnabled(enabled);
                      safeSetItem('brickxThemePreviewEnabled', enabled.toString());
                    }}
                  />
                  <span className={`theme-preview-pill ${themePreviewEnabled ? 'on' : 'off'}`}>
                    {themePreviewEnabled ? 'Live Preview: On' : 'Live Preview: Off'}
                  </span>
                </label>
                <span className="theme-preview-help">Show animated mini previews on each theme card</span>
              </div>
              
              {seasonalThemes.length > 0 && (
                <>
                  <h3 className="theme-category-title">🎉 Seasonal (Limited Time)</h3>
                  <div className="themes-grid">
                    {seasonalThemes.map(theme => {
                      const isUnlocked = unlockedThemes[theme.id];
                      return (
                        <div
                          key={theme.id}
                          className={`theme-card theme-category-${theme.category} theme-id-${theme.id} ${currentTheme === theme.id ? 'selected' : ''} ${isUnlocked ? 'unlocked' : 'locked'}`}
                          onClick={() => {
                            if (isUnlocked) {
                              setCurrentTheme(theme.id);
                              playSound('menuClick', 600, 0.1);
                            }
                          }}
                          style={{
                            '--preview-primary': theme.colors.primary,
                            '--preview-secondary': theme.colors.secondary,
                            '--preview-accent': theme.colors.accent,
                            background: isUnlocked ? `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})` : 'rgba(0, 0, 0, 0.3)',
                            borderColor: isUnlocked ? theme.colors.accent : 'rgba(100, 100, 100, 0.3)'
                          }}
                        >
                          {renderThemeMiniPreview(theme)}
                          <div className="theme-icon" style={{ color: isUnlocked ? theme.colors.accent : '#666' }}>
                            {theme.icon}
                          </div>
                          <div className="theme-name" style={{ color: isUnlocked ? theme.colors.textPrimary : '#888' }}>
                            {theme.name}
                          </div>
                          <div className="theme-description" style={{ color: isUnlocked ? theme.colors.textSecondary : '#666' }}>
                            {theme.description}
                          </div>
                          {theme.visual?.animated && (
                            <div className="theme-feature-tag">Animated {theme.visual.motif || 'effects'}</div>
                          )}
                          {currentTheme === theme.id && <div className="theme-active-badge">✓ Active</div>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <h3 className="theme-category-title">🎭 Base Themes</h3>
              <div className="themes-grid">
                {Object.values(THEME_DEFINITIONS).filter(t => t.category === 'base').map(theme => {
                  return (
                    <div
                      key={theme.id}
                      className={`theme-card theme-category-${theme.category} theme-id-${theme.id} ${currentTheme === theme.id ? 'selected' : ''} unlocked`}
                      onClick={() => {
                        setCurrentTheme(theme.id);
                        playSound('menuClick', 600, 0.1);
                      }}
                      style={{
                        '--preview-primary': theme.colors.primary,
                        '--preview-secondary': theme.colors.secondary,
                        '--preview-accent': theme.colors.accent,
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                        borderColor: theme.colors.accent
                      }}
                    >
                      {renderThemeMiniPreview(theme)}
                      <div className="theme-icon" style={{ color: theme.colors.accent }}>
                        {theme.icon}
                      </div>
                      <div className="theme-name" style={{ color: theme.colors.textPrimary }}>
                        {theme.name}
                      </div>
                      <div className="theme-description" style={{ color: theme.colors.textSecondary }}>
                        {theme.description}
                      </div>
                      {theme.visual?.animated && (
                        <div className="theme-feature-tag">Animated {theme.visual.motif || 'effects'}</div>
                      )}
                      {currentTheme === theme.id && <div className="theme-active-badge">✓ Active</div>}
                    </div>
                  );
                })}
              </div>

              <h3 className="theme-category-title">💎 Premium Themes</h3>
              <div className="themes-grid">
                {Object.values(THEME_DEFINITIONS).filter(t => t.category === 'premium').map(theme => {
                  const isUnlocked = unlockedThemes[theme.id];
                  const progress = getThemeProgress(theme.id, {
                    highScore: highScore,
                    totalLines: statistics.totalLines,
                    bestCombo: statistics.bestCombo,
                    highestLevel: level,
                    totalGames: statistics.totalGames,
                    bestSprintTime: statistics.bestSprintTime
                  });

                  return (
                    <div
                      key={theme.id}
                      className={`theme-card theme-category-${theme.category} theme-id-${theme.id} ${currentTheme === theme.id ? 'selected' : ''} ${isUnlocked ? 'unlocked' : 'locked'}`}
                      onClick={() => {
                        if (isUnlocked) {
                          setCurrentTheme(theme.id);
                          playSound('menuClick', 600, 0.1);
                        }
                      }}
                      style={{
                        '--preview-primary': theme.colors.primary,
                        '--preview-secondary': theme.colors.secondary,
                        '--preview-accent': theme.colors.accent,
                        background: isUnlocked ? `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})` : 'rgba(0, 0, 0, 0.3)',
                        borderColor: isUnlocked ? theme.colors.accent : 'rgba(100, 100, 100, 0.3)'
                      }}
                    >
                      {renderThemeMiniPreview(theme)}
                      <div className="theme-icon" style={{ color: isUnlocked ? theme.colors.accent : '#666' }}>
                        {isUnlocked ? theme.icon : '🔒'}
                      </div>
                      <div className="theme-name" style={{ color: isUnlocked ? theme.colors.textPrimary : '#888' }}>
                        {theme.name}
                      </div>
                      <div className="theme-description" style={{ color: isUnlocked ? theme.colors.textSecondary : '#666' }}>
                        {isUnlocked ? theme.description : theme.unlockCondition?.description || 'Locked'}
                      </div>
                      {theme.visual?.animated && (
                        <div className="theme-feature-tag">Animated {theme.visual.motif || 'effects'}</div>
                      )}
                      {!isUnlocked && (
                        <div className="theme-progress-bar">
                          <div className="theme-progress-fill" style={{ width: `${progress.progress}%` }} />
                        </div>
                      )}
                      {!isUnlocked && progress.current !== undefined && (
                        <div className="theme-progress-text">
                          {progress.current} / {progress.target}
                        </div>
                      )}
                      {currentTheme === theme.id && <div className="theme-active-badge">✓ Active</div>}
                    </div>
                  );
                })}
              </div>

              <h3 className="theme-category-title">🔓 Unlockable Themes</h3>
              <div className="themes-grid">
                {Object.values(THEME_DEFINITIONS).filter(t => t.category === 'unlockable').map(theme => {
                  const isUnlocked = unlockedThemes[theme.id];
                  const progress = getThemeProgress(theme.id, {
                    highScore: highScore,
                    totalLines: statistics.totalLines,
                    bestCombo: statistics.bestCombo,
                    highestLevel: level,
                    totalGames: statistics.totalGames,
                    bestSprintTime: statistics.bestSprintTime
                  });
                  
                  return (
                    <div
                      key={theme.id}
                      className={`theme-card theme-category-${theme.category} theme-id-${theme.id} ${currentTheme === theme.id ? 'selected' : ''} ${isUnlocked ? 'unlocked' : 'locked'}`}
                      onClick={() => {
                        if (isUnlocked) {
                          setCurrentTheme(theme.id);
                          playSound('menuClick', 600, 0.1);
                        }
                      }}
                      style={{
                        '--preview-primary': theme.colors.primary,
                        '--preview-secondary': theme.colors.secondary,
                        '--preview-accent': theme.colors.accent,
                        background: isUnlocked ? `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})` : 'rgba(0, 0, 0, 0.3)',
                        borderColor: isUnlocked ? theme.colors.accent : 'rgba(100, 100, 100, 0.3)'
                      }}
                    >
                      {renderThemeMiniPreview(theme)}
                      <div className="theme-icon" style={{ color: isUnlocked ? theme.colors.accent : '#666' }}>
                        {isUnlocked ? theme.icon : '🔒'}
                      </div>
                      <div className="theme-name" style={{ color: isUnlocked ? theme.colors.textPrimary : '#888' }}>
                        {theme.name}
                      </div>
                      <div className="theme-description" style={{ color: isUnlocked ? theme.colors.textSecondary : '#666' }}>
                        {isUnlocked ? theme.description : theme.unlockCondition?.description || 'Locked'}
                      </div>
                      {theme.visual?.animated && (
                        <div className="theme-feature-tag">Animated {theme.visual.motif || 'effects'}</div>
                      )}
                      {!isUnlocked && (
                        <div className="theme-progress-bar">
                          <div className="theme-progress-fill" style={{ width: `${progress.progress}%` }} />
                        </div>
                      )}
                      {!isUnlocked && progress.current !== undefined && (
                        <div className="theme-progress-text">
                          {progress.current} / {progress.target}
                        </div>
                      )}
                      {currentTheme === theme.id && <div className="theme-active-badge">✓ Active</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* New Theme Unlocked Notification */}
        {newThemeUnlocked && (
          <div className="theme-unlock-notification">
            <div className="theme-unlock-icon">{newThemeUnlocked.icon}</div>
            <div className="theme-unlock-text">
              <div className="theme-unlock-title">🎨 New Theme Unlocked!</div>
              <div className="theme-unlock-name">{newThemeUnlocked.name}</div>
              <div className="theme-unlock-description">{newThemeUnlocked.description}</div>
            </div>
            <button 
              className="theme-unlock-try"
              onClick={() => {
                setCurrentTheme(newThemeUnlocked.id);
                setNewThemeUnlocked(null);
                playSound('menuClick', 600, 0.1);
              }}
            >
              Try Now
            </button>
          </div>
        )}

        {/* Game Mode Select */}
        {showModeSelect && !gameStarted && (
          <div className="modal-overlay" onClick={() => setShowModeSelect(false)}>
            <div className="modal-content mode-select-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowModeSelect(false)}>×</button>
              <h2 className="modal-title">🎮 Choose Your Game Mode</h2>

              <p className="mode-select-hint">👆 Select a mode below • The START button stays visible while you scroll 👇</p>

              <div className="mode-select-scroll">
                <div className="modes-grid">
                  <div 
                    className={`mode-card ${gameMode === 'classic' ? 'selected' : ''}`}
                    onClick={() => { setGameMode('classic'); playSound('menuClick', 600, 0.1); }}
                  >
                    <div className="mode-icon">🎮</div>
                    <h3>Classic</h3>
                    <p>Traditional Tetris gameplay. Clear lines and survive as level increases.</p>
                  </div>
                  
                  <div 
                    className={`mode-card ${gameMode === 'sprint' ? 'selected' : ''}`}
                    onClick={() => { setGameMode('sprint'); playSound('menuClick', 600, 0.1); }}
                  >
                    <div className="mode-icon">⚡</div>
                    <h3>Sprint</h3>
                    <p>Clear 40 lines as fast as possible. Race against the clock!</p>
                  </div>
                  
                  <div 
                    className={`mode-card ${gameMode === 'marathon' ? 'selected' : ''}`}
                    onClick={() => { setGameMode('marathon'); playSound('menuClick', 600, 0.1); }}
                  >
                    <div className="mode-icon">🏃</div>
                    <h3>Marathon</h3>
                    <p>Endurance mode. How high can you score with faster speeds?</p>
                  </div>
                </div>
              </div>

              <div className="mode-select-footer">
                <button 
                  className="start-mode-btn"
                  onClick={() => {
                    setShowModeSelect(false);
                    startCountdown();
                  }}
                >
                  ▶ Start {gameMode.charAt(0).toUpperCase() + gameMode.slice(1)} Mode
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Modal */}
        {showStatistics && (
          <div className="modal-overlay" onClick={() => setShowStatistics(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowStatistics(false)}>×</button>
              <h2 className="modal-title">📊 Statistics</h2>
              
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-icon-large">🎮</div>
                  <div className="stat-value-large">{statistics.totalGames}</div>
                  <div className="stat-label-large">Games Played</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-large">📏</div>
                  <div className="stat-value-large">{statistics.totalLines}</div>
                  <div className="stat-label-large">Total Lines</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-large">🏆</div>
                  <div className="stat-value-large">{statistics.totalScore.toLocaleString()}</div>
                  <div className="stat-label-large">Total Score</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-large">🔥</div>
                  <div className="stat-value-large">{statistics.bestCombo}x</div>
                  <div className="stat-label-large">Best Combo</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-large">🧱</div>
                  <div className="stat-value-large">{statistics.totalPieces.toLocaleString()}</div>
                  <div className="stat-label-large">Pieces Placed</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-large">⚡</div>
                  <div className="stat-value-large">
                    {statistics.bestSprintTime 
                      ? `${Math.floor(statistics.bestSprintTime / 60000)}:${String(Math.floor((statistics.bestSprintTime % 60000) / 1000)).padStart(2, '0')}`
                      : '--:--'}
                  </div>
                  <div className="stat-label-large">Best Sprint</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-large">🏃</div>
                  <div className="stat-value-large">{statistics.longestMarathon.toLocaleString()}</div>
                  <div className="stat-label-large">Best Marathon</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-large">📈</div>
                  <div className="stat-value-large">
                    {statistics.totalGames > 0 ? Math.floor(statistics.totalScore / statistics.totalGames).toLocaleString() : 0}
                  </div>
                  <div className="stat-label-large">Avg Score</div>
                </div>
              </div>
              
              {/* Score History Chart */}
              {statistics.scoreHistory && statistics.scoreHistory.length > 1 && (
                <div className="score-chart-section">
                  <h3 className="chart-title">📈 Score Improvement</h3>
                  <ScoreHistoryChart history={statistics.scoreHistory} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <div className="modal-overlay" onClick={closeLeaderboardModal}>
            <div className="modal-content leaderboard-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={closeLeaderboardModal}>×</button>
              <h2 className="modal-title">🥇 Leaderboard</h2>

              <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard view">
                <button
                  className={`leaderboard-tab ${leaderboardView === 'global' ? 'active' : ''}`}
                  onClick={() => setLeaderboardView('global')}
                  role="tab"
                  aria-selected={leaderboardView === 'global'}
                >
                  🌍 Global
                </button>
                <button
                  className={`leaderboard-tab ${leaderboardView === 'local' ? 'active' : ''}`}
                  onClick={() => setLeaderboardView('local')}
                  role="tab"
                  aria-selected={leaderboardView === 'local'}
                >
                  💻 Local
                </button>
                <button
                  className={`leaderboard-tab ${leaderboardView === 'mode' ? 'active' : ''}`}
                  onClick={() => setLeaderboardView('mode')}
                  role="tab"
                  aria-selected={leaderboardView === 'mode'}
                >
                  By Mode
                </button>
              </div>

              {leaderboardView === 'global' && (
                <div className="leaderboard-scope-tabs" role="tablist" aria-label="Leaderboard time scope">
                  {[
                    { id: 'all', label: 'All Time' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' }
                  ].map((scope) => (
                    <button
                      key={scope.id}
                      className={`leaderboard-scope-tab ${leaderboardScopeFilter === scope.id ? 'active' : ''}`}
                      onClick={() => setLeaderboardScopeFilter(scope.id)}
                      role="tab"
                      aria-selected={leaderboardScopeFilter === scope.id}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              )}

              {leaderboardView === 'mode' && (
                <div className="leaderboard-mode-tabs" role="tablist" aria-label="Leaderboard mode filter">
                  {['classic', 'sprint', 'marathon'].map((mode) => (
                    <button
                      key={mode}
                      className={`leaderboard-mode-tab ${leaderboardModeFilter === mode ? 'active' : ''}`}
                      onClick={() => setLeaderboardModeFilter(mode)}
                      role="tab"
                      aria-selected={leaderboardModeFilter === mode}
                    >
                      {formatModeLabel(mode)}
                    </button>
                  ))}
                </div>
              )}

              {visibleLeaderboardEntries.length === 0 ? (
                <div className="leaderboard-empty">
                  {globalLeaderboardLoading && leaderboardView === 'global' && (
                    <p>📡 Loading global leaderboard...</p>
                  )}
                  {globalLeaderboardError && leaderboardView === 'global' && (
                    <p>⚠️ Could not load global leaderboard. {globalLeaderboardError}</p>
                  )}
                  {!globalLeaderboardLoading && !globalLeaderboardError && leaderboardView === 'global' && (
                    <p>No global {leaderboardScopeFilter} scores yet. Be the first to rank!</p>
                  )}
                  {leaderboardView === 'local' && (
                    <p>No local ranked runs yet. Finish a game to claim the first spot.</p>
                  )}
                  {leaderboardView === 'mode' && (
                    <p>No {formatModeLabel(leaderboardModeFilter)} runs ranked yet.</p>
                  )}
                </div>
              ) : (
                <div className="leaderboard-list" role="list" aria-label="Top leaderboard scores">
                  {visibleLeaderboardEntries.map((entry, index) => (
                    <div
                      key={`${entry.date}-${entry.score}-${index}`}
                      className={`leaderboard-item ${entry.name === playerName ? 'is-current-player' : ''} ${rankJump && entry.name === playerName && index + 1 === rankJump.to ? 'rank-jump-highlight' : ''}`}
                      role="listitem"
                    >
                      <div className="leaderboard-rank">#{index + 1}</div>
                      <div className="leaderboard-player">
                        <span className="leaderboard-avatar" aria-hidden="true">{entry.avatar}</span>
                        <span className="leaderboard-name">{entry.name}</span>
                      </div>
                      <div className="leaderboard-meta">
                        <span>{formatModeLabel(entry.mode)}</span>
                        <span>Lv {entry.level}</span>
                        <span>{entry.lines} lines</span>
                      </div>
                      <div className="leaderboard-score">{entry.score.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="leaderboard-actions">
                {leaderboardView !== 'global' && (
                  <button
                    className="leaderboard-clear-btn"
                    onClick={() => setShowClearLeaderboardConfirm(true)}
                    disabled={leaderboardEntries.length === 0}
                  >
                    🗑️ Clear Leaderboard
                  </button>
                )}
                {leaderboardView === 'global' && playerGlobalRank && (
                  <div className="player-global-rank">
                    <span>🌍 Your {leaderboardScopeFilter === 'all' ? 'All-Time' : leaderboardScopeFilter === 'weekly' ? 'Weekly' : 'Monthly'} Rank: <strong>#{playerGlobalRank}</strong></span>
                  </div>
                )}
              </div>

              {showClearLeaderboardConfirm && (
                <div className="leaderboard-confirm-box" role="alertdialog" aria-label="Confirm clear leaderboard">
                  <p>Clear all saved leaderboard scores? This cannot be undone.</p>
                  <div className="leaderboard-confirm-actions">
                    <button className="leaderboard-cancel-btn" onClick={() => setShowClearLeaderboardConfirm(false)}>
                      Cancel
                    </button>
                    <button className="leaderboard-confirm-btn" onClick={clearLeaderboard}>
                      Yes, Clear
                    </button>
                  </div>
                </div>
              )}

              {showLeaderboardClearedToast && (
                <div className="leaderboard-toast" role="status" aria-live="polite">
                  ✅ Leaderboard cleared successfully
                </div>
              )}
            </div>
          </div>
        )}

        {/* Achievements Modal */}
        {showAchievements && (
          <div className="modal-overlay" onClick={() => setShowAchievements(false)}>
            <div className="modal-content achievements-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowAchievements(false)}>×</button>
              <h2 className="modal-title">🏆 Achievements</h2>
              
              <div className="achievements-grid">
                {Object.keys(achievementsList).map(key => {
                  const achievement = achievementsList[key];
                  const unlocked = achievements[key]?.unlocked;
                  
                  return (
                    <div 
                      key={key}
                      className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}
                    >
                      <div className="achievement-icon">{achievement.icon}</div>
                      <div className="achievement-details">
                        <div className="achievement-name">{achievement.name}</div>
                        <div className="achievement-description">{achievement.description}</div>
                        {achievement.rewards && achievement.rewards.length > 0 && (
                          <div className="achievement-rewards">
                            <span className="rewards-label">Rewards:</span>
                            {achievement.rewards.map((avatar, i) => (
                              <span key={i} className="reward-avatar-small">{avatar}</span>
                            ))}
                          </div>
                        )}
                        {unlocked && achievements[key]?.date && (
                          <div className="achievement-date">
                            Unlocked: {new Date(achievements[key].date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {unlocked && <div className="achievement-checkmark">✓</div>}
                    </div>
                  );
                })}
              </div>
              
              <div className="achievements-progress">
                <div className="progress-text">
                  {Object.values(achievements).filter(a => a.unlocked).length} / {Object.keys(achievementsList).length} Unlocked
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{width: `${(Object.values(achievements).filter(a => a.unlocked).length / Object.keys(achievementsList).length) * 100}%`}}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Achievement Notification */}
        {newAchievement && (
          <div className="achievement-notification">
            <div className="achievement-notif-icon">{newAchievement.icon}</div>
            <div className="achievement-notif-text">
              <div className="achievement-notif-title">Achievement Unlocked!</div>
              <div className="achievement-notif-name">{newAchievement.name}</div>
              {newAchievement.avatarRewards && newAchievement.avatarRewards.length > 0 && (
                <div className="achievement-notif-rewards">
                  <span className="reward-label">New Avatars:</span>
                  {newAchievement.avatarRewards.map((avatar, i) => (
                    <span key={i} className="reward-avatar">{avatar}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Quit Confirmation Dialog */}
      {showQuitConfirm && (
        <div className="modal-overlay confirmation-overlay" onClick={() => setShowQuitConfirm(false)}>
          <div className="modal-content confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title confirmation-title">⚠️ Quit Game?</h2>
            <p className="confirmation-message">
              Your current game progress will be lost. Are you sure you want to return to the main menu?
            </p>
            <div className="confirmation-stats">
              <div className="confirmation-stat">
                <span className="stat-label">Score:</span>
                <span className="stat-value">{score.toLocaleString()}</span>
              </div>
              <div className="confirmation-stat">
                <span className="stat-label">Level:</span>
                <span className="stat-value">{level}</span>
              </div>
              <div className="confirmation-stat">
                <span className="stat-label">Lines:</span>
                <span className="stat-value">{lines}</span>
              </div>
            </div>
            <div className="confirmation-buttons">
              <button 
                className="menu-btn resume-btn confirmation-btn-cancel" 
                onClick={() => {
                  setShowQuitConfirm(false);
                  playSound('menuClick', 600, 0.1);
                }}
              >
                ↩️ Keep Playing
              </button>
              <button 
                className="menu-btn main-menu-btn confirmation-btn-confirm" 
                onClick={() => {
                  playSound('menuClick', 600, 0.1);
                  handleMainMenu();
                }}
              >
                🏠 Quit to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="controls-info">
        <p>
          {gamepadConnected ? '🎮 Gamepad Ready • ' : ''}
          {isMobile ? '📱 Swipe to play • Two-finger tap to pause' : 'Use Arrow Keys to control • SPACE for hard drop • P or ESC to pause'}
        </p>
        <p style={{color: '#f0a000', fontWeight: 'bold', marginTop: '5px'}}>
          ⭐ Color Matching: 3+ blocks = 50pts each • Full line = +500pts bonus!
        </p>
      </div>

      {/* Two-finger pause hint banner (mobile) */}
      {showPauseHint && isMobile && (
        <div className="pause-hint-banner">
          <div className="pause-hint-content">
            <span className="pause-hint-icon">✌️</span>
            <span className="pause-hint-text">Tap with 2 fingers to pause</span>
          </div>
        </div>
      )}

      {/* Mobile Touch Controls - Disabled since gestures work */}
      {false && isMobile && gameStarted && !gameOver && !isPaused && (
        <div className="mobile-controls">
          <div className="mobile-controls-left">
            <div className="touch-dpad">
              <button 
                ref={el => touchButtonsRef.current[2] = el}
                className="touch-btn touch-left"
                aria-label="Move left"
              >
                ◀
              </button>
              <button 
                ref={el => touchButtonsRef.current[3] = el}
                className="touch-btn touch-down"
              >
                ▼
              </button>
              <button 
                ref={el => touchButtonsRef.current[4] = el}
                className="touch-btn touch-right"
              >
                ▶
              </button>
            </div>
            <button 
              ref={el => touchButtonsRef.current[1] = el}
              className="touch-btn touch-rotate"
            >
              ↻
            </button>
          </div>
          <div className="mobile-controls-right">
            <button 
              ref={el => touchButtonsRef.current[5] = el}
              className="touch-btn touch-hold"
            >
              HOLD
            </button>
            <button 
              ref={el => touchButtonsRef.current[6] = el}
              className="touch-btn touch-drop"
            >
              DROP
            </button>
            <button 
              ref={el => touchButtonsRef.current[0] = el}
              className="touch-btn touch-pause"
            >
              ⏸
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Brikx;
