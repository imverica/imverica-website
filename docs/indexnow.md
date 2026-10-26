# IndexNow submission

Imverica can notify IndexNow-compatible search engines after a page is added,
substantially updated, or removed. The script submits only URLs explicitly passed
on the command line, accepts only `https://imverica.com` URLs, and uses the
official global endpoint at `https://api.indexnow.org/indexnow`.

The public verification file is deployed from
`astro-site/public/422d86f10b29f846575ebf1a69d9c882.txt`. Confirm that it is available at
`https://imverica.com/422d86f10b29f846575ebf1a69d9c882.txt` before the first live submission.

Preview a request without network access:

```sh
npm run indexnow -- --dry-run /about-imverica-legal-solutions /i-485-help
```

After the changed pages are actually deployed, submit only those deployed URLs:

```sh
npm run indexnow -- /about-imverica-legal-solutions https://imverica.com/i-485-help
```

Do not run the live command for drafts, minor edits, unchanged pages, or pages that
have not reached production. An HTTP 200 response means the notification was
accepted; it does not guarantee crawling, indexing, ranking, or citation by a
search engine or AI assistant. A first valid request may return HTTP 202 while the
key is verified.

Protocol reference: [IndexNow documentation](https://www.indexnow.org/documentation)
and [IndexNow FAQ](https://www.indexnow.org/faq).
