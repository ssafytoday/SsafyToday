/**
 * SsafyToday GitLab platform content script
 * Content script for lab.ssafy.com (SSAFY GitLab)
 * Captures the logged-in user's username from the gon object
 */
import log from "@/commons/logger";
import { STORAGE_KEYS } from "@/constants/registry";

/**
 * GitLab gon object interface (global object on GitLab pages)
 */
interface GitLabGon {
  current_username?: string;
  current_user_fullname?: string;
  current_user_id?: number;
  current_user_avatar_url?: string;
}

/**
 * Find GitLab username from the gon object
 * GitLab stores user info in window.gon.current_username
 * @returns Username or null
 */
function findGitLabUsername(): string | null {
  try {
    // Method 1: Get from gon object (most reliable)
    const gon = (window as unknown as { gon?: GitLabGon }).gon;
    if (gon?.current_username) {
      log.debug("GitLab username found from gon object:", gon.current_username);
      return gon.current_username;
    }

    // Method 2: Parse from user menu link
    const userMenuLink = document.querySelector('a[data-testid="user-profile-link"]');
    if (userMenuLink) {
      const href = userMenuLink.getAttribute("href");
      if (href) {
        // Extract username from URL like "https://lab.ssafy.com/ssafy.jinhyeok"
        const match = href.match(/lab\.ssafy\.com\/([^/?#]+)/);
        if (match) {
          log.debug("GitLab username found from user menu:", match[1]);
          return match[1];
        }
      }
    }

    // Method 3: Parse from @username display
    const usernameDisplay = document.querySelector('.gl-break-all.gl-text-subtle');
    if (usernameDisplay) {
      const text = usernameDisplay.textContent?.trim();
      if (text?.startsWith('@')) {
        const username = text.slice(1); // Remove @ prefix
        log.debug("GitLab username found from display:", username);
        return username;
      }
    }

    log.debug("GitLab username not found");
    return null;
  } catch (error) {
    log.error("Error finding GitLab username:", error);
    return null;
  }
}

/**
 * Save GitLab username to chrome storage
 * @param username - GitLab username to save
 */
async function saveGitLabUsername(username: string): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLATFORM_GITLAB_USERNAME]: username
    });
    log.info("GitLab username saved to storage:", username);
  } catch (error) {
    log.warn("Failed to save GitLab username to storage:", error);
  }
}

/**
 * Check if capture mode is enabled for GitLab
 * @returns Whether capture mode is active for gitlab
 */
async function isCaptureMode(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['capture_mode']);
    return result.capture_mode === 'gitlab';
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
 * Initialize GitLab username capture
 */
async function init(): Promise<void> {
  log.info("[SsafyToday] GitLab content script loaded");

  // Wait a bit for the page to fully load (gon object is set via script tag)
  await new Promise(resolve => setTimeout(resolve, 500));

  const username = findGitLabUsername();

  if (username) {
    // Always save the username when we find it
    await saveGitLabUsername(username);

    // If capture mode was enabled, clear it
    const captureMode = await isCaptureMode();
    if (captureMode) {
      await clearCaptureMode();
      log.info("GitLab username captured successfully:", username);
    }
  }
}

// Run initialization
init();
