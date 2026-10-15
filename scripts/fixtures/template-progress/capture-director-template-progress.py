#!/usr/bin/env python3
"""Regenerates director-template-progress-reads.json: Director's REAL answers to GET /api/template-ingest/stage/jobs/{job_id}
with the template "wow" flow on (COMPOSER_TEMPLATE_PROGRESS_ENABLED) and, for one scenario, off.

Nothing in the JSON is hand-written. Each answer is produced by running Director's own router (src/services/stage_template_router.py,
mounted in a FastAPI app and called over ASGI) and its own serializer (src/services/composer_template_progress.py: project_progress,
final_from_carrier, job_status_fields) against an in-memory job table. The only synthetic inputs are the job ROWS: Composer's progress
envelopes (the shape of TEMPLATE-PROGRESS-CONTRACT.md section 1.1, built with the helpers Director's own tests use,
tests/test_composer_template_progress.py), the finished carrier's semantic_hierarchy (what final_from_carrier reads), and the row's
status / template_id / slide_count / created_at. Director's projection of an envelope into the row (project_progress) and the whole
job read (the route, job_status_fields) are Director's real code. No network, no key, no model call, no deck text (synthetic ids only).
The clock is fixed to 2026-10-15T12:00:00Z (Director's tp._now).

Run (a Director checkout of branch seat2/director-template-wow at the SHA the JSON names; its own python venv):
  python3 capture-director-template-progress.py <director-dir> <out.json>
"""
import asyncio
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

DIRECTOR, OUT = os.path.abspath(sys.argv[1]), sys.argv[2]
sys.path[:0] = [DIRECTOR, os.path.join(DIRECTOR, "tests")]
sys.dont_write_bytecode = True

from _pytest.monkeypatch import MonkeyPatch  # noqa: E402  (Director's tests use pytest's monkeypatch)
from fastapi import FastAPI  # noqa: E402
import httpx  # noqa: E402

import test_composer_template_progress as tpt  # noqa: E402  (Director's own envelope helpers: progress(), locking(), refusal())
from src.models.template_ingest_job import TemplateIngestJob  # noqa: E402
from src.services import composer_template_progress as tp  # noqa: E402
import src.services.stage_template_router as routes  # noqa: E402

NOW = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)
USER = "owner"
SESSION = "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a"
TEMPLATE = "f1x7ure0-0000-4000-8000-n0rthw1nd030"
UPLOAD_REF = {"session_id": SESSION, "researcher_session_id": SESSION, "storage_path": SESSION + "/1_deck.pptx",
              "file_name": "Deck03_Northwind_QBR.pptx", "kind": "pptx"}  # StageUploadReference.model_dump(), as upload_reference stores it


def eid(slide, n):
    return "e_" + hashlib.sha256(f"{slide}:{n}".encode()).hexdigest()[:12]


def slide(index, state, *, kept=False, reason=None):
    """One Composer slide row (CONTRACT 1.1): rule-decided chrome from the start, L4 roles from `analysed` on."""
    fixed = {eid(index, 0): "chrome.footer"}
    roles = {} if state in ("queued", "analysing") else {eid(index, 1): "heading", eid(index, 2): "body"}
    return {"slide_id": f"slide-{index}", "index": index, "state": state, "fixed": fixed, "roles": roles,
            "reason_code": reason, "kept_as_is": kept}


def deck(count, pattern):
    """`pattern`: {index: (state, kept, reason)}; every other slide is `state` pattern['*']."""
    default = pattern.get("*", "queued")
    out = []
    for i in range(1, count + 1):
        spec = pattern.get(i, default)
        state, kept, reason = (spec, False, None) if isinstance(spec, str) else spec
        out.append(slide(i, state, kept=kept, reason=reason))
    return out


