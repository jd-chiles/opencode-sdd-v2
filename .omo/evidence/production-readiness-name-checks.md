# Public release name checks

Date: 2026-10-19

- GitHub authenticated identity lookup returned `jd-chiles`, matching the candidate repository owner.
- The authenticated GitHub account created the planned empty public repository `jd-chiles/opencode-sdd-v2` after confirming it was absent. GitHub reports the signed-in user as owner/admin. The repository has no source commit yet.
- Read-only npm registry lookup for `opencode-v2-sdd-plugin` returned HTTP 404; there is no public package record under that exact name at lookup time.
- Local read-only `npm whoami --fetch-timeout=5000 --fetch-retries=0` returned `ENEEDAUTH`. This environment has no authenticated npm publishing identity, so npm ownership/claimability was not established.

The npm check does not prove package ownership/claimability. The public GitHub repository exists, but npm Trusted Publishing, `npm-production` reviewer protection, CI execution, and publication remain unconfigured or unverified.
