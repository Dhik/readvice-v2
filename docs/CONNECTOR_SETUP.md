# Data Connector Setup — Google Service Account & Sheets

The DataConnector sync engine ([lib/connectors/sync-engine.js](../lib/connectors/sync-engine.js))
reads Google Sheets via a **service account**. This guide covers creating the
account, formatting the credential, and sharing a spreadsheet so a sync can run.

> If `GOOGLE_SERVICE_ACCOUNT_JSON` is missing or a placeholder, a sync now fails
> fast with a clear message (validated in [lib/google-sheets.js](../lib/google-sheets.js)
> before the first API call):
> `GOOGLE_SERVICE_ACCOUNT_JSON appears to be a placeholder or invalid …`
> — instead of the cryptic OpenSSL `DECODER routines::unsupported`.

---

## 1. Create a Google service account + enable the Sheets API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and select
   (or create) a project.
2. **Enable the API:** APIs & Services → Library → search **"Google Sheets API"**
   → **Enable**.
3. **Create the account:** APIs & Services → Credentials → **Create credentials**
   → **Service account**. Give it a name (e.g. `readvice-sheets-reader`) and create.
   No project roles are required — access is granted per-spreadsheet (step 3 below).
4. **Create a key:** open the service account → **Keys** tab → **Add key** →
   **Create new key** → **JSON** → **Create**. A `.json` file downloads. This file
   contains `client_email` and `private_key` — treat it as a secret.

---

## 2. Format `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env.local`

The credential must be a **single line** with the `private_key` newlines escaped
as `\n`. The downloaded JSON already stores `private_key` with `\n` escapes, so
the simplest path is to **minify the whole file to one line** and paste it.

```bash
# Produce a single-line value (run against the downloaded key file):
node -e "console.log(JSON.stringify(require('./service-account.json')))"
```

Paste the output into `.env.local`:

```dotenv
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"…","private_key_id":"…","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE…\n-----END PRIVATE KEY-----\n","client_email":"readvice-sheets-reader@your-project.iam.gserviceaccount.com","client_id":"…", … }
```

**Validation requirements** (enforced at runtime by `validateGoogleCredentials()`):
- `client_email` is present, contains `@`, and ends in `.iam.gserviceaccount.com`
  (not `...` or empty).
- `private_key` is present, starts with `-----BEGIN PRIVATE KEY-----` after
  un-escaping `\n`, and is > 100 characters.

Common pitfalls:
- **Don't** wrap the value in single quotes and also have real newlines — keep it
  one line with `\n` escapes inside `private_key`.
- The loader un-escapes `\n` for you; a literal multi-line key in `.env.local`
  will break dotenv parsing.
- Restart `next dev` after editing `.env.local` (env is read at server start).

---

## 3. Share the spreadsheet with the service account (Viewer)

The service account can only read sheets that are **shared with its email**:

1. Open the target Google Sheet.
2. **Share** → paste the service account `client_email`
   (e.g. `readvice-sheets-reader@your-project.iam.gserviceaccount.com`).
3. Set role to **Viewer** → **Send** (uncheck "notify" — it's a robot).

The sync uses the **read-only** scope (`spreadsheets.readonly`); Viewer is enough.

---

## 4. The `cleora-shopee` connector is configured and ready

The `cleora-shopee` DataConnector (id **1**, tenant **cleora-beauty**) is already
set up against the `SHEET_ORDERS_DEFAULT` spreadsheet
(`1ksZm0fLUTdZbf8ITNQXxOizbhpOfjHj32nWAthDFyWI`):

| Setting | Value |
|---|---|
| `sheetTab` | `Shopee Processed` |
| `dataRange` | `A2:R` (18-column Shopee format) |
| `connectorType` / `targetTable` | `order_sync` / `Order` |
| `upsertKey` | `["orderId","tenantId"]` |
| `staticValues` | `{ platform: "shopee", salesChannelId: 1 }` |

**Verified column mapping** (0-based):

| Field | sheetColumn | transform |
|---|---|---|
| `orderId` | 0 | string |
| `orderDate` | 3 | date_auto |
| `gmv` | 14 | currency |
| `nett` | 16 | currency |
| `qty` | 12 | int |
| `status` | 17 | string |
| `customerUsername` | 6 | string |
| `customerName` | 7 | string |

Once real credentials are in place (steps 1–2) **and** the spreadsheet is shared
with the service account (step 3), run the sync:

```bash
# As a superadmin session (or click the connector's Test button in the UI):
POST /api/connectors/1/sync
# → { ok: true, imported, updated, skipped, errors }
```

On a fetch failure (bad credentials / sheet not shared / wrong tab name) the route
returns **502** with a clear message and does **not** touch the connector's
`lastSyncAt` / `lastSyncResult` — no partial state is written.
