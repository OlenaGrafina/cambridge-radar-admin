import {CogIcon} from '@sanity/icons/Cog'
import {CommentIcon} from '@sanity/icons/Comment'
import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {HomeIcon} from '@sanity/icons/Home'
import {TransferIcon} from '@sanity/icons/Transfer'
import type {StructureResolver} from 'sanity/structure'

const singleton = (S: Parameters<StructureResolver>[0], type: string, title: string, icon: typeof HomeIcon) =>
  S.listItem()
    .title(title)
    .id(type)
    .icon(icon)
    .child(S.document().schemaType(type).documentId(type).title(title))

const comments = (S: Parameters<StructureResolver>[0], title: string, filter: string) =>
  S.documentList()
    .title(title)
    .schemaType('comment')
    .filter(`_type == "comment" && ${filter}`)
    .defaultOrdering([{field: 'createdAt', direction: 'desc'}])

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Cambridge Radar')
    .items([
      S.listItem()
        .title('Articles')
        .icon(DocumentTextIcon)
        .child(
          S.list()
            .title('Articles')
            .items([
              S.listItem()
                .title('All articles')
                .icon(DocumentTextIcon)
                .child(
                  S.documentTypeList('post')
                    .title('All articles')
                    .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                ),
              S.listItem()
                .title('By section')
                .child(
                  S.documentTypeList('category')
                    .title('Sections')
                    .defaultOrdering([{field: 'order', direction: 'asc'}])
                    .child((categoryId) =>
                      S.documentList()
                        .title('Articles')
                        .schemaType('post')
                        .filter(
                          '_type == "post" && (category._ref == $id || $id in otherCategories[]._ref)',
                        )
                        .params({id: categoryId})
                        .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                    ),
                ),
              S.listItem()
                .title('By author')
                .child(
                  S.documentTypeList('author')
                    .title('Authors')
                    .child((authorId) =>
                      S.documentList()
                        .title('Articles')
                        .schemaType('post')
                        .filter('_type == "post" && author._ref == $id')
                        .params({id: authorId})
                        .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                    ),
                ),
            ]),
        ),
      S.documentTypeListItem('author').title('Authors'),
      S.documentTypeListItem('category').title('Sections'),
      S.documentTypeListItem('series').title('Series'),
      S.documentTypeListItem('page').title('Pages'),
      S.divider(),
      S.listItem()
        .title('Comments')
        .icon(CommentIcon)
        .child(
          S.list()
            .title('Comments')
            .items([
              S.listItem()
                .title('Waiting for review')
                .icon(CommentIcon)
                .child(comments(S, 'Waiting for review', 'status == "pending"')),
              S.listItem()
                .title('Published')
                .child(comments(S, 'Published', 'status == "approved"')),
              S.listItem()
                .title('Rejected & spam')
                .child(comments(S, 'Rejected & spam', 'status in ["rejected", "spam"]')),
              S.divider(),
              S.listItem().title('All comments').child(comments(S, 'All comments', 'true')),
            ]),
        ),
      S.listItem()
        .title('Messages')
        .icon(EnvelopeIcon)
        .child(
          S.documentTypeList('contactMessage')
            .title('Messages')
            .defaultOrdering([{field: 'createdAt', direction: 'desc'}]),
        ),
      S.documentTypeListItem('subscriber').title('Subscribers'),
      S.divider(),
      singleton(S, 'homePage', 'Home page', HomeIcon),
      singleton(S, 'siteSettings', 'Site settings', CogIcon),
      S.documentTypeListItem('redirect').title('Redirects').icon(TransferIcon),
    ])
