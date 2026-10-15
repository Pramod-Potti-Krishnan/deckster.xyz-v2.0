#!/usr/bin/env python3
"""Regenerates director-stage-job-polls.json: Director's REAL answers to GET /api/template-ingest/stage/jobs/{job_id}.

Nothing in the JSON is hand-written. Each answer is produced by running Director's own router
(src/services/stage_template_router.py, mounted in a FastAPI app and called over ASGI) and its own watchdog
(src/services/composer_stale_job_watchdog.py, COMPOSER_STALE_JOB_WATCHDOG_ENABLED, !498) against an in-memory job
table, using Director's own test harness (tests/test_composer_commit_guard.py::harness). The job records are built with
Director's own factory (TemplateIngestJob.queued) and its own failure write (the dict perform_use writes). No network,
no key, no model call. The clock is fixed to 2026-10-14T12:00:00Z, the clock scripts/test-studio-composer-job-recovery.mjs runs at.

Run (a Director checkout or `git archive` of origin/uat at the SHA the JSON names; any python with fastapi, httpx, pytest, pydantic):
  python3 capture-director-polls.py <director-dir> <out.json>
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone

DIRECTOR, OUT = os.path.abspath(sys.argv[1]), sys.argv[2]
sys.path[:0] = [DIRECTOR, os.path.join(DIRECTOR, "tests")]
sys.dont_write_bytecode = True

from _pytest.monkeypatch import MonkeyPatch  # noqa: E402  (Director's tests use pytest's monkeypatch; so does its harness)

import test_composer_commit_guard as guard_tests  # noqa: E402
from src.models.template_ingest_job import TemplateIngestJob  # noqa: E402
from src.services import composer_stale_job_watchdog as watchdog  # noqa: E402

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)
FLAG = watchdog.FLAG
SESSION = "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a"
TEMPLATE = "f1x7ure0-0000-4000-8000-n0rthw1nd030"
USER = "owner"  # the owner Director's test harness authenticates (user_id_dependency=lambda: "owner")
RECEIPT = {"presentation_id": "9b2f61c4-6f4e-4f5a-9d2b-0c1f1e7d3a55", "template_id": TEMPLATE,
           "viewer_url": "https://layout-builder-v75-uat.up.railway.app/p/9b2f61c4-6f4e-4f5a-9d2b-0c1f1e7d3a55",
           "slide_count": 30, "session_id": SESSION}
USE_FAILED = "Stored template could not be used; no automatic retry was made."  # the text perform_use writes
UPLOAD_FAILED = "Template upload could not be completed; no automatic retry was made."  # the text perform_upload writes


def use_job(job_id, status, age_s, **extra):
    """Director's own factory plus the one assignment the use route makes (job.template_id = template_id)."""
    job = TemplateIngestJob.queued(job_id=job_id, session_id=SESSION, user_id=USER, upload_ref={"kind": "template-use"})
    job.template_id = TEMPLATE
    return job.model_copy(update={"status": status, "created_at": NOW - timedelta(seconds=age_s + 8),
                                  "updated_at": NOW - timedelta(seconds=age_s), **extra})


def upload_job(job_id, status, age_s, **extra):
    ref = {"session_id": SESSION, "researcher_session_id": SESSION, "storage_path": SESSION + "/1_deck.pptx",
           "file_name": "deck.pptx", "kind": "pptx"}  # StageUploadReference.model_dump(), as upload_reference stores it
    job = TemplateIngestJob.queued(job_id=job_id, session_id=SESSION, user_id=USER, upload_ref=ref)
    return job.model_copy(update={"status": status, "created_at": NOW - timedelta(seconds=age_s + 8),
                                  "updated_at": NOW - timedelta(seconds=age_s), **extra})


