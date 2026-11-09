import { describe, expect, it } from "vitest";

import {
  auditState,
  countBySeverity,
  devOnly,
  parseAudit,
  renderSummary,
  type Finding,
  type ParsedAudit,
} from "./compute";

const vulnerability = (severity: string, extra: object = {}) => ({
  severity,
  isDirect: false,
  via: [],
  ...extra,
});

const parsed = (vulnerabilities: Record<string, unknown>): ParsedAudit =>
  parseAudit({ auditReportVersion: 2, vulnerabilities });

describe("parseAudit", () => {
  it("accepts an empty report", () => {
    expect(parsed({})).toEqual({ ok: true, findings: [] });
  });

  it("extracts advisories and chain packages", () => {
    const result = parsed({
      deepmerge: vulnerability("low", {
        via: [{ title: "Prototype poisoning", url: "https://example.test/a" }],
      }),
      "swagger-client": vulnerability("low", {
        via: ["deepmerge"],
        isDirect: true,
      }),
    });
    expect(result).toEqual({
      ok: true,
      findings: [
        {
          name: "deepmerge",
          severity: "low",
          isDirect: false,
          advisories: [
            { title: "Prototype poisoning", url: "https://example.test/a" },
          ],
          via: [],
        },
        {
          name: "swagger-client",
          severity: "low",
          isDirect: true,
          advisories: [],
          via: ["deepmerge"],
        },
      ],
    });
  });

  it("reports a registry error instead of an empty result", () => {
    const result = parseAudit({
      message: "request failed",
      error: { summary: "", detail: "" },
    });
    expect(result).toEqual({
      ok: false,
      error: "Audit impossible : request failed",
    });
  });

  it("falls back to the error summary, then to a generic reason", () => {
    expect(
      parseAudit({ error: { code: "ENOTFOUND", summary: "network down" } }),
    ).toEqual({
      ok: false,
      error: "Audit impossible : network down",
    });
    expect(parseAudit({ error: {} })).toEqual({
      ok: false,
      error: "Audit impossible : erreur inconnue",
    });
  });

  it.each([null, "text", [], {}, { vulnerabilities: [] }])(
    "rejects unusable output %j",
    (raw) => {
      expect(parseAudit(raw).ok).toBe(false);
    },
  );

  it("rejects an unknown severity", () => {
    expect(parsed({ pkg: vulnerability("catastrophic") }).ok).toBe(false);
  });
});

describe("auditState", () => {
  it("is healthy without findings", () => {
    expect(auditState(parsed({}))).toBe("sain");
  });

  it("keeps low findings healthy", () => {
    expect(auditState(parsed({ a: vulnerability("low") }))).toBe("sain");
  });

  it("is acceptable for a moderate finding", () => {
    expect(
      auditState(
        parsed({ a: vulnerability("low"), b: vulnerability("moderate") }),
      ),
    ).toBe("passable");
  });

  it.each(["high", "critical"])("fails for a %s finding", (severity) => {
    expect(
      auditState(
        parsed({ a: vulnerability("moderate"), b: vulnerability(severity) }),
      ),
    ).toBe("echec");
  });

  it("fails when the audit could not run", () => {
    expect(auditState({ ok: false, error: "boom" })).toBe("echec");
  });
});

describe("countBySeverity and devOnly", () => {
  const finding = (name: string, severity: Finding["severity"]): Finding => ({
    name,
    severity,
    isDirect: false,
    advisories: [],
    via: [],
  });

  it("counts by severity", () => {
    expect(
      countBySeverity([
        finding("a", "low"),
        finding("b", "low"),
        finding("c", "high"),
      ]),
    ).toEqual({ info: 0, low: 2, moderate: 0, high: 1, critical: 0 });
  });

  it("keeps only packages absent from production", () => {
    const production = [finding("a", "low")];
    const all = [finding("a", "low"), finding("b", "moderate")];
    expect(devOnly(production, all)).toEqual([finding("b", "moderate")]);
  });
});

describe("renderSummary", () => {
  const generatedAt = new Date("2026-11-09T06:00:00Z");

  it("lists low findings while staying healthy and ignores dev tools for the state", () => {
    const production = parsed({
      deepmerge: vulnerability("low", {
        via: [
          { title: "Prototype | poisoning", url: "https://example.test/a" },
        ],
      }),
    });
    const all = parsed({
      deepmerge: vulnerability("low"),
      "semantic-release": vulnerability("moderate", { isDirect: true }),
    });
    const text = renderSummary({ generatedAt, production, all });
    expect(text).toContain("État : 🟢 Sain");
    expect(text).toContain("1 low");
    expect(text).toContain("[Prototype \\| poisoning](https://example.test/a)");
    expect(text).toContain("1 moderate");
  });

  it("shows the failure reason when the audit is impossible", () => {
    const text = renderSummary({
      generatedAt,
      production: { ok: false, error: "Audit impossible : network down" },
      all: { ok: false, error: "x" },
    });
    expect(text).toContain("État : 🔴 Échec");
    expect(text).toContain("Audit impossible : network down");
  });
});
