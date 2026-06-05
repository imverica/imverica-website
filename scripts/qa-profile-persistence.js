#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATA_ENCRYPTION_KEY = 'qa-profile-encryption-key';

const blobsPath = require.resolve('@netlify/blobs');
const records = new Map();
let storeOptions = null;
require.cache[blobsPath] = {
  id: blobsPath,
  filename: blobsPath,
  loaded: true,
  exports: {
    getStore(input) {
      storeOptions = input;
      return {
        async get(key, options) {
          assert.deepStrictEqual(options, { type: 'json' });
          return records.get(key) || null;
        },
        async setJSON(key, value) {
          records.set(key, value);
        }
      };
    }
  }
};

const storePath = path.resolve(__dirname, '../netlify/functions/lib/profile-store.js');
delete require.cache[storePath];
const { readProfile, updateProfile } = require(storePath);

(async () => {
  const email = 'profile-qa@example.com';
  const saved = await updateProfile(email, { firstName: 'Profile', lastName: 'Tester' });
  assert.strictEqual(saved.firstName, 'Profile');
  assert.strictEqual(storeOptions, 'imverica-profiles', 'store must not default to unsupported strong consistency');

  const loaded = await readProfile(email);
  assert.strictEqual(loaded.firstName, 'Profile');
  assert.strictEqual(loaded.lastName, 'Tester');
  assert.strictEqual(loaded.email, email);

  process.env.GOOGLE_CLIENT_ID = 'qa-google-client-id';
  process.env.SESSION_SECRET = 'qa-session-secret-long-enough';
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        aud: process.env.GOOGLE_CLIENT_ID,
        iss: 'https://accounts.google.com',
        email_verified: true,
        email: 'google-profile-qa@example.com',
        given_name: 'Google',
        family_name: 'Tester',
        name: 'Google Tester'
      };
    }
  });

  const authPath = path.resolve(__dirname, '../netlify/functions/auth.js');
  delete require.cache[authPath];
  const { handler } = require(authPath);
  const response = await handler({
    httpMethod: 'POST',
    headers: { host: 'localhost:8888', origin: 'http://localhost:8888' },
    body: JSON.stringify({ action: 'google', credential: 'qa-google-credential' })
  });
  global.fetch = originalFetch;
  assert.strictEqual(response.statusCode, 200);

  const googleProfile = await readProfile('google-profile-qa@example.com');
  assert.strictEqual(googleProfile.firstName, 'Google');
  assert.strictEqual(googleProfile.lastName, 'Tester');

  for (const accountFile of ['account.html', 'astro-site/public/account.html']) {
    const accountHtml = fs.readFileSync(path.resolve(__dirname, '..', accountFile), 'utf8');
    assert(
      accountHtml.includes('const profile = (await ensureProfile()) || {};'),
      `${accountFile} must let signed-in users enter the dashboard even when optional profile details are missing`
    );
    assert(
      accountHtml.includes('Authentication grants access to the cabinet.'),
      `${accountFile} should document that profile details cannot gate dashboard access`
    );
    assert(
      !accountHtml.includes("if (!profile){ clearMsg('profile-msg'); show('step-profile'); $('pf-first').focus(); return; }"),
      `${accountFile} must not force the repeated Complete your profile loop`
    );
  }

  console.log('Profile persistence QA passed.');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
