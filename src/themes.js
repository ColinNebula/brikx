// Theme System for BRIKX
// Defines color schemes, unlock conditions, and seasonal themes

export const THEME_DEFINITIONS = {
  // Base themes - Always available
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    category: 'base',
    unlocked: true,
    icon: '🌙',
    description: 'Classic dark theme with cyan accents',
    visual: {
      motif: 'ribbons',
      pattern: 'wave-grid',
      animated: true
    },
    colors: {
      // Backgrounds
      primary: '#0a0a2e',
      secondary: '#16213e',
      tertiary: '#0f3460',
      
      // Accents - Ultra-vibrant electric cyan
      accent: '#00ffff',
      accentHover: '#33ffff',
      accentGlow: 'rgba(0, 255, 255, 0.9)',
      
      // Text
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.95)',
      textMuted: 'rgba(0, 255, 255, 0.85)',
      
      // UI Elements
      cardBg: 'rgba(0, 255, 255, 0.18)',
      cardBorder: 'rgba(0, 255, 255, 0.6)',
      cardHover: 'rgba(0, 255, 255, 0.35)',
      
      // Status colors - Ultra vibrant
      success: '#00ff99',
      warning: '#ffcc00',
      error: '#ff3366',
      
      // Game elements
      gridLine: 'rgba(0, 255, 255, 0.35)',
      shadow: 'rgba(0, 255, 255, 0.4)'
    }
  },

  light: {
    id: 'light',
    name: 'Light Mode',
    category: 'base',
    unlocked: true,
    icon: '☀️',
    description: 'Bright theme perfect for daytime play',
    visual: {
      motif: 'petals',
      pattern: 'sun-rings',
      animated: true
    },
    colors: {
      primary: '#f0f7ff',
      secondary: '#d9e7f7',
      tertiary: '#c0d9f0',
      
      accent: '#0099ff',
      accentHover: '#0077ff',
      accentGlow: 'rgba(0, 153, 255, 0.65)',
      
      textPrimary: '#0a1929',
      textSecondary: 'rgba(10, 25, 41, 0.9)',
      textMuted: 'rgba(0, 153, 255, 0.8)',
      
      cardBg: 'rgba(255, 255, 255, 0.9)',
      cardBorder: 'rgba(0, 153, 255, 0.5)',
      cardHover: 'rgba(0, 153, 255, 0.25)',
      
      success: '#00dd88',
      warning: '#ffaa00',
      error: '#ff3344',
      
      gridLine: 'rgba(0, 153, 255, 0.3)',
      shadow: 'rgba(0, 136, 255, 0.35)'
    }
  },

  // Unlockable themes - Require achievements
  neon: {
    id: 'neon',
    name: 'Neon Nights',
    category: 'unlockable',
    unlocked: false,
    icon: '💜',
    description: 'Electric purple and pink vibes',
    unlockCondition: {
      type: 'score',
      value: 10000,
      description: 'Score 10,000 points in one game'
    },
    visual: {
      motif: 'ribbons',
      pattern: 'wave-grid',
      animated: true
    },
    colors: {
      primary: '#0d0221',
      secondary: '#1f0e3a',
      tertiary: '#2e1753',
      
      accent: '#ff00ff',
      accentHover: '#ff33ff',
      accentGlow: 'rgba(255, 0, 255, 0.95)',
      
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.98)',
      textMuted: 'rgba(255, 0, 255, 0.85)',
      
      cardBg: 'rgba(255, 0, 255, 0.25)',
      cardBorder: 'rgba(255, 0, 255, 0.7)',
      cardHover: 'rgba(255, 0, 255, 0.4)',
      
      success: '#ff00dd',
      warning: '#ffdd00',
      error: '#ff0066',
      
      gridLine: 'rgba(255, 0, 255, 0.4)',
      shadow: 'rgba(255, 0, 255, 0.6)'
    }
  },

  retro: {
    id: 'retro',
    name: 'Retro Wave',
    category: 'unlockable',
    unlocked: false,
    icon: '🕹️',
    description: '80s arcade nostalgia',
    unlockCondition: {
      type: 'lines',
      value: 100,
      description: 'Clear 100 total lines'
    },
    visual: {
      motif: 'embers',
      pattern: 'diagonal-grid',
      animated: true
    },
    colors: {
      primary: '#1a1a2e',
      secondary: '#16213e',
      tertiary: '#0f3460',
      
      accent: '#ff5577',
      accentHover: '#ff3355',
      accentGlow: 'rgba(255, 71, 87, 0.9)',
      
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.95)',
      textMuted: 'rgba(255, 71, 87, 0.9)',
      
      cardBg: 'rgba(255, 71, 87, 0.22)',
      cardBorder: 'rgba(255, 71, 87, 0.65)',
      cardHover: 'rgba(255, 71, 87, 0.35)',
      
      success: '#00eeff',
      warning: '#ffee00',
      error: '#ff4757',
      
      gridLine: 'rgba(255, 71, 87, 0.35)',
      shadow: 'rgba(255, 71, 87, 0.65)'
    }
  },

  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    category: 'unlockable',
    unlocked: false,
    icon: '🌆',
    description: 'Outrun aesthetic with sunset colors',
    unlockCondition: {
      type: 'combo',
      value: 10,
      description: 'Achieve a 10x combo'
    },
    visual: {
      motif: 'ribbons',
      pattern: 'soft-orbit',
      animated: true
    },
    colors: {
      primary: '#2b0845',
      secondary: '#3d195b',
      tertiary: '#4f2a71',
      
      accent: '#ff7722',
      accentHover: '#ff5500',
      accentGlow: 'rgba(255, 119, 34, 0.85)',
      
      textPrimary: '#ffeeff',
      textSecondary: 'rgba(255, 238, 255, 0.9)',
      textMuted: 'rgba(255, 119, 34, 0.85)',
      
      cardBg: 'rgba(255, 119, 34, 0.22)',
      cardBorder: 'rgba(255, 119, 34, 0.6)',
      cardHover: 'rgba(255, 119, 34, 0.35)',
      
      success: '#00ffaa',
      warning: '#ffff00',
      error: '#ff0077',
      
      gridLine: 'rgba(255, 119, 34, 0.35)',
      shadow: 'rgba(255, 119, 34, 0.6)'
    }
  },

  matrix: {
    id: 'matrix',
    name: 'Matrix',
    category: 'unlockable',
    unlocked: false,
    icon: '🟢',
    description: 'Digital rain green on black',
    unlockCondition: {
      type: 'level',
      value: 10,
      description: 'Reach level 10'
    },
    visual: {
      motif: 'embers',
      pattern: 'circuit',
      animated: true
    },
    colors: {
      primary: '#000000',
      secondary: '#0a0a0a',
      tertiary: '#0f1a0f',
      
      accent: '#00ff55',
      accentHover: '#00ff77',
      accentGlow: 'rgba(0, 255, 85, 0.9)',
      
      textPrimary: '#00ff55',
      textSecondary: 'rgba(0, 255, 85, 0.95)',
      textMuted: 'rgba(0, 255, 85, 0.75)',
      
      cardBg: 'rgba(0, 255, 85, 0.15)',
      cardBorder: 'rgba(0, 255, 85, 0.6)',
      cardHover: 'rgba(0, 255, 85, 0.3)',
      
      success: '#00ff55',
      warning: '#ffff00',
      error: '#ff0066',
      
      gridLine: 'rgba(0, 255, 85, 0.35)',
      shadow: 'rgba(0, 255, 85, 0.6)'
    }
  },

  ocean: {
    id: 'ocean',
    name: 'Ocean Deep',
    category: 'unlockable',
    unlocked: false,
    icon: '🌊',
    description: 'Calm blues and teals',
    unlockCondition: {
      type: 'games',
      value: 50,
      description: 'Play 50 games'
    },
    visual: {
      motif: 'ribbons',
      pattern: 'wave-grid',
      animated: true
    },
    colors: {
      primary: '#001f3f',
      secondary: '#003d5c',
      tertiary: '#005b7f',
      
      accent: '#00eeff',
      accentHover: '#00ddff',
      accentGlow: 'rgba(0, 238, 255, 0.75)',
      
      textPrimary: '#e0f7ff',
      textSecondary: 'rgba(224, 247, 255, 0.9)',
      textMuted: 'rgba(0, 238, 255, 0.8)',
      
      cardBg: 'rgba(0, 238, 255, 0.18)',
      cardBorder: 'rgba(0, 238, 255, 0.55)',
      cardHover: 'rgba(0, 238, 255, 0.3)',
      
      success: '#00ffdd',
      warning: '#ffee00',
      error: '#ff6677',
      
      gridLine: 'rgba(0, 238, 255, 0.3)',
      shadow: 'rgba(0, 238, 255, 0.5)'
    }
  },

  sunset: {
    id: 'sunset',
    name: 'Sunset Blaze',
    category: 'unlockable',
    unlocked: false,
    icon: '🌅',
    description: 'Warm oranges and purples',
    unlockCondition: {
      type: 'sprint',
      value: 120000, // 2 minutes in ms
      description: 'Complete Sprint mode in under 2 minutes'
    },
    visual: {
      motif: 'embers',
      pattern: 'sun-rings',
      animated: true
    },
    colors: {
      primary: '#1a0a0a',
      secondary: '#2d1414',
      tertiary: '#401e1e',
      
      accent: '#ff7744',
      accentHover: '#ff5522',
      accentGlow: 'rgba(255, 119, 68, 0.8)',
      
      textPrimary: '#fff5e1',
      textSecondary: 'rgba(255, 245, 225, 0.9)',
      textMuted: 'rgba(255, 119, 68, 0.85)',
      
      cardBg: 'rgba(255, 119, 68, 0.22)',
      cardBorder: 'rgba(255, 119, 68, 0.6)',
      cardHover: 'rgba(255, 119, 68, 0.35)',
      
      success: '#ffbb00',
      warning: '#ffdd00',
      error: '#ff5566',
      
      gridLine: 'rgba(255, 119, 68, 0.35)',
      shadow: 'rgba(255, 119, 68, 0.6)'
    }
  },

  // Seasonal themes - Auto-unlock during specific periods
  valentine: {
    id: 'valentine',
    name: 'Valentine\'s Day',
    category: 'seasonal',
    unlocked: false,
    icon: '💖',
    description: 'Love is in the air',
    season: {
      startMonth: 2,  // February
      startDay: 1,
      endMonth: 2,
      endDay: 14,
      alwaysUnlockedDuringPeriod: true
    },
    visual: {
      motif: 'petals',
      pattern: 'soft-orbit',
      animated: true
    },
    colors: {
      primary: '#1a0515',
      secondary: '#2d0a25',
      tertiary: '#400f35',
      
      accent: '#ff1493',
      accentHover: '#ff3399',
      accentGlow: 'rgba(255, 20, 147, 0.85)',
      
      textPrimary: '#ffecf5',
      textSecondary: 'rgba(255, 236, 245, 0.9)',
      textMuted: 'rgba(255, 20, 147, 0.85)',
      
      cardBg: 'rgba(255, 20, 147, 0.22)',
      cardBorder: 'rgba(255, 20, 147, 0.6)',
      cardHover: 'rgba(255, 20, 147, 0.35)',
      
      success: '#ff77bb',
      warning: '#ff1493',
      error: '#ff0077',
      
      gridLine: 'rgba(255, 20, 147, 0.35)',
      shadow: 'rgba(255, 20, 147, 0.6)'
    }
  },

  halloween: {
    id: 'halloween',
    name: 'Halloween',
    category: 'seasonal',
    unlocked: false,
    icon: '🎃',
    description: 'Spooky scary skeletons',
    season: {
      startMonth: 10,  // October
      startDay: 15,
      endMonth: 11,    // November
      endDay: 1,
      alwaysUnlockedDuringPeriod: true
    },
    visual: {
      motif: 'embers',
      pattern: 'diagonal-grid',
      animated: true
    },
    colors: {
      primary: '#0a0a0a',
      secondary: '#1a0f00',
      tertiary: '#2a1f0a',
      
      accent: '#ff7722',
      accentHover: '#ff5500',
      accentGlow: 'rgba(255, 119, 34, 0.85)',
      
      textPrimary: '#ffeecc',
      textSecondary: 'rgba(255, 238, 204, 0.9)',
      textMuted: 'rgba(255, 119, 34, 0.85)',
      
      cardBg: 'rgba(255, 119, 34, 0.22)',
      cardBorder: 'rgba(255, 119, 34, 0.6)',
      cardHover: 'rgba(255, 119, 34, 0.35)',
      
      success: '#00ff22',
      warning: '#ffbb00',
      error: '#ff2200',
      
      gridLine: 'rgba(255, 119, 34, 0.35)',
      shadow: 'rgba(255, 119, 34, 0.6)'
    }
  },

  winter: {
    id: 'winter',
    name: 'Winter Holiday',
    category: 'seasonal',
    unlocked: false,
    icon: '❄️',
    description: 'Icy blues and festive vibes',
    season: {
      startMonth: 12,  // December
      startDay: 1,
      endMonth: 1,     // January
      endDay: 7,
      alwaysUnlockedDuringPeriod: true
    },
    visual: {
      motif: 'snow',
      pattern: 'frost-stripes',
      animated: true
    },
    colors: {
      primary: '#0a1520',
      secondary: '#142030',
      tertiary: '#1e2b40',
      
      accent: '#99eeff',
      accentHover: '#77ddff',
      accentGlow: 'rgba(153, 238, 255, 0.75)',
      
      textPrimary: '#f0f8ff',
      textSecondary: 'rgba(240, 248, 255, 0.9)',
      textMuted: 'rgba(153, 238, 255, 0.85)',
      
      cardBg: 'rgba(153, 238, 255, 0.18)',
      cardBorder: 'rgba(153, 238, 255, 0.55)',
      cardHover: 'rgba(153, 238, 255, 0.3)',
      
      success: '#00ffaa',
      warning: '#ffee00',
      error: '#ff5577',
      
      gridLine: 'rgba(153, 238, 255, 0.3)',
      shadow: 'rgba(153, 238, 255, 0.5)'
    }
  },

  summer: {
    id: 'summer',
    name: 'Summer Vibes',
    category: 'seasonal',
    unlocked: false,
    icon: '🏖️',
    description: 'Bright and sunny',
    season: {
      startMonth: 6,   // June
      startDay: 1,
      endMonth: 8,     // August
      endDay: 31,
      alwaysUnlockedDuringPeriod: true
    },
    visual: {
      motif: 'petals',
      pattern: 'sun-rings',
      animated: true
    },
    colors: {
      primary: '#1a2a0a',
      secondary: '#2d4014',
      tertiary: '#40551e',
      
      accent: '#ffee00',
      accentHover: '#ffdd00',
      accentGlow: 'rgba(255, 238, 0, 0.75)',
      
      textPrimary: '#fffde7',
      textSecondary: 'rgba(255, 253, 231, 0.9)',
      textMuted: 'rgba(255, 238, 0, 0.85)',
      
      cardBg: 'rgba(255, 238, 0, 0.18)',
      cardBorder: 'rgba(255, 238, 0, 0.55)',
      cardHover: 'rgba(255, 238, 0, 0.3)',
      
      success: '#00ff99',
      warning: '#ffbb00',
      error: '#ff6677',
      
      gridLine: 'rgba(255, 238, 0, 0.3)',
      shadow: 'rgba(255, 238, 0, 0.5)'
    }
  },

  spring: {
    id: 'spring',
    name: 'Spring Bloom',
    category: 'seasonal',
    unlocked: false,
    icon: '🌸',
    description: 'Petals, flowers, and fresh pastel motion',
    season: {
      startMonth: 3,
      startDay: 1,
      endMonth: 5,
      endDay: 31,
      alwaysUnlockedDuringPeriod: true
    },
    visual: {
      motif: 'flowers',
      pattern: 'soft-orbit',
      animated: true
    },
    colors: {
      primary: '#1b1a2a',
      secondary: '#2a2340',
      tertiary: '#3f2f5b',

      accent: '#ff7fb5',
      accentHover: '#f0629f',
      accentGlow: 'rgba(255, 127, 181, 0.55)',

      textPrimary: '#fff3fa',
      textSecondary: 'rgba(255, 243, 250, 0.85)',
      textMuted: 'rgba(255, 127, 181, 0.72)',

      cardBg: 'rgba(255, 127, 181, 0.16)',
      cardBorder: 'rgba(255, 127, 181, 0.38)',
      cardHover: 'rgba(255, 127, 181, 0.24)',

      success: '#6dffa2',
      warning: '#ffd36b',
      error: '#ff5d7a',

      gridLine: 'rgba(255, 127, 181, 0.24)',
      shadow: 'rgba(255, 127, 181, 0.3)'
    }
  },

  autumn: {
    id: 'autumn',
    name: 'Autumn Drift',
    category: 'seasonal',
    unlocked: false,
    icon: '🍂',
    description: 'Falling leaves and warm harvest tones',
    season: {
      startMonth: 9,
      startDay: 1,
      endMonth: 11,
      endDay: 30,
      alwaysUnlockedDuringPeriod: true
    },
    visual: {
      motif: 'leaves',
      pattern: 'woven',
      animated: true
    },
    colors: {
      primary: '#1b1207',
      secondary: '#2a1d0d',
      tertiary: '#3d2a12',

      accent: '#ff9a3d',
      accentHover: '#f08b2e',
      accentGlow: 'rgba(255, 154, 61, 0.55)',

      textPrimary: '#fff3df',
      textSecondary: 'rgba(255, 243, 223, 0.85)',
      textMuted: 'rgba(255, 154, 61, 0.72)',

      cardBg: 'rgba(255, 154, 61, 0.15)',
      cardBorder: 'rgba(255, 154, 61, 0.37)',
      cardHover: 'rgba(255, 154, 61, 0.25)',

      success: '#99ff99',
      warning: '#ffd166',
      error: '#ff5d4d',

      gridLine: 'rgba(255, 154, 61, 0.22)',
      shadow: 'rgba(255, 154, 61, 0.3)'
    }
  },

  premiumBotanical: {
    id: 'premiumBotanical',
    name: 'Premium Botanical Palace',
    category: 'premium',
    unlocked: false,
    icon: '🌺',
    description: 'Luxury floral motion with layered bloom trails',
    unlockCondition: {
      type: 'score',
      value: 20000,
      description: 'Score 20,000 points in one game'
    },
    visual: {
      motif: 'flowers',
      pattern: 'woven',
      animated: true
    },
    colors: {
      primary: '#120c1f',
      secondary: '#241435',
      tertiary: '#351d4f',

      accent: '#ff6fa8',
      accentHover: '#f05493',
      accentGlow: 'rgba(255, 111, 168, 0.62)',

      textPrimary: '#ffeef7',
      textSecondary: 'rgba(255, 238, 247, 0.88)',
      textMuted: 'rgba(255, 111, 168, 0.75)',

      cardBg: 'rgba(255, 111, 168, 0.18)',
      cardBorder: 'rgba(255, 111, 168, 0.44)',
      cardHover: 'rgba(255, 111, 168, 0.28)',

      success: '#8bffb7',
      warning: '#ffd98a',
      error: '#ff6588',

      gridLine: 'rgba(255, 111, 168, 0.24)',
      shadow: 'rgba(255, 111, 168, 0.32)'
    }
  },

  premiumAurora: {
    id: 'premiumAurora',
    name: 'Premium Aurora Silk',
    category: 'premium',
    unlocked: false,
    icon: '🪄',
    description: 'Flowing ribbon gradients with cinematic patterns',
    unlockCondition: {
      type: 'games',
      value: 120,
      description: 'Play 120 total games'
    },
    visual: {
      motif: 'ribbons',
      pattern: 'wave-grid',
      animated: true
    },
    colors: {
      primary: '#071624',
      secondary: '#10273a',
      tertiary: '#17344f',

      accent: '#60f0ff',
      accentHover: '#43deef',
      accentGlow: 'rgba(96, 240, 255, 0.62)',

      textPrimary: '#e8fcff',
      textSecondary: 'rgba(232, 252, 255, 0.88)',
      textMuted: 'rgba(96, 240, 255, 0.75)',

      cardBg: 'rgba(96, 240, 255, 0.17)',
      cardBorder: 'rgba(96, 240, 255, 0.4)',
      cardHover: 'rgba(96, 240, 255, 0.28)',

      success: '#8bffda',
      warning: '#ffe78a',
      error: '#ff7b9e',

      gridLine: 'rgba(96, 240, 255, 0.22)',
      shadow: 'rgba(96, 240, 255, 0.3)'
    }
  },

  premiumGilded: {
    id: 'premiumGilded',
    name: 'Premium Gilded Circuit',
    category: 'premium',
    unlocked: false,
    icon: '🟨',
    description: 'Gold circuitry pattern with elite motion accents',
    unlockCondition: {
      type: 'combo',
      value: 15,
      description: 'Reach a 15x combo'
    },
    visual: {
      motif: 'embers',
      pattern: 'circuit',
      animated: true
    },
    colors: {
      primary: '#171209',
      secondary: '#241b0f',
      tertiary: '#352814',

      accent: '#ffd46b',
      accentHover: '#f3c148',
      accentGlow: 'rgba(255, 212, 107, 0.62)',

      textPrimary: '#fff5de',
      textSecondary: 'rgba(255, 245, 222, 0.86)',
      textMuted: 'rgba(255, 212, 107, 0.74)',

      cardBg: 'rgba(255, 212, 107, 0.16)',
      cardBorder: 'rgba(255, 212, 107, 0.41)',
      cardHover: 'rgba(255, 212, 107, 0.27)',

      success: '#8effaa',
      warning: '#ffd46b',
      error: '#ff7e60',

      gridLine: 'rgba(255, 212, 107, 0.23)',
      shadow: 'rgba(255, 212, 107, 0.31)'
    }
  }
};

