import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

async function main() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..');

    const sourceFile = path.resolve(projectRoot, 'data', 'nodes.db');
    const targetDir = path.resolve(projectRoot, 'node_modules', 'n8n-mcp', 'data');
    const targetFile = path.resolve(targetDir, 'nodes.db');

    // Check source exists
    try {
      await fs.access(sourceFile);
    } catch {
      console.warn(`[postinstall] nodes.db not found at ${sourceFile}. Skipping copy.`);
      return;
    }

    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(sourceFile, targetFile);
    console.log(`[postinstall] Copied nodes.db -> ${targetFile}`);
  } catch (err) {
    // Do not fail install if copy fails; just log
    console.warn(`[postinstall] Failed to copy nodes.db: ${err?.message || err}`);
  }
}

main();


