# CEPALCO Accounts Monitor

A static website (GitHub + Netlify) that reads your `ACCOUNTS_MASTERLIST` Excel file in the browser. It shows collections, uncollected balances, charts, an accounts table, and a report generator.

## Pages
- **Collections** (`index.html`): total billed, collected, uncollected, collection rate. Charts: collected by month paid, collected vs uncollected, by customer type. A month selector shows one month or all months.
- **Accounts** (`index.html`): users with Create, Edit or Delete on Accounts (and admin) see the **full Excel-format grid**: all 24 columns of `MONITORING FOR CODE`, in the same order. Click a cell to edit it (Enter or Tab saves, Esc cancels). Filter by **Area**, **Rate schedule** and **Customer type** (tick several values in each). Click a column heading to sort the way Excel does: A\u2192Z for text, highest to lowest for numbers (newest first for dates); click again to reverse, a third time to clear. Filters and sorting work together. The tables are wide, so slide sideways with the scrollbar above the table, Shift + mouse wheel, or a swipe; the customer name column stays in view. Use **+ Add account** and the red **\u2715** to delete. **Export to Excel** downloads the current data as a backup. Everyone else sees the read-only summary table with the Early / On time / Late tag, and it has the same **Area / Rate schedule / Customer type filters** and **Excel-style heading sort** (A\u2192Z for text, highest first for numbers).
- **Contact Directory** (`index.html`): customer name, contract number, phone number, email address and contact person, built from the Accounts list. Search, filter by missing email or contact person, and edit phone, email and contact person in place (with Edit permission).
- **Generate report** (`report.html`): your Collection Monitoring Update Tool. It now reads the live account data, so edits made in the Accounts grid show up in the report. Pick the month, year, and week scope, then print, save as PDF, copy as text, or export to Word.
- **Admin** (`admin.html`): users, passwords and permissions.

## Permissions (Admin page)
Pick a user (or Guest) and tick what they can do on each page:
- **Accounts:** View (summary table), Create (add accounts), Edit (change any cell), Delete (remove accounts).
- **Contact Directory:** View, and Edit (phone, email and contact person). Create and Delete do not apply because contacts come from the accounts.
- **Collections / Generate report:** View.

Every change is checked again on the server, so hiding a button is not the only protection. People who cannot see the Contact Directory and cannot edit accounts never receive the phone, email or contact person columns at all.

## Calculated columns (same rules as the Excel formulas)
- **REMAINING BALANCE** = TOTAL BALANCE AMOUNT \u2212 PAID AMOUNT (always automatic).
- **TOTAL BALANCE AMOUNT** = ARREARS + LATEST BILL AMOUNT when ARREARS is filled in. When ARREARS is blank, total is typed in by hand.

## Where the data lives
Account data is stored on the server (Netlify Blobs), shared by all users. **Load Excel** (admin only) replaces everything with the contents of a workbook, after a confirmation. Day to day, edit in the Accounts grid instead. Each row keeps an internal ID, so two accounts can share a contract number.

**Upgrading from the older version:** the old saved data used a different format. After deploying, an admin needs to click **Load Excel** once. Nothing else is needed.

Note: the EMAIL ADDRESS column in the masterlist currently holds only the flags `NO EMAIL` / `WITH EMAIL`. The directory shows these as "No email" / "Has email, address not recorded" until a real address is entered.

## Status tags
Each account gets one tag, used on the Accounts table and the report page:
- **Fully paid:** remaining balance is zero.
- **Overpaid:** remaining balance is negative. Listed by name with the overpaid amount in the report.
- **Partially paid:** has a paid amount and still has a remaining balance.
- **No payment:** has a bill and no paid amount.
- **No billing:** no bill (BILLING says NO BILL, or no bill amount).

An account with blank amounts but "PAID" in DN/ODAA is tagged fully paid. If the sheet has none of the new money columns, the report falls back to the older DN/ODAA and blank-balance rules. On the report page, "No payment" accounts are split into 1 month and 2+ months using MONTHS UNPAID.

## Month rule
A payment is counted in the month of its **PAYMENT DATE**, not the due date. Example: bill 9/27/2026, due 10/06/2026, paid 9/28/2026 counts in September 2026.

## Your data stays private
Excel files are read in your browser, then saved to your Netlify site's private storage. The repo contains no customer data. `.gitignore` blocks `.xlsx`, `.xlsm`, and `.csv` from being committed. Use a private repo.

## Excel columns used (sheet `MONITORING FOR CODE`)
`CUSTOMER TYPE`, `CUSTOMER NAME`, `CONTRACT NO.`, `AREA`, `MONTHS UNPAID`, `DUE DATE`, `ARREARS`, `LATEST BILL AMOUNT`, `TOTAL BALANCE AMOUNT`, `PAID AMOUNT`, `PAYMENT DATE`, `REMAINING BALANCE`.

- Collections page: total = `TOTAL BALANCE AMOUNT`, else `ARREARS + LATEST BILL AMOUNT`, else `AMOUNT`. Remaining = `REMAINING BALANCE`, else total minus paid.
- Report page: the amount shown per account is `REMAINING BALANCE` when that column exists.
- A payment with no payment date is grouped under "No date" on the Collections page.

## Deploy
1. Create a **private** GitHub repository and push these files.
2. Netlify: Add new site > Import from Git > pick the repo. Build command: none. Publish directory: `.`
3. Open the site and click **Load Excel**.

No API key or environment variables are needed. The first sign-in is `admin` / `admin`: change that password on the Admin page right away.

## Not included yet
DN and JO tracker, priority and bill-on-site views, account detail page, AI analytics, and a separate payments sheet for installments.

## Files
- `index.html`: collections dashboard and accounts table
- `accounts.js`: editable Excel-format Accounts grid and the Contact Directory
- `auth.js`: login, sessions and permission checks (browser side)
- `admin.html`: users and permissions
- `login.html`: sign in
- `netlify/functions/api.js`: server: logins, permissions, account data (create / edit / delete), contacts
- `report.html`: report generator (based on REPORT_BUILDER.html)
- `netlify.toml`: Netlify settings
- `.gitignore`: keeps Excel files out of GitHub
