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
includes('localAddressSuggestions', 'local parsed-address fallback for USPS suggestions');
includes('findAddressBlockForSuggestion', 'address suggestion addressBlock resolver');
includes('setAddressBlockPart(block, \'city\', suggestion.city', 'address suggestions should populate city/state/zip parts');
includes('findAddressHistoryRowForSuggestion', 'address suggestion addressHistory row resolver');
includes('setHistoryRowPart(historyRow, \'city\', suggestion.city', 'address history suggestions should populate city/state/zip parts');
includes('data-street-line', 'street-only address line marker');
includes('streetLineLooksOverfilled', 'street line city/state/zip guard');
includes('validateStreetLineCompleteness', 'address city/state/zip required when street is entered');
includes('data-add-history-row', 'address history add-another button');
includes('data-remove-history-row', 'address history remove button');
includes('data-add-travel-row', 'travel history add-another button');
includes('data-flow-travel-history', 'structured travel history renderer');
includes('readTravelRows', 'structured travel history capture');
includes('data-history-coverage-years="5"', 'address history five-year coverage marker');
includes('historyCoverageWarning', 'non-blocking five-year address history warning');
includes('historyWorkCoverageWarning', 'non-blocking five-year work/school history warning');
includes('[data-flow-address-history], [data-flow-employment-history]', 'shared history add/remove and coverage handling');
includes('data-flow-employment-history="\' + esc(field.id) + \'"', 'employment history renderer should use add-one-at-a-time rows');
includes('shouldWarnAddressHistoryCoverage', 'five-year coverage warning helper');
includes('data-flow-phone-us', 'single-input US phone widget for form-flow phones');
includes('intakePhoneUS', 'single-input US contact phone field');
includes('formatUSPhone', 'US phone (XXX) XXX-XXXX formatter');
includes('phoneDigits', 'US phone digit extractor');
includes('imvericaIntakeProgressV1', 'local intake progress persistence');
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
includes('var finalReviewLabel = contactParts.length ? copy.reviewContact : (copy.steps[4] || copy.qAccount);', 'review step should not show blank contact before account/payment');
includes('var finalReviewValue = contactParts.length ? contactParts.join(\' · \') : copy.hAccount;', 'review step points to account/payment when contact is not collected yet');
includes('function usesFilePreview()', 'file preview endpoint helper');
includes("return usesFilePreview() ? 'https://imverica.com' + path : path;", 'localhost functions should stay local');

assert(!/if \(data\.language\) state\.lang = data\.language;/.test(html), 'route should not blindly override selected language');
assert(!/window\.location\.hostname === '127\.0\.0\.1'[\s\S]{0,160}'https:\/\/imverica\.com' \+ path/.test(html), 'localhost route/flow endpoints should not force production');
assert(!/event\.target===this\)closeIntakeModal\(\)/.test(html), 'intake modal must not close on accidental outside click');
assert(/A-Za-z0-9\.!\#\$%&'\*\+\/=\?\^_\{\|\}~-/.test(html), 'email validation should be ASCII-only');

console.log('intake UI static QA passed');
