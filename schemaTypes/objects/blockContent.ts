import {defineArrayMember, defineType} from 'sanity'

const link = defineArrayMember({
  name: 'link',
  title: 'Посилання',
  type: 'object',
  fields: [
    {
      name: 'href',
      title: 'Адреса',
      type: 'url',
      description: 'Повна адреса (https://…) або шлях на цьому сайті (/authors).',
      validation: (rule) =>
        rule.uri({allowRelative: true, scheme: ['http', 'https', 'mailto', 'tel']}),
    },
    {name: 'blank', title: 'Відкривати в новій вкладці', type: 'boolean', initialValue: false},
  ],
})

/** Article body: headings, quotes, lists, images, pull quotes, video. */
export const blockContent = defineType({
  name: 'blockContent',
  title: 'Текст',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Абзац', value: 'normal'},
        {title: 'Заголовок', value: 'h2'},
        {title: 'Підзаголовок', value: 'h3'},
        {title: 'Малий заголовок', value: 'h4'},
        {title: 'Цитата', value: 'blockquote'},
      ],
      lists: [
        {title: 'Маркований список', value: 'bullet'},
        {title: 'Нумерований список', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Жирний', value: 'strong'},
          {title: 'Курсив', value: 'em'},
          {title: 'Підкреслений', value: 'underline'},
          {title: 'Закреслений', value: 'strike-through'},
          {title: 'Верхній індекс', value: 'sup'},
        ],
        annotations: [link],
      },
    }),
    defineArrayMember({type: 'figure'}),
    defineArrayMember({type: 'pullQuote'}),
    defineArrayMember({type: 'embed'}),
    defineArrayMember({type: 'divider'}),
  ],
})

/** Short rich text for bios and page intros: paragraphs, links, lists. */
export const simpleBlockContent = defineType({
  name: 'simpleBlockContent',
  title: 'Текст',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Абзац', value: 'normal'},
        {title: 'Заголовок', value: 'h3'},
      ],
      lists: [
        {title: 'Маркований список', value: 'bullet'},
        {title: 'Нумерований список', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Жирний', value: 'strong'},
          {title: 'Курсив', value: 'em'},
        ],
        annotations: [link],
      },
    }),
  ],
})
