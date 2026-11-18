#!/usr/bin/env bash
# One-off probe (run on GitHub Actions, which can reach uscis.gov): find the
# GET parameters of the G-1055 fee view that return the fee rows of a form.
set -u
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
mkdir -p probe
curl -sSL -A "$UA" -o probe/page.html 'https://www.uscis.gov/g-1055?form=i-485'
echo "== options for our forms"
grep -oE '<option value="[0-9]+" data-marker="[^"]*"' probe/page.html | grep -iE '"(i-485|i-765|i-90|n-400|i-130|ar-11)"'
ID=$(grep -oE '<option value="[0-9]+" data-marker="i-485"' probe/page.html | grep -oE '[0-9]+' | head -1)
echo "I-485 id: $ID"
echo "== inputs on the page"
grep -oE '<(input|select)[^>]*name="[^"]*"' probe/page.html | grep -viE 'feedback|search|form_build|form_token|form_id' | head -20
VIEW='view_name=form_fee_listing&view_display_id=form_fee_items&view_args=&view_path=%2Fnode%2F52500&view_base_path=&pager_element=0&_wrapper_format=drupal_ajax'
echo "== raw response without a form"
curl -sS -A "$UA" -H 'X-Requested-With: XMLHttpRequest' "https://www.uscis.gov/views/ajax?$VIEW" | head -c 2500; echo
try() {
  local out; out=$(curl -sS -A "$UA" -H 'X-Requested-With: XMLHttpRequest' "https://www.uscis.gov/views/ajax?$VIEW&$1")
  local fees; fees=$(echo "$out" | grep -oE '\$[0-9][0-9,]*' | head -8 | tr '\n' ' ')
  echo "-- $1 => ${#out} bytes, fees: ${fees:-none}"
}
for p in "form=$ID" "form-fee-title=$ID" "form_fee_title=$ID" "title=$ID" "nid=$ID" "field_form_target_id=$ID" "form=i-485" "view_args=$ID"; do try "$p"; done

echo "== exposed filter form inside the view response"
curl -sS -A "$UA" -H 'X-Requested-With: XMLHttpRequest' "https://www.uscis.gov/views/ajax?$VIEW&form=i-485" | python3 -c "
import sys, json, re
for c in json.load(sys.stdin):
    d = c.get('data') if isinstance(c, dict) else None
    if isinstance(d, str) and 'views-exposed' in d:
        for m in re.findall(r'<(?:form|input|select|option|button)[^>]*>', d): print(m[:300])
        print('---- tail of view html ----'); print(re.sub(r'\s+', ' ', d)[-2500:])
"
echo "== the same view in the full page (server-rendered)"
python3 - <<'PY'
import re
h = open('probe/page.html', encoding='utf-8', errors='replace').read()
i = h.find('form-fee-listing-form_fee_items')
print(re.sub(r'\s+', ' ', h[i:i+3500]))
for m in re.findall(r'<form[^>]*>', h): print('FORM:', m[:300])
PY

echo "== response text for I-485"
for p in "form=$ID" "form-fee-title=$ID" "view_args=$ID" "form_fee_title=$ID" "nid=$ID"; do
  out=$(curl -sS -A "$UA" -H 'X-Requested-With: XMLHttpRequest' "https://www.uscis.gov/views/ajax?$VIEW&$p")
  if echo "$out" | grep -q '\$[0-9]'; then
    echo ">> $p"
    echo "$out" | python3 -c "
import sys, json, re, html
for c in json.load(sys.stdin):
    d = c.get('data') if isinstance(c, dict) else None
    if isinstance(d, str) and '\$' in d:
        print(d[:5000])
        t = html.unescape(re.sub(r'<[^>]+>', '|', d)); t = re.sub(r'\s*\|[\s|]*', ' | ', t)
        print('TEXT:', t[:3000]); break
"
    break
  fi
done
