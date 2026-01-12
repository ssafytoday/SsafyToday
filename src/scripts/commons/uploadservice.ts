import { GitHub } from './github';
import {
  getToken,
  getHook,
  getStats,
  saveStats,
  updateObjectDatafromPath,
  getGithubUsername,
} from './storage';
import { isNull, log } from './util';
import DjangoAPIService from './djangoapi';
import type {
  UploadProblemData,
  UploadResult,
  UploadCallback,
  StorageStats,
  GitHubTreeItem,
} from '@types';

type NestedObject = { [key: string]: NestedObject | string };

/**
 * 모든 플랫폼에서 공통으로 사용할 수 있는 업로드 서비스 클래스
 * GitHub API를 사용하여 코드, README 등의 파일을 GitHub 저장소에 업로드합니다.
 */
export default class UploadService {
  /**
   * 문제 데이터를 GitHub에 업로드합니다.
   *
   * @param problemData - 업로드할 문제 데이터
   * @param callback - 업로드 완료 후 실행할 콜백 함수
   * @returns Promise<UploadResult | void>
   */
  static async uploadProblem(
    problemData: UploadProblemData,
    callback?: UploadCallback
  ): Promise<UploadResult | void> {
    try {
      const { code, readme, directory, fileName, message } = problemData;

      const token = await getToken();
      const hook = await getHook();

      if (isNull(token) || isNull(hook)) {
        console.error('Token or hook is null', token, hook);
        return Promise.resolve();
      }

      // GitHub 업로드 수행
      const result = await this.upload(
        token!,
        hook!,
        code,
        readme,
        directory,
        fileName,
        message,
        callback
      );

      // GitHub 업로드 성공 시 SSAFY Today 백엔드로도 전송
      if (result && result.success) {
        const githubUsername = await getGithubUsername();
        if (githubUsername) {
          const djangoResult = await DjangoAPIService.sendSubmission(problemData, githubUsername, {
            hook,
            directory,
            fileName,
            message,
          });

          if (!djangoResult.success && !djangoResult.skipped) {
            log('SSAFY Today API submission failed:', djangoResult.error);
            // Django 실패는 사용자에게 별도 알림하지 않음 (GitHub 업로드는 성공)
          } else if (djangoResult.success && !djangoResult.skipped) {
            log('SSAFY Today API submission successful');
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error uploading problem:', error);
      throw error;
    }
  }

  /**
   * GitHub API를 사용하여 파일을 업로드합니다.
   *
   * @param token - GitHub API 토큰
   * @param hook - GitHub 저장소 (username/repo 형식)
   * @param sourceText - 업로드할 소스코드
   * @param readmeText - 업로드할 README 내용
   * @param directory - 업로드할 디렉토리 경로
   * @param filename - 업로드할 파일명
   * @param commitMessage - 커밋 메시지
   * @param callback - 업로드 완료 후 실행할 콜백 함수
   * @returns Promise<UploadResult>
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
      const stats = (await getStats()) as StorageStats;

      // branches 초기화
      if (!stats.branches) {
        stats.branches = {};
      }

      // 기본 브랜치 확인
      let defaultBranch = stats.branches[hook];
      if (isNull(defaultBranch)) {
        defaultBranch = await git.getDefaultBranchOnRepo();
        stats.branches[hook] = defaultBranch;
      }

      // GitHub 업로드 작업 수행
      const { refSHA, ref } = await git.getReference(defaultBranch);
      const source: GitHubTreeItem = await git.createBlob(sourceText, `${directory}/${filename}`);
      const readme: GitHubTreeItem = await git.createBlob(readmeText, `${directory}/README.md`);
      const treeSHA = await git.createTree(refSHA, [source, readme]);
      const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
      await git.updateHead(ref, commitSHA);

      // 통계 정보 업데이트
      updateObjectDatafromPath(
        stats.submission as NestedObject,
        `${hook}/${source.path}`,
        source.sha
      );
      updateObjectDatafromPath(
        stats.submission as NestedObject,
        `${hook}/${readme.path}`,
        readme.sha
      );
      await saveStats(stats);

      // 콜백 함수 실행
      if (typeof callback === 'function' && stats.branches) {
        callback(stats.branches, directory);
      }

      log('Upload completed successfully', directory);

      // 업로드 결과 정보 반환
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
      log('Upload failed:', error);
      throw error;
    }
  }

  /**
   * 파일 하나만 업로드합니다.
   * README와 소스코드를 분리해서 업로드해야 할 경우 사용합니다.
   *
   * @param token - GitHub API 토큰
   * @param hook - GitHub 저장소 (username/repo 형식)
   * @param content - 파일 내용
   * @param path - 파일 경로 (디렉토리 포함)
   * @param commitMessage - 커밋 메시지
   * @returns Promise<UploadResult>
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
      const stats = (await getStats()) as StorageStats;

      // branches 초기화
      if (!stats.branches) {
        stats.branches = {};
      }

      let defaultBranch = stats.branches[hook];
      if (isNull(defaultBranch)) {
        defaultBranch = await git.getDefaultBranchOnRepo();
        stats.branches[hook] = defaultBranch;
      }

      const { refSHA, ref } = await git.getReference(defaultBranch);
      const file: GitHubTreeItem = await git.createBlob(content, path);
      const treeSHA = await git.createTree(refSHA, [file]);
      const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
      await git.updateHead(ref, commitSHA);

      updateObjectDatafromPath(stats.submission as NestedObject, `${hook}/${file.path}`, file.sha);
      await saveStats(stats);

      log('Single file upload completed successfully', path);

      return {
        success: true,
        uploadedFiles: {
          source: {
            path: file.path,
            sha: file.sha,
          },
        },
        directory: path.substring(0, path.lastIndexOf('/')),
        commitSHA,
      };
    } catch (error) {
      log('Single file upload failed:', error);
      throw error;
    }
  }
}
