const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(text, label) {
  assert(html.includes(text), `index.html missing ${label}`);
}

includes('langManual', 'manual language lock');
includes('changeIntakeLanguage', 'language switch reload handler');
includes('data-address-autocomplete', 'address autocomplete input binding');
includes('addressSuggestEndpoint', 'address suggestion endpoint binding');
includes('data-flow-phone-group', 'split phone group renderer');
includes('intakePhoneCountry', 'split contact phone country field');
includes('intakePhoneArea', 'split contact phone area field');
includes('intakePhoneNumber', 'split contact phone number field');
includes('data-flow-address-history', 'structured address history renderer');
includes('data-flow-employment-history', 'structured employment history renderer');
includes('.intake-option input{position:absolute;opacity:0;pointer-events:none;}', 'hidden radio/checkbox dots CSS');
includes('function optionValue(option)', 'canonical option value helper');
includes('function optionLabel(option)', 'localized option label helper');
includes('renderSelectOptions(options, value)', 'state dropdown selection renderer');
includes('pdfDraftEndpoint', 'PDF draft endpoint binding');
includes('pdfDraftEndpoints', 'PDF draft endpoint fallback binding');
includes('data-generate-pdf-draft', 'PDF draft button binding');
includes("['I-765', 'I-485']", 'I-765 and I-485 PDF draft support');
includes("link.download = 'imverica-' + formCode.toLowerCase() + '-draft.pdf';", 'form-specific PDF draft filename');
includes('function validateBaseStep()', 'base intake step validation');
includes('state.step === 1 && !state.service', 'service step cannot advance without category');
includes('state.step === 2 && !state.formCode && !state.situation', 'details step cannot advance without form or situation');
includes('function usesFilePreview()', 'file preview endpoint helper');
includes("return usesFilePreview() ? 'https://imverica.com' + path : path;", 'localhost functions should stay local');

assert(!/if \(data\.language\) state\.lang = data\.language;/.test(html), 'route should not blindly override selected language');
assert(!/window\.location\.hostname === '127\.0\.0\.1'[\s\S]{0,160}'https:\/\/imverica\.com' \+ path/.test(html), 'localhost route/flow endpoints should not force production');

console.log('intake UI static QA passed');
