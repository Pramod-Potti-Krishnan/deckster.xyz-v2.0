#!/usr/bin/env python3
"""Regenerates director-admission-report-reads.json: the REAL answers of Director's stage-template routes
(GET /api/template-ingest/stage/jobs/{job_id} and GET /api/template-ingest/stage/templates) with the "What changed" admission report
on (DIRECTOR_TEMPLATE_ADMISSION_REPORT_ENABLED), for reports that COMPOSER's own builder wrote.

Nothing in the JSON is hand-written. The chain run for every case is the real one, end to end:

  Composer  service/library_upload_admission.py  user_report()       (composer MR !99, COMPOSER_UPLOAD_ADMISSION_REPORT_ENABLED)
     -> capacity_summary.admission.user_report of a prepare result (and of the early as-is result)
  Director  ComposerWorkerClient._prepared -> composer_admission_report.carry()       (director MR !502)
     -> job.upload_ref -> template_configs.ingest_source.admission_report, job checkpoint.admission_report
  Director  GET /jobs/{id}      -> body["admission_report"]   (stage_template_router.py, object or null)
  Director  GET /templates      -> each row's admission_report without its slides (template_store.list_templates + list_view)

Director's own offline world is used (tests/test_composer_admission_report.py + tests/test_composer_template_progress.py: the real router, the real
worker client, the real template store, an in-memory template table, a scripted Composer transport). The only synthetic inputs are the RAW
normalise reports Composer's builder is given (the shape of service/library_upload_normalise.build_report: per-slide nodes / native / text counts /
misses [rung, rule, kind, count]) and the ladder's `pictured` counts; every sentence in the output is Composer's own template wording. No network, no
key, no model call, no deck text (synthetic ids and counts only).

Run (Director checkout of branch seat2/director-admission-report, Composer checkout of seat2/composer-p3-4-floor-report; system python with
fastapi, httpx, pydantic, pytest):
  DIRECTOR_SHA=<sha> COMPOSER_SHA=<sha> python3 capture-admission-report.py <director-dir> <composer-dir> <out-dir>
writes <out-dir>/director-admission-report-reads.json and <out-dir>/director-admission-report-big-deck.json (the 450-slide case, kept apart for its size).
"""
import asyncio
import copy
from datetime import datetime, timezone
import importlib.util
import json
import os
import sys

DIRECTOR, COMPOSER, OUT = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2]), os.path.abspath(sys.argv[3])
sys.path[:0] = [DIRECTOR, os.path.join(DIRECTOR, "tests")]
sys.dont_write_bytecode = True

from _pytest.monkeypatch import MonkeyPatch  # noqa: E402  (Director's tests use pytest's monkeypatch)

import test_composer_admission_report as ta  # noqa: E402  (Director's own world for this change: start(), Db, go())
import test_composer_template_progress as tpt  # noqa: E402  (the scripted Composer: running(), progress(), finished(), final_carrier())
from src.services import composer_admission_report as ar  # noqa: E402
from src.services import composer_commit_guard as guard  # noqa: E402
from src.services import composer_library  # noqa: E402
from src.services import composer_template_progress as tp  # noqa: E402

spec = importlib.util.spec_from_file_location("library_upload_admission", os.path.join(COMPOSER, "service", "library_upload_admission.py"))
adm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adm)  # Composer's builder: standard library only, loaded by path


# ---- Composer's input: raw normalise reports (service/library_upload_normalise.build_report) -------------------------------------------------
def raw(slides, *, stage="S3", floor=None):
    """`slides`: [(elements, native, text_pieces, text_editable, text_listed, [(rung, rule, kind, count), ...])]"""
    rows = [{"slide": number, "elements": nodes, "nodes": nodes, "native": native, "text_pieces": pieces, "text_editable": kept,
             "text_listed": listed, "background": None, "crash": None, "misses": [list(m) for m in misses]}
            for number, (nodes, native, pieces, kept, listed, misses) in enumerate(slides, 1)]
    report = {"stage": stage, "slides": rows}
    if floor is not None:
        report["floor"] = {"slides": {str(number): row for number, row in floor.items()}}
    return report


R2 = lambda rule, kind, n=1: ("R2", rule, kind, n)  # noqa: E731


def case_clean():
    """The contract's J1 shape: 6 slides, every element editable, two small changes (R2)."""
    return raw([(14, 14, 9, 9, 0, [R2("letter_spacing_normal", "text")]), (12, 12, 8, 8, 0, []), (15, 15, 20, 20, 0, []),
                (16, 16, 24, 24, 0, [R2("dash_solid", "shape")]), (14, 14, 22, 22, 0, []), (14, 14, 24, 24, 0, [])]), None


