import {ukUALocale} from '@sanity/locale-uk-ua'
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

import {SINGLETONS, schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {ADVANCED} from './studio/advanced'
import {Layout, ToolMenu} from './studio/components'

const singletonTypes = new Set<string>(SINGLETONS)
const singletonActions = new Set(['publish', 'discardChanges', 'restore'])

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'polcbwiw'
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const siteUrl = process.env.SANITY_STUDIO_SITE_URL || 'https://cambridge-radar-frontend.vercel.app'

export default defineConfig({
  name: 'cambridge-radar',
  title: 'Cambridge Radar',
  projectId,
  dataset,

  plugins: [
    structureTool({structure, title: 'Контент'}),
    ukUALocale(),
    // Query playground: a developer tool, only in advanced mode.
    ...(ADVANCED ? [visionTool({defaultApiVersion: '2025-02-19'})] : []),
  ],

  // Ukrainian interface; English comes back in advanced mode.
  i18n: {
    locales: (prev) => (ADVANCED ? prev : prev.filter((locale) => locale.id === 'uk-UA')),
  },

  // Paid / extra Sanity features stay out of the editor's way until advanced mode is on.
  releases: {enabled: ADVANCED},
  scheduledDrafts: {enabled: ADVANCED},
  scheduledPublishing: {enabled: ADVANCED},
  tasks: {enabled: ADVANCED},
  announcements: {enabled: ADVANCED},
  mediaLibrary: {enabled: ADVANCED},
  apps: {canvas: {enabled: ADVANCED}},
  advancedVersionControl: {enabled: ADVANCED},

  studio: {
    components: {layout: Layout, toolMenu: ToolMenu},
  },

  schema: {
    types: schemaTypes,
    // Singletons are opened from the sidebar only, never created from "+".
    templates: (templates) => templates.filter(({schemaType}) => !singletonTypes.has(schemaType)),
  },

  document: {
    comments: {enabled: ADVANCED},
    actions: (input, context) => {
      if (singletonTypes.has(context.schemaType)) {
        return input.filter(({action}) => action && singletonActions.has(action))
      }
      return input
    },
    // "Open on site" in the document menu.
    productionUrl: async (prev, {document, getClient}) => {
      const doc = document as {_type: string; slug?: {current?: string}; category?: {_ref?: string}}
      if (doc._type === 'post' && doc.slug?.current && doc.category?._ref) {
        const section = await getClient({apiVersion: '2025-02-19'}).fetch<string | null>(
          '*[_id == $id][0].slug.current',
          {id: doc.category._ref},
        )
        if (section) return `${siteUrl}/${section}/${doc.slug.current}`
      }
      if (doc._type === 'page' && doc.slug?.current) return `${siteUrl}/${doc.slug.current}`
      if (doc._type === 'category' && doc.slug?.current) return `${siteUrl}/${doc.slug.current}`
      if (doc._type === 'author' && doc.slug?.current) return `${siteUrl}/authors/${doc.slug.current}`
      if (doc._type === 'series' && doc.slug?.current) return `${siteUrl}/series/${doc.slug.current}`
      return prev
    },
  },
})
