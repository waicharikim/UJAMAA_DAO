/**
 * src/core/database/mergeSchema.ts
 * -----------------------------------------------------------------------------
 * Production-grade Prisma schema merger for Ujamaa DAO.
 * Usage: ts-node src/core/database/mergeSchemas.ts
 * 
 * Features:
 * - Deterministic module ordering
 * - Auto-creates output directory
 * - Strips illegal `generator` & `datasource` blocks from module schemas
 * - Detects conflicting model names
 * - Validates required base schema exists
 * - Pretty logging
 * -----------------------------------------------------------------------------
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();

// Paths
const BASE_SCHEMA_PATH = path.join(ROOT, "src/core/database/base.prisma");
const MODULE_SCHEMA_GLOB = path.join(ROOT, "src/modules/*/prisma/chema.prisma");
const OUTPUT_DIR = path.join(ROOT, "prisma");
const OUTPUT_SCHEMA_PATH = path.join(OUTPUT_DIR, "schema.prisma");

// UPDATED: Complete module order from business doc
const MODULE_ORDER = [
  "auth",
  "user",
  "economy",
  "onboarding",
  "community",
  "governance",
  "marketplace",
  "education",
  "emergency",
  "audit",
  "wallet",
  "notifications"
];

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// NEW: Strip generator/datasource blocks from module schemas
function stripGeneratorAndDatasource(content: string): string {
  return content
    .replace(/generator\s+\w+\s*\{[^}]*\}/gs, '')
    .replace(/datasource\s+\w+\s*\{[^}]*\}/gs, '')
    .trim();
}

// NEW: Extract model names from schema content
function extractModelNames(content: string): Set<string> {
  const modelRegex = /model\s+(\w+)\s*\{/g;
  const names = new Set<string>();
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    names.add(match[1]);
  }
  return names;
}

function annotate(content: string, name: string) {
  return [
    "",
    "// ============================================================================",
    `// MODULE: ${name.toUpperCase()}`,
    "// ============================================================================",
    content.trim(),
    ""
  ].join("\n");
}

export async function mergeSchemas(): Promise<void> {
  console.log("🔄 Merging Prisma schemas...");

  // ensure output dir
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // load base
  if (!(await fileExists(BASE_SCHEMA_PATH))) {
    console.error(`Base schema not found at: ${BASE_SCHEMA_PATH}`);
    throw new Error("base.prisma missing");
  }
  const base = (await fs.readFile(BASE_SCHEMA_PATH, "utf8")).trim();
  if (!base) {
    console.error("Base schema is empty.");
    throw new Error("base.prisma empty");
  }
  console.log("✔ Base schema loaded");

  // NEW: Track models for duplicate detection
  const seenModels = new Set<string>();
  const baseModels = extractModelNames(base);
  baseModels.forEach(m => seenModels.add(m));
  console.log(`✔ Base schema contains ${baseModels.size} models`);

  // find module schemas
  const modulePaths = await glob(MODULE_SCHEMA_GLOB, { nodir: true });
  if (!modulePaths || modulePaths.length === 0) {
    console.warn("⚠ No module schemas found. Only base will be used.");
    await fs.writeFile(OUTPUT_SCHEMA_PATH, base + "\n", "utf8");
    console.log(`✨ Prisma schema written → ${path.relative(ROOT, OUTPUT_SCHEMA_PATH)}`);
    return;
  }

  // sort with MODULE_ORDER
  const sorted = modulePaths.slice().sort((a, b) => {
    const aName = path.basename(path.dirname(path.dirname(a))); // src/modules/AUTH/prisma/schema.prisma
    const bName = path.basename(path.dirname(path.dirname(b)));
    const aIdx = MODULE_ORDER.indexOf(aName);
    const bIdx = MODULE_ORDER.indexOf(bName);
    if (aIdx === -1 && bIdx === -1) return aName.localeCompare(bName);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // NEW: Warn about missing expected modules
  const foundModules = sorted.map(p => path.basename(path.dirname(path.dirname(p))));
  const missingModules = MODULE_ORDER.filter(m => !foundModules.includes(m));
  if (missingModules.length > 0) {
    console.warn(`⚠ Missing expected modules: ${missingModules.join(", ")}`);
  }

  // read, strip, validate, & annotate
  const modulesContentPromises = sorted.map(async (p) => {
    let content = (await fs.readFile(p, "utf8")).trim();
    const moduleName = path.basename(path.dirname(path.dirname(p)));
    
    // NEW: Strip generator/datasource blocks
    const originalLength = content.length;
    content = stripGeneratorAndDatasource(content);
    if (content.length < originalLength) {
      console.log(`  Stripped generator/datasource from ${moduleName}`);
    }
    
    // NEW: Check for duplicate models
    const moduleModels = extractModelNames(content);
    for (const model of moduleModels) {
      if (seenModels.has(model)) {
        throw new Error(
          `❌ Duplicate model "${model}" found in ${moduleName}. ` +
          `This model already exists in a previous schema.`
        );
      }
      seenModels.add(model);
    }
    
    console.log(`✔ Included module schema: ${moduleName} (${moduleModels.size} models)`);
    return annotate(content, moduleName);
  });

  const modulesContent = (await Promise.all(modulesContentPromises)).join("\n\n");

  // combine
  const merged = [base.trim(), modulesContent.trim()].filter(Boolean).join("\n\n");

  // write
  await fs.writeFile(OUTPUT_SCHEMA_PATH, merged + "\n", "utf8");
  console.log(`✨ Prisma schema merged successfully → ${path.relative(ROOT, OUTPUT_SCHEMA_PATH)}`);
  console.log(`   Total models: ${seenModels.size}`);
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("mergeSchemas.ts")) {
  mergeSchemas().catch((err) => {
    console.error("❌ Schema merge failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}