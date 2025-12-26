# 📱 Mobile UI Guide

## Visual Layout Reference

### Desktop View (> 768px)
```
┌────────────────────────────────────────────────────┐
│                    NEBULA TETRIS                   │
├────────────────────────────────────────────────────┤
│  🏆 SCORE   📊 LEVEL   📏 LINES   🔥 COMBO   ⭐ HS │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌────────┐  ┌──────────────┐  ┌────────┐        │
│  │ HOLD   │  │              │  │ NEXT   │        │
│  │  [O]   │  │   GAME       │  │  [I]   │        │
│  │        │  │   CANVAS     │  │  [T]   │        │
│  └────────┘  │              │  │  [S]   │        │
│              │              │  │  [Z]   │        │
│              │              │  │  [J]   │        │
│              └──────────────┘  └────────┘        │
│                                                    │
│  [Keyboard Controls Info]                         │
└────────────────────────────────────────────────────┘
```

---

### Tablet View (481px - 768px)
```
┌──────────────────────────┐
│     NEBULA TETRIS        │
├──────────────────────────┤
│ 🏆   📊   📏   🔥   ⭐   │
├──────────────────────────┤
│                          │
│  ┌──┐ ┌──────┐ ┌──┐     │
│  │H │ │ GAME │ │N │     │
│  │O │ │      │ │X │     │
│  │L │ │      │ │T │     │
│  │D │ │      │ │  │     │
│  └──┘ └──────┘ └──┘     │
│                          │
│  ┌──────────────────┐   │
│  │ [Touch Controls] │   │
│  │  ◀  ▼  ▶   DROP  │   │
│  └──────────────────┘   │
│                          │
└──────────────────────────┘
```

---

### Mobile View - Portrait (< 480px)
```
┌────────────────┐
│   NEBULA TET   │
├────────────────┤
│ 🏆 📊 📏 ⭐    │
├────────────────┤
│                │
│   ┌────────┐   │
│ ┌─┤  GAME  ├─┐ │
│ │H│        │N│ │
│ │O│ Canvas │X│ │
│ │L│  0.5x  │T│ │
│ │D│        │ │ │
│ └─┤        ├─┘ │
│   └────────┘   │
│                │
├────────────────┤
│ TOUCH CONTROLS │
├────────────────┤
│ [↻]     [HOLD] │
│         [DROP] │
│ [◀][▼][▶]     │
└────────────────┘
```

---

## Touch Control Details

### Control Layout (Mobile)

#### Left Side Controls
```
┌──────────────┐
│    [↻]       │  ← Rotate Button (70px × 70px)
│              │
│ ┌──┬──┬──┐  │  ← D-Pad Layout (3×2 grid)
│ │  │  │  │  │
│ ├──┼──┼──┤  │
│ │◀ │▼ │▶ │  │  ← Arrow Buttons (70px each)
│ └──┴──┴──┘  │
└──────────────┘
```

#### Right Side Controls
```
┌──────────────┐
│   [HOLD]     │  ← Hold Button (100px × 70px)
│              │
│   [DROP]     │  ← Drop Button (100px × 70px)
│              │
└──────────────┘
```

---

## Button Specifications

### Mobile Touch Buttons

#### Standard Buttons (Move/Rotate)
- **Size**: 70px × 70px
- **Border**: 2px solid cyan (50% opacity)
- **Background**: Cyan gradient with blur
- **Font Size**: 1.8rem
- **Border Radius**: 15px
- **Active State**: Scale 0.9, brighter glow

#### Rotate Button
- **Size**: 70px × 70px (full width of left column)
- **Icon**: ↻ (circular arrow)
- **Font Size**: 2.5rem
- **Same styling as standard buttons**

#### Hold Button
- **Size**: 100px × 70px
- **Border**: 2px solid orange (50% opacity)
- **Background**: Orange gradient
- **Text**: "HOLD"
- **Font Size**: 1.2rem

#### Drop Button
- **Size**: 100px × 70px
- **Border**: 2px solid magenta (50% opacity)
- **Background**: Magenta gradient
- **Text**: "DROP"
- **Font Size**: 1.2rem

---

## Responsive Breakpoints

### Desktop (> 768px)
- Full size game canvas (560px × 600px)
- No touch controls visible
- Keyboard controls displayed
- Stat cards: 140px min-width
- Font sizes: Standard

### Tablet (481px - 768px)
- Canvas scaled to 0.7x
- Touch controls: 70px buttons
- Stat cards: 110px min-width
- Font sizes: Reduced
- Touch controls visible

### Phone (< 480px)
- Canvas scaled to 0.5x
- Touch controls: 60px buttons
- Stat cards: Horizontal scroll
- Font sizes: Minimized
- Compact layout

---

## Color Schemes by Level

### Purple Theme (Levels 1-3)
```
Background: #1a0a2e → #1e0a3c
Accent: #8a2be2 (Blue Violet)
```

