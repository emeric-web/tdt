export type Run = {
  id: number;
  workflow: string;
  branch: string;
  event: string;
  createdAt: string;
  conclusion: string | null;
};

export type Job = {
  runId: number;
  workflow: string;
  name: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type Release = {
  tag: string;
  publishedAt: string;
  firstCommitAt: string | null;
};

export type Incident = {
  number: number;
  title: string;
  body: string;
  createdAt: string;
  closedAt: string | null;
};

export type JobStat = {
  workflow: string;
  name: string;
  runs: number;
  failures: number;
  successRate: number;
  medianSeconds: number;
  maxSeconds: number;
};

export type WeekStat = {
  week: string;
  runs: number;
  failures: number;
  successRate: number;
  releases: number;
};

export type Dora = {
  windowDays: number;
  releasesInWindow: number;
  deploymentsPerWeek: number;
  leadTimeMedianHours: number | null;
  releasesTotal: number;
  failedReleases: number;
  changeFailureRate: number | null;
  incidentsClosed: number;
  mttrMedianHours: number | null;
};

const FINISHED = new Set(["success", "failure"]);
const DAY_MS = 86_400_000;

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const jobSeconds = (job: Job): number | null => {
  if (!job.startedAt || !job.completedAt) return null;
  const seconds =
    (Date.parse(job.completedAt) - Date.parse(job.startedAt)) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

const percent = (part: number, total: number): number =>
  total === 0 ? 0 : (part / total) * 100;

const finishedJobs = (jobs: Job[]): Job[] =>
  jobs.filter(
    (job) =>
      job.conclusion !== null &&
      FINISHED.has(job.conclusion) &&
      jobSeconds(job) !== null,
  );

export function jobStats(jobs: Job[]): JobStat[] {
  const groups = new Map<string, Job[]>();
  for (const job of finishedJobs(jobs)) {
    const key = `${job.workflow}\u0000${job.name}`;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }

  return [...groups.values()]
    .map((group) => {
      const seconds = group.map((job) => jobSeconds(job) as number);
      const failures = group.filter((job) => job.conclusion === "failure");
      return {
        workflow: group[0].workflow,
        name: group[0].name,
        runs: group.length,
        failures: failures.length,
        successRate: percent(group.length - failures.length, group.length),
        medianSeconds: median(seconds),
        maxSeconds: Math.max(...seconds),
      };
    })
    .sort((a, b) =>
      `${a.workflow}${a.name}`.localeCompare(`${b.workflow}${b.name}`),
    );
}

export function weekStart(iso: string): string {
  const date = new Date(iso);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      dayFromMonday * DAY_MS,
  );
  return monday.toISOString().slice(0, 10);
}

export function weeklyStats(runs: Run[], releases: Release[]): WeekStat[] {
  const weeks = new Map<string, WeekStat>();
  const entry = (week: string): WeekStat => {
    const existing = weeks.get(week);
    if (existing) return existing;
    const created = {
      week,
      runs: 0,
      failures: 0,
      successRate: 0,
      releases: 0,
    };
    weeks.set(week, created);
    return created;
  };

  for (const run of runs) {
    if (run.conclusion === null || !FINISHED.has(run.conclusion)) continue;
    const stat = entry(weekStart(run.createdAt));
    stat.runs += 1;
    if (run.conclusion === "failure") stat.failures += 1;
  }
  for (const release of releases) {
    entry(weekStart(release.publishedAt)).releases += 1;
  }
  for (const stat of weeks.values()) {
    stat.successRate = percent(stat.runs - stat.failures, stat.runs);
  }

  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
}

const mentionsRelease = (incident: Incident, tag: string): boolean => {
  const version = tag.replace(/^v/, "").replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^\\d.])v?${version}(?![\\d]|\\.\\d)`);
  return pattern.test(`${incident.title}\n${incident.body}`);
};

const hours = (from: string, to: string): number =>
  (Date.parse(to) - Date.parse(from)) / 3_600_000;

export function dora(
  releases: Release[],
  incidents: Incident[],
  now: Date,
  windowDays: number,
): Dora {
  const since = now.getTime() - windowDays * DAY_MS;
  const inWindow = releases.filter(
    (release) => Date.parse(release.publishedAt) >= since,
  );
  const leadTimes = inWindow
    .filter((release) => release.firstCommitAt !== null)
    .map((release) =>
      hours(release.firstCommitAt as string, release.publishedAt),
    );
  const failedReleases = releases.filter((release) =>
    incidents.some((incident) => mentionsRelease(incident, release.tag)),
  );
  const restoreTimes = incidents
    .filter((incident) => incident.closedAt !== null)
    .map((incident) => hours(incident.createdAt, incident.closedAt as string));

  return {
    windowDays,
    releasesInWindow: inWindow.length,
    deploymentsPerWeek: inWindow.length / (windowDays / 7),
    leadTimeMedianHours: leadTimes.length === 0 ? null : median(leadTimes),
    releasesTotal: releases.length,
    failedReleases: failedReleases.length,
    changeFailureRate:
      releases.length === 0
        ? null
        : percent(failedReleases.length, releases.length),
    incidentsClosed: restoreTimes.length,
    mttrMedianHours: restoreTimes.length === 0 ? null : median(restoreTimes),
  };
}

export function alerts(
  runs: Run[],
  jobs: Job[],
  defaultBranch: string,
): string[] {
  const messages: string[] = [];

  const workflows = new Set(runs.map((run) => run.workflow));
  for (const workflow of workflows) {
    const latest = runs
      .filter(
        (run) =>
          run.workflow === workflow &&
          run.branch === defaultBranch &&
          run.conclusion !== null &&
          FINISHED.has(run.conclusion),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 2);
    if (
      latest.length === 2 &&
      latest.every((r) => r.conclusion === "failure")
    ) {
      messages.push(
        `${workflow} : 2 échecs consécutifs sur ${defaultBranch} (runs ${latest
          .map((run) => `#${run.id}`)
          .join(", ")}).`,
      );
    }
  }

  const finished = finishedJobs(jobs);
  for (const stat of jobStats(jobs)) {
    if (stat.runs < 3) continue;
    const latest = finished
      .filter((job) => job.workflow === stat.workflow && job.name === stat.name)
      .sort((a, b) =>
        (b.startedAt as string).localeCompare(a.startedAt as string),
      )[0];
    const seconds = jobSeconds(latest) as number;
    if (seconds > 2 * stat.medianSeconds) {
      messages.push(
        `${stat.workflow} / ${stat.name} : dernière durée ${formatDuration(
          seconds,
        )}, plus de 2 fois la médiane (${formatDuration(stat.medianSeconds)}).`,
      );
    }
  }

  return messages;
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  return minutes === 0
    ? `${rounded} s`
    : `${minutes} min ${String(rounded % 60).padStart(2, "0")} s`;
}

const formatHours = (value: number | null): string => {
  if (value === null) return "n/a";
  return value < 48 ? `${value.toFixed(1)} h` : `${(value / 24).toFixed(1)} j`;
};

const formatPercent = (value: number | null): string =>
  value === null ? "n/a" : `${value.toFixed(0)} %`;

export function jobsToCsv(runs: Run[], jobs: Job[]): string {
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const lines = [
    "run_id,workflow,branch,event,run_created_at,job,conclusion,duration_seconds",
  ];
  for (const job of jobs) {
    const run = runsById.get(job.runId);
    const seconds = jobSeconds(job);
    lines.push(
      [
        job.runId,
        job.workflow,
        run?.branch ?? "",
        run?.event ?? "",
        run?.createdAt ?? "",
        `"${job.name.replace(/"/g, '""')}"`,
        job.conclusion ?? "",
        seconds === null ? "" : seconds,
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderSummary(input: {
  repository: string;
  windowDays: number;
  generatedAt: Date;
  runs: Run[];
  jobs: Job[];
  releases: Release[];
  incidents: Incident[];
  defaultBranch: string;
}): string {
  const { windowDays, generatedAt, runs, jobs, releases, incidents } = input;
  const metrics = dora(releases, incidents, generatedAt, windowDays);
  const alertMessages = alerts(runs, jobs, input.defaultBranch);
  const lines: string[] = [
    `# Métriques du pipeline : ${input.repository}`,
    "",
    `Fenêtre d'analyse : ${windowDays} derniers jours, générée le ${generatedAt
      .toISOString()
      .slice(0, 10)}.`,
    "",
    "## Alertes",
    "",
    ...(alertMessages.length === 0
      ? ["Aucune alerte."]
      : alertMessages.map((message) => `- ⚠️ ${message}`)),
    "",
    "## Tendance hebdomadaire",
    "",
    "| Semaine (lundi) | Exécutions terminées | Échecs | Taux de réussite | Releases |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...weeklyStats(runs, releases).map(
      (week) =>
        `| ${week.week} | ${week.runs} | ${week.failures} | ${formatPercent(
          week.runs === 0 ? null : week.successRate,
        )} | ${week.releases} |`,
    ),
    "",
    "## Jobs",
    "",
    "| Workflow | Job | Exécutions | Échecs | Taux de réussite | Durée médiane | Durée maximale |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...jobStats(jobs).map(
      (stat) =>
        `| ${stat.workflow} | ${stat.name} | ${stat.runs} | ${
          stat.failures
        } | ${formatPercent(stat.successRate)} | ${formatDuration(
          stat.medianSeconds,
        )} | ${formatDuration(stat.maxSeconds)} |`,
    ),
    "",
    "## Métriques DORA",
    "",
    "| Métrique | Valeur | Base de calcul |",
    "| --- | ---: | --- |",
    `| Fréquence de déploiement | ${metrics.deploymentsPerWeek.toFixed(
      2,
    )} / semaine | ${metrics.releasesInWindow} release(s) sur ${windowDays} jours |`,
    `| Délai de livraison (médiane) | ${formatHours(
      metrics.leadTimeMedianHours,
    )} | Du premier commit de la version à la publication de la release |`,
    `| Taux d'échec des changements | ${formatPercent(
      metrics.changeFailureRate,
    )} | ${metrics.failedReleases} release(s) citée(s) par une issue « incident » sur ${
      metrics.releasesTotal
    } au total |`,
    `| Délai de rétablissement (médiane) | ${formatHours(
      metrics.mttrMedianHours,
    )} | ${metrics.incidentsClosed} incident(s) clos |`,
    "",
  ];
  return lines.join("\n");
}
