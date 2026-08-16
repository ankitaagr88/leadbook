# tests

One file. It boots `index.html` in jsdom against a fake Apps Script backend and
walks the app the way an agent would.

```bash
cd tests
npm install      # jsdom, once
node smoke.js
```

Exit code 0 and `All checks passed`, or it names what broke.

## What it covers

109 checks across: login (including a rejected attempt), the lead list and its
sorting, city → area → product filters, search, lead detail, document toggling,
editing a lead, the add-lead document checklist, follow-up types, the products
screen, the referrals screen, sign-out, and the three config-resolution shapes.

## What it does not cover

**The Apps Script backend.** `Code.gs` and `Setup.gs` are never executed here —
the backend is a mock that mimics their responses. A change to `Code.gs` can
break the real app while these tests stay green. Verify backend changes against
a real deployment.

It also can't see anything visual. Layout, colour and touch targets need a phone.

## Keeping it honest

The mock lives at the top of `smoke.js`. When you change a response shape in
`Code.gs`, change it here too — otherwise the tests pass against a backend that
no longer exists.

The checks share one DOM and run in order, so later steps see earlier steps'
writes. Several assertions depend on that: the referrals check needs leads that
earlier steps created. Adding a step in the middle can shift a later count.
