import {DocumentIcon} from '@sanity/icons/Document'
import {defineField, defineType} from 'sanity'

/** Static pages: About, Contribute, Newsletter, Contacts, Privacy policy. */
export const page = defineType({
  name: 'page',
  title: 'Сторінка',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({name: 'title', title: 'Назва', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'Адреса (URL)',
      type: 'slug',
      options: {source: 'title', maxLength: 64},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'template',
      title: 'Що ще є на сторінці',
      type: 'string',
      description:
        'Робоча форма поруч із текстом. На сторінці контактів кожен рядок тексту стає рядком з іконкою (назва, адреса, email).',
      options: {
        list: [
          {title: 'Лише текст', value: 'default'},
          {title: 'Форма зворотного звʼязку (Contacts)', value: 'contact'},
          {title: 'Форма для авторів (Contribute)', value: 'contribute'},
          {title: 'Підписка на розсилку (Newsletter)', value: 'newsletter'},
        ],
        layout: 'radio',
      },
      initialValue: 'default',
    }),
    defineField({
      name: 'lede',
      title: 'Вступ',
      type: 'text',
      rows: 3,
      description: 'Більший текст під заголовком.',
    }),
    defineField({name: 'image', title: 'Зображення', type: 'figure'}),
    defineField({name: 'body', title: 'Текст', type: 'blockContent'}),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
    defineField({
      name: 'legacyUrl',
      title: 'Стара адреса WordPress',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
  ],
  preview: {
    select: {title: 'title', slug: 'slug.current'},
    prepare: ({title, slug}) => ({title, subtitle: `/${slug ?? ''}`}),
  },
})
