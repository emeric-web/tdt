export type Severity = "info" | "low" | "moderate" | "high" | "critical";

export type State = "sain" | "passable" | "echec";

export type Advisory = {
  title: string;
  url: string;
};

export type Finding = {
  name: string;
  severity: Severity;
  isDirect: boolean;
  advisories: Advisory[];
  via: string[];
};

export type ParsedAudit =
  { ok: true; findings: Finding[] } | { ok: false; error: string };

const SEVERITIES: Severity[] = ["info", "low", "moderate", "high", "critical"];

// Seule gravité qui ne dégrade pas l'état : les failles « low » restent listées.
const HEALTHY_MAX: Severity = "low";
const FAILING_MIN: Severity = "high";

const rank = (severity: Severity): number => SEVERITIES.indexOf(severity);

const isSeverity = (value: unknown): value is Severity =>
  typeof value === "string" && SEVERITIES.includes(value as Severity);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseAudit(raw: unknown): ParsedAudit {
  if (!isRecord(raw)) {
    return { ok: false, error: "Sortie de `npm audit` illisible." };
  }
  if (isRecord(raw.error)) {
    const candidates = [raw.message, raw.error.summary, raw.error.code];
    const reason = candidates.find(
      (value): value is string => typeof value === "string" && value !== "",
    );
    return {
      ok: false,
      error: `Audit impossible : ${reason ?? "erreur inconnue"}`,
    };
  }
  if (!isRecord(raw.vulnerabilities)) {
    return { ok: false, error: "Rapport sans section `vulnerabilities`." };
  }

  const findings: Finding[] = [];
  for (const [name, value] of Object.entries(raw.vulnerabilities)) {
    if (!isRecord(value) || !isSeverity(value.severity)) {
      return { ok: false, error: `Entrée invalide pour « ${name} ».` };
    }
    const via = Array.isArray(value.via) ? value.via : [];
    findings.push({
      name,
      severity: value.severity,
      isDirect: value.isDirect === true,
      advisories: via.flatMap((item) =>
        isRecord(item) && typeof item.title === "string"
          ? [
              {
                title: item.title,
                url: typeof item.url === "string" ? item.url : "",
              },
            ]
          : [],
      ),
      via: via.filter((item): item is string => typeof item === "string"),
    });
  }
  return { ok: true, findings };
}

export function maxSeverity(findings: Finding[]): Severity | null {
  let max: Severity | null = null;
  for (const finding of findings) {
    if (max === null || rank(finding.severity) > rank(max)) {
      max = finding.severity;
    }
  }
  return max;
}

export function auditState(production: ParsedAudit): State {
  if (!production.ok) return "echec";
  const max = maxSeverity(production.findings);
  if (max === null || rank(max) <= rank(HEALTHY_MAX)) return "sain";
  return rank(max) >= rank(FAILING_MIN) ? "echec" : "passable";
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

// Paquets signalés par l'audit complet mais absents de l'audit de production.
export function devOnly(production: Finding[], all: Finding[]): Finding[] {
  const productionNames = new Set(production.map((finding) => finding.name));
  return all.filter((finding) => !productionNames.has(finding.name));
}

const LABELS: Record<State, string> = {
  sain: "Sain",
  passable: "Passable",
  echec: "Échec",
};

const ICONS: Record<State, string> = {
  sain: "🟢",
  passable: "🟡",
  echec: "🔴",
};

const escapeCell = (text: string): string => text.replace(/\|/g, "\\|");

const formatCounts = (counts: Record<Severity, number>): string => {
  const parts = SEVERITIES.slice()
    .reverse()
    .filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${severity}`);
  return parts.length > 0 ? parts.join(", ") : "aucune";
};

export function renderSummary(input: {
  generatedAt: Date;
  production: ParsedAudit;
  all: ParsedAudit;
}): string {
  const { generatedAt, production, all } = input;
  const state = auditState(production);
  const lines = [
    "# Audit npm des dépendances",
    "",
    `Généré le ${generatedAt.toISOString().slice(0, 10)}. Périmètre de l'état : dépendances de production (\`npm audit --omit=dev\`).`,
    "",
    `## État : ${ICONS[state]} ${LABELS[state]}`,
    "",
    "| État | Gravité maximale en production |",
    "| ---- | ------------------------------ |",
    "| Sain | aucune, ou seulement `low` |",
    "| Passable | `moderate` |",
    "| Échec | `high`, `critical`, ou audit impossible |",
    "",
  ];

  if (!production.ok) {
    lines.push(`**${production.error}**`, "");
    return lines.join("\n");
  }

  lines.push(
    `Failles de production : ${formatCounts(countBySeverity(production.findings))}.`,
    "",
  );
  if (production.findings.length > 0) {
    lines.push(
      "| Paquet | Gravité | Direct | Faille |",
      "| ------ | ------- | ------ | ------ |",
    );
    const sorted = production.findings
      .slice()
      .sort(
        (a, b) =>
          rank(b.severity) - rank(a.severity) || a.name.localeCompare(b.name),
      );
    for (const finding of sorted) {
      const detail =
        finding.advisories.length > 0
          ? finding.advisories
              .map((advisory) =>
                advisory.url
                  ? `[${escapeCell(advisory.title)}](${advisory.url})`
                  : escapeCell(advisory.title),
              )
              .join("<br>")
          : `via ${finding.via.join(", ")}`;
      lines.push(
        `| ${finding.name} | ${finding.severity} | ${finding.isDirect ? "oui" : "non"} | ${detail} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Outils de développement (information, sans effet sur l'état)",
    "",
  );
  if (all.ok) {
    lines.push(
      `Paquets supplémentaires signalés par l'audit complet : ${formatCounts(
        countBySeverity(devOnly(production.findings, all.findings)),
      )}.`,
      "",
    );
  } else {
    lines.push("Audit complet indisponible.", "");
  }
  return lines.join("\n");
}
