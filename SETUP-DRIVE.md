# Google Drive mirror for client uploads — 5-minute setup

Every file a client uploads through `/account` (the cabinet) is also copied to
a Google Drive folder owned by **imverica@gmail.com**, organized as:

```
{your Imverica Uploads folder}
  └─ {YYYY-MM-DD} · {client name}
      └─ original-file-name.pdf
      └─ another-file.jpg
```

This runs as part of `netlify/functions/upload.js`. If the env vars below
aren't set, the Drive copy is silently skipped — the encrypted Blob copy in
the cabinet still works, so nothing breaks.

## 1. Sign into Google Cloud Console with imverica@gmail.com

Go to https://console.cloud.google.com/ and sign in with that account.

## 2. Create a project

Top-left dropdown → **New project** → name it `imverica-drive`. Take note of
the project ID.

## 3. Enable the Google Drive API

In the search bar at the top, type **Google Drive API** → click **Enable**.

## 4. Create a Service Account

- Left menu → **APIs & Services** → **Credentials**
- **+ Create credentials** → **Service account**
- Name: `imverica-uploads`
- Skip the optional permissions and user access steps → **Done**

## 5. Generate a key for the service account

- Click the service account row → **Keys** tab → **Add key** → **Create new key**
- Choose **JSON** → **Create**. A `xxx.json` file downloads. Open it in a text
  editor — you'll paste it as one big string into Netlify in a moment.

Note the value of `client_email` inside the JSON, looks like:
`imverica-uploads@imverica-drive.iam.gserviceaccount.com`.

## 6. Create the target folder in Drive and share it with the service account

- Open https://drive.google.com (signed in as **imverica@gmail.com**)
- New → Folder → name it e.g. `Imverica · Client uploads`
- Right-click the folder → **Share** → paste the service account email from
  step 5 → set permission to **Editor** → **Send** (uncheck "notify people")
- Open the folder. Copy the **Folder ID** from the URL — it's the last
  segment of `https://drive.google.com/drive/folders/{THIS_PART}`

## 7. Add the env vars to Netlify

In Netlify dashboard → site → **Site settings** → **Environment variables**:

| Key | Value |
|---|---|
| `GDRIVE_SERVICE_ACCOUNT_JSON` | the **entire** JSON content from step 5 (paste as-is, including the curly braces) |
| `GDRIVE_PARENT_FOLDER_ID` | the folder ID from step 6 |

Save. Trigger a redeploy (any push will do, or click **Deploys → Trigger deploy**).

## 8. Test

- Log in to https://imverica.com/account
- Open a request (or create one) → upload a file
- Within ~3 seconds, the file appears in your Drive folder under a subfolder
  named `2026-05-26 · {client name}` (or email if name is missing)

If something goes wrong, check **Netlify → Logs → Functions → upload**. Lines
like `drive: bad SA JSON` or `drive token http 401` point at the cause.

## Notes

- The service account only has `drive.file` scope (drive.file = "Per-file
  access to files created or opened by the app"). It cannot read the rest of
  the Drive account. Safe minimum permission.
- Drive copies are **best-effort**. The encrypted Blob upload to the cabinet
  always succeeds first; the Drive mirror runs after and never blocks or
  fails the user's upload.
- File names are sanitized server-side; folder names are
  `YYYY-MM-DD · client-name` truncated to 80 chars.
- To stop the Drive mirror temporarily, delete the env vars in Netlify and
  redeploy.
