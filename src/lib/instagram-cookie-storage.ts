/**
 * Instagram Cookie Storage Utilities
 * 
 * Provides reliable storage and retrieval of Instagram session cookies
 * with fallback mechanisms and dual-key storage for robustness.
 */

export interface InstagramCookies {
    sessionId: string;
    csrfToken: string;
    dsUserId: string;
    igDid?: string;
    mid?: string;
    rur?: string;
}

export interface InstagramAccountIdentifiers {
    igUserId?: string;      // Numeric Instagram user ID (pk)
    igUsername?: string;    // Instagram username
    dsUserId?: string;      // Same as igUserId but from cookie
}

const COOKIE_KEY_PREFIX = 'socialora_cookies_';

/**
 * Get all possible localStorage keys for an account
 */
function getAllPossibleKeys(identifiers: InstagramAccountIdentifiers): string[] {
    const keys: string[] = [];

    // Add numeric ID key (most reliable)
    if (identifiers.igUserId) {
        keys.push(`${COOKIE_KEY_PREFIX}${identifiers.igUserId}`);
    }

    // Add dsUserId key (from cookies)
    if (identifiers.dsUserId && identifiers.dsUserId !== identifiers.igUserId) {
        keys.push(`${COOKIE_KEY_PREFIX}${identifiers.dsUserId}`);
    }

    // Add username key as fallback
    if (identifiers.igUsername) {
        keys.push(`${COOKIE_KEY_PREFIX}${identifiers.igUsername}`);
    }

    return keys;
}

/**
 * Save cookies to localStorage under multiple keys for reliable retrieval
 */
export function saveCookies(
    cookies: InstagramCookies,
    identifiers: InstagramAccountIdentifiers
): void {
    const cookiesJson = JSON.stringify(cookies);
    const keys = getAllPossibleKeys({
        ...identifiers,
        dsUserId: cookies.dsUserId, // Always include dsUserId from cookies
    });

    // Save under all possible keys
    for (const key of keys) {
        try {
            localStorage.setItem(key, cookiesJson);
            // Also save to sessionStorage as backup
            sessionStorage.setItem(key, cookiesJson);
        } catch (e) {
            console.warn(`Failed to save cookies to ${key}:`, e);
        }
    }

    console.log(`✓ Cookies saved under ${keys.length} keys:`, keys);
}

/**
 * Get cookies from localStorage with fallback mechanisms
 */
export function getCookies(identifiers: InstagramAccountIdentifiers): InstagramCookies | null {
    const keys = getAllPossibleKeys(identifiers);

    // Try each key in order of reliability
    for (const key of keys) {
        try {
            // Try localStorage first
            let cookiesStr = localStorage.getItem(key);

            // Fallback to sessionStorage
            if (!cookiesStr) {
                cookiesStr = sessionStorage.getItem(key);
                if (cookiesStr) {
                    // Restore to localStorage if found in sessionStorage
                    localStorage.setItem(key, cookiesStr);
                    console.log(`✓ Restored cookies from sessionStorage to localStorage (${key})`);
                }
            }

            if (cookiesStr) {
                const cookies = JSON.parse(cookiesStr) as InstagramCookies;

                // Validate cookies have required fields
                if (cookies.sessionId && cookies.csrfToken && cookies.dsUserId) {
                    console.log(`✓ Found valid cookies using key: ${key}`);

                    // If found under a fallback key, also save under primary keys
                    // This helps ensure future lookups are faster
                    const primaryKey = identifiers.igUserId
                        ? `${COOKIE_KEY_PREFIX}${identifiers.igUserId}`
                        : null;

                    if (primaryKey && key !== primaryKey) {
                        try {
                            localStorage.setItem(primaryKey, cookiesStr);
                            console.log(`✓ Copied cookies to primary key: ${primaryKey}`);
                        } catch (e) {
                            // Ignore copy errors
                        }
                    }

                    return cookies;
                }
            }
        } catch (e) {
            console.warn(`Failed to parse cookies from ${key}:`, e);
        }
    }

    console.warn('No valid cookies found for identifiers:', identifiers);
    return null;
}

/**
 * Remove cookies for an account from all possible storage locations
 */
export function removeCookies(identifiers: InstagramAccountIdentifiers): void {
    const keys = getAllPossibleKeys(identifiers);

    for (const key of keys) {
        try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        } catch (e) {
            // Ignore removal errors
        }
    }

    console.log(`✓ Removed cookies from ${keys.length} keys`);
}

/**
 * Check if cookies exist for an account
 */
export function hasCookies(identifiers: InstagramAccountIdentifiers): boolean {
    return getCookies(identifiers) !== null;
}

/**
 * Get all stored cookie keys (for debugging)
 */
export function getAllCookieKeys(): string[] {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(COOKIE_KEY_PREFIX)) {
            keys.push(key);
        }
    }

    return keys;
}

/**
 * Migrate old cookie storage format to new format
 * Call this on app initialization to ensure consistency
 */
export function migrateCookieStorage(): void {
    const keys = getAllCookieKeys();

    for (const key of keys) {
        try {
            const cookiesStr = localStorage.getItem(key);
            if (!cookiesStr) continue;

            const cookies = JSON.parse(cookiesStr) as InstagramCookies;

            // If we have dsUserId, ensure cookies are also stored under that key
            if (cookies.dsUserId) {
                const dsUserIdKey = `${COOKIE_KEY_PREFIX}${cookies.dsUserId}`;
                if (dsUserIdKey !== key) {
                    const existing = localStorage.getItem(dsUserIdKey);
                    if (!existing) {
                        localStorage.setItem(dsUserIdKey, cookiesStr);
                        console.log(`✓ Migrated cookies: ${key} → ${dsUserIdKey}`);
                    }
                }
            }
        } catch (e) {
            // Ignore migration errors for individual keys
        }
    }
}
