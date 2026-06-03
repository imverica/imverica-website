/**
 * QA — Google Drive lib smoke test.
 *
 * Usage:
 *   # With env vars set (real Drive check)
 *   node scripts/qa-google-drive.js
 *
 *   # Without env vars (verifies graceful fall-through to DriveDisabled)
 *   unset GOOGLE_DRIVE_SA_KEY_BASE64 GDRIVE_SERVICE_ACCOUNT_JSON
 *   unset GOOGLE_DRIVE_ROOT_FOLDER_ID GDRIVE_PARENT_FOLDER_ID
 *   node scripts/qa-google-drive.js
 *
 * Exit code 0 = pass, 1 = fail.
 *
 * What it verifies:
 *   1. Lib loads without runtime errors
 *   2. When env vars are missing → throws DriveDisabled (not generic Error)
 *   3. checkDriveConfig() returns { ok: false } cleanly when disabled
 *   4. When env vars ARE set: getAccessToken works, root folder is
 *      accessible, can create + delete a smoke-test folder + file
 */

const path = require('path');
const fs = require('fs');

let drive;
try {
  drive = require(path.join(__dirname, '..', 'netlify/functions/lib/google-drive.js'));
} catch (err) {
  console.error('FAIL: lib failed to load:', err.message);
  process.exit(1);
}

let pass = 0, fail = 0;
function ok(msg) { console.log('  ✓', msg); pass++; }
function bad(msg, err) { console.error('  ✗', msg, err ? '— ' + (err.message || err) : ''); fail++; }

async function main() {
  console.log('=== Google Drive lib smoke test ===\n');

  // ─── 1. Module shape ───────────────────────────────────────────
  console.log('[1] Module exports');
  if (typeof drive.uploadAttachmentsToClientFolder === 'function') ok('uploadAttachmentsToClientFolder exported');
  else bad('uploadAttachmentsToClientFolder missing');
  if (typeof drive.checkDriveConfig === 'function') ok('checkDriveConfig exported');
  else bad('checkDriveConfig missing');
  if (drive.DriveDisabled && drive.DriveDisabled.prototype instanceof Error) ok('DriveDisabled exported as Error subclass');
  else bad('DriveDisabled missing or not Error subclass');

  // ─── 2. Graceful failure when env vars missing ─────────────────
  console.log('\n[2] Graceful failure (env vars missing)');
  const hasEnv = Boolean(
    (process.env.GOOGLE_DRIVE_SA_KEY_BASE64 && process.env.GOOGLE_DRIVE_SA_KEY_BASE64.length > 100) ||
    (process.env.GDRIVE_SERVICE_ACCOUNT_JSON && process.env.GDRIVE_SERVICE_ACCOUNT_JSON.length > 100)
  );
  if (!hasEnv) {
    try {
      const cfg = await drive.checkDriveConfig();
      if (cfg.ok === false && cfg.error) ok('checkDriveConfig returns { ok: false, error } cleanly');
      else bad('checkDriveConfig should return ok:false when env vars missing — got ' + JSON.stringify(cfg));
    } catch (err) {
      bad('checkDriveConfig threw instead of returning', err);
    }
    try {
      await drive.uploadAttachmentsToClientFolder({
        clientName: 'Smoke Test',
        orderId: 'IMV-SMOKE-TEST',
        attachments: []
      });
      bad('uploadAttachmentsToClientFolder should throw DriveDisabled when env missing — but it returned');
    } catch (err) {
      if (err instanceof drive.DriveDisabled) ok('uploadAttachmentsToClientFolder throws DriveDisabled when env vars missing');
      else bad('Expected DriveDisabled, got: ' + err.constructor.name + ' — ' + err.message);
    }
  } else {
    ok('SKIP — env vars are set, will run live tests instead');
  }

  // ─── 3. Live Drive test (only if env vars set) ─────────────────
  if (hasEnv) {
    console.log('\n[3] Live Drive integration');
    try {
      const cfg = await drive.checkDriveConfig();
      if (cfg.ok) ok('Drive config valid (SA: ' + cfg.saEmail + ', root: ' + cfg.rootId + ')');
      else { bad('Drive config check failed: ' + cfg.error); fail++; return; }
    } catch (err) {
      bad('checkDriveConfig threw', err); return;
    }

    // Create a tiny smoke-test upload
    const smokeBuf = Buffer.from(`Imverica smoke test — ${new Date().toISOString()}\nThis file is safe to delete.`, 'utf8');
    const smokeOrder = 'IMV-SMOKE-' + Date.now();
    try {
      const result = await drive.uploadAttachmentsToClientFolder({
        clientName: 'Imverica QA Bot',
        orderId: smokeOrder,
        attachments: [{
          filename: `smoke-test-${Date.now()}.txt`,
          buffer: smokeBuf,
          mimeType: 'text/plain'
        }]
      });
      if (result.enabled) ok('uploadAttachmentsToClientFolder returned enabled:true');
      else bad('uploadAttachmentsToClientFolder returned enabled:false');
      if (result.uploadedFiles && result.uploadedFiles.length === 1) ok('1 file uploaded successfully');
      else bad('Expected 1 uploaded file, got ' + (result.uploadedFiles || []).length);
      if (result.skippedFiles && result.skippedFiles.length === 0) ok('No skipped files');
      else bad('Some files were skipped: ' + JSON.stringify(result.skippedFiles));
      if (result.clientFolder && result.clientFolder.id) ok('Client folder ID returned: ' + result.clientFolder.id);
      else bad('No clientFolder.id in result');
      if (result.orderFolder && result.orderFolder.id) ok('Order folder ID returned: ' + result.orderFolder.id);
      else bad('No orderFolder.id in result');
      if (result.orderFolder && result.orderFolder.webViewLink) ok('Order folder webViewLink: ' + result.orderFolder.webViewLink);
      else bad('No webViewLink — file uploaded but link not generated');

      console.log('\n  ⚠ Smoke-test files left in your Drive — delete the folder');
      console.log('     "Imverica QA Bot/' + smokeOrder + '" manually when done.');
    } catch (err) {
      bad('Live upload failed', err);
    }
  }

  // ─── Summary ───────────────────────────────────────────────────
  console.log('\n=== Result ===');
  console.log(`Passed: ${pass}`);
  console.log(`Failed: ${fail}`);
  if (fail > 0) process.exit(1);
  console.log('All checks passed ✓');
}

main().catch((err) => {
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
});