### Blue Theme (Levels 4-6)
```
Background: #051428 → #0a2850
Accent: #0096ff (Deep Sky Blue)
```

### Magenta Theme (Levels 7-9)
```
Background: #14051e → #28143c
Accent: #ff0080 (Hot Pink)
```

### Cyan Theme (Levels 10-12)
```
Background: #00191e → #00323c
Accent: #00c8c8 (Cyan)
```

### Orange Theme (Levels 13+)
```
Background: #190f00 → #321e00
Accent: #ff9600 (Orange)
```

---

## Touch Control Behavior

### Touch Events
- **onTouchStart**: Triggers game action
- **preventDefault()**: Prevents scrolling/zooming
- **Visual Feedback**: Button scales to 0.9x
- **Active Glow**: Enhanced shadow and brightness

### Performance
- Hardware acceleration enabled
- No delay between touch and action
- Smooth transitions (0.1s ease)
- Tap highlight disabled

---

## UI Scaling Examples

### Stats Container

**Desktop:**
```css
font-size: 1.8rem (Score)
min-width: 140px (Cards)
gap: 15px (Between cards)
```

**Mobile:**
```css
font-size: 1rem (Score)
min-width: 80px (Cards)
gap: 5px (Between cards)
```

### Game Canvas

**Desktop:**
```css
transform: scale(1.0)
width: 560px
height: 600px
```

**Tablet:**
```css
transform: scale(0.7)
width: 392px
height: 420px
```

**Phone:**
```css
transform: scale(0.5)
width: 280px
height: 300px
```

---

## Menu Layouts

### Main Menu - Desktop
```
┌─────────────────────────────────────────┐
│  🎮 BRICKX                              │
│  v2.0                                   │
│                                         │
│  [Profile Card]     [▶ START GAME]     │
│  [Stats Showcase]   [Quick Stats]      │
│  [Profile][How][⚙️] [Preview Area]     │
└─────────────────────────────────────────┘
```

### Main Menu - Mobile
```
┌─────────────────────┐
│    🎮 BRICKX        │
│    v2.0             │
│                     │
│  [Profile Card]     │
│  [Stats Showcase]   │
│                     │
│  [▶ START GAME]     │
│                     │
│  [Quick Stats]      │
│  [Preview Area]     │
│                     │
│  [Profile][How][⚙️] │
└─────────────────────┘
```

---

## Installation Screens

### iOS Install Prompt
```
┌─────────────────────────┐
│    Share Button         │
│    │                    │
│    ▼                    │
│ Add to Home Screen      │
│                         │
│ ┌─────────────────────┐ │
│ │  [🎮] BrickX        │ │
│ │  Modern Tetris Game │ │
│ │                     │ │
│ │      [Add]          │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Android Install Banner
```
┌─────────────────────────┐
│ 📱 Install BrickX       │
│ Modern Tetris Game      │
│                         │
│  [Install]  [Cancel]    │
└─────────────────────────┘
```

---

## Glassmorphism Effects

### Touch Buttons
```css
background: linear-gradient(135deg, 
  rgba(0, 240, 240, 0.3),
  rgba(0, 136, 255, 0.3)
);
backdrop-filter: blur(10px);
border: 2px solid rgba(0, 240, 240, 0.5);
box-shadow: 0 4px 15px rgba(0, 240, 240, 0.3);
```

### Menu Cards
```css
background: linear-gradient(135deg,
  rgba(0, 240, 240, 0.1),
  rgba(0, 136, 255, 0.05)
);
backdrop-filter: blur(10px);
border: 2px solid rgba(0, 240, 240, 0.3);
```

---

## Touch Gestures (Future Enhancement Ideas)

### Possible Additions:
- **Swipe Left/Right**: Quick horizontal movement
- **Swipe Down**: Soft drop
- **Swipe Up**: Hard drop
- **Pinch**: Zoom level (accessibility)
- **Double Tap**: Rotate 180°
- **Long Press**: Hold piece

---

## Performance Metrics

### Target Performance:
- **Touch Response**: < 16ms (60fps)
- **Canvas Render**: 30fps game loop
- **Service Worker**: < 200ms cache hit
- **First Paint**: < 2s
- **Time to Interactive**: < 3s
- **Lighthouse PWA**: 90+ score

---

## Accessibility Considerations

### Current:
- ✅ Large touch targets (70px minimum)
- ✅ High contrast colors
- ✅ Clear visual feedback
- ✅ Readable font sizes
- ✅ Works without color (shape recognition)

### Future Enhancements:
- ⭕ Screen reader support
- ⭕ Keyboard navigation in menus
- ⭕ Adjustable game speed
- ⭕ Color blind modes
- ⭕ Haptic feedback

---

**This guide helps visualize the mobile experience of BrickX PWA! 📱🎮**
