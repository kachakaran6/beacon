import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  'out',
  'coverage',
  'test-results',
])

const ALLOWED_FILES = new Set([
  path.normalize('electron/legacy-migration.ts'),
  path.normalize('electron/legacy-migration.js'),
])

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.ico',
  '.jpg',
  '.jpeg',
  '.webp',
  '.exe',
  '.dll',
  '.zip',
  '.tar',
  '.gz',
  '.blockmap',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
])

const BRAND_REGEX = /island\s*focus/i

let violations = []

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.normalize(path.relative(rootDir, fullPath))

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      scanDir(fullPath)
    } else if (entry.isFile()) {
      if (ALLOWED_FILES.has(relPath)) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (BINARY_EXTENSIONS.has(ext)) continue

      try {
        const content = fs.readFileSync(fullPath, 'utf8')
        const lines = content.split(/\r?\n/)
        for (let i = 0; i < lines.length; i++) {
          if (BRAND_REGEX.test(lines[i])) {
            violations.push({
              file: relPath,
              line: i + 1,
              content: lines[i].trim(),
            })
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
}

console.log('Running brand check across repository...')
scanDir(rootDir)

if (violations.length > 0) {
  console.error(`\n❌ Brand check FAILED! Found ${violations.length} legacy reference(s):`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.content}`)
  }
  process.exit(1)
} else {
  console.log('✅ Brand check PASSED: No legacy references found.')
  process.exit(0)
}
