import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

import {SINGLETONS, schemaTypes} from './schemaTypes'
import {structure} from './structure'

const singletonTypes = new Set<string>(SINGLETONS)
const singletonActions = new Set(['publish', 'discardChanges', 'restore'])

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'polcbwiw'
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const siteUrl = process.env.SANITY_STUDIO_SITE_URL || 'http://localhost:3044'

export default defineConfig({
  name: 'cambridge-radar',
  title: 'Cambridge Radar',
  projectId,
  dataset,

  plugins: [structureTool({structure}), visionTool({defaultApiVersion: '2025-02-19'})],

  schema: {
    types: schemaTypes,
    // Singletons are opened from the sidebar only, never created from "+".
    templates: (templates) => templates.filter(({schemaType}) => !singletonTypes.has(schemaType)),
  },

  document: {
    actions: (input, context) => {
      if (singletonTypes.has(context.schemaType)) {
        return input.filter(({action}) => action && singletonActions.has(action))
      }
      return input
    },
    productionUrl: async (prev, {document}) => {
      const doc = document as {_type: string; slug?: {current?: string}}
      if (doc._type === 'page' && doc.slug?.current) return `${siteUrl}/${doc.slug.current}`
      if (doc._type === 'category' && doc.slug?.current) return `${siteUrl}/${doc.slug.current}`
      if (doc._type === 'author' && doc.slug?.current) return `${siteUrl}/authors/${doc.slug.current}`
      if (doc._type === 'series' && doc.slug?.current) return `${siteUrl}/series/${doc.slug.current}`
      return prev
    },
  },
})
