# Brandmaster

Платформа для прохождения стратегии личного бренда — 7 блоков, AI-рекомендации, банк идей и контент-календарь.

## Стэк

- Frontend: HTML/CSS/JS (single-page прототип в `public/index.html`)
- Backend: Node.js + Express (ES-модули)
- База + Auth: Supabase (Postgres + Auth)
- AI: Anthropic Claude (`claude-sonnet-4-20250514`) через серверный прокси `/api/ai`

## Структура

```
.
├── server.js              Express-сервер, статика + API
├── package.json
├── .env.example           шаблон переменных окружения
├── api/
│   ├── ai.js              прокси к Anthropic (рекомендации, идеи, summary, задачи)
│   ├── answers.js         CRUD ответов стратегии (Supabase + mock-режим)
│   └── auth.js            заглушки auth.signUp / signInWithPassword
├── db/
│   └── schema.sql         схема Postgres + RLS-политики
└── public/
    └── index.html         прототип интерфейса (тот, что мы собрали в Cowork)
```

## Запуск локально

```bash
# 1. зависимости
npm install

# 2. переменные окружения
cp .env.example .env
# открой .env и впиши настоящие ключи (минимум — ANTHROPIC_API_KEY)

# 3. запуск
npm run dev   # с auto-reload
# или
npm start
```

Открой `http://localhost:3000` — фронтенд раздаётся из `public/`.

Если `.env` пуст, всё работает в **mock-режиме**: AI-эндпоинты вернут ошибку, ответы стратегии хранятся в памяти процесса (исчезают при рестарте). Это удобно для проверки UI без настройки Supabase и Anthropic.

## Настройка Supabase

1. Создай проект на https://supabase.com
2. Открой SQL Editor и прогони `db/schema.sql`
3. В Settings → API скопируй `URL`, `anon key`, `service_role key` в `.env`
4. В Auth → Providers включи Email (можно потом добавить OAuth)

После этого:

- регистрация/логин идут через `supabase.auth.signInWithPassword` (либо через `/api/auth/signin`),
- ответы стратегии автоматически летят в таблицу `strategy_answers`,
- RLS-политики гарантируют, что каждый участник видит только свои данные,
- админская роль (`profiles.role = 'admin'`) видит всех участников.

## Настройка Anthropic

1. https://console.anthropic.com → Settings → API Keys → Create Key
2. Скопируй ключ (`sk-ant-…`) в `.env` → `ANTHROPIC_API_KEY`
3. По желанию замени `ANTHROPIC_MODEL` (по умолчанию `claude-sonnet-4-20250514`)

## API

| Метод | Путь                          | Что делает                                  |
| ----- | ----------------------------- | ------------------------------------------- |
| GET   | `/api/health`                 | статус + какие переменные окружения видны   |
| POST  | `/api/auth/signup`            | регистрация (email/password)                |
| POST  | `/api/auth/signin`            | вход (email/password)                       |
| GET   | `/api/answers?userId=…`       | все ответы стратегии пользователя           |
| PUT   | `/api/answers`                | сохранить один ответ блока                  |
| POST  | `/api/ai/recommendations`     | 5–6 рекомендаций по стратегии (JSON)        |
| POST  | `/api/ai/ideas`               | 8 идей под выбранную вкладку (JSON)         |
| POST  | `/api/ai/block-summary`       | резюме блока в 4–6 предложений              |
| POST  | `/api/ai/suggest-tasks`       | 5 задач на неделю по стратегии (JSON)       |

Все AI-эндпоинты ожидают `{ context }` — объект с ответами стратегии — и возвращают строгий JSON.

## Деплой

Самый быстрый путь — Replit (вариант A из брифа):

1. Создай Repl из этого репозитория
2. Добавь переменные окружения в Secrets
3. Run → Replit поднимет сервер автоматически
4. Подключи свой домен (опционально)

Для Vercel/Render — структура та же, нужен только `vercel.json` или `render.yaml`. Скажи, если надо — добавим.

## Roadmap

- [x] Прототип UI (RU-локализация, все 7 блоков, weekly tasks, ideas bank, calendar, summary)
- [x] Express-сервер + AI-прокси (4 эндпоинта)
- [x] Supabase-схема + RLS
- [ ] Подключить фронт к `/api/answers` (вместо localStorage)
- [ ] Реальная регистрация через Supabase Auth (страница `/auth`)
- [ ] Подключить AI-кнопки прототипа к `/api/ai/*`
- [ ] Админ-панель `/admin` со списком участников и их прогрессом
- [ ] Анализ профиля Instagram (загрузка скриншотов + Claude Vision)
- [ ] Генератор контента: шаблонные карусели + сторис
- [ ] Stripe-подписка для платных групп
