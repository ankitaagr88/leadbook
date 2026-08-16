# LeadBook

A personal lead-management web app for an individual insurance agent. Each agent
gets her own isolated instance — her own Google Sheet, her own Apps Script
deployment, her own config file. There is no shared database and no server to
pay for.

## What it does

- Record each lead's contact details, address and the product pitched
- Filter by city, then area, then product — all built from her own data, and she
  can add a new city or area just by typing it
- Track which documents each lead has shared. Only she can tick one; nothing is
  ever inferred
- Log a dated history of every follow-up meeting, with the next visit date and
  next step always visible
- Manage her own product list — descriptions, and the default document checklist
  each product needs

## How it fits together

| Piece | What it is |
|---|---|
| `index.html` | The entire frontend. Static, agent-agnostic, hosted on GitHub Pages |
| `config.json` / `config-[slug].json` | One per agent. Her name and her Web App URL |
| `config.example.json` | The template to copy |
| `apps-script/Code.gs` | The API — `doGet` / `doPost`, bound to one agent's Sheet |
| `apps-script/Setup.gs` | Run once to build the Sheet's six tabs and seed defaults |

The Sheet is the database: `Config`, `Products`, `DocTemplates`, `Leads`,
`FollowUps`, `Documents`.

## Setting up an agent

1. **Sheet** — copy the master template Sheet, or run `setupMasterTemplate()`
   from `Setup.gs` against a blank one. Fill in the `Config` tab: her name, her
   mobile, her email. Those last two are how she signs in
2. **Backend** — in that Sheet, Extensions → Apps Script → paste both `.gs`
   files → Deploy → New deployment → **Web app**, *Execute as: Me*,
   *Who has access: **Anyone***. Copy the `/exec` URL
3. **Frontend** — copy `config.example.json` to `config.json` (one agent) or
   `config-[slug].json` (several agents on one deployment), and paste in the
   `/exec` URL
4. **Publish** — commit, and enable GitHub Pages on the repo root

Re-deploy the Web App as a **new version** after any change to the `.gs` files,
or nothing you changed goes live.

## How sign-in works

There is no auth infrastructure. The agent signs in with the mobile number and
email on her own `Config` tab; `login` is the only request that runs without a
token. On a match the server returns the access token that guards every other
call — so that token never ships inside a deployed file. Ten failed attempts
trigger a cooldown.

A phone number and an email are only semi-private, so this is a convenience
credential rather than a strong one. It suits a personal tracker holding no
financial data.

## Conventions

- Dates are ISO (`YYYY-MM-DD`) in the Sheet, formatted (`12 Aug 2026`) only for
  display
- `LeadID` is a generated string (`LD-0001`), never a row number — row order is
  not stable once anything is sorted
- Changing a product's default document list affects **new leads only**. An
  existing lead keeps the checklist it was created with, so a collected document
  is never lost
- Products are switched off, never deleted. A lead records what it was actually
  pitched

## Not in v1

No renewal or commission tracking, no WhatsApp or SMS, no multi-user view, no
offline mode.

---

created by ai4work
