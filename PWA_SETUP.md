# BrickX - PWA Setup Guide

## 🎮 Progressive Web App Features

BrickX is now a fully functional Progressive Web App (PWA) that can be installed on mobile devices and desktop computers!

### ✨ PWA Features Included:

1. **Offline Support** - Play even without internet connection
2. **Install to Home Screen** - Add BrickX as an app icon
3. **Full Screen Mode** - Immersive gaming experience
4. **Touch Controls** - Optimized mobile gameplay
5. **Service Worker Caching** - Fast loading times
6. **Responsive Design** - Works on all screen sizes

### 📱 How to Install on Mobile:

#### iOS (iPhone/iPad):
1. Open BrickX in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right corner
5. BrickX icon will appear on your home screen!

#### Android (Chrome):
1. Open BrickX in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Tap "Add" or "Install"
5. BrickX icon will appear on your home screen!

### 🖥️ How to Install on Desktop:

#### Chrome/Edge:
1. Open BrickX in browser
2. Look for the install icon (+) in the address bar
3. Click "Install"
4. BrickX will open as a standalone app

#### Firefox:
1. Open BrickX in browser
2. Click the menu (three lines)
3. Click "Install BrickX"
4. Confirm installation

### 🎨 Icon Generation:

To generate custom PWA icons:
1. Open `public/generate-icons.html` in your browser
2. Click the download buttons for 192x192 and 512x512
3. Save as `logo192.png` and `logo512.png`
4. Replace existing placeholder images in the `public` folder

Or use the provided `icon.svg` for custom sizes.

### 📱 Touch Controls:

When playing on mobile, you'll see on-screen controls:

**Left Side:**
- Rotate button (↻) - Rotate piece
- D-Pad - Move left/right/down

**Right Side:**
- HOLD button - Hold current piece
- DROP button - Hard drop piece

### 🔧 Development Notes:

#### Files Modified:
- `public/manifest.json` - PWA metadata
- `public/index.html` - PWA meta tags
- `public/service-worker.js` - Offline caching
- `src/index.js` - Service worker registration
- `src/DriftRacer.js` - Mobile detection & touch controls
- `src/DriftRacer.css` - Mobile responsive styles

#### Service Worker:
The service worker caches essential assets for offline play:
- HTML, JS, CSS files
- Manifest and icons
- Game assets

Cache is automatically updated when new versions are deployed.

### 🚀 Building for Production:

```bash
npm run build
```

The build folder will contain all PWA-optimized files ready for deployment.

### 🌐 Testing PWA Features:

1. **Lighthouse** (Chrome DevTools):
   - Open DevTools (F12)
   - Go to Lighthouse tab
   - Run PWA audit

2. **Local HTTPS Testing**:
   ```bash
   npm install -g serve
   serve -s build -p 5000
   ```
   Visit https://localhost:5000

3. **Mobile Testing**:
   - Use Chrome DevTools Device Mode
   - Or test on actual mobile device

### 📊 PWA Score Checklist:

- ✅ HTTPS (required for PWA)
- ✅ Manifest file with name, icons, theme
- ✅ Service worker for offline functionality
- ✅ Installable prompt
- ✅ Responsive design
- ✅ Fast load time
- ✅ Works offline
- ✅ Mobile-optimized controls

### 🎯 Performance Tips:

1. **Service Worker Updates**: Clear cache when deploying major updates
2. **Icon Optimization**: Use optimized PNG files (compress with tools)
3. **Asset Caching**: Add frequently used assets to cache list
4. **Mobile Performance**: Touch controls use hardware acceleration

### 🐛 Troubleshooting:

**PWA not installing:**
- Ensure HTTPS is enabled (required)
- Check manifest.json is valid
- Verify service worker is registered
- Clear browser cache and try again

**Offline not working:**
- Check service worker is active in DevTools
- Verify assets are cached (Application > Cache Storage)
- Make sure initial load happened online

**Touch controls not showing:**
- Mobile device detection should auto-enable
- Check console for JavaScript errors
- Ensure game is started (controls appear in-game)

### 📝 Customization:

**Change App Name:**
Edit `public/manifest.json`:
```json
{
  "short_name": "YourName",
  "name": "Your Full Game Name"
}
```

**Change Theme Colors:**
Edit `public/manifest.json` and `public/index.html`:
```json
{
  "theme_color": "#your-color",
  "background_color": "#your-color"
}
```

**Add More Assets to Cache:**
Edit `public/service-worker.js` urlsToCache array.

---

## 🎉 Enjoy BrickX on Any Device!

Your Tetris game is now a modern PWA that works seamlessly across all platforms!
