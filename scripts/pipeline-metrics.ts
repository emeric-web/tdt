import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  jobsToCsv,
  renderSummary,
  type Incident,
  type Job,
  type Release,
  type Run,
} from "./pipeline-metrics/compute";

const WORKFLOWS = ["ci.yml", "release.yml"];

const repository = process.env.GITHUB_REPOSITORY;
if (!repository) {
  throw new Error("GITHUB_REPOSITORY must be set (owner/repo).");
}

const windowDays = Number(process.env.METRICS_DAYS ?? 28);
const outDir = process.env.METRICS_OUT_DIR ?? "metrics";
const defaultBranch = process.env.DEFAULT_BRANCH ?? "main";

// `gh api --paginate --jq` imprime un objet JSON par ligne.
function ghList<T>(path: string, jq: string): T[] {
  const output = execFileSync("gh", ["api", "--paginate", path, "--jq", jq], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}

function git(...args: string[]): string[] {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "");
}

const generatedAt = new Date();
const since = new Date(generatedAt.getTime() - windowDays * 86_400_000)
  .toISOString()
  .slice(0, 10);

const runs: Run[] = [];
const jobs: Job[] = [];

for (const file of WORKFLOWS) {
  const workflow = file.replace(/\.yml$/, "");
  const workflowRuns = ghList<Run>(
    `repos/${repository}/actions/workflows/${file}/runs?status=completed&per_page=100&created=${encodeURIComponent(
      `>=${since}`,
    )}`,
    ".workflow_runs[] | {id, branch: .head_branch, event, createdAt: .created_at, conclusion}",
  );

  for (const run of workflowRuns) {
    runs.push({ ...run, workflow });
    const runJobs = ghList<Omit<Job, "runId" | "workflow">>(
      `repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
      ".jobs[] | {name, conclusion, startedAt: .started_at, completedAt: .completed_at}",
    );
    jobs.push(...runJobs.map((job) => ({ ...job, runId: run.id, workflow })));
  }
}

const rawReleases = ghList<{ tag: string; publishedAt: string }>(
  `repos/${repository}/releases?per_page=100`,
  ".[] | select(.draft | not) | {tag: .tag_name, publishedAt: .published_at}",
).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

const releases: Release[] = rawReleases.map((release, index) => {
  const previous = rawReleases[index - 1];
  const range = previous ? `${previous.tag}..${release.tag}` : release.tag;
  try {
    const dates = git("log", "--format=%aI", range).sort(
      (a, b) => Date.parse(a) - Date.parse(b),
    );
    return { ...release, firstCommitAt: dates[0] ?? null };
  } catch {
    console.warn(`Tag ${release.tag} introuvable : délai de livraison ignoré.`);
    return { ...release, firstCommitAt: null };
  }
});

const incidents = ghList<Incident & { isPullRequest: boolean }>(
  `repos/${repository}/issues?labels=incident&state=all&per_page=100`,
  '.[] | {number, title, body: (.body // ""), createdAt: .created_at, closedAt: .closed_at, isPullRequest: (.pull_request != null)}',
).filter((incident) => !incident.isPullRequest);

const summary = renderSummary({
  repository,
  windowDays,
  generatedAt,
  runs,
  jobs,
  releases,
  incidents,
  defaultBranch,
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "pipeline-jobs.csv"), jobsToCsv(runs, jobs));
writeFileSync(join(outDir, "summary.md"), summary);

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
