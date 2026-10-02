import {UserIcon} from '@sanity/icons/User'
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
      name: 'subtitle',
      title: 'Subtitle',
      type: 'string',
      description: 'Small line above the name on the profile and under it on the Authors page, e.g. “Author” or “Author, Founder & Editor-in-Chief”.',
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
      description: 'One or two sentences for the Authors page card and under articles.',
      validation: (rule) => rule.max(400),
    }),
    defineField({name: 'bio', title: 'Full bio', type: 'simpleBlockContent'}),
    defineField({name: 'country', title: 'Country', type: 'string'}),
    defineField({name: 'industry', title: 'Industry', type: 'string'}),
    defineField({
      name: 'skills',
      title: 'Skills',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
    }),
    defineField({
      name: 'profileCategories',
      title: 'Profile categories',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      description: 'For example: Author, Editor, Founder.',
    }),
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
