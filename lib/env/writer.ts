/**
 * lib/env/writer.ts
 *
 * SERVER-SIDE ONLY — never import from client components.
 *
 * Reads .env.local, upserts the supplied key-value pairs, and writes the file back.
 * Used by the payment settings API to persist credentials to .env.local so that
 * a server restart picks them up from process.env automatically.
 *
 * Note: Next.js reads .env.local at startup. Changes made here take effect in
 * process.env only after restarting the dev server (`npm run dev`).
 * API calls work immediately via the config store (lib/payments/config-store.ts)
 * without requiring a restart.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * Upsert key-value pairs in .env.local.
 *
 * - If the key already exists, its line is replaced in-place.
 * - If the key is new, it is appended to the end of the file.
 * - Empty / whitespace-only values are skipped (never written).
 */
export function writeEnvLocal(updates: Record<string, string>): void {
  const filePath = path.join(process.cwd(), '.env.local');
  let content = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

  for (const [key, value] of Object.entries(updates)) {
    if (!value?.trim()) continue;                            // skip empty values
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp(`^${escaped}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);  // update in place
    } else {
      content = content.trimEnd() + `\n${key}=${value}`;    // append new key
    }
  }

  writeFileSync(filePath, content.trimEnd() + '\n', 'utf-8');
}
