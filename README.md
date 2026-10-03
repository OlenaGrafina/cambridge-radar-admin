# Cambridge Radar — адмінка

Sanity Studio для [cambridge-radar.com](https://cambridge-radar.com). Сайт — репозиторій
**cambridge-radar-frontend**.

> Документ для розробників. Інструкція для редакції — окремий PDF «Інструкція з користування сайтом».

- Sanity: проєкт `polcbwiw`, датасет `production` (публічне читання).
- Адмінка: https://cambridge-radar.sanity.studio (вхід через Google / GitHub / email акаунт Sanity).
- Користувачі додаються в sanity.io/manage → проєкт → Members → Invite.
- Автори статей не мають входу: редакція веде картки авторів і вибирає автора в статті.

## Запуск і деплой

```bash
npm install
npm run dev       # http://localhost:3333
npm run deploy    # опублікувати адмінку на cambridge-radar.sanity.studio
```

Перед деплоєм бажано задати адресу сайту для кнопки «Відкрити на сайті»:
`SANITY_STUDIO_SITE_URL=https://cambridge-radar.com npm run deploy`.

## Мова і «Розширений режим»

Інтерфейс українською (`@sanity/locale-uk-ua`), усі назви полів і підказки — у схемах.
Кнопка **«Розширений режим»** вгорі (`studio/advanced.ts`, `studio/components.tsx`) вмикає все, що
приховано за замовчуванням: релізи, планування, завдання, коментарі, Canvas, Media Library,
Vision, англійську мову і кнопку тарифів Sanity. Вибір зберігається в браузері.

## Що де

| Меню | Тип | Файл |
|---|---|---|
| Статті | `post` | `schemaTypes/documents/post.ts` |
| Автори | `author` | `schemaTypes/documents/author.ts` |
| Розділи | `category` | `schemaTypes/documents/taxonomy.ts` |
| Сторінки | `page` | `schemaTypes/documents/page.ts` |
| Повідомлення, Підписники | `contactMessage`, `subscriber` | `schemaTypes/documents/inbox.ts` |
| Головна сторінка | singleton `homePage` | `schemaTypes/singletons/homePage.ts` |
| Налаштування сайту | singleton `siteSettings` | `schemaTypes/singletons/siteSettings.ts` |
| Переадресації | `redirect` | `schemaTypes/documents/redirect.ts` |
| (у розширеному режимі) Серії | `series` | `schemaTypes/documents/taxonomy.ts` |

Бокове меню — `structure/index.ts`. Текст статті, зображення, цитати, відео — `schemaTypes/objects/`.

Коли додаєте поле: схема тут → запит і тип у сайті (`src/lib/sanity/queries.ts`, `types.ts`) → компонент.

## Імпорт із WordPress

`scripts/import-wp.mjs` переніс статті, профілі, розділи, сторінки, зображення й переадресації зі
старого сайту. Скрипт ідемпотентний (фіксовані id, зображення без дублів):

```bash
npm run import:wp            # пробний прогін
npm run import:wp -- --apply # запис у датасет
```

## Вебхук

sanity.io/manage → API → Webhooks: URL `https://<домен>/api/revalidate`, усі документи,
create/update/delete, projection `{_id, _type}`, secret = `SANITY_REVALIDATE_SECRET` сайту.
Скидає кеш сайту після кожної публікації й запускає розсилку для нової статті.
