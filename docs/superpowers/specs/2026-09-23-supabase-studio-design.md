# Supabase-backed Studio design

## Purpose

Replace the portfolio's browser-only Studio scratchpad with a production content system that the artist can use herself. Public visitors must see the latest saved content, while only one explicitly authorized Supabase Auth account can change it.

The existing visual language and framework-free deployment remain intact. The site continues to be plain HTML, CSS, and JavaScript with no build step.

## Agreed outcomes

- The artist signs in with an invite-only email/password account created manually in Supabase Auth.
- The site exposes no sign-up path.
- Only a user explicitly present in `studio_users` can mutate content or Storage objects.
- Saves publish immediately; there is no draft workflow.
- Studio manages paintings, Canvas videos, the YouTube embed, Spotify artist galleries, the biography portrait, selected exhibitions, art projects, and art fairs.
- Painting title, year, series, medium, dimensions, image, and ordering remain editable.
- The artist can change or recover her password through Supabase email flows.
- The public contact CTA and mail fallback deliver to `nazlibelgin@gmail.com`.
- Existing local media is migrated once with a repository tool after the SQL has been applied.

## Non-goals

- No public registration, multiple editor roles, approval workflow, revisions, scheduled publishing, or general-purpose CMS.
- Manifesto and biography prose remain source-controlled HTML.
- Contact-form server delivery is not added in this change; the existing `mailto:` behavior remains, with the new Gmail recipient.
- The service-role key is never used by browser code or committed to the repository.

## Current state

`js/site.js` contains the painting catalogue, a plaintext `atelier` passcode, and a browser-local Studio flag. Studio changes and uploaded image data URLs are written to `localStorage`, so visitors cannot see them and clearing the browser loses them. Canvas videos, the YouTube embed, Spotify gallery images, portrait, and CV entries are static markup in `index.html`.

The working tree also contains unrelated, uncommitted Art Works layout changes. Implementation must preserve those changes and update their tests rather than replacing them with the previous layout.

## Chosen architecture

The static site connects directly to Supabase using a pinned browser build of `supabase-js` v2:

1. Supabase Auth owns sessions, login, reauthentication, password updates, and recovery emails.
2. Supabase Postgres stores content metadata and display order.
3. A public-read Supabase Storage bucket serves image and video files through the Supabase CDN.
4. Postgres row-level security and Storage object policies enforce write authorization.
5. Public reads use the browser-safe publishable/anon key. RLS, not key secrecy, is the security boundary.

A serverless API is intentionally omitted. It would add another deployment and failure surface without improving authorization beyond correctly configured RLS for this single-editor site.

## Database model

### `studio_users`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `created_at timestamptz not null default now()`

This table is the allowlist. It has no client insert, update, or delete policy. The authorization SQL looks up the already-created Auth user by the operator-supplied login email and inserts that user's UUID. Authentication alone never grants Studio access.

### `artworks`

- UUID primary key and stable unique `slug`
- nullable `title`, `year`, `medium`, and `dimensions`
- required `series`
- optional authored `alt_text`
- `storage_path` for the migrated/uploaded object
- `legacy_path` for transition and migration mapping
- positive `aspect_width` and `aspect_height`
- integer `sort_order`
- `published boolean not null default true`
- creation and update timestamps

Year is constrained to a plausible four-digit value when present. Public queries return published rows ordered by `sort_order`, then UUID for deterministic ties.

### `media_items`

- UUID primary key and stable unique `slug`
- `kind` constrained to `portrait`, `canvas_video`, `youtube`, or `spotify_image`
- optional `group_name` for Spotify artist grouping
- optional `title` and `alt_text`
- optional `external_url` for the YouTube embed
- optional `storage_path`, `legacy_path`, and `mime_type` for uploaded media
- positive optional aspect dimensions
- integer `sort_order`
- `published boolean not null default true`
- creation and update timestamps

Constraints require an external URL for YouTube and a storage or legacy path for file-backed kinds. The seed retains the current Spotify group names and media order.

### `cv_entries`

- UUID primary key
- `category` constrained to `exhibition`, `project`, or `fair`
- display `year` as text so ranges remain representable
- required `description`
- integer `sort_order`
- `published boolean not null default true`
- creation and update timestamps

### Shared database behavior

- A trigger maintains `updated_at`.
- A stable helper checks whether `auth.uid()` exists in `studio_users`.
- Ordering RPCs accept an ordered UUID list and update one complete artwork, media group, or CV category after verifying Studio membership and exact membership of the submitted IDs.
- Database constraints reject unsupported media kinds, CV categories, invalid dimensions, invalid years, and unsafe/empty required values even if browser validation is bypassed.

