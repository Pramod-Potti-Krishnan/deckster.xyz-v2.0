# Composer library front door

The Builder chat template picker exposes the library only when
`NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED=true`. Its default is off, independently
of the older Template Builder and Template Ingest flags.
The library remains available after a deck locks legacy template selection.
When enabled, Stage carrier descriptors are excluded from both legacy generation
and review pickers. With the flag off, the legacy picker is unchanged.

The server requires `COMPOSER_DIRECTOR_URL` and the PK-managed
`COMPOSER_FRONTDOOR_TOKEN`. It permits only the Director UAT origin or explicit
local HTTP. Browser upload and viewer admission also require explicit
`NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL` and `NEXT_PUBLIC_LAYOUT_SERVICE_URL` pointing
at their UAT or local services. The new route never uses legacy production
fallbacks. No token is sent to the browser.

NextAuth email resolves to the canonical frontend User row. Both upload and use
requests must name a nondeleted ChatSession owned by that user. Upload references
must keep `researcher_session_id === session_id` and an exact one-file storage
path under that same session. Only the server injects `X-Composer-User-Id`.

## Researcher source contract

Read from the fetched `uat` commit
`67f9d1913fd11de9aeb68432874506fdd760c464` of
`https://gitlab.com/pramodpotti/uploads-v1.0.git`, without changing the checkout:

- `routers/sessions.py`: session creation and `GET /api/v1/sessions/{session_id}`;
  the returned user identity is metadata, not the authority for Composer ownership.
- `routers/files.py`: `POST /api/v1/files/storage-upload-url` creates the upload
  reference. There is no signed-download endpoint in this source revision.
- `services/storage_upload.py`: object path is
  `{session_id}/{unix_timestamp}_{sanitized_filename}` in `researcher-uploads`
  by default; storage is private.
- `schemas_v2.py` and `routers/files.py`: `/process-uploaded` does not have a
  template-ingest intent bypass and queues the normal model processing path.

Composer therefore calls `uploadFileToResearcher` with `storageOnly: true`.
It stops immediately after the original bytes are PUT to the signed storage
URL. It never calls `/process-uploaded`. Existing callers retain the original
four-step helper behavior. Director retrieves the owned reference using its
existing private storage access; the Composer worker receives only original
bytes or a verified carrier.

## API and result adoption

The authenticated reference-only proxy maps `/api/composer-library/*` to
Director `/api/template-ingest/stage/*`:

- `GET templates`
- `POST upload-reference`: `session_id`, `researcher_session_id`, `storage_path`,
  `file_name`, and `kind: "pptx"`; returns an asynchronous `job_id`.
- `GET jobs/{job_id}`: progress, failure, or completion.
- `POST templates/{template_id}/use`: new owned `session_id`; returns a job.

Use completion carries `checkpoint.result` with `session_id`, `template_id`,
`presentation_id`, `viewer_url`, and `slide_count`. The dialog checks the origin
and immutable session, then opens a fresh Builder page. That page verifies the
signed-in user and session again before `applyTemplateIngestReady` applies the
shared viewer allowlist and persists the deck state. Jobs can resume from a
per-user browser-session record without creating another deck.

Offline checks are `scripts/test-composer-library.mjs`,
`scripts/test-composer-storage-upload.mjs`, and `scripts/test-composer-picker.mjs`.
They use mocked network, database, and UI dependencies. Full type checks must be compared with fresh plain UAT using
identical dependency inputs; inherited failures are not fixed here.
