/**
 * Common upload service for all platforms
 * Uses GitHub API to upload code and README files to GitHub repositories
 */
import { GitHub } from "./github";
import { getToken, getHook, getStats, saveStats, updateObjectDatafromPath, getGithubUsername } from "./storage";
import { isNull, isEmpty, preProcessEmptyObj } from "./util";
import { toISOString } from "./date-util";
import log from "@/commons/logger";
import { SsafyAPIService, type SubmissionData } from "./ssafy-api";
import type { ProblemData, BaseProblemInfo } from "@/types/problem";
import type { UploadResult, UploadCallback, UploadHandlerResult, ParseDataFunction, MarkFunction, StartUploadFunction } from "@/types/upload";
import type { Stats } from "@/types/storage";
import type { GitHubTreeItem, GitHubFileContent } from "@/types/github";

// Upload file info interface
interface UploadedFileInfo {
  path: string;
  sha: string;
}

// Problem data with required fields for upload
interface UploadProblemData {
  code: string;
  readme: string;
  directory: string;
  fileName: string;
  message: string;
  platform?: string;
  problemInfo?: BaseProblemInfo;
  platformUsername?: string;  // 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
}

/**
 * Common upload service class for all platforms
 * Uploads code, README, and other files to GitHub repositories using the GitHub API
 */
export default class UploadService {
  /**
   * Upload problem data to GitHub
   *
   * @param problemData - Problem data to upload
   * @param callback - Callback function to execute after upload
   */
  static async uploadProblem(
    problemData: UploadProblemData,
    callback?: UploadCallback
  ): Promise<UploadResult | void> {
    try {
      const { code, readme, directory, fileName, message, platform, problemInfo } = problemData;

      // Validate required data
      if (!code || !readme || !directory || !fileName || !message) {
        log.error("Missing required upload data:", {
          hasCode: !!code,
          hasReadme: !!readme,
          hasDirectory: !!directory,
          hasFileName: !!fileName,
          hasMessage: !!message,
        });
        throw new Error("Missing required upload data");
      }

      const token = await getToken();
      const hook = await getHook();

      if (isNull(token) || isNull(hook)) {
        log.error("Token or hook is null", token, hook);
        return;
      }

      const result = await this.upload(token, hook, code, readme, directory, fileName, message, callback);

      // ===== ssafy.today 연동 =====
      if (result?.success) {
        try {
          const githubUsername = await getGithubUsername();
          if (githubUsername && platform) {
            // 기본 problemData 구성
            const problemDataBase = {
              problemId: String(problemInfo?.problemId || ""),
              title: problemInfo?.title || "",
              level: problemInfo?.level || "",
              language: problemInfo?.language || "",
              code: code,
              runtime: problemInfo?.runtime || "",
              memory: problemInfo?.memory || "",
              submissionTime: toISOString(problemInfo?.submissionTime),
              tags: (Array.isArray(problemInfo?.tags) ? problemInfo.tags : []) as string[],
              link: (typeof problemInfo?.link === "string" ? problemInfo.link : undefined) as string | undefined,
            };

            // 플랫폼별 추가 필드
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const info = problemInfo as any;
            let platformSpecificData = {};

            if (platform === "백준") {
              platformSpecificData = {
                problemDescription: info?.problem_description || "",
                problemInput: info?.problem_input || "",
                problemOutput: info?.problem_output || "",
              };
            } else if (platform === "프로그래머스") {
              platformSpecificData = {
                division: info?.division || "",
                resultMessage: info?.result_message || "",
              };
            } else if (platform === "SWEA") {
              platformSpecificData = {
                length: info?.length || "",
              };
            }

            const submissionData: SubmissionData = {
              username: githubUsername,
              platformUsername: problemData.platformUsername || "",  // 플랫폼별 사용자명도 함께 전송
              platform: platform,
              problemData: {
                ...problemDataBase,
                ...platformSpecificData,
              },
              metadata: {
                extensionVersion: chrome.runtime.getManifest().version,
                timestamp: new Date().toISOString(),
                githubRepo: hook,
                directory: directory,
                fileName: fileName,
                commitMessage: message,
              },
            };

            const ssafyResult = await SsafyAPIService.sendSubmission(submissionData);
            if (ssafyResult.success) {
              log.info("SSAFY Today submission sent successfully:", ssafyResult.data);
            } else {
              log.warn("SSAFY Today submission failed:", ssafyResult.error);
            }
          }
        } catch (ssafyError) {
          log.warn("SSAFY Today submission error:", ssafyError);
          // SSAFY 전송 실패해도 GitHub 업로드는 성공한 상태이므로 무시
        }
      }
      // ===== ssafy.today 연동 끝 =====

      return result;
    } catch (error) {
      log.error("Error uploading problem:", error);
      throw error;
    }
  }

