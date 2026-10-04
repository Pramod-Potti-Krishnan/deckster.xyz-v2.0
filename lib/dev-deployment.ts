/** Server-only boundary for the separately configured Studio development project. */
export function isStudioDevDeployment(): boolean {
  return process.env.STUDIO_V4_DEV_DEPLOYMENT === 'true'
}