def case_no_changes():
    return raw([(14, 14, 9, 9, 0, [])] * 8), None


def case_partial():
    """A deck the ladder could not fully carry: text left out, a shape left out, pictures, a check, rebuilt and split parts, small changes."""
    slides = [
        (14, 14, 9, 9, 0, [R2("letter_spacing_normal", "text", 2), R2("dash_solid", "shape")]),
        (20, 19, 12, 10, 2, [("D2", "OFF_SLIDE", "text", 2)]),
        (16, 15, 10, 10, 0, [("D4", "ALTERNATE_CONTENT_EMPTY", "shape", 1)]),
        (13, 13, 8, 8, 0, [R2("font_nearest_face", "text", 3)]),
        (18, 15, 6, 6, 0, [("R4", "BACKDROP_PICTURE", "background", 1), ("R4", "IMAGE_BUDGET", "shape", 2)]),
        (12, 12, 8, 8, 0, []),
        (15, 15, 11, 11, 0, [("judge", "UNEXPLAINED_DIFFERENCE", "slide", 1)]),
        (17, 17, 9, 9, 0, [("R1", "smartart_parts", "smartart", 1)]),
        (14, 14, 12, 11, 1, [("R3", "text_box", "text", 3), ("R3", "glyph_run_split", "text", 1)]),
        (13, 13, 7, 7, 0, [R2("effects_removed", "shape", 2)]),
        (16, 16, 10, 10, 0, [("R1", "smartart_parts", "smartart", 1), R2("dash_solid", "shape")]),
        (12, 12, 8, 8, 0, []),
    ]
    return raw(slides), {"pictured": {5: 3}}


def case_floor():
    """One slide the compiler could not read piece by piece: the slide floor built it (editable text over one text-free picture)."""
    slides = [(14, 14, 9, 9, 0, [])] * 5 + [(26, 8, 14, 13, 1, [("floor", "SLIDE_FLOOR", "slide", 1), ("D2", "OFF_SLIDE", "text", 1)])] + [(12, 12, 8, 8, 0, [])] * 4
    return raw(slides, floor={6: {"pictured": 17, "dropped": 1}}), {"pictured": {}}


def case_many():
    """More distinct changes than the 40 rows listed: `changes_more` > 0."""
    rules = [(rung, rule, kind) for (rung, rule), entry in adm.RULES.items() if rung == "R2"
             for kind in ["text" if "text" in rule or "paragraph" in rule or "bullet" in rule else "shape"]]
    assert len(rules) > 40, len(rules)
    slides = [(12, 12, 8, 8, 0, [R2(rule, kind) for _, rule, kind in rules[i::24]]) for i in range(24)]
    return raw(slides), None


def case_big():
    """450 slides: the slide strip loses its quiet rows (the 60 KB bound), the totals still count every slide."""
    slides = [(12, 12, 8, 8, 0, [R2("dash_solid", "shape")] if n % 37 == 5 else []) for n in range(450)]
    slides[199] = (20, 17, 10, 9, 1, [("D2", "OFF_SLIDE", "text", 1), ("D4", "OFF_SLIDE", "shape", 2)])
    slides[412] = (24, 22, 10, 10, 0, [("R4", "CANVAS_OVERSHOOT", "shape", 2)])
    return raw(slides), {"pictured": {413: 2}}


def case_over_limit():
    """A deck of 520 slides (Director's validator allows totals.slides <= 500): checked with the real chain, see the report's open question."""
    return raw([(12, 12, 8, 8, 0, [R2("dash_solid", "shape")] if n % 60 == 5 else []) for n in range(520)]), None


def built(case):
    report, ladder = case()
    return adm.user_report(report, ladder), report


# ---- Director's world: one upload, then the three reads --------------------------------------------------------------------------------------
FLAGS = (ar.FLAG, tp.FLAG, guard.COMMIT_FLAG, guard.SIZE_GUARD_FLAG, "COMPOSER_REPLAY_BY_REFERENCE_ENABLED", "COMPOSER_REFUSAL_DETAIL_ENABLED",
         "COMPOSER_UPLOAD_REFUSAL_REASON_ENABLED", "COMPOSER_STALE_JOB_WATCHDOG_ENABLED")


def prepared(user_report, raw_report=None):
    """A Composer prepare result: capacity_summary.admission is the raw report (review only) with `user_report` next to it, only when Composer wrote one."""
    admission = {"stage": (raw_report or {}).get("stage", "S3")}
    if user_report is not None:
        admission["user_report"] = user_report
    return {"stage_template": tpt.final_carrier(), "capacity_summary": {"admission": admission}}


