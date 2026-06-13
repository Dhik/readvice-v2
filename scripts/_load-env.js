// Dependency-free .env loader for standalone Node scripts (no dotenv installed).
// Mirrors Next.js precedence: real process.env > .env.local > .env
const fs = require('fs')
const path = require('path')

function parseEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  const text = fs.readFileSync(file, 'utf8')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // strip surrounding single/double quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const root = path.resolve(__dirname, '..')
const fromEnv      = parseEnvFile(path.join(root, '.env'))
const fromEnvLocal = parseEnvFile(path.join(root, '.env.local'))

// .env.local overrides .env; neither overrides an already-set real env var.
for (const [k, v] of Object.entries({ ...fromEnv, ...fromEnvLocal })) {
  if (process.env[k] === undefined) process.env[k] = v
}

module.exports = {}
