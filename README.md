# CEPALCO Accounts Monitor

A static website (GitHub + Netlify) that reads your `ACCOUNTS_MASTERLIST` Excel file in the browser. It shows collections, uncollected balances, charts, an accounts table, and a report generator.

## Pages
- **Collections** (`index.html`): total billed, collected, uncollected, collection rate. Charts: collected by month paid, collected vs uncollected, by customer type. A month selector shows one month or all months.
- **Accounts** (`index.html`): search and filter, "Month paid" column, Early / On time / Late tag.
- **Generate report** (`report.html`): your Collection Monitoring Update Tool. Pick the month, year, and week scope, then print, save as PDF, copy as text, or export to Word.

## Status tags
Each account gets one tag, used on the Accounts table and the report page:
- **Fully paid:** remaining balance is zero.
- **Partially paid:** has a paid amount and still has a remaining balance.
- **No payment:** has a bill and no paid amount.
- **No billing:** no bill (BILLING says NO BILL, or no bill amount).

An account with blank amounts but "PAID" in DN/ODAA is tagged fully paid. If the sheet has none of the new money columns, the report falls back to the older DN/ODAA and blank-balance rules. On the report page, "No payment" accounts are split into 1 month and 2+ months using MONTHS UNPAID.

## Month rule
A payment is counted in the month of its **PAYMENT DATE**, not the due date. Example: bill 9/27/2026, due 10/06/2026, paid 9/28/2026 counts in September 2026.

## One upload for both pages
When you click **Load Excel** on the Collections page, the file is also kept in this browser. Opening **Generate report** then loads it automatically. You can still choose a different file on the report page.

## Your data stays private
Excel files are read **in your browser** and saved in that browser only. Nothing is uploaded to GitHub or Netlify, so the repo contains no customer data. `.gitignore` blocks `.xlsx`, `.xlsm`, and `.csv` from being committed. Use a private repo.

## Excel columns used (sheet `MONITORING FOR CODE`)
`CUSTOMER TYPE`, `CUSTOMER NAME`, `CONTRACT NO.`, `AREA`, `MONTHS UNPAID`, `DUE DATE`, `ARREARS`, `LATEST BILL AMOUNT`, `TOTAL BALANCE AMOUNT`, `PAID AMOUNT`, `PAYMENT DATE`, `REMAINING BALANCE`.

- Collections page: total = `TOTAL BALANCE AMOUNT`, else `ARREARS + LATEST BILL AMOUNT`, else `AMOUNT`. Remaining = `REMAINING BALANCE`, else total minus paid.
- Report page: the amount shown per account is `REMAINING BALANCE` when that column exists.
- A payment with no payment date is grouped under "No date" on the Collections page.

## Deploy
1. Create a **private** GitHub repository and push these files.
2. Netlify: Add new site > Import from Git > pick the repo. Build command: none. Publish directory: `.`
3. Open the site and click **Load Excel**.

No API key or environment variables are needed.

## Not included yet
DN and JO tracker, priority and bill-on-site views, account detail page, login screen, shared online database, AI analytics, and a separate payments sheet for installments.

## Files
- `index.html`: collections dashboard and accounts table
- `report.html`: report generator (based on REPORT_BUILDER.html)
- `netlify.toml`: Netlify settings
- `.gitignore`: keeps Excel files out of GitHub
