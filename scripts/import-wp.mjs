/**
 * One-off migration: cambridge-radar.com (WordPress) → Sanity (polcbwiw/production).
 *
 *   npm run import:wp              dry run: fetch (cached), build, validate, print what would be written
 *   npm run import:wp -- --apply   upload images + createOrReplace every document
 *
 * Every HTTP response from WordPress is cached under scripts/.cache/http, so reruns never hit the
 * site again (delete that folder to refetch). Only read-only GETs are sent to WordPress.
 *
 * Idempotent: document _ids are deterministic (post-wp-<id>, author-<slug>, category-<slug>,
 * page-<slug>, redirect-<hash>), array _keys are derived from the document id, and images are
 * deduplicated by SHA-1 (local map in scripts/.cache/asset-map.json + a sha1hash lookup in Sanity
 * before any upload), so a rerun rewrites identical documents and uploads nothing new.
 */
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {registerHooks} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import dotenv from 'dotenv'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
dotenv.config({path: path.join(ROOT, '.env.local'), quiet: true})

const APPLY = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')

const SITE = 'https://cambridge-radar.com'
const API = `${SITE}/wp-json/wp/v2`
const SITE_HOSTS = new Set(['cambridge-radar.com', 'www.cambridge-radar.com'])
const DEFAULT_TITLE_SUFFIX = ' - Cambridge Radar - Signals of What’s Next'
const CACHE_DIR = path.join(ROOT, 'scripts', '.cache')
const HTTP_CACHE = path.join(CACHE_DIR, 'http')
const ASSET_MAP_FILE = path.join(CACHE_DIR, 'asset-map.json')
const PREVIEW_FILE = path.join(CACHE_DIR, 'import-preview.json')
const LOGO_FILE = path.join(CACHE_DIR, 'logo-original.png')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

/** Sections in live menu order. `wpSlug` = WP category slug, `page` = WP section page path. */
const CATEGORIES = [
  {slug: 'business', wpSlug: 'business', title: 'Business', page: '/business/'},
  {slug: 'technology', wpSlug: 'technology', title: 'Technology', page: '/technology/'},
  {slug: 'ai', wpSlug: 'ai', title: 'AI', page: '/artificial-intelligence/'},
  {slug: 'leadership', wpSlug: 'leadership', title: 'Leadership', page: '/leadership/'},
  {slug: 'economy', wpSlug: 'economy', title: 'Economy', page: '/economy/'},
  {slug: 'geopolitics', wpSlug: 'geopolitics', title: 'Geopolitics', page: '/geopolitics/'},
  {slug: 'analysis', wpSlug: 'analysis', title: 'Analysis', page: '/analysis-cambridge-radar/'},
]
const SKIP_CATEGORY_SLUGS = new Set(['all', 'uncategorized'])
/** Used when a post has no real section on WordPress (only the "All" pseudo category). */
const FALLBACK_CATEGORY = 'analysis'
const FALLBACK_AUTHOR = 'olena-graffina'
const EDITORIAL = {'olena-graffina': {isEditorial: true, order: 0}}
const SLUG_OVERRIDES = {'hello-world-cambridge_radar': 'a-college-building-that-shapes-how-people-think'}
const EXCLUDED_TAGS = new Set(['cambridge-radar', 'cambridge'])

/** Static pages to migrate. lede: first paragraph becomes the intro; heroImage: first body image → page.image. */
const PAGES = [
  {wpSlug: 'about_us', slug: 'about', template: 'default', lede: true},
  // The live page carries a pitch form (name, email, LinkedIn, topic), so it gets the contact form.
  {wpSlug: 'contribute', slug: 'contribute', template: 'contact', lede: true},
  {wpSlug: 'newsletter', slug: 'newsletter', template: 'newsletter', lede: true, heroImage: true},
  {wpSlug: 'contacts', slug: 'contacts', template: 'contact', lede: false},
  {wpSlug: 'privacy-policy', slug: 'privacy-policy', template: 'default', lede: false},
]
/** WP pages that are theme leftovers or handled elsewhere. */
const SKIPPED_PAGES = {
  home: 'theme demo leftover',
  'home-2': 'front page (built from homePage + siteSettings)',
  sports: 'theme demo leftover',
  authors: 'rebuilt by the frontend from author documents',
  business: 'section page → category',
  technology: 'section page → category',
  'artificial-intelligence': 'section page → category',
  leadership: 'section page → category',
  economy: 'section page → category',
  geopolitics: 'section page → category',
  'analysis-cambridge-radar': 'section page → category',
}

// ---------------------------------------------------------------------------------------------
// Report bookkeeping
// ---------------------------------------------------------------------------------------------
const report = {fallbacks: [], inferred: [], skipped: [], notes: [], warnings: [], oddities: []}
const warn = (msg) => {
  report.warnings.push(msg)
  console.warn(`  ! ${msg}`)
}
const log = (...a) => console.log(...a)
const debug = (...a) => VERBOSE && console.log(...a)

// ---------------------------------------------------------------------------------------------
// Schema: load the real TypeScript schema (Node strips types) with `sanity`/@sanity/icons stubbed
// ---------------------------------------------------------------------------------------------
async function loadSchema() {
  const schemaDir = path.join(ROOT, 'schemaTypes')
  const walk = (d) =>
    fs
      .readdirSync(d, {withFileTypes: true})
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
  const stubs = {
    sanity: 'const id = (x) => x; export const defineType = id, defineField = id, defineArrayMember = id;',
  }
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier in stubs) return {url: `stub:${specifier}`, shortCircuit: true}
      // @sanity/icons v5: one subpath per icon, e.g. '@sanity/icons/Cog' → CogIcon
      if (specifier.startsWith('@sanity/icons/')) return {url: `stub-icon:${specifier.slice(14)}`, shortCircuit: true}
      if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context)
      }
      return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
      if (url.startsWith('stub:')) return {format: 'module', source: stubs[url.slice(5)], shortCircuit: true}
      if (url.startsWith('stub-icon:')) {
        const name = `${url.slice(10)}Icon`
        return {format: 'module', source: `export const ${name} = () => null; export default ${name};`, shortCircuit: true}
      }
      return nextLoad(url, context)
    },
  })
  const {schemaTypes} = await import('../schemaTypes/index.ts')
  const {Schema} = await import('@sanity/schema')
  const {builtinTypes} = await import('@sanity/schema/_internal')
  return Schema.compile({name: 'cambridge-radar', types: [...builtinTypes, ...schemaTypes]})
}

/** Allowed styles / lists / decorators / annotations of a block array type, read from the schema. */
function blockRules(arrayType) {
  const block = arrayType.of.find((m) => m.name === 'block')
  const field = (n) => block.fields.find((f) => f.name === n).type
  const span = field('children').of.find((t) => t.name === 'span')
  return {
    styles: new Set(field('style').options.list.map((o) => o.value)),
    lists: new Set(field('listItem').options.list.map((o) => o.value)),
    decorators: new Set(span.decorators.map((d) => d.value)),
    annotations: new Set(span.annotations.map((a) => a.name)),
    objects: new Set(arrayType.of.map((m) => m.name).filter((n) => n !== 'block')),
  }
}

// ---------------------------------------------------------------------------------------------
// HTTP with on-disk cache, throttling and back-off (read-only GETs)
// ---------------------------------------------------------------------------------------------
fs.mkdirSync(HTTP_CACHE, {recursive: true})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastRequestAt = 0
let liveRequests = 0

function cacheBase(url) {
  const u = new URL(url)
  const readable = (u.pathname + u.search).replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(-80)
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 10)
  return path.join(HTTP_CACHE, `${readable || 'root'}-${hash}`)
}

async function get(url, {accept} = {}) {
  const base = cacheBase(url)
  if (fs.existsSync(`${base}.meta.json`)) {
    const meta = JSON.parse(fs.readFileSync(`${base}.meta.json`, 'utf8'))
    const body = fs.existsSync(`${base}.body`) ? fs.readFileSync(`${base}.body`) : Buffer.alloc(0)
    return {...meta, body}
  }
  const delays = [2000, 5000, 15000, 30000, 60000]
  for (let attempt = 0; ; attempt++) {
    const wait = 1200 - (Date.now() - lastRequestAt)
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    liveRequests++
    let res
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: accept || 'text/html,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
        redirect: 'follow',
      })
    } catch (err) {
      if (attempt >= delays.length) throw err
      console.warn(`  ! ${err.message} (${url}) → retry in ${delays[attempt] / 1000}s`)
      await sleep(delays[attempt])
      continue
    }
    if ((res.status === 429 || res.status >= 500) && attempt < delays.length) {
      const retryAfter = Number(res.headers.get('retry-after')) * 1000
      const d = Math.max(delays[attempt], Number.isFinite(retryAfter) ? retryAfter : 0)
      console.warn(`  ! HTTP ${res.status} ${url} → retry in ${d / 1000}s`)
      await sleep(d)
      continue
    }
    const body = Buffer.from(await res.arrayBuffer())
    const meta = {
      url,
      finalUrl: res.url,
      status: res.status,
      contentType: res.headers.get('content-type'),
      total: res.headers.get('x-wp-total'),
      totalPages: res.headers.get('x-wp-totalpages'),
    }
    if (res.status !== 429 && res.status < 500) {
      fs.writeFileSync(`${base}.meta.json`, JSON.stringify(meta, null, 2))
      fs.writeFileSync(`${base}.body`, body)
    }
    return {...meta, body}
  }
}