async def reads(state, *, with_template=True):
    async with state.client() as client:
        response = await client.post("/api/template-ingest/stage/upload-reference", json={
            "session_id": "s", "researcher_session_id": "s", "storage_path": "s/1_deck.pptx", "file_name": "Deck04_Fabrikam_Review.pptx"})
        assert response.status_code == 202, response.text
        job_id = response.json()["job_id"]
        job = await client.get("/api/template-ingest/stage/jobs/" + job_id)
        listing = await client.get("/api/template-ingest/stage/templates")
    return {"job": {"status_code": job.status_code, "json": job.json()}, "list": {"status_code": listing.status_code, "json": listing.json()}}


def run_case(*, director_flag=True, progress_on=False, final=None, script=None):
    mp = MonkeyPatch()
    try:
        for name in FLAGS:
            mp.delenv(name, raising=False)
        mp.setattr(composer_library, "ASYNC_POLL_INTERVAL_S", 0)
        mp.setattr(tp, "POLL_INTERVAL_S", 0.02)
        polls = script or ta.script(None)
        if final is not None:
            polls[-1] = tpt.finished(200, final)
        state = ta.start(mp, admission=director_flag, progress_on=progress_on, composer=tpt.Composer(polls))
        result = asyncio.run(reads(state))
        result["state"] = state
        return result
    finally:
        mp.undo()


def strip(result):
    return {key: value for key, value in result.items() if key != "state"}


def scenarios():
    out = {}

    def add(name, what, result, **extra):
        out[name] = {"what": what, **extra, **strip(result)}

    # Every case: a normal upload (Director's progress flow off). Composer's report arrives with the final prepare result.
    for name, what, case in (
            ("admitted-clean", "Admitted whole (the contract's J1 shape): 6 slides, every element editable, two small changes", case_clean),
            ("admitted-no-changes", "Admitted whole, nothing needed changing: 8 slides", case_no_changes),
            ("partially-admitted", "Partly admitted: text left out, a shape left out, pictures, a check, a rebuilt SmartArt, a split text box, small changes", case_partial),
            ("floor-slide", "The slide floor built slide 6 (editable text over one text-free picture); text on it left out and listed", case_floor),
            ("many-changes", "More than 40 distinct changes: 40 listed, changes_more > 0", case_many),
            ("big-deck", "450 slides: the strip is bounded (quiet slide rows left out), totals count every slide", case_big)):
        report, raw_report = built(case)
        add(name, what, run_case(final=prepared(report, raw_report)), director_flag=True, composer_flag=True)
    # A deck of 520 slides: Composer's builder emits totals.slides 520 and Director's validator allows at most 500.
    report, raw_report = built(case_over_limit)
    add("deck-over-500-slides", "520 slides: what Composer's builder writes for it (totals.slides 520) and what Director does with it", run_case(final=prepared(report, raw_report)),
        director_flag=True, composer_flag=True, builder_totals_slides=report["totals"]["slides"], builder_slide_rows=len(report["slides"]))
    # No report: Composer's report flag off, a Director flag on.
    add("composer-flag-off", "Composer's COMPOSER_UPLOAD_ADMISSION_REPORT_ENABLED off: the prepare result has no user_report; Director's job read says null",
        run_case(final=prepared(None)), director_flag=True, composer_flag=False)
    # Director's flag off: the key is absent from the job read, and from every list row.
    report, raw_report = built(case_clean)
    add("director-flag-off", "Director's flag off (Composer sends a report): the job read and the list are exactly what they were before",
        run_case(director_flag=False, final=prepared(report, raw_report)), director_flag=False, composer_flag=True)
    # A bad report (Director's validator drops it whole): the upload still completes, the job read says null.
    bad = copy.deepcopy(report)
    bad["changes"][0]["text"] = "On slide 1, <b>letter spacing</b> is set to normal."
    add("report-rejected", "Composer wrote a sentence outside the plain characters: Director drops the whole report and the upload completes",
        run_case(final=prepared(bad, raw_report)), director_flag=True, composer_flag=True)
    # A file-level refusal: no report (the refusal already carries plain words), the job fails.
    refused = run_case(script=[tpt.running(tpt.progress(1)), tpt.finished(422, {"detail": "COMPOSER_JOB_REFUSED", "refusal": tpt.refusal("UPLOAD_FILE_REFUSED")})])
    add("refused", "A file-level refusal: Composer's prepare is refused, so no report; the job fails and no template is saved", refused, director_flag=True, composer_flag=True)

    # The progress flow: the as-is template is saved early and the report is already on the job and the template row. A job read taken
    # while Composer is still locking (status cracking), then the finished job.
    report, raw_report = built(case_partial)
    seen = {}
    holder = {}

    def before_terminal():
        seen["job"] = copy.deepcopy(holder["state"].jobs[next(iter(holder["state"].jobs))])
    mp = MonkeyPatch()
    try:
        for name in FLAGS:
            mp.delenv(name, raising=False)
        mp.setattr(composer_library, "ASYNC_POLL_INTERVAL_S", 0)
        mp.setattr(tp, "POLL_INTERVAL_S", 0.02)
        mp.setattr(tp, "_now", lambda: datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc))  # the progress projection's two times
        as_is = {"stage_template": tpt.as_is_carrier(), "capacity_summary": {"admission": {"stage": "S3", "user_report": report}}}
        composer = tpt.Composer(ta.script(None), as_is=[(200, as_is)], before_terminal=before_terminal)
        composer.polls[-1] = tpt.finished(200, prepared(report, raw_report))
        state = ta.start(mp, admission=True, progress_on=True, composer=composer)
        holder["state"] = state
        final = asyncio.run(reads(state))

        async def midrun():
            state.jobs[seen["job"].job_id] = seen["job"]
            async with state.client() as client:
                response = await client.get("/api/template-ingest/stage/jobs/" + seen["job"].job_id)
                listing = await client.get("/api/template-ingest/stage/templates")
            return {"status_code": response.status_code, "json": response.json()}, {"status_code": listing.status_code, "json": listing.json()}
        mid_job, mid_list = asyncio.run(midrun())
    finally:
        mp.undo()
    assert mid_job["json"]["status"] == "cracking" and mid_job["json"]["admission_report"], "the mid-run read carries the report"
    out["progress-flow-mid-run"] = {"what": "Director's progress flow on: as-is template saved, Composer still locking (status cracking): the job read and the list already carry the report",
                                    "director_flag": True, "composer_flag": True, "job": mid_job, "list": mid_list}
    out["progress-flow-done"] = {"what": "The same upload finished", "director_flag": True, "composer_flag": True, **strip(final)}
    return out


