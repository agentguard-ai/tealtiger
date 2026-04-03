#!/usr/bin/env ts-node
/**
 * Publish to GHCR or Docker Hub.
 * Assumes docker login is already handled by the workflow (docker/login-action).
 * Usage: npx ts-node src/launch/scripts/publish-container.ts --target ghcr|dockerhub --version 1.1.1
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const target = targetIdx !== -1 ? args[targetIdx + 1] : '';
const versionIdx = args.indexOf('--version');
const version = versionIdx !== -1 ? args[versionIdx + 1] : '1.1.0';

const IMAGES: Record<string, string> = {
  ghcr: 'ghcr.io/agentguard-ai/tealtiger',
  dockerhub: 'tealtiger/tealtiger',
};

async function main() {
  if (!target || !IMAGES[target]) {
    console.error('Usage: --target ghcr|dockerhub --version X.Y.Z');
    process.exit(1);
  }

  const image = IMAGES[target];
  const platforms = 'linux/amd64,linux/arm64';
  const tag = `${image}:${version}`;
  const latestTag = `${image}:latest`;

  console.log(`🐳 Publishing ${tag} to ${target}...`);
  console.log(`   Platforms: ${platforms}`);

  try {
    const cmd = `docker buildx build --platform ${platforms} -t ${tag} -t ${latestTag} --push .`;
    console.log(`   Running: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd, { timeout: 600000 });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`✅ ${target} published: ${tag}`);
  } catch (error: any) {
    console.error(`❌ ${target} publish failed: ${error.message}`);
    if (error.stderr) console.error(error.stderr);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