async function getJson(url) {
  const r = await get(url, {accept: 'application/json'})
  if (r.status !== 200) throw new Error(`HTTP ${r.status} for ${url}`)
  return JSON.parse(r.body.toString('utf8'))
}

/** All pages of a collection endpoint, e.g. getAll('posts', '&_embed=1'). */
async function getAll(endpoint, query = '') {
  const first = await get(`${API}/${endpoint}?per_page=100${query}`, {accept: 'application/json'})
  if (first.status !== 200) throw new Error(`HTTP ${first.status} for ${endpoint}`)
  const items = JSON.parse(first.body.toString('utf8'))
  const pages = Number(first.totalPages || 1)
  for (let p = 2; p <= pages; p++) items.push(...(await getJson(`${API}/${endpoint}?per_page=100${query}&page=${p}`)))
  return items
}

async function getHtmlDoc(url) {
  const r = await get(url)
  if (r.status !== 200) throw new Error(`HTTP ${r.status} for ${url}`)
  return new JSDOM(r.body.toString('utf8')).window.document
}

// ---------------------------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------------------------
let JSDOM
let htmlToBlocks
const textarea = () => (textarea.el ??= new JSDOM('').window.document.createElement('textarea'))

function decodeEntities(s) {
  const el = textarea()
  el.innerHTML = s ?? ''
  return el.value
}

/** Undo UTF-8-read-as-Latin-1 damage (Ã©, Â…) when it is present. */
function fixMojibake(s) {
  if (!/[ÃÂâ][\u0080-¿‘-›]/.test(s)) return s
  const repaired = Buffer.from(s, 'latin1').toString('utf8')
  return repaired.includes('�') ? s : repaired
}

const squash = (s) => (s ?? '').replace(/[   ]/g, ' ').replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim()

/** Plain, single-line text: entities decoded, tags removed, mojibake repaired. */
function cleanText(htmlOrText, where = '') {
  let t = htmlOrText ?? ''
  if (/[<&]/.test(t)) t = JSDOM.fragment(`<div>${t}</div>`).textContent
  t = squash(fixMojibake(decodeEntities(t)))
  if (t.includes('�')) warn(`replacement character left in "${t.slice(0, 60)}" ${where}`)
  return t
}

function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘"“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const sha1 = (data) => createHash('sha1').update(data).digest('hex')
const shortHash = (s) => sha1(s).slice(0, 12)

/** Deterministic `_key` generator seeded per document, so reruns produce identical documents. */
function keyGen(seed) {
  let i = 0
  return () => shortHash(`${seed}:${i++}`)
}

