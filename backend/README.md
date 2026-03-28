# Backend (HMT)

## Run Tests

Run all backend tests with one command:

```bash
npm test
```

This runs the full backend Node test suite with readable spec output.

## Screenshot-Friendly Test Output

Each run saves test output to:

- `test-results/latest.log` (latest run)
- `test-results/backend-tests-YYYY-MM-DDTHH-MM-SS-sssZ.log` (timestamped archive)

## Optional Test Commands

```bash
npm run test:all       # same as npm test
npm run test:all:raw   # direct node test reporter output
```
