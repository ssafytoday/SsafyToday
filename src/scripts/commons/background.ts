/**
 * Background service worker for SsafyToday Chrome Extension
 * Handles messaging, Solved.ac API calls, authentication flow, and migration
 */
import urls from "@/constants/url";
import log from "@/commons/logger";

// Message request interface
interface MessageRequest {
  KEY?: string;
  sender?: string;
  task?: string;
  problemId?: number;
}

// Solved.ac problem response interface
interface SolvedAcProblem {
  problemId: number;
  titleKo: string;
  level: number;
  tags: Array<{
    key: string;
    displayNames: Array<{
      language: string;
      name: string;
    }>;
  }>;
  [key: string]: unknown;
}

/**
 * Fetch problem data from Solved.ac API
 * @param problemId - Baekjoon problem ID
 * @returns Problem data from Solved.ac
 */
export async function SolvedApiCall(problemId: number): Promise<SolvedAcProblem> {
  const response = await fetch(`${urls.SOLVED_AC_API_PROBLEM_SHOW_URL}${problemId}`, {
    method: "GET",
  });
  return response.json();
}

/**
 * Handle messages from content scripts and popup
 * @param request - Message request object
 * @param sender - Message sender info
 * @param sendResponse - Response callback function
 * @returns true to indicate async response
 */
export function handleMessage(
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  log.info("background.ts: handleMessage called with request:", request);

  if (request && request.sender === "baekjoon" && request.task === "SolvedApiCall") {
    // Solved.ac API call request
    SolvedApiCall(request.problemId!).then((res) => sendResponse(res));
  }

  return true; // Indicates async response
}

// Register message listener
chrome.runtime.onMessage.addListener(handleMessage);