function splitSentences(text) {
  return squash(text)
    .split(/(?<=[.!?…]["'”’)\]]*)\s+(?=["'“‘(\[]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Whole sentences up to `max` chars (at most `maxSentences`); falls back to a word-boundary cut. */
function leadSentences(text, max, maxSentences = 2) {
  const sentences = splitSentences(text)
  let out = ''
  let n = 0
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s
    if (next.length > max) break
    out = next
    n++
    // up to maxSentences, one more when they are very short
    if (n >= maxSentences && out.length >= 120) break
    if (n > maxSentences) break
  }
  if (!out && sentences.length) {
    const cut = sentences[0].slice(0, max - 1)
    out = `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:–—-]+$/, '')}…`
  }
  return out
}

const isoZ = (gmt) => (gmt ? `${gmt.replace(/Z$/, '')}Z` : undefined)

// ---------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------
const redirectMap = new Map() // legacy path (with trailing slash) → new path

function normalisePath(p) {
  const clean = p.replace(/\/{2,}/g, '/')
  return clean.length > 1 ? clean.replace(/\/+$/, '') : clean
}

/** Rewrite an href for the new site. Returns {href, blank} or null when unusable. */
function rewriteHref(rawHref, linkText = '') {
  let href = (rawHref ?? '').trim()
  if (!href || href === '#') return null
  if (/^mailto:/i.test(href)) {
    const addr = href.slice(7).split('?')[0]
    if (!addr || addr === '#') {
      const email = linkText.trim()
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? {href: `mailto:${email}`, blank: false} : null
    }
    return {href, blank: false}
  }
  if (/^tel:/i.test(href)) return {href, blank: false}
  let url
  try {
    url = new URL(href, SITE)
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  if (SITE_HOSTS.has(url.hostname)) {
    if (url.pathname.startsWith('/wp-content/')) return {href: url.href, blank: true}
    const withSlash = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    const target = redirectMap.get(withSlash) ?? normalisePath(url.pathname)
    return {href: target + (url.hash || ''), blank: false}
  }
  for (const k of [...url.searchParams.keys()]) if (/^utm_/i.test(k)) url.searchParams.delete(k)
  return {href: url.href, blank: true}
}

// ---------------------------------------------------------------------------------------------
// Images: resolve the original, download (cached), dedupe by SHA-1, upload once
// ---------------------------------------------------------------------------------------------
let client
const assetMap = fs.existsSync(ASSET_MAP_FILE) ? JSON.parse(fs.readFileSync(ASSET_MAP_FILE, 'utf8')) : {}
const imageStats = {resolved: 0, uploaded: 0, reusedLocal: 0, reusedRemote: 0}
const mediaCache = new Map()

async function getMedia(id) {
  if (!id) return null
  if (mediaCache.has(id)) return mediaCache.get(id)
  const r = await get(`${API}/media/${id}`, {accept: 'application/json'})
  const media = r.status === 200 ? JSON.parse(r.body.toString('utf8')) : null
  mediaCache.set(id, media)
  return media
}

/** Origin URL for a Photon (i0.wp.com) or sized WP upload URL. */
function originalUrlCandidates(src) {
  const out = []
  if (!src) return out
  let u
  try {
    u = new URL(src, SITE)
  } catch {
    return out
  }
  if (/^i\d\.wp\.com$/.test(u.hostname)) {
    const [, host, ...rest] = u.pathname.split('/')
    u = new URL(`https://${host}/${rest.join('/')}`)
  }
  const bare = `${u.origin}${u.pathname}`
  out.push(bare.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, ''))
  out.push(bare)
  return out
}

const EXT_BY_TYPE = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg'}

/** Try candidate URLs in order; first one that returns an image wins. */
async function downloadImage(candidates) {
  const tried = []
  for (const url of [...new Set(candidates.filter(Boolean))]) {
    const r = await get(url, {accept: 'image/png,image/jpeg,image/gif,image/*;q=0.8'})
    const type = (r.contentType || '').split(';')[0].trim()
    if (r.status === 200 && type.startsWith('image/') && r.body.length > 0) {
      imageStats.resolved++
      if (tried.length) debug(`    image fallback → ${url} (failed: ${tried.join(', ')})`)
      return {url, buffer: r.body, contentType: type, sha1: sha1(r.body)}
    }
    tried.push(`${url} [${r.status}]`)
  }
  warn(`image not downloadable: ${tried.join(', ')}`)
  return null
}

function filenameFor(img) {
  let name = decodeURIComponent(new URL(img.url).pathname.split('/').pop() || 'image')
  const ext = EXT_BY_TYPE[img.contentType]
  if (ext && !new RegExp(`\\.${ext === 'jpg' ? 'jpe?g' : ext}$`, 'i').test(name)) name = `${name.replace(/\.[a-z0-9]+$/i, '')}.${ext}`
  return name
}

/** Asset _id for a downloaded image; uploads only when the SHA-1 is unknown locally and remotely. */
async function ensureAsset(img, {sourceId, creditLine} = {}) {
  if (assetMap[img.sha1]) {
    imageStats.reusedLocal++
    return assetMap[img.sha1]
  }
  if (!APPLY) return `image-dryrun-${img.sha1}`
  const existing = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash == $sha1][0]._id', {sha1: img.sha1})
  if (existing) {
    imageStats.reusedRemote++
    assetMap[img.sha1] = existing
  } else {
    const filename = filenameFor(img)
    log(`    ↑ uploading ${filename} (${Math.round(img.buffer.length / 1024)} KB)`)
    const asset = await client.assets.upload('image', img.buffer, {
      filename,
      contentType: img.contentType,
      source: {name: 'wordpress', id: String(sourceId ?? img.url), url: img.url},
      ...(creditLine ? {creditLine} : {}),
    })
    imageStats.uploaded++
    assetMap[img.sha1] = asset._id
  }
  fs.writeFileSync(ASSET_MAP_FILE, JSON.stringify(assetMap, null, 2))
  return assetMap[img.sha1]
}

/** Build a `figure` value (or plain image when type = 'image') from a WP media item and/or src. */
async function buildFigure({media, src, origFile, alt, caption, credit, type = 'figure', key}) {
  const candidates = [
    media?.source_url,
    ...originalUrlCandidates(media?.source_url),
    ...originalUrlCandidates(origFile),
    ...originalUrlCandidates(src),
    src,
  ]
  const img = await downloadImage(candidates)
  if (!img) return null
  const mediaCredit = squash(media?.media_details?.image_meta?.credit)
  const creditText = credit ?? (mediaCredit && mediaCredit.length <= 60 ? `Photo: ${mediaCredit}` : undefined)
  const assetId = await ensureAsset(img, {sourceId: media?.id ?? img.url, creditLine: creditText})
  const value = {_type: type, ...(key ? {_key: key} : {}), asset: {_type: 'reference', _ref: assetId}}
  if (type === 'figure') {
    if (alt) value.alt = alt
    if (caption) value.caption = caption
    if (creditText) value.credit = creditText
  }
  return value
}

// ---------------------------------------------------------------------------------------------
// HTML → Portable Text
// ---------------------------------------------------------------------------------------------
const JUNK_SELECTORS = [
  'script', 'style', 'noscript', 'template', 'svg', 'form', 'input', 'button', 'select', 'textarea',
  '.sharedaddy', '.sd-sharing-enabled', '.sd-block', '.sd-like', '.jp-relatedposts', '#jp-relatedposts', '#jp-post-flair',
  '.jetpack-likes-widget-wrapper', '.wp-block-jetpack-subscriptions', '.jetpack_subscription_widget',
  '.wp-block-jetpack-like', '.wp-block-jetpack-sharing-buttons', '.wpcf7', '.screen-reader-response',
  '.screen-reader-text', '.akismet-fields-container', '.cmsmasters_sharing', '.share_wrap', '.share_posts',
  '.post-likes-widget-placeholder', '.wp-block-buttons', '[hidden]',
].join(',')

const TEXT_CONTAINERS = /^(P|H[1-6]|LI|UL|OL|BLOCKQUOTE|STRONG|B|EM|I|A|SPAN|U|S|DEL|SUP|SUB|SMALL|CODE|LABEL)$/
const BLOCK_TAGS = /^(P|H[1-6]|UL|OL|LI|BLOCKQUOTE|FIGURE|TABLE|HR|PRE|DIV|SECTION|ARTICLE|PT-OBJECT|IMG|IFRAME|HEADER|FOOTER|MAIN|ASIDE|NAV)$/

function videoUrl(src) {
  if (!src) return null
  let u
  try {
    u = new URL(src, SITE)
  } catch {
    return null
  }
  const yt = u.pathname.match(/\/embed\/([\w-]{6,})/)
  if (/youtube(-nocookie)?\.com$/.test(u.hostname) && yt) return `https://www.youtube.com/watch?v=${yt[1]}`
  if (/youtube\.com$|youtu\.be$/.test(u.hostname)) return u.href
  const vimeo = u.pathname.match(/\/video\/(\d+)/)
  if (u.hostname === 'player.vimeo.com' && vimeo) return `https://vimeo.com/${vimeo[1]}`
  if (/vimeo\.com$/.test(u.hostname)) return u.href
  return null
}

/** Replace container elements: unwrap when they hold blocks, turn into <p> when they hold inline text. */
function flattenContainers(root) {
  const doc = root.ownerDocument
  const containers = [...root.querySelectorAll('div, section, article, main, header, footer, aside, nav, center, font')].reverse()
  for (const el of containers) {
    if (!el.isConnected) continue
    const hasBlockChild = [...el.children].some((c) => BLOCK_TAGS.test(c.tagName))
    const hasText = squash(el.textContent) !== '' || el.querySelector('pt-object')
    if (hasBlockChild || !hasText) {
      if (!hasText && !el.querySelector('pt-object, img')) el.remove()
      else el.replaceWith(...el.childNodes)
    } else {
      const p = doc.createElement('p')
      p.append(...el.childNodes)
      el.replaceWith(p)
    }
  }
}

/** Move block objects out of paragraphs/lists so they become top-level blocks. */
function hoistObjects(root) {
  for (const ph of root.querySelectorAll('pt-object')) {
    let top = ph
    while (top.parentElement && top.parentElement !== root && TEXT_CONTAINERS.test(top.parentElement.tagName)) top = top.parentElement
    if (top !== ph) top.before(ph)
  }
}

const isEmptyEl = (el) => squash(el.textContent) === '' && !el.querySelector('img, pt-object, iframe')

/**
 * Convert WP HTML into Portable Text for `arrayType`.
 * ctx: {seed, fallbackAlt, mediaLookup: bool}
 */
async function htmlToPortableText(html, arrayType, ctx) {
  const rules = blockRules(arrayType)
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`)
  const doc = dom.window.document
  const body = doc.body
  const objects = []
  const nextKey = keyGen(ctx.seed)
  const placeholder = (obj) => {
    const el = doc.createElement('pt-object')
    el.setAttribute('data-i', String(objects.push(obj) - 1))
    return el
  }

  body.querySelectorAll(JUNK_SELECTORS).forEach((el) => el.remove())
  // comments
  const walker = doc.createTreeWalker(body, dom.window.NodeFilter.SHOW_COMMENT)
  const comments = []
  while (walker.nextNode()) comments.push(walker.currentNode)
  comments.forEach((c) => c.remove())

  // Heading levels the schema knows: no h1 in the body, h5/h6 become h4.
  for (const h of body.querySelectorAll('h1, h5, h6')) {
    const n = doc.createElement(h.tagName === 'H1' ? 'h2' : 'h4')
    n.append(...h.childNodes)
    h.replaceWith(n)
  }

  // Pull quotes
  for (const pq of body.querySelectorAll('figure.wp-block-pullquote, blockquote.wp-block-pullquote, .cmsmasters_quote')) {
    const cite = pq.querySelector('cite')
    const attribution = cite ? cleanText(cite.textContent) : undefined
    cite?.remove()
    const text = [...pq.querySelectorAll('p')].map((p) => squash(p.textContent)).filter(Boolean).join('\n') || squash(pq.textContent)
    if (rules.objects.has('pullQuote') && text) {
      pq.replaceWith(placeholder({_type: 'pullQuote', text, ...(attribution ? {attribution} : {})}))
    } else pq.remove()
  }

  // Video embeds
  for (const fig of body.querySelectorAll('figure.wp-block-embed, .wp-block-embed')) {
    const url = videoUrl(fig.querySelector('iframe')?.getAttribute('src')) ?? videoUrl(squash(fig.querySelector('.wp-block-embed__wrapper')?.textContent))
    const caption = cleanText(fig.querySelector('figcaption')?.textContent ?? '')
    if (url && rules.objects.has('embed')) fig.replaceWith(placeholder({_type: 'embed', url, ...(caption ? {caption} : {})}))
    else {
      if (!url) warn(`${ctx.label}: dropped non-video embed ${squash(fig.textContent).slice(0, 80)}`)
      fig.remove()
    }
  }
  for (const iframe of body.querySelectorAll('iframe')) {
    const url = videoUrl(iframe.getAttribute('src'))
    if (url && rules.objects.has('embed')) iframe.replaceWith(placeholder({_type: 'embed', url}))
    else iframe.remove()
  }
  // WordPress post embeds (blockquote + hidden iframe) → plain paragraph with the link
  for (const bq of body.querySelectorAll('blockquote.wp-embedded-content')) {
    const p = doc.createElement('p')
    p.append(...(bq.querySelector('p')?.childNodes ?? bq.childNodes))
    bq.replaceWith(p)
  }

  // Separators
  for (const hr of body.querySelectorAll('hr')) {
    if (rules.objects.has('divider')) {
      hr.replaceWith(placeholder({_type: 'divider', style: hr.classList.contains('is-style-dots') ? 'dots' : 'line'}))
    } else hr.remove()
  }

  // Images (figures first so their captions travel with them)
  const imageJobs = []
  for (const fig of body.querySelectorAll('figure')) {
    const img = fig.querySelector('img')
    if (!img) {
      fig.replaceWith(...fig.childNodes)
      continue
    }
    const caption = cleanText(fig.querySelector('figcaption')?.innerHTML ?? '')
    const ph = placeholder(null)
    imageJobs.push({ph, img, caption})
    fig.replaceWith(ph)
  }
  for (const img of body.querySelectorAll('img')) {
    const ph = placeholder(null)
    imageJobs.push({ph, img, caption: ''})
    img.replaceWith(ph)
  }
  for (const {ph, img, caption} of imageJobs) {
    const i = Number(ph.getAttribute('data-i'))
    if (!rules.objects.has('figure')) {
      ph.remove()
      continue
    }
    const mediaId = Number(img.className.match(/wp-image-(\d+)/)?.[1] || img.getAttribute('data-attachment-id') || 0)
    const media = mediaId ? await getMedia(mediaId) : null
    const src = img.getAttribute('src')
    const origFile = img.getAttribute('data-orig-file')
    const alt =
      cleanText(img.getAttribute('alt') ?? '') ||
      cleanText(media?.alt_text ?? '') ||
      caption ||
      cleanText(media?.caption?.rendered ?? '') ||
      ctx.fallbackAlt
    const fig = await buildFigure({media, src, origFile, alt, caption: caption || undefined, key: nextKey()})
    if (fig) objects[i] = fig
    else ph.remove()
    if (!cleanText(img.getAttribute('alt') ?? '') && !cleanText(media?.alt_text ?? '')) {
      report.oddities.push(`${ctx.label}: body image without alt text (used ${caption ? 'caption' : 'title'}) – ${src?.split('?')[0]}`)
    }
  }

  // Tables → bullet list ("cell — cell"), header row dropped
  for (const table of body.querySelectorAll('table')) {
    const ul = doc.createElement('ul')
    for (const tr of table.querySelectorAll('tr')) {
      if (tr.closest('thead') || [...tr.children].every((c) => c.tagName === 'TH')) continue
      const li = doc.createElement('li')
      li.textContent = [...tr.children].map((c) => squash(c.textContent)).filter(Boolean).join(' — ')
      if (li.textContent) ul.append(li)
    }
    table.replaceWith(ul)
    report.notes.push(`${ctx.label}: table flattened into a bullet list (schema has no table type)`)
  }

  // Single-item bold <ol start="n"> used as numbered section headings → "n. Heading" (h3)
  for (const ol of body.querySelectorAll('ol')) {
    const lis = ol.querySelectorAll(':scope > li')
    if (lis.length !== 1) continue
    const text = squash(lis[0].textContent)
    const bold = squash([...lis[0].querySelectorAll('strong, b')].map((s) => s.textContent).join(''))
    if (!text || bold !== text) continue
    const h = doc.createElement('h3')
    h.textContent = `${ol.getAttribute('start') || '1'}. ${text}`
    ol.replaceWith(h)
  }

  flattenContainers(body)

  // Empty paragraphs/headings (incl. &nbsp;-only)
  for (const el of body.querySelectorAll('p, h2, h3, h4, li, blockquote')) if (isEmptyEl(el)) el.remove()

  // Paragraphs typed as "• item" → real bullet list
  const bulletRe = /^\s*[•·▪●◦]\s*/
  let currentList = null
  for (const el of [...body.children]) {
    if (el.tagName === 'P' && bulletRe.test(el.textContent)) {
      if (!currentList) {
        currentList = doc.createElement('ul')
        el.before(currentList)
      }
      const li = doc.createElement('li')
      li.append(...el.childNodes)
      const first = doc.createTreeWalker(li, dom.window.NodeFilter.SHOW_TEXT)
      while (first.nextNode()) {
        if (first.currentNode.nodeValue.trim()) {
          first.currentNode.nodeValue = first.currentNode.nodeValue.replace(bulletRe, '')
          break
        }
      }
      currentList.append(li)
      el.remove()
    } else currentList = null
  }

  hoistObjects(body)

  // Inline styles / classes would trigger the Word / Google Docs paste heuristics: drop them.
  for (const el of body.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (!['href', 'src', 'alt', 'start', 'data-i'].includes(attr.name)) el.removeAttribute(attr.name)
    }
  }

  const blocks = htmlToBlocks(body.innerHTML, arrayType, {
    parseHtml: (h) => new JSDOM(h).window.document,
    keyGenerator: nextKey,
    rules: [
      {
        deserialize(el, _next, createBlock) {
          if (el.nodeType !== 1 || el.tagName.toLowerCase() !== 'pt-object') return undefined
          const obj = objects[Number(el.getAttribute('data-i'))]
          return obj ? createBlock({...obj, _key: obj._key ?? nextKey()}) : undefined
        },
      },
    ],
  })
  return normaliseBlocks(blocks, rules, ctx, nextKey)
}

/** Clean spans/marks, rewrite links, enforce the schema's styles/marks, drop empty blocks. */
function normaliseBlocks(blocks, rules, ctx, nextKey) {
  const out = []
  for (const b of blocks) {
    if (b._type !== 'block') {
      if (!rules.objects.has(b._type)) {
        warn(`${ctx.label}: dropped unsupported object ${b._type}`)
        continue
      }
      out.push({...b, _key: b._key ?? nextKey()})
      continue
    }
    const block = {_type: 'block', _key: b._key ?? nextKey(), style: b.style ?? 'normal', markDefs: [], children: []}
    if (!rules.styles.has(block.style)) {
      report.notes.push(`${ctx.label}: style "${block.style}" → normal`)
      block.style = 'normal'
    }
    if (b.listItem) {
      if (rules.lists.has(b.listItem)) {
        block.listItem = b.listItem
        block.level = b.level ?? 1
      }
    }
    // markDefs: links only, rewritten
    const defs = new Map()
    for (const def of b.markDefs ?? []) {
      if (def._type !== 'link' || !rules.annotations.has('link')) continue
      const linkText = (b.children ?? []).filter((c) => c.marks?.includes(def._key)).map((c) => c.text).join('')
      const rewritten = rewriteHref(def.href, linkText)
      if (!rewritten) {
        report.notes.push(`${ctx.label}: removed unusable link "${def.href}"`)
        continue
      }
      defs.set(def._key, {_type: 'link', _key: def._key, href: rewritten.href, ...(rewritten.blank ? {blank: true} : {})})
    }
    const children = []
    for (const c of b.children ?? []) {
      if (c._type !== 'span') {
        warn(`${ctx.label}: dropped inline object ${c._type}`)
        continue
      }
      const text = (c.text ?? '')
        .replace(/[   ]/g, ' ')
        .replace(/[​‌‍﻿]/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
      const marks = (c.marks ?? []).filter((m) => rules.decorators.has(m) || defs.has(m))
      const prev = children.at(-1)
      if (prev && prev.marks.join() === marks.join()) prev.text += text
      else children.push({_type: 'span', _key: c._key ?? nextKey(), text, marks})
    }
    // trim block edges
    if (children.length) {
      children[0].text = children[0].text.replace(/^[\s\n]+/, '')
      children.at(-1).text = children.at(-1).text.replace(/[\s\n]+$/, '')
    }
    block.children = children.filter((c, i, all) => c.text !== '' || all.length === 1)
    const usedDefs = new Set(block.children.flatMap((c) => c.marks))
    block.markDefs = [...defs.values()].filter((d) => usedDefs.has(d._key))
    // collapse decorators on whitespace-only spans
    for (const c of block.children) if (!c.text.trim()) c.marks = c.marks.filter((m) => defs.has(m))
    if (!block.children.some((c) => c.text.trim())) continue
    if (!block.listItem) delete block.level
    out.push(block)
  }
  return out
}

const blockText = (b) => (b._type === 'block' ? b.children.map((c) => c.text).join('') : '')
const ptPlainText = (blocks) => blocks.filter((b) => b._type === 'block').map(blockText).join(' ')

/** Standfirst from the opening of the body, the way WP builds auto-excerpts, but cut at sentences. */
function excerptFromBody(blocks) {
  const parts = []
  for (const b of blocks) {
    if (b._type !== 'block') {
      if (parts.length) break
      continue
    }
    const t = squash(blockText(b))
    if (!t) continue
    if (b.listItem) break
    if (/^h\d$/.test(b.style)) {
      if (parts.length) break
      if (/[.!?…]["'”’]?$/.test(t)) parts.push(t) // a sentence-like dek, not a section heading
      continue
    }
    parts.push(t)
    if (parts.join(' ').length > 320) break
  }
  return leadSentences(parts.join(' '), 320, 2)
}

// ---------------------------------------------------------------------------------------------
// Rendered-page helpers (Yoast meta, bylines)
// ---------------------------------------------------------------------------------------------
function yoastMeta(doc, defaultTitle) {
  const title = squash(doc.querySelector('title')?.textContent)
  const description = squash(doc.querySelector('meta[name="description"]')?.getAttribute('content'))
  const seo = {}
  if (title && title !== defaultTitle) seo.title = title
  if (description) seo.description = description
  return Object.keys(seo).length ? {_type: 'seo', ...seo} : undefined
}

function socialNetwork(href) {
  let u
  try {
    u = new URL(href)
  } catch {
    return null
  }
  const h = u.hostname.replace(/^www\./, '')
  if (/(^|\.)linkedin\.com$/.test(h)) return 'linkedin'
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram'
  if (/(^|\.)(facebook\.com|fb\.com)$/.test(h)) return u.pathname.startsWith('/sharer') ? null : 'facebook'
  if (/(^|\.)(twitter\.com|x\.com)$/.test(h)) return u.pathname.startsWith('/intent') || u.pathname.startsWith('/share') ? null : 'x'
  if (/^(t\.me|telegram\.me)$/.test(h)) return 'telegram'
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube'
  return 'website'
}

function cleanSocialUrl(href) {
  const u = new URL(href)
  u.pathname = u.pathname.replace(/\/{2,}/g, '/')
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|comment_id|ref|fbclid)/i.test(k)) u.searchParams.delete(k)
  return u.href
}

// ---------------------------------------------------------------------------------------------
// Local validation against the compiled schema (shape only; Sanity's validator runs after --apply)
// ---------------------------------------------------------------------------------------------
/** Fields marked rule.required() in schemaTypes/ (kept in sync by hand – Sanity's validator double-checks). */
const REQUIRED = {
  post: ['title', 'slug', 'body', 'author', 'category', 'publishedAt'],
  author: ['name', 'slug'],
  category: ['title', 'slug'],
  series: ['title', 'slug'],
  page: ['title', 'slug'],
  redirect: ['source', 'destination'],
  siteSettings: ['title'],
  pullQuote: ['text'],
  embed: ['url'],
  socialLink: ['network', 'url'],
  menuLink: ['label', 'href'],
}

function validateDocs(schema, docs) {
  const problems = []
  const check = (value, type, where) => {
    if (value === undefined || value === null) return
    const json = type.jsonType
    if (json === 'string') {
      if (typeof value !== 'string') return problems.push(`${where}: expected string`)
      if (/\[object Object\]|&amp;|&#\d+;|&[a-z]+;|�/.test(value)) problems.push(`${where}: suspicious text "${value.slice(0, 50)}"`)
      const list = type.options?.list
      if (list && !list.some((o) => (o.value ?? o) === value)) problems.push(`${where}: "${value}" not in options`)
      return
    }
    if (json === 'number') return typeof value === 'number' || problems.push(`${where}: expected number`)
    if (json === 'boolean') return typeof value === 'boolean' || problems.push(`${where}: expected boolean`)
    if (json === 'array') {
      if (!Array.isArray(value)) return problems.push(`${where}: expected array`)
      value.forEach((item, i) => {
        const w = `${where}[${i}]`
        if (item && typeof item === 'object') {
          if (!item._key) problems.push(`${w}: missing _key`)
          const member = type.of.find((m) => m.name === item._type) ?? (type.of.length === 1 && !item._type ? type.of[0] : null)
          if (!member) return problems.push(`${w}: _type "${item._type}" not allowed (${type.of.map((m) => m.name)})`)
          if (member.name === 'block') return checkBlock(item, member, w)
          return check(item, member, w)
        }
        const member = type.of.find((m) => m.jsonType === typeof item)
        if (!member) problems.push(`${w}: primitive not allowed`)
        else check(item, member, w)
      })
      return
    }
    if (json === 'object') {
      if (typeof value !== 'object' || Array.isArray(value)) return problems.push(`${where}: expected object`)
      const fields = new Map((type.fields ?? []).map((f) => [f.name, f.type]))
      for (const req of REQUIRED[type.name] ?? []) {
        if (value[req] === undefined || value[req] === '' || (Array.isArray(value[req]) && !value[req].length)) problems.push(`${where}: missing required ${req}`)
      }
      if (value.asset && !value.alt && type.name === 'figure') problems.push(`${where}: figure without alt`)
      for (const [k, v] of Object.entries(value)) {
        if (['_type', '_key', '_ref', '_weak', '_id', '_rev', '_createdAt', '_updatedAt'].includes(k)) continue
        if (!fields.has(k)) problems.push(`${where}.${k}: unknown field on ${type.name}`)
        else check(v, fields.get(k), `${where}.${k}`)
      }
      if (type.name === 'reference' || type.type?.name === 'reference') {
        if (!value._ref) problems.push(`${where}: reference without _ref`)
      }
    }
  }
  const checkBlock = (block, member, where) => {
    const field = (n) => member.fields.find((f) => f.name === n).type
    const styles = field('style').options.list.map((o) => o.value)
    const lists = field('listItem').options.list.map((o) => o.value)
    const span = field('children').of.find((t) => t.name === 'span')
    const decorators = span.decorators.map((d) => d.value)
    if (!styles.includes(block.style)) problems.push(`${where}: style ${block.style}`)
    if (block.listItem && !lists.includes(block.listItem)) problems.push(`${where}: listItem ${block.listItem}`)
    const defKeys = new Set((block.markDefs ?? []).map((d) => d._key))
    for (const d of block.markDefs ?? []) {
      if (!d._key) problems.push(`${where}: markDef without _key`)
      if (d._type !== 'link') problems.push(`${where}: markDef ${d._type}`)
      if (d.href && !/^(https?:\/\/|mailto:|tel:|\/)/.test(d.href)) problems.push(`${where}: href ${d.href}`)
    }
    for (const c of block.children ?? []) {
      if (!c._key) problems.push(`${where}: span without _key`)
      for (const m of c.marks ?? []) if (!decorators.includes(m) && !defKeys.has(m)) problems.push(`${where}: mark ${m}`)
      if (/\[object Object\]|&amp;|&#\d+;|�/.test(c.text)) problems.push(`${where}: suspicious text "${c.text.slice(0, 50)}"`)
    }
  }
  for (const doc of docs) {
    const type = schema.get(doc._type)
    if (!type) {
      problems.push(`${doc._id}: unknown type ${doc._type}`)
      continue
    }
    if (doc._id.includes('.')) problems.push(`${doc._id}: dot in _id`)
    check(doc, type, doc._id)
  }
  return problems
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  log(`WordPress → Sanity import (${APPLY ? 'APPLY' : 'dry run'})`)
  ;({JSDOM} = await import('jsdom'))
  ;({htmlToBlocks} = await import('@portabletext/block-tools'))
  const schema = await loadSchema()
  const blockContent = schema.get('blockContent')
  const simpleBlockContent = schema.get('simpleBlockContent')

  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset, SANITY_WRITE_TOKEN: token} = process.env
  if (!projectId || !dataset) throw new Error('SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET missing in .env.local')
  if (APPLY && !token) throw new Error('SANITY_WRITE_TOKEN missing in .env.local')
  const {createClient} = await import('@sanity/client')
  client = createClient({projectId, dataset, token, apiVersion: '2025-02-19', useCdn: false})

  // ---- Fetch ------------------------------------------------------------------------------
  log('\n1. Fetching WordPress (cached in scripts/.cache/http)…')
  // strictly sequential: the WordPress.com edge rate-limits parallel requests
  const wpCategories = await getAll('categories')
  const wpUsers = await getAll('users')
  const wpPosts = await getAll('posts', '&_embed=1')
  const wpPages = await getAll('pages')
  const wpProfiles = await getAll('profile', '&_embed=1')
  const wpComments = await getAll('comments')
  const wpProjects = await getAll('project')
  const wpPjCategs = await getAll('pj-categs')
  const wpPlCategs = await getAll('pl-categs')
  const siteInfo = await getJson(`${SITE}/wp-json/`)
  log(`   ${wpPosts.length} posts, ${wpPages.length} pages, ${wpProfiles.length} profiles, ${wpCategories.length} categories, ${wpUsers.length} users, ${wpComments.length} comments, ${wpProjects.length} demo projects`)

  const docs = []
  const catById = new Map(wpCategories.map((c) => [c.id, c]))
  const catDocId = (slug) => `category-${slug}`
  const wpCatToSlug = new Map(CATEGORIES.map((c) => [c.wpSlug, c.slug]))

  // ---- Categories -------------------------------------------------------------------------
  log('\n2. Categories')
  for (const [i, c] of CATEGORIES.entries()) {
    const wp = wpCategories.find((x) => x.slug === c.wpSlug)
    if (!wp) warn(`WP category ${c.wpSlug} not found`)
    const pageDoc = await getHtmlDoc(`${SITE}${c.page}`)
    const wpPage = wpPages.find((p) => `/${p.slug}/` === c.page)
    // Intro text on the section page: any text block that is not the post grid / widgets.
    let description
    if (wpPage) {
      const frag = new JSDOM(`<body>${wpPage.content.rendered}</body>`).window.document.body
      frag.querySelectorAll('article, .cmsmasters_posts_slider, .cmsmasters_sidebar, .widget, .cmsmasters_heading_wrap, .cmsmasters_wrap_blog').forEach((e) => e.remove())
      const intro = squash(frag.textContent)
      if (intro.length > 40) description = leadSentences(intro, 300, 2)
    }
    const doc = {
      _id: catDocId(c.slug),
      _type: 'category',
      title: wp ? cleanText(wp.name) : c.title,
      slug: {_type: 'slug', current: c.slug},
      order: i + 1,
    }
    if (description) doc.description = description
    const seo = yoastMeta(pageDoc, `${wpPage ? cleanText(wpPage.title.rendered) : c.title}${DEFAULT_TITLE_SUFFIX}`)
    if (seo) doc.seo = seo
    docs.push(doc)
    log(`   ${doc._id}  #${doc.order}  ${description ? 'description' : 'no intro text on ' + c.page}${seo ? ', seo from Yoast' : ''}`)
  }
  for (const c of wpCategories.filter((c) => !wpCatToSlug.has(c.slug))) report.skipped.push(`category "${c.name}" (${c.slug}) – pseudo/empty category`)

  // ---- Authors ----------------------------------------------------------------------------
  log('\n3. Authors')
  const authorsPage = await getHtmlDoc(`${SITE}/authors/`)
  const cardLinks = new Map() // profile slug → hrefs from the /authors/ cards
  for (const card of authorsPage.querySelectorAll('article.cmsmasters_profile_vertical')) {
    const href = card.querySelector('.cmsmasters_profile_title a')?.getAttribute('href') ?? ''
    const slug = href.match(/\/profile\/([^/]+)/)?.[1]
    if (slug) cardLinks.set(slug, [...card.querySelectorAll('.profile_social_icons a[href]')].map((a) => a.getAttribute('href')))
  }
  const profiles = wpProfiles.map((p) => ({wp: p, slug: p.slug, name: cleanText(p.title.rendered, `profile ${p.id}`)}))
  const fold = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const profileByName = new Map(profiles.map((p) => [fold(p.name), p]))
  const profileBySlug = new Map(profiles.map((p) => [p.slug, p]))

  // WP user → profile (display name, bio starting with the name; bylines below add more)
  const userToProfile = new Map()
  for (const u of wpUsers) {
    const byName = profileByName.get(fold(cleanText(u.name)))
    const desc = fold(cleanText(u.description ?? ''))
    const byBio = profiles.find((p) => desc.startsWith(fold(p.name)))
    if (byName || byBio) userToProfile.set(u.slug, (byName || byBio).slug)
  }

  // Post bylines from the rendered article pages (also: display order of categories, Yoast)
  const postInfo = new Map()
  for (const p of wpPosts) {
    const page = await getHtmlDoc(p.link)
    const art = page.querySelector(`#post-${p.id}`) ?? page.querySelector('article')
    const by = art?.querySelector('.cmsmasters_post_author a')
    const byHref = by?.getAttribute('href') ?? ''
    const shownCats = [...(art?.querySelectorAll('a[rel~="category"]') ?? [])].map((a) => a.getAttribute('href')?.match(/\/category\/([^/]+)/)?.[1]).filter(Boolean)
    const profileSlug = byHref.match(/\/profile\/([^/]+)/)?.[1]
    const wpUser = wpUsers.find((u) => u.id === p.author)
    if (profileSlug && wpUser && !userToProfile.has(wpUser.slug)) userToProfile.set(wpUser.slug, profileSlug)
    postInfo.set(p.id, {page, byline: squash(by?.textContent), byHref, shownCats, wpUser})
  }

  const authorDocs = []
  for (const prof of profiles) {
    const p = prof.wp
    const content = new JSDOM(`<body>${p.content.rendered}</body>`).window.document.body
    content.querySelectorAll('script, style, iframe, form, article, .cmsmasters_sharing, .share_wrap, noscript').forEach((e) => e.remove())
    content.querySelectorAll('img').forEach((e) => e.remove())
    flattenContainers(content)
    let role, expertise
    const bioParts = []
    for (const el of [...content.children]) {
      const text = squash(el.textContent)
      if (el.tagName === 'HR' || /^published content$/i.test(text) || el.matches('blockquote.wp-embedded-content')) break
      if (!text) continue
      const boldText = squash([...el.querySelectorAll('strong, b')].map((s) => s.textContent).join(''))
      const isRoleLine = /^H[1-6]$/.test(el.tagName) || (el.tagName === 'P' && boldText === text)
      if (role === undefined && !bioParts.length && isRoleLine) {
        const lines = el.innerHTML
          .split(/<br\b[^>]*>/i)
          .map((l) => cleanText(l).replace(/[,;]\s*$/, ''))
          .filter(Boolean)
        ;[role, expertise] = lines
        continue
      }
      bioParts.push(el.outerHTML)
    }
    const bio = await htmlToPortableText(bioParts.join('\n'), simpleBlockContent, {seed: `author-${prof.slug}-bio`, label: `author ${prof.slug}`, fallbackAlt: prof.name})
    const bioText = ptPlainText(bio)
    const shortBio = leadSentences(bioText, 400, 2)

    // links: /authors/ card icons + any social links inside the profile content
    const hrefs = [...(cardLinks.get(prof.slug) ?? []), ...[...content.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))]
    const links = []
    for (const href of hrefs) {
      const network = socialNetwork(href)
      if (!network || network === 'website') continue
      let url
      try {
        url = cleanSocialUrl(href)
      } catch {
        continue
      }
      if (links.some((l) => l.url === url)) continue
      links.push({_type: 'socialLink', _key: shortHash(`author-${prof.slug}-link-${url}`), network, url})
      if (/app_scoped_user_id/.test(url)) report.oddities.push(`author ${prof.slug}: Facebook link is an app-scoped ID (${url}) – probably not a public profile URL`)
    }

    const fm = p._embedded?.['wp:featuredmedia']?.[0]
    const photo = p.featured_media ? await buildFigure({media: fm ?? (await getMedia(p.featured_media)), alt: prof.name}) : null
    const wpUserSlugs = [...userToProfile.entries()].filter(([, s]) => s === prof.slug).map(([u]) => u)
    const profileDoc = await getHtmlDoc(p.link)
    const doc = {
      _id: `author-${prof.slug}`,
      _type: 'author',
      name: prof.name,
      slug: {_type: 'slug', current: prof.slug},
      ...(role ? {role} : {}),
      ...(expertise ? {expertise} : {}),
      ...(photo ? {photo} : {}),
      ...(shortBio ? {shortBio} : {}),
      ...(bio.length ? {bio} : {}),
      ...(links.length ? {links} : {}),
      ...(EDITORIAL[prof.slug] ?? {}),
      legacySlugs: [`/profile/${prof.slug}/`, ...wpUserSlugs.map((u) => `/author/${u}/`)],
    }
    const seo = yoastMeta(profileDoc, `${prof.name}${DEFAULT_TITLE_SUFFIX}`)
    if (seo) doc.seo = seo
    if (!role) report.oddities.push(`author ${prof.slug}: no role line on the WP profile – role left empty`)
    if (/I can also create a version|If .* prefers a slightly more/i.test(bioText)) {
      report.oddities.push(`author ${prof.slug}: bio ends with a leftover AI-assistant sentence ("If Cambridge Radar prefers… I can also create a version…") – migrated as-is, editor should delete it`)
    }
    authorDocs.push(doc)
    log(`   ${doc._id}  role="${role ?? ''}"${expertise ? ` expertise="${expertise}"` : ''}  bio=${bio.length} blocks  links=${links.map((l) => l.network).join(',') || '-'}  legacy=${doc.legacySlugs.join(' ')}`)
  }
  docs.push(...authorDocs)

  // ---- Posts (pass 1: metadata + redirect map) -------------------------------------------
  log('\n4. Posts')
  const postMeta = []
  for (const p of wpPosts) {
    const info = postInfo.get(p.id)
    const title = cleanText(p.title.rendered, `post ${p.id}`)
    const slug = SLUG_OVERRIDES[p.slug] ?? p.slug.replace(/_/g, '-')

    // categories in the order the article shows them
    const restSlugs = p.categories.map((id) => catById.get(id)?.slug).filter(Boolean)
    const ordered = [...new Set([...info.shownCats, ...restSlugs])].filter((s) => !SKIP_CATEGORY_SLUGS.has(s) && wpCatToSlug.has(s)).map((s) => wpCatToSlug.get(s))
    let category = ordered[0]
    if (!category) {
      category = FALLBACK_CATEGORY
      report.fallbacks.push(`post ${p.id} "${title}": only in "All" on WordPress → category fell back to "${FALLBACK_CATEGORY}"`)
    }
    const otherCategories = ordered.slice(1)

    // author from the byline
    let authorSlug
    let how
    const byProfile = info.byHref.match(/\/profile\/([^/]+)/)?.[1]
    const byUser = info.byHref.match(/\/author\/([^/]+)/)?.[1]
    if (byProfile && profileBySlug.has(byProfile)) [authorSlug, how] = [byProfile, 'byline profile link']
    else if (byUser && userToProfile.has(byUser)) [authorSlug, how] = [userToProfile.get(byUser), `byline WP user ${byUser}`]
    else if (profileByName.has(fold(info.byline))) [authorSlug, how] = [profileByName.get(fold(info.byline)).slug, 'byline name']
    else {
      const tagNames = (p._embedded?.['wp:term'] ?? []).flat().filter((t) => t.taxonomy === 'post_tag').map((t) => fold(cleanText(t.name)))
      const bySlug = profiles.find((pr) => p.slug.endsWith(pr.slug))
      const byTag = profiles.find((pr) => tagNames.includes(fold(pr.name)))
      const inferred = bySlug ?? byTag
      if (inferred) {
        authorSlug = inferred.slug
        how = `inferred from ${bySlug ? 'post slug' : 'tag'}`
        report.inferred.push(`post ${p.id} "${title}": byline "${info.byline}" (WP user ${byUser}) has no profile → ${inferred.name} (${how})`)
      } else {
        authorSlug = FALLBACK_AUTHOR
        how = 'FALLBACK'
        const inBody = squash(new JSDOM(`<body>${p.content.rendered}</body>`).window.document.body.textContent).match(/About the author\s+([A-Z][\p{L}’'-]+(?: [A-Z][\p{L}’'-]+){1,2})/u)?.[1]
        report.fallbacks.push(
          `post ${p.id} "${title}": byline "${info.byline}" (WP user ${byUser}) maps to no profile → ${FALLBACK_AUTHOR}${inBody ? `; the in-body "About the author" box names ${inBody} (no profile exists)` : ''}`,
        )
      }
    }
    const legacyUrl = new URL(p.link).pathname
    redirectMap.set(legacyUrl, `/${category}/${slug}`)
    postMeta.push({p, info, title, slug, category, otherCategories, authorSlug, how, legacyUrl})
  }

  // Redirect map for everything else (also used to rewrite internal links in bodies)
  for (const prof of profiles) redirectMap.set(`/profile/${prof.slug}/`, `/authors/${prof.slug}`)
  for (const u of wpUsers) redirectMap.set(`/author/${u.slug}/`, userToProfile.has(u.slug) ? `/authors/${userToProfile.get(u.slug)}` : '/authors')
  for (const c of wpCategories) redirectMap.set(`/category/${c.slug}/`, wpCatToSlug.has(c.slug) ? `/${wpCatToSlug.get(c.slug)}` : '/')
  for (const c of CATEGORIES) if (normalisePath(c.page) !== `/${c.slug}`) redirectMap.set(c.page, `/${c.slug}`)
  for (const pg of PAGES) if (pg.wpSlug !== pg.slug) redirectMap.set(`/${pg.wpSlug}/`, `/${pg.slug}`)
  for (const s of ['home', 'home-2', 'sports']) redirectMap.set(`/${s}/`, '/')
  redirectMap.set('/feed/', '/rss.xml')
  for (const pj of wpProjects) redirectMap.set(new URL(pj.link).pathname, '/')
  for (const t of wpPjCategs) redirectMap.set(new URL(t.link).pathname, '/')
  for (const t of wpPlCategs) redirectMap.set(new URL(t.link).pathname, '/authors')

  // ---- Posts (pass 2: documents) ---------------------------------------------------------
  const postDocs = []
  for (const m of postMeta) {
    const {p, info} = m
    const id = `post-wp-${p.id}`
    const body = await htmlToPortableText(p.content.rendered, blockContent, {seed: `${id}-body`, label: `post ${p.id}`, fallbackAlt: m.title})
    const fm = p._embedded?.['wp:featuredmedia']?.[0] ?? (await getMedia(p.featured_media))
    let mainImage = null
    if (p.featured_media && fm) {
      const alt = cleanText(fm.alt_text ?? '')
      if (!alt) report.oddities.push(`post ${p.id}: lead image has no alt text on WP → used the headline`)
      mainImage = await buildFigure({media: fm, alt: alt || m.title, caption: cleanText(fm.caption?.rendered ?? '') || undefined})
    }
    const tagsSeen = new Set()
    const tags = []
    for (const t of (p._embedded?.['wp:term'] ?? []).flat().filter((t) => t.taxonomy === 'post_tag')) {
      const name = cleanText(t.name)
      const k = name.toLowerCase()
      if (EXCLUDED_TAGS.has(k) || EXCLUDED_TAGS.has(t.slug) || name.length > 40 || tagsSeen.has(k)) continue
      tagsSeen.add(k)
      tags.push(name)
    }
    const excerpt = excerptFromBody(body)
    const modifiedLater = new Date(`${p.modified_gmt}Z`) - new Date(`${p.date_gmt}Z`) > 2 * 24 * 3600 * 1000
    const seo = yoastMeta(info.page, `${m.title}${DEFAULT_TITLE_SUFFIX}`)
    const doc = {
      _id: id,
      _type: 'post',
      title: m.title,
      slug: {_type: 'slug', current: m.slug},
      ...(excerpt ? {excerpt} : {}),
      ...(mainImage ? {mainImage} : {}),
      body,
      author: {_type: 'reference', _ref: `author-${m.authorSlug}`},
      category: {_type: 'reference', _ref: catDocId(m.category)},
      ...(m.otherCategories.length
        ? {otherCategories: m.otherCategories.map((s) => ({_type: 'reference', _ref: catDocId(s), _key: s}))}
        : {}),
      publishedAt: isoZ(p.date_gmt),
      ...(modifiedLater ? {updatedAt: isoZ(p.modified_gmt)} : {}),
      ...(tags.length ? {tags} : {}),
      ...(seo ? {seo} : {}),
      legacyUrl: m.legacyUrl,
    }
    if (!mainImage) report.oddities.push(`post ${p.id}: no lead image`)
    if (m.title.length > 100) report.oddities.push(`post ${p.id}: long headline (${m.title.length} chars) "${m.title}"`)
    if (m.title.length < 20) report.oddities.push(`post ${p.id}: very short headline "${m.title}" – the real subtitle is the first h3 of the body`)
    if (!squash(cleanText(p.excerpt.rendered))) report.notes.push(`post ${p.id}: WP excerpt was empty (cmsmasters shortcodes) – standfirst built from the body opening`)
    postDocs.push(doc)
    const types = body.map((b) => (b._type === 'block' ? b.listItem ? `li` : b.style : b._type))
    log(`   ${id}  /${m.category}/${m.slug}  by ${m.authorSlug} (${m.how})  other=[${m.otherCategories}]  body=${body.length} [${[...new Set(types)].join(',')}]  tags=${tags.length}${modifiedLater ? '  updatedAt' : ''}`)
  }
  docs.push(...postDocs)

  // ---- Pages ------------------------------------------------------------------------------
  log('\n5. Pages')
  let contactEmail
  for (const cfg of PAGES) {
    const wp = wpPages.find((p) => p.slug === cfg.wpSlug)
    if (!wp) {
      warn(`page ${cfg.wpSlug} not found`)
      continue
    }
    const title = cleanText(wp.title.rendered)
    let html = wp.content.rendered
    // cmsmasters icon list (address / email lines) → paragraphs; heading that repeats the page title → drop
    const frag = new JSDOM(`<body>${html}</body>`).window.document
    for (const ul of frag.querySelectorAll('ul.cmsmasters_icon_list_items')) {
      ul.replaceWith(...[...ul.querySelectorAll('li')].map((li) => Object.assign(frag.createElement('p'), {innerHTML: li.innerHTML})))
    }
    for (const h of frag.querySelectorAll('h1,h2,h3,h4,h5,h6')) if (fold(squash(h.textContent)) === fold(title)) h.remove()
    for (const a of frag.querySelectorAll('a[href^="mailto:"]')) {
      const email = squash(a.textContent)
      if (!contactEmail && cfg.wpSlug === 'contacts' && /@/.test(email)) contactEmail = email
    }
    html = frag.body.innerHTML
    const id = `page-${cfg.slug}`
    let body = await htmlToPortableText(html, blockContent, {seed: `${id}-body`, label: `page ${cfg.slug}`, fallbackAlt: title})
    let lede
    let image
    if (cfg.lede) {
      const idx = body.findIndex((b) => b._type === 'block' && b.style === 'normal' && !b.listItem)
      const leading = body.slice(0, idx)
      if (idx >= 0 && leading.every((b) => b._type === 'block' && /^h\d$/.test(b.style))) {
        lede = squash(blockText(body[idx]))
        if (leading.length) report.notes.push(`page ${cfg.slug}: hero heading "${leading.map(blockText).join(' / ')}" above the intro dropped (page title takes its place)`)
        body = body.slice(idx + 1)
      }
    }
    if (cfg.heroImage) {
      const idx = body.findIndex((b) => b._type === 'figure')
      if (idx >= 0) {
        const {_key, ...fig} = body[idx]
        image = fig
        body = body.filter((_, i) => i !== idx)
      }
    }
    const pageDoc = await getHtmlDoc(wp.link)
    const seo = yoastMeta(pageDoc, `${title}${DEFAULT_TITLE_SUFFIX}`)
    const doc = {
      _id: id,
      _type: 'page',
      title,
      slug: {_type: 'slug', current: cfg.slug},
      template: cfg.template,
      ...(lede ? {lede} : {}),
      ...(image ? {image} : {}),
      ...(body.length ? {body} : {}),
      ...(seo ? {seo} : {}),
      legacyUrl: new URL(wp.link).pathname,
    }
    docs.push(doc)
    log(`   ${id}  "${title}"  template=${cfg.template}  lede=${lede ? 'yes' : 'no'}  image=${image ? 'yes' : 'no'}  body=${body.length} blocks${seo ? '  seo' : ''}`)
  }
  for (const p of wpPages) {
    if (PAGES.some((c) => c.wpSlug === p.slug)) continue
    report.skipped.push(`page /${p.slug}/ – ${SKIPPED_PAGES[p.slug] ?? 'not in the migration list'}`)
  }
  report.skipped.push(`${wpProjects.length} "project" CPT items (2017 theme demo content) → redirected to /`)

  // ---- Redirects --------------------------------------------------------------------------
  log('\n6. Redirects')
  const redirectDocs = [...redirectMap.entries()]
    .filter(([source, destination]) => normalisePath(source) !== destination)
    .map(([source, destination]) => ({
      _id: `redirect-${shortHash(source)}`,
      _type: 'redirect',
      source,
      destination,
      permanent: true,
    }))
  docs.push(...redirectDocs)
  log(`   ${redirectDocs.length} redirects`)
  if (VERBOSE) redirectDocs.forEach((r) => log(`     ${r.source} → ${r.destination}`))

  // ---- Site settings ----------------------------------------------------------------------
  log('\n7. Site settings + home page')
  const home = await getHtmlDoc(`${SITE}/`)
  let schemaGraph = []
  for (const s of home.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent)
      schemaGraph.push(...(j['@graph'] ?? [j]))
    } catch {}
  }
  const org = schemaGraph.find((n) => n['@type'] === 'Organization')
  const website = schemaGraph.find((n) => n['@type'] === 'WebSite')
  let description = squash(home.querySelector('meta[name="description"]')?.getAttribute('content'))
  if (!description) {
    description = cleanText(website?.description || siteInfo.description || '')
    report.notes.push('siteSettings.description: the home page has no meta description → used the WordPress site description (also Yoast WebSite.description)')
  }
  // Header logo: request the Photon URL as PNG (the original upload is a 10902×2256 WebP).
  const logoImg = home.querySelector('.logo img:not(.logo_retina), #header img, header img')
  const logoSrc = logoImg?.getAttribute('src')
  let logo = null
  if (logoSrc) {
    const r = await get(logoSrc, {accept: 'image/png,image/*;q=0.8'})
    if (r.status === 200 && (r.contentType || '').startsWith('image/')) {
      const img = {url: logoSrc, buffer: r.body, contentType: r.contentType.split(';')[0], sha1: sha1(r.body)}
      if (img.contentType === 'image/png') fs.writeFileSync(LOGO_FILE, r.body)
      else warn(`logo came back as ${img.contentType}, not PNG`)
      const assetId = await ensureAsset(img, {sourceId: 'site-logo'})
      logo = {_type: 'image', asset: {_type: 'reference', _ref: assetId}}
      const dims = img.contentType === 'image/png' ? `${r.body.readUInt32BE(16)}×${r.body.readUInt32BE(20)}` : '?'
      log(`   logo ${dims} ${img.contentType} ${Math.round(r.body.length / 1024)} KB → ${path.relative(ROOT, LOGO_FILE)}`)
    } else warn(`logo download failed (${r.status})`)
  } else warn('no logo <img> in the header')
  const ogSrc = home.querySelector('meta[property="og:image"]')?.getAttribute('content')
  let ogImage = null
  if (ogSrc) {
    const img = await downloadImage([...originalUrlCandidates(ogSrc), ogSrc])
    if (img) ogImage = {_type: 'image', asset: {_type: 'reference', _ref: await ensureAsset(img, {sourceId: 'og-image'})}}
  } else report.notes.push('siteSettings.ogImage: the home page has no og:image → left empty')
  if (!contactEmail && org?.email) contactEmail = org.email
  const social = (org?.sameAs ?? [])
    .map((url) => ({url: cleanSocialUrl(url), network: socialNetwork(url)}))
    .filter((s) => s.network)
    .map((s) => ({_type: 'socialLink', _key: s.network, ...s}))
  const settings = {
    _id: 'siteSettings',
    _type: 'siteSettings',
    title: 'Cambridge Radar',
    tagline: 'Signals of What’s Next',
    ...(description ? {description} : {}),
    ...(logo ? {logo} : {}),
    ...(ogImage ? {ogImage} : {}),
    ...(contactEmail ? {contactEmail} : {}),
    ...(social.length ? {social} : {}),
    mainMenu: CATEGORIES.map((c) => ({_type: 'reference', _ref: catDocId(c.slug), _key: c.slug})),
    topMenu: [
      ['Home', '/'],
      ['Authors', '/authors'],
      ['About us', '/about'],
      ['Contacts', '/contacts'],
    ].map(([label, href]) => ({_type: 'menuLink', _key: slugify(label), label, href})),
    newsletterTitle: 'Get the Radar in your inbox',
    newsletterText: 'New analysis from Cambridge Radar, straight to your email. No noise.',
    newsletterAutoSend: true,
    gaId: 'G-PR3HH87FK3',
    googleVerification: '87OJXqApXlFocBQ0-sa-G0SYHfSWock8mccnsxY_X3w',
  }
  docs.push(settings)
  const liveVerification = home.querySelector('meta[name="google-site-verification"]')?.getAttribute('content')
  if (liveVerification && liveVerification !== settings.googleVerification) warn(`live google-site-verification differs: ${liveVerification}`)
  log(`   siteSettings  email=${contactEmail}  social=${social.map((s) => s.network)}  logo=${logo ? 'yes' : 'no'}  ogImage=${ogImage ? 'yes' : 'no'}`)

  const newest = [...postDocs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3)
  const homePage = {
    _id: 'homePage',
    _type: 'homePage',
    lead: newest.map((d) => ({_type: 'reference', _ref: d._id, _key: d._id})),
    editorsPicks: [],
    sections: CATEGORIES.map((c) => ({_type: 'reference', _ref: catDocId(c.slug), _key: c.slug})),
  }
  docs.push(homePage)
  log(`   homePage  lead=${newest.map((d) => d.slug.current).join(', ')}`)

  // ---- Not migratable ---------------------------------------------------------------------
  report.notes.push(`comments: the public REST API returns ${wpComments.length} comments → nothing to import`)
  report.notes.push('subscribers: MailPoet / Jetpack subscriber lists are not exposed publicly → nothing imported (export them from the WP admin)')

  // ---- Content oddities the frontend should expect ----------------------------------------
  const scanFigures = (value, where) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) return value.forEach((v, i) => scanFigures(v, `${where}[${i}]`))
    if (value._type === 'figure') {
      if (value.alt?.length > 200) report.oddities.push(`${where}: very long alt text (${value.alt.length} chars)`)
      if (value.caption?.length > 200) report.oddities.push(`${where}: very long caption (${value.caption.length} chars)`)
    }
    for (const [k, v] of Object.entries(value)) if (typeof v === 'object') scanFigures(v, `${where}.${k}`)
  }
  docs.forEach((d) => scanFigures(d, d._id))
  const withBreaks = postDocs.filter((d) => d.body.some((b) => b.children?.some((c) => c.text.includes('\n')))).map((d) => d._id)
  if (withBreaks.length) report.oddities.push(`soft line breaks ("\\n" inside spans, from <br>) in ${withBreaks.length} posts, incl. headings – render them as <br>: ${withBreaks.join(', ')}`)
  const inBodyBio = postDocs.filter((d) => d.body.some((b) => /^(about the author|editorial note by)/i.test(blockText(b).trim()))).map((d) => d._id)
  if (inBodyBio.length) report.oddities.push(`posts ending with an in-body author box ("About the author"/"Editorial note by …", photo + bio) that duplicates the author card: ${inBodyBio.join(', ')}`)
  const deks = postDocs.filter((d) => d.body[0]?.style === 'h3').map((d) => d._id)
  if (deks.length) report.oddities.push(`${deks.length} posts open with an h3 (a dek/subtitle in most, a first section heading in some) – style it so both read well: ${deks.join(', ')}`)
  const dupLead = postDocs.filter((d) => d.mainImage && d.body.some((b) => b._type === 'figure' && b.asset._ref === d.mainImage.asset._ref)).map((d) => d._id)
  if (dupLead.length) report.oddities.push(`lead image repeated as a body figure (same on WordPress) – consider skipping a body figure whose asset equals mainImage: ${dupLead.join(', ')}`)
  const longSeo = docs.filter((d) => d.seo?.title?.length > 70).map((d) => `${d._id} (${d.seo.title.length})`)
  if (longSeo.length) report.oddities.push(`Yoast titles over the schema's 70-char warning: ${longSeo.join(', ')}`)

  // ---- Validate ---------------------------------------------------------------------------
  log('\n8. Validating against the schema…')
  const problems = validateDocs(schema, docs)
  if (problems.length) {
    problems.forEach((p) => console.error(`   ✗ ${p}`))
    throw new Error(`${problems.length} schema problems – nothing written`)
  }
  log(`   ${docs.length} documents OK`)
  fs.writeFileSync(PREVIEW_FILE, JSON.stringify(docs, null, 2))
  log(`   full preview → ${path.relative(ROOT, PREVIEW_FILE)}`)

  // ---- Write ------------------------------------------------------------------------------
  const counts = docs.reduce((acc, d) => ((acc[d._type] = (acc[d._type] ?? 0) + 1), acc), {})
  if (APPLY) {
    log('\n9. Writing to Sanity…')
    const phases = [
      ['category', 'author'],
      ['post'],
      ['page', 'redirect'],
      ['siteSettings', 'homePage'],
    ]
    for (const types of phases) {
      const batch = docs.filter((d) => types.includes(d._type))
      for (let i = 0; i < batch.length; i += 50) {
        const tx = client.transaction()
        batch.slice(i, i + 50).forEach((d) => tx.createOrReplace(d))
        const res = await tx.commit({autoGenerateArrayKeys: false, visibility: 'sync'})
        log(`   ✓ ${types.join('+')} ${i + 1}–${Math.min(i + 50, batch.length)} (tx ${res.transactionId})`)
      }
    }
  }

  // ---- Report -----------------------------------------------------------------------------
  log(`\n${APPLY ? 'Written' : 'Would write'}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  log(`Images: ${imageStats.resolved} downloads resolved, ${imageStats.uploaded} uploaded, ${imageStats.reusedLocal} reused (local map), ${imageStats.reusedRemote} reused (found in Sanity by sha1)`)
  log(`Live HTTP requests this run: ${liveRequests}`)
  const section = (title, items) => items.length && log(`\n${title}\n${[...new Set(items)].map((i) => `  - ${i}`).join('\n')}`)
  section('Fallbacks:', report.fallbacks)
  section('Inferred authors:', report.inferred)
  section('Skipped:', report.skipped)
  section('Notes:', report.notes)
  section('Content oddities:', report.oddities)
  section('Warnings:', report.warnings)
  if (!APPLY) log('\nDry run only. Rerun with `npm run import:wp -- --apply` to write.')
}

main().catch((err) => {
  console.error(`\nImport failed: ${err.stack || err.message}`)
  process.exit(1)
})
