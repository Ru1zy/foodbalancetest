# Integration & Manual Test Scripts

Files in this directory (`tests/*.js`) are **manual test harnesses** used to verify integrations with live external services (Telegram Bot API, Google Sheets API, SMTP/Gmail API, PostgreSQL).

They are designed for manual execution with live credentials and are intentionally separated from the automated unit test suite.

## Automated CI Unit Tests
Automated unit tests run via:
```bash
npm test
```
Automated tests live in `lib/**/*.test.ts` and test pure logic, boundary conditions, encryption/signatures, idempotency, and DST time calculations without external API dependencies.
