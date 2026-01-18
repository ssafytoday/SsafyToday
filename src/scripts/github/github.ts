/**
 * SsafyToday GitHub platform content script
 * Content script for github.com
 * Captures the logged-in user's username from the page
 */
import log from "@/commons/logger";
import { STORAGE_KEYS } from "@/constants/registry";

/**
 * Find GitHub username from the page
 * GitHub stores user info in various places on the page
 * @returns Username or null
 */
function findGitHubUsername(): string | null {
  try {
    // Method 1: Get from user dropdown menu (most reliable when logged in)
    const metaUser = document.querySelector('meta[name="user-login"]');
    if (metaUser) {
      const username = metaUser.getAttribute("content");
      if (username) {
        log.debug("GitHub username found from meta tag:", username);
        return username;
      }
    }

    // Method 2: Get from avatar dropdown
    const avatarLink = document.querySelector('a[data-login]');
    if (avatarLink) {
      const username = avatarLink.getAttribute("data-login");
      if (username) {
        log.debug("GitHub username found from avatar:", username);
        return username;
      }
    }

    // Method 3: Get from profile menu item
    const profileMenuItem = document.querySelector('.AppHeader-user summary img.avatar');
    if (profileMenuItem) {
      const altText = profileMenuItem.getAttribute("alt");
      if (altText?.startsWith("@")) {
        const username = altText.slice(1);
        log.debug("GitHub username found from avatar alt:", username);
        return username;
      }
    }

    // Method 4: Parse from URL when on profile page
    const match = window.location.pathname.match(/^\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/?$/);
    if (match) {
      // This might be a user profile, but we need to verify
      const profileHeader = document.querySelector('.vcard-username, [itemprop="additionalName"]');
      if (profileHeader) {
        const username = profileHeader.textContent?.trim();
        if (username) {
          log.debug("GitHub username found from profile page:", username);
          return username;
        }
      }
    }

    // Method 5: Check for logged-in user indicator
    const headerUser = document.querySelector('.AppHeader-user [data-target="deferred-side-panel.summary"]');
    if (headerUser) {
      const ariaLabel = headerUser.getAttribute("aria-label");
      if (ariaLabel?.includes("@")) {
        const match = ariaLabel.match(/@([a-zA-Z0-9-]+)/);
        if (match) {
          log.debug("GitHub username found from header:", match[1]);
          return match[1];
        }
      }
    }

    log.debug("GitHub username not found");
    return null;
  } catch (error) {
    log.error("Error finding GitHub username:", error);
    return null;
  }
}

/**
 * Save GitHub username to chrome storage
 * @param username - GitHub username to save
 */
async function saveGitHubUsername(username: string): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLATFORM_GITHUB_USERNAME]: username
    });
    log.info("GitHub username saved to storage:", username);
  } catch (error) {
    log.warn("Failed to save GitHub username to storage:", error);
  }
}

/**
 * Check if capture mode is enabled for GitHub
 * @returns Whether capture mode is active for github
 */
async function isCaptureMode(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['capture_mode']);
    return result.capture_mode === 'github';
  } catch {
    return false;
  }
}

/**
 * Clear capture mode after successful capture
 */
async function clearCaptureMode(): Promise<void> {
  try {
    await chrome.storage.local.remove('capture_mode');
    log.debug("Capture mode cleared");
  } catch (error) {
    log.warn("Failed to clear capture mode:", error);
  }
}

/**
 * Initialize GitHub username capture
 */
async function init(): Promise<void> {
  log.info("[SsafyToday] GitHub content script loaded");

  // Wait a bit for the page to fully load
  await new Promise(resolve => setTimeout(resolve, 500));

  const username = findGitHubUsername();

  if (username) {
    // Always save the username when we find it
    await saveGitHubUsername(username);

    // If capture mode was enabled, clear it
    const captureMode = await isCaptureMode();
    if (captureMode) {
      await clearCaptureMode();
      log.info("GitHub username captured successfully:", username);
    }
  }
}

// Run initialization (but only if not in OAuth callback flow)
// authorize.ts handles the OAuth callback
const isOAuthCallback = window.location.href.includes("?code=") || window.location.href.includes("?error=");
if (!isOAuthCallback) {
  init();
}
