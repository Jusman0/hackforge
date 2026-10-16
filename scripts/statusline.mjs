#!/usr/bin/env node
// Optional Claude Code status line: prints the HackForge countdown when the session is inside a HackForge
// project, nothing otherwise. Install: `hackforge statusline --snippet` prints the settings.json entry.
import { readStdin, findProjectDir, readJSON, hfDir } from '../lib/util.mjs'
import { statusLine } from '../lib/status.mjs'
import path from 'node:path'

try {
  let input = {}
  try { input = JSON.parse(readStdin() || '{}') } catch {}
  const dir = findProjectDir(input.workspace?.current_dir || input.cwd || process.cwd())
  if (dir) {
    const state = readJSON(path.join(hfDir(dir), 'state.json'), null)
    if (state) process.stdout.write(statusLine(dir, state))
  }
} catch {}
