import { log, b64EncodeUnicode } from './util';
import urls from '@/constants/url';
import type { GitHubReference, GitHubTreeItem } from '@types';

/**
 * Get a repo default branch
 * @see https://docs.github.com/en/rest/reference/repos
 * @param hook - the github repository
 * @param token - the github token
 * @returns the default branch name
 */
export async function getDefaultBranchOnRepo(hook: string, token: string): Promise<string> {
  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}`, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  const data = await response.json();
  return data.default_branch;
}

/**
 * Get a reference
 * @see https://docs.github.com/en/rest/reference/git#get-a-reference
 * @param hook - github repository
 * @param token - github token
 * @param branch - reference name (default: "main")
 * @returns the reference SHA and ref
 */
export async function getReference(
  hook: string,
  token: string,
  branch: string = 'main'
): Promise<GitHubReference> {
  const response = await fetch(
    `${urls.GITHUB_API_REPOS_URL}/${hook}/git/refs/heads/${branch}`,
    {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  const data = await response.json();
  return { refSHA: data.object.sha, ref: data.ref };
}

/**
 * Create a Blob
 * @see https://docs.github.com/en/rest/reference/git#create-a-blob
 * @param hook - github repository
 * @param token - github token
 * @param content - the content to add to the repository
 * @param path - the path to add the repository
 * @returns the tree_item object
 */
export async function createBlob(
  hook: string,
  token: string,
  content: string,
  path: string
): Promise<GitHubTreeItem> {
  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content: b64EncodeUnicode(content),
      encoding: 'base64',
    }),
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'content-type': 'application/json',
    },
  });
  const data = await response.json();
  return {
    path,
    sha: data.sha,
    mode: '100644',
    type: 'blob',
  };
}

/**
 * Create a new tree in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-tree
 * @param hook - the github repository
 * @param token - the github token
 * @param refSHA - the root sha of the tree
 * @param treeItems - the tree items
 * @returns the tree SHA
 */
export async function createTree(
  hook: string,
  token: string,
  refSHA: string,
  treeItems: GitHubTreeItem[]
): Promise<string> {
  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree: treeItems, base_tree: refSHA }),
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'content-type': 'application/json',
    },
  });
  const data = await response.json();
  return data.sha;
}

/**
 * Create a commit in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-commit
 * @param hook - the github repository
 * @param token - the github token
 * @param message - the commit message
 * @param treeSHA - the tree sha
 * @param refSHA - the parent sha
 * @returns the commit SHA
 */
export async function createCommit(
  hook: string,
  token: string,
  message: string,
  treeSHA: string,
  refSHA: string
): Promise<string> {
  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSHA, parents: [refSHA] }),
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'content-type': 'application/json',
    },
  });
  const data = await response.json();
  return data.sha;
}

/**
 * Update a ref
 * @see https://docs.github.com/en/rest/reference/git#update-a-reference
 * @param hook - the github repository
 * @param token - the github token
 * @param ref - the ref to update
 * @param commitSHA - the commit sha
 * @param force - force update (default: true)
 * @returns the updated ref SHA
 */
export async function updateHead(
  hook: string,
  token: string,
  ref: string,
  commitSHA: string,
  force: boolean = true
): Promise<string> {
  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/${ref}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSHA, force }),
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'content-type': 'application/json',
    },
  });
  const data = await response.json();
  return data.sha;
}

/**
 * Get a tree recursively
 * @see https://docs.github.com/en/rest/reference/git#get-a-tree
 * @param hook - the github repository
 * @param token - the github token
 * @returns the tree items
 */
export async function getTree(hook: string, token: string): Promise<GitHubTreeItem[]> {
  const response = await fetch(
    `${urls.GITHUB_API_REPOS_URL}/${hook}/git/trees/HEAD?recursive=1`,
    {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  const data = await response.json();
  return data.tree;
}

/**
 * GitHub API wrapper class
 */
export class GitHub {
  private hook: string;
  private token: string;

  constructor(hook: string, token: string) {
    log('GitHub constructor', hook, token);
    this.hook = hook;
    this.token = token;
  }

  update(hook: string, token: string): void {
    this.hook = hook;
    this.token = token;
  }

  async getReference(branch: string = 'main'): Promise<GitHubReference> {
    return getReference(this.hook, this.token, branch);
  }

  async getDefaultBranchOnRepo(): Promise<string> {
    return getDefaultBranchOnRepo(this.hook, this.token);
  }

  async createBlob(content: string, path: string): Promise<GitHubTreeItem> {
    return createBlob(this.hook, this.token, content, path);
  }

  async createTree(refSHA: string, treeItems: GitHubTreeItem[]): Promise<string> {
    log('GitHub createTree', 'refSHA:', refSHA, 'tree_items:', treeItems);
    return createTree(this.hook, this.token, refSHA, treeItems);
  }

  async createCommit(message: string, treeSHA: string, refSHA: string): Promise<string> {
    log('GitHub createCommit', 'message:', message, 'treeSHA:', treeSHA, 'refSHA:', refSHA);
    return createCommit(this.hook, this.token, message, treeSHA, refSHA);
  }

  async updateHead(ref: string, commitSHA: string): Promise<string> {
    log('GitHub updateHead', 'ref:', ref, 'commitSHA:', commitSHA);
    return updateHead(this.hook, this.token, ref, commitSHA, true);
  }

  async getTree(): Promise<GitHubTreeItem[]> {
    return getTree(this.hook, this.token);
  }
}
