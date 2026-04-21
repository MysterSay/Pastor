# Support Site

## Що всередині
- `index.html` — структура сторінки
- `styles.css` — стилі
- `app.js` — фронтенд логіка, рендер карток, пошук, випадкова анкета
- `notion-proxy-example.js` — приклад JS-проксі для Notion API

## Важливо
GitHub Pages сам по собі не вміє безпечно тримати runtime API secrets.
Тому фронтенд очікує API `/api/profiles`, а не звертається до Notion напряму.

## Логіка відбору
На сайт потрапляють тільки записи, де поле `Position:` дорівнює `Готово`.

## Формат нормалізованої відповіді API
```json
{
  "items": [
    {
      "id": "page-id",
      "name": "Ім'я",
      "age": "24",
      "maritalStatus": "Одружений",
      "placeOfMinistry": "Київ",
      "church": "Назва церкви",
      "position": "Готово",
      "note": "Коротка нотатка",
      "text": "Розгорнутий текст",
      "photo": "https://...",
      "createdTime": "2026-04-20T10:20:30.000Z",
      "isReady": true
    }
  ]
}
```

## Як підключити
1. Розгорни фронтенд статично.
2. Розгорни JS-проксі окремо.
3. У фронтенді задай:
```html
<script>
  window.APP_CONFIG = {
    apiBaseUrl: "https://your-domain.example/api/profiles"
  };
</script>
```
перед `app.js`.
