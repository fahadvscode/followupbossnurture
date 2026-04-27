#!/usr/bin/env node
/**
 * Drops inherited FUB_* from the parent environment so Next loads them from `.env.local`
 * (shell-exported keys would otherwise override dotenv).
 */
const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env };
delete env.FUB_API_KEY;
delete env.FUB_BASE_URL;

const cwd = path.join(__dirname, '..');
const isWin = process.platform === 'win32';

const child = spawn(isWin ? 'npx.cmd' : 'npx', ['next', 'dev'], {
  cwd,
  env,
  stdio: 'inherit',
  shell: isWin,
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
