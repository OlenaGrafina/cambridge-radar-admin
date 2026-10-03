import {TransferIcon} from '@sanity/icons/Transfer'
import {defineField, defineType} from 'sanity'

const isPath = (value?: string) =>
  !value || value.startsWith('/') || value.startsWith('http') ? true : 'Має починатися з / або http'

export const redirect = defineType({
  name: 'redirect',
  title: 'Переадресація',
  type: 'document',
  icon: TransferIcon,
  description: 'Нове правило починає працювати з наступною публікацією на сайті (до кількох хвилин).',
  fields: [
    defineField({
      name: 'source',
      title: 'Звідки',
      type: 'string',
      description: 'Старий шлях, наприклад /2026/01/27/davos2026-signals/',
      validation: (rule) => rule.required().custom(isPath),
    }),
    defineField({
      name: 'destination',
      title: 'Куди',
      type: 'string',
      description: 'Новий шлях, наприклад /geopolitics/davos-2026-signals',
      validation: (rule) => rule.required().custom(isPath),
    }),
    defineField({
      name: 'permanent',
      title: 'Постійна (301)',
      type: 'boolean',
      description: 'Залиште увімкненим: так Google переносить позиції сторінки на нову адресу.',
      initialValue: true,
    }),
  ],
  preview: {
    select: {source: 'source', destination: 'destination'},
    prepare: ({source, destination}) => ({title: source, subtitle: `→ ${destination}`}),
  },
})
