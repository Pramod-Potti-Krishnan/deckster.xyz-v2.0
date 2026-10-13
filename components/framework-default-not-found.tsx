/**
 * A copy of the framework's own built-in 404 (next/dist/client/components/http-access-fallback/error-fallback), so that
 * app/not-found.tsx can render exactly what Next rendered before that file existed while NEXT_PUBLIC_STUDIO_SESSION_HYGIENE
 * is off. It imports no CSS, so the flag-off 404 document gains no stylesheet either.
 * scripts/test-studio-session-hygiene.mjs renders it next to the installed Next's own component and compares the markup,
 * so a Next upgrade that changes the built-in page fails the test instead of drifting.
 */
const defaultStyles = {
  error: {
    fontFamily: 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
    height: '100vh',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: { display: 'inline-block' },
  h1: {
    display: 'inline-block',
    margin: '0 20px 0 0',
    padding: '0 23px 0 0',
    fontSize: 24,
    fontWeight: 500,
    verticalAlign: 'top',
    lineHeight: '49px',
  },
  h2: { fontSize: 14, fontWeight: 400, lineHeight: '49px', margin: 0 },
} as const

const STATUS = 404 // a number, like the built-in: the page's flight payload serialises it the same way
const DEFAULT_CSS =
  'body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}'

export function FrameworkDefaultNotFound() {
  return (
    <>
      <title>404: This page could not be found.</title>
      <div style={defaultStyles.error}>
        <div>
          <style dangerouslySetInnerHTML={{ __html: DEFAULT_CSS }} />
          <h1 className="next-error-h1" style={defaultStyles.h1}>{STATUS}</h1>
          <div style={defaultStyles.desc}>
            <h2 style={defaultStyles.h2}>This page could not be found.</h2>
          </div>
        </div>
      </div>
    </>
  )
}

