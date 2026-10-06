'use client'
import { PublishControls } from '@/components/publish-dialog'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-canvas.css'
export default function VisualPublishTriggerFixture(){return <main data-studio-v4-shell="true" style={{minHeight:'100vh',padding:32,background:'var(--ss-surface)',color:'var(--ss-text)'}}><h1>LOCAL VISUAL FIXTURE · actual disabled Publish control</h1><p>Supplied leaf props only. This does not prove the Builder's final-deck or permission gates.</p><button type="button">Before disabled control</button><div data-studio-v4-delivery="true" style={{justifyContent:'flex-start',height:64}}><PublishControls sessionId={null} deckTitle={null} slideCount={null} hasFinalDeck={false}/></div><button type="button">After disabled control</button></main>}
