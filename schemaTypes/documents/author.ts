import {UserIcon} from '@sanity/icons/User'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Author card. Authors never log in: the editor creates a card and picks it
 * under any article. Editing the card updates every page that shows it.
 */
export const author = defineType({
  name: 'author',
  title: 'Автор',
  type: 'document',
  icon: UserIcon,
  groups: [
    {name: 'profile', title: 'Профіль', default: true},
    {name: 'details', title: 'Деталі профілю'},
    {name: 'links', title: 'Соцмережі'},
    {name: 'listing', title: 'Сторінка авторів'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Імʼя',
      type: 'string',
      group: 'profile',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Адреса (URL)',
      type: 'slug',
      group: 'profile',
      description: 'Профіль відкривається за адресою /authors/адреса.',
      options: {source: 'name', maxLength: 64},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'subtitle',
      title: 'Підзаголовок',
      type: 'string',
      group: 'profile',
      description:
        'Маленький рядок над імʼям у профілі й під ним на сторінці авторів. Наприклад: Author або Author, Founder & Editor-in-Chief.',
    }),
    defineField({
      name: 'role',
      title: 'Посада',
      type: 'string',
      group: 'profile',
      description: 'Наприклад: Founder & Editor-in-Chief',
    }),
    defineField({
      name: 'expertise',
      title: 'Експертиза',
      type: 'string',
      group: 'profile',
      description: 'Наприклад: Business Strategist & AI Systems Architect',
    }),
    defineField({
      name: 'photo',
      title: 'Портрет',
      type: 'figure',
      group: 'profile',
    }),
    defineField({
      name: 'shortBio',
      title: 'Коротке біо',
      type: 'text',
      rows: 3,
      group: 'profile',
      description: 'Одне-два речення для картки на сторінці авторів і під статтями.',
      validation: (rule) => rule.max(400),
    }),
    defineField({name: 'bio', title: 'Повна біографія', type: 'simpleBlockContent', group: 'profile'}),
    defineField({name: 'country', title: 'Країна', type: 'string', group: 'details'}),
    defineField({name: 'industry', title: 'Галузь', type: 'string', group: 'details'}),
    defineField({
      name: 'skills',
      title: 'Навички',
      type: 'array',
      group: 'details',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      description: 'Введіть навичку і натисніть Enter.',
    }),
    defineField({
      name: 'profileCategories',
      title: 'Категорії профілю',
      type: 'array',
      group: 'details',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      description: 'Наприклад: Author, Editor, Founder.',
    }),
    defineField({
      name: 'links',
      title: 'Соцмережі',
      type: 'array',
      group: 'links',
      of: [defineArrayMember({type: 'socialLink'})],
    }),
    defineField({
      name: 'isEditorial',
      title: 'Редакція',
      type: 'boolean',
      group: 'listing',
      initialValue: false,
      description: 'Показується першим, окремою широкою карткою на сторінці авторів.',
    }),
    defineField({
      name: 'order',
      title: 'Порядок на сторінці авторів',
      type: 'number',
      group: 'listing',
      description: 'Менше число — вище. Також задає «Previous / Next Profiles». Порожньо — за алфавітом.',
    }),
    defineField({name: 'seo', title: 'SEO', type: 'seo', group: 'seo'}),
    defineField({
      name: 'legacySlugs',
      title: 'Старі адреси WordPress',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      readOnly: true,
      hidden: true,
    }),
  ],
  orderings: [
    {title: 'За імʼям', name: 'nameAsc', by: [{field: 'name', direction: 'asc'}]},
    {title: 'Як на сторінці авторів', name: 'order', by: [{field: 'order', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'name', subtitle: 'role', media: 'photo'},
  },
})
