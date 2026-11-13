# Members and invitations

## Access model

Boardnest separates workspace membership from project membership:

```text
workspace invitation
  -> accepted workspace membership
    -> automatic access to WORKSPACE projects
    -> explicit project_members row for PRIVATE projects
```

A user must be a workspace member before they can become a project member. The
database proves this with the composite foreign key from `project_members` to
`workspace_members`. A project role never grants more access than the user's
workspace role: in particular, a workspace viewer remains read-only.

Workspace roles are:

- `owner`: full workspace control; the final owner cannot leave or be demoted;
- `admin`: manages non-owner members and invitations;
- `member`: creates and edits workspace work;
- `viewer`: read-only access.

Owners are created automatically with the workspace. Invitations can grant
`admin`, `member`, or `viewer`, but never `owner`.

Removing a member cascades their private-project membership and atomically
clears workspace-scoped task assignments, reminders, pending deliveries, and
notifications. Auth credentials and memberships in other workspaces are not
affected.

## Current client workflow

The protected browser `/members` route and native workspace details provide:

- workspace selection;
- a roster with profile name, avatar, role, and join date;
- role changes and removal for manageable non-owner members;
- pending invitation listing and revocation;
- **Change email** for registered workspace owners/admins: a prefilled address
  form preserves the role and atomically replaces the pending invitation;
- recipient-only in-app invitations for existing registered accounts;
- an accessible invitation dialog with email and role validation;
- `/invite/:token` acceptance for email tokens or invitation IDs that survives
  login, registration, and email confirmation;
- clear loading, empty, error, confirmation, and permission states.

Native invitation emails use the same public `/invite/:token` web URL. A
verified Android App Link opens that URL in the installed application; without
the application or domain association, the existing web acceptance page is the
fallback. The token or invitation ID is preserved through native login before acceptance.

Only the current user's own membership is used by the browser to decide whether
to render management actions. This is a usability decision, not an
authorization boundary. PostgreSQL grants, constraints, and RLS make the final
decision for every request.

## Invitation security and lifecycle

`inviteMember` creates 32 random bytes and stores only its SHA-256 hash. Pending
invitations expire after seven days and are unique per normalized email and
workspace. Repeating an active invitation returns a conflict instead of
creating multiple usable tokens.

When an email provider is configured, the API sends an acceptance link through
either the Resend API or authenticated SMTP. SMTP supports Gmail for local and
early-stage testing; Gmail requires a Google App Password rather than the normal
account password. Provider credentials are API-only environment variables.
The raw token is then omitted from the GraphQL response. If delivery is not
configured or fails, the creation dialog exposes a one-time acceptance link as
a local development fallback; the pending invitation remains valid.

Migration 430 creates a `workspace.invited` inbox row only if the normalized
address already belongs to a registered Supabase account at invitation creation
and global, event-specific, and plan in-app preferences allow it. Opening a
mailbox is not account registration. New registrations and old invitations are
not backfilled. Receiving an invitation does not create membership. This event
queues no extra email or push; the invitation email remains the synchronous API
flow. The unread badge polls every 60 seconds while visible and online; the
inbox itself uses Apollo's normal query/cache behavior, so refresh it when
checking a newly received invitation.

In-app links use `/invite/:invitationId` and `acceptInvitationById(id:)`.
That RPC shares email, state, expiry, and idempotency checks with email-token
acceptance. No raw email token is stored in the notification.

**Change email** calls `changeInvitationEmail(id:, email:)` and migration 440's
registered-admin RPC. In one transaction it locks and revokes the unexpired
pending invitation and inserts a replacement with the same workspace/role, a
fresh token, and a fresh seven-day expiry. The old link stops working. A conflict
or failed replacement rolls back the revocation. Accepted, revoked, and expired
invitations cannot be changed; guests retain their single-invitation limit and
have no Change email action. The new address receives email or the existing
manual-link fallback, plus in-app delivery when eligible. Old notification rows
remain history; opening an old invitation reports its revoked state.

`acceptInvitation` sends the raw token only in an authenticated GraphQL request.
The `accept_workspace_invitation` database function hashes it, locks the
matching invitation, verifies its state and expiry, and compares the normalized
invitation email with the authenticated JWT email. Membership creation and the
accepted status change happen in one transaction. Repeating acceptance by the
same account is idempotent. Invalid, expired, revoked, already-used-by-another-
account, and wrong-email attempts do not create membership.

Raw invitation tokens must never be logged, stored in analytics, written to the
database, or added to a `VITE_*` environment variable.

## Project membership

The project details page includes a Project members section. Workspace owners,
admins, and project leads can add an existing workspace member, change their
project role, or remove their explicit project membership. Available roles are
`project_lead`, `member`, and `viewer`.

All workspace members discover projects with `WORKSPACE` visibility. Explicit
roles customize their project permissions, and an explicit project `viewer`
narrows task editing rights. `PRIVATE` projects require an explicit membership
except for workspace owners and admins. A workspace `viewer` always remains
read-only, regardless of the selected project role.

Project membership does not invite an email address into a workspace. If a
person is not yet listed in the workspace roster, complete the workspace
invitation and acceptance flow first, then add them from the project page.

## Verification

Use at least two registered accounts and one workspace:

1. Apply all missing migrations through `440_change_invitation_email.sql` in
   order. Do not rerun already-applied migrations.
2. As an owner, open `/members`, create an invitation, and confirm it appears
   under Pending invitations and is delivered when Resend or SMTP is configured.
3. Open the email link in a signed-out browser, sign in or register with the
   invited email, and confirm the browser returns to `/invite/:token`.
4. Accept and confirm the workspace appears immediately.
5. Sign in with a different email and confirm acceptance is rejected.
6. Try the same email again and confirm the duplicate-pending message.
7. Revoke a new invitation and confirm its link can no longer be accepted.
8. With an existing non-owner workspace member, change `member` to `viewer`
   and confirm the UI and database agree.
9. Confirm the viewer sees the roster but no management actions.
10. Confirm an admin cannot edit or remove an owner.
11. Confirm the final owner cannot be removed directly in Supabase or GraphQL.
12. Confirm a guest can create no more than the documented invitation quota.
13. Open a project as an owner, admin, or project lead and add an existing
    workspace member with each supported project role.
14. Change the project role and confirm the roster updates.
15. Remove the explicit membership and confirm a private project is no longer
    available to that user, while a workspace-visible project remains visible.
16. Confirm a workspace viewer remains read-only after receiving a project
    member or project lead role.
