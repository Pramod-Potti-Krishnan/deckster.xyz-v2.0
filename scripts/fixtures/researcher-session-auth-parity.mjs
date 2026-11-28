import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./researcher-session-auth-f899342.py', import.meta.url))

// Reference digest and verification result come from pinned Researcher code.
// The only token bytes crossing a process boundary travel on anonymous stdin.
export function researcherTokenFixture(input) {
  return JSON.parse(execFileSync('python3', ['-I', fixture], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
    stdio: ['pipe', 'pipe', 'pipe'],
  }))
}

export function tokenDigest(token) {
  return createHash('sha256').update(token).digest('hex')
}
