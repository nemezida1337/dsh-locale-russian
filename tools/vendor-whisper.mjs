#!/usr/bin/env node
/**
 * Builds the vendored whisper-cli bundle from a Homebrew installation so the
 * package can install Whisper without Homebrew on the user's machine.
 *
 * The bundle is `vendor/whisper/<arch>/`: the binary, its dylibs, rewritten
 * install names (@loader_path) and ad-hoc signatures (arm64 requires them).
 *
 * Usage:
 *   node tools/vendor-whisper.mjs
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const arch = process.arch
const brewPrefix = process.env.HOMEBREW_PREFIX ?? '/opt/homebrew'
const whisperRoot = join(brewPrefix, 'opt', 'whisper.cpp')
const ggmlRoot = join(brewPrefix, 'opt', 'ggml')
const ompLib = join(brewPrefix, 'opt', 'libomp', 'lib', 'libomp.dylib')
const target = join(import.meta.dirname, '..', 'vendor', 'whisper', arch)

if (!existsSync(whisperRoot)) {
  console.error(`нет Homebrew-пакета whisper.cpp: ${whisperRoot}`)
  process.exit(1)
}

/** Finds the versioned library inside a brew opt prefix. */
function findLib(root, prefix) {
  const libDir = join(root, 'lib')
  const file = readdirSync(libDir).find((name) => name.startsWith(prefix) && name.endsWith('.dylib') && !name.endsWith(`${prefix}.dylib`))
  return file === undefined ? undefined : join(libDir, file)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
const binary = join(whisperRoot, 'bin', 'whisper-cli')
copyFileSync(binary, join(target, 'whisper-cli'))
copyFileSync(findLib(whisperRoot, 'libwhisper.'), join(target, 'libwhisper.1.dylib'))
copyFileSync(findLib(ggmlRoot, 'libggml.'), join(target, 'libggml.0.dylib'))
copyFileSync(findLib(ggmlRoot, 'libggml-base.'), join(target, 'libggml-base.0.dylib'))
copyFileSync(ompLib, join(target, 'libomp.dylib'))
for (const name of readdirSync(target)) chmodSync(join(target, name), 0o755)

/** Rewrites every dependency to @loader_path/<basename>. */
function rewrite(file) {
  const deps = execFileSync('otool', ['-L', join(target, file)], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim().split(' ')[0])
    .filter((dep) => dep.startsWith('/opt/homebrew/') || dep.startsWith('@rpath/'))
  for (const dep of deps) {
    execFileSync('install_name_tool', ['-change', dep, `@loader_path/${dep.split('/').pop()}`, join(target, file)])
  }
}

for (const name of readdirSync(target)) {
  if (name.endsWith('.dylib')) execFileSync('install_name_tool', ['-id', `@loader_path/${name}`, join(target, name)])
  rewrite(name)
}
// install_name_tool ломает подпись — arm64 требует её заново.
for (const name of readdirSync(target)) {
  execFileSync('codesign', ['--force', '--sign', '-', join(target, name)])
}
console.log(`vendor whisper: ${target} (${arch})`)
