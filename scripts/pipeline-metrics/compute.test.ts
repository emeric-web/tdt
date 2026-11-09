import { describe, expect, it } from "vitest";

import {
  alerts,
  deployments,
  dora,
  jobStats,
  jobsToCsv,
  median,
  renderSummary,
  weekStart,
  weeklyStats,
  type DeployRun,
  type Deployment,
  type Job,
  type Release,
  type Run,
} from "./compute";

const job = (
  name: string,
  conclusion: string,
  seconds: number,
  start = "2026-10-26T10:00:00Z",
  runId = 1,
): Job => ({
  runId,
  workflow: "ci",
  name,
  conclusion,
  startedAt: start,
  completedAt: new Date(Date.parse(start) + seconds * 1000).toISOString(),
});

const run = (
  id: number,
  conclusion: string,
  createdAt: string,
  branch = "main",
): Run => ({
  id,
  workflow: "ci",
  branch,
  event: "push",
  createdAt,
  conclusion,
});

describe("median", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("jobStats", () => {
  it("ignores cancelled jobs and computes rate, median and max", () => {
    const stats = jobStats([
      job("tests", "success", 100),
      job("tests", "failure", 300),
      job("tests", "success", 200),
      job("tests", "cancelled", 5),
    ]);

    expect(stats).toEqual([
      {
        workflow: "ci",
        name: "tests",
        runs: 3,
        failures: 1,
        successRate: (2 / 3) * 100,
        medianSeconds: 200,
        maxSeconds: 300,
      },
    ]);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week in UTC", () => {
    expect(weekStart("2026-10-29T09:00:00Z")).toBe("2026-10-26");
    expect(weekStart("2026-11-01T23:00:00Z")).toBe("2026-10-26");
    expect(weekStart("2026-10-26T00:00:00Z")).toBe("2026-10-26");
  });
});

describe("weeklyStats", () => {
  it("groups finished runs and releases by week", () => {
    const releases: Release[] = [
      {
        tag: "v1.0.0",
        publishedAt: "2026-11-03T10:00:00Z",
        firstCommitAt: null,
      },
    ];
    const stats = weeklyStats(
      [
        run(1, "success", "2026-10-27T10:00:00Z"),
        run(2, "failure", "2026-10-28T10:00:00Z"),
        run(3, "cancelled", "2026-10-28T11:00:00Z"),
      ],
      releases,
    );

    expect(stats).toEqual([
      {
        week: "2026-10-26",
        runs: 2,
        failures: 1,
        successRate: 50,
        releases: 0,
      },
      { week: "2026-11-02", runs: 0, failures: 0, successRate: 0, releases: 1 },
    ]);
  });
});

const deployRun = (
  id: number,
  start: string,
  overrides: Partial<DeployRun> = {},
): DeployRun => ({
  id,
  title: "Déploiement TDT",
  jobName: "Déploiement en production",
  conclusion: "success",
  startedAt: start,
  completedAt: new Date(Date.parse(start) + 120_000).toISOString(),
  ...overrides,
});

describe("deployments", () => {
  const releases: Release[] = [
    { tag: "v1.3.0", publishedAt: "2026-11-03T16:00:00Z", firstCommitAt: null },
    { tag: "v1.3.1", publishedAt: "2026-11-03T19:00:00Z", firstCommitAt: null },
  ];

  it("excludes simulations, cancelled runs and unfinished runs", () => {
    const result = deployments(
      [
        deployRun(1, "2026-11-03T17:00:00Z", {
          jobName: "Test de déploiement",
        }),
        deployRun(2, "2026-11-03T17:10:00Z", { conclusion: "cancelled" }),
        deployRun(3, "2026-11-03T17:20:00Z", { completedAt: null }),
        deployRun(4, "2026-11-03T17:30:00Z"),
      ],
      releases,
    );

    expect(result.map((deployment) => deployment.startedAt)).toEqual([
      "2026-11-03T17:30:00Z",
    ]);
  });

  it("takes the version from the title, else from the latest release before the run", () => {
    const result = deployments(
      [
        deployRun(1, "2026-11-03T21:30:00Z"),
        deployRun(2, "2026-11-03T16:47:00Z"),
        deployRun(3, "2026-11-04T10:00:00Z", {
          title: "Déploiement TDT 1.3.0",
        }),
      ],
      releases,
    );

    expect(result.map((deployment) => deployment.version)).toEqual([
      "1.3.0",
      "1.3.1",
      "1.3.0",
    ]);
  });
});

describe("dora", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const releases: Release[] = [
    {
      tag: "v1.1.0",
      publishedAt: "2026-11-05T12:00:00Z",
      firstCommitAt: "2026-11-05T06:00:00Z",
    },
  ];
  const deployment = (
    startedAt: string,
    conclusion: Deployment["conclusion"] = "success",
    version: string | null = "1.1.0",
  ): Deployment => ({
    startedAt,
    completedAt: new Date(Date.parse(startedAt) + 120_000).toISOString(),
    conclusion,
    version,
  });

  it("returns empty values without inventing figures", () => {
    const metrics = dora([], [], now, 14);

    expect(metrics.deploymentsPerWeek).toBe(0);
    expect(metrics.leadTimeMedianHours).toBeNull();
    expect(metrics.changeFailureRate).toBeNull();
    expect(metrics.mttrMedianHours).toBeNull();
  });

  it("measures frequency and lead time up to the end of the deployment", () => {
    const metrics = dora(
      releases,
      [deployment("2026-11-05T17:58:00Z")],
      now,
      14,
    );

    expect(metrics.deploymentsPerWeek).toBeCloseTo(0.5);
    expect(metrics.leadTimeMedianHours).toBe(12);
    expect(metrics.changeFailureRate).toBe(0);
  });

  it("measures recovery from a failed deployment to the next success", () => {
    const metrics = dora(
      releases,
      [
        deployment("2026-11-05T12:00:00Z", "failure"),
        deployment("2026-11-05T18:00:00Z"),
      ],
      now,
      14,
    );

    expect(metrics.failedDeployments).toBe(1);
    expect(metrics.changeFailureRate).toBe(50);
    expect(metrics.mttrMedianHours).toBe(6);
  });

  it("leaves recovery empty when no success follows the failure", () => {
    const metrics = dora(
      releases,
      [deployment("2026-11-08T12:00:00Z", "failure")],
      now,
      14,
    );

    expect(metrics.mttrMedianHours).toBeNull();
  });

  it("ignores deployments older than the window", () => {
    const metrics = dora([], [deployment("2026-10-01T12:00:00Z")], now, 14);

    expect(metrics.deploymentsInWindow).toBe(0);
  });
});

