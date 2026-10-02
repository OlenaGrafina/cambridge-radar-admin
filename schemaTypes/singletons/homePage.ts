import {HomeIcon} from '@sanity/icons/Home'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Home page curation. Everything is optional: empty fields fall back to the
 * newest articles, so the home page never goes blank.
 */
export const homePage = defineType({
  name: 'homePage',
  title: 'Home page',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'lead',
      title: 'Top stories',
      type: 'array',
      description: 'Rotating stories at the top. Empty = the three newest articles.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'post'}]})],
      validation: (rule) => rule.max(5).unique(),
    }),
    defineField({
      name: 'editorsPicks',
      title: 'Daily Feed',
      type: 'array',
      description: 'Articles in the “Daily Feed” slider (4 per slide), in this order. Empty = the newest articles.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'post'}]})],
      validation: (rule) => rule.max(16).unique(),
    }),
    defineField({
      name: 'sections',
      title: 'Section rows',
      type: 'array',
      description: 'Sections shown as rows further down the page, in this order.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'category'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
  ],
  preview: {prepare: () => ({title: 'Home page'})},
})
