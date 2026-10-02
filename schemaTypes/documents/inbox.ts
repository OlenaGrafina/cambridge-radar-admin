import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {UsersIcon} from '@sanity/icons/Users'
import {defineField, defineType} from 'sanity'

export const subscriber = defineType({
  name: 'subscriber',
  title: 'Subscriber',
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
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Waiting for confirmation', value: 'pending'},
          {title: 'Subscribed', value: 'active'},
          {title: 'Unsubscribed', value: 'unsubscribed'},
        ],
        layout: 'radio',
      },
      initialValue: 'pending',
    }),
    defineField({name: 'name', title: 'Name', type: 'string'}),
    defineField({
      name: 'source',
      title: 'Signed up from',
      type: 'string',
      readOnly: true,
      description: 'Page where the form was used, or “import”.',
    }),
    defineField({name: 'createdAt', title: 'Signed up', type: 'datetime', readOnly: true}),
    defineField({name: 'confirmedAt', title: 'Confirmed', type: 'datetime', readOnly: true}),
    defineField({
      name: 'token',
      title: 'Private token',
      type: 'string',
      readOnly: true,
      hidden: true,
      description: 'Used in confirm and unsubscribe links.',
    }),
  ],
  orderings: [{title: 'Newest first', name: 'createdDesc', by: [{field: 'createdAt', direction: 'desc'}]}],
  preview: {
    select: {title: 'email', subtitle: 'status'},
  },
})

export const contactMessage = defineType({
  name: 'contactMessage',
  title: 'Message',
  type: 'document',
  icon: EnvelopeIcon,
  readOnly: false,
  fields: [
    defineField({name: 'handled', title: 'Answered', type: 'boolean', initialValue: false}),
    defineField({name: 'name', title: 'Name', type: 'string', readOnly: true}),
    defineField({name: 'email', title: 'Email', type: 'string', readOnly: true}),
    defineField({name: 'subject', title: 'Subject', type: 'string', readOnly: true}),
    defineField({name: 'message', title: 'Message', type: 'text', rows: 8, readOnly: true}),
    defineField({name: 'createdAt', title: 'Sent', type: 'datetime', readOnly: true}),
  ],
  orderings: [{title: 'Newest first', name: 'createdDesc', by: [{field: 'createdAt', direction: 'desc'}]}],
  preview: {
    select: {name: 'name', subject: 'subject', handled: 'handled', createdAt: 'createdAt'},
    prepare: ({name, subject, handled, createdAt}) => ({
      title: `${handled ? '✓ ' : ''}${subject || '(no subject)'}`,
      subtitle: [name, createdAt ? new Date(createdAt).toLocaleString('en-GB') : ''].filter(Boolean).join(' · '),
    }),
  },
})
