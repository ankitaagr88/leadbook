# LeadBook — Insurance

The insurance vertical. Everything here is specific to insurance agents;
everything in the parent folder is the shared core and knows nothing about any
industry.

## What's in here

| File | |
|---|---|
| `Seed.gs` | The starter products and their document lists. **The only insurance-specific code in the system** |
| `config-[slug].json` | One per agent. Copy `/config.example.json`, never this |
| `[slug]/index.html` | Redirect stub so her link is `leadbook.ai4work.in/insurance/[slug]/` |
| `DOU.md` | Document of Understanding template, insurance wording |
| `Proposal_TEMPLATE.docx` | Client proposal template, Hinglish |

`DOU.md` and `Proposal_TEMPLATE.docx` are internal and stay out of the public
repo — see the whitelist in `/.gitignore`.

## Adding an agent to this vertical

Two files, no code:

1. `insurance/config-[slug].json` — copy `/config.example.json`, fill in her
   details and her Web App `/exec` URL
2. `insurance/[slug]/index.html` — the redirect stub, copy `test/index.html`
   and change both occurrences of the slug

Her link is then `https://leadbook.ai4work.in/insurance/[slug]/`.

Full checklist in `/ASSEMBLY.md`.

## Starting another vertical

Copy this folder's shape, not its contents:

```
realestate/
  Seed.gs                 <- change SEED_PRODUCTS, change nothing else
  config-[slug].json
  [slug]/index.html       <- ?industry=realestate
```

Then add the two whitelist lines for it in `/.gitignore`. No change to
`index.html`, `Code.gs` or `Setup.gs` — the core is already generic. "Products"
and "documents" are whatever the agent calls them; the app has no opinion.

The one thing worth checking before committing to a new vertical is whether the
Sheet schema still fits — a vertical needing per-lead money, dates-with-renewal
or multi-party records would need `SCHEMA.md` extended, not just reskinned.
