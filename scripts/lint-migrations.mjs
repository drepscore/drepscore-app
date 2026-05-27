#!/usr/bin/env node
/**
 * F2 — Lint Supabase migrations for unqualified function references inside
 * CREATE TRIGGER ... EXECUTE { FUNCTION | PROCEDURE } clauses.
 *
 * Background: an unqualified function name (e.g. `set_updated_at()` instead of
 * `public.set_updated_at()`) replays cleanly during the initial CREATE TRIGGER
 * statement (default search_path includes `public`), but when the migration
 * metadata bundle is later replayed in a different session — e.g. a Supabase
 * preview branch creation, or a fresh DB without the assumed search_path —
 * the trigger body can fail to resolve the function. This was the strike-1
 * defect that started the Phase-1 Supabase preview saga (see
 * governada-brain/governada/initiatives/sync-pipeline-architecture.md F2).
 *
 * The F1 migration-replay CI gate catches the runtime symptom; this lint
 * catches the cause at parse time and gives a precise pointer to the file.
 * Belt-and-suspenders.
 *
 * Usage: `npm run lint:migrations`
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

const TRIGGER_REGEX =
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\b[\s\S]+?EXECUTE\s+(?:PROCEDURE|FUNCTION)\s+([A-Za-z_][\w.]*)/giu;

async function listMigrationFiles() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.log('lint:migrations: no supabase/migrations/ directory — nothing to lint.');
      return [];
    }
    throw err;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

async function lintFile(name) {
  const path = join(MIGRATIONS_DIR, name);
  const content = await readFile(path, 'utf8');
  const findings = [];

  let match;
  TRIGGER_REGEX.lastIndex = 0;
  while ((match = TRIGGER_REGEX.exec(content)) !== null) {
    const fnRef = match[1];
    if (!fnRef.includes('.')) {
      const upToHere = content.slice(0, match.index);
      const line = upToHere.split('\n').length;
      findings.push({ line, fnRef });
    }
  }

  return findings;
}

async function main() {
  const files = await listMigrationFiles();
  let totalBad = 0;

  for (const name of files) {
    const findings = await lintFile(name);
    for (const finding of findings) {
      console.error(
        `✗ supabase/migrations/${name}:${finding.line} — unqualified function in CREATE TRIGGER ... EXECUTE: ${finding.fnRef}()`,
      );
      console.error(`  Fix: prefix with the schema, e.g. \`public.${finding.fnRef}()\`.`);
      totalBad += 1;
    }
  }

  if (totalBad > 0) {
    console.error('');
    console.error(`lint:migrations FAILED — ${totalBad} unqualified function reference(s).`);
    process.exit(1);
  }

  console.log(
    `lint:migrations OK — ${files.length} file(s) scanned, no unqualified trigger-function references.`,
  );
}

main().catch((err) => {
  console.error('lint:migrations errored:', err);
  process.exit(2);
});