// Check if a theme should be unlocked
export function checkThemeUnlock(themeId, playerStats) {
  const theme = THEME_DEFINITIONS[themeId];
  
  if (!theme || theme.unlocked) {
    return true; // Already unlocked or doesn't exist
  }

  // Base themes are always unlocked
  if (theme.category === 'base') {
    return true;
  }

  // Check seasonal unlock
  if (theme.category === 'seasonal' && theme.season) {
    if (isSeasonActive(theme.season)) {
      return true;
    }
  }

  // Check achievement-based unlock
  if (theme.unlockCondition) {
    const { type, value } = theme.unlockCondition;
    
    switch (type) {
      case 'score':
        return playerStats.highScore >= value;
      case 'lines':
        return playerStats.totalLines >= value;
      case 'combo':
        return playerStats.bestCombo >= value;
      case 'level':
        return playerStats.highestLevel >= value;
      case 'games':
        return playerStats.totalGames >= value;
      case 'sprint':
        return playerStats.bestSprintTime && playerStats.bestSprintTime <= value;
      default:
        return false;
    }
  }

  return false;
}

// Check if current date is within seasonal period
export function isSeasonActive(season) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();

  const { startMonth, startDay, endMonth, endDay } = season;

  // Handle season that wraps around year (e.g., Dec-Jan)
  if (startMonth > endMonth) {
    return (
      (currentMonth === startMonth && currentDay >= startDay) ||
      (currentMonth > startMonth) ||
      (currentMonth < endMonth) ||
      (currentMonth === endMonth && currentDay <= endDay)
    );
  }

  // Handle season within same year
  if (currentMonth === startMonth && currentMonth === endMonth) {
    return currentDay >= startDay && currentDay <= endDay;
  }

  return (
    (currentMonth === startMonth && currentDay >= startDay) ||
    (currentMonth > startMonth && currentMonth < endMonth) ||
    (currentMonth === endMonth && currentDay <= endDay)
  );
}

