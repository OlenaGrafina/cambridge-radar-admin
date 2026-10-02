import {DocumentIcon} from '@sanity/icons/Document'
import {defineField, defineType} from 'sanity'

/** Static pages: About, Contribute, Newsletter, Contacts, Privacy policy. */
export const page = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      options: {source: 'title', maxLength: 64},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'template',
      title: 'Extras on this page',
      type: 'string',
      description: 'Adds a working form under the text.',
      options: {
        list: [
          {title: 'Text only', value: 'default'},
          {title: 'Contact form', value: 'contact'},
          {title: 'Newsletter sign-up', value: 'newsletter'},
        ],
        layout: 'radio',
      },
      initialValue: 'default',
    }),
    defineField({
      name: 'lede',
      title: 'Intro',
      type: 'text',
      rows: 3,
      description: 'Larger text under the title.',
    }),
    defineField({name: 'image', title: 'Image', type: 'figure'}),
    defineField({name: 'body', title: 'Text', type: 'blockContent'}),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
    defineField({
      name: 'legacyUrl',
      title: 'Old WordPress address',
      type: 'string',
      readOnly: true,
    }),
  ],
  preview: {
    select: {title: 'title', slug: 'slug.current'},
    prepare: ({title, slug}) => ({title, subtitle: `/${slug ?? ''}`}),
  },
})