describe("alerts", () => {
  it("flags two consecutive failures on the default branch", () => {
    const runs = [
      run(1, "success", "2026-10-25T10:00:00Z"),
      run(2, "failure", "2026-10-26T10:00:00Z"),
      run(3, "failure", "2026-10-27T10:00:00Z"),
      run(4, "failure", "2026-10-28T10:00:00Z", "feature"),
    ];

    expect(alerts(runs, [], "main")).toEqual([
      expect.stringContaining("2 échecs consécutifs"),
    ]);
  });

  it("does not flag a single failure", () => {
    const runs = [
      run(1, "failure", "2026-10-26T10:00:00Z"),
      run(2, "success", "2026-10-27T10:00:00Z"),
    ];

    expect(alerts(runs, [], "main")).toEqual([]);
  });

  it("flags a latest duration above twice the median", () => {
    const jobs = [
      job("tests", "success", 100, "2026-10-26T10:00:00Z"),
      job("tests", "success", 100, "2026-10-27T10:00:00Z"),
      job("tests", "success", 100, "2026-10-28T10:00:00Z"),
      job("tests", "success", 450, "2026-10-29T10:00:00Z"),
    ];

    expect(alerts([], jobs, "main")).toEqual([
      expect.stringContaining("plus de 2 fois la médiane"),
    ]);
  });
});

describe("jobsToCsv and renderSummary", () => {
  it("escapes job names in the CSV", () => {
    const csv = jobsToCsv(
      [run(1, "success", "2026-10-26T10:00:00Z")],
      [job('Tests "E2E"', "success", 60)],
    );

    expect(csv.split("\n")[1]).toBe(
      '1,ci,main,push,2026-10-26T10:00:00Z,"Tests ""E2E""",success,60',
    );
  });

  it("renders a summary with n/a when there is no data", () => {
    const summary = renderSummary({
      repository: "owner/repo",
      windowDays: 28,
      generatedAt: new Date("2026-11-10T00:00:00Z"),
      runs: [],
      jobs: [],
      releases: [],
      deployments: [],
      defaultBranch: "main",
    });

    expect(summary).toContain("Aucune alerte.");
    expect(summary).toContain("| Taux d'échec des changements | n/a |");
    expect(summary).toContain("| Délai de rétablissement (médiane) | n/a |");
  });
});
