# Template rename: recorded Director responses (DIRECTOR-2 for FRONTEND-1, 22 Oct 2026)

`PATCH /api/users/{user_id}/templates/{template_id}`, body `{"name": "<1-150 characters, trimmed>"}`, behind
`DIRECTOR_TEMPLATE_RENAME_ENABLED` (default off; only the exact string `true` turns it on).

Code: Director branch `seat2/director-template-rename`, commit `68324b8fc2da2271d11de1cc3f72e8509f245c30`
(base `origin/uat` f338b417f7353ca79f5781e6afa0b6b1f1a6c1ff). Files: `src/services/template_rename.py` (route, flag, body check),
`src/storage/template_store.py` (`set_template_name`), `main.py` (mount + /health pair).

## How these were recorded

Every file is the real answer of the real code: the real `main.app` under Starlette's `TestClient`, the shipped route,
store and `list_templates`, the REST entitlement guard, against an in-memory `template_configs` that enforces
`UNIQUE (user_id, name)` and records each statement (`tests/test_template_rename.py::FakeTemplateConfigs`). No network, no
model, no key. The entitlement files use a throwaway test key; the header values are not recorded. Ids and names are
synthetic (`t-plain`, "April report", ...). The 200 `updated_at` is whatever the store echoes: the fake does not stamp it,
so on the real database it may change if a trigger exists (the route never writes it).

| file | request | answer |
|---|---|---|
| `01-200-ok.json` | rename an ordinary template, name sent with spaces | 200, the list-row summary, name trimmed |
| `02-200-ok-composer-carrier.json` | rename a Composer stage-carrier template | 200, same shape plus `stage_template_summary`; carrier untouched |
| `03-404-not-found.json` | unknown id | 404 `{"detail":"template not found"}` |
| `04-404-other-user.json` | another user's template id | 404, byte-identical to 03 |
| `05-404-hidden-import.json` | an imported deck's hidden row | 404, byte-identical to 03 |
| `06-409-duplicate-name.json` | a name the user already uses | 409 `{"detail":"A template with that name already exists."}` |
| `07-422-empty-name.json` | `""` | 422 `{"detail":"A template name is required."}` |
| `08-422-whitespace-only-name.json` | whitespace only | 422, same detail as 07 |
| `09-422-name-too-long.json` | 151 characters | 422 `{"detail":"A template name can be at most 150 characters."}` |
| `10-422-not-a-name-body.json` | `{"name": "ok", "description": "no"}` | 422 `{"detail":"Only the template name can be changed here."}` |
| `11-405-flag-off.json` | flag unset | **405** `{"detail":"Method Not Allowed"}`, `allow: GET` |
| `12-401-entitlement-missing.json` | write class enforced, no header | 401 `ENTITLEMENT_REQUIRED` (same as the template DELETE's) |
| `13-403-entitlement-other-user.json` | write class enforced, header for another user | 403 `USER_MISMATCH` (same as the DELETE's) |
| `14-200-ok-with-entitlement.json` | write class enforced, valid PATCH header | 200 |

## For the Studio proxy

* Flag off is a **405, not a 404.** The path `/api/users/{uid}/templates/{id}` already exists for GET and DELETE, so
  with no PATCH route the framework answers 405 (`Allow: GET`). That is what uat answers today, and the route is built
  to leave it exactly so (verified by hashing 42 answers against a clean uat checkout: 12 requests, `/openapi.json` and `/health`, each with the flag unset, `false` and blank).
  Treat any non-2xx from the PATCH as "rename unavailable"; do not key on 404 for "flag off".
* 404 has one body for a missing template, another user's template and a hidden import row.
* A rename to the template's current name (after trimming) is a 200 and writes nothing.
* The 409 can also come from a hidden imported deck's row that carries the same name (the database counts it); the
  library cannot show that row.
* After a rename, later "Use original" / ditto decks are titled with the new name (Composer titles the new deck with
  the template name). Expected.
* Entitlement: the PATCH is class W (header method `PATCH`, `sub` equal to the path user). The guard answers before
  the flag, so a refused PATCH gets 401/403 whether or not the flag is on.
