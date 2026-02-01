# Rebranding Roadmap: SocialOra → [NEW BRAND NAME]

> **Current Brand:** SocialOra  
> **New Brand:** _[TO BE DETERMINED]_  
> **Domain:** socialora.app → _[NEW DOMAIN]_

---

## ⚠️ Critical Finding: Static Branding

**The brand name "SocialOra" is HARDCODED throughout the codebase.** There is NO central configuration or environment variable for the brand name. This means:

- Every file with the brand name must be manually updated
- A find-and-replace approach is required
- Future rebrands will require the same process

### Recommendation: Create Dynamic Branding Config

Before starting the rebrand, create a central configuration:

```typescript
// src/lib/brand-config.ts
export const BRAND = {
  name: 'Leda', // or new name
  fullName: 'Leda Instagram Automation',
  domain: 'leda.app',
  email: 'hello@leda.app',
  twitter: '@LedaApp',
  tagline: '#1 Instagram DM Automation Tool',
  cookiePrefix: 'leda_cookies_',
  storagePrefix: 'leda_',
} as const;
```

---

## 📊 Brand Reference Analysis

| Category | Count | Files |
|----------|-------|-------|
| Main App (src/) | 50+ | Multiple files |
| Extension | 70+ | 7 files |
| Blog Posts | 100+ | 1 file (blog-posts.ts) |
| SEO/Metadata | 40+ | Multiple files |
| Cookie Keys | 10+ | 3 files |

---

## Phase 1: Core Configuration Files

### 1.1 Package Configuration

#### [MODIFY] [package.json](file:///Users/nood/Downloads/projects/instagram-dm-saas/package.json)
```diff
- "name": "instagram-dm-saas",
+ "name": "leda",
```

---

### 1.2 Environment Variables

#### [MODIFY] [.env.local](file:///Users/nood/Downloads/projects/instagram-dm-saas/.env.local)
```diff
- NEXT_PUBLIC_BACKEND_URL=https://www.socialora.app
+ NEXT_PUBLIC_BACKEND_URL=https://www.leda.app
```

#### [MODIFY] [.env](file:///Users/nood/Downloads/projects/instagram-dm-saas/.env)
- Update same variables as .env.local

---

## Phase 2: App Metadata & SEO

### 2.1 Root Layout (Primary SEO)

#### [MODIFY] [src/app/layout.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/app/layout.tsx)

**Lines to update:**
- Line 17: `metadataBase` URL
- Line 19: `title.default` - "SocialOra - #1 Instagram DM..."
- Line 20: `title.template` - "%s | SocialOra"
- Line 75: `SocialOra vs ColdDMs` keyword
- Line 82-84: `authors`, `creator`, `publisher`
- Line 94-95: `openGraph.siteName`, `openGraph.title`
- Line 102: `openGraph.images.alt`
- Line 108: `twitter.title`
- Line 111-112: `twitter.creator`, `twitter.site`
- Line 162: `localStorage` key reference

```diff
- title: { default: "SocialOra - #1 Instagram DM Automation Tool 2026", template: "%s | SocialOra" },
+ title: { default: "Leda - #1 Instagram DM Automation Tool 2026", template: "%s | Leda" },
```

---

### 2.2 Structured Data (SEO)

#### [MODIFY] [src/components/seo/structured-data.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/components/seo/structured-data.tsx)

**40+ occurrences of "SocialOra" and "Socialora"** including:
- Organization name
- Application name
- Twitter/LinkedIn URLs
- FAQ answers
- Product descriptions
- Review content

---

### 2.3 Blog Article SEO

#### [MODIFY] [src/components/blog/article-structured-data.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/components/blog/article-structured-data.tsx)

- Line 16: Base URL fallback
- Line 35, 41: Publisher/Author names

---

## Phase 3: UI Components

### 3.1 Landing Page

#### [MODIFY] [src/app/page.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/app/page.tsx)

**Key occurrences:**
- Line 76, 92, 301, 317: Testimonials mentioning SocialOra
- Line 368, 943: Logo alt text
- Line 625: Comment "Why switch to SocialOra"
- Line 651: CTA text
- Line 657, 660: External links to aijustbetter.com
- Line 688: Notification "joined SocialOra"
- Line 842: Footer CTA
- Line 1019: Copyright notice

---

### 3.2 Dashboard Sidebar