def envelope(seq, stage, count, done, eta, slides, *, as_is_ready=False, locking=None):
    if slides:  # Composer: slides_done = the slides locked or unlockable (CONTRACT 1.1)
        done = sum(1 for row in slides if row["state"] in ("locked", "unlockable"))
    raw = tpt.progress(seq, stage, as_is_ready=as_is_ready, done=done, eta=eta, locking=locking, slides=slides)
    raw["slide_count"] = count
    return raw


def stored(raw, *, heartbeat_age=5, final=None):
    """The projection Director keeps on the row (project_progress is Director's), with the two times observe() adds."""
    value = tp.project_progress(raw)
    value["updated_at"] = (NOW - timedelta(seconds=heartbeat_age + 3)).isoformat()
    value["heartbeat_at"] = (NOW - timedelta(seconds=heartbeat_age)).isoformat()
    if final is not None:
        value["final"] = final
    return value


def carrier(*, kept=(), refusal=None, ready=True):
    """What final_from_carrier reads: the finished carrier's semantic_hierarchy (CONTRACT 1.3)."""
    hierarchy = {"validation": {"new_topic_ready": ready, "errors": [] if ready else ["SEMANTIC_D10_SLIDES_UNLOCKABLE"]}}
    if kept:
        hierarchy["kept_as_is"] = [{"slide_id": f"slide-{i}", "index": i, "reason_code": "LOW_CONFIDENCE", "image_ids": []} for i in kept]
    if refusal:
        hierarchy["refusal"] = refusal
    return {"semantic_hierarchy": hierarchy}


def job(job_id, status, age_s, **extra):
    row = TemplateIngestJob.queued(job_id=job_id, session_id=SESSION, user_id=USER, upload_ref=dict(UPLOAD_REF))
    return row.model_copy(update={"status": status, "created_at": NOW - timedelta(seconds=age_s),
                                  "updated_at": NOW - timedelta(seconds=5), **extra})


LOCKING_RUN = tpt.locking("running", "analysing")
RUNNING = {"template_id": TEMPLATE}


