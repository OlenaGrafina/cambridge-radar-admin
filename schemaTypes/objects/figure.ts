import {ImageIcon} from '@sanity/icons/Image'
import {defineField, defineType} from 'sanity'

/** Image with the editorial fields a newspaper needs: alt, caption, credit. */
export const figure = defineType({
  name: 'figure',
  title: 'Зображення',
  type: 'image',
  icon: ImageIcon,
  options: {hotspot: true},
  fields: [
    defineField({
      name: 'alt',
      title: 'Опис для незрячих (alt)',
      type: 'string',
      description: 'Що зображено — для екранних читалок і Google. Англійською, як і сайт.',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as {asset?: unknown} | undefined
          if (parent?.asset && !value) return 'Додайте опис зображення (alt)'
          return true
        }),
    }),
    defineField({name: 'caption', title: 'Підпис', type: 'string'}),
    defineField({
      name: 'credit',
      title: 'Автор / джерело фото',
      type: 'string',
      description: 'Наприклад: Photo: Chatham House',
    }),
  ],
  preview: {
    select: {caption: 'caption', alt: 'alt', media: 'asset'},
    prepare: ({caption, alt, media}) => ({title: caption || alt || 'Зображення', media}),
  },
})
