import { describe, expect, it } from "vitest";

import {
  alerts,
  dora,
  jobStats,
  jobsToCsv,
  median,
  renderSummary,
  weekStart,
  weeklyStats,
  type Incident,
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

describe("dora", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const releases: Release[] = [
    {
      tag: "v1.0.0",
      publishedAt: "2026-11-02T12:00:00Z",
      firstCommitAt: "2026-11-02T00:00:00Z",
    },
    {
      tag: "v1.1.0",
      publishedAt: "2026-11-05T12:00:00Z",
      firstCommitAt: "2026-11-05T06:00:00Z",
    },
    {
      tag: "v1.10.0",
      publishedAt: "2026-11-08T12:00:00Z",
      firstCommitAt: null,
    },
  ];

  it("returns empty values without inventing incident figures", () => {
    const metrics = dora([], [], now, 14);

    expect(metrics.deploymentsPerWeek).toBe(0);
    expect(metrics.leadTimeMedianHours).toBeNull();
    expect(metrics.changeFailureRate).toBeNull();
    expect(metrics.mttrMedianHours).toBeNull();
  });

  it("computes frequency, lead time, failure rate and recovery time", () => {
    const incidents: Incident[] = [
      {
        number: 4,
        title: "Erreur après la release v1.1.0",
        body: "",
        createdAt: "2026-11-06T08:00:00Z",
        closedAt: "2026-11-06T14:00:00Z",
      },
      {
        number: 5,
        title: "Panne",
        body: "Version 1.1.0 concernée",
        createdAt: "2026-11-07T08:00:00Z",
        closedAt: null,
      },
    ];

    const metrics = dora(releases, incidents, now, 14);

    expect(metrics.releasesInWindow).toBe(3);
    expect(metrics.deploymentsPerWeek).toBeCloseTo(1.5);
    expect(metrics.leadTimeMedianHours).toBe(9);
    expect(metrics.failedReleases).toBe(1);
    expect(metrics.changeFailureRate).toBeCloseTo(100 / 3);
    expect(metrics.incidentsClosed).toBe(1);
    expect(metrics.mttrMedianHours).toBe(6);
  });

  it("does not confuse 1.1.0 with 1.10.0 or 11.1.0", () => {
    const incidents: Incident[] = [
      {
        number: 1,
        title: "Bug en 1.10.0 puis 11.1.0",
        body: "",
        createdAt: "2026-11-06T08:00:00Z",
        closedAt: null,
      },
    ];

    expect(dora(releases, incidents, now, 14).failedReleases).toBe(1);
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
      incidents: [],
      defaultBranch: "main",
    });

    expect(summary).toContain("Aucune alerte.");
    expect(summary).toContain("| Taux d'échec des changements | n/a |");
    expect(summary).toContain("| Délai de rétablissement (médiane) | n/a |");
  });
});