def scenarios():
    mid = deck(30, {"*": "queued", **{i: "locked" for i in range(1, 11)}, **{i: "analysed" for i in range(11, 15)}, 15: "analysing", 16: "analysing"})
    kept = deck(12, {"*": "queued", **{i: "locked" for i in range(1, 6)}, 6: ("unlockable", True, "LOW_CONFIDENCE"),
                     **{i: "locked" for i in range(7, 9)}, 9: "analysing", 10: "analysing"})
    done12 = deck(12, {"*": "locked"})
    done_kept = deck(12, {"*": "locked", 6: ("unlockable", True, "LOW_CONFIDENCE")})
    paused = deck(12, {"*": "queued", **{i: "locked" for i in range(1, 8)}, 8: "analysing"})
    final_ready = tp.final_from_carrier(carrier())
    final_kept = tp.final_from_carrier(carrier(kept=(6,)))
    final_paused = tp.final_from_carrier(carrier(ready=False, refusal=tpt.refusal(tp.PAUSED_CODE)))
    final_refused = tp.final_from_carrier(carrier(ready=False, refusal=tpt.refusal("SEMANTIC_D10_SLIDES_UNLOCKABLE")))
    return {
        "converting": ("Just uploaded: converting (no slide count yet, no as-is template)", True,
                       job("stage-0001", "cracking", 12, checkpoint={tp.KEY: stored(envelope(1, "converting", None, 0, None, []))})),
        "checking": ("Placed, checking capacity: the as-is template is not saved yet", True,
                     job("stage-0002", "cracking", 70, checkpoint={tp.KEY: stored(envelope(5, "checking", 12, 0, None, deck(12, {})))})),
        "as-is-ready-mid-lock": ("As-is template saved, 30 slides, locking 10 locked / 4 analysed / 2 analysing / 14 queued; new topics still processing", True,
                                 job("stage-0003", "cracking", 400, template_id=TEMPLATE, slide_count=30, checkpoint={
                                     tp.KEY: stored(envelope(18, "locking", 30, 10, 140, mid, as_is_ready=True, locking=LOCKING_RUN))})),
        "locking-unlockable-kept": ("Locking, 12 slides: slide 6 unlockable and kept as-is (LOW_CONFIDENCE); new topics still processing", True,
                                    job("stage-0004", "cracking", 500, template_id=TEMPLATE, slide_count=12, checkpoint={
                                        tp.KEY: stored(envelope(22, "locking", 12, 6, 55, kept, as_is_ready=True, locking=LOCKING_RUN))})),
        "done-available": ("Done: every slide locked, new topics available", True,
                           job("stage-0005", "complete", 900, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5),
                               checkpoint={tp.KEY: stored(envelope(40, "locking", 12, 12, 0, done12, as_is_ready=True, locking=LOCKING_RUN), final=final_ready)})),
        "done-available-one-kept": ("Done: slide 6 kept as-is (PK 13 Oct: it does not block), new topics available", True,
                                    job("stage-0006", "complete", 900, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5),
                                        checkpoint={tp.KEY: stored(envelope(40, "locking", 12, 12, 0, done_kept, as_is_ready=True, locking=LOCKING_RUN), final=final_kept)})),
        "paused-budget-done": ("Done but locking paused: today's analysis budget used up (retryable)", True,
                               job("stage-0007", "complete", 900, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5),
                                   checkpoint={tp.KEY: stored(envelope(31, "locking", 12, 7, 80, paused, as_is_ready=True, locking=LOCKING_RUN), final=final_paused)})),
        "paused-budget-live": ("Locking paused while the job still runs (live locking.state paused)", True,
                               job("stage-0008", "cracking", 600, template_id=TEMPLATE, slide_count=12, checkpoint={
                                   tp.KEY: stored(envelope(31, "locking", 12, 7, 80, paused, as_is_ready=True, locking=tpt.locking("paused", None, reason_code=tp.PAUSED_CODE, retryable=True)))})),
        "locking-failed-done": ("Job complete (as-is usable) but Composer failed after the as-is save: locking failed, retryable", True,
                                job("stage-0009", "complete", 900, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5), checkpoint={
                                    tp.KEY: stored(envelope(31, "locking", 12, 7, 80, paused, as_is_ready=True, locking=LOCKING_RUN),
                                                   final={"metadata_ran": True, "new_topic_ready": False, "refusal": None,
                                                          "locking_failure": {"reason_code": "COMPOSER_JOB_FAILED", "retryable": True}})})),
        "refused-done": ("Done, metadata refused (SEMANTIC_D10_SLIDES_UNLOCKABLE): new topics refused, as-is usable", True,
                         job("stage-0010", "complete", 900, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5),
                             checkpoint={tp.KEY: stored(envelope(31, "locking", 12, 7, 80, paused, as_is_ready=True, locking=LOCKING_RUN), final=final_refused)})),
        "failed-upload": ("The upload failed before any template was saved (Director's own text)", True,
                          job("stage-0011", "failed", 300, errors=["Template upload could not be completed; no automatic retry was made."],
                              checkpoint={tp.KEY: stored(envelope(3, "placing", 12, 0, None, deck(12, {})))})),
        "stalled-locking": ("Locking with no heartbeat for 200 s: poll.stalled", True,
                            job("stage-0012", "cracking", 900, template_id=TEMPLATE, slide_count=12, checkpoint={
                                tp.KEY: stored(envelope(22, "locking", 12, 6, 55, kept, as_is_ready=True, locking=LOCKING_RUN), heartbeat_age=200)})),
        "stalled-converting": ("Converting with no heartbeat for 200 s, no template saved: poll.stalled", True,
                               job("stage-0013", "cracking", 700, checkpoint={tp.KEY: stored(envelope(1, "converting", None, 0, None, []), heartbeat_age=200)})),
        "legacy-running": ("Composer without its flag: no progress ever received (template_progress null), job running", True,
                           job("stage-0014", "cracking", 40)),
        "legacy-complete": ("Composer without its flag: job complete, no progress ever received", True,
                            job("stage-0015", "complete", 600, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5))),
        "new-topic-flag-disabled": ("Done, but Director's own new-topic flag is off", True,
                                    job("stage-0016", "complete", 900, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5),
                                        checkpoint={tp.KEY: stored(envelope(40, "locking", 12, 12, 0, done12, as_is_ready=True, locking=LOCKING_RUN), final=final_ready)}),
                                    {"new_topic_enabled": False}),
        "flag-off-running": ("Director flag off (COMPOSER_TEMPLATE_PROGRESS_ENABLED unset): the row as it was before the flow, no new fields", False,
                             job("stage-0017", "cracking", 120)),
        "flag-off-complete": ("Director flag off: a completed upload job, the row as before", False,
                              job("stage-0018", "complete", 600, template_id=TEMPLATE, slide_count=12, completed_at=NOW - timedelta(seconds=5))),
    }


