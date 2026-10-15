# PASS2B J2-04. Records the frames Director sends the Studio for an Add Slide job, built by the REAL Director code.
#
#   python3 record-director-frames.py <director checkout at uat> <layout-viewer.json> <out.json>
#
# slide_ready / slide_failed are built by the real helpers in src/models/websocket_messages.py (create_slide_ready, create_slide_failed) and serialised the way Director's _send_slide_compose_frame sends them: frame.model_dump(mode="json").
# The "accepted" body is the one POST /api/slides/compose gets back for an async job (main.py, the `if payload.async_:` branch, HTTP 202):
# status, job_id, target_index = insert_after_index + 1, session_id, presentation_id. The presentation and slide ids are the ones the REAL Layout
# Service handed out in record-layout-viewer.json, so the two recordings describe the same deck. No network, no keys, nothing is sent anywhere.
import json
import subprocess
import sys
from pathlib import Path

DIRECTOR = Path(sys.argv[1]).resolve()
LAYOUT_FIXTURE = json.loads(Path(sys.argv[2]).read_text())
OUT = Path(sys.argv[3])
sys.path.insert(0, str(DIRECTOR))

from src.models.websocket_messages import create_slide_failed, create_slide_ready  # noqa: E402

SESSION = "session-j2-04"


def accepted(job_id, presentation_id, insert_after_index):
    return {"status": "accepted", "job_id": job_id, "target_index": insert_after_index + 1, "session_id": SESSION, "presentation_id": presentation_id}


def dump(frame):
    return frame.model_dump(mode="json")


def real_slide(scenario, job_id):
    """The slide id and layout index the real Layout insert gave the slide the job built."""
    inserts = [s for s in LAYOUT_FIXTURE["scenarios"][scenario]["steps"] if s["do"] == "layout_insert"]
    return inserts[-1]["real_slide_id"], inserts[-1]["layout_index"]


out = {
    "_provenance": {
        "director_sha": subprocess.check_output(["git", "-C", str(DIRECTOR), "rev-parse", "HEAD"], text=True).strip(),
        "layout_builder_sha": LAYOUT_FIXTURE["_provenance"]["layout_builder_sha"],
        "note": "Frames built by the REAL Director helpers and serialised as Director sends them; ids from the real Layout recording.",
        "recorder": "scripts/fixtures/studio-add-slide-status/record-director-frames.py",
        "session_id": SESSION,
    },
    "scenarios": {},
}

# generate-ready: Generate on slide 2 (insert_after_index 1) -> accepted -> slide_ready
pid = LAYOUT_FIXTURE["scenarios"]["generate-ready"]["presentation_id"]
real_id, layout_index = real_slide("generate-ready", "job-add-1")
out["scenarios"]["generate-ready"] = {
    "presentation_id": pid,
    "frames": [
        {"at": "accepted", "http_status": 202, "body": accepted("job-add-1", pid, 1)},
        {"at": "ws", "frame": dump(create_slide_ready(session_id=SESSION, job_id="job-add-1", presentation_id=pid, slide_index=layout_index,
                                                      presentation_url=f"http://layout.invalid/p/{pid}", real_slide_id=real_id, message_id="msg_slide_ready_rec1"))},
    ],
}

# fail-retry-ready: accepted -> slide_failed -> (Try again) accepted under a new job id -> slide_ready
pid = LAYOUT_FIXTURE["scenarios"]["fail-retry-ready"]["presentation_id"]
real_id, layout_index = real_slide("fail-retry-ready", "job-add-3")
out["scenarios"]["fail-retry-ready"] = {
    "presentation_id": pid,
    "frames": [
        {"at": "accepted", "http_status": 202, "body": accepted("job-add-2", pid, 1)},
        {"at": "ws", "frame": dump(create_slide_failed(session_id=SESSION, job_id="job-add-2", stage="slide_builder",
                                                       errors=["Slide Builder did not answer in time."], presentation_id=pid, message_id="msg_slide_failed_rec1"))},
        {"at": "retry-accepted", "http_status": 202, "body": accepted("job-add-3", pid, 1)},
        {"at": "ws", "frame": dump(create_slide_ready(session_id=SESSION, job_id="job-add-3", presentation_id=pid, slide_index=layout_index,
                                                      presentation_url=f"http://layout.invalid/p/{pid}", real_slide_id=real_id, message_id="msg_slide_ready_rec2"))},
    ],
}

OUT.write_text(json.dumps(out, indent=1) + "\n")
print("recorded", {k: len(v["frames"]) for k, v in out["scenarios"].items()}, "->", OUT)
