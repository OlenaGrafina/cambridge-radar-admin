import {author} from './documents/author'
import {contactMessage, subscriber} from './documents/inbox'
import {page} from './documents/page'
import {post} from './documents/post'
import {redirect} from './documents/redirect'
import {category, series} from './documents/taxonomy'
import {blockContent, simpleBlockContent} from './objects/blockContent'
import {figure} from './objects/figure'
import {divider, embed, pullQuote, socialLink} from './objects/inline'
import {seo} from './objects/seo'
import {homePage} from './singletons/homePage'
import {siteSettings} from './singletons/siteSettings'

export const SINGLETONS = ['siteSettings', 'homePage'] as const

export const schemaTypes = [
  // content
  post,
  author,
  category,
  series,
  page,
  // inbox
  subscriber,
  contactMessage,
  // site
  siteSettings,
  homePage,
  redirect,
  // objects
  seo,
  figure,
  pullQuote,
  embed,
  divider,
  socialLink,
  blockContent,
  simpleBlockContent,
]
