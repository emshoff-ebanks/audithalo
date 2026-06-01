# Rules

This directory is the source of truth for state-board supervision rules. Each rule is encoded as a YAML file under `{jurisdiction-license}/v{N}.yaml`. Rules are versioned; supervisees who begin under v1 remain under v1 even if v2 ships later (grandfathering is statutory in most states).

## Workflow for updating a rule

1. **Verify** the rule is current at its citation URL. Update `verification.last_verified_at` and `verification.last_verified_by`.
2. **If a meaningful change has occurred**: bump the version, create a new file `v{N+1}.yaml`, set `effective_start` to the date the new rule takes effect, set `effective_end` on the prior version to the day before.
3. **Open a PR.** The diff is the source-of-truth audit trail for what changed.
4. **CI runs the evaluator** against the synthetic test fixtures to confirm the new rule behaves as expected.

## File layout

```
rules/
  nc-lcmhca/
    v1.yaml             # current rule
    v2.yaml             # future rule when NC changes it
  ca-apcc/
    v1.yaml
  tx-lpc-associate/
  fl-rmhci/
  ny-permit/
```

## Validation

Every YAML file is validated against `src/lib/rules/types.ts` (Zod schema). Builds fail if a rule file is malformed. Citations and verification dates are required, not optional.
