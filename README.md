# Cambridge Radar — admin

Sanity Studio for [cambridge-radar.com](https://cambridge-radar.com). The website lives in
[cambridge-radar-frontend](https://github.com/cyanidium1/cambridge-radar-frontend).

- Sanity project `polcbwiw`, dataset `production` (public read).
- One administrator account. Authors do not log in: the editor keeps an author card
  (name, role, portrait, bio, links) and picks it under any article.

## Run

```bash
npm install --no-audit --no-fund --maxsockets=3 --fetch-retries=8
npm run dev            # http://localhost:3344
npm run deploy         # publishes the Studio to cambridge-radar.sanity.studio
```

Copy `.env.example` to `.env.local`. The write token is only needed by the import script.

## What is where

| Sidebar | Type | Notes |
|---|---|---|
| Articles | `post` | Address is `/<section>/<url>`. Lead image, standfirst, body, author, section (+ “also show in”), series, topics, SEO. |
| Authors | `author` | Author cards. “Editorial team” puts a person first on /authors. |
| Sections | `category` | Business, Technology, AI, Leadership, Economy, Geopolitics, Analysis. `order` = menu order. |
| Series | `series` | Optional multi-part stories at `/series/<url>`. |
| Pages | `page` | About, Contribute, Newsletter, Contacts, Privacy policy. “Extras” adds a contact or sign-up form. |
| Comments | `comment` | Readers’ comments arrive as *Waiting for review*. **Approve** / **Reject** / **Mark as spam** publish in one click. |
| Messages | `contactMessage` | Contact form submissions (also emailed when Resend is configured). |
| Subscribers | `subscriber` | Newsletter list. Double opt-in when email is configured. |
| Home page | singleton | Top stories (slider), editor’s picks, section rows. Everything falls back to “newest”. |
| Site settings | singleton | Logo, menus, social links, newsletter copy, GA4 / Clarity IDs, Search Console & Bing verification. |
| Redirects | `redirect` | Old WordPress addresses → new ones (301). Read by the website at build. |

## Importing from WordPress

`scripts/import-wp.mjs` pulls posts, author profiles, sections, pages, images and redirects from the
public WordPress REST API of the old site. It caches every response in `scripts/.cache/`.

```bash
npm run import:wp            # dry run
npm run import:wp -- --apply # write to the dataset
```

It is idempotent: documents have fixed ids and images are de-duplicated, so it can be re-run.

## Webhook

In sanity.io/manage → API → Webhooks create one webhook:

- URL `https://cambridge-radar.com/api/revalidate`, all documents, create/update/delete
- Projection `{_id, _type}`, secret = `SANITY_REVALIDATE_SECRET` of the frontend

It refreshes the site on every publish, sends the newsletter for a newly published article and
emails readers about approved replies.