// Get all unlocked themes for player
export function getUnlockedThemes(playerStats) {
  const unlocked = {};
  
  Object.keys(THEME_DEFINITIONS).forEach(themeId => {
    unlocked[themeId] = checkThemeUnlock(themeId, playerStats);
  });
  
  return unlocked;
}

// Get currently active seasonal themes
export function getActiveSeasonalThemes() {
  const seasonal = [];
  
  Object.values(THEME_DEFINITIONS).forEach(theme => {
    if (theme.category === 'seasonal' && theme.season) {
      if (isSeasonActive(theme.season)) {
        seasonal.push(theme);
      }
    }
  });
  
  return seasonal;
}

// Apply theme to document
export function applyTheme(themeId) {
  const theme = THEME_DEFINITIONS[themeId];
  
  if (!theme) {
    console.warn(`Theme ${themeId} not found`);
    return;
  }

  const root = document.documentElement;
  
  Object.keys(theme.colors).forEach(key => {
    root.style.setProperty(`--color-${key}`, theme.colors[key]);
  });

  // Add data attribute for CSS targeting
  root.setAttribute('data-theme', themeId);

  // Brief flash overlay so the change is visually obvious
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed; inset: 0; z-index: 99999; pointer-events: none;
    background: ${theme.colors.accent};
    opacity: 0.15;
    animation: none;
    transition: opacity 0.5s ease;
  `;
  document.body.appendChild(flash);
  requestAnimationFrame(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 600);
  });

  // Store theme preference
  localStorage.setItem('brikx_theme', themeId);
}

// Get saved theme or default
export function getSavedTheme() {
  const saved = localStorage.getItem('brikx_theme');
  return saved || 'dark';
}

// Calculate unlock progress for theme
export function getThemeProgress(themeId, playerStats) {
  const theme = THEME_DEFINITIONS[themeId];
  
  if (!theme || !theme.unlockCondition) {
    return { progress: 100, unlocked: true };
  }

  const { type, value } = theme.unlockCondition;
  let current = 0;

  switch (type) {
    case 'score':
      current = playerStats.highScore || 0;
      break;
    case 'lines':
      current = playerStats.totalLines || 0;
      break;
    case 'combo':
      current = playerStats.bestCombo || 0;
      break;
    case 'level':
      current = playerStats.highestLevel || 0;
      break;
    case 'games':
      current = playerStats.totalGames || 0;
      break;
    case 'sprint':
      current = playerStats.bestSprintTime || Infinity;
      // For sprint, lower is better, so invert progress
      return {
        progress: current <= value ? 100 : Math.max(0, 100 - ((current - value) / value * 100)),
        unlocked: current <= value,
        current: current,
        target: value
      };
    default:
      break;
  }

  const progress = Math.min(100, (current / value) * 100);
  
  return {
    progress: progress,
    unlocked: current >= value,
    current: current,
    target: value
  };
}
