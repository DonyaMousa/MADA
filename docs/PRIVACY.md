# Privacy, retention, and deletion

Mada collects only data needed for the features a student chooses to use.

## What is stored

- Account email (authentication)
- Profile answers the student saves
- Saved scholarships and application workspace records
- Private documents the student uploads
- Letter drafts and optional AI review requests
- Community posts the student publishes
- Reminder preferences and delivery logs (status, not message bodies of private files)
- Admin audit events for listing changes

## Private files

Documents are private by default. Access is limited to the owning user. Communities never receive files, CVs, application status, or AI transcripts.

Retention: extracted text and any embeddings derived from a file are deleted when the file is deleted. Application attachments are removed with the file.

Signed download links, when using Supabase Storage, are short-lived (60 seconds) and created only after an ownership check.

## AI boundaries

Scholarship Q&A retrieves verified listing text for the selected scholarship only. Attached documents are included only after an explicit per-conversation opt-in, and only files attached to that application. One application’s private context cannot enter another conversation.

Mada does not train models on private CVs, letters, or uploads.

## Account deletion

Deletion removes profile, applications, documents (and extracted text), letters, reminder prefs, and community memberships. Community **posts already published** are replaced with a tombstone (“[deleted]”) so threads stay readable; they no longer point at the account. Auth user deletion on hosted Supabase requires the service-role delete-account function.

## Backups

Hosted Supabase projects follow Supabase’s platform backup policy. The local development store lives in this browser (IndexedDB) and is not backed up. Do not treat local development data as durable.

## Email

Deadline emails are sent only when SMTP is configured on the API server. Delivery attempts are logged. If credentials are missing, the UI reports the integration as unconfigured; the app does not claim that mail was sent.
