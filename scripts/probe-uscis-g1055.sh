#!/usr/bin/env bash
# One-off probe (run on GitHub Actions, which can reach uscis.gov): find a
# direct request that returns the G-1055 fee rows for one form.
set -u
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
mkdir -p probe
curl -sSL -A "$UA" -o probe/page.html 'https://www.uscis.gov/g-1055?form=i-485'
echo "== form select options (first 40 of $(grep -o '<option value="[^"]*"' probe/page.html | wc -l))"
grep -oE '<option value="[^"]*"[^>]*>[^<]*' probe/page.html | head -40
grep -oE '<select[^>]*>' probe/page.html | head -5
echo "== view wrapper"; grep -oE '.{0,200}form-fee-listing.{0,300}' probe/page.html | head -4
VIEW='view_name=form_fee_listing&view_display_id=form_fee_items&view_args=&view_path=%2Fnode%2F52500&view_base_path=&pager_element=0'
show() {
  echo "-- $1"; echo "   status/type/size: $(head -c 0 "$2"; cat "$2.meta")"
  grep -oE '\$[0-9][0-9,]*' "$2" | head -20 | tr '\n' ' '; echo
  python3 - "$2" <<'PY'
import sys, json, re, html
raw = open(sys.argv[1], encoding='utf-8', errors='replace').read()
try:
    data = json.loads(raw)
    for c in data:
        if isinstance(c, dict) and c.get('data') and isinstance(c['data'], str) and '$' in c['data']:
            text = re.sub(r'<[^>]+>', '\n', c['data']); text = html.unescape(re.sub(r'\n\s*\n+', '\n', text))
            print('   command:', c.get('command'), c.get('selector'))
            print('   TEXT:', text.strip()[:2500].replace('\n', ' | '))
            print('   HTML sample:', c['data'][:1500])
            break
except Exception as e:
    print('   not json:', raw[:300].replace('\n', ' '))
PY
}
req() { local name=$1; shift; curl -sS -A "$UA" -H 'X-Requested-With: XMLHttpRequest' -H 'Accept: application/json, text/javascript, */*; q=0.01' -o "probe/$name" -w '%{http_code} %{content_type} %{size_download}' "$@" > "probe/$name.meta"; show "$name" "probe/$name"; }
req get1 "https://www.uscis.gov/views/ajax?_wrapper_format=drupal_ajax&form=i-485&$VIEW"
req get2 "https://www.uscis.gov/views/ajax?form=i-485&_wrapper_format=drupal_ajax&$VIEW&_drupal_ajax=1"
req post1 -X POST --data "$VIEW&form=i-485&_drupal_ajax=1" "https://www.uscis.gov/views/ajax?_wrapper_format=drupal_ajax"
req post2 -X POST --data "$VIEW&_drupal_ajax=1" "https://www.uscis.gov/views/ajax?form=i-485&_wrapper_format=drupal_ajax"
req get3 "https://www.uscis.gov/g-1055/ajax?form=i-485&_wrapper_format=drupal_ajax"
req get4 "https://www.uscis.gov/g-1055?form=i-485&_wrapper_format=drupal_ajax&ajax_form=1"
req get5 "https://www.uscis.gov/views/ajax?amp=&form=i-539&_wrapper_format=drupal_ajax&$VIEW"
