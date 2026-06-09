# Pulling your real Google reviews into the site

The homepage **"What clients say"** section (`src/components/Testimonials.astro`)
will automatically show your **live Google reviews** once you connect Google.
Until then it falls back to the built-in demo pool, so nothing breaks while you
set this up.

The endpoint that feeds it is `netlify/functions/google-reviews.js`
(`GET /api/google-reviews`). It tries two sources, richest first:

1. **Business Profile API** — ALL of your reviews. Needs OAuth + a gated access
   approval from Google. (This is what you picked.)
2. **Places API** — up to **5** reviews. Just an API key, no approval. Great as
   a same-day interim while the Business Profile approval is pending.

You only need ONE of them working. I recommend turning on **Places now** (fast)
and **Business Profile** when it's approved.

> ⚠️ **About the reviews on the site right now:** they are realistic *demo*
> placeholders, not real clients. For a legal-document service, displaying
> invented testimonials is an FTC issue (the 2024 fake-review rule carries
> penalties) and hurts trust. Please switch to real reviews — that's exactly
> what this does. If approval will take a while, turn on Places today, or send
> me your real reviews and I'll use them as the fallback in the meantime.

I can't create Google accounts, grant OAuth, or type secret keys for you
(security boundary). All the browser/credential steps below are yours; once the
env vars are set, the code does the rest.

---

## Option A — Places API (fast, ≤5 reviews, no approval)

1. Go to **Google Cloud Console** → create/select a project.
2. **APIs & Services → Library** → enable **Places API**.
3. **APIs & Services → Credentials → Create credentials → API key**. Restrict it
   to the **Places API** (and optionally to your site referrers).
4. Find your **Place ID**: https://developers.google.com/maps/documentation/places/web-service/place-id
   (search your business → copy the `ChIJ…` id). *Tell me your business name +
   city and I can confirm the Place ID for you.*
5. In **Netlify → Site → Settings → Environment variables**, add:
   - `GOOGLE_PLACES_API_KEY` = your key  ← **the only required one**
   - `GOOGLE_PLACE_ID` = your `ChIJ…` id  *(optional — if omitted, the function
     looks it up by name "Imverica Legal Solutions Sacramento CA"; override the
     name with `GOOGLE_PLACE_QUERY` if needed)*
6. Redeploy (or just wait for the next deploy). Verify:
   `https://imverica.com/api/google-reviews?refresh=1` → should show
   `"configured": true, "source": "places"` with your reviews.

That's it — the homepage will start showing your real top reviews.

---

## Option B — Business Profile API (ALL reviews) — your pick

This gives every review (and lets us show your replies later), but Google gates
access.

1. **Request access** to the Business Profile APIs (the gated step — do this
   first, approval can take days):
   https://developers.google.com/my-business/content/prereqs#request-access
2. In **Google Cloud Console**, enable these APIs on the same project:
   *My Business Account Management API*, *My Business Business Information API*,
   and *Google My Business API* (v4, used for reviews).
3. **OAuth consent screen**: set it up (External is fine), add your Google
   account as a **Test user**, scope `https://www.googleapis.com/auth/business.manage`.
4. **Credentials → Create credentials → OAuth client ID** (type: *Web
   application* or *Desktop*). Save the **Client ID** and **Client secret**.
5. **Get a refresh token** (one-time): use the
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) →
   gear icon → "Use your own OAuth credentials" → paste client id/secret →
   authorize scope `https://www.googleapis.com/auth/business.manage` → exchange
   for tokens → copy the **refresh token**.
6. **Find your Account ID and Location ID**:
   - Account: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
   - Location: `GET https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations?read_mask=name`
   - You want the numeric IDs (the function accepts either `accounts/123…` /
     `locations/456…` or just the bare numbers).
7. In **Netlify → Environment variables**, add:
   - `GBP_CLIENT_ID`
   - `GBP_CLIENT_SECRET`
   - `GBP_REFRESH_TOKEN`
   - `GBP_ACCOUNT_ID`
   - `GBP_LOCATION_ID`
8. Redeploy and verify:
   `https://imverica.com/api/google-reviews?refresh=1` → `"source":
   "business-profile"` with your full review list.

If both A and B are set, **Business Profile wins** (more reviews); Places is the
automatic fallback.

---

## How it behaves

- Results are cached in Netlify Blobs for **6 hours** (so the homepage is fast
  and we stay under Google's quota). Add `?refresh=1` to force a fresh pull.
- Only reviews **with text** are shown; the cards display the star rating, the
  reviewer's name, and the month, with a "Google review" tag (Google's
  attribution requirement).
- If Google is unreachable or unconfigured, the section silently shows the
  built-in pool — the homepage never errors.
- Env var reference lives at the top of `netlify/functions/google-reviews.js`.
