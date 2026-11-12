// Is the offline React host faithful enough to trust? These checks pin the behaviours the
// transcripts depend on (eager state updaters, effect ordering, keyed identity) and prove
// that, for the repo's real components, the host's tree serialises to the same markup
// react-dom's own server renderer produces from the same props.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Root, toElements } from './mini-react.mjs'
import { createEnvironment } from './fake-env.mjs'
import { createModuleLoader } from './module-loader.mjs'
import { BASE_ENV, PROFILES } from './profiles.mjs'
import { esmPackages, lucideStub } from './esm-packages.mjs'

const h = React.createElement

export async function selfTest({ root }) {
  const problems = []
  const expect = (label, actual, wanted) => { if (JSON.stringify(actual) !== JSON.stringify(wanted)) problems.push(`${label}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`) }

  // 1. state updaters: eager when the component is idle, queued (not re-run) otherwise.
  {
    const log = []
    let api
    const Probe = () => {
      const [value, setValue] = React.useState(0)
      const [other, setOther] = React.useState('a')
      api = { setValue, setOther, value, other }
      log.push(`render ${value}${other}`)
      return h('p', null, `${value}${other}`)
    }
    const rootA = new Root(); rootA.setElement(h(Probe)); rootA.flush()
    api.setValue(prev => { log.push('updater1'); return prev + 1 })
    api.setValue(prev => { log.push('updater2'); return prev + 10 })
    api.setOther(prev => { log.push('updater3'); return prev + 'b' })
    log.push('before flush')
    rootA.flush()
    expect('state: eager first updater, queued later ones, once each', log, ['render 0a', 'updater1', 'before flush', 'updater2', 'updater3', 'render 11ab'])
    api.setValue(v => v)
    expect('state: an update that returns the same value schedules no render', rootA.flush(), false)
    rootA.unmount()
  }

  // 2. effects: layout before passive, destroy-all before create-all, deps respected, unmount cleans up.
  {
    const log = []
    let setN
    const Child = ({ name }) => {
      React.useEffect(() => { log.push(`${name} effect`); return () => log.push(`${name} cleanup`) })
      React.useLayoutEffect(() => { log.push(`${name} layout`); return () => log.push(`${name} layout-cleanup`) })
      return null
    }
    const Parent = () => {
      const [n, set] = React.useState(0); setN = set
      React.useEffect(() => { log.push('parent effect') }, [])
      return h(React.Fragment, null, h(Child, { name: 'a' }), h(Child, { name: 'b' }))
    }
    const rootB = new Root(); rootB.setElement(h(Parent)); rootB.flush()
    expect('effects: mount order (children first, layout before passive)', log, ['a layout', 'b layout', 'a effect', 'b effect', 'parent effect'])
    log.length = 0
    setN(1); rootB.flush()
    expect('effects: re-render destroys all then creates all, parent effect with [] deps does not re-run', log, ['a layout-cleanup', 'b layout-cleanup', 'a layout', 'b layout', 'a cleanup', 'b cleanup', 'a effect', 'b effect'])
    log.length = 0
    rootB.unmount()
    expect('effects: unmount runs every cleanup', log.sort(), ['a cleanup', 'a layout-cleanup', 'b cleanup', 'b layout-cleanup'])
  }

  // 3. keyed identity: state follows the key through a reorder; index identity otherwise.
  {
    const seen = []
    const Item = ({ label }) => { const [mine] = React.useState(label); seen.push(`${label}:${mine}`); return h('i', null, mine) }
    const rootC = new Root()
    rootC.setElement(h('div', null, [h(Item, { key: 'x', label: 'X' }), h(Item, { key: 'y', label: 'Y' })])); rootC.flush()
    seen.length = 0
    rootC.setElement(h('div', null, [h(Item, { key: 'y', label: 'Y' }), h(Item, { key: 'x', label: 'X' })])); rootC.flush()
    expect('keys: reordered keyed children keep their own state', seen, ['Y:Y', 'X:X'])
    rootC.unmount()
  }

  // 4. real components: host tree -> markup equals react-dom's own render of the same props.
  {
    const env = createEnvironment({ processEnv: { ...BASE_ENV, ...PROFILES.studio } })
    const loader = createModuleLoader({ root, globals: env.globals, stubs: { ...(await esmPackages(root)), 'lucide-react': lucideStub(React) } })
    const { QuestionCard } = loader.load('components/builder/chat/question-card.tsx')
    const { StudioOutlineCard } = loader.load('components/builder/chat/studio-outline-card.tsx')
    const questionSet = { id: 'q', intro: 'Intro', questions: [{ id: 'a', text: 'Who?', suggestions: [{ label: 'One', recommended: true }, { label: 'Two' }], allow_free_text: true }] }
    const cases = {
      QuestionCard: h(QuestionCard, { studio: true, promptText: 'Prompt', messageId: 'm1', questionSet, structuredEnabled: true, onActionClick() {}, onSubmitAnswers() {}, actions: [{ label: 'Skip', value: 'skip', primary: false, requires_input: false }, { label: 'Type', value: 't', primary: true, requires_input: true }] }),
      StudioOutlineCard: h(StudioOutlineCard, { renderEvidence: () => null, contextByIndex: null, payload: { operation: 'full_update', metadata: { main_title: 'T', overall_theme: 'x', presentation_duration: 5, target_audience: 'Everyone' }, slides: [{ slide_id: 's1', slide_number: 1, slide_type: 'title', title: 'Hello', narrative: 'n', key_points: ['k'] }] } }),
    }
    for (const [name, element] of Object.entries(cases)) {
      const rootD = new Root(); rootD.setElement(element); rootD.flush()
      // The card reveals its first question from an effect-free initial state, so both renderers agree.
      expect(`markup: ${name} host tree matches react-dom`, toElements(rootD.tree) && renderToStaticMarkup(toElements(rootD.tree)) === renderToStaticMarkup(element), true)
      rootD.unmount()
    }
  }
  return problems
}
