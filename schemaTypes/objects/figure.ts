import {ImageIcon} from '@sanity/icons/Image'
import {defineField, defineType} from 'sanity'

/** Image with the editorial fields a newspaper needs: alt, caption, credit. */
export const figure = defineType({
  name: 'figure',
  title: 'Image',
  type: 'image',
  icon: ImageIcon,
  options: {hotspot: true},
  fields: [
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description: 'Describe the image for screen readers and Google.',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as {asset?: unknown} | undefined
          if (parent?.asset && !value) return 'Alt text is required for accessibility'
          return true
        }),
    }),
    defineField({name: 'caption', title: 'Caption', type: 'string'}),
    defineField({
      name: 'credit',
      title: 'Credit',
      type: 'string',
      description: 'For example: Photo: Chatham House',
    }),
  ],
  preview: {
    select: {caption: 'caption', alt: 'alt', media: 'asset'},
    prepare: ({caption, alt, media}) => ({title: caption || alt || 'Image', media}),
  },
})