## Row-level security and Storage security

RLS is enabled on every public table.

- Anonymous and authenticated visitors may select only rows with `published = true`.
- The allowlisted Studio user may select all rows and insert, update, or delete content.
- No browser role can change `studio_users`.
- SQL functions used for authorization have a fixed `search_path`, minimal grants, and do not trust caller-provided user IDs.

The SQL creates one public bucket named `site-media`. Runtime paths are namespaced as:

- `artworks/<uuid>.<extension>`
- `media/portrait/<uuid>.<extension>`
- `media/canvas-video/<uuid>.<extension>`
- `media/spotify-image/<uuid>.<extension>`

Public objects can be read by anyone. Insert, update, and delete policies on `storage.objects` require both `bucket_id = 'site-media'` and Studio allowlist membership. Upload validation restricts images to JPEG, PNG, or WebP and videos to MP4 or WebM. Browser limits are duplicated by Storage bucket restrictions where Supabase supports them.

## Public data flow and fallback

The checked-in HTML and current painting catalogue remain a pre-migration and outage fallback. On page boot:

1. The site renders the source-controlled fallback immediately.
2. The Supabase client validates configuration and requests artworks, media, and CV rows in parallel.
3. Successful results are normalized into the existing display model, Storage paths are converted to public URLs, and each managed section is replaced.
4. A failed request leaves that section's fallback visible and records a concise console diagnostic. Public visitors do not see a broken empty page or Studio internals.

Fallback content can be stale during an outage; it is availability protection, not a second editable source of truth. Studio mutations are disabled whenever Supabase is unavailable.

## Studio experience

### Authentication

The footer Studio button opens an email/password form. It calls `signInWithPassword`, then verifies that the session user is in `studio_users` before enabling editing. An authenticated but unauthorized user is immediately signed out and sees a generic access-denied message.

Sessions are restored through Supabase Auth and observed with `onAuthStateChange`. Sign-out clears editing state and re-renders public controls. There is no sign-up control or API call.

### Password flows

- `Forgot password?` calls `resetPasswordForEmail` with a redirect derived from the site's canonical origin. The recovery callback lets the artist choose and confirm a new password.
- `Change password` calls Supabase reauthentication. The artist receives a one-time email code, enters it with the new password and confirmation, and the client calls `updateUser` with the nonce.
- Supabase secure password change and the password-changed security notification are enabled in the project.
- Production Auth uses custom SMTP with a sender on the purchased domain. Supabase Site URL and allowed redirect URLs are set to the canonical production origin; localhost is allowed only for development.
- Password policy requires at least 12 characters, including upper- and lowercase letters, a number, and a symbol. Leaked-password protection is enabled if the selected Supabase plan supports it.

### Editing UI

The existing Studio bar becomes the entry point for `Manage content`, `Upload works`, `Change password`, and `Sign out`. The browser-local Reset action is removed.

- Painting clicks retain the current lightbox editor for metadata, replacement, and deletion.
- Dragging in the unfiltered painting view persists order through the ordering RPC.
- `Manage content` opens an accessible modal with focused sections for paintings, Canvas and YouTube, Spotify galleries, portrait, exhibitions, art projects, and art fairs.
- Each applicable section supports add, edit, reorder, replace, and delete. Destructive actions require explicit confirmation.
- The YouTube editor accepts a YouTube watch/share/embed URL and normalizes it to a privacy-enhanced `youtube-nocookie.com/embed/<id>` URL before saving.
- Every action has pending, success, and error status. Controls that could submit the same mutation are disabled while it is pending.
- Local state changes only after Supabase confirms the mutation. A failed operation leaves the last confirmed public state intact.

## Upload and replacement behavior

Painting and gallery images are decoded in the browser, auto-oriented by the browser decoder, resized to a maximum 1800-pixel edge, and encoded as JPEG unless transparency requires PNG/WebP retention. The measured dimensions are saved with the record. Canvas videos are uploaded unchanged after type and size validation.

Create flow:

1. Validate and prepare the file.
2. Generate a UUID-based Storage path.
3. Upload the object.
4. Insert the metadata row as published.
5. If row insertion fails, attempt to remove the just-uploaded object and report either the original failure or both failures.

Replacement flow uploads the new object first, updates the database row, then deletes the old object. Failure to delete an old object is reported as cleanup debt but does not roll back a successfully published replacement. Delete flow removes the object before deleting the row so the UI never claims an object was removed when Storage rejected the operation.

