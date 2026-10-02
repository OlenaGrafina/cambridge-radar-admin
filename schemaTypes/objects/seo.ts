import {defineField, defineType} from 'sanity'

export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  options: {collapsible: true, collapsed: true},
  fields: [
    defineField({
      name: 'title',
      title: 'Meta title',
      type: 'string',
      description: 'Leave empty to use the headline. Aim for under 60 characters.',
      validation: (rule) => rule.max(70).warning('Google usually cuts titles after ~60 characters.'),
    }),
    defineField({
      name: 'description',
      title: 'Meta description',
      type: 'text',
      rows: 3,
      description: 'Leave empty to use the standfirst. Aim for 120–160 characters.',
      validation: (rule) =>
        rule.max(180).warning('Google usually cuts descriptions after ~160 characters.'),
    }),
    defineField({
      name: 'image',
      title: 'Social share image',
      type: 'image',
      description: 'Leave empty to generate one automatically from the headline.',
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from search engines',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
