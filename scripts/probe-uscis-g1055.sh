#!/usr/bin/env bash
# One-off probe (run on GitHub Actions, which can reach uscis.gov): read the
# G-1055 fee rows of a form through the view's topic_id filter.
set -u
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
VIEW='view_name=form_fee_listing&view_display_id=form_fee_items&view_args=&view_path=%2Fnode%2F52500&view_base_path=&pager_element=0&_wrapper_format=drupal_ajax'
text() { python3 -c "
import sys, json, re, html
raw = sys.stdin.read()
try:
    parts = [c.get('data') for c in json.loads(raw) if isinstance(c, dict) and isinstance(c.get('data'), str)]
except Exception:
    parts = [raw]
for d in parts:
    i = d.find('form-fee-listing-form_fee_items')
    if i < 0: continue
    seg = d[i:i+20000]
    t = html.unescape(re.sub(r'<[^>]+>', '|', seg)); t = re.sub(r'\s*\|[\s|]*', ' | ', t)
    print(t[:2500]); print('HTML:', re.sub(r'\s+', ' ', seg)[:2500]); break
"; }
echo "== A. views/ajax with topic_id=97286 (I-485)"
curl -sS -A "$UA" -H 'X-Requested-With: XMLHttpRequest' "https://www.uscis.gov/views/ajax?$VIEW&topic_id=97286" | text
echo "== B. page with topic_id=97286"
curl -sSL -A "$UA" "https://www.uscis.gov/g-1055?form=i-485&topic_id=97286" | text
echo "== C. views/ajax with topic_id=97312 (I-765), amounts only"
curl -sS -A "$UA" -H 'X-Requested-With: XMLHttpRequest' "https://www.uscis.gov/views/ajax?$VIEW&topic_id=97312" | grep -oE '\$[0-9][0-9,]*' | tr '\n' ' '; echo
