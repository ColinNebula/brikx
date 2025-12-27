import React, { useState, useEffect, useRef, useCallback } from 'react';
import './DriftRacer.css';

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
      if (typeof value === 'string' && value.length < 1000) {
        localStorage.setItem(key, value);
        return true;
      }
    } catch (error) {
      console.error('localStorage write error:', error);
    }
    return false;
  };

  const canvasRef = useRef(null);
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
  const [levelFlash, setLevelFlash] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [playerName, setPlayerName] = useState(() => {
    const name = safeGetItem('brickxPlayerName', 'Player');
    return name.slice(0, 15).replace(/[^a-zA-Z0-9\s]/g, '') || 'Player';
  });
  const [playerAvatar, setPlayerAvatar] = useState(() => {
    return safeGetItem('brickxPlayerAvatar', '🎮');
  });
  const [isMobile, setIsMobile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return safeGetItem('brickxSoundEnabled', 'true') !== 'false';
  });

  // Avatar options
  const avatars = [
    '🎮', '👾', '🕹️', '🎯', '⭐', '🔥', '💎', '👑', 
    '🚀', '⚡', '🌟', '💫', '🎪', '🎨', '🎭', '🦄',
    '😎', '🤖', '👻', '🐉', '🦖', '🦁', '🐼', '🐸',
    '🍕', '🍔', '🎂', '🍩', '☕', '🌈', '🎸', '🎵',
    '💀', '🤡', '🥷', '🧙', '🧛', '🦸', '🦹', '👽'
  ];

  // Sound System using Web Audio API
  const audioContext = useRef(null);
  
  useEffect(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);

  const playSound = useCallback((type, frequency = 440, duration = 0.1, volume = 0.3) => {
    if (!soundEnabled || !audioContext.current) return;
    
    const ctx = audioContext.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    switch(type) {
      case 'move':
        oscillator.frequency.value = 200;
        gainNode.gain.value = 0.05;
        oscillator.type = 'square';
        break;
      case 'rotate':
        oscillator.frequency.value = 300;
        gainNode.gain.value = 0.08;
        oscillator.type = 'sine';
        break;
      case 'drop':
        oscillator.frequency.value = 100;
        gainNode.gain.value = 0.2;
        oscillator.type = 'triangle';
        break;
      case 'lineClear1':
        oscillator.frequency.value = 400;
        gainNode.gain.value = 0.15;
        oscillator.type = 'sine';
        break;
      case 'lineClear2':
        oscillator.frequency.value = 500;
        gainNode.gain.value = 0.18;
        oscillator.type = 'sine';
        break;
      case 'lineClear3':
        oscillator.frequency.value = 600;
        gainNode.gain.value = 0.2;
        oscillator.type = 'sine';
        break;
      case 'tetris':
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.25;
        oscillator.type = 'square';
        break;
      case 'levelUp':
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.2;
        oscillator.type = 'sine';
        break;
      case 'combo':
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        oscillator.type = 'sine';
        break;
      case 'perfectClear':
        oscillator.frequency.value = 1200;
        gainNode.gain.value = 0.3;
        oscillator.type = 'square';
        break;
      case 'gameOver':
        oscillator.frequency.value = 150;
        gainNode.gain.value = 0.25;
        oscillator.type = 'sawtooth';
        break;
      case 'menuClick':
        oscillator.frequency.value = 600;
        gainNode.gain.value = 0.1;
        oscillator.type = 'sine';
        break;
      default:
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        oscillator.type = 'sine';
    }
    
    oscillator.start(ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    oscillator.stop(ctx.currentTime + duration);
  }, [soundEnabled]);

  const playLineClearSound = useCallback((linesCleared) => {
    if (!soundEnabled) return;
    
    if (linesCleared === 1) {
      playSound('lineClear1', 400, 0.15);
    } else if (linesCleared === 2) {
      playSound('lineClear2', 500, 0.2);
      setTimeout(() => playSound('lineClear2', 600, 0.15), 100);
    } else if (linesCleared === 3) {
      playSound('lineClear3', 600, 0.2);
      setTimeout(() => playSound('lineClear3', 700, 0.15), 80);
      setTimeout(() => playSound('lineClear3', 800, 0.15), 160);
    } else if (linesCleared === 4) {
      // Tetris sound - special fanfare
      playSound('tetris', 800, 0.2);
      setTimeout(() => playSound('tetris', 900, 0.15), 100);
      setTimeout(() => playSound('tetris', 1000, 0.15), 200);
      setTimeout(() => playSound('tetris', 1200, 0.3), 300);
    }
  }, [soundEnabled, playSound]);

  const playComboSound = useCallback((comboCount) => {
    if (!soundEnabled) return;
    const baseFreq = 600;
    const freq = baseFreq + (comboCount * 100);
    playSound('combo', freq, 0.15, Math.min(0.3, 0.15 + comboCount * 0.02));
  }, [soundEnabled, playSound]);

  const playPerfectClearSound = useCallback(() => {
    if (!soundEnabled) return;
    playSound('perfectClear', 1200, 0.2);
    setTimeout(() => playSound('perfectClear', 1400, 0.2), 150);
    setTimeout(() => playSound('perfectClear', 1600, 0.2), 300);
    setTimeout(() => playSound('perfectClear', 2000, 0.4), 450);
  }, [soundEnabled, playSound]);

  const playLevelUpSound = useCallback(() => {
    if (!soundEnabled) return;
    playSound('levelUp', 880, 0.2);
    setTimeout(() => playSound('levelUp', 1047, 0.2), 150);
    setTimeout(() => playSound('levelUp', 1319, 0.3), 300);
  }, [soundEnabled, playSound]);

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

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save profile changes
  const saveProfile = useCallback((name, avatar) => {
    // Sanitize inputs
    const sanitizedName = name.slice(0, 15).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Player';
    const sanitizedAvatar = avatars.includes(avatar) ? avatar : '🎮';
    
    setPlayerName(sanitizedName);
    setPlayerAvatar(sanitizedAvatar);
    safeSetItem('brickxPlayerName', sanitizedName);
    safeSetItem('brickxPlayerAvatar', sanitizedAvatar);
  }, []);

  // Game constants
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30;
  const BOARD_WIDTH = COLS * BLOCK_SIZE;
  const BOARD_HEIGHT = ROWS * BLOCK_SIZE;
  const CANVAS_WIDTH = BOARD_WIDTH + 260; // Add space for hold (130) and next (130) panels
  const CANVAS_HEIGHT = BOARD_HEIGHT;

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
    colorBonusDisplay: null,
    bag: [],
    particles: [],
    clearingLines: [],
    clearAnimation: 0,
    scorePopups: [],
    screenShake: 0,
    gridAnimation: 0,
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
  }, []);

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
  }, [fillBag]);

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
    gameState.current.scorePopups.push({
      points,
      text,
      x,
      y,
      life: 60,
      maxLife: 60,
      vy: -2
    });
  }, []);

  // Add particles for visual effects
  const addLineParticles = useCallback((y, isCombo = false, isPerfect = false) => {
    const boardOffsetX = 130;
    const baseParticleCount = isPerfect ? 12 : isCombo ? 8 : 6;
    const particleTypes = ['circle', 'star', 'square', 'spark', 'diamond', 'ring'];
    
    for (let x = 0; x < COLS; x++) {
      const blockColor = gameState.current.board[y][x];
      const centerX = boardOffsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2;
      const centerY = y * BLOCK_SIZE + BLOCK_SIZE / 2;
      
      // Create circular explosion with multiple rings
      const rings = isPerfect ? 3 : isCombo ? 2 : 1;
      
      for (let ring = 0; ring < rings; ring++) {
        const particlesInRing = baseParticleCount + ring * 4;
        const ringSpeed = (isPerfect ? 5 : isCombo ? 3.5 : 2.5) * (1 + ring * 0.5);
        const ringDelay = ring * 5;
        
        for (let i = 0; i < particlesInRing; i++) {
          const angle = (Math.PI * 2 * i) / particlesInRing + (ring * Math.PI / particlesInRing);
          const speed = ringSpeed + Math.random() * 2;
          const size = (isPerfect ? 5 : isCombo ? 4 : 3) + Math.random() * 2 - ring * 0.5;
          
          gameState.current.particles.push({
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
            ring: ring
          });
        }
        
        // Add expanding ring wave effect
        if (isPerfect || isCombo) {
          gameState.current.particles.push({
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
            waveSpeed: 4 + ring * 2
          });
        }
      }
      
      // Add burst of small particles in random directions
      if (isPerfect) {
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 6;
          gameState.current.particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 60 + Math.random() * 40,
            maxLife: 100,
            color: Math.random() > 0.5 ? '#ffffff' : blockColor,
            size: 1 + Math.random() * 2,
            type: Math.random() > 0.5 ? 'circle' : 'star',
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.4,
            glow: true,
            trail: true,
            pulse: true,
            ring: 0
          });
        }
      }
      
      // Add extra sparkle particles for special effects
      if (isPerfect || isCombo) {
        for (let i = 0; i < (isPerfect ? 5 : 3); i++) {
          gameState.current.particles.push({
            x: centerX + (Math.random() - 0.5) * 20,
            y: centerY + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 3,
            vy: -3 - Math.random() * 4,
            life: 70,
            maxLife: 70,
            color: '#ffffff',
            size: 2 + Math.random() * 2,
            type: 'star',
            rotation: 0,
            rotationSpeed: 0.4,
            glow: true,
            trail: true,
            pulse: true,
            ring: 0
          });
        }
      }
    }
  }, [COLS, BLOCK_SIZE]);

  // Clear completed lines with animation
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
      // Check for perfect clear
      const isPerfectClear = board.every(row => row.every(cell => cell === 0));
      const isCombo = combo > 0;
      
      // Play appropriate sound effects
      if (isPerfectClear) {
        playPerfectClearSound();
      } else if (isCombo && combo > 1) {
        playComboSound(combo);
      } else {
        playLineClearSound(linesToClear.length);
      }
      
      // Add particles for line clear effect
      linesToClear.forEach(y => addLineParticles(y, isCombo, isPerfectClear));
      
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
      
      // Combo system
      if (lastClearWasCombo) {
        setCombo(prev => prev + 1);
      } else {
        setCombo(1);
        setLastClearWasCombo(true);
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
        gameState.current.screenShake = 20;
      } else if (isCombo || linesCleared >= 4) {
        gameState.current.screenShake = 12;
      } else if (linesCleared >= 2) {
        gameState.current.screenShake = 6;
      }
      
      // Add score popup
      const popupX = 130 + (COLS * BLOCK_SIZE) / 2;
      const popupY = linesToClear[0] * BLOCK_SIZE + BLOCK_SIZE / 2;
      addScorePopup(totalPoints, isPerfectClear ? 'PERFECT!' : isCombo ? `${combo}x COMBO!` : '', popupX, popupY);
      
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
          text: combo > 0 ? `${combo}x COMBO!` : 'COLOR MATCH!',
          time: 60
        };
      }
      
      // Level up
      const newLevel = Math.floor((lines + linesCleared) / 10) + 1;
      if (newLevel !== level) {
        setLevel(newLevel);
        setLevelFlash(newLevel);
        gameState.current.dropInterval = Math.max(100, 1000 - (newLevel - 1) * 100);
        
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
  }, [level, lines, highScore, combo, lastClearWasCombo, ROWS, COLS, BLOCK_SIZE, addLineParticles, addScorePopup, playLineClearSound, playComboSound, playPerfectClearSound, playLevelUpSound]);

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
    
    if (checkCollision(board, gameState.current.currentPiece, gameState.current.currentX, gameState.current.currentY)) {
      setGameOver(true);
      setGameStarted(false);
      playSound('gameOver', 150, 0.5, 0.25);
    }
  }, [getNextPiece, checkCollision, COLS, playSound]);

  // Move piece down
  const moveDown = useCallback(() => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    
    if (!checkCollision(board, currentPiece, currentX, currentY + 1)) {
      gameState.current.currentY++;
    } else {
      mergePiece();
      clearLines();
      spawnPiece();
    }
  }, [checkCollision, mergePiece, clearLines, spawnPiece]);

  // Move piece horizontally
  const moveHorizontal = useCallback((dir) => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    const newX = currentX + dir;
    
    if (!checkCollision(board, currentPiece, newX, currentY)) {
      gameState.current.currentX = newX;
      playSound('move', 200, 0.05);
    }
  }, [checkCollision, playSound]);

  // Rotate current piece
  const rotate = useCallback(() => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    const rotated = rotatePiece(currentPiece);
    
    if (!checkCollision(board, rotated, currentX, currentY)) {
      gameState.current.currentPiece = rotated;
      playSound('rotate', 300, 0.08);
    }
  }, [checkCollision, rotatePiece, playSound]);

  // Hold piece
  const holdCurrentPiece = useCallback(() => {
    if (!gameState.current.canHold) return;
    
    const { currentPiece, holdPiece, board } = gameState.current;
    
    playSound('rotate', 350, 0.1);
    
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
      setGameOver(true);
      setGameStarted(false);
    }
  }, [getNextPiece, checkCollision, COLS, playSound]);

  // Hard drop
  const hardDrop = useCallback(() => {
    const { board, currentPiece, currentX, currentY } = gameState.current;
    let dropDistance = 0;
    
    while (!checkCollision(board, currentPiece, currentX, currentY + dropDistance + 1)) {
      dropDistance++;
    }
    
    gameState.current.currentY += dropDistance;
    setScore(prev => prev + dropDistance * 2);
    playSound('drop', 100, 0.15, 0.2);
    mergePiece();
    clearLines();
    spawnPiece();
  }, [checkCollision, mergePiece, clearLines, spawnPiece, playSound]);

  // Reset game
  const resetGame = useCallback(() => {
    gameState.current.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    gameState.current.currentPiece = null;
    gameState.current.nextPieces = [];
    gameState.current.holdPiece = null;
    gameState.current.canHold = true;
    gameState.current.dropCounter = 0;
    gameState.current.dropInterval = 1000;
    gameState.current.colorBonusDisplay = null;
    gameState.current.bag = [];
    gameState.current.particles = [];
    gameState.current.clearingLines = [];
    gameState.current.clearAnimation = 0;
    
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setLastClearWasCombo(false);
    setGameOver(false);
    setIsPaused(false);
    
    spawnPiece();
  }, [spawnPiece, ROWS, COLS]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(countdownInterval);
          setTimeout(() => {
            setCountdown(null);
            setGameStarted(true);
            resetGame();
          }, 1000); // Show "GO!" for 1 second
          return 'GO';
        }
        return prev - 1;
      });
    }, 1000);
  }, [resetGame]);

  // Main menu handler
  const handleMainMenu = useCallback(() => {
    setGameStarted(false);
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setLastClearWasCombo(false);
    
    gameState.current.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    gameState.current.currentPiece = null;
    gameState.current.nextPieces = [];
    gameState.current.holdPiece = null;
    gameState.current.particles = [];
    gameState.current.clearingLines = [];
    gameState.current.clearAnimation = 0;
  }, [ROWS, COLS]);

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

  // Draw game
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { board, currentPiece, currentX, currentY, holdPiece, nextPieces, clearingLines, clearAnimation, particles, scorePopups, screenShake, gridAnimation } = gameState.current;

    // Update animations
    gameState.current.gridAnimation = (gridAnimation + 1) % 360;
    if (screenShake > 0) {
      gameState.current.screenShake--;
    }

    // Apply screen shake
    ctx.save();
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake * 0.5;
      const shakeY = (Math.random() - 0.5) * screenShake * 0.5;
      ctx.translate(shakeX, shakeY);
    }

    // Clear entire canvas with animated gradient background
    const themeColors = [
      { start: [10, 5, 30], end: [30, 10, 60], accent: [138, 43, 226] }, // Purple (Levels 1-3)
      { start: [5, 20, 40], end: [10, 40, 80], accent: [0, 150, 255] }, // Blue (Levels 4-6)
      { start: [20, 5, 30], end: [40, 10, 60], accent: [255, 0, 128] }, // Magenta (Levels 7-9)
      { start: [0, 25, 30], end: [0, 50, 60], accent: [0, 200, 200] }, // Cyan (Levels 10-12)
      { start: [25, 15, 0], end: [50, 30, 0], accent: [255, 150, 0] }, // Orange (Levels 13+)
    ];
    
    const themeIndex = Math.min(Math.floor((level - 1) / 3), themeColors.length - 1);
    const theme = themeColors[themeIndex];
    const animOffset = gridAnimation * 0.01;
    
    // Animated gradient background
    const gradient = ctx.createLinearGradient(
      0, 
      Math.sin(animOffset) * CANVAS_HEIGHT * 0.3,
      CANVAS_WIDTH,
      CANVAS_HEIGHT + Math.cos(animOffset) * CANVAS_HEIGHT * 0.3
    );
    gradient.addColorStop(0, `rgb(${theme.start[0]}, ${theme.start[1]}, ${theme.start[2]})`);
    gradient.addColorStop(1, `rgb(${theme.end[0]}, ${theme.end[1]}, ${theme.end[2]})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw floating geometric shapes in background
    ctx.save();
    ctx.globalAlpha = 0.1;
    const shapeCount = 8;
    for (let i = 0; i < shapeCount; i++) {
      const shapeAnim = (gridAnimation + i * 60) * 0.02;
      const x = (i * CANVAS_WIDTH / shapeCount + Math.sin(shapeAnim) * 50) % CANVAS_WIDTH;
      const y = ((shapeAnim * 30) % CANVAS_HEIGHT);
      const size = 40 + Math.sin(shapeAnim * 2) * 20;
      const rotation = shapeAnim;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = `rgb(${theme.accent[0]}, ${theme.accent[1]}, ${theme.accent[2]})`;
      ctx.lineWidth = 3;
      
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
    
    // Add level-based overlay glow
    const overlayGradient = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.8
    );
    overlayGradient.addColorStop(0, `rgba(${theme.accent[0]}, ${theme.accent[1]}, ${theme.accent[2]}, 0.05)`);
    overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Set up translation for main board (centered with left panel space)
    const boardOffsetX = 130; // Space for hold piece panel

    // Draw animated grid background
    ctx.save();
    ctx.translate(boardOffsetX, 0);
    ctx.strokeStyle = `rgba(0, 240, 240, ${0.1 + Math.sin(gridAnimation * 0.05) * 0.05})`;
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

    // Draw particles
    particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      const easeAlpha = alpha * alpha; // Ease out
      const pulseAlpha = p.pulse ? 0.5 + Math.sin((1 - alpha) * Math.PI * 4) * 0.5 : 1;
      const finalAlpha = easeAlpha * pulseAlpha;
      
      ctx.save();
      ctx.globalAlpha = finalAlpha;
      
      // Draw enhanced trail effect with multiple segments
      if (p.trail) {
        const trailSegments = 5;
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
      }
      
      ctx.restore();
      
      // Update particle physics
      if (p.type !== 'wave') {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98; // Air resistance
        p.vy += 0.15; // Gravity
      }
      p.rotation += p.rotationSpeed;
      p.life--;
    });
    
    // Remove dead particles
    gameState.current.particles = particles.filter(p => p.life > 0);

    // Update line clear animation
    if (clearAnimation > 0) {
      gameState.current.clearAnimation--;
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
        currentPiece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value) {
              const blockX = (currentX + x) * BLOCK_SIZE;
              const blockY = (ghostY + y) * BLOCK_SIZE;
              const size = BLOCK_SIZE - 2;
              
              // Ghost fill with transparency
              ctx.fillStyle = currentPiece.color + '20';
              ctx.fillRect(blockX + 1, blockY + 1, size, size);
              
              // Ghost border
              ctx.strokeStyle = currentPiece.color + '80';
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.strokeRect(blockX + 1, blockY + 1, size, size);
              ctx.setLineDash([]);
            }
          });
        });
      }
    }

    // Draw score popups
    scorePopups.forEach(popup => {
      const alpha = popup.life / popup.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      
      // Draw points
      const pointsText = `+${popup.points.toLocaleString()}`;
      ctx.strokeText(pointsText, popup.x, popup.y);
      ctx.fillText(pointsText, popup.x, popup.y);
      
      // Draw additional text
      if (popup.text) {
        ctx.font = 'bold 16px Arial';
        ctx.strokeText(popup.text, popup.x, popup.y + 25);
        ctx.fillText(popup.text, popup.x, popup.y + 25);
      }
      
      ctx.restore();
      
      // Update popup
      popup.y += popup.vy;
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

    // Draw next pieces preview (right panel)
    const nextPanelX = boardOffsetX + BOARD_WIDTH + 10;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(nextPanelX, 10, 110, 420);
    ctx.strokeStyle = '#00f0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(nextPanelX, 10, 110, 420);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('NEXT', nextPanelX + 5, 28);
    
    nextPieces.slice(0, 5).forEach((piece, index) => {
      const pieceSize = 18;
      const yOffset = 50 + index * 80;
      const offsetX = nextPanelX + 55 - (piece.shape[0].length * pieceSize) / 2;
      const offsetY = yOffset - (piece.shape.length * pieceSize) / 2;
      
      piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const bx = offsetX + x * pieceSize;
            const by = offsetY + y * pieceSize;
            const bs = pieceSize - 2;
            const baseAlpha = 1 - (index * 0.12);
            
            ctx.globalAlpha = baseAlpha;
            
            // Base color with subtle glow
            ctx.shadowColor = piece.color;
            ctx.shadowBlur = 4;
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
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f0a000';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      
      const comboText = `${combo}x COMBO`;
      const comboX = boardOffsetX + BOARD_WIDTH - 10;
      ctx.strokeText(comboText, comboX, 30);
      ctx.fillText(comboText, comboX, 30);
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
  }, [checkCollision, isPaused, combo, lastClearWasCombo, CANVAS_WIDTH, CANVAS_HEIGHT, BOARD_WIDTH, BOARD_HEIGHT, BLOCK_SIZE, COLS, ROWS]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;

    let animationFrameId;
    
    const gameLoop = (time = 0) => {
      const deltaTime = time - gameState.current.lastTime;
      gameState.current.lastTime = time;
      gameState.current.dropCounter += deltaTime;

      // Handle gamepad input
      handleGamepadInput();

      if (gameState.current.dropCounter > gameState.current.dropInterval) {
        moveDown();
        gameState.current.dropCounter = 0;
      }

      draw();
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [gameStarted, gameOver, isPaused, moveDown, draw, handleGamepadInput]);

  // Draw when paused
  useEffect(() => {
    if (isPaused) {
      draw();
    }
  }, [isPaused, draw]);

  return (
    <div className="drift-racer">
      {gameStarted && (
        <div className="game-header">
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
              <div className="stat-label">LINES</div>
              <div className="stat-value">{lines}</div>
            </div>
          </div>
          
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
      </div>
      )}

      <div className="game-container">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas"
        />
        
        {!gameStarted && !countdown && (
          <div className="start-overlay">
            {gameOver ? (
              <>
                <h2>💀 Game Over!</h2>
                <div className="game-over-stats">
                  <p>Final Score: {score}</p>
                  <p>Level Reached: {level}</p>
                  <p>Lines Cleared: {lines}</p>
                  {score === highScore && score > 0 && (
                    <p className="new-record">🎉 NEW HIGH SCORE! 🎉</p>
                  )}
                </div>
                <div className="menu-buttons">
                  <button className="menu-btn restart-btn" onClick={resetGame}>
                    🔄 Play Again
                  </button>
                  <button className="menu-btn main-menu-btn" onClick={handleMainMenu}>
                    🏠 Main Menu
                  </button>
                </div>
              </>
            ) : (
              <div className="main-menu immersive">
                {/* Animated Falling Tetris Blocks Background */}
                <div className="falling-blocks-container">
                  {Array.from({ length: 15 }).map((_, i) => {
                    const shapes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
                    const colors = ['#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0a000'];
                    const shapeIndex = i % shapes.length;
                    return (
                      <div 
                        key={i} 
                        className="falling-block"
                        style={{
                          left: `${(i * 7 + Math.random() * 5)}%`,
                          animationDelay: `${Math.random() * 5}s`,
                          animationDuration: `${8 + Math.random() * 6}s`,
                          opacity: 0.15 + Math.random() * 0.1
                        }}
                      >
                        <div className="tetris-shape" style={{ color: colors[shapeIndex] }}>
                          {shapes[shapeIndex] === 'I' && '█\n█\n█\n█'}
                          {shapes[shapeIndex] === 'O' && '██\n██'}
                          {shapes[shapeIndex] === 'T' && '███\n █'}
                          {shapes[shapeIndex] === 'S' && ' ██\n██'}
                          {shapes[shapeIndex] === 'Z' && '██\n ██'}
                          {shapes[shapeIndex] === 'J' && '█\n█\n██'}
                          {shapes[shapeIndex] === 'L' && ' █\n █\n██'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Glass Morphism Center Overlay */}
                <div className="menu-glass-overlay">
                  <div className="menu-center-content">
                    <img src={`${process.env.PUBLIC_URL}/Brikx-Title.png`} alt="BRICKX" className="immersive-title" />
                    
                    <div className="immersive-player-info">
                      <span className="player-avatar-small">{playerAvatar}</span>
                      <span className="player-name-small">{playerName}</span>
                    </div>
                    
                    <button className="immersive-play-btn" onClick={() => { playSound('menuClick', 600, 0.1); startCountdown(); }}>
                      <span className="play-icon-large">▶</span>
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
                      <button className="immersive-btn" onClick={() => { playSound('menuClick', 600, 0.1); setShowProfile(true); }}>
                        👤 Profile
                      </button>
                      <button className="immersive-btn" onClick={() => { playSound('menuClick', 600, 0.1); setShowTutorial(true); }}>
                        📖 Tutorial
                      </button>
                      <button className="immersive-btn" onClick={() => { playSound('menuClick', 600, 0.1); setShowSettings(true); }}>
                        ⚙️ Settings
                      </button>
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
          <div className="start-overlay">
            <img src={`${process.env.PUBLIC_URL}/Brikx-Title.png`} alt="BRICKX" className="pause-title" />
            <h2>⏸️ Paused</h2>
            <div className="menu-buttons">
              <button className="menu-btn resume-btn" onClick={() => setIsPaused(false)}>
                ▶️ Resume
              </button>
              <button className="menu-btn main-menu-btn" onClick={handleMainMenu}>
                🏠 Main Menu
              </button>
            </div>
            <p style={{marginTop: '20px', fontSize: '0.9rem', color: '#aaa'}}>Press P or ESC to Resume</p>
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
        
        {showProfile && (
          <div className="modal-overlay" onClick={() => setShowProfile(false)}>
            <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowProfile(false)}>×</button>
              <h2 className="modal-title">Player Profile</h2>
              
              <div className="profile-edit-section">
                <div className="profile-avatar-large">{playerAvatar}</div>
                
                <div className="profile-input-group">
                  <label>Player Name</label>
                  <input 
                    type="text" 
                    className="profile-input"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={15}
                    placeholder="Enter your name"
                  />
                </div>
                
                <div className="profile-input-group">
                  <label>Choose Avatar</label>
                  <div className="avatar-grid">
                    {avatars.map(avatar => (
                      <button
                        key={avatar}
                        className={`avatar-option ${playerAvatar === avatar ? 'selected' : ''}`}
                        onClick={() => setPlayerAvatar(avatar)}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>
                
                <button 
                  className="profile-save-btn"
                  onClick={() => {
                    saveProfile(playerName, playerAvatar);
                    setShowProfile(false);
                  }}
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      {isMobile && gameStarted && !gameOver && (
        <div className="mobile-controls">
          <div className="mobile-controls-left">
            <button 
              className="touch-btn touch-rotate"
              onTouchStart={(e) => {
                e.preventDefault();
                rotate();
              }}
            >
              ↻
            </button>
            <div className="touch-dpad">
              <button 
                className="touch-btn touch-left"
                onTouchStart={(e) => {
                  e.preventDefault();
                  moveHorizontal(-1);
                }}
              >
                ◀
              </button>
              <button 
                className="touch-btn touch-down"
                onTouchStart={(e) => {
                  e.preventDefault();
                  moveDown();
                }}
              >
                ▼
              </button>
              <button 
                className="touch-btn touch-right"
                onTouchStart={(e) => {
                  e.preventDefault();
                  moveHorizontal(1);
                }}
              >
                ▶
              </button>
            </div>
          </div>
          <div className="mobile-controls-right">
            <button 
              className="touch-btn touch-hold"
              onTouchStart={(e) => {
                e.preventDefault();
                holdCurrentPiece();
              }}
            >
              HOLD
            </button>
            <button 
              className="touch-btn touch-drop"
              onTouchStart={(e) => {
                e.preventDefault();
                hardDrop();
              }}
            >
              DROP
            </button>
          </div>
        </div>
      )}

      <div className="controls-info">
        <p>
          {gamepadConnected ? '🎮 Gamepad Ready • ' : ''}
          {isMobile ? '📱 Touch controls enabled' : 'Use Arrow Keys to control • SPACE for hard drop • P or ESC to pause'}
        </p>
        <p style={{color: '#f0a000', fontWeight: 'bold', marginTop: '5px'}}>
          ⭐ Color Matching: 3+ blocks = 50pts each • Full line = +500pts bonus!
        </p>
      </div>
    </div>
  );
};

export default Brikx;
