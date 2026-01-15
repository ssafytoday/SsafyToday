/**
 * Hint integration helper for all platforms
 * Provides a unified interface for initializing hint UI across different coding platforms
 */
import log from "@/commons/logger";
import { createHintUI, HintUI } from "@/commons/hint-ui";
import type { ProblemContext } from "@/commons/hint-websocket";

let hintUIInstance: HintUI | null = null;

/**
 * Initialize hint UI for a problem page
 *
 * @param platform - The coding platform (baekjoon, programmers, swea)
 * @param problemData - Problem information
 * @param getCodeFn - Optional function to get current code from editor
 */
export function initHintForProblem(
  platform: ProblemContext["platform"],
  problemData: {
    id: string;
    title: string;
    level?: string;
    description?: string;
    tags?: string[];
  },
  getCodeFn?: () => string
): void {
  // Cleanup any existing instance
  if (hintUIInstance) {
    hintUIInstance.destroy();
    hintUIInstance = null;
  }

  const context: ProblemContext = {
    platform,
    problem: {
      id: problemData.id,
      title: problemData.title,
      level: problemData.level || "Unknown",
      description: problemData.description || "",
      tags: problemData.tags,
    },
  };

  hintUIInstance = createHintUI(context, getCodeFn);
  log.info(`Hint UI initialized for ${platform} problem: ${problemData.id}`);
}

/**
 * Cleanup hint UI (call on page unload)
 */
export function cleanupHint(): void {
  if (hintUIInstance) {
    hintUIInstance.destroy();
    hintUIInstance = null;
  }
}

/**
 * Check if hint UI is currently active
 */
export function isHintActive(): boolean {
  return hintUIInstance !== null;
}
