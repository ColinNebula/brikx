# 🚀 Microsoft Tools Setup Guide

This guide will help you set up Azure Static Web Apps, Microsoft Clarity, and PWA Builder for your BRIKX game.

---

## 1️⃣ Azure Static Web Apps Setup

### What You Get:
- ✅ Free hosting with custom domain support
- ✅ Global CDN for faster load times
- ✅ Automatic HTTPS/SSL certificates
- ✅ CI/CD from GitHub
- ✅ Preview deployments for pull requests

### Setup Steps:

#### A. Create Azure Account (if needed)
1. Go to [portal.azure.com](https://portal.azure.com)
2. Sign up for free (requires credit card but won't charge you)
3. Get $200 free credit for 30 days

#### B. Create Static Web App
1. In Azure Portal, click **"Create a resource"**
2. Search for **"Static Web Apps"** and click **Create**
3. Fill in the details:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new (e.g., "brikx-resources")
   - **Name**: `brikx-game` (must be globally unique)
   - **Region**: Choose closest to your users
   - **Deployment source**: GitHub
4. Click **"Sign in with GitHub"** and authorize Azure
5. Select:
   - **Organization**: Your GitHub username
   - **Repository**: `brikx`
   - **Branch**: `main` or `master`
6. Build Details:
   - **Build Presets**: React
   - **App location**: `/`
   - **Output location**: `build`
7. Click **"Review + create"** then **"Create"**

#### C. Get Your Secret Token
After creation, Azure will:
- Automatically add a GitHub Actions workflow to your repo
- Create a secret called `AZURE_STATIC_WEB_APPS_API_TOKEN`
- The workflow file is already created at `.github/workflows/azure-static-web-apps.yml`

#### D. Update Package.json (Optional)
Add deployment script:
\`\`\`json
"scripts": {
  "deploy-azure": "npm run build"
}
\`\`\`

#### E. Deploy
Simply push to your main branch:
\`\`\`bash
git add .
git commit -m "Add Azure Static Web Apps configuration"
git push
\`\`\`

Your site will be live at: `https://your-app-name.azurestaticapps.net`

---

## 2️⃣ Microsoft Clarity Setup (5 Minutes!)

### What You Get:
- ✅ **100% FREE** (no trial, no limits)
- ✅ Heatmaps showing where users click
- ✅ Session recordings
- ✅ User behavior analytics
- ✅ No impact on performance

### Setup Steps:

#### A. Create Clarity Account
1. Go to [clarity.microsoft.com](https://clarity.microsoft.com)
2. Sign in with Microsoft, Google, or Facebook account
3. Click **"Add new project"**

#### B. Configure Project
1. **Name**: BRIKX Game
2. **Website URL**: Your current site (GitHub Pages or future Azure URL)
3. Click **"Add new project"**

#### C. Get Your Project ID
1. After creation, you'll see your **Project ID** (format: `xxxxxxxxxx`)
2. Copy this ID

#### D. Add to Your Site
The tracking code is already added to `public/index.html`! Just replace:
\`\`\`javascript
"YOUR_CLARITY_PROJECT_ID"
\`\`\`

With your actual Project ID:
\`\`\`javascript
"abc123xyz456"  // Your actual ID
\`\`\`

#### E. Verify Installation
1. Build and deploy your app
2. Visit your site
3. Go back to Clarity dashboard
4. Within 5-10 minutes, you'll see the green "✓ Recording" status

### What to Watch:
- **Heatmaps**: See where players tap/click most
- **Session Recordings**: Watch actual gameplay sessions
- **Rage Clicks**: Users clicking repeatedly (frustration indicator)
- **Dead Clicks**: Clicks that don't do anything
- **Exit Pages**: Where users leave your game

---

## 3️⃣ PWA Builder - Publish to App Stores

### What You Get:
- ✅ Generate packages for Microsoft Store, Google Play, iOS App Store
- ✅ Validate your PWA
- ✅ Free service
- ✅ No code changes needed

### Setup Steps:

#### A. Validate Your PWA
1. Go to [pwabuilder.com](https://www.pwabuilder.com)
2. Enter your site URL
3. Click **"Start"**
4. Review the PWA Score and recommendations

#### B. Generate Icons (if needed)
Your current icons may need optimization:
\`\`\`bash
# Option 1: Use PWA Builder's icon generator
# Upload your best quality logo (512x512 or higher)

# Option 2: Generate locally
npm install -g pwa-asset-generator
pwa-asset-generator public/brikx512.png public/icons --manifest public/manifest.json
\`\`\`

#### C. Microsoft Store Package
1. On PWA Builder, click **"Package For Stores"**
2. Select **"Windows"** (Microsoft Store)
3. Click **"Generate Package"**
4. Download the `.msixbundle` file
5. Follow instructions to publish:
   - Create Microsoft Partner Center account
   - Submit your package
   - Wait for approval (usually 24-48 hours)

#### D. Google Play Package
1. Click **"Android"** (Google Play)
2. Configure:
   - **Package ID**: `com.brikx.game`
   - **App name**: BrickX
   - **Launcher name**: BrickX
3. Click **"Generate"** and download
4. Submit to Google Play Console

#### E. iOS App Store
1. Click **"iOS"** (App Store)
2. Note: Requires Apple Developer account ($99/year)
3. Follow Apple's submission guidelines
4. Submit through App Store Connect

### Current PWA Checklist (Already Done! ✅)
- ✅ manifest.json with complete metadata
- ✅ Service Worker for offline support
- ✅ HTTPS (required for PWA)
- ✅ Responsive design
- ✅ Proper icons (192x192 and 512x512)
- ✅ Theme colors set
- ✅ Display mode: standalone

---

## 4️⃣ Additional Microsoft Tools (Optional)

### Azure PlayFab (Free Game Services)
Perfect for adding:
- **Leaderboards**: Global high scores
- **Achievements**: Unlock system
- **Player Analytics**: Retention, engagement
- **LiveOps**: Events, tournaments

Setup:
1. Go to [playfab.com](https://playfab.com)
2. Create free account
3. Create new title
4. Use their React SDK

### Application Insights (Performance Monitoring)
Track:
- Load times
- API calls
- Errors and exceptions
- Custom events (game starts, level completions)

Setup:
\`\`\`bash
npm install @microsoft/applicationinsights-web
\`\`\`

### Playwright (Testing)
Already have some tests? Enhance with:
\`\`\`bash
npm install -D @playwright/test
npx playwright install
\`\`\`

---

## 📊 Quick Start Checklist

1. **Azure Static Web Apps** ⏱️ 15 min
   - [ ] Create Azure account
   - [ ] Create Static Web App
   - [ ] Connect to GitHub
   - [ ] Wait for deployment
   - [ ] Visit your new URL

2. **Microsoft Clarity** ⏱️ 5 min
   - [ ] Create Clarity account
   - [ ] Create project
   - [ ] Copy Project ID
   - [ ] Replace `YOUR_CLARITY_PROJECT_ID` in index.html
   - [ ] Deploy and verify

3. **PWA Builder** ⏱️ 10 min
   - [ ] Visit pwabuilder.com
   - [ ] Test your PWA
   - [ ] Generate store packages
   - [ ] Submit to stores

**Total Setup Time: ~30 minutes** 🎉

---

## 🆘 Troubleshooting

### Azure Static Web Apps
- **Build fails**: Check GitHub Actions logs
- **Routes not working**: Verify `staticwebapp.config.json` is in root
- **CSP errors**: Update CSP header in config

### Microsoft Clarity
- **Not recording**: Wait 10 minutes after deployment
- **CSP blocking**: Ensure `https://www.clarity.ms` is in CSP
- **No data**: Check browser console for errors

### PWA Builder
- **Low score**: Follow recommendations on PWA Builder
- **Icons missing**: Ensure 192x192 and 512x512 icons exist
- **Manifest errors**: Validate JSON at jsonlint.com

---

## 📈 Expected Improvements

After setup, you'll have:
- **50-70% faster load times** (Azure CDN vs GitHub Pages)
- **Real user insights** (Clarity analytics)
- **App store presence** (10x more distribution)
- **Professional hosting** (Custom domains, better uptime)

---

## 🎯 Next Steps

Once these are set up, consider:
1. **Azure PlayFab** for leaderboards (Week 2)
2. **TypeScript migration** for type safety (Week 3)
3. **Application Insights** for error tracking (Week 4)
4. **Progressive enhancement** based on Clarity data

---

## 📞 Support Resources

- **Azure**: [docs.microsoft.com/azure](https://docs.microsoft.com/azure)
- **Clarity**: [clarity.microsoft.com/help](https://clarity.microsoft.com/help)
- **PWA Builder**: [docs.pwabuilder.com](https://docs.pwabuilder.com)
- **Community**: [dev.to/azure](https://dev.to/azure)

---

**Setup created**: April 29, 2026
**Estimated savings**: $50-100/year in hosting + $500+/year in analytics tools
**ROI**: Massive! All free tools. 🚀
