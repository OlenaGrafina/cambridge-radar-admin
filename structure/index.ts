import {CogIcon} from '@sanity/icons/Cog'
import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {HomeIcon} from '@sanity/icons/Home'
import {TransferIcon} from '@sanity/icons/Transfer'
import type {StructureResolver} from 'sanity/structure'

import {ADVANCED} from '../studio/advanced'

const singleton = (S: Parameters<StructureResolver>[0], type: string, title: string, icon: typeof HomeIcon) =>
  S.listItem()
    .title(title)
    .id(type)
    .icon(icon)
    .child(S.document().schemaType(type).documentId(type).title(title))

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Cambridge Radar')
    .items([
      S.listItem()
        .title('Статті')
        .icon(DocumentTextIcon)
        .child(
          S.list()
            .title('Статті')
            .items([
              S.listItem()
                .title('Усі статті')
                .icon(DocumentTextIcon)
                .child(
                  S.documentTypeList('post')
                    .title('Усі статті')
                    .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                ),
              S.listItem()
                .title('За розділами')
                .child(
                  S.documentTypeList('category')
                    .title('Розділи')
                    .defaultOrdering([{field: 'order', direction: 'asc'}])
                    .child((categoryId) =>
                      S.documentList()
                        .title('Статті розділу')
                        .schemaType('post')
                        .filter('_type == "post" && (category._ref == $id || $id in otherCategories[]._ref)')
                        .params({id: categoryId})
                        .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                    ),
                ),
              S.listItem()
                .title('За авторами')
                .child(
                  S.documentTypeList('author')
                    .title('Автори')
                    .child((authorId) =>
                      S.documentList()
                        .title('Статті автора')
                        .schemaType('post')
                        .filter('_type == "post" && author._ref == $id')
                        .params({id: authorId})
                        .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                    ),
                ),
            ]),
        ),
      S.documentTypeListItem('author').title('Автори'),
      S.documentTypeListItem('category').title('Розділи'),
      // Series are not used on this site: shown only in advanced mode.
      ...(ADVANCED ? [S.documentTypeListItem('series').title('Серії')] : []),
      S.documentTypeListItem('page').title('Сторінки'),
      S.divider(),
      S.listItem()
        .title('Повідомлення')
        .icon(EnvelopeIcon)
        .child(
          S.documentTypeList('contactMessage')
            .title('Повідомлення')
            .defaultOrdering([{field: 'createdAt', direction: 'desc'}]),
        ),
      S.documentTypeListItem('subscriber').title('Підписники'),
      S.divider(),
      singleton(S, 'homePage', 'Головна сторінка', HomeIcon),
      singleton(S, 'siteSettings', 'Налаштування сайту', CogIcon),
      S.documentTypeListItem('redirect').title('Переадресації').icon(TransferIcon),
    ])