async def read(app, job_id):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://asgi-only") as client:
        response = await client.get("/api/template-ingest/stage/jobs/" + job_id)
        return {"status_code": response.status_code, "json": response.json()}


def capture(row, flag_on, new_topic_enabled=True):
    mp = MonkeyPatch()
    try:
        mp.delenv(tp.FLAG, raising=False)
        if flag_on:
            mp.setenv(tp.FLAG, "true")
        mp.setattr(tp, "_now", lambda: NOW)
        jobs = {row.job_id: row}

        async def get_job(job_id, **kwargs):
            return jobs.get(job_id)
        mp.setattr(routes, "get_template_ingest_job", get_job)

        async def unused(*args, **kwargs):
            raise AssertionError("not under test")
        app = FastAPI()
        app.include_router(routes.create_stage_ingest_router(
            user_id_dependency=lambda: USER, client_dependency=lambda: None, upload_engine=unused, replay_engine=unused,
            compose_engine=unused, new_topic_enabled=new_topic_enabled, asynchronous_use=True, allow_binary_upload=False, record_use_history=False))
        return asyncio.run(read(app, row.job_id))
    finally:
        mp.undo()


def main():
    reads = {}
    for name, entry in scenarios().items():
        what, flag_on, row = entry[:3]
        options = entry[3] if len(entry) > 3 else {}
        answer = capture(row, flag_on, **options)
        assert answer["status_code"] == 200, (name, answer)
        reads[name] = {"what": what, "director_flag": flag_on, "director_new_topic_enabled": options.get("new_topic_enabled", True), **answer}
    document = {
        "source": {
            "repo": "director-v4.0 (GitLab)", "branch": "seat2/director-template-wow", "sha": os.environ.get("DIRECTOR_SHA", "unknown"),
            "code": ["src/services/stage_template_router.py (GET /api/template-ingest/stage/jobs/{job_id})",
                     "src/services/composer_template_progress.py (project_progress, final_from_carrier, job_status_fields)",
                     "src/models/template_ingest_job.py"],
            "how": "Director's own router and serializer run over ASGI against an in-memory job table; the rows' progress is Composer's "
                   "envelope (CONTRACT 1.1) projected by Director's own project_progress. scripts/fixtures/template-progress/"
                   "capture-director-template-progress.py regenerates this file. No network, no key, no model call, no deck text.",
            "clock": NOW.isoformat().replace("+00:00", "Z"),
        },
        "reads": reads,
    }
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    for name, entry in reads.items():
        body = entry["json"]
        caps = body.get("capabilities") or {}
        print("%-26s status=%-9s use_original=%-11s new_topic=%-11s poll=%s tp=%s" % (
            name, body["status"], (caps.get("use_original") or {}).get("state"), (caps.get("new_topic") or {}).get("state"),
            body.get("poll", "absent"), "absent" if "template_progress" not in body else "null" if body["template_progress"] is None else body["template_progress"]["stage"]))


main()
