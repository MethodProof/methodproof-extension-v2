# Chrome Web Store Publishing Guide

## First-Time Setup (manual, one-time)

### 1. Register a Developer Account
- Go to https://chrome.google.com/webstore/devconsole
- Sign in with the Google account you want as the publisher
- Pay the one-time $5 registration fee
- Set publisher display name to "MethodProof"

### 2. Create Google Cloud OAuth Credentials
These are needed for CI/CD automated publishing.

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new project (or use existing)
3. Enable the **Chrome Web Store API** at https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com
4. Create an **OAuth 2.0 Client ID** (type: Web application)
   - Authorized redirect URI: `http://localhost:8818`
5. Note the **Client ID** and **Client Secret**
6. Get a refresh token:
   ```bash
   npx chrome-webstore-upload-cli@3 init \
     --client-id YOUR_CLIENT_ID \
     --client-secret YOUR_CLIENT_SECRET
   ```
   This opens a browser for Google OAuth consent. After authorizing, it prints a refresh token.

### 3. Add GitHub Secrets
In the `methodproof-extension` repo settings (Settings > Secrets > Actions), add:

| Secret | Value |
|--------|-------|
| `CHROME_EXTENSION_ID` | The extension ID (assigned after first manual upload) |
| `CHROME_CLIENT_ID` | From step 2 |
| `CHROME_CLIENT_SECRET` | From step 2 |
| `CHROME_REFRESH_TOKEN` | From step 2 |

### 4. First Upload (manual)
The first version must be uploaded manually through the developer console.

```bash
npm run zip
```

Then in the Chrome Web Store Developer Console:
1. Click "New Item"
2. Upload `methodproof-extension.zip`
3. Fill in listing details (see STORE_LISTING.md for copy)
4. Add screenshots (see below)
5. Set privacy policy URL: `https://app.methodproof.com/extension-privacy`
6. Complete the Privacy Practices tab (see STORE_LISTING.md)
7. Submit for review
8. Copy the extension ID from the listing URL and add it to GitHub Secrets

After first review approval, subsequent versions deploy automatically via `git tag v0.1.1 && git push --tags`.

## Screenshots

Chrome Web Store requires 1-5 screenshots at 1280x800 or 640x400.

Recommended screenshots:
1. **Popup — Disconnected state** — showing the extension in dormant mode
2. **Popup — Connected state** — showing active session with session ID
3. **Dashboard graph view** — showing browser events in the process graph (take from app.methodproof.com)
4. **Data minimization** — annotated view showing what IS and ISN'T captured
5. **Session timeline** — browser events appearing in the narrated timeline

Take these from a real session on app.methodproof.com with the extension active. Use a clean browser profile with no other extensions visible.

## Version Bumping

Version in both `package.json` and `manifest.json` must match. Bump both before tagging:

```bash
# Example: bump to 0.1.1
sed -i '' 's/"version": "0.1.0"/"version": "0.1.1"/' package.json manifest.json
git add package.json manifest.json
git commit -m "chore: bump extension to v0.1.1"
git tag v0.1.1
git push && git push --tags
```

## Review Timeline

- First submission: 1-5 business days (sometimes longer)
- Updates: typically 1-3 business days
- Rejections: fix the cited issue and resubmit. Common rejection reasons:
  - `<all_urls>` without clear justification (our justification: content script for copy/search/AI detection)
  - Missing or inadequate privacy policy
  - Description doesn't match functionality

## Store Listing Fields

All copy is in `STORE_LISTING.md`. Key fields:
- **Category:** Developer Tools
- **Language:** English
- **Privacy policy URL:** `https://app.methodproof.com/extension-privacy`
- **Homepage URL:** `https://methodproof.com`
- **Support URL:** `https://github.com/MethodProof/methodproof-extension/issues`
