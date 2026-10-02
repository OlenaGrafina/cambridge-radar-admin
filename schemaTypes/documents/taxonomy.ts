import {StackCompactIcon} from '@sanity/icons/StackCompact'
import {TagIcon} from '@sanity/icons/Tag'
import {defineField, defineType} from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Section',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({name: 'title', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      description: 'Section lives at /url and is part of every article address in it.',
      options: {source: 'title', maxLength: 48},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description: 'Shown at the top of the section page and in Google.',
    }),
    defineField({
      name: 'order',
      title: 'Order in the menu',
      type: 'number',
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
  ],
  orderings: [{title: 'Menu order', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {
    select: {title: 'title', slug: 'slug.current', order: 'order'},
    prepare: ({title, slug, order}) => ({
      title,
      subtitle: `/${slug ?? ''}${typeof order === 'number' ? ` · #${order}` : ''}`,
    }),
  },
})

export const series = defineType({
  name: 'series',
  title: 'Series',
  type: 'document',
  icon: StackCompactIcon,
  fields: [
    defineField({name: 'title', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      description: 'Series lives at /series/url.',
      options: {source: 'title', maxLength: 64},
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
    defineField({name: 'image', title: 'Cover', type: 'figure'}),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
  ],
  preview: {select: {title: 'title', subtitle: 'description', media: 'image'}},
})
