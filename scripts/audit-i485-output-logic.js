const fs = require('fs');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function has(key, words) {
  const k = String(key || '').toLowerCase();
  return words.some(w => k.includes(String(w).toLowerCase()));
}

const payloadPath = process.argv[2] || 'payloads/i-485-generated-payload.json';
const payload = readJson(payloadPath);

const issues = [];

function anyKey(patterns) {
  return Object.keys(payload).filter(k => has(k, patterns));
}

function hasAnyValue(patterns) {
  return anyKey(patterns).some(k => {
    const v = payload[k];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
}

function report(message) {
  issues.push(message);
}

if (hasAnyValue(['interpreter'])) {
  report('Page 22: Interpreter fields are present in final payload.');
}

if (hasAnyValue(['preparer'])) {
  report('Page 23: Preparer fields are present in final payload.');
}

if (hasAnyValue(['g28', 'volag', 'attorney', 'representative', 'statebar', 'barnumber'])) {
  report('Page 1: Attorney fields are present in final payload.');
}

if (hasAnyValue(['line65', 'line66', 'pt9line65', 'pt9line66', 'pt8line68c', 'pt8line68d'])) {
  report('Page 20: Public benefit table fields are present in final payload.');
}

console.log('');
console.log('I-485 FINAL PAYLOAD LOGIC AUDIT');
console.log('Payload:', payloadPath);
console.log('');

if (!issues.length) {
  console.log('PASS: No blocked conditional fields found in final payload.');
} else {
  for (const issue of issues) {
    console.log('ISSUE:', issue);
  }
  process.exitCode = 1;
}
