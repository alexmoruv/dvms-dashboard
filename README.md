# 🏛️ Мониторинг международной деловой активности Москвы

## 🚀 Запуск (3 шага)

### 1. Установите зависимости
```bash
npm install
```

### 2. Получите API-ключ Gigachat (Сбер)
- Перейдите на https://lk.sber.ru/
- Авторизуйтесь или зарегистрируйтесь (бесплатно)
- Перейдите в **Компании** → **API** → **Gigachat**
- Скопируйте **API ключ**

### 3. Создайте файл .env
```bash
cp .env.example .env
```
Отредактируйте `.env` и вставьте API ключ:
```
VITE_GIGACHAT_API_KEY=ВАШ_КЛЮЧ_ЗДЕСЬ
VITE_TAVILY_API_KEY=dummy_или_реальный_ключ
```

### 4. Запустите
```bash
npm run dev
```
Откроется браузер: http://localhost:5173

---

## 📋 Вкладки приложения

| Вкладка | Что делает |
|---------|-----------|
| **Парсер** | Tavily ищет мероприятия через Gigachat в 10 источниках |
| **Excel** | Загрузка .xlsx, Gigachat нормализует колонки автоматически |
| **Слияние** | Объединяет данные, удаляет дубли |
| **Дашборд** | Сводный реестр с фильтрами и экспортом в Excel |

## 📡 Источники парсинга

**Сайты:** mos.ru, moscow-export.com

**Telegram-каналы:**
@DtRoad · @anomcic · @rustorgpred · @MoscowEcon
@dit_moscow · @moscowexport · @subsidii_msk · @investmoscowru

## 🛠️ Технический стек

- **Frontend:** React 18 + Vite
- **AI обработка:** Gigachat (Сбер) + Tavily Search
- **Визуализация:** recharts, react-simple-maps
- **Экспорт:** jsPDF, html2canvas, XLSX
- **Развёртывание:** GitHub Pages

