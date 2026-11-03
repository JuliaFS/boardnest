# Mobile end-to-end tests

These flows exercise an installed Android build with Maestro. They do not run
inside Expo Go. Use an EAS development or preview APK whose public environment
values point to the intended test API.

## Test data

Create a dedicated registered account and store its credentials as GitHub
Actions secrets:

- `MOBILE_E2E_EMAIL`;
- `MOBILE_E2E_PASSWORD`.

Account deletion must use a separate disposable account through
`MOBILE_E2E_DELETION_EMAIL` and `MOBILE_E2E_DELETION_PASSWORD`. Never point the
destructive flow at the reusable regression account. Registration uses
`MOBILE_E2E_NEW_EMAIL` and `MOBILE_E2E_NEW_PASSWORD`.

The account must be allowed through the configured Turnstile test policy. The
`notifications` flow can consume an unread notification when one is available,
but also verifies the empty inbox. `core-workflow` creates uniquely named
workspace, project, and task records. Remove these records from the test
environment periodically.

The `registration` and `account-deletion` flows are intentionally excluded from
the default execution order. Registration needs a fresh address and access to
its confirmation email. Account deletion permanently removes the supplied test
account and must only be run with a disposable user.

## Local execution

Install the APK on an emulator or physical device, start the API it was built
to use, and run a flow from the repository root:

```bash
maestro test \
  -e E2E_EMAIL="mobile-e2e@example.com" \
  -e E2E_PASSWORD="replace-me" \
  .maestro/flows/authentication.yaml
```

For the core workflow, also provide `E2E_WORKSPACE_NAME`,
`E2E_PROJECT_NAME`, and `E2E_TASK_NAME`. For registration, provide a unique
`E2E_NEW_EMAIL`, `E2E_NEW_PASSWORD`, and `E2E_DISPLAY_NAME`.

## GitHub Actions

Run the **Mobile E2E** workflow manually and provide a public or signed EAS APK
URL. Select the smallest relevant flow. The workflow boots an isolated Android
emulator, installs the APK, executes Maestro, and uploads a JUnit report.
