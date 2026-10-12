# CEPALCO Accounts Monitor

A static website (GitHub + Netlify) that reads your `ACCOUNTS_MASTERLIST` Excel file in the browser and shows collections, uncollected balances, charts, an accounts table, and AI analytics.

## What it does
- **Collections tab:** total billed, collected, uncollected, collection rate. Charts: collected by month paid, collected vs uncollected, and by customer type. A month selector shows any single month or all months.
- **Month rule:** a payment is counted in the month of its **PAYMENT DATE**, not the due date. Example: bill 9/27/2026, due 10/06/2026, paid 9/28/2026 counts in September 2026.
- **Accounts tab:** search and filter, with a "Month paid" column and an Early / On time / Late tag (payment date vs due date).
- **AI analytics tab:** sends a summary to Claude through a Netlify Function and shows the answer.

## Your data stays private
The Excel file is read **in your browser** and saved in that browser only. It is never uploaded to GitHub or Netlify, so the repo contains no customer data. `.gitignore` also blocks `.xlsx`, `.xlsm`, and `.csv` files from being committed.

## Excel columns used (sheet `MONITORING FOR CODE`)
`CUSTOMER TYPE`, `CUSTOMER NAME`, `CONTRACT NO.`, `AREA`, `MONTHS UNPAID`, `DUE DATE`, `ARREARS`, `LATEST BILL AMOUNT`, `TOTAL BALANCE AMOUNT`, `PAID AMOUNT`, `PAYMENT DATE`, `REMAINING BALANCE`.

- Total balance = `TOTAL BALANCE AMOUNT`; if blank, `ARREARS + LATEST BILL AMOUNT`; if those are blank, the older `AMOUNT` column.
- Remaining = `REMAINING BALANCE`; if blank, total minus paid.
- If the first sheet name differs, the site reads the first sheet instead.
- A payment with an amount but no payment date is grouped under "No date".

## Deploy
1. Create a **private** GitHub repository and push these files.
2. In Netlify: Add new site > Import from Git > choose the repo. Build command: none. Publish directory: `.`
3. Netlify > Site configuration > Environment variables, add:
   - `ANTHROPIC_API_KEY`: your key from console.anthropic.com
   - `APP_PASSCODE`: any passcode you choose (stops strangers from using your AI credit)
   - `AI_MODEL` (optional): defaults to `claude-sonnet-5-5`
4. Redeploy, open the site, click **Load Excel**.

To test locally, run `npx netlify dev` (the AI function does not work from a plain file open).

## AI privacy
By default only totals and groupings are sent (billed, collected, uncollected, by month, by type, by months unpaid, top 10 balances as "Account 1..10"). Customer names are sent only if you tick "Include account names". Phone numbers and emails are never sent.

## Not included yet
DN and JO tracker, priority and bill-on-site views, account detail page, login screen, shared online database, and a separate payments sheet for installments (one payment date per account for now).

## Files
- `index.html`: the whole website
- `netlify/functions/ai.mjs`: AI proxy that keeps your API key private
- `netlify.toml`: Netlify settings
- `.gitignore`: keeps Excel files out of GitHub
