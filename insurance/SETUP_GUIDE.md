# Setting up a LeadBook Sheet — step by step

For an insurance agent. Follow this top to bottom. It takes about 30 minutes
the first time and about 10 minutes once you've done it before.

You do **not** need to know any coding. You will copy and paste three blocks of
code without changing them.

**Before you start, have these ready:**

- The agent's full name
- Her mobile number
- Her email address

Those last two matter a lot. They are how she logs in. If you type them wrong,
she cannot get into her own app.

---

# Part 1 — Make the Sheet

**1.** Go to **sheets.google.com** and sign in.

**2.** Click the big **+ Blank spreadsheet** button.

**3.** At the very top left it says *Untitled spreadsheet*. Click those words
and type:

```
LeadBook — [her name]
```

For example: `LeadBook — Priya Shah`

**4.** Press Enter. Leave this tab open.

---

# Part 2 — Open the code editor

**5.** In the menu at the top, click **Extensions**.

**6.** Click **Apps Script**.

A new browser tab opens. It looks different from the Sheet — dark buttons on
the left, a code box in the middle. This is normal.

**7.** At the top left it says *Untitled project*. Click it, type
`LeadBook`, and click **Rename**.

---

# Part 3 — Paste in the three code files

You are going to end up with exactly three files. Take them one at a time.

## File 1 of 3 — Code.gs

**8.** On the left you'll see a file called **Code.gs**. Click it.

**9.** The middle box already has a few lines in it, something like
`function myFunction() { }`. **Delete all of it.** Click inside the box, press
**Ctrl+A** (select everything), then press **Delete**.

The box should now be completely empty.

**10.** Open the file `apps-script/Code.gs` from the LeadBook folder. Select
everything in it and copy it.

**11.** Click back into the empty box and paste (**Ctrl+V**).

**12.** Press **Ctrl+S** to save.

## File 2 of 3 — Setup.gs

**13.** On the left, next to the word **Files**, click the small **+** button.

**14.** A little menu appears. Click **Script**.

**15.** It asks for a name. Type:

```
Setup
```

Just `Setup` — do not type `.gs`, it adds that itself. Press Enter.

**16.** A new empty box opens (it may have `function myFunction() { }` in it —
delete that first, same as before).

**17.** Open `apps-script/Setup.gs` from the LeadBook folder, copy everything,
and paste it in.

**18.** Press **Ctrl+S** to save.

## File 3 of 3 — Seed.gs

This is the insurance one. It puts the starter products in — Term Life, Health
Cover, Motor Insurance, Child Plan, ULIP — with the documents each one needs.

**19.** Click the **+** next to **Files** again, then **Script**.

**20.** Name it:

```
Seed
```

**21.** Delete anything in the box, then copy everything from
`insurance/Seed.gs` and paste it in.

**22.** Press **Ctrl+S**.

**Check yourself:** the left side should now list exactly three files —
**Code.gs**, **Setup.gs**, **Seed.gs**. If you have four, or one is named
something else, delete the extra one (click the three dots next to it →
**Delete**).

---

# Part 4 — Run the setup

This is the step that builds all the tabs in the Sheet.

**23.** Near the top of the screen there's a dropdown box showing a function
name. Click it.

**24.** From the list, choose **setupMasterTemplate**.

Make sure you pick that exact one. Not `rotateAccessCode`, not anything else.

**25.** Click the **▶ Run** button next to it.

**26.** A box appears saying **Authorization required**. This is Google
checking you're happy for your own code to touch your own Sheet. Click
**Review permissions**.

**27.** Choose your Google account from the list.

**28.** You will now see a scary-looking screen: *"Google hasn't verified this
app"*. **This is expected.** It says that about all custom scripts, including
your own.

- Click **Advanced** (small text, bottom left)
- Then click **Go to LeadBook (unsafe)**

It is your own code. It is safe.

**29.** Click **Allow**.

**30.** Wait a few seconds. At the bottom, an **Execution log** appears. When
it finishes you'll see lines like:

```
LeadBook setup complete.
Access code: K7M4-QP2X-9RTB-F3WN
```

If you see that, it worked.

**31.** Go back to your Sheet tab and look at the bottom. You should now see
six tabs:

**Config · Products · DocTemplates · Leads · FollowUps · Documents**

Here's what they are, briefly:

| Tab | What's in it |
|---|---|
| **Config** | Her name, phone, email, and her access code |
| **Products** | Term Life, Health Cover, etc. — she can change these in the app |
| **DocTemplates** | Which documents each product needs |
| **Leads** | Her leads. Empty for now |
| **FollowUps** | Her meeting notes. Empty for now |
| **Documents** | Which documents each lead has given. Empty for now |

---

# Part 5 — Fill in her details

**32.** Click the **Config** tab at the bottom of the Sheet.

**33.** You'll see one row of placeholder text. Replace it:

| Column | What to type |
|---|---|
| **AgentName** | Her full name, spelled how she wants it shown |
| **AgentPhone** | Her mobile number |
| **AgentEmail** | Her email address |
| **ReferralCode** | Her initials + the year, e.g. `PS2026` |
| **CreatedDate** | Leave it alone |
| **SharedSecret** | **Leave it alone.** Do not change or delete this |

**Do not touch the SharedSecret.** It is generated automatically and the app
needs it. It is not something she ever types.

