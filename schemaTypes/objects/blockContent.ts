import {defineArrayMember, defineType} from 'sanity'

const link = defineArrayMember({
  name: 'link',
  title: 'Link',
  type: 'object',
  fields: [
    {
      name: 'href',
      title: 'URL',
      type: 'url',
      validation: (rule) =>
        rule.uri({allowRelative: true, scheme: ['http', 'https', 'mailto', 'tel']}),
    },
    {name: 'blank', title: 'Open in new tab', type: 'boolean', initialValue: false},
  ],
})

/** Article body: headings, quotes, lists, images, pull quotes, video. */
export const blockContent = defineType({
  name: 'blockContent',
  title: 'Body',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Paragraph', value: 'normal'},
        {title: 'Heading', value: 'h2'},
        {title: 'Subheading', value: 'h3'},
        {title: 'Small heading', value: 'h4'},
        {title: 'Quote', value: 'blockquote'},
      ],
      lists: [
        {title: 'Bullets', value: 'bullet'},
        {title: 'Numbers', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Bold', value: 'strong'},
          {title: 'Italic', value: 'em'},
          {title: 'Underline', value: 'underline'},
          {title: 'Strike', value: 'strike-through'},
          {title: 'Superscript', value: 'sup'},
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
  title: 'Text',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Paragraph', value: 'normal'},
        {title: 'Heading', value: 'h3'},
      ],
      lists: [
        {title: 'Bullets', value: 'bullet'},
        {title: 'Numbers', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Bold', value: 'strong'},
          {title: 'Italic', value: 'em'},
        ],
        annotations: [link],
      },
    }),
  ],
})