## One-time content migration

The repository includes an interactive PowerShell migration tool suitable for the user's Windows environment. SQL Editor cannot upload local binaries, so the tool runs after schema, seed, Auth-user creation, and authorization SQL.

The tool:

- reads project URL and publishable/anon key without persisting them;
- prompts for the artist email and a masked password;
- authenticates through Supabase Auth and relies on the same RLS/Storage policies as Studio;
- supports `-DryRun`;
- maps seeded `legacy_path` values to repository files;
- uploads each painting, Canvas video, Spotify image, and portrait to its deterministic UUID path;
- updates `storage_path`, MIME type, and aspect metadata where applicable;
- skips already migrated records, making reruns safe;
- prints a final migrated/skipped/failed summary and exits nonzero if anything failed.

YouTube remains an external embed and is seeded without a file upload. Static assets remain in the repository until the migration report is clean and the deployed site has been verified against Supabase; deleting them is a separate cleanup step.

## SQL delivery and run order

The implementation provides independently runnable files under `supabase/`:

1. `01_schema.sql` creates extensions, tables, constraints, triggers, helper functions, RLS, the Storage bucket, policies, grants, and ordering RPCs.
2. `02_seed_content.sql` idempotently seeds the exact current paintings, media, portrait, and CV content with legacy paths.
3. `03_authorize_artist.sql` validates that exactly one Auth user matches the operator-supplied login email, then adds that UUID to `studio_users`; it aborts on zero or multiple matches.
4. `04_verify.sql` performs read-only assertions and displays policy, bucket, content-count, and authorized-user checks.

All seed operations are idempotent by stable slug or ID. Re-running seed SQL never overwrites metadata that the artist has subsequently edited.

## Configuration and deployment

Browser configuration contains only the Supabase project URL and publishable/anon key. The implementation ships an example plus a deliberately invalid default so missing production configuration falls back safely rather than sending requests to an unintended project. The key is expected to be visible in page source.

Before launch, the operator must:

1. Run the four SQL files in order, creating the Auth account before the authorization file.
2. Add the project URL and publishable key to the deployed browser configuration.
3. Run the media migration and require a clean report.
4. Configure the canonical Site URL and redirect allowlist in Supabase Auth.
5. Configure custom SMTP and enable secure password change plus password-change notifications.
6. Verify public browsing, Studio CRUD, sign-out, recovery, and password change on the production domain.

## Contact email

`CONTACT_EMAIL`, the displayed mail link, and the `mailto:` fallback are all set to `nazlibelgin@gmail.com`. No receiving provider is required for that Gmail inbox. A transactional provider is used only for automated Supabase Auth mail; a future server-delivered contact form would use that provider or a form backend separately.

## Error handling

- Public read failures preserve fallback content.
- Unauthorized or expired sessions exit Studio mode without discarding public content.
- Validation errors stay adjacent to their field or file.
- Network and Supabase errors are translated to concise messages; raw server details are confined to the console.
- Concurrent controls are disabled per mutation to prevent duplicate uploads and writes.
- Ordering failures restore the last confirmed order.
- Missing Storage objects use the existing titled placeholder behavior.
- Migration and verification tools use nonzero exit codes for automation and clear remediation text for people.

## Testing and acceptance

Pure JavaScript modules expose CommonJS-compatible functions where practical so the existing Node test style can cover:

- database-row normalization and public URL resolution;
- published ordering and grouping;
- HTML escaping and YouTube URL normalization;
- authentication and Studio-authorization state transitions;
- upload path generation and file validation;
- optimistic-looking UI rollback to the last confirmed state;
- migration manifest completeness and idempotent path mapping.

Python structure checks are updated to allow managed sections to render dynamically while preserving semantic headings, fallback content, accessibility attributes, and current Art Works layout. Existing scroll tests remain green. SQL verification is supplied for execution in Supabase because the repository has no local Supabase stack.

Acceptance requires:

- anonymous users can read but cannot mutate database rows or Storage objects;
- an authenticated non-allowlisted user still cannot mutate anything;
- the allowlisted artist can manage every agreed content type;
- changes appear publicly after confirmed saves and survive refresh/device changes;
- password recovery, email reauthentication, password update, and sign-out work on the production domain;
- all current media is present in Storage and every managed record resolves;
- contact links address `nazlibelgin@gmail.com`;
- existing repository checks and new tests pass.
