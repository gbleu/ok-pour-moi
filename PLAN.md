# Improve Coverage: Integration Tests with HTML Fixtures

## Approach
Use real Playwright browser against HTML fixtures that mimic Outlook's DOM structure. This tests the actual DOM traversal logic without depending on real Outlook.

## Changes Required

### 1. Export functions from `src/commands/run.ts`
Export these internal functions for testing:
- `findLastMessageFromOthers(readingPane, myEmail)` - add myEmail param
- `findAttachmentListbox(readingPane, messageButton)`
- `downloadAndSignPdfs(...)` - already has page param

### 2. Create test infrastructure

```
test/
  integration/
    run.test.ts
    fixtures/
      outlook-base.html          # Outlook DOM shell
      outlook-mock.js            # Simulates context menus, clicks
      scenarios/
        single-pdf.html
        multi-message-thread.html
        no-attachments.html
        draft-with-attachments.html
```

### 3. HTML fixture structure
Replicate Outlook's key selectors:
- `[data-convid]` - email items
- `[role="main"]` - reading pane
- `button[name=/^From:/]` - from buttons
- `[role="listbox"][aria-label*="attachments"]` - attachment lists
- `[role="treeitem"]` - folders

### 4. Test scenarios
| Scenario | Tests |
|----------|-------|
| Single email with PDF | Basic flow |
| Multi-message thread | Reverse iteration, skip own emails |
| No attachments | Graceful skip |
| Draft with attachments | DRAFT_MARKER_XPATH exclusion |

### 5. Download handling
Use Playwright route interception to return test PDF:
```typescript
await page.route('**/*.pdf', route =>
  route.fulfill({ body: pdfBytes, contentType: 'application/pdf' })
);
```

## Files to modify
- `src/commands/run.ts` - export functions, parameterize myEmail

## Files to create
- `test/integration/run.test.ts`
- `test/integration/fixtures/outlook-base.html`
- `test/integration/fixtures/outlook-mock.js`
- `test/integration/fixtures/scenarios/*.html` (4 files)

## CI update
Add to `.github/workflows/ci.yml`:
```yaml
- run: bunx playwright install chromium
```
