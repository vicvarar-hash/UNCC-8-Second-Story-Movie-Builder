## Contract 06 validation tweak (2-12)

**Change made:** Added a fake required entry point to `contracts/06_api_key.mjs` so the contract fails on purpose, to validate that the contract runner correctly surfaces failures.

**File:** `UNCC-8-Second-Story-Movie-Builder-infra/contracts/06_api_key.mjs`

**What was added:** In the `AI_ENTRY_POINTS` array, a fifth entry:
```javascript
"__VALIDATION_ONLY_REMOVE_ME__", // temporary: forces contract to fail for validation
```

**Result when run:** Contract 06 fails with:
```
❌ [06] API key validation (trust gate, TR6)
   Missing AI entry points: __VALIDATION_ONLY_REMOVE_ME__
```

**How to revert:** Remove that line from the `AI_ENTRY_POINTS` array so it only contains the four real entry points:
- generateProjectPlan
- suggestNextShotPlan
- runAISelfReview
- generateVideoAttempt