#### [MODIFY] [src/components/layout/sidebar.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/components/layout/sidebar.tsx)

- Line 182, 212: Logo alt text

---

### 3.3 Welcome/Onboarding

#### [MODIFY] [src/components/waiting-list-form.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/components/waiting-list-form.tsx)

- Line 193: "Welcome to SocialOra"

---

### 3.4 Interactive Demo

#### [MODIFY] [src/components/landing/interactive-simulation.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/components/landing/interactive-simulation.tsx)

- Line 10: Demo message with "socialora.app/products/..."

---

## Phase 4: Cookie & Storage Keys

### 4.1 Instagram Cookie Storage

#### [MODIFY] [src/lib/instagram-cookie-storage.ts](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/lib/instagram-cookie-storage.ts)

```diff
- const COOKIE_KEY_PREFIX = 'socialora_cookies_';
+ const COOKIE_KEY_PREFIX = 'leda_cookies_';
```

> ⚠️ **MIGRATION REQUIRED**: Add backwards-compatible lookup for existing `socialora_cookies_*` keys

---

### 4.2 Appearance Preferences

#### [MODIFY] [src/components/providers.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/components/providers.tsx)

- Line 11: `'socialora_appearance_preferences'`

```diff
- const STORAGE_KEY = 'socialora_appearance_preferences';
+ const STORAGE_KEY = 'leda_appearance_preferences';
```

---

### 4.3 Root Layout Script

#### [MODIFY] [src/app/layout.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/app/layout.tsx)

- Line 162: `localStorage.getItem('socialora_appearance_preferences')`

---

## Phase 5: Extension Updates

### 5.1 Extension Manifest

#### [MODIFY] [extension/manifest.json](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/manifest.json)

- Line 3: `"name": "Socialora - Instagram Session Grabber"`
- Line 5: `"description"` 
- Lines 21-22, 45-46: Domain permissions (`socialora.app`)

---

### 5.2 Extension Config

#### [MODIFY] [extension/config.js](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/config.js)

- Line 1: Comment
- Update `BASE_URL` if present

---

### 5.3 Content Script

#### [MODIFY] [extension/content-script.js](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/content-script.js)

**30+ occurrences including:**
- Event types: `SOCIALORA_CONTENT_SCRIPT_LOADED`, `SOCIALORA_PING`, `SOCIALORA_PONG`, etc.
- Storage keys: `socialora_cookies_*`
- Window properties: `__SOCIALORA_COOKIE_DATA__`
- Console logs

---

### 5.4 Popup UI

#### [MODIFY] [extension/popup.html](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/popup.html)

- Line 501: Header title "Socialora"
- Line 528: Instructions text

---

### 5.5 Popup Script

#### [MODIFY] [extension/popup.js](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/popup.js)

**50+ occurrences including:**
- Storage keys: `socialora_connection_state`, `socialora_connected_user`, etc.
- Comments

---

### 5.6 Inject Cookies Script

#### [MODIFY] [extension/inject-cookies.js](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/inject-cookies.js)

- Window properties and storage keys

---

### 5.7 Build Script

#### [MODIFY] [extension/build.sh](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/build.sh)

- Output filename: `socialora-extension-v*.zip`
- Console output messages

---

## Phase 6: Blog Content

### 6.1 Blog Posts Library

#### [MODIFY] [src/lib/blog-posts.ts](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/lib/blog-posts.ts)

**100+ occurrences** throughout the blog content including:
- Company references
- Tool comparisons
- CTA text
- FAQ answers
- Author roles (Line 40: "COO, SocialOra")
- Meta titles

---

## Phase 7: Internal Communication

### 7.1 Job Poller Component

#### [MODIFY] [src/components/JobPoller.tsx](file:///Users/nood/Downloads/projects/instagram-dm-saas/src/components/JobPoller.tsx)

- Line 45, 58, 65, 74: Event types `SOCIALORA_JOB_STATUS`, `SOCIALORA_RUN_DM_JOB`

---

## Phase 8: Assets

### 8.1 Images & Icons

