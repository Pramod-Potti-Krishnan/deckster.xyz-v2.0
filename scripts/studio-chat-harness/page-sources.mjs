// Which regions of app/builder/page.tsx and hooks/use-builder-session.ts the harness
// executes, and how to bind them. Everything here is read from the live source text, so a
// change to a mirrored region shows up as an anchor hash difference in the baseline, and a
// change in shape (a renamed handler, a moved block) fails loudly with the region's name.
import path from 'node:path'
import * as extract from './page-extract.mjs'

const cache = new Map()

export function pageSources(root) {
  if (cache.has(root)) return cache.get(root)
  const page = extract.parseSource(path.join(root, 'app/builder/page.tsx'))
  const session = extract.parseSource(path.join(root, 'hooks/use-builder-session.ts'))
  const regions = []
  const note = (label, node, source) => { regions.push(extract.anchor(label, node, source)); return node }
  const compile = (label, node, source) => extract.compile(note(label, node, source), source, label)

  const compiled = {
    handleActionClick: compile('page.handleActionClick', extract.useCallbackFunction(page, 'handleActionClick'), page),
    preflightDirectorTurn: compile('page.preflightDirectorTurn', extract.useCallbackFunction(page, 'preflightDirectorTurn'), page),
    onMessage: compile('page.hookOption.onMessage', extract.hookOptionProperty(page, 'useDecksterWebSocketV2', 'onMessage'), page),
    hookOptions: {},
  }
  for (const name of ['autoConnect', 'existingSessionId', 'reconnectOnError', 'maxReconnectAttempts', 'reconnectDelay']) {
    compiled.hookOptions[name] = compile(`page.hookOption.${name}`, extract.hookOptionProperty(page, 'useDecksterWebSocketV2', name), page)
  }
  const jsx = tag => Object.fromEntries(Object.entries(extract.jsxAttributes(page, tag)).map(([name, item]) => {
    if (item.node) note(`page.<${tag} ${name}>`, item.node, page)
    return [name, extract.compile(item.text, page, `<${tag} ${name}>`)]
  }))
  compiled.messageList = jsx('MessageList')
  compiled.header = jsx('StudioDirectorHeader')
  compiled.notice = jsx('StudioDirectorNotice')
  // NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB: the paused-tab notice and its "Use here" button, where the page has them (the base page does not).
  compiled.superseded = extract.hasJsxTag(page, 'StudioSupersededNotice') ? jsx('StudioSupersededNotice') : null
  // The composer (PASS2-DIRECTOR-CHAT PR D): every prop expression the page hands <ChatInput>, run by fixtures that opt in (`composer: true`).
  compiled.chatInput = jsx('ChatInput')

  // The normal-path typed turn: the options object the page hands sendTypedTurn.
  const typedCalls = extract.findCalls(page, 'sendTypedTurn')
  if (typedCalls.length === 0) throw new Error('harness extract: page.tsx has no sendTypedTurn call sites')
  const normalTypedCall = typedCalls.at(-1)
  compiled.typedOptions = compile('page.sendTypedTurn(normal path)', normalTypedCall.arguments[0], page)
  note('page.handleSendMessage', extract.useCallbackFunction(page, 'handleSendMessage'), page)
  // NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED: the argument the page hands its echo hook, where the page has the call (the base page does not). SPEED-PERCEIVED
  const speedEchoCalls = extract.findCalls(page, 'useStudioSpeedPerceivedEcho') // SPEED-PERCEIVED
  compiled.speedEchoInput = speedEchoCalls.length === 1 ? compile('page.useStudioSpeedPerceivedEcho(input)', speedEchoCalls[0].arguments[0], page) : null // SPEED-PERCEIVED

  // use-builder-session: DB rows -> (user turns, Director frames), session state, receipt.
  const restore = extract.findIfStatement(session, node => node.expression.getText(session) === 'session.messages && session.messages.length > 0', '`if (session.messages && session.messages.length > 0)` restore block')
  compiled.restoreBlock = extract.compile(`async () => ${restore.thenStatement.getText(session)}`, session, 'use-builder-session restore block')
  note('session.restoreBlock', restore.thenStatement, session)
  compiled.restoredSessionState = compile('session.restoredSessionState', extract.findVariableInitializer(session, 'restoredSessionState'), session)
  const receipt = extract.findIfStatement(session, node => node.expression.getText(session).includes('transcriptScopeRef.current === transcriptScope') && node.thenStatement.getText(session).includes('Object.freeze'), 'transcript receipt block')
  compiled.receiptBlock = extract.compile(`() => { ${receipt.getText(session)} }`, session, 'transcript receipt block')
  note('session.receiptBlock', receipt, session)
  const cacheEffect = extract.findCalls(session, 'useEffect').find(call => call.arguments[0].getText(session).includes('updateCacheUserMessages(userMessages)'))
  if (!cacheEffect) throw new Error('harness extract: use-builder-session no longer syncs user turns to the session cache')
  compiled.cacheSyncEffect = compile('session.cacheSyncEffect', cacheEffect.arguments[0], session)

  const result = { compiled, regions: regions.sort((a, b) => (a.label < b.label ? -1 : 1)), sendSites: extract.sendCallSites(page) }
  cache.set(root, result)
  return result
}
