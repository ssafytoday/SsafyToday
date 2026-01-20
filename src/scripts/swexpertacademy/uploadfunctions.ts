/**
 * SWEA upload function
 * Creates GitHub upload function using PlatformHubBase
 */
import PlatformHubBase from "@/commons/platformhub-base";
import { PLATFORMS } from "@/constants/config";
import type { BaseProblemInfo } from "@/types/problem";

// SWEA-specific problem info interface
interface SWEAProblemInfo extends BaseProblemInfo {
  length?: string;
  link?: string;
  result_message?: string;
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
}

/**
 * Problem info mapper for SW Expert Academy platform
 * Maps raw problem data to standardized ProblemInfo format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const swexpertacademyProblemInfoMapper = (problemData: any): SWEAProblemInfo => ({
  problemId: problemData.problemId || "",
  title: problemData.title || "",
  level: problemData.level || "",
  language: problemData.language || "",
  memory: problemData.memory || "",
  runtime: problemData.runtime || "",
  submissionTime: problemData.submissionTime || "",
  length: problemData.length || "",
  link: problemData.link || "",
  problem_description: problemData.problem_description || "",
  problem_input: problemData.problem_input || "",
  problem_output: problemData.problem_output || "",
  result_message: problemData.result_message || "",
});

/**
 * Upload one solved problem to GitHub
 * Uses the generic upload function from PlatformHubBase
 *
 * @param problemData - Problem data to upload
 * @param callback - Callback function after upload completes
 * @returns Promise<void>
 */
const uploadOneSolveProblemOnGit = PlatformHubBase.createUploadFunction(
  PLATFORMS.SWEXPERTACADEMY,
  swexpertacademyProblemInfoMapper
);

export default uploadOneSolveProblemOnGit;
