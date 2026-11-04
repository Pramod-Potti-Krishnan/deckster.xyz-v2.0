# Disk headroom and recovery coordination

At approximately 20:04 UTC on 5 October, Atlas reported its covered CSS output/render preparation had correctly stopped at **7.396 GiB**, below the task's **8 GiB** floor. It made no deletions. An external space change then raised its reading to 8.094 GiB; root independently measured about 8.2 GiB. The threshold is unchanged and source/adapter work may continue.

## Concrete recovery candidate

Root read-only inspection finds about **984 MiB** in `/Users/pk1980/Software/Deckster/.worktrees/studio-v4-dev-20261003/.next/cache`, predominantly build cache, compared with 17 MiB in `.next/server` and 19 MiB in `.next/static`. The cache is not a symlink. Its webpack cache is a potential approximately 1 GiB recovery, but ownership, task creation and absence of active writers/runtime dependence must first be verified by Builder1, the sole runtime owner. Preserve server/static output, accepted previews, source, dependency trees and all frozen evidence. No root deletion occurred.

Builder1 was asked to verify those conditions and prune only proven disposable build state created by this authorized Studio run. If it is older/unowned or its preservation risk is unclear, Architect will request PK approval before deletion. Do not delegate deletion to evade the other-task/valuable-file approval requirement. Save exact removed paths/size and post-cleanup free space if safe cleanup occurs.

Atlas's own compact-voice scratch is only about 10.3 MiB, with disposable intermediate CSS under 1 MiB: not a meaningful solution. Task-named `/private/tmp` directories individually top out around 14 MiB. Atlas's inherited `.next` is about 105 MiB (65 MiB cache); UAT `.next` about 241 MiB (108 MiB cache). Those belong to preserved/other work and have not been approved for removal. Dependencies and Git history must remain.

## Completed recovery — 20:07 UTC

Builder1 verified this task created the compiler cache during the documented3October Studio dev build, the8843 smoke server was stopped and no process held the cache open. It removed ONLY `.next/cache`: **1,031,815,168 bytes (~984 MiB)**. Reported free space rose from8,811,487,232 to9,843,478,528bytes (~9.17GiB). Root independently verified cache absence, retained17MiB server/19MiB static output and9.168GiB free. The [frozen cleanup receipt](evidence/disk-recovery-reviewed/builder-cleanup-receipt.json) and [Architect verification](evidence/disk-recovery-reviewed/ARCHITECT-RECEIPT.json) preserve the exact evidence.

No valuable evidence, inherited Atlas/UAT cache, dependency, active preview or other-task output was removed. The completed task-build provenance supported disposal without asking to remove another task's files. Atlas was notified to resume only after its own fresh≥8GiB check; B1 resumed guarded validation. The floor remains unchanged. No backend/account/environment or public-release action occurred. Do not repeat this cleanup: the cache is already absent.
