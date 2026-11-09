import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  auditState,
  parseAudit,
  renderSummary,
  type ParsedAudit,
} from "./npm-audit-report/compute";

const outDir = process.env.AUDIT_OUT_DIR ?? "audit";

// `npm audit` sort en code non nul dès qu'il trouve des failles : on lit alors stdout.
function runAudit(args: string[]): { raw: unknown; parsed: ParsedAudit } {
  let stdout: string;
  try {
    stdout = execFileSync("npm", ["audit", "--json", ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const output = (error as { stdout?: Buffer | string }).stdout;
    if (output === undefined) throw error;
    stdout = output.toString();
  }
  try {
    const raw: unknown = JSON.parse(stdout);
    return { raw, parsed: parseAudit(raw) };
  } catch {
    return {
      raw: stdout,
      parsed: { ok: false, error: "Sortie de `npm audit` illisible." },
    };
  }
}

const production = runAudit(["--omit=dev"]);
const all = runAudit([]);
const state = auditState(production.parsed);
const summary = renderSummary({
  generatedAt: new Date(),
  production: production.parsed,
  all: all.parsed,
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "summary.md"), summary);
writeFileSync(
  join(outDir, "npm-audit.json"),
  JSON.stringify({ state, production: production.raw, all: all.raw }, null, 2),
);
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
if (state === "passable") {
  console.log(
    "::warning title=Audit npm::Faille de gravité moderate en production.",
  );
}
if (state === "echec") {
  console.log(
    "::error title=Audit npm::Faille high/critical ou audit impossible.",
  );
  process.exitCode = 1;
}
