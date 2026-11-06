import { STUDIO_SHORTCUT_GROUPS, STUDIO_SHORTCUTS_WORDS } from "@/lib/studio-shortcuts"
import "./studio-p2-shortcuts.css"

// PASS2 ACC-16/17 (NEXT_PUBLIC_STUDIO_P2_ACCOUNT, default off, Studio shell only): the /shortcuts page as the accepted v4 mockup has it, listing only the
// keys that have a handler (lib/studio-shortcuts.ts). Static: no state, no network, no sign-in read.
export function StudioShortcutsPage() {
  return (
    <main data-studio-p2-shortcuts="true">
      <header data-studio-p2-shortcuts-heading="true">
        <h1>{STUDIO_SHORTCUTS_WORDS.title}</h1>
        <p>{STUDIO_SHORTCUTS_WORDS.lede}</p>
      </header>
      {STUDIO_SHORTCUT_GROUPS.map((group) => (
        <section key={group.id} data-studio-p2-shortcuts-group={group.id} aria-labelledby={`studio-p2-shortcuts-${group.id}`}>
          <h2 id={`studio-p2-shortcuts-${group.id}`}>{group.label}</h2>
          <ul>
            {group.shortcuts.map((shortcut) => (
              <li key={shortcut.id} data-studio-p2-shortcut={shortcut.id}>
                <span>{shortcut.label}</span>
                <kbd>{shortcut.keys}</kbd>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
