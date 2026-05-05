# Google Sheets Integration

Last updated: 2026-04-28

## Overview

The LaunchMate service account can read and write Google Sheets. The recommended pattern is for a human to own the Sheet and share it with the service account — this keeps the file in team Drive, not invisible service account storage.

## Service Account

`janet-marketing-agent@janet-492005.iam.gserviceaccount.com`
GCP project: `janet-492005`

## What a Service Account Drive Is (and Isn't)

- Service accounts have Drive storage but **no UI** — files they own are invisible to humans unless explicitly shared
- A service account CAN create files and then share them to human emails via the Drive API
- **Preferred pattern**: Human creates the Sheet, shares with service account as Editor — cleaner ownership, lives in team Drive, no Drive API needed

## Required APIs (GCP project `janet-492005`)

| API | Required for | Status |
|-----|-------------|--------|
| Google Sheets API | Read/write sheets | Not yet enabled (as of Apr 10) — ⚠️ status unverified since |
| Google Drive API | Create files, manage ownership | Not needed if human creates the sheet |

Enable at: <https://console.cloud.google.com/apis/library?project=janet-492005>

## Setup Steps

1. Enable **Google Sheets API** in GCP console (link above)
2. Create a Google Sheet in your Drive (or shared team folder)
3. Share with `janet-marketing-agent@janet-492005.iam.gserviceaccount.com` as **Editor**
4. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
5. Provide the Sheet ID to configure LaunchMate

## Intended Use Cases

- LaunchMate reporter writing daily report data to a persistent Sheet
- Historical campaign performance tracking across all clients
- Client-facing exports from collected Google Ads / GA4 data

## Current Status (Apr 28)

⚠️ Setup is still **incomplete**. Raels asked on Apr 27 whether Janet can see/modify a Google Sheet — suggesting she has not yet shared a sheet with the service account. The Google Sheets API may also not be enabled in GCP.

**Blocker:** Raels needs to:
1. Enable Google Sheets API in GCP (if not done)
2. Create or identify a target Sheet
3. Share it with `janet-marketing-agent@janet-492005.iam.gserviceaccount.com` as Editor

Until this is done, Janet cannot read or write Google Sheets.

## See also

- [channel-architecture.md](channel-architecture.md) — LaunchMate channel details
- [launchmate-report-format.md](launchmate-report-format.md) — current Slack report format
