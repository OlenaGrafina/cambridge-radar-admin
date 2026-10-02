import {TransferIcon} from '@sanity/icons/Transfer'
import {defineField, defineType} from 'sanity'

const isPath = (value?: string) =>
  !value || value.startsWith('/') || value.startsWith('http') ? true : 'Start with / or http'

export const redirect = defineType({
  name: 'redirect',
  title: 'Redirect',
  type: 'document',
  icon: TransferIcon,
  fields: [
    defineField({
      name: 'source',
      title: 'From',
      type: 'string',
      description: 'Old path, for example /2026/01/27/davos2026-signals/',
      validation: (rule) => rule.required().custom(isPath),
    }),
    defineField({
      name: 'destination',
      title: 'To',
      type: 'string',
      description: 'New path, for example /geopolitics/davos-2026-signals',
      validation: (rule) => rule.required().custom(isPath),
    }),
    defineField({
      name: 'permanent',
      title: 'Permanent (301)',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: {
    select: {source: 'source', destination: 'destination'},
    prepare: ({source, destination}) => ({title: source, subtitle: `→ ${destination}`}),
  },
})
