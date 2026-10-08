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

## Current browser workflow

The protected `/members` route provides:

- workspace selection;
- a roster with profile name, avatar, role, and join date;
- role changes and removal for manageable non-owner members;
- pending invitation listing and revocation;
- an accessible invitation dialog with email and role validation;
- `/invite/:token` acceptance that survives login, registration, and email confirmation;
- clear loading, empty, error, confirmation, and permission states.

Only the current user's own membership is used by the browser to decide whether
to render management actions. This is a usability decision, not an
authorization boundary. PostgreSQL grants, constraints, and RLS make the final
decision for every request.

## Invitation security and lifecycle

`inviteMember` creates 32 random bytes and stores only its SHA-256 hash. Pending
invitations expire after seven days and are unique per normalized email and
workspace. Repeating an active invitation returns a conflict instead of
creating multiple usable tokens.

When `RESEND_API_KEY` and `INVITATION_EMAIL_FROM` are configured, the API sends
an acceptance link through the [Resend email API](https://resend.com/vercel).
The raw token is then omitted from the GraphQL response. If delivery is not
configured or fails, the creation dialog exposes a one-time acceptance link as
a local development fallback; the pending invitation remains valid.

`acceptInvitation` sends the raw token only in a credentialed GraphQL request.
The `accept_workspace_invitation` database function hashes it, locks the
matching invitation, verifies its state and expiry, and compares the normalized
invitation email with the authenticated JWT email. Membership creation and the
accepted status change happen in one transaction. Repeating acceptance by the
same account is idempotent. Invalid, expired, revoked, already-used-by-another-
account, and wrong-email attempts do not create membership.

Raw invitation tokens must never be logged, stored in analytics, written to the
database, or added to a `VITE_*` environment variable.

## Project membership follow-up

All workspace members discover projects with `WORKSPACE` visibility. A future
project Members section will manage explicit `project_members` rows for
`PRIVATE` projects with `project_lead`, `member`, and `viewer` roles. Direct
project invitations by email should still resolve workspace membership first.

## Verification

Use at least two registered accounts and one workspace:

1. Apply migrations through `350_invitation_acceptance.sql`.
2. As an owner, open `/members`, create an invitation, and confirm it appears
   under Pending invitations and is delivered when Resend is configured.
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
