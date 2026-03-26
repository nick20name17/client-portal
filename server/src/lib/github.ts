const GITHUB_REPO_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

export function parseGithubRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  const m = repoUrl.trim().match(GITHUB_REPO_RE);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export function buildGithubRawUrl(owner: string, repo: string, ref: string, path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${p}`;
}

export type GithubTreeBlob = {
  path: string;
  type: string;
  sha: string;
  url?: string;
};

export async function fetchGithubTreeRecursive(
  owner: string,
  repo: string,
  ref: string = "HEAD",
): Promise<GithubTreeBlob[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { tree?: GithubTreeBlob[] };
  return data.tree ?? [];
}
