import {UserIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Author card. Authors never log in: the editor creates a card and picks it
 * under any article. Editing the card updates every page that shows it.
 */
export const author = defineType({
  name: 'author',
  title: 'Author',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      description: 'Profile lives at /authors/url.',
      options: {source: 'name', maxLength: 64},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'For example: Founder & Editor-in-Chief',
    }),
    defineField({
      name: 'expertise',
      title: 'Expertise line',
      type: 'string',
      description: 'For example: Business Strategist & AI Systems Architect',
    }),
    defineField({
      name: 'photo',
      title: 'Portrait',
      type: 'figure',
    }),
    defineField({
      name: 'shortBio',
      title: 'Short bio',
      type: 'text',
      rows: 3,
      description: 'Two or three sentences shown under articles.',
      validation: (rule) => rule.max(400),
    }),
    defineField({name: 'bio', title: 'Full bio', type: 'simpleBlockContent'}),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [defineArrayMember({type: 'socialLink'})],
    }),
    defineField({
      name: 'isEditorial',
      title: 'Editorial team',
      type: 'boolean',
      initialValue: false,
      description: 'Shown first on the Authors page.',
    }),
    defineField({
      name: 'order',
      title: 'Order on the Authors page',
      type: 'number',
      description: 'Lower comes first. Leave empty to sort by name.',
    }),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
    defineField({
      name: 'legacySlugs',
      title: 'Old WordPress addresses',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      readOnly: true,
      description: 'Filled by the import, used for redirects.',
    }),
  ],
  orderings: [
    {title: 'Name', name: 'nameAsc', by: [{field: 'name', direction: 'asc'}]},
    {title: 'Authors page order', name: 'order', by: [{field: 'order', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'name', subtitle: 'role', media: 'photo'},
  },
})