def main():
    cases = scenarios()
    big = {"big-deck": cases.pop("big-deck")}
    source = {
        "composer": {"repo": "composer-v1.0 (GitLab)", "mr": "!99", "branch": "seat2/composer-p3-4-floor-report", "sha": os.environ.get("COMPOSER_SHA", "unknown"),
                     "code": ["service/library_upload_admission.py (user_report, _headline, _change_rows, _slide_rows, _bound, validate)",
                              "service/library_upload_normalise.py (_with_user_report: report['user_report'])",
                              "service/library_worker.py (_with_admission: capacity_summary['admission'])"]},
        "director": {"repo": "director-v4.0 (GitLab)", "mr": "!502", "branch": "seat2/director-admission-report", "sha": os.environ.get("DIRECTOR_SHA", "unknown"),
                     "code": ["src/services/composer_admission_report.py (validate_report, carry, keep_on_job, stored_report, list_view)",
                              "src/services/stage_template_router.py (GET /jobs/{job_id}: body['admission_report']; GET /templates)",
                              "src/storage/template_store.py (list_templates admission_report=True)"]},
        "how": "Composer's real builder (loaded by path, standard library only) writes the user_report from synthetic raw normalise reports; Director's own "
               "offline world (real router, real worker client, real template store, scripted Composer transport) uploads, stores and serves it. "
               "scripts/fixtures/template-admission-report/capture-admission-report.py regenerates these files. No network, no key, no model call, no deck text. "
               "The job rows are Director's test world (slide_count 1, a fixed clock and ids), not a real deck's.",
    }
    for name, content in (("director-admission-report-reads.json", cases), ("director-admission-report-big-deck.json", big)):
        compact = lambda value: json.dumps(value, separators=(",", ":"), ensure_ascii=False)  # noqa: E731  (one case per line keeps the file small)
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as handle:
            handle.write('{"source":' + compact(source) + ',\n"cases":{\n' + ",\n".join(compact(key) + ":" + compact(value) for key, value in content.items()) + "\n}}\n")
    for name, entry in {**cases, **big}.items():
        body = entry["job"]["json"]
        rows = entry["list"]["json"].get("templates", [])
        report = body.get("admission_report", "absent")
        print("%-24s job=%-9s report=%-8s list_rows=%d list_reports=%s" % (
            name, body.get("status"), "absent" if report == "absent" else "null" if report is None else "%d changes" % len(report["changes"]),
            len(rows), [("absent" if "admission_report" not in row else "slides" if "slides" in row["admission_report"] else "ok") for row in rows]))


main()
