# Security policy

## Reporting a vulnerability

If you believe you've found a security issue in AuditHalo — credential leak, authentication or authorization bypass, signature or evidence-package tampering, supply-chain concern, anything that could affect a customer's data or the integrity of the compliance record — please report it privately.

**Email:** info@audithalo.com
**Subject line:** `Security: <one-line summary>`

We'll acknowledge receipt within two business days and aim to give you a substantive response (fix planned, mitigations applied, won't-fix with reasoning) within seven days for high-severity issues.

Please do **not** open a public GitHub issue or pull request for security vulnerabilities. Public discussion of a not-yet-mitigated issue puts current customers at risk.

## What to include

The faster we can reproduce, the faster we can patch:

1. A description of the issue and the impact (what an attacker could do).
2. Reproduction steps, ideally with a minimal example. Production-data reproductions are fine — we'll redact before any internal write-up — but please don't escalate or pivot beyond what's needed to demonstrate the issue.
3. The commit hash or deployment URL where you observed the behavior.
4. Any relevant CVE / vendor reference if the issue is in an upstream dependency.

## Scope

In scope:

- Web application at `app.audithalo.com`
- Marketing site at `audithalo.com`
- API routes under `/api` on both hosts
- Authentication, session management, and OAuth integrations (Microsoft, Google)
- The signature + evidence-package generation pipeline (`src/lib/evidence.ts`, `/api/evidence/[id]/route.tsx`)
- The state-rules dataset under `rules/` — incorrect or maliciously misleading citations are a security issue, not just a content issue

Out of scope:

- Reports from automated scanners with no reproduction or impact analysis
- Social-engineering attempts against AuditHalo staff or customers
- Physical attacks on infrastructure
- Denial of service via volumetric attack

## Safe harbor

We will not pursue legal action against good-faith researchers who:

- Report findings privately and give us a reasonable opportunity to remediate before disclosure
- Avoid accessing, modifying, or exfiltrating data beyond what is necessary to demonstrate the issue
- Avoid degrading service availability for other customers

If you're unsure whether something is in scope, email us first. We'd rather hear about a borderline case than have you sit on it.

## Disclosure

Once a fix has shipped, we're happy to credit the reporter publicly (release notes, this file, or a write-up at audithalo.com) — at your option, by the name or handle you prefer, or anonymously.
