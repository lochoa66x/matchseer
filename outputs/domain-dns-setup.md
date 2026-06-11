# MatchSeer Domain DNS Setup

## Goal

Connect `matchseer.com` from GoDaddy to the Vercel `matchseer` project.

Status:
- `matchseer.com` connected.
- `www.matchseer.com` redirects to `matchseer.com`.
- First production deployment is working.

## Recommended Setup

Keep the domain registered at GoDaddy and manage only the needed DNS records there.

Do not change nameservers unless we intentionally want Vercel to manage all DNS for the domain.

## Vercel

In Vercel:

1. Open the `matchseer` project.
2. Go to **Domains**.
3. Add `matchseer.com`.
4. Add `www.matchseer.com`.
5. Use the exact DNS records Vercel shows for each domain.

Vercel’s docs say apex domains like `matchseer.com` use an **A record**, while subdomains like `www.matchseer.com` use a **CNAME record**.

## GoDaddy Records

In GoDaddy DNS for `matchseer.com`, use:

```text
Type: A
Name: @
Value: use the IP Vercel shows
TTL: 1 hour / default
```

Common Vercel apex value is:

```text
76.76.21.21
```

For `www`:

```text
Type: CNAME
Name: www
Value: use the CNAME target Vercel shows
TTL: 1 hour / default
```

Common Vercel `www` target is:

```text
cname.vercel-dns.com
```

If Vercel shows a unique CNAME target, use that exact value instead.

## Records To Remove Or Replace

Remove or replace conflicting records:
- GoDaddy parked `A` record for `@`
- GoDaddy forwarding records
- Existing `www` CNAME pointing somewhere else
- Any old website builder records for the same host

Do not delete MX records if email is configured for the domain.

## Verification

After saving records:

1. Go back to Vercel Domains.
2. Click refresh/check on `matchseer.com`.
3. Click refresh/check on `www.matchseer.com`.
4. Wait for Vercel to show both as valid.

DNS often updates within an hour, but can take up to 48 hours globally.