# name -> (what it is, watchdog flag, the job row as Director's store holds it)
SCENARIOS = {
    "orphan-use-assembling": ("A Use original job whose Director process died in 'assembling' (25 min since its last write): the first poll",
                              True, use_job("stage-use-run-6f1c1e1a-2b3c-4d5e-8f90-a1b2c3d4e5f6", "assembling", 25 * 60)),
    "orphan-use-assembling-receipt": ("The same, after the creation receipt was retained (the replay finished, adoption had not)",
                                      True, use_job("stage-use-run-0a9b8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d", "assembling", 25 * 60,
                                                    checkpoint={"operation": "stage_template_replay", "result": dict(RECEIPT),
                                                                "session_adoption": "pending"},
                                                    presentation_id=RECEIPT["presentation_id"], viewer_url=RECEIPT["viewer_url"],
                                                    slide_count=30)),
    "orphan-upload-cracking": ("An upload-reference job whose Director process died in 'cracking' (40 min since its last write)",
                               True, upload_job("stage-3c2b1a09-8f7e-4d6c-a5b4-c3d2e1f0a9b8", "cracking", 40 * 60)),
    "healthy-use-assembling": ("A Use original job that is running: its heartbeat wrote 20 s ago", True,
                               use_job("stage-use-run-5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a", "assembling", 20)),
    "failed-use-genuine": ("A Use original job that failed in the worker (Director's own text); the watchdog did not fail it", True,
                           use_job("stage-use-run-7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918", "failed", 90, errors=[USE_FAILED])),
    "failed-upload-genuine": ("An upload job that failed in the worker (Director's own text)", True,
                              upload_job("stage-9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6e", "failed", 90, errors=[UPLOAD_FAILED])),
    "dies-while-polled": ("A running Use original job (heartbeat 20 s old: the first poll) whose Director process then dies; polled again 200 s later",
                          True, use_job("stage-use-run-2e3d4c5b-6a79-4b8c-9d0e-1f2a3b4c5d6e", "assembling", 20)),
    "watchdog-off-orphan-use-assembling": (
        "Watchdog off (Director before !498 or the flag unset): the same dead job, 3 h since its last write, is still 'assembling'",
        False, use_job("stage-use-run-1b2a3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "assembling", 3 * 3600)),
}


async def poll(state, job_id):
    async with state.client() as client:
        response = await client.get("/api/template-ingest/stage/jobs/" + job_id)
        return {"status_code": response.status_code, "json": response.json()}


def capture(name, flag_on, job, clocks=(0, 0)):
    """Polls the job once at each clock offset (seconds after NOW). The first answer is `response`; later ones are `later`."""
    mp = MonkeyPatch()
    try:
        mp.delenv(FLAG, raising=False)
        if flag_on:
            mp.setenv(FLAG, "true")
        state = guard_tests.harness(mp, prepared=guard_tests.big_carrier())
        clock = {"s": 0}
        mp.setattr(guard_tests.FixedDatetime, "now", classmethod(lambda cls, tz=None: NOW + timedelta(seconds=clock["s"])))  # the store's own write time
        mp.setattr(watchdog, "_utcnow", lambda: NOW + timedelta(seconds=clock["s"]))
        mp.setattr(watchdog, "_IN_FLIGHT", {})
        state.jobs[job.job_id] = job
        answers = []
        for offset in clocks:
            clock["s"] = offset
            answers.append(asyncio.run(poll(state, job.job_id)))
        for earlier, later in zip(answers, answers[1:]):  # a polled failure repeats exactly; a poll at the same clock is the same answer
            if earlier["json"].get("status") == "failed":
                assert later == earlier, name
        entry = {"watchdog_flag": flag_on, "request": {"method": "GET", "path": "/api/template-ingest/stage/jobs/" + job.job_id},
                 "response": answers[0], "director_writes": [{"job_id": job_id, "updates": updates} for job_id, updates in state.updates]}
        if len(set(clocks)) > 1:
            entry["later"] = [{"after_s": offset, **answer} for offset, answer in zip(clocks[1:], answers[1:])]
        return entry
    finally:
        mp.undo()


def main():
    polls = {}
    for name, (what, flag_on, job) in SCENARIOS.items():
        polls[name] = {"what": what, **capture(name, flag_on, job, clocks=(0, 200, 200) if name == "dies-while-polled" else (0, 0))}
    document = {
        "source": {
            "repo": "director-v4.0 (GitLab)", "ref": "origin/uat", "sha": os.environ.get("DIRECTOR_SHA", "2978affabad585902150b51ebe26a2bc1dd55acf"),
            "change": "J5 R7 P2 / !498: d6daf2d (COMPOSER_STALE_JOB_WATCHDOG_ENABLED) + f6c0c71",
            "code": ["src/services/stage_template_router.py (GET /api/template-ingest/stage/jobs/{job_id})",
                     "src/services/composer_stale_job_watchdog.py", "src/models/template_ingest_job.py"],
            "how": "Director's own router and watchdog run over ASGI against an in-memory job table (tests/test_composer_commit_guard.py::harness); "
                   "scripts/fixtures/composer-job-recovery/capture-director-polls.py regenerates this file. No network, no key, no model call.",
            "clock": NOW.isoformat().replace("+00:00", "Z"),
        },
        "polls": polls,
    }
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    for name, entry in polls.items():
        body = entry["response"]["json"]
        print("%-36s %s status=%-10s retryable=%-5s checkpoint=%s errors=%s" % (
            name, entry["response"]["status_code"], body["status"], body.get("retryable"), sorted(body["checkpoint"]), body["errors"]))
        for later in entry.get("later", []):
            print("%-36s +%ss %s status=%-10s retryable=%s errors=%s" % ("", later["after_s"], later["status_code"], later["json"]["status"],
                                                                      later["json"].get("retryable"), later["json"]["errors"]))


main()
