/**
 * Baekjoon upload function
 * Creates GitHub upload function using PlatformHubBase
 */
import PlatformHubBase from "@/commons/platformhub-base";
import { PLATFORMS } from "@/constants/config";
import type { ProblemData, ProblemInfo } from "@/types/problem";

/**
 * Problem info mapper for Baekjoon platform
 * Maps raw problem data to standardized ProblemInfo format
 * Supports both camelCase (from parsing) and snake_case inputs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baekjoonProblemInfoMapper = (problemData: any): ProblemInfo => ({
  problemId: problemData.problemId || "",
  title: problemData.title || "",
  level: problemData.level || "",
  language: problemData.language || "",
  memory: problemData.memory || "",
  runtime: problemData.runtime || "",
  submissionTime: problemData.submissionTime || "",
  // Support both camelCase (from parsing.ts) and snake_case
  problem_tags: problemData.problemTags || problemData.problem_tags || [],
  problem_description: problemData.problemDescription || problemData.problem_description || "",
  problem_input: problemData.problemInput || problemData.problem_input || "",
  problem_output: problemData.problemOutput || problemData.problem_output || "",
  link: `https://www.acmicpc.net/problem/${problemData.problemId || ""}`,
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
  PLATFORMS.BAEKJOON,
  baekjoonProblemInfoMapper
);

export default uploadOneSolveProblemOnGit;
