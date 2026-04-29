# 🎯 Quick Start: Get Your Clarity Project ID

## Step 1: Create Clarity Account
1. Go to: **https://clarity.microsoft.com**
2. Click **"Sign up"** (free forever!)
3. Sign in with Microsoft, Google, or Facebook

## Step 2: Create Project
1. Click **"+ Add new project"**
2. Fill in:
   - **Project name**: BRIKX Game
   - **Website URL**: Your current GitHub Pages URL or future Azure URL
3. Click **"Create project"**

## Step 3: Get Your ID
After creating, you'll see your dashboard with:
```
Project ID: abc123xyz456
```
Copy this ID!

## Step 4: Add to Your Site
Open `public/index.html` and find this line:
```javascript
})(window, document, "clarity", "script", "YOUR_CLARITY_PROJECT_ID");
```

Replace `YOUR_CLARITY_PROJECT_ID` with your actual ID:
```javascript
})(window, document, "clarity", "script", "abc123xyz456");
```

## Step 5: Deploy and Verify
```bash
npm run build
npm run deploy  # or push to trigger Azure deployment
```

Visit Clarity dashboard in 5-10 minutes to see your data! 📊

---

## What You'll See:
- 🖱️ **Heatmaps**: Where players click/tap
- 📹 **Recordings**: Watch actual gameplay
- 😤 **Rage Clicks**: Frustration points
- 📊 **Metrics**: Sessions, users, engagement
- 🚪 **Exit Pages**: Where players leave

## Features:
- ✅ 100% FREE (no trial, no limits)
- ✅ GDPR compliant
- ✅ No impact on performance
- ✅ Works with Azure Static Web Apps
- ✅ Real-time data

---

**Need help?** Check out: https://clarity.microsoft.com/help
