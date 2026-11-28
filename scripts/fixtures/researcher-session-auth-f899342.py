"""Offline token fixture sourced from Researcher UAT f899342ad3768dc7ae99c38ab0d1d9ef5d730717.

Token source: services/session_auth_report.py, mint_token at line 146 and
verify_token at line 163. Generate the digest and verify Studio-minted bytes
with the synthetic inputs inside these offline commands:

    node scripts/test-studio-researcher-owner-proof.mjs
    node scripts/test-studio-compose-researcher-owner-proof.mjs

To check the copied definitions against the pinned Researcher clone:

    git -C "$RESEARCHER_REPO" show f899342ad3768dc7ae99c38ab0d1d9ef5d730717:services/session_auth_report.py | python3 -I scripts/fixtures/researcher-session-auth-f899342.py --check-source

Only token routine definitions are copied, and no fixture credential is stored.
"""

import ast
import base64
import binascii
from dataclasses import dataclass
import hashlib
import hmac
import json
from pathlib import Path
import re
import sys
import time
from typing import Any, Optional

# BEGIN pinned Researcher definitions
TOKEN_VERSION = "v1"

MAX_TOKEN_LEN = 2048

MAX_ID_LEN = 255

MAX_TTL_S = 24 * 3600  # a token that expires further ahead than this is treated as invalid

LEEWAY_S = 30  # clock skew tolerated between the minting Next server and this service

@dataclass(frozen=True)
class TokenCheck:
    """Outcome of verifying a token. ``state`` is one of ``valid``, ``expired``, ``invalid``,
    ``no_secret``. The claims are filled only for ``valid`` and ``expired`` (authentic) tokens."""

    state: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    exp: Optional[int] = None

def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

def _b64d(text: str) -> bytes:
    if not re.fullmatch(r"[A-Za-z0-9_-]*", text):
        raise ValueError("not base64url")
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))

def _id_ok(value: Any) -> bool:
    return (
        isinstance(value, str)
        and 0 < len(value) <= MAX_ID_LEN
        and "|" not in value
        and all(ch.isprintable() for ch in value)
    )

def _mac(secret: str, session_id: str, user_id: str, exp: int) -> bytes:
    message = f"{session_id}|{user_id}|{exp}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()

def mint_token(secret: str, session_id: str, user_id: str, exp: int) -> str:
    """REFERENCE minter for the Next server and for tests. The Researcher never calls it."""

    if not secret or not _id_ok(session_id) or not _id_ok(user_id) or int(exp) < 0:
        raise ValueError("invalid token claims")
    exp = int(exp)
    return ".".join(
        (
            TOKEN_VERSION,
            _b64e(session_id.encode("utf-8")),
            _b64e(user_id.encode("utf-8")),
            str(exp),
            _b64e(_mac(secret, session_id, user_id, exp)),
        )
    )

def verify_token(token: str, secret: str, now: Optional[float] = None) -> TokenCheck:
    """Verify a token. Never raises. The signature is checked BEFORE expiry, so ``expired``
    always means "authentic but past its time" and a forged token can never read as expired."""

    try:
        if not secret:
            return TokenCheck("no_secret")
        if not isinstance(token, str) or not token or len(token) > MAX_TOKEN_LEN:
            return TokenCheck("invalid")
        parts = token.split(".")
        if len(parts) != 5 or parts[0] != TOKEN_VERSION:
            return TokenCheck("invalid")
        session_id = _b64d(parts[1]).decode("utf-8")
        user_id = _b64d(parts[2]).decode("utf-8")
        if not re.fullmatch(r"[0-9]{1,12}", parts[3]):
            return TokenCheck("invalid")
        exp = int(parts[3])
        supplied = _b64d(parts[4])
        if not _id_ok(session_id) or not _id_ok(user_id):
            return TokenCheck("invalid")
        if not hmac.compare_digest(supplied, _mac(secret, session_id, user_id, exp)):
            return TokenCheck("invalid")
        current = time.time() if now is None else float(now)
        if exp - current > MAX_TTL_S + LEEWAY_S:
            return TokenCheck("invalid")
        if current > exp + LEEWAY_S:
            return TokenCheck("expired", session_id, user_id, exp)
        return TokenCheck("valid", session_id, user_id, exp)
    except (ValueError, UnicodeDecodeError, binascii.Error, TypeError):
        return TokenCheck("invalid")
# END pinned Researcher definitions


def main():
    request = json.load(sys.stdin)
    secret, sid, uid = request["secret"], request["sid"], request["uid"]
    expires, now = request["expires"], request["now"]
    try:
        reference = mint_token(secret, sid, uid, expires)
    except ValueError:
        reference = None
    token = request.get("studioToken")
    outcome = verify_token(reference if token is None else token, secret, now)
    report = {
        "referenceSha256": hashlib.sha256(reference.encode("ascii")).hexdigest() if reference else None,
        "state": outcome.state,
        "claimsMatch": (outcome.session_id, outcome.user_id, outcome.exp) == (sid, uid, expires),
    }
    json.dump(report, sys.stdout)


def check_source():
    names = {
        "TOKEN_VERSION", "MAX_TOKEN_LEN", "MAX_ID_LEN", "MAX_TTL_S", "LEEWAY_S",
        "TokenCheck", "_b64e", "_b64d", "_id_ok", "_mac", "mint_token", "verify_token",
    }
    source = sys.stdin.read()
    lines = source.splitlines()
    selected = []
    for node in ast.parse(source).body:
        name = node.targets[0].id if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) else getattr(node, "name", None)
        if name in names:
            start = min([node.lineno] + [decorator.lineno for decorator in getattr(node, "decorator_list", [])])
            selected.append("\n".join(lines[start - 1:node.end_lineno]))
    reference = "\n\n".join(selected) + "\n"
    fixture = Path(__file__).read_text(encoding="utf-8")
    block = fixture.split("# BEGIN pinned Researcher definitions\n", 1)[1].split("# END pinned Researcher definitions", 1)[0]
    if reference != block:
        raise SystemExit("Researcher fixture source mismatch")
    print("Researcher f899342 token source matches the pinned fixture")


if __name__ == "__main__":
    if sys.argv[1:] == ["--check-source"]:
        check_source()
    else:
        main()
