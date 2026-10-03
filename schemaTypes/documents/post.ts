import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineArrayMember, defineField, defineType} from 'sanity'

const API = {apiVersion: '2025-02-19'}

export const post = defineType({
  name: 'post',
  title: 'Стаття',
  type: 'document',
  icon: DocumentTextIcon,
  groups: [
    {name: 'content', title: 'Зміст', default: true},
    {name: 'meta', title: 'Автор і розділи'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Заголовок',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: 'slug',
      title: 'Адреса (URL)',
      type: 'slug',
      group: 'content',
      description:
        'Стаття відкривається за адресою /розділ/адреса. Якщо змінити її після публікації, старі посилання перестануть працювати.',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Лід (підзаголовок)',
      type: 'text',
      rows: 3,
      group: 'content',
      description: 'Одне-два речення під заголовком. Також показується в картках, пошуку і в Google.',
      validation: (rule) => rule.max(320),
    }),
    defineField({
      name: 'mainImage',
      title: 'Головне зображення',
      type: 'figure',
      group: 'content',
      description: 'Вгорі статті, на всіх картках, у слайдерах і в превʼю при поширенні.',
      validation: (rule) =>
        rule.required().warning('Без головного зображення у списках буде порожня рамка.'),
    }),
    defineField({
      name: 'body',
      title: 'Текст статті',
      type: 'blockContent',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Автор',
      type: 'reference',
      to: [{type: 'author'}],
      group: 'meta',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Розділ',
      type: 'reference',
      to: [{type: 'category'}],
      group: 'meta',
      description: 'Головний розділ: показується над заголовком і входить в адресу статті.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'otherCategories',
      title: 'Також показувати в розділах',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'category'}]})],
      group: 'meta',
      description: 'Інші розділи, де стаття теж зʼявиться. Залиште порожнім, якщо достатньо одного.',
      validation: (rule) =>
        rule.unique().custom((value, context) => {
          const main = (context.document as {category?: {_ref?: string}} | undefined)?.category?._ref
          const list = (value ?? []) as {_ref?: string}[]
          return main && list.some((ref) => ref._ref === main) ? 'Цей розділ уже вибрано як головний' : true
        }),
    }),
    defineField({
      name: 'series',
      title: 'Серія',
      type: 'reference',
      to: [{type: 'series'}],
      group: 'meta',
      // Not used on this site; kept so existing data is never lost.
      hidden: ({value}) => !value,
    }),
    defineField({
      name: 'publishedAt',
      title: 'Дата публікації',
      type: 'datetime',
      group: 'meta',
      description: 'Можна поставити майбутню дату — стаття зʼявиться на сайті протягом години після цього часу.',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Дата оновлення',
      type: 'datetime',
      group: 'meta',
      description: 'Лише після суттєвих змін у тексті — читачі бачать «Updated».',
    }),
    defineField({
      name: 'tags',
      title: 'Теми (теги)',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      group: 'meta',
      options: {layout: 'tags'},
      description:
        'Показуються під статтею, у кожної теми є своя сторінка (/tag/…). Введіть тему і натисніть Enter. Пишіть наявні теми так само, як вони вже написані.',
      validation: (rule) =>
        rule
          .custom(async (value, context) => {
            const tags = (value ?? []) as string[]
            if (!tags.length) return true
            const id = (context.document?._id ?? '').replace(/^drafts\./, '')
            const existing = await context
              .getClient(API)
              .fetch<(string | null)[]>('array::unique(*[_type == "post" && !(_id in [$id, $draft])].tags[])', {
                id,
                draft: `drafts.${id}`,
              })
            const byLower = new Map(
              (existing ?? []).filter((t): t is string => Boolean(t)).map((t) => [t.toLowerCase(), t]),
            )
            const clashes = tags
              .map((t) => [t, byLower.get(t.toLowerCase())] as const)
              .filter(([t, other]) => other && other !== t)
              .map(([t, other]) => `«${t}» → «${other}»`)
            return clashes.length ? `Така тема вже є в іншому написанні: ${clashes.join(', ')}` : true
          })
          .warning(),
    }),
    defineField({name: 'seo', title: 'SEO', type: 'seo', group: 'seo'}),
    defineField({
      name: 'newsletterSentAt',
      title: 'Надіслано підписникам',
      type: 'datetime',
      group: 'meta',
      readOnly: true,
      description: 'Заповнюється автоматично, коли розсилка про цю статтю вже відправлена.',
      hidden: ({value}) => !value,
    }),
    defineField({
      name: 'legacyUrl',
      title: 'Стара адреса WordPress',
      type: 'string',
      group: 'seo',
      readOnly: true,
      hidden: true,
    }),
  ],
  orderings: [
    {
      title: 'Спочатку нові',
      name: 'publishedDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      section: 'category.title',
      date: 'publishedAt',
      media: 'mainImage',
    },
    prepare: ({title, author, section, date, media}) => ({
      title,
      subtitle: [section, author, date ? new Date(date).toLocaleDateString('uk-UA') : 'Без дати']
        .filter(Boolean)
        .join(' · '),
      media,
    }),
  },
})