| File | Purpose |
|------|---------|
| [public/favicon.ico](file:///Users/nood/Downloads/projects/instagram-dm-saas/public/favicon.ico) | Browser tab icon |
| [public/images/](file:///Users/nood/Downloads/projects/instagram-dm-saas/public/images/) | Logo and brand images |
| [public/og-image.jpg](file:///Users/nood/Downloads/projects/instagram-dm-saas/public/og-image.jpg) | Social sharing image |
| [extension/icon*.png](file:///Users/nood/Downloads/projects/instagram-dm-saas/extension/) | Extension icons |

---

## Phase 9: External Services

### 9.1 Supabase
- [ ] Update auth email templates with new brand name
- [ ] Update redirect URLs

### 9.2 Meta/Facebook Developer Console
- [ ] Update app name
- [ ] Update OAuth redirect URIs
- [ ] Update app icon

### 9.3 PostHog Analytics
- [ ] Update project name

### 9.4 Domain & DNS
- [ ] Purchase new domain
- [ ] Configure DNS
- [ ] Set up SSL certificate

### 9.5 Vercel
- [ ] Update project settings
- [ ] Update environment variables

---

## Implementation Checklist

### Pre-Implementation
- [ ] Finalize new brand name
- [ ] Create brand assets (logo, colors, fonts)
- [ ] Purchase domain
- [ ] Create `src/lib/brand-config.ts` for future flexibility

### Main App
- [ ] Update `package.json`
- [ ] Update `.env.local` and `.env`
- [ ] Update `src/app/layout.tsx`
- [ ] Update `src/app/page.tsx`
- [ ] Update `src/components/seo/structured-data.tsx`
- [ ] Update `src/components/layout/sidebar.tsx`
- [ ] Update `src/components/providers.tsx`
- [ ] Update `src/components/waiting-list-form.tsx`
- [ ] Update `src/lib/instagram-cookie-storage.ts` (with migration)
- [ ] Update `src/lib/blog-posts.ts`
- [ ] Update `src/components/JobPoller.tsx`

### Extension
- [ ] Update `extension/manifest.json`
- [ ] Update `extension/config.js`
- [ ] Update `extension/content-script.js`
- [ ] Update `extension/popup.html`
- [ ] Update `extension/popup.js`
- [ ] Update `extension/inject-cookies.js`
- [ ] Update `extension/build.sh`
- [ ] Replace extension icons

### Assets
- [ ] Replace `public/favicon.ico`
- [ ] Replace images in `public/images/`
- [ ] Create new `public/og-image.jpg`
- [ ] Replace extension icons

### Testing
- [ ] Test login/signup flow
- [ ] Test Instagram connection
- [ ] Test cookie storage migration
- [ ] Test extension functionality
- [ ] Verify SEO metadata
- [ ] Check all pages for old brand references

### Deployment
- [ ] Deploy to staging
- [ ] Full QA pass
- [ ] Deploy to production
- [ ] Set up old domain redirects
- [ ] Announce rebrand

---

## Cookie Migration Strategy

When changing storage key prefixes, ensure backward compatibility:

```typescript
// In instagram-cookie-storage.ts
const NEW_PREFIX = 'leda_cookies_';
const OLD_PREFIX = 'socialora_cookies_';

export function getCookies(userId: string) {
  // Try new prefix first
  let cookies = localStorage.getItem(`${NEW_PREFIX}${userId}`);
  
  // Fall back to old prefix for existing users
  if (!cookies) {
    cookies = localStorage.getItem(`${OLD_PREFIX}${userId}`);
    if (cookies) {
      // Migrate to new prefix
      localStorage.setItem(`${NEW_PREFIX}${userId}`, cookies);
    }
  }
  
  return cookies ? JSON.parse(cookies) : null;
}
```

---

## Search Commands for Verification

After rebranding, run these to verify no old references remain:

```bash
# Find all remaining "socialora" references (case-insensitive)
grep -ri "socialora" src/ extension/ public/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.html"

# Find all remaining references in specific files
grep -ri "socialora" package.json README.md
```

---

## Timeline Estimate

| Phase | Duration | Effort |
|-------|----------|--------|
| Brand Assets Creation | 1-2 weeks | Design |
| Phase 1-4 (Main App) | 2-3 days | Development |
| Phase 5-7 (Extension) | 1 day | Development |
| Phase 8 (Assets) | 1 day | Design/Dev |
| Phase 9 (External) | 1 day | Configuration |
| Testing | 2-3 days | QA |
| Deployment | 1 day | DevOps |

**Total: 2-4 weeks**
