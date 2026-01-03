# Настройка Firestore Rules

Для работы с персонажами необходимо настроить правила безопасности Firestore.

## Способ 1: Через Firebase Console (Рекомендуется)

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Выберите проект `dnd-online-3e483`
3. Перейдите в раздел **Firestore Database**
4. Откройте вкладку **Rules**
5. Скопируйте содержимое файла `firestore.rules` и вставьте в редактор правил
6. Нажмите **Publish** для применения правил

## Способ 2: Через Firebase CLI

Если у вас установлен Firebase CLI:

```bash
# Установите Firebase CLI (если еще не установлен)
npm install -g firebase-tools

# Войдите в Firebase
firebase login

# Инициализируйте проект (если еще не инициализирован)
firebase init firestore

# Примените правила
firebase deploy --only firestore:rules
```

## Индексы

Firestore может потребовать создать индексы для запросов. Если вы получите ошибку о необходимости индекса:

1. Откройте Firebase Console
2. Перейдите в **Firestore Database** → **Indexes**
3. Нажмите на ссылку в ошибке или создайте индекс вручную:
   - Collection: `characters`
   - Fields: `userId` (Ascending), `createdAt` (Descending)
   - Query scope: Collection

Альтернативно, используйте файл `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

## Проверка правил

После применения правил вы сможете:
- ✅ Создавать персонажей (только свои)
- ✅ Читать своих персонажей
- ✅ Обновлять своих персонажей
- ✅ Удалять своих персонажей
- ✅ Читать любого персонажа по tokenId (для просмотра характеристик)
