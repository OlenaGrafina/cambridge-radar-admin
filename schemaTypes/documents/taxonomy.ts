import {StackCompactIcon} from '@sanity/icons/StackCompact'
import {TagIcon} from '@sanity/icons/Tag'
import {defineField, defineType} from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Розділ',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({name: 'title', title: 'Назва', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'Адреса (URL)',
      type: 'slug',
      description: 'Розділ відкривається за адресою /адреса, і вона ж входить в адресу кожної його статті.',
      options: {source: 'title', maxLength: 48},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Опис',
      type: 'text',
      rows: 3,
      description: 'Вгорі сторінки розділу і в Google.',
    }),
    defineField({
      name: 'order',
      title: 'Порядок у списках',
      type: 'number',
      description: 'Сортує розділи тут, в адмінці. Порядок у меню сайту — в «Налаштування сайту → Меню».',
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
  ],
  orderings: [{title: 'За порядком', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {
    select: {title: 'title', slug: 'slug.current', order: 'order'},
    prepare: ({title, slug, order}) => ({
      title,
      subtitle: `/${slug ?? ''}${typeof order === 'number' ? ` · №${order}` : ''}`,
    }),
  },
})

export const series = defineType({
  name: 'series',
  title: 'Серія',
  type: 'document',
  icon: StackCompactIcon,
  fields: [
    defineField({name: 'title', title: 'Назва', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'Адреса (URL)',
      type: 'slug',
      description: 'Серія відкривається за адресою /series/адреса.',
      options: {source: 'title', maxLength: 64},
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'description', title: 'Опис', type: 'text', rows: 3}),
    defineField({name: 'image', title: 'Обкладинка', type: 'figure'}),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
  ],
  preview: {select: {title: 'title', subtitle: 'description', media: 'image'}},
})
