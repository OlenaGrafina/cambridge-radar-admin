import {BlockquoteIcon, LinkIcon, PlayIcon, RemoveIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const pullQuote = defineType({
  name: 'pullQuote',
  title: 'Pull quote',
  type: 'object',
  icon: BlockquoteIcon,
  fields: [
    defineField({
      name: 'text',
      title: 'Quote',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'attribution', title: 'Attribution', type: 'string'}),
  ],
  preview: {select: {title: 'text', subtitle: 'attribution'}},
})

export const embed = defineType({
  name: 'embed',
  title: 'Video',
  type: 'object',
  icon: PlayIcon,
  fields: [
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      description: 'YouTube or Vimeo link.',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'caption', title: 'Caption', type: 'string'}),
  ],
  preview: {select: {title: 'url', subtitle: 'caption'}},
})

export const divider = defineType({
  name: 'divider',
  title: 'Section break',
  type: 'object',
  icon: RemoveIcon,
  fields: [
    defineField({
      name: 'style',
      title: 'Style',
      type: 'string',
      options: {
        list: [
          {title: 'Line', value: 'line'},
          {title: 'Three dots', value: 'dots'},
        ],
        layout: 'radio',
      },
      initialValue: 'line',
    }),
  ],
  preview: {prepare: () => ({title: 'Section break'})},
})

export const SOCIAL_NETWORKS = [
  {title: 'LinkedIn', value: 'linkedin'},
  {title: 'Instagram', value: 'instagram'},
  {title: 'Facebook', value: 'facebook'},
  {title: 'X (Twitter)', value: 'x'},
  {title: 'Telegram', value: 'telegram'},
  {title: 'YouTube', value: 'youtube'},
  {title: 'Website', value: 'website'},
]

export const socialLink = defineType({
  name: 'socialLink',
  title: 'Social link',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'network',
      title: 'Network',
      type: 'string',
      options: {list: SOCIAL_NETWORKS},
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'url', title: 'URL', type: 'url', validation: (rule) => rule.required()}),
  ],
  preview: {select: {title: 'network', subtitle: 'url'}},
})
