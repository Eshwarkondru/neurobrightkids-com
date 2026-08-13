# End-to-end test runner

`parent_portal_flow.py` drives a real browser through the whole screening pipeline:

1. creates a fresh Child account through the sign-up form,
2. submits a complete sample assessment (all 15 questions),
3. asserts the ML prediction server function was called and returned 200,
4. asserts the generated report was persisted (re-read from the database on `/reports`),
5. asserts the Parent Portal renders that report — child name, risk percentage,
   weekly stats — instead of the empty state.

## Run it

```bash
# dev server must already be running on :8080
npm run test:e2e
# or against the published site
python3 e2e/parent_portal_flow.py --base-url https://neurobrightkids-com.lovable.app
# watch it happen in a visible browser
python3 e2e/parent_portal_flow.py --headed
```

Requires Python 3 with Playwright (`pip install playwright && playwright install chromium`).
Each run creates one throwaway `@neurolearn-test.dev` account; a screenshot of the
final Parent Portal is written to `/tmp/browser/e2e_parent_portal.png`.
Exit code is 0 only when every check passes.
