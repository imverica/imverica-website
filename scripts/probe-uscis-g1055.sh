#!/usr/bin/env bash
# One-off probe (run on GitHub Actions, which can reach uscis.gov): show
# where the G-1055 page gets its fee data, so the fee reader can use it.
set -u
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
mkdir -p probe
fetch() { curl -sSL -A "$UA" -H 'Accept-Language: en-US,en;q=0.9' -o "$2" -w "%{http_code} %{content_type} %{size_download}\n" "$1"; }
echo "== page"; fetch 'https://www.uscis.gov/g-1055?form=i-485' probe/page.html
echo "== title"; grep -o '<title>[^<]*' probe/page.html | head -2
echo "== fee-looking text in HTML"; grep -oE '\$[0-9][0-9,]{2,}' probe/page.html | sort | uniq -c | head -20
echo "== script srcs"; grep -oE '<script[^>]+src="[^"]+"' probe/page.html | sed 's/.*src="//; s/"$//' | head -60
echo "== drupal settings keys"; grep -o 'drupal-settings-json[^>]*>' probe/page.html | head -2
python3 - <<'PY'
import re, json
h = open('probe/page.html', encoding='utf-8', errors='replace').read()
m = re.search(r'<script[^>]*drupal-settings-json[^>]*>(.*?)</script>', h, re.S)
if m:
    try:
        d = json.loads(m.group(1))
        print('drupalSettings keys:', list(d.keys()))
        for k, v in d.items():
            s = json.dumps(v)
            if re.search(r'fee|g1055|g-1055|form', s, re.I):
                print('--', k, s[:1500])
    except Exception as e:
        print('settings parse error', e)
for kw in ['api', 'fee', 'g-1055', 'g1055', 'ajax', '.json', 'endpoint', 'data-form', 'data-fee']:
    hits = sorted(set(re.findall(r'[^"\'\s<>]{0,80}' + re.escape(kw) + r'[^"\'\s<>]{0,80}', h, re.I)))
    print(f'== {kw}: {len(hits)}')
    for x in hits[:25]: print('   ', x)
PY
echo "== JS files mentioning fee endpoints"
for src in $(grep -oE '<script[^>]+src="[^"]+"' probe/page.html | sed 's/.*src="//; s/"$//' | grep -viE 'google|gtm|analytics|touchpoints|dap' | head -40); do
  case "$src" in http*) url="$src";; //*) url="https:$src";; *) url="https://www.uscis.gov$src";; esac
  f="probe/$(echo "$url" | md5sum | cut -c1-8).js"
  curl -sSL -A "$UA" -o "$f" "$url" || continue
  if grep -qiE 'g-?1055|fee_schedule|feeSchedule|fee-schedule|/api/' "$f"; then
    echo "-- $url"
    grep -oiE '.{0,160}(g-?1055|fee_schedule|feeSchedule|fee-schedule|/api/).{0,160}' "$f" | head -15
  fi
done
