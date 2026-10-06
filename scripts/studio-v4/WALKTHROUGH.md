# Interactive local Studio walkthrough

The corrected walkthrough is open in a dedicated headed Chromium window, titled **LOCAL SAMPLE WALKTHROUGH — Deckster**. Helper PID61908 (execution session16161) owns that context; the obsolete static walkthrough PID48509 was closed after the replacement was ready. Actual frontend uses the existing sanitized preview at127.0.0.1:8792. The slide iframe uses the exact current UAT Layout renderer at7cbe25cb818cb9c7009242a4ec14a6187c529d2f, with two local sample slides. Selection, displayed slide, thumbnails and counter now agree.

Public static renderer libraries/fonts are cached before replay. Product HTTP/WS is intercepted; local HMR alone may connect at its exact address. Service writes are refused, and no real account or product service is contacted. The new helper removes viewport emulation, so actual window changes resize the app. Its controls and fullscreen are native. Source, evidence, the inherited optional chart-library404 and validation limits are documented in [the bounded correction](../../docs/studio-v4/walkthrough-corrections-20261002/README.md).

Use this dedicated window for the walkthrough. Protection belongs to its browser context; opening the same URL elsewhere does not carry that interception. It remains interactive until its main tab is closed or this helper is stopped. No automatic navigation/actions occur after READY. Status is updated in `/private/tmp/studio-v4-walkthrough-native-status.json`; it contains counts and errors, never cookies or typed request bodies.

From the UAT worktree, with the existing8792 preview running and shell/tokens/labels enabled (TYPE off):

```sh
python3 scripts/studio-v4/native_viewer.py --prepare
python3 scripts/studio-v4/walkthrough.py --status-path /private/tmp/studio-v4-walkthrough-native-status.json
```

Preparation contacts only public static CDNs. Browser replay contacts no remote service. Wait for READY before interacting. The preview remains running when the dedicated helper stops. All commits remain local; connected generation, persistence, export, publishing, push, merge and deployment are unresolved gates. The sprint follow-through automation remains paused.
