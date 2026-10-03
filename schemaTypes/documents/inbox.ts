import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {UsersIcon} from '@sanity/icons/Users'
import {defineField, defineType} from 'sanity'

const date = (value?: string) => (value ? new Date(value).toLocaleString('uk-UA') : '')

export const subscriber = defineType({
  name: 'subscriber',
  title: 'Підписник',
  type: 'document',
  icon: UsersIcon,
  fields: [
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (rule) => rule.required().email(),
    }),
    defineField({
      name: 'status',
      title: 'Статус',
      type: 'string',
      options: {
        list: [
          {title: 'Чекає підтвердження', value: 'pending'},
          {title: 'Підписаний', value: 'active'},
          {title: 'Відписався', value: 'unsubscribed'},
        ],
        layout: 'radio',
      },
      initialValue: 'pending',
    }),
    defineField({name: 'name', title: 'Імʼя', type: 'string'}),
    defineField({
      name: 'source',
      title: 'Звідки підписався',
      type: 'string',
      readOnly: true,
      description: 'Сторінка, де заповнили форму, або «import».',
    }),
    defineField({name: 'createdAt', title: 'Дата підписки', type: 'datetime', readOnly: true}),
    defineField({name: 'confirmedAt', title: 'Підтверджено', type: 'datetime', readOnly: true}),
    defineField({
      name: 'token',
      title: 'Приватний токен',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
  ],
  orderings: [{title: 'Спочатку нові', name: 'createdDesc', by: [{field: 'createdAt', direction: 'desc'}]}],
  preview: {
    select: {title: 'email', status: 'status'},
    prepare: ({title, status}) => ({
      title,
      subtitle: {pending: 'Чекає підтвердження', active: 'Підписаний', unsubscribed: 'Відписався'}[status as string] ?? status,
    }),
  },
})

export const contactMessage = defineType({
  name: 'contactMessage',
  title: 'Повідомлення',
  type: 'document',
  icon: EnvelopeIcon,
  fields: [
    defineField({
      name: 'handled',
      title: 'Відповідь надано',
      type: 'boolean',
      initialValue: false,
      description: 'Позначте, коли відповіли — у списку зʼявиться ✓.',
    }),
    defineField({
      name: 'form',
      title: 'Форма',
      type: 'string',
      readOnly: true,
      options: {
        list: [
          {title: 'Contacts (зворотний звʼязок)', value: 'contact'},
          {title: 'Contribute (стати автором)', value: 'contribute'},
        ],
      },
    }),
    defineField({name: 'name', title: 'Імʼя', type: 'string', readOnly: true}),
    defineField({name: 'email', title: 'Email', type: 'string', readOnly: true}),
    defineField({name: 'subject', title: 'Тема', type: 'string', readOnly: true}),
    defineField({name: 'message', title: 'Повідомлення', type: 'text', rows: 8, readOnly: true}),
    defineField({name: 'linkedin', title: 'Профіль LinkedIn', type: 'url', readOnly: true}),
    defineField({name: 'topic', title: 'Запропонована тема', type: 'text', rows: 4, readOnly: true}),
    defineField({name: 'createdAt', title: 'Надіслано', type: 'datetime', readOnly: true}),
  ],
  orderings: [{title: 'Спочатку нові', name: 'createdDesc', by: [{field: 'createdAt', direction: 'desc'}]}],
  preview: {
    select: {name: 'name', topic: 'topic', form: 'form', handled: 'handled', createdAt: 'createdAt'},
    prepare: ({name, topic, form, handled, createdAt}) => ({
      title: `${handled ? '✓ ' : ''}${form === 'contribute' ? `Contribute: ${topic || name}` : `Contacts: ${name || 'без імені'}`}`,
      subtitle: [name, date(createdAt)].filter(Boolean).join(' · '),
    }),
  },
})
