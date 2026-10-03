import {HomeIcon} from '@sanity/icons/Home'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Home page curation. Everything is optional: empty fields fall back to the
 * newest articles, so the home page never goes blank.
 */
export const homePage = defineType({
  name: 'homePage',
  title: 'Головна сторінка',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'lead',
      title: 'Головні статті (слайдер угорі)',
      type: 'array',
      description: 'Статті, що змінюються у центрі вгорі. Порожньо — три найновіші.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'post'}]})],
      validation: (rule) => rule.max(5).unique(),
    }),
    defineField({
      name: 'editorsPicks',
      title: 'Daily Feed',
      type: 'array',
      description: 'Статті у слайдері «Daily Feed» праворуч (по 4 на слайд), у цьому порядку. Порожньо — найновіші.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'post'}]})],
      validation: (rule) => rule.max(16).unique(),
    }),
    defineField({
      name: 'sections',
      title: 'Ряди розділів',
      type: 'array',
      description: 'Розділи, що йдуть рядами нижче на головній, у цьому порядку.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'category'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({name: 'seo', title: 'SEO', type: 'seo'}),
  ],
  preview: {prepare: () => ({title: 'Головна сторінка'})},
})
