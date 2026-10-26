#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const SITE_ORIGIN = 'https://imverica.com';
const SITE_HOST = 'imverica.com';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const INDEXNOW_KEY = '422d86f10b29f846575ebf1a69d9c882';
const KEY_FILENAME = `${INDEXNOW_KEY}.txt`;
const KEY_FILE = new URL(`../astro-site/public/${KEY_FILENAME}`, import.meta.url);
const KEY_LOCATION = `${SITE_ORIGIN}/${KEY_FILENAME}`;
const MAX_URLS = 10_000;

const usage = `Usage:
  npm run indexnow -- [--dry-run] <URL-or-path> [<URL-or-path> ...]

Examples:
  npm run indexnow -- --dry-run /about-imverica-legal-solutions
  npm run indexnow -- https://imverica.com/i-485-help /ru/i-485-help

Only HTTPS URLs whose host is exactly imverica.com are accepted. Paths must begin
with a single slash. Nothing is submitted unless at least one URL or path is passed.`;

function parseArguments(argv) {
  let dryRun = false;
  const inputs = [];

  for (const argument of argv) {
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      console.log(usage);
      process.exit(0);
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    }
    inputs.push(argument);
  }

  if (inputs.length === 0) {
    throw new Error('Pass at least one explicit imverica.com URL or path.');
  }
  if (inputs.length > MAX_URLS) {
    throw new Error(`IndexNow accepts at most ${MAX_URLS} URLs per request.`);
  }

  return { dryRun, inputs };
}

function normalizeUrl(input) {
  let url;

  if (input.startsWith('/')) {
    if (input.startsWith('//')) {
      throw new Error(`Protocol-relative paths are not allowed: ${input}`);
    }
    url = new URL(input, SITE_ORIGIN);
  } else {
    try {
      url = new URL(input);
    } catch {
      throw new Error(`Paths must begin with "/", or pass a full URL: ${input}`);
    }
  }

  if (url.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs are allowed: ${input}`);
  }
  if (url.host !== SITE_HOST) {
    throw new Error(`URL host must be exactly ${SITE_HOST}: ${input}`);
  }
  if (url.username || url.password) {
    throw new Error(`URLs with credentials are not allowed: ${input}`);
  }
  if (url.hash) {
    throw new Error(`URL fragments are not accepted by IndexNow: ${input}`);
  }

  return url.href;
}

async function verifyKeyFile() {
  const keyFileContents = (await readFile(KEY_FILE, 'utf8')).trim();
  if (keyFileContents !== INDEXNOW_KEY) {
    throw new Error(`IndexNow key file ${KEY_FILENAME} does not match the configured key.`);
  }
}

async function main() {
  const { dryRun, inputs } = parseArguments(process.argv.slice(2));
  await verifyKeyFile();

  const urlList = [...new Set(inputs.map(normalizeUrl))];
  const payload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };

  if (dryRun) {
    console.log(`Dry run: would POST ${urlList.length} URL(s) to ${INDEXNOW_ENDPOINT}`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    const details = responseBody ? `: ${responseBody}` : '';
    throw new Error(`IndexNow returned HTTP ${response.status}${details}`);
  }

  console.log(`IndexNow accepted ${urlList.length} URL(s) with HTTP ${response.status}.`);
  console.log('Acceptance does not guarantee crawling, indexing, ranking, or citation.');
}

main().catch((error) => {
  console.error(`IndexNow submission failed: ${error.message}`);
  process.exitCode = 1;
});