  /**
   * GitHub 업로드 없이 ssafy.today로만 전송
   * GitHub 인증이 없는 사용자를 위한 독립 전송 기능
   *
   * @param problemData - 문제 데이터
   * @param platformUsername - 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
   */
  static async sendToSsafyTodayDirect(
    problemData: UploadProblemData,
    platformUsername: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { code, platform, problemInfo } = problemData;

      if (!platformUsername || !platform) {
        log.warn("sendToSsafyTodayDirect: Missing platformUsername or platform");
        return { success: false, error: "Missing platformUsername or platform" };
      }

      // 기본 problemData 구성
      const problemDataBase = {
        problemId: String(problemInfo?.problemId || ""),
        title: problemInfo?.title || "",
        level: problemInfo?.level || "",
        language: problemInfo?.language || "",
        code: code,
        runtime: problemInfo?.runtime || "",
        memory: problemInfo?.memory || "",
        submissionTime: toISOString(problemInfo?.submissionTime),
        tags: (Array.isArray(problemInfo?.tags) ? problemInfo.tags : []) as string[],
        link: (typeof problemInfo?.link === "string" ? problemInfo.link : undefined) as string | undefined,
      };

      // 플랫폼별 추가 필드
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info = problemInfo as any;
      let platformSpecificData = {};

      if (platform === "백준") {
        platformSpecificData = {
          problemDescription: info?.problem_description || "",
          problemInput: info?.problem_input || "",
          problemOutput: info?.problem_output || "",
        };
      } else if (platform === "프로그래머스") {
        platformSpecificData = {
          division: info?.division || "",
          resultMessage: info?.result_message || "",
        };
      } else if (platform === "SWEA") {
        platformSpecificData = {
          length: info?.length || "",
        };
      }

      const submissionData: SubmissionData = {
        username: "", // GitHub 연동 없으므로 빈 문자열
        platformUsername: platformUsername,
        platform: platform,
        problemData: {
          ...problemDataBase,
          ...platformSpecificData,
        },
        metadata: {
          extensionVersion: chrome.runtime.getManifest().version,
          timestamp: new Date().toISOString(),
          // GitHub 관련 필드 생략
        },
      };

      const result = await SsafyAPIService.sendSubmission(submissionData);
      if (result.success) {
        log.info("SSAFY Today direct submission sent successfully:", result.data);
      } else {
        log.warn("SSAFY Today direct submission failed:", result.error);
      }
      return result;
    } catch (error) {
      log.error("sendToSsafyTodayDirect error:", error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Upload files to GitHub using the GitHub API
   *
   * @param token - GitHub API token
   * @param hook - GitHub repository (username/repo format)
   * @param sourceText - Source code to upload
   * @param readmeText - README content to upload
   * @param directory - Directory path for upload
   * @param filename - Source code filename
   * @param commitMessage - Commit message
   * @param callback - Callback function after upload
   */
  static async upload(
    token: string,
    hook: string,
    sourceText: string,
    readmeText: string,
    directory: string,
    filename: string,
    commitMessage: string,
    callback?: UploadCallback
  ): Promise<UploadResult> {
    try {
      const git = new GitHub(hook, token);
      const stats = await getStats();

      // Initialize stats object if needed
      if (!stats.branches) {
        stats.branches = {};
      }
      if (!stats.submission) {
        stats.submission = {};
      }

      // Get default branch
      let defaultBranch = stats.branches[hook];
      if (isNull(defaultBranch)) {
        try {
          defaultBranch = await git.getDefaultBranchOnRepo();
          stats.branches[hook] = defaultBranch;
        } catch (error) {
          log.error("Error getting default branch, using 'main':", error);
          defaultBranch = "main";
          stats.branches[hook] = defaultBranch;
        }
      }

      // Get current reference
      const { refSHA, ref } = await git.getReference(defaultBranch);

      let source: UploadedFileInfo;
      let readme: UploadedFileInfo;
      let commitSHA: string | undefined;

      // Handle empty repository case
      if (refSHA === null) {
        log.info("Empty repository detected, creating initial commit with problem files");

        try {
          // Initialize empty repository with root README.md
          await git.createOrUpdateFile(
            "README.md",
            "Initial commit",
            `# ${hook.split("/")[1] || "TIL"}\n알고리즘 문제 풀이 자동 동기화 저장소입니다. [SsafyToday](https://ssafy.today)로 생성되었습니다.`,
            defaultBranch
          );

          // Upload problem files
          const sourceFile = await git.createOrUpdateFile(
            `${directory}/${filename}`,
            commitMessage,
            sourceText,
            defaultBranch
          );
          const readmeFile = await git.createOrUpdateFile(
            `${directory}/README.md`,
            commitMessage,
            readmeText,
            defaultBranch
          );

          // Convert createOrUpdateFile response to source/readme format
          source = {
            path: `${directory}/${filename}`,
            sha: sourceFile.content?.sha || "empty-repo-upload",
          };
          readme = {
            path: `${directory}/README.md`,
            sha: readmeFile.content?.sha || "empty-repo-upload",
          };

          log.info("Empty repository initialized with problem files");
        } catch (initError) {
          log.error("Error initializing empty repository:", initError);
          throw initError;
        }
      } else {
        // Existing repository - use tree/commit workflow
        const sourceBlob = await git.createBlob(sourceText, `${directory}/${filename}`);
        const readmeBlob = await git.createBlob(readmeText, `${directory}/README.md`);

        source = { path: sourceBlob.path, sha: sourceBlob.sha };
        readme = { path: readmeBlob.path, sha: readmeBlob.sha };

        const treeSHA = await git.createTree(refSHA, [sourceBlob, readmeBlob]);
        commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
        await git.updateHead(ref!, commitSHA);
      }

      // Update statistics
      if (stats.submission) {
        updateObjectDatafromPath(stats.submission as Record<string, unknown>, `${hook}/${source.path}`, source.sha);
        updateObjectDatafromPath(stats.submission as Record<string, unknown>, `${hook}/${readme.path}`, readme.sha);
      }
      await saveStats(stats);

      // Execute callback
      if (typeof callback === "function" && stats.branches) {
        callback(stats.branches, directory);
      }

      log.info("Upload completed successfully", directory);

      return {
        success: true,
        uploadedFiles: {
          source: {
            path: source.path,
            sha: source.sha,
          },
          readme: {
            path: readme.path,
            sha: readme.sha,
          },
        },
        directory,
        commitSHA,
      };
    } catch (error) {
      log.error("Upload failed:", error);
      throw error;
    }
  }

  /**
   * Upload a single file
   * Use when README and source code need to be uploaded separately
   *
   * @param token - GitHub API token
   * @param hook - GitHub repository (username/repo format)
   * @param content - File content
   * @param path - File path (including directory)
   * @param commitMessage - Commit message
   */
  static async uploadSingleFile(
    token: string,
    hook: string,
    content: string,
    path: string,
    commitMessage: string
  ): Promise<UploadResult> {
    try {
      const git = new GitHub(hook, token);
      const stats = await getStats();

      // Initialize stats object if needed
      if (!stats.branches) {
        stats.branches = {};
      }
      if (!stats.submission) {
        stats.submission = {};
      }

      let defaultBranch = stats.branches[hook];
      if (isNull(defaultBranch)) {
        try {
          defaultBranch = await git.getDefaultBranchOnRepo();
          stats.branches[hook] = defaultBranch;
        } catch (error) {
          log.error("Error getting default branch, using 'main':", error);
          defaultBranch = "main";
          stats.branches[hook] = defaultBranch;
        }
      }

      const { refSHA, ref } = await git.getReference(defaultBranch);
      const file = await git.createBlob(content, path);
      const treeSHA = await git.createTree(refSHA!, [file]);
      const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA!);
      await git.updateHead(ref!, commitSHA);

      if (stats.submission) {
        updateObjectDatafromPath(stats.submission as Record<string, unknown>, `${hook}/${file.path}`, file.sha);
      }
      await saveStats(stats);

      log.info("Single file upload completed successfully", path);

      return {
        success: true,
        uploadedFile: {
          path: file.path,
          sha: file.sha,
        },
        commitSHA,
      };
    } catch (error) {
      log.error("Single file upload failed:", error);
      throw error;
    }
  }
}

/**
 * Factory for creating platform-specific upload handlers
 */
export class UploadHandlerFactory {
  /**
   * Create an upload handler for a specific platform
   * @param platformName - Name of the platform
   * @param parseDataFunction - Platform-specific data parsing function
   * @param uploadFunction - Platform-specific upload function
   * @param markFunction - Platform-specific mark function
   * @param startUploadFunction - Platform-specific start upload function
   */
  static create(
    platformName: string,
    parseDataFunction: ParseDataFunction,
    _uploadFunction: unknown,
    _markFunction: MarkFunction,
    startUploadFunction?: StartUploadFunction
  ): () => Promise<UploadHandlerResult> {
    return async function () {
      try {
        const rawData = await parseDataFunction();

        if (isNull(rawData)) {
          log.debug(`${platformName}: parseDataFunction returned null/undefined`);
          return { success: false, error: "Parse data failed" };
        }

        const processedData = preProcessEmptyObj(rawData as Record<string, unknown>);
        log.debug(`${platformName} processed data:`, processedData);

        if (isEmpty(processedData) || isNull(processedData)) {
          log.debug(`No data to upload for ${platformName}`);
          return { success: false, error: "No data to upload" };
        }

        // Signal start of upload process
        if (startUploadFunction) {
          startUploadFunction();
        }

        return { success: true, data: processedData };
      } catch (error) {
        log.error(`Error in ${platformName} upload handler:`, error);
        throw error;
      }
    };
  }
}
