# Privacy Policy for OK Pour Moi

**Last Updated:** January 8, 2026

## Overview

OK Pour Moi is a Chrome extension that helps users sign PDF attachments in Outlook Web and create reply drafts. This privacy policy explains how the extension handles user data.

## Developer Information

- **Extension Name:** OK Pour Moi
- **Developer:** gbleu
- **Repository:** https://github.com/gbleu/ok-pour-moi
- **Contact:** https://github.com/gbleu/ok-pour-moi/issues

## Data Collection and Usage

### Data We Store

OK Pour Moi stores the following data using Chrome's storage API:

1. **Signature Image** (stored locally via `chrome.storage.local`)**:** Your signature image (PNG or JPG format) uploaded for signing PDFs
2. **Configuration Settings** (synced across devices via `chrome.storage.sync`)**:**
   - Your email address (for identification purposes)
   - Reply message template
   - Signature position and dimensions (x, y, width, height)
3. **Last Run Information** (stored locally via `chrome.storage.local`)**:**
   - Timestamp of last execution
   - Number of emails processed
   - Success/failure status

**Note:** Configuration settings (item 2) are synced across your Chrome browsers via your Google account using Chrome's built-in sync mechanism. Your signature image and run history remain local to each device.

### How We Use Your Data

- **Signature Image:** Used exclusively to embed your signature into PDF documents you choose to sign
- **Email Address:** Used to identify signed documents and populate email fields
- **Reply Message:** Used to create draft replies in Outlook Web
- **Configuration Settings:** Used to customize the extension's behavior according to your preferences

### Data Transmission

**We do NOT:**

- Transmit any data to external servers
- Share your data with third parties
- Sell your data to anyone
- Track your browsing history
- Collect analytics or telemetry

All PDF processing happens locally on your device. Your signature image never leaves your computer. Configuration settings (email, reply message, signature position) may be synced across your Chrome browsers via your Google account.

## Permissions Justification

The extension requests the following permissions:

1. **`storage`**
   - **Purpose:** Save your signature image locally and sync configuration settings across your Chrome browsers
   - **Scope:** Signature image is local-only (`chrome.storage.local`); configuration (email, reply message, signature position) syncs via your Google account (`chrome.storage.sync`)

2. **`activeTab`**
   - **Purpose:** Access the current Outlook Web tab when you explicitly activate the extension
   - **Scope:** Only the active tab, only when you click the extension icon
   - **Benefit:** Does not require broad access to all your browsing activity

3. **`scripting`**
   - **Purpose:** Inject scripts to interact with Outlook Web interface for finding attachments and creating drafts
   - **Scope:** Only on Outlook Web domains you're actively using

4. **Host Permissions** (outlook.office365.com, outlook.office.com, outlook.live.com, attachments.office.net)
   - **Purpose:** Required to interact with Outlook Web and download attachments
   - **Scope:** Limited to Microsoft Outlook domains only

## Data Security

- All data is stored using Chrome's secure storage API
- Your signature image is stored in base64 format
- No data is transmitted over the network
- No remote code execution

## User Rights

You have complete control over your data:

- **Access:** View your stored data in the extension's options page
- **Modify:** Update your signature, email, or message at any time
- **Delete:** Remove the extension to delete all stored data
- **Export:** Your data is stored locally and you can access it through Chrome's extension storage

## Data Retention

Data is retained:

- Until you uninstall the extension
- Until you manually clear Chrome extension data
- Until you manually delete it in the options page

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect data from children.

## Compliance with Chrome Web Store Policies

This extension complies with:

- Chrome Web Store Developer Program Policies
- Limited Use Policy: User data is not sold to third parties or used for purposes unrelated to the extension's core functionality
- European Digital Services Act (DSA): Non-trader designation applies (open-source, free software)

## Changes to This Policy

We may update this privacy policy to reflect changes in the extension or legal requirements. Updates will be posted to the GitHub repository with a new "Last Updated" date.

## Open Source

This extension is open source. You can review the complete source code at:
https://github.com/gbleu/ok-pour-moi

## Contact

For questions, concerns, or requests regarding this privacy policy or your data:

- Open an issue: https://github.com/gbleu/ok-pour-moi/issues
- Repository: https://github.com/gbleu/ok-pour-moi

## Consent

By installing and using OK Pour Moi, you consent to this privacy policy.
