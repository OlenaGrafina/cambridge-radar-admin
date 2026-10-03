import {BlockquoteIcon} from '@sanity/icons/Blockquote'
import {LinkIcon} from '@sanity/icons/Link'
import {PlayIcon} from '@sanity/icons/Play'
import {RemoveIcon} from '@sanity/icons/Remove'
import {defineField, defineType} from 'sanity'

export const pullQuote = defineType({
  name: 'pullQuote',
  title: 'Виносна цитата',
  type: 'object',
  icon: BlockquoteIcon,
  fields: [
    defineField({
      name: 'text',
      title: 'Цитата',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'attribution', title: 'Чиї слова', type: 'string'}),
  ],
  preview: {select: {title: 'text', subtitle: 'attribution'}},
})

export const embed = defineType({
  name: 'embed',
  title: 'Відео',
  type: 'object',
  icon: PlayIcon,
  fields: [
    defineField({
      name: 'url',
      title: 'Посилання',
      type: 'url',
      description: 'Посилання на YouTube або Vimeo.',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'caption', title: 'Підпис', type: 'string'}),
  ],
  preview: {select: {title: 'url', subtitle: 'caption'}},
})

export const divider = defineType({
  name: 'divider',
  title: 'Розділювач',
  type: 'object',
  icon: RemoveIcon,
  fields: [
    defineField({
      name: 'style',
      title: 'Вигляд',
      type: 'string',
      options: {
        list: [
          {title: 'Лінія', value: 'line'},
          {title: 'Три крапки', value: 'dots'},
        ],
        layout: 'radio',
      },
      initialValue: 'line',
    }),
  ],
  preview: {prepare: () => ({title: 'Розділювач'})},
})

export const SOCIAL_NETWORKS = [
  {title: 'LinkedIn', value: 'linkedin'},
  {title: 'Instagram', value: 'instagram'},
  {title: 'Facebook', value: 'facebook'},
  {title: 'X (Twitter)', value: 'x'},
  {title: 'Telegram', value: 'telegram'},
  {title: 'YouTube', value: 'youtube'},
  {title: 'Вебсайт', value: 'website'},
]

export const socialLink = defineType({
  name: 'socialLink',
  title: 'Соцмережа',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'network',
      title: 'Мережа',
      type: 'string',
      options: {list: SOCIAL_NETWORKS},
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'url', title: 'Посилання', type: 'url', validation: (rule) => rule.required()}),
  ],
  preview: {
    select: {network: 'network', url: 'url'},
    prepare: ({network, url}) => ({
      title: SOCIAL_NETWORKS.find((n) => n.value === network)?.title ?? network,
      subtitle: url,
    }),
  },
})
