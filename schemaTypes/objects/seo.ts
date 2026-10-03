import {defineField, defineType} from 'sanity'

export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  options: {collapsible: true, collapsed: true},
  fields: [
    defineField({
      name: 'title',
      title: 'Meta-заголовок',
      type: 'string',
      description: 'Порожньо — береться звичайний заголовок. Бажано до 60 символів.',
      validation: (rule) => rule.max(70).warning('Google зазвичай обрізає заголовок після ~60 символів.'),
    }),
    defineField({
      name: 'description',
      title: 'Meta-опис',
      type: 'text',
      rows: 3,
      description: 'Порожньо — береться лід. Бажано 120–160 символів.',
      validation: (rule) => rule.max(180).warning('Google зазвичай обрізає опис після ~160 символів.'),
    }),
    defineField({
      name: 'image',
      title: 'Зображення для соцмереж',
      type: 'image',
      description: 'Порожньо — створюється автоматично із заголовка.',
    }),
    defineField({
      name: 'noIndex',
      title: 'Сховати від пошукових систем',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
