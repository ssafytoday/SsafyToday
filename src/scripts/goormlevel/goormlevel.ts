/** NOTE: goormlevel 핵심 로직입니다. */

// Import all dependencies directly
// Common utilities (log unused but kept for potential debug)
// Note: Toast, STORAGE_KEYS, getObjectFromLocalStorage, saveObjectInLocalStorage removed - unused

// Platform-specific utilities
import { languages, difficultyLabels, uploadState } from '@/goormlevel/variables';
import { parseData } from '@/goormlevel/parsing';
import uploadOneSolveProblemOnGit from '@/goormlevel/uploadfunctions';
import { startUpload, markUploadedCSS } from '@/goormlevel/util';

// Export for module usage
export {
  languages,
  difficultyLabels,
  uploadState,
  parseData,
  uploadOneSolveProblemOnGit,
  startUpload,
  markUploadedCSS,
};