> ### ⚠️ The most important step in this whole guide
>
> **Check the phone number and email twice.** She logs in with exactly these
> two things. One wrong letter and she is locked out of her own app, and the
> error message will not tell you which one is wrong.
>
> The phone number can be written any way — `9825011234`, `+91 98250 11234`,
> `098250 11234` all work. Only the last 10 digits are checked.
>
> The email must match exactly, apart from capital letters.

---

# Part 6 — Put it on the internet

**34.** Go back to the Apps Script tab.

**35.** Top right, click the blue **Deploy** button.

**36.** Click **New deployment**.

**37.** At the top left of the box there's a **gear icon** ⚙ next to *Select
type*. Click the gear, then click **Web app**.

**38.** Now fill in the three fields:

| Field | What to put |
|---|---|
| **Description** | `v1` (anything, it's just a note) |
| **Execute as** | **Me** |
| **Who has access** | **Anyone** |

**"Anyone" is required.** It sounds alarming but it is correct — her phone
opens the app without being logged into Google. Her actual data is still
protected: nothing can be read without her phone number and email.

**39.** Click **Deploy**.

**40.** It may ask you to authorise again. Same as before — **Review
permissions → your account → Advanced → Go to LeadBook (unsafe) → Allow**.

**41.** You'll now see a **Web app URL**. It's long and looks like this:

```
https://script.google.com/macros/s/AKfycb................/exec
```

**42.** Click **Copy**. Paste it somewhere safe for a moment — Notepad is fine.
You need it in the next part.

It must end in **/exec**. If it ends in `/dev`, you copied the wrong one — go
back and copy the one labelled *Web app URL*.

---

# Part 7 — Connect her app

Now two small files in the LeadBook folder. Pick a short one-word nickname for
her, all lowercase, no spaces — usually her first name. In these examples it's
`priya`.

**43.** Copy the file `config.example.json` and rename the copy to:

```
insurance/config-priya.json
```

**44.** Open it and fill it in:

```json
{
  "industry": "insurance",
  "agentSlug": "priya",
  "agentName": "Priya Shah",
  "agentPhone": "+91 98250 11234",
  "referralCode": "PS2026",
  "appsScriptUrl": "PASTE THE LONG URL FROM STEP 42 HERE",
  "defaultCityOrder": ["Surat", "Vadodara"]
}
```

- `agentSlug` must match the nickname you picked
- `defaultCityOrder` is just the cities she works in. It only helps on day one;
  after that the app learns her cities from her own leads. You can leave it as
  `[]` if you don't know
- **Never put the access code in this file.** This file is public

**45.** Now make her folder. Copy `insurance/test/` and rename it to
`insurance/priya/`.

**46.** Open `insurance/priya/index.html` and change every `test` to `priya`.
There are three of them. The file should end up like this:

```html
<link rel="canonical" href="../../?industry=insurance&amp;agent=priya">
<meta http-equiv="refresh" content="0; url=../../?industry=insurance&amp;agent=priya">
<script>location.replace('../../?industry=insurance&agent=priya');</script>
```

**47.** Commit and push both files to GitHub. Wait about a minute.

**48.** Her app is now live at:

```
https://leadbook.ai4work.in/insurance/priya/
```

---

# Part 8 — Test it before she sees it

Do this on your phone, not your computer.

- [ ] Open her link. A login screen appears with her name on it
- [ ] Type her mobile and email. It lets you in
- [ ] Try a wrong email. It refuses you
- [ ] Tap **+** and add a fake lead. Pick a product. The document checklist
      fills in by itself
- [ ] Untick one document before saving. Only the ticked ones appear on the lead
- [ ] Tick a document as shared. Close the app, open it again — still ticked
- [ ] Tap the pencil at the top of a lead and change something. It saves
- [ ] Log a follow-up with a next visit date. It shows in the history
- [ ] Tap her phone number on a lead. The dialer opens
- [ ] Delete the fake lead's row from the Leads tab in the Sheet when you're done

If all of that works, she's ready.

---

# If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| "that mobile number and email don't match" | Typo in the Config tab, or she typed a different email | Check the Config tab, letter by letter |
| "Too many failed sign-in attempts" | Too many wrong tries | Wait 5 minutes, then try again |
| "Unexpected response from the server" | **Who has access** isn't set to **Anyone** | Deploy → Manage deployments → edit ✏ → fix it → Deploy |
| "This link is missing its LeadBook" | The config file name doesn't match the folder name | Check `config-priya.json` and the `priya/` folder use the same nickname |
| "appsScriptUrl is not a Web App /exec URL" | The URL is wrong or still the placeholder | Re-copy it from step 42. It must end in `/exec` |
| "Missing tab: Products" | Setup didn't finish | Run `setupMasterTemplate` again |
| The Sheet has no tabs | Step 25 never ran | Go back to Part 4 |
| You changed the code but nothing changed | Editing code doesn't publish it | Deploy → Manage deployments → edit ✏ → **Version: New version** → Deploy |

---

# Doing this again for the next agent

You don't have to repeat all of it. Once you have one finished Sheet:

1. Open it → **File → Make a copy** → name it `LeadBook — [next agent]`
2. The copy already has all the code and all the tabs
3. Open the copy's **Config** tab and put in the new agent's details
4. **Important:** in the copy, run `rotateAccessCode` once (Apps Script, same
   dropdown as step 24). This gives her a fresh access code instead of sharing
   the first agent's
5. Deploy a **New deployment** from the copy — Part 6 again. Each agent needs
   her own URL
6. Then Part 7 with her nickname

Every agent gets her own Sheet and her own deployment. Nobody can see anybody
else's leads.
