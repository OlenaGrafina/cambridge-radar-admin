import {CommentIcon} from '@sanity/icons/Comment'
import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {UsersIcon} from '@sanity/icons/Users'
import {defineField, defineType} from 'sanity'

export const COMMENT_STATUSES = [
  {title: 'Waiting for review', value: 'pending'},
  {title: 'Published', value: 'approved'},
  {title: 'Rejected', value: 'rejected'},
  {title: 'Spam', value: 'spam'},
]

/**
 * Reader comment. Created by the website as `pending`; nothing appears on
 * the site until the editor approves it (Approve action or status field).
 */
export const comment = defineType({
  name: 'comment',
  title: 'Comment',
  type: 'document',
  icon: CommentIcon,
  fields: [
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {list: COMMENT_STATUSES, layout: 'radio', direction: 'horizontal'},
      initialValue: 'pending',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'post',
      title: 'Article',
      type: 'reference',
      to: [{type: 'post'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'parent',
      title: 'In reply to',
      type: 'reference',
      to: [{type: 'comment'}],
      options: {
        filter: ({document}) => {
          const postRef = (document as {post?: {_ref?: string}}).post?._ref
          return postRef ? {filter: 'post._ref == $post', params: {post: postRef}} : {filter: 'true'}
        },
      },
    }),
    defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      description: 'Never shown on the site.',
      validation: (rule) => rule.email(),
    }),
    defineField({
      name: 'body',
      title: 'Comment',
      type: 'text',
      rows: 6,
      validation: (rule) => rule.required().max(5000),
    }),
    defineField({
      name: 'staffAuthor',
      title: 'Answered as',
      type: 'reference',
      to: [{type: 'author'}],
      description: 'Set when the editor or an author replies. The reply gets an “Author” badge.',
    }),
    defineField({
      name: 'notifyOnReply',
      title: 'Email the reader when someone replies',
      type: 'boolean',
      initialValue: false,
      readOnly: true,
    }),
    defineField({name: 'replyNotifiedAt', title: 'Reader notified of reply', type: 'datetime', readOnly: true, hidden: true}),
    defineField({
      name: 'createdAt',
      title: 'Written',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      readOnly: true,
    }),
  ],
  orderings: [{title: 'Newest first', name: 'createdDesc', by: [{field: 'createdAt', direction: 'desc'}]}],
  preview: {
    select: {name: 'name', body: 'body', status: 'status', post: 'post.title'},
    prepare: ({name, body, status, post}) => {
      const label = COMMENT_STATUSES.find((s) => s.value === status)?.title ?? status
      return {
        title: `${name}: ${(body ?? '').slice(0, 80)}`,
        subtitle: `${label} · ${post ?? 'no article'}`,
      }
    },
  },
})

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
