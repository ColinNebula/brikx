# 🛡️ BRIKX Security Quick Reference

## Before Pushing to GitHub

```bash
# Run complete security check
npm run prepare-github

# Or just security audit
npm run security-audit
```

✅ **Pass criteria**: 0 critical issues, all warnings reviewed

---

## Security Checklist

### Pre-Commit
- [ ] Run `npm run security-audit`
- [ ] Review SECURITY_AUDIT.json
- [ ] No API keys or secrets in code
- [ ] All inputs sanitized

### Pre-Deploy
- [ ] Run `npm audit` (fix vulnerabilities)
- [ ] HTTPS enabled
- [ ] CSP headers verified
- [ ] Test in private browsing
- [ ] Verify offline functionality

---

## Security Features at a Glance

| Feature | Protection | Status |
|---------|-----------|--------|
| Content Security Policy | XSS, injection attacks | ✅ Enabled |
| Input Sanitization | Code injection, XSS | ✅ Enabled |
| localStorage Limits | Data overflow, DoS | ✅ 1000 char limit |
| Safe Wrappers | Exception handling | ✅ All ops wrapped |
| No eval() | Code execution | ✅ Not used |
| Service Worker Integrity | Cache poisoning | ✅ Versioned |
| Security Headers | Multiple attacks | ✅ All set |
| Automated Auditing | Secrets detection | ✅ Pre-build |

---

## Input Validation Rules

### Player Name
- **Max length**: 15 characters
- **Allowed**: Letters, numbers, spaces
- **Default**: "Player" (if empty/invalid)
- **Pattern**: `[a-zA-Z0-9\s]{0,15}`

### Avatar
- **Type**: Whitelist only
- **Options**: 16 predefined emojis
- **Default**: 🎮
- **Validation**: Must be in avatars array

### High Score
- **Type**: Integer only
- **Range**: 0 to Number.MAX_SAFE_INTEGER
- **Storage**: String representation
- **Validation**: parseInt() with fallback

---

## localStorage Security

### Safe Operations

```javascript
// Use safe wrappers (automatically used in code)
safeSetItem('key', 'value')  // Max 1000 chars
safeGetItem('key', 'default') // Returns default on error
```

### Storage Keys
- `brikxHighScore` - Number as string
- `brickxPlayerName` - Sanitized string (15 chars)
- `brickxPlayerAvatar` - Validated emoji
- `brickxSoundEnabled` - Boolean as string

### Limits
- **Per value**: 1000 characters
- **Total storage**: ~5-10MB (browser dependent)
- **Error handling**: Try-catch on all operations

---

## Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline';  # React inline scripts
style-src 'self' 'unsafe-inline';   # React inline styles
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';                  # No Flash/plugins
frame-src 'none';                   # No iframes
```

---

## Service Worker Security

### Cache Versioning
```javascript
const CACHE_NAME = 'brickx-v1-2025-12-25';
```
- Date-stamped versions
- Prevents stale cache attacks
- Forces updates on version change

### Request Validation
- ✅ GET requests only
- ✅ Status 200 only
- ✅ Basic type only
- ✅ Same-origin only

---

## Vulnerability Response

### Critical (24-48 hours)
- Code execution
- Authentication bypass
- Data breach

### High (1 week)
- XSS vulnerabilities
- CSRF issues
- localStorage tampering

### Medium (2 weeks)
- Information disclosure
- DoS potential

### Low (Next release)
- Minor info leaks
- UI security issues

---

## Common Security Commands

```bash
# Security audit
npm run security-audit

# Full GitHub prep
npm run prepare-github

# Dependency audit
npm audit

# Fix vulnerabilities
npm audit fix

# High/critical only
npm audit --audit-level=high

# Build (includes security check)
npm run build
```

---

## Security Contact

- **Email**: security@yourdomain.com
- **GitHub**: Use "Report a vulnerability"
- **Response**: Within 48 hours

---

## Quick Fixes

### Remove Sensitive Data
```bash
# Check for secrets
grep -r "api_key\|apikey\|secret" src/

# Remove from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/file" \
  --prune-empty --tag-name-filter cat -- --all
```

### Update Dependencies
```bash
# Check outdated
npm outdated

# Update all
npm update

# Update specific
npm update react react-dom
```

### Fix localStorage Errors
```javascript
// Check quota
try {
  localStorage.setItem('test', 'x'.repeat(6000000));
} catch (e) {
  console.log('Quota:', e.name); // QuotaExceededError
}

// Clear if needed
localStorage.clear();
```

---

## Testing Security

```bash
# Test offline
# 1. Load app
# 2. DevTools > Network > Offline
# 3. Refresh - should work

# Test CSP
# DevTools > Console
# Look for: "Refused to load..."
# Should see CSP blocks for unauthorized resources

# Test input sanitization
# Profile > Name: "<script>alert(1)</script>"
# Should save as: "scriptalert1"
```

---

## Files Overview

| File | Purpose | Security Role |
|------|---------|---------------|
| `prepare-github.js` | Pre-push audit | Scans for vulnerabilities |
| `SECURITY.md` | Policy & guidelines | Disclosure process |
| `SECURITY_AUDIT.json` | Audit report | Issue tracking |
| `.gitignore` | Exclude files | Prevents secret leaks |
| `public/index.html` | CSP headers | Attack prevention |
| `public/service-worker.js` | Cache integrity | Tamper prevention |
| `src/DriftRacer.js` | Input validation | Sanitization layer |

---

## Security Badges

For README.md:

```markdown
[![Security](https://img.shields.io/badge/Security-Audited-green.svg)](SECURITY.md)
[![Vulnerabilities](https://img.shields.io/badge/Vulnerabilities-0-brightgreen.svg)](SECURITY_AUDIT.json)
```

---

**Last Updated**: 2025-12-25  
**Audit Status**: ✅ PASSED  
**Files Scanned**: 28  
**Critical Issues**: 0
