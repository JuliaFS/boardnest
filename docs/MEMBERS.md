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
- clear loading, empty, error, confirmation, and permission states.

Only the current user's own membership is used by the browser to decide whether
to render management actions. This is a usability decision, not an
authorization boundary. PostgreSQL grants, constraints, and RLS make the final
decision for every request.

## Invitation security and lifecycle

`inviteMember` creates 32 random bytes, returns the base64url token once, and
stores only its SHA-256 hash. Pending invitations expire after seven days and
are unique per normalized email and workspace. Repeating an active invitation
returns a conflict instead of creating multiple usable tokens.

The raw token is deliberately shown only in the successful creation dialog.
The current stage does not send it by email or accept it in the browser. Until
the acceptance stage is implemented, an invitation remains pending and does
not create a `workspace_members` record.

The next invitation stage must add:

1. transactional token acceptance using a server-only hash comparison;
2. email ownership matching after login or registration;
3. atomic invitation status and `workspace_members` changes;
4. `/invite/:token` browser handling and email delivery;
5. safe expired, revoked, already accepted, and duplicate-member behavior.

Raw invitation tokens must never be logged, stored in analytics, written to the
database, or added to a `VITE_*` environment variable.

## Project membership follow-up

All workspace members discover projects with `WORKSPACE` visibility. A future
project Members section will manage explicit `project_members` rows for
`PRIVATE` projects with `project_lead`, `member`, and `viewer` roles. Direct
project invitations by email should still resolve workspace membership first.

## Verification

Use at least two registered accounts and one workspace:

1. As an owner, open `/members`, create an invitation, and confirm it appears
   under Pending invitations.
2. Try the same email again and confirm the duplicate-pending message.
3. Revoke the invitation and confirm it disappears.
4. With an existing non-owner workspace member, change `member` to `viewer`
   and confirm the UI and database agree.
5. Confirm the viewer sees the roster but no management actions.
6. Confirm an admin cannot edit or remove an owner.
7. Confirm the final owner cannot be removed directly in Supabase or GraphQL.
8. Confirm a guest can create no more than the documented invitation quota.
