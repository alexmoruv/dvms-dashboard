import { useState, useRef, useCallback, useMemo } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import * as XLSX from "xlsx";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const C = {
  bg:       "#080c14",
  surface:  "#0e1420",
  panel:    "#131c2e",
  border:   "#1d2d45",
  accent:   "#d4a843",
  accentDim:"#9a7630",
  blue:     "#3b82f6",
  teal:     "#2dd4bf",
  green:    "#22c55e",
  orange:   "#f97316",
  red:      "#ef4444",
  muted:    "#4b5e7a",
  dim:      "#6b7e99",
  text:     "#dce6f5",
  textSub:  "#8da0b8",
};

const SOURCES = [
  // ── Официальные сайты
  { id: "mos",        label: "mos.ru",                    url: "https://www.mos.ru",              icon: "🏛️", group: "Сайты" },
  { id: "mec_site",   label: "Moscow Export Center",      url: "https://moscow-export.com",       icon: "📦", group: "Сайты" },
  // ── Telegram-каналы
  { id: "dtroad",     label: "Дептранс Москвы",           url: "https://t.me/DtRoad",             icon: "🚇", group: "Telegram" },
  { id: "anomcic",    label: "АНО МЦиК",                  url: "https://t.me/anomcic",            icon: "🤝", group: "Telegram" },
  { id: "rustorg",    label: "Деппред (торговля)",         url: "https://t.me/rustorgpred",        icon: "🏪", group: "Telegram" },
  { id: "moscon",     label: "Мэрия / Экономика",         url: "https://t.me/MoscowEcon",         icon: "💼", group: "Telegram" },
  { id: "dit",        label: "ДИТ Москвы",                url: "https://t.me/dit_moscow",         icon: "💻", group: "Telegram" },
  { id: "moscowexp",  label: "Московский экспортный центр",url: "https://t.me/moscowexport",      icon: "📤", group: "Telegram" },
  { id: "subsidii",   label: "Субсидии МСК",              url: "https://t.me/subsidii_msk",       icon: "💰", group: "Telegram" },
  { id: "invest",     label: "Инвест Москва",             url: "https://t.me/investmoscowru",     icon: "📈", group: "Telegram" },
];


// ─── COUNTRY COORDINATES ─────────────────────────────────────────────────────
const COUNTRY_COORDS = {
  "ОАЭ":       [55.3, 25.2], "Китай":     [104.1, 35.8], "Германия":  [10.4, 51.1],
  "Испания":   [-3.7, 40.4], "Франция":   [2.3, 48.8],   "Индия":     [78.9, 20.5],
  "Казахстан": [66.9, 48.0], "Беларусь":  [27.9, 53.7],  "Турция":    [35.2, 39.9],
  "Египет":    [30.8, 26.8], "Иран":      [53.6, 32.4],  "Бразилия":  [-47.9, -15.7],
  "Италия":    [12.5, 41.9], "Нидерланды":[5.3, 52.1],   "Сингапур":  [103.8, 1.3],
  "Япония":    [138.2, 36.2],"Корея":     [127.7, 35.9], "Вьетнам":   [108.2, 14.0],
  "Таиланд":   [100.9, 15.8],"Малайзия":  [109.7, 4.2],  "Саудовская Аравия":[45.0,24.0],
  "Катар":     [51.2, 25.3], "Бахрейн":   [50.5, 26.0],  "Кувейт":    [47.5, 29.3],
  "Азербайджан":[47.5,40.1], "Армения":   [44.5, 40.1],  "Узбекистан":[63.9, 41.3],
  "США":       [-95.7, 37.1],"Великобритания":[-3.4,55.4],"Польша":   [19.1, 51.9],
  "Венгрия":   [19.5, 47.1], "Сербия":    [21.0, 44.0],  "Греция":    [21.8, 39.0],
  "Финляндия": [25.7, 61.9], "Швеция":    [18.6, 60.1],  "Норвегия":  [8.4, 60.4],
  "Дания":     [10.0, 56.2], "Австрия":   [14.5, 47.5],  "Швейцария": [8.2, 46.8],
  "Израиль":   [34.8, 31.0], "Марокко":   [-7.0, 31.8],  "Алжир":     [3.0, 36.7],
  "ЮАР":       [25.0,-29.0], "Нигерия":   [8.6, 9.0],    "Эфиопия":   [38.7, 9.1],
  "Аргентина": [-63.6,-38.4],"Мексика":   [-102.5,23.6], "Куба":      [-79.5, 21.5],
  "Пакистан":  [69.3, 30.4], "Бангладеш": [90.3, 23.7],  "Шри-Ланка": [80.7, 7.8],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

function Tag({ label, color = C.accent }) {
  return (
    <span style={{
      display:"inline-block", padding:"2px 8px", borderRadius:4,
      fontSize:11, fontWeight:700, letterSpacing:0.4,
      background: color + "22", color, border:`1px solid ${color}44`,
    }}>{label}</span>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", small }) {
  const colors = {
    primary:  { bg: C.accent,  fg: "#000"    },
    secondary:{ bg: C.border,  fg: C.text    },
    danger:   { bg: C.red,     fg: "#fff"    },
    ghost:    { bg: "transparent", fg: C.dim },
  };
  const c = colors[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? C.muted : c.bg,
      color: disabled ? "#666" : c.fg,
      border: "none", borderRadius:6, cursor: disabled ? "not-allowed" : "pointer",
      padding: small ? "5px 12px" : "9px 18px",
      fontSize: small ? 12 : 13, fontWeight:700,
      fontFamily:"'IBM Plex Mono', monospace",
      transition:"opacity .15s",
      opacity: disabled ? .6 : 1,
    }}>{children}</button>
  );
}

function Log({ lines }) {
  const ref = useRef(null);
  return (
    <div ref={ref} style={{
      background: C.bg, border:`1px solid ${C.border}`, borderRadius:8,
      padding:"12px 16px", fontFamily:"'IBM Plex Mono', monospace",
      fontSize:11, color: C.teal, height:160, overflowY:"auto",
      lineHeight:1.7,
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.startsWith("✅") ? C.green : l.startsWith("⚠️") ? C.orange : l.startsWith("❌") ? C.red : C.teal }}>
          {l}
        </div>
      ))}
    </div>
  );
}

// ─── EXCEL PARSER ─────────────────────────────────────────────────────────────
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type:"binary", cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
        resolve(rows);
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ─── GIGACHAT API CALL ────────────────────────────────────────────────────────
let gigachatTokenCache = { token: null, expiresAt: 0 };

async function getGigachatToken(apiKey, rquid) {
  const now = Date.now();
  if (gigachatTokenCache.token && gigachatTokenCache.expiresAt > now) {
    return gigachatTokenCache.token;
  }

  const credentials = btoa(`${apiKey}:`);
  const res = await fetch("https://auth.api.sberbank.ru/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "RqUID": rquid,
      "Authorization": `Basic ${credentials}`,
    },
    body: "scope=GIGACHAT_API_PERS&grant_type=client_credentials",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Ошибка авторизации Gigachat: ${res.status} - ${error}`);
  }

  const data = await res.json();
  gigachatTokenCache.token = data.access_token;
  gigachatTokenCache.expiresAt = now + (data.expires_in * 1000 - 60000); // refresh 1 min before expiry
  return data.access_token;
}

async function callGigachat({ system, userMsg, maxTokens = 4000 }) {
  const apiKey = import.meta.env.VITE_GIGACHAT_API_KEY || "";
  if (!apiKey) throw new Error("Ключ Gigachat не найден. Проверьте файл .env — там должна быть строка VITE_GIGACHAT_API_KEY=ваш_ключ");

  const rquid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const token = await getGigachatToken(apiKey, rquid);

  const messages = [];
  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: userMsg });

  const body = {
    model: "GigaChat",
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  const res = await fetch("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Client-ID": rquid,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gigachat API error ${res.status}: ${error}`);
  }

  const data = await res.json();
  
  // Convert Gigachat response format to Claude-compatible format
  return {
    content: [
      {
        type: "text",
        text: data.choices?.[0]?.message?.content || "",
      }
    ]
  };
}

// ─── PERIOD HELPER ────────────────────────────────────────────────────────────
function periodLabel(p) {
  const MONTHS_RU = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
  const MONTHS_EN = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  if (p.mode === "month") return `${MONTHS_RU[+p.month-1]} ${p.year} ${MONTHS_EN[+p.month-1]} ${p.year}`;
  if (p.mode === "quarter") return `${p.year} Q${p.quarter} квартал`;
  return `${p.year}`;
}

// ─── TAVILY SEARCH ────────────────────────────────────────────────────────────
async function tavilySearch(query, addLog) {
  const apiKey = import.meta.env.VITE_TAVILY_API_KEY || "";
  if (!apiKey) throw new Error("Ключ Tavily не найден. Добавьте VITE_TAVILY_API_KEY в файл .env");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 8,
      include_answer: true,
    }),
  });
  if (!res.ok) throw new Error(`Tavily error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.results || [];
}

// ─── WEB SEARCH + PARSE AGENT ─────────────────────────────────────────────────
async function runWebAgent(sources, addLog, period = { mode:"year", year:"2025" }) {
  addLog("🔍 Запускаю агент парсинга источников...");
  const tgSources = sources.filter(s => s.url.includes("t.me"));
  const pLabel = periodLabel(period);

  // Build queries ONLY for selected sources
  const siteSources = sources.filter(s => !s.url.includes("t.me"));
  const queries = [
    // Site sources — multiple targeted queries per site
    ...siteSources.flatMap(s => {
      if (s.url.includes("mos.ru")) return [
        "mos.ru бизнес-миссия международный " + pLabel,
        "mos.ru выставка делегация зарубеж " + pLabel,
        "правительство москвы международное мероприятие форум " + pLabel,
      ];
      if (s.url.includes("moscow-export.com")) return [
        "московский экспортный центр бизнес-миссия " + pLabel,
        "made in moscow выставка " + pLabel,
        "moscow export center международный " + pLabel,
      ];
      return ["site:" + s.url.replace(/https?:\/\//, "") + " выставка международный " + pLabel];
    }),
    // TG sources — search by channel name without site: restriction
    ...tgSources.flatMap(s => {
      const handle = s.url.replace("https://t.me/", "");
      const label = s.label || handle;
      return [
        "tgstat " + handle + " бизнес-миссия выставка " + pLabel,
        "@" + handle + " международный мероприятие делегация " + pLabel,
        label + " выставка форум " + pLabel,
      ];
    }),
    // Custom sources
    ...sources.filter(s => s.group === "Свои").flatMap(s => {
      if (s.url.includes("t.me/")) {
        const handle = s.url.replace(/.*t\.me\//, "");
        return ["tgstat " + handle + " выставка бизнес-миссия " + pLabel, "@" + handle + " международный " + pLabel];
      }
      return ["site:" + s.url.replace(/https?:\/\//, "") + " выставка бизнес-миссия " + pLabel];
    }),
  ].filter(Boolean);

  addLog("🌐 Запускаю " + queries.length + " поисковых запросов через Tavily...");

  let allResults = [];
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);
    addLog("🔎 Batch " + (Math.floor(i/3)+1) + "/" + Math.ceil(queries.length/3) + ": " + batch[0].slice(0,50) + "...");
    const results = await Promise.all(
      batch.map(q => tavilySearch(q, addLog).catch(e => {
        addLog("⚠️ Запрос не удался: " + e.message.slice(0,60));
        return [];
      }))
    );
    allResults = [...allResults, ...results.flat()];
    addLog("📄 Фрагментов собрано: " + allResults.length);
  }

  const seen = new Set();
  const unique = allResults.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  addLog("🗂️ Уникальных источников: " + unique.length);

  if (unique.length === 0) {
    addLog("⚠️ Tavily не нашёл результатов. Проверьте ключ VITE_TAVILY_API_KEY в .env");
    return [];
  }

  addLog("🤖 Передаю данные в AI для структурирования...");

  const system = `Ты агент извлечения данных о международной деловой активности города Москвы.
Из предоставленных фрагментов веб-страниц и постов Telegram (через tgstat.ru) извлеки все мероприятия.
Верни ТОЛЬКО JSON-массив. Каждый объект:
{
  "name": "Название мероприятия",
  "type": "Выставка|Бизнес-миссия|Форум|Входящая бизнес-миссия",
  "direction": "abroad|moscow",
  "country": "Страна (для abroad, иначе Россия)",
  "city": "Город",
  "date": "ГГГГ-ММ-ДД или квартал/год",
  "participants": null,
  "organizer": "Организатор",
  "result": "Краткий итог",
  "industry": ["отрасль"],
  "status": "Завершено|Планируется",
  "source": "название канала или сайта",
  "source_url": "прямая ссылка на пост или страницу"
}
Включай ТОЛЬКО уже состоявшиеся мероприятия (прошедшее время, есть результат, дата в прошлом).
Пропускай анонсы, планируемые мероприятия и не связанные с деловой активностью Москвы.
Верни ТОЛЬКО JSON-массив без пояснений и markdown.`;

  // Claude Haiku: 200k context — pass all results, 600 chars each
  const context = unique.map(r => "URL: " + r.url + "\n" + r.title + "\n" + (r.content || "").slice(0, 600) + "\n---").join("\n");
  addLog("📋 Передаю " + unique.length + " фрагментов в Claude Haiku...");

  const data = await callGigachat({
    system,
    userMsg: "Период: " + pLabel + "\n\nИзвлеки мероприятия из этих результатов:\n\n" + context,
    maxTokens: 4000,
  });

  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  // Strip markdown code fences first
  const cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Robust JSON extraction with multiple fallbacks
  let events = [];
  try {
    // Try 1: full text is valid JSON array
    events = JSON.parse(cleanText.trim());
  } catch(_) {
    try {
      // Try 2: find first [...] block (greedy)
      const m = cleanText.match(/\[\s*\{[\s\S]*\}/);
      const cleaned = m ? m[0].replace(/,\s*$/, '') + ']' : '[]';
      events = JSON.parse(cleaned);
    } catch(_) {
      // Try 3: extract individual objects one by one
      const rx = /\{[^\[\]]*?"name"\s*:[^\[\]]*?\}/g;
      for (const om of (cleanText.matchAll ? cleanText.matchAll(rx) : [])) {
        try { events.push(JSON.parse(om[0])); } catch(_) {}
      }
    }
  }
  if (!Array.isArray(events)) events = [];
  if (events.length === 0) {
    addLog("⚠️ Не удалось извлечь мероприятия. Ответ AI: " + cleanText.slice(0, 200));
    return [];
  }
  addLog("✅ Найдено " + events.length + " мероприятий");
  return events.map(e => ({ ...e, _id: uid(), _src: "web" }));
}


// ─── EXCEL NORMALIZE AGENT ────────────────────────────────────────────────────
async function normalizeExcelAgent(rows, addLog) {
  addLog(`📊 Нормализую ${rows.length} строк из Excel через агента...`);

  const system = `Ты агент нормализации данных. Получаешь строки из Excel-файла с мероприятиями.
Приведи к единому формату и верни ТОЛЬКО JSON-массив:
{
  "name": "Название",
  "type": "Выставка|Бизнес-миссия|Форум|Входящая бизнес-миссия",
  "direction": "abroad|moscow",
  "country": "Страна",
  "city": "Город",
  "date": "ГГГГ-ММ-ДД или текст",
  "participants": число или null,
  "organizer": "Организатор",
  "result": "Итог",
  "industry": ["отрасль"],
  "status": "Завершено|Планируется",
  "source": "Excel"
}
Распознай колонки самостоятельно — названия могут быть на русском или английском.
Возвращай ТОЛЬКО JSON без пояснений.`;

  const data = await callGigachat({
    system,
    userMsg: `Нормализуй эти данные из Excel:\n${JSON.stringify(rows.slice(0, 100), null, 2)}`,
    maxTokens: 4000,
  });

  const text = data.content.filter(b => b.type==="text").map(b=>b.text).join("\n");
  const match = text.match(/(\[(?:[\s\S])*?\])/);
  if (!match) { addLog("⚠️ Не удалось нормализовать Excel данные"); return []; }

  try {
    const events = JSON.parse(match[0]);
    addLog(`✅ Нормализовано ${events.length} записей из Excel`);
    return events.map(e => ({ ...e, _id: uid(), _src: "excel" }));
  } catch {
    addLog("❌ Ошибка парсинга нормализованных Excel-данных");
    return [];
  }
}

// ─── DEDUP MERGE AGENT ────────────────────────────────────────────────────────
async function mergeAndDedup(webEvents, excelEvents, addLog) {
  addLog(`🤖 Запускаю агент слияния: ${webEvents.length} веб + ${excelEvents.length} Excel...`);

  const system = `Ты агент дедупликации данных о международных мероприятиях.
Получаешь два массива: из веб-парсера и из Excel.
Твоя задача — объединить их в один список БЕЗ дублей.

Дубль — это когда название похоже (>70% совпадение), дата ±30 дней и страна/город совпадают.
При дубле: сохрани более полную запись, добавь поле "_sources": ["web","excel"].

Верни JSON объект:
{
  "merged": [ ...массив объединённых событий... ],
  "duplicates_found": число,
  "report": "краткое описание что было слито"
}

В каждом событии сохраняй все поля оригинала + "_sources".
ТОЛЬКО JSON, без пояснений.`;

  const data = await callGigachat({
    system,
    userMsg: `
Массив из веб-парсера (${webEvents.length} шт):
${JSON.stringify(webEvents, null, 2)}

Массив из Excel (${excelEvents.length} шт):
${JSON.stringify(excelEvents, null, 2)}

Объедини и удали дубли.`,
    maxTokens: 6000,
  });

  const text = data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
  const match = text.match(/(\{(?:[\s\S])*?\})/);
  if (!match) { addLog("⚠️ Агент слияния не вернул валидный JSON"); return [...webEvents, ...excelEvents]; }

  try {
    const result = JSON.parse(match[0]);
    const dupes = result.duplicates_found || 0;
    addLog(`✅ Слияние завершено: ${result.merged?.length} уникальных мероприятий, удалено дублей: ${dupes}`);
    if (result.report) addLog(`📋 ${result.report}`);
    return (result.merged || []).map(e => ({ ...e, _id: e._id || uid() }));
  } catch {
    addLog("❌ Ошибка парсинга результата слияния");
    return [...webEvents, ...excelEvents];
  }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ─── PASSWORD GATE ────────────────────────────────────────────────────────────
const APP_PASSWORD = "dvms2025";

function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const check = () => {
    if (input === APP_PASSWORD) { onUnlock(); }
    else { setError(true); setTimeout(() => setError(false), 1500); }
  };
  return (
    <div style={{ background: C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'IBM Plex Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:16, padding:"48px 40px", textAlign:"center", width:360 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⭐</div>
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700, color: C.accent, marginBottom:4 }}>
          ДВМС
        </div>
        <div style={{ fontSize:13, color: C.dim, marginBottom:32 }}>
          Мониторинг международной деловой активности
        </div>
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && check()}
          placeholder="Введите пароль"
          autoFocus
          style={{
            width:"100%", padding:"12px 16px", borderRadius:8, fontSize:14,
            background: C.bg, border:`2px solid ${error ? C.red : input ? C.accent : C.border}`,
            color: C.text, outline:"none", fontFamily:"inherit", boxSizing:"border-box",
            transition:"border-color .2s",
          }}
        />
        {error && <div style={{ color: C.red, fontSize:12, marginTop:8 }}>Неверный пароль</div>}
        <button onClick={check} style={{
          marginTop:16, width:"100%", padding:"12px", borderRadius:8,
          background: C.accent, color:"#000", border:"none",
          fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'IBM Plex Mono', monospace",
        }}>Войти</button>
        <div style={{ fontSize:11, color: C.muted, marginTop:20 }}>
          Департамент внешнеэкономических<br/>и международных связей г. Москвы
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("dvms_auth") === "1");
  if (!unlocked) return <PasswordGate onUnlock={() => { sessionStorage.setItem("dvms_auth","1"); setUnlocked(true); }} />;
  const [phase, setPhase]               = useState("idle"); // idle | parsing | excel | merging | done
  const [logs, setLogs]                 = useState([]);
  const [webEvents, setWebEvents]       = useState([]);
  const [excelEvents, setExcelEvents]   = useState([]);
  const [merged, setMerged]             = useState([]);
  const [excelFile, setExcelFile]       = useState(null);
  const [selectedSources, setSelectedSources] = useState(["mos","mec_site"]);
  const [filter, setFilter]             = useState({ type:"all", direction:"all", status:"all", q:"" });
  const [activeTab, setActiveTab]       = useState("excel"); // dashboard | web | excel | merged | analytics
  const [aiSummary, setAiSummary]       = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [prevRun, setPrevRun]           = useState(() => { try { return JSON.parse(localStorage.getItem("moscow_prev_run") || "null"); } catch(_) { return null; } });
  const [customSources, setCustomSources] = useState([]);
  const [newSourceInput, setNewSourceInput] = useState("");
  const [period, setPeriod]             = useState({ mode: "year", year: "2025", quarter: "1", month: "1" });
  const fileRef = useRef(null);
  const dashRef = useRef(null);

  const addLog = useCallback((line) => setLogs(prev => [...prev, line]), []);

  const toggleSource = (id) => setSelectedSources(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  // ── RUN WEB PARSER ──
  const runWebParse = async () => {
    setPhase("parsing");
    setLogs([]);
    try {
      const builtIn = SOURCES.filter(s => selectedSources.includes(s.id));
      const custom = customSources.map(u => ({ id: u, label: u, url: u, icon: "🔗", group: "Свои" }));
      const srcs = [...builtIn, ...custom];
      const events = await runWebAgent(srcs, addLog, period);
      setWebEvents(events);
      setPhase("idle");
      if (events.length > 0) {
        try { localStorage.setItem("moscow_prev_run", JSON.stringify({ date: new Date().toISOString(), events })); } catch(_) {}
      }
    } catch(err) {
      addLog(`❌ Ошибка: ${err.message}`);
      setPhase("idle");
    }
  };

  // ── HANDLE EXCEL UPLOAD ──
  const handleExcel = async (file) => {
    setExcelFile(file);
    setPhase("excel");
    addLog(`📂 Загружаю файл: ${file.name}`);
    try {
      const rows = await parseExcel(file);
      addLog(`📊 Прочитано ${rows.length} строк, запускаю нормализацию...`);
      const normalized = await normalizeExcelAgent(rows, addLog);
      setExcelEvents(normalized);
      setPhase("idle");
    } catch(err) {
      addLog(`❌ Ошибка обработки Excel: ${err.message}`);
      setPhase("idle");
    }
  };


  // ── EXPORT PDF ──
  const exportPDF = async () => {
    const el = dashRef.current;
    if (!el) return;
    setPhase("parsing"); // reuse busy state to show spinner
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#080c14",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -y, imgW, imgH);
        y += pageH;
      }
      const period = "2025";
      pdf.save("moscow_international_activity_" + period + ".pdf");
    } catch(e) {
      console.error("PDF error:", e);
    }
    setPhase("idle");
  };


  // ── GENERATE AI SUMMARY ──
  const generateSummary = async () => {
    const evts = merged.length ? merged : [...webEvents, ...excelEvents];
    if (!evts.length) return;
    setSummaryLoading(true);
    setAiSummary("");
    try {
      const stats = {
        total: evts.length,
        abroad: evts.filter(e => e.direction === "abroad").length,
        moscow: evts.filter(e => e.direction === "moscow").length,
        countries: [...new Set(evts.filter(e=>e.country).map(e=>e.country))],
        topOrgs: Object.entries(evts.reduce((a,e) => { if(e.organizer) a[e.organizer]=(a[e.organizer]||0)+1; return a; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,5),
        topIndustries: Object.entries(evts.reduce((a,e) => { (e.industry||[]).forEach(i => a[i]=(a[i]||0)+1); return a; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,5),
        events: evts.slice(0,30).map(e => e.name + " (" + (e.country||"Москва") + ", " + (e.date||"") + ")")
      };
      const data = await callGigachat({
        system: "Ты аналитик международной деловой активности города Москвы. Пиши чётко, профессионально, по-русски. Используй конкретные цифры и факты из данных.",
        userMsg: "Напиши аналитическое резюме на 250-300 слов на основе этих данных о международной деловой активности Москвы:\n\n" + JSON.stringify(stats, null, 2) + "\n\nСтруктура: 1) Общая картина активности 2) Ключевые направления и страны 3) Отраслевые приоритеты 4) Наиболее активные организаторы 5) Выводы и рекомендации",
        maxTokens: 1000,
      });
      const text = data.content.filter(b => b.type==="text").map(b=>b.text).join("");
      setAiSummary(text);
    } catch(e) {
      setAiSummary("Ошибка генерации резюме: " + e.message);
    }
    setSummaryLoading(false);
  };


  // ── DOWNLOAD EXCEL TEMPLATE ──
  const downloadTemplate = () => {
    const headers = [
      ["Название мероприятия","Тип","Направление","Страна","Город","Дата","Кол-во участников","Организатор","Результат / Итог","Отрасль","Статус","Ссылка на источник"]
    ];
    const examples = [
      ["Arab Health 2025","Выставка","abroad","ОАЭ","Дубай","2025-01-27","12","ДВМС, МЭЦ","Подписано 3 соглашения","Медицина, Биотех","Завершено","https://mos.ru/..."],
      ["Московский урбанистический форум","Форум","moscow","Россия","Москва","2025-07-10","3200","Правительство Москвы","Участие 47 стран","Урбанистика","Завершено","https://mos.ru/..."],
      ["Бизнес-миссия в Китай","Бизнес-миссия","abroad","Китай","Шанхай","2025-02-18","24","МЭЦ","Переговоры с 30+ компаниями","Технологии, Торговля","Завершено",""],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...examples]);
    ws['!cols'] = headers[0].map((h, i) => ({ wch: [30,15,14,12,12,12,10,25,30,20,12,30][i] }));
    // Style header row
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Мероприятия");
    // Add hint sheet
    const hint = XLSX.utils.aoa_to_sheet([
      ["ИНСТРУКЦИЯ ПО ЗАПОЛНЕНИЮ"],
      [""],
      ["Поле","Допустимые значения"],
      ["Тип","Выставка / Бизнес-миссия / Форум / Входящая бизнес-миссия"],
      ["Направление","abroad (выезд за рубеж) / moscow (в Москве)"],
      ["Дата","ГГГГ-ММ-ДД (например 2025-03-15) или текст (Q1 2025)"],
      ["Статус","Завершено / Планируется"],
      ["Отрасль","Через запятую: IT, Медицина, Финансы и т.д."],
      ["",""],
      ["ВАЖНО","Не менять названия колонок в первой строке"],
    ]);
    XLSX.utils.book_append_sheet(wb, hint, "Инструкция");
    XLSX.writeFile(wb, "dvms_events_template.xlsx");
  };

  // ── RUN MERGE ──
  const runMerge = async () => {
    setPhase("merging");
    try {
      const result = await mergeAndDedup(webEvents, excelEvents, addLog);
      setMerged(result);
      setActiveTab("dashboard");
      setPhase("done");
      // Save snapshot for next comparison
      try { localStorage.setItem("moscow_prev_run", JSON.stringify({ date: new Date().toISOString(), events: result })); } catch(_) {}
    } catch(err) {
      addLog(`❌ Ошибка слияния: ${err.message}`);
      setPhase("idle");
    }
  };

  // ── FILTER ──
  const displayEvents = (merged.length ? merged : [...webEvents, ...excelEvents]).filter(e => {
    if (filter.type !== "all" && e.type !== filter.type) return false;
    if (filter.direction !== "all" && e.direction !== filter.direction) return false;
    if (filter.status !== "all" && e.status !== filter.status) return false;
    if (filter.q && !JSON.stringify(e).toLowerCase().includes(filter.q.toLowerCase())) return false;
    return true;
  });

  const abroad = displayEvents.filter(e => e.direction === "abroad");
  const moscow = displayEvents.filter(e => e.direction === "moscow");
  const busy = ["parsing","excel","merging"].includes(phase);

  // ── UI ──
  return (
    <div style={{ background: C.bg, minHeight:"100vh", color: C.text, fontFamily:"'IBM Plex Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600;700&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />

      {/* ── TOPBAR ── */}
      <div style={{ background: C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 28px", display:"flex", alignItems:"center", gap:16, height:58 }}>
        <div style={{ fontSize:22 }}>⭐</div>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:700, color: C.accent, letterSpacing:.3 }}>
            Мониторинг международной деловой активности
          </div>
          <div style={{ fontSize:11, color: C.dim }}>Город Москва · AI-агент сбора и дедупликации данных</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          {["dashboard","analytics","web","excel","merged"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: activeTab===t ? C.accent+"22" : "transparent",
              border:`1px solid ${activeTab===t ? C.accent : C.border}`,
              color: activeTab===t ? C.accent : C.dim,
              borderRadius:6, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer",
              fontFamily:"'IBM Plex Mono', monospace",
            }}>
              {t==="dashboard"?"Дашборд":t==="analytics"?"📊 Аналитика":t==="web"?"Парсер":t==="excel"?"Excel":"Слияние"}
              {t==="web" && webEvents.length > 0 && <span style={{ marginLeft:5, background:C.blue+"44", color:C.blue, borderRadius:10, padding:"1px 6px", fontSize:10 }}>{webEvents.length}</span>}
              {t==="excel" && excelEvents.length > 0 && <span style={{ marginLeft:5, background:C.teal+"44", color:C.teal, borderRadius:10, padding:"1px 6px", fontSize:10 }}>{excelEvents.length}</span>}
              {t==="merged" && merged.length > 0 && <span style={{ marginLeft:5, background:C.green+"44", color:C.green, borderRadius:10, padding:"1px 6px", fontSize:10 }}>{merged.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"24px 28px" }}>


        {/* ════ TAB: АНАЛИТИКА ════ */}
        {activeTab === "analytics" && (
          <FullAnalyticsTab events={merged.length ? merged : [...webEvents, ...excelEvents]} prevRun={prevRun} />
        )}

        {/* ════ TAB: ПАРСЕР ════ */}
        {activeTab === "web" && (
          <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:20 }}>
            {/* Left: source picker */}
            <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
              {/* ── PERIOD PICKER ── */}
              <div style={{ marginBottom:18 }}>
                <div style={{ fontFamily:"'Playfair Display', serif", fontSize:15, fontWeight:700, color: C.accent, marginBottom:10 }}>
                  📅 Период поиска
                </div>
                {/* Mode tabs */}
                <div style={{ display:"flex", gap:4, marginBottom:10 }}>
                  {[["year","Год"],["quarter","Квартал"],["month","Месяц"]].map(([m,l]) => (
                    <button key={m} onClick={() => setPeriod(p => ({...p, mode:m}))} style={{
                      flex:1, padding:"5px 0", fontSize:11, fontWeight:700, borderRadius:5, cursor:"pointer",
                      background: period.mode===m ? C.accent : C.bg,
                      color: period.mode===m ? "#000" : C.dim,
                      border:`1px solid ${period.mode===m ? C.accent : C.border}`,
                      fontFamily:"'IBM Plex Mono', monospace",
                    }}>{l}</button>
                  ))}
                </div>
                {/* Year */}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["2023","2024","2025","2026"].map(y => (
                    <button key={y} onClick={() => setPeriod(p => ({...p, year:y}))} style={{
                      padding:"4px 12px", fontSize:12, fontWeight:700, borderRadius:5, cursor:"pointer",
                      background: period.year===y ? C.accent+"33" : C.bg,
                      color: period.year===y ? C.accent : C.dim,
                      border:`1px solid ${period.year===y ? C.accent : C.border}`,
                      fontFamily:"'IBM Plex Mono', monospace",
                    }}>{y}</button>
                  ))}
                </div>
                {/* Quarter */}
                {period.mode === "quarter" && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    {["1","2","3","4"].map(q => (
                      <button key={q} onClick={() => setPeriod(p => ({...p, quarter:q}))} style={{
                        flex:1, padding:"4px 0", fontSize:12, fontWeight:700, borderRadius:5, cursor:"pointer",
                        background: period.quarter===q ? C.teal+"33" : C.bg,
                        color: period.quarter===q ? C.teal : C.dim,
                        border:`1px solid ${period.quarter===q ? C.teal : C.border}`,
                        fontFamily:"'IBM Plex Mono', monospace",
                      }}>Q{q}</button>
                    ))}
                  </div>
                )}
                {/* Month */}
                {period.mode === "month" && (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4, marginTop:8 }}>
                    {["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"].map((m,i) => (
                      <button key={i} onClick={() => setPeriod(p => ({...p, month:String(i+1)}))} style={{
                        padding:"4px 0", fontSize:11, fontWeight:700, borderRadius:5, cursor:"pointer",
                        background: period.month===String(i+1) ? C.orange+"33" : C.bg,
                        color: period.month===String(i+1) ? C.orange : C.dim,
                        border:`1px solid ${period.month===String(i+1) ? C.orange : C.border}`,
                        fontFamily:"'IBM Plex Mono', monospace",
                      }}>{m}</button>
                    ))}
                  </div>
                )}
                {/* Summary */}
                <div style={{ marginTop:8, fontSize:11, color: C.teal, background: C.teal+"11",
                  border:`1px solid ${C.teal}33`, borderRadius:6, padding:"5px 10px" }}>
                  🔍 Период: <strong>
                    {period.mode==="month" && ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][+period.month-1] + " " + period.year}
                    {period.mode==="quarter" && `Q${period.quarter} ${period.year}`}
                    {period.mode==="year" && period.year}
                  </strong>
                </div>
              </div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:15, fontWeight:700, color: C.accent, marginBottom:10 }}>
                📡 Источники данных
              </div>
              {/* Group: Сайты */}
              {["Сайты","Telegram"].map(group => {
                const groupSrcs = SOURCES.filter(s => s.group === group);
                const allChecked = groupSrcs.every(s => selectedSources.includes(s.id));
                return (
                  <div key={group} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"6px 0", borderBottom:`1px solid ${C.border}`, marginBottom:4 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: group==="Telegram" ? C.teal : C.accent,
                        textTransform:"uppercase", letterSpacing:1 }}>
                        {group === "Telegram" ? "📡 Telegram-каналы" : "🌐 Официальные сайты"}
                      </div>
                      <button onClick={() => {
                        const ids = groupSrcs.map(s=>s.id);
                        setSelectedSources(prev => allChecked
                          ? prev.filter(x => !ids.includes(x))
                          : [...new Set([...prev, ...ids])]);
                      }} style={{ fontSize:10, color: C.dim, background:"transparent", border:"none",
                        cursor:"pointer", textDecoration:"underline" }}>
                        {allChecked ? "снять все" : "выбрать все"}
                      </button>
                    </div>
                    {groupSrcs.map(s => (
                      <label key={s.id} style={{ display:"flex", alignItems:"center", gap:8,
                        padding:"7px 4px", cursor:"pointer", borderRadius:4,
                        background: selectedSources.includes(s.id) ? C.border+"55" : "transparent" }}>
                        <input type="checkbox" checked={selectedSources.includes(s.id)}
                          onChange={() => toggleSource(s.id)}
                          style={{ accentColor: group==="Telegram"?C.teal:C.accent, width:13, height:13 }} />
                        <span style={{ fontSize:15 }}>{s.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color: C.text }}>{s.label}</div>
                          <div style={{ fontSize:10, color: C.dim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.url}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                );
              })}
              {/* ── CUSTOM SOURCES ── */}
              <div style={{ marginTop:4, marginBottom:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#f97316", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
                  🔗 Свои источники
                </div>
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  <input value={newSourceInput} onChange={e => setNewSourceInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newSourceInput.trim()) { const u = newSourceInput.trim().startsWith("http") ? newSourceInput.trim() : "https://" + newSourceInput.trim(); if (!customSources.includes(u)) setCustomSources(p => [...p, u]); setNewSourceInput(""); }}}
                    placeholder="URL или t.me/канал..."
                    style={{ flex:1, background: C.bg, border:`1px solid ${C.border}`, borderRadius:6, color: C.text, padding:"5px 8px", fontSize:11, outline:"none", fontFamily:"inherit" }} />
                  <button onClick={() => { if (!newSourceInput.trim()) return; const u = newSourceInput.trim().startsWith("http") ? newSourceInput.trim() : "https://" + newSourceInput.trim(); if (!customSources.includes(u)) setCustomSources(p => [...p, u]); setNewSourceInput(""); }}
                    style={{ background:"#f97316", color:"#000", border:"none", borderRadius:6, padding:"5px 12px", fontSize:14, fontWeight:700, cursor:"pointer" }}>+</button>
                </div>
                {customSources.map((url, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:6, background: C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:"3px 8px", marginBottom:3 }}>
                    <span style={{ fontSize:10, color: C.textSub, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>🔗 {url}</span>
                    <button onClick={() => setCustomSources(p => p.filter((_,j) => j !== i))} style={{ background:"transparent", border:"none", color: C.red, cursor:"pointer", fontSize:14 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:11, color: C.dim }}>
                  Выбрано источников: <strong style={{ color: C.accent }}>{selectedSources.length + customSources.length}</strong> из {SOURCES.length + customSources.length}
                </div>
                <Btn onClick={runWebParse} disabled={busy || (selectedSources.length + customSources.length) === 0}>
                  {phase==="parsing" ? "⏳ Парсю..." : "🚀 Запустить парсинг"}
                </Btn>
              </div>
              {phase === "parsing" && (
                <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center", color: C.teal, fontSize:12,
                  background: C.teal+"11", border:`1px solid ${C.teal}33`, borderRadius:6, padding:"8px 12px" }}>
                  <span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⏳</span>
                  AI-агент ищет мероприятия в {selectedSources.length} источниках...
                </div>
              )}
            </div>

            {/* Right: log + results */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color: C.textSub, marginBottom:10, textTransform:"uppercase", letterSpacing:.8 }}>
                  Лог агента
                </div>
                <Log lines={logs.length ? logs : ["Нажмите «Запустить парсинг» для начала..."]} />
              </div>

              {webEvents.length > 0 && (
                <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8 }}>
                      Найдено из веб-источников
                    </div>
                    <Tag label={`${webEvents.length} мероприятий`} color={C.blue} />
                  </div>
                  <EventTable events={webEvents.slice(0,15)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ TAB: EXCEL ════ */}
        {activeTab === "excel" && (
          <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:20 }}>
            <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:15, fontWeight:700, color: C.accent, marginBottom:16 }}>
                📊 Загрузка Excel-файла
              </div>

              {/* Template download */}
              <div style={{ background: C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:12, marginBottom:14 }}>
                <div style={{ fontSize:11, color: C.textSub, marginBottom:8, fontWeight:600 }}>📥 Скачать шаблон</div>
                <div style={{ fontSize:11, color: C.dim, marginBottom:10, lineHeight:1.6 }}>
                  Заполните шаблон Excel и загрузите обратно. AI автоматически распознает данные.
                </div>
                <button onClick={downloadTemplate} style={{
                  width:"100%", padding:"8px", borderRadius:6, fontSize:12, fontWeight:700,
                  background:"transparent", border:`1px solid ${C.teal}`, color: C.teal,
                  cursor:"pointer", fontFamily:"'IBM Plex Mono', monospace",
                }}>⬇️ Скачать шаблон XLSX</button>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) handleExcel(f); }}
                style={{
                  border:`2px dashed ${C.border}`, borderRadius:10, padding:"32px 20px",
                  textAlign:"center", cursor:"pointer", marginBottom:16,
                  background: C.bg, transition:"border-color .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
                <div style={{ fontSize:13, color: C.text, fontWeight:600 }}>
                  {excelFile ? excelFile.name : "Перетащите .xlsx файл"}
                </div>
                <div style={{ fontSize:11, color: C.dim, marginTop:4 }}>или нажмите для выбора</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
                onChange={e => { const f = e.target.files[0]; if(f) handleExcel(f); }} />

              <div style={{ background: C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:14, fontSize:12, color: C.dim, lineHeight:1.8 }}>
                <div style={{ color: C.textSub, fontWeight:700, marginBottom:6 }}>Ожидаемые колонки:</div>
                Название · Тип · Страна · Город · Дата · Участников · Организатор · Результат · Статус
                <div style={{ marginTop:6 }}>Агент распознаёт колонки автоматически</div>
              </div>

              {phase === "excel" && (
                <div style={{ marginTop:12, color: C.teal, fontSize:12 }}>⏳ Нормализую через AI-агент...</div>
              )}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color: C.textSub, marginBottom:10, textTransform:"uppercase", letterSpacing:.8 }}>Лог обработки</div>
                <Log lines={logs.length ? logs : ["Загрузите Excel-файл..."]} />
              </div>

              {excelEvents.length > 0 && (
                <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8 }}>Данные из Excel</div>
                    <Tag label={`${excelEvents.length} мероприятий`} color={C.teal} />
                  </div>
                  <EventTable events={excelEvents.slice(0,15)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ TAB: СЛИЯНИЕ ════ */}
        {activeTab === "merged" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {/* Status cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
              {[
                { label:"Из веб-парсера", val: webEvents.length, color: C.blue, icon:"🌐" },
                { label:"Из Excel", val: excelEvents.length, color: C.teal, icon:"📊" },
                { label:"После дедупликации", val: merged.length, color: C.green, icon:"✅" },
              ].map(c => (
                <div key={c.label} style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20, borderLeft:`4px solid ${c.color}` }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{c.icon}</div>
                  <div style={{ fontSize:32, fontWeight:700, color: c.color, fontFamily:"'Playfair Display', serif" }}>{c.val}</div>
                  <div style={{ fontSize:13, color: C.textSub }}>{c.label}</div>
                  {c.label === "После дедупликации" && webEvents.length + excelEvents.length > merged.length && merged.length > 0 && (
                    <div style={{ fontSize:11, color: C.orange, marginTop:4 }}>
                      🗑️ Удалено дублей: {webEvents.length + excelEvents.length - merged.length}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Run merge button */}
            <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>🤖 AI-агент дедупликации</div>
                  <div style={{ fontSize:12, color: C.dim }}>Сравнивает названия, даты и места. Удаляет дубли, сохраняет более полную запись.</div>
                </div>
                <Btn onClick={runMerge} disabled={busy || (webEvents.length + excelEvents.length === 0)}>
                  {phase==="merging" ? "⏳ Слияние..." : "🔀 Запустить слияние"}
                </Btn>
                {merged.length > 0 && (
                  <Btn onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(merged.map(e => ({
                      Название: e.name, Тип: e.type, Направление: e.direction==="abroad"?"За рубежом":"В Москве",
                      Страна: e.country||"", Город: e.city, Дата: e.date, Участников: e.participants,
                      Организатор: e.organizer, Результат: e.result, Статус: e.status, Источники: (e._sources||[e._src]).join(", "),
                    })));
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Мероприятия");
                    XLSX.writeFile(wb, "moscow_events_merged.xlsx");
                  }} variant="secondary">
                    ⬇️ Экспорт XLSX
                  </Btn>
                )}
              </div>
              {logs.length > 0 && <div style={{ marginTop:14 }}><Log lines={logs} /></div>}
            </div>

            {merged.length > 0 && (
              <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color: C.textSub, marginBottom:12, textTransform:"uppercase", letterSpacing:.8 }}>
                  Итоговый объединённый реестр
                </div>
                <EventTable events={merged} showSources />
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: ДАШБОРД ════ */}
        {activeTab === "dashboard" && (
          <div ref={dashRef}>
            {/* KPIs */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
              {[
                { icon:"🌍", label:"Всего мероприятий", val: displayEvents.length, color: C.accent },
                { icon:"✈️", label:"Выездных", val: abroad.length, color: C.blue },
                { icon:"🏛️", label:"В Москве", val: moscow.length, color: "#a78bfa" },
                { icon:"🌐", label:"Из веб", val: webEvents.length, color: C.teal },
                { icon:"📊", label:"Из Excel", val: excelEvents.length, color: C.orange },
              ].map(k => (
                <div key={k.label} style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px", borderLeft:`3px solid ${k.color}` }}>
                  <div style={{ fontSize:20 }}>{k.icon}</div>
                  <div style={{ fontSize:26, fontWeight:700, color: k.color, fontFamily:"'Playfair Display', serif", lineHeight:1.1, marginTop:4 }}>{k.val}</div>
                  <div style={{ fontSize:11, color: C.dim, marginTop:3 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* PDF Export Button */}
            {displayEvents.length > 0 && (
              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
                <button onClick={exportPDF} disabled={busy} style={{
                  display:"flex", alignItems:"center", gap:8,
                  background: busy ? C.muted : "linear-gradient(135deg, #dc2626, #991b1b)",
                  color:"#fff", border:"none", borderRadius:8,
                  padding:"8px 18px", fontSize:13, fontWeight:700,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontFamily:"'IBM Plex Mono', monospace",
                  boxShadow: busy ? "none" : "0 2px 12px rgba(220,38,38,0.3)",
                }}>
                  {busy ? "⏳ Создаю PDF..." : "📄 Скачать PDF"}
                </button>
              </div>
            )}
            {/* Filters */}
            <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <input placeholder="🔍 Поиск..." value={filter.q} onChange={e=>setFilter(p=>({...p,q:e.target.value}))}
                style={{ background: C.bg, border:`1px solid ${C.border}`, borderRadius:6, color: C.text, padding:"6px 12px", fontSize:12, outline:"none", width:220, fontFamily:"inherit" }} />
              {[
                { key:"type", opts:["all","Выставка","Бизнес-миссия","Форум","Входящая бизнес-миссия"], label:"Тип" },
                { key:"direction", opts:["all","abroad","moscow"], label:"Направление" },
                { key:"status", opts:["all","Завершено","Планируется"], label:"Статус" },
              ].map(f => (
                <select key={f.key} value={filter[f.key]} onChange={e=>setFilter(p=>({...p,[f.key]:e.target.value}))}
                  style={{ background: C.bg, border:`1px solid ${C.border}`, borderRadius:6, color: C.text, padding:"6px 10px", fontSize:12, outline:"none", fontFamily:"inherit" }}>
                  {f.opts.map(o => <option key={o} value={o}>{o==="all"?`Все (${f.label})`:o==="abroad"?"За рубежом":o==="moscow"?"В Москве":o}</option>)}
                </select>
              ))}
            </div>

            {displayEvents.length === 0 ? (
              <div style={{ background: C.panel, border:`2px dashed ${C.border}`, borderRadius:12, padding:"60px 40px", textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🚀</div>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Данные не загружены</div>
                <div style={{ fontSize:13, color: C.dim, marginBottom:20 }}>Перейдите на вкладку «Парсер» или «Excel» для сбора данных</div>
                <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                  <Btn onClick={() => setActiveTab("web")}>🌐 Запустить парсер</Btn>
                  <Btn onClick={() => setActiveTab("excel")} variant="secondary">📊 Загрузить Excel</Btn>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {/* ── AI SUMMARY ── */}
                <AiSummaryBlock
                  events={displayEvents}
                  summary={aiSummary}
                  loading={summaryLoading}
                  onGenerate={generateSummary}
                  prevRun={prevRun}
                />
                {/* ── ANALYTICS CHARTS ── */}
                <AnalyticsBlock events={displayEvents} />

                {/* Abroad section */}
                {abroad.length > 0 && (
                  <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                      <div style={{ width:4, height:22, borderRadius:2, background: C.blue }} />
                      <div style={{ fontSize:15, fontWeight:700 }}>Участие Москвы за рубежом</div>
                      <Tag label={`${abroad.length}`} color={C.blue} />
                    </div>
                    <EventTable events={abroad} showSources={merged.length>0} />
                  </div>
                )}
                {/* Moscow section */}
                {moscow.length > 0 && (
                  <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                      <div style={{ width:4, height:22, borderRadius:2, background:"#a78bfa" }} />
                      <div style={{ fontSize:15, fontWeight:700 }}>Международные мероприятия в Москве</div>
                      <Tag label={`${moscow.length}`} color="#a78bfa" />
                    </div>
                    <EventTable events={moscow} showSources={merged.length>0} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        ::-webkit-scrollbar { width:6px; height:6px }
        ::-webkit-scrollbar-track { background:${C.bg} }
        ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:3px }
        select option { background:${C.panel} }
      `}</style>
    </div>
  );
}

// ─── EVENT TABLE COMPONENT ────────────────────────────────────────────────────
function EventTable({ events, showSources }) {
  const srcColor = { web: C.blue, excel: C.teal };
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {["Название","Тип","Страна / Город","Дата","Участников","Организатор","Статус","Ссылка", showSources && "Источники"].filter(Boolean).map(h => (
              <th key={h} style={{ textAlign:"left", padding:"7px 10px", color: C.muted, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:.6, whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={e._id || i} style={{ borderBottom:`1px solid ${C.border}22`, background: i%2?"#ffffff04":"transparent" }}>
              <td style={{ padding:"9px 10px", fontWeight:600, maxWidth:200 }}>
                <div style={{ color: C.text }}>{e.name || "—"}</div>
                {e.industry?.length > 0 && <div style={{ color: C.teal, fontSize:10, marginTop:2 }}>{e.industry.join(" · ")}</div>}
              </td>
              <td style={{ padding:"9px 10px" }}>
                <Tag label={e.type || "—"} color={
                  e.type==="Выставка" ? C.blue :
                  e.type==="Бизнес-миссия" ? C.accent :
                  e.type==="Форум" ? C.teal : "#a78bfa"
                } />
              </td>
              <td style={{ padding:"9px 10px", color: C.textSub }}>
                {[e.country, e.city].filter(Boolean).join(", ") || "—"}
              </td>
              <td style={{ padding:"9px 10px", color: C.dim, whiteSpace:"nowrap" }}>{e.date || "—"}</td>
              <td style={{ padding:"9px 10px", textAlign:"center", fontWeight:700, color: C.accent }}>{e.participants ?? "—"}</td>
              <td style={{ padding:"9px 10px", color: C.dim, maxWidth:160, fontSize:11 }}>{e.organizer || "—"}</td>
              <td style={{ padding:"9px 10px" }}>
                <span style={{
                  display:"inline-block", padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:700,
                  background: e.status==="Завершено" ? C.green+"22" : C.orange+"22",
                  color: e.status==="Завершено" ? C.green : C.orange,
                }}>{e.status || "—"}</span>
              </td>
              <td style={{ padding:"9px 10px" }}>
                {e.source_url ? (
                  <a href={e.source_url} target="_blank" rel="noreferrer" style={{
                    color: C.blue, fontSize:11, textDecoration:"none",
                    display:"inline-flex", alignItems:"center", gap:4,
                    background: C.blue+"11", border:`1px solid ${C.blue}33`,
                    borderRadius:4, padding:"2px 8px", whiteSpace:"nowrap",
                  }}
                  onMouseEnter={e2 => e2.currentTarget.style.background = C.blue+"33"}
                  onMouseLeave={e2 => e2.currentTarget.style.background = C.blue+"11"}
                  >
                    🔗 Открыть
                  </a>
                ) : (
                  <span style={{ color: C.muted, fontSize:11 }}>—</span>
                )}
              </td>
              {showSources && (
                <td style={{ padding:"9px 10px" }}>
                  {(e._sources || [e._src]).filter(Boolean).map(s => (
                    <span key={s} style={{
                      display:"inline-block", marginRight:4, padding:"1px 6px", borderRadius:3,
                      fontSize:10, background: (srcColor[s]||C.muted)+"22", color: srcColor[s]||C.muted, fontWeight:700,
                    }}>{s}</span>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ANALYTICS BLOCK ──────────────────────────────────────────────────────────
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MONTHS_SHORT = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const TYPE_COLORS = {
  "Выставка": C.blue, "Бизнес-миссия": C.accent,
  "Форум": C.teal, "Входящая бизнес-миссия": "#a78bfa",
};

function AnalyticsBlock({ events }) {
  const [mapTooltip, setMapTooltip] = useState(null);

  // ── compute stats ──
  const byMonth = useMemo(() => {
    const m = Array(12).fill(0).map((_, i) => ({ month: MONTHS_SHORT[i], count: 0 }));
    events.forEach(e => {
      const d = new Date(e.date);
      if (!isNaN(d)) m[d.getMonth()].count++;
    });
    return m.filter(m => m.count > 0);
  }, [events]);

  const byType = useMemo(() => {
    const map = {};
    events.forEach(e => { if (e.type) map[e.type] = (map[e.type] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const byCountry = useMemo(() => {
    const map = {};
    events.filter(e => e.direction === "abroad" && e.country).forEach(e => {
      map[e.country] = (map[e.country] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [events]);

  const mapMarkers = useMemo(() => {
    const map = {};
    events.filter(e => e.direction === "abroad" && e.country).forEach(e => {
      if (!map[e.country]) map[e.country] = { country: e.country, count: 0, events: [] };
      map[e.country].count++;
      map[e.country].events.push(e.name);
    });
    return Object.values(map)
      .map(m => ({ ...m, coords: COUNTRY_COORDS[m.country] }))
      .filter(m => m.coords);
  }, [events]);

  const maxCount = Math.max(...mapMarkers.map(m => m.count), 1);
  const sizeScale = scaleLinear().domain([1, maxCount]).range([6, 22]);

  const maxBar = Math.max(...byMonth.map(m => m.count), 1);

  if (events.length === 0) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── ROW 1: By month + By type ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:14 }}>

        {/* Bar: by month */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
            📅 Активность по месяцам
          </div>
          {byMonth.length === 0 ? (
            <div style={{ color: C.muted, fontSize:12, textAlign:"center", padding:20 }}>Нет данных с датами</div>
          ) : (
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:120 }}>
              {byMonth.map(m => (
                <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ fontSize:10, color: C.accent, fontWeight:700 }}>{m.count}</div>
                  <div style={{
                    width:"100%", borderRadius:"4px 4px 0 0",
                    height: `${(m.count / maxBar) * 90}px`,
                    background: `linear-gradient(180deg, ${C.accent}, ${C.accentDim})`,
                    minHeight:4,
                    transition:"height .3s ease",
                  }} />
                  <div style={{ fontSize:10, color: C.muted }}>{m.month}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Donut: by type */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
            🏷️ По типу
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {byType.map(([type, count]) => {
              const color = TYPE_COLORS[type] || C.muted;
              const pct = Math.round((count / events.length) * 100);
              return (
                <div key={type}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                    <span style={{ color: C.textSub }}>{type}</span>
                    <span style={{ color, fontWeight:700 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background: C.border, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", borderRadius:3,
                      width:`${pct}%`, background: color,
                      transition:"width .5s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ROW 2: World map + Top countries ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:14 }}>

        {/* World map */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20, position:"relative" }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:10 }}>
            🗺️ География выездов
          </div>
          <div style={{ borderRadius:8, overflow:"hidden", background:"#0a1628" }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 120, center: [40, 30] }}
              style={{ width:"100%", height:280 }}
            >
              <ZoomableGroup zoom={1}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: { fill: "#1a2d45", stroke: "#0d1e30", strokeWidth:0.5, outline:"none" },
                          hover:   { fill: "#1e3550", outline:"none" },
                          pressed: { fill: "#1e3550", outline:"none" },
                        }}
                      />
                    ))
                  }
                </Geographies>
                {/* Moscow marker */}
                <Marker coordinates={[37.6, 55.75]}>
                  <circle r={7} fill={C.red} stroke="#fff" strokeWidth={2} opacity={.9} />
                  <text textAnchor="middle" y={-12} style={{ fontSize:9, fill:"#fff", fontWeight:700 }}>МОСКВА</text>
                </Marker>
                {/* Lines from Moscow to countries */}
                {mapMarkers.map(m => (
                  <line
                    key={`line-${m.country}`}
                    x1={0} y1={0}
                    style={{ display:"none" }}
                  />
                ))}
                {/* Country markers */}
                {mapMarkers.map(m => (
                  <Marker
                    key={m.country}
                    coordinates={m.coords}
                    onMouseEnter={() => setMapTooltip(m)}
                    onMouseLeave={() => setMapTooltip(null)}
                  >
                    <circle
                      r={sizeScale(m.count)}
                      fill={C.accent}
                      fillOpacity={0.75}
                      stroke={C.accent}
                      strokeWidth={1.5}
                      style={{ cursor:"pointer" }}
                    />
                    <text textAnchor="middle" y={4} style={{ fontSize:Math.max(7, sizeScale(m.count)*0.6), fill:"#000", fontWeight:700, pointerEvents:"none" }}>
                      {m.count}
                    </text>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {/* Tooltip */}
          {mapTooltip && (
            <div style={{
              position:"absolute", top:50, left:20,
              background: C.surface, border:`1px solid ${C.accent}`,
              borderRadius:8, padding:"10px 14px", fontSize:12, zIndex:10, maxWidth:200,
            }}>
              <div style={{ fontWeight:700, color: C.accent, marginBottom:4 }}>
                🌐 {mapTooltip.country} — {mapTooltip.count} мероприятий
              </div>
              {mapTooltip.events.slice(0,3).map((e,i) => (
                <div key={i} style={{ color: C.textSub, fontSize:11 }}>• {e}</div>
              ))}
              {mapTooltip.events.length > 3 && (
                <div style={{ color: C.muted, fontSize:10, marginTop:2 }}>+{mapTooltip.events.length-3} ещё</div>
              )}
            </div>
          )}
          <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8, fontSize:11, color: C.muted }}>
            <circle style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:C.red, marginRight:4 }} />
            <span>● Москва</span>
            <span style={{ marginLeft:8 }}>● Размер = кол-во мероприятий</span>
          </div>
        </div>

        {/* Top countries bar */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
            🏆 Топ стран
          </div>
          {byCountry.length === 0 ? (
            <div style={{ color: C.muted, fontSize:12, textAlign:"center", padding:20 }}>Нет выездных мероприятий</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {byCountry.map(([country, count], i) => {
                const pct = Math.round((count / byCountry[0][1]) * 100);
                return (
                  <div key={country}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                      <span style={{ color: C.text }}>
                        <span style={{ color: C.muted, marginRight:6 }}>#{i+1}</span>
                        {country}
                      </span>
                      <span style={{ color: C.accent, fontWeight:700 }}>{count}</span>
                    </div>
                    <div style={{ height:5, borderRadius:3, background: C.border }}>
                      <div style={{
                        height:"100%", borderRadius:3,
                        width:`${pct}%`,
                        background: `linear-gradient(90deg, ${C.accent}, ${C.teal})`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI SUMMARY BLOCK ─────────────────────────────────────────────────────────
function AiSummaryBlock({ events, summary, loading, onGenerate, prevRun }) {
  const newEvents = useMemo(() => {
    if (!prevRun || !events.length) return [];
    const prevNames = new Set((prevRun.events || []).map(e => e.name));
    return events.filter(e => !prevNames.has(e.name));
  }, [events, prevRun]);

  return (
    <div style={{ display:"grid", gridTemplateColumns: prevRun ? "1fr 320px" : "1fr", gap:14 }}>
      {/* AI Summary */}
      <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:4, height:22, borderRadius:2, background: C.accent }} />
            <div style={{ fontSize:15, fontWeight:700 }}>🤖 AI-резюме</div>
          </div>
          <button onClick={onGenerate} disabled={loading || events.length === 0} style={{
            background: loading ? C.muted : C.accent, color:"#000", border:"none", borderRadius:7,
            padding:"7px 16px", fontSize:12, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
            fontFamily:"'IBM Plex Mono', monospace",
          }}>
            {loading ? "⏳ Генерирую..." : "✨ Сгенерировать"}
          </button>
        </div>
        {summary ? (
          <div style={{ fontSize:13, color: C.text, lineHeight:1.8, whiteSpace:"pre-wrap",
            background: C.bg, borderRadius:8, padding:16, border:`1px solid ${C.border}` }}>
            {summary}
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize:13, textAlign:"center", padding:"24px 0" }}>
            Нажмите «Сгенерировать» — AI составит аналитическое резюме по текущим данным
          </div>
        )}
      </div>
      {/* Comparison with prev run */}
      {prevRun && (
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:12 }}>
            🔄 Сравнение с прошлым запуском
          </div>
          <div style={{ fontSize:11, color: C.muted, marginBottom:12 }}>
            Предыдущий: {new Date(prevRun.date).toLocaleDateString("ru-RU", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
          </div>
          {[
            ["Было мероприятий", prevRun.events?.length || 0, events.length],
          ].map(([label, prev, curr]) => {
            const diff = curr - prev;
            return (
              <div key={label} style={{ marginBottom:10 }}>
                <div style={{ fontSize:12, color: C.textSub, marginBottom:4 }}>{label}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:20, fontWeight:700, color: C.text }}>{curr}</span>
                  <span style={{ fontSize:12, fontWeight:700, color: diff > 0 ? C.green : diff < 0 ? C.red : C.muted }}>
                    {diff > 0 ? "▲ +" : diff < 0 ? "▼ " : "= "}{diff}
                  </span>
                </div>
              </div>
            );
          })}
          {newEvents.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color: C.green, marginBottom:6 }}>
                🆕 Новые мероприятия ({newEvents.length}):
              </div>
              <div style={{ maxHeight:160, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
                {newEvents.map((e,i) => (
                  <div key={i} style={{ fontSize:11, color: C.textSub, background: C.green+"11",
                    border:`1px solid ${C.green}22`, borderRadius:4, padding:"3px 8px" }}>
                    {e.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FULL ANALYTICS TAB ───────────────────────────────────────────────────────
function FullAnalyticsTab({ events, prevRun }) {
  if (events.length === 0) return (
    <div style={{ background: C.panel, border:`2px dashed ${C.border}`, borderRadius:12, padding:"60px 40px", textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
      <div style={{ fontSize:15, fontWeight:700 }}>Нет данных для анализа</div>
      <div style={{ fontSize:13, color: C.dim, marginTop:6 }}>Запустите парсер или загрузите Excel</div>
    </div>
  );

  // ── Compute all stats ──
  const abroad = events.filter(e => e.direction === "abroad");
  const moscow = events.filter(e => e.direction === "moscow");

  // By organizer
  const byOrg = Object.entries(
    events.reduce((a, e) => { if (e.organizer) { const k = e.organizer.slice(0,35); a[k]=(a[k]||0)+1; } return a; }, {})
  ).sort((a,b) => b[1]-a[1]).slice(0,8);

  // By industry
  const byIndustry = Object.entries(
    events.reduce((a, e) => { (e.industry||[]).forEach(i => a[i]=(a[i]||0)+1); return a; }, {})
  ).sort((a,b) => b[1]-a[1]).slice(0,10);

  // Heatmap: month × type
  const TYPES = ["Выставка","Бизнес-миссия","Форум","Входящая бизнес-миссия"];
  const MONTHS_S = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
  const heatmap = {};
  MONTHS_S.forEach(m => { heatmap[m] = {}; TYPES.forEach(t => heatmap[m][t] = 0); });
  events.forEach(e => {
    const d = new Date(e.date);
    if (!isNaN(d) && e.type) {
      const m = MONTHS_S[d.getMonth()];
      if (heatmap[m] && TYPES.includes(e.type)) heatmap[m][e.type]++;
    }
  });
  const heatMax = Math.max(1, ...Object.values(heatmap).flatMap(m => Object.values(m)));

  // Countries never/rarely visited (white spots)
  const visitedCountries = new Set(abroad.map(e => e.country).filter(Boolean));
  const ALL_REGIONS = {
    "Юго-Восточная Азия": ["Вьетнам","Таиланд","Малайзия","Индонезия","Филиппины","Сингапур","Мьянма"],
    "Латинская Америка": ["Бразилия","Аргентина","Мексика","Колумбия","Чили","Перу","Куба"],
    "Африка": ["ЮАР","Нигерия","Египет","Эфиопия","Кения","Марокко","Алжир"],
    "Европа": ["Германия","Франция","Италия","Испания","Нидерланды","Польша","Австрия"],
    "СНГ": ["Казахстан","Беларусь","Азербайджан","Армения","Узбекистан","Кыргызстан"],
  };
  const whiteSpots = Object.entries(ALL_REGIONS).map(([region, countries]) => ({
    region,
    missing: countries.filter(c => !visitedCountries.has(c)),
    covered: countries.filter(c => visitedCountries.has(c)),
  })).filter(r => r.missing.length > 0);

  const typeColor = { "Выставка": C.blue, "Бизнес-миссия": C.accent, "Форум": C.teal, "Входящая бизнес-миссия": "#a78bfa" };
  const maxOrg = byOrg[0]?.[1] || 1;
  const maxInd = byIndustry[0]?.[1] || 1;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* ── ROW 1: Balance + Dept ── */}
      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:14 }}>

        {/* Balance abroad/moscow */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
            ⚖️ Баланс активности
          </div>
          {[
            { label:"Выезды за рубеж", val: abroad.length, total: events.length, color: C.blue, icon:"✈️" },
            { label:"Приёмы в Москве", val: moscow.length, total: events.length, color:"#a78bfa", icon:"🏛️" },
          ].map(r => (
            <div key={r.label} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                <span style={{ color: C.textSub }}>{r.icon} {r.label}</span>
                <span style={{ color: r.color, fontWeight:700 }}>{r.val} ({Math.round(r.val/r.total*100)}%)</span>
              </div>
              <div style={{ height:8, borderRadius:4, background: C.border }}>
                <div style={{ height:"100%", borderRadius:4, width: (r.val/r.total*100)+"%", background: r.color, transition:"width .5s" }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop:16, padding:"10px 14px", background: C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color: C.muted, marginBottom:4 }}>Индекс охвата стран</div>
            <div style={{ fontSize:26, fontWeight:700, color: C.accent, fontFamily:"'Playfair Display', serif" }}>
              {visitedCountries.size}
            </div>
            <div style={{ fontSize:11, color: C.dim }}>уникальных стран</div>
          </div>
        </div>

        {/* By organizer */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
            🏢 Активность по организаторам
          </div>
          {byOrg.length === 0 ? (
            <div style={{ color: C.muted, fontSize:12 }}>Нет данных об организаторах</div>
          ) : byOrg.map(([org, cnt], i) => (
            <div key={org} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                <span style={{ color: C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"75%" }}>
                  <span style={{ color: C.muted, marginRight:6 }}>#{i+1}</span>{org}
                </span>
                <span style={{ color: C.teal, fontWeight:700, flexShrink:0 }}>{cnt}</span>
              </div>
              <div style={{ height:5, borderRadius:3, background: C.border }}>
                <div style={{ height:"100%", borderRadius:3, width:(cnt/maxOrg*100)+"%", background:`linear-gradient(90deg, ${C.teal}, ${C.blue})`, transition:"width .5s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROW 2: Industry + Heatmap ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

        {/* Industry dynamics */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
            🏭 Отраслевые приоритеты
          </div>
          {byIndustry.length === 0 ? (
            <div style={{ color: C.muted, fontSize:12 }}>Нет отраслевых данных</div>
          ) : byIndustry.map(([ind, cnt], i) => {
            const colors = [C.accent, C.blue, C.teal, C.orange, "#a78bfa", C.green, "#ec4899", "#f59e0b", "#06b6d4", "#84cc16"];
            const color = colors[i % colors.length];
            return (
              <div key={ind} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                <span style={{ fontSize:11, color: C.muted, minWidth:18 }}>#{i+1}</span>
                <span style={{ fontSize:12, color: C.text, flex:1 }}>{ind}</span>
                <div style={{ width:80, height:6, borderRadius:3, background: C.border }}>
                  <div style={{ height:"100%", borderRadius:3, width:(cnt/maxInd*100)+"%", background: color }} />
                </div>
                <span style={{ fontSize:11, fontWeight:700, color, minWidth:18, textAlign:"right" }}>{cnt}</span>
              </div>
            );
          })}
        </div>

        {/* Heatmap: month × type */}
        <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
            🔥 Тепловая карта активности
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"separate", borderSpacing:3, fontSize:10 }}>
              <thead>
                <tr>
                  <th style={{ color: C.muted, fontWeight:600, padding:"2px 4px", textAlign:"left", minWidth:36 }}></th>
                  {MONTHS_S.map(m => <th key={m} style={{ color: C.muted, fontWeight:600, padding:"2px 4px", textAlign:"center", minWidth:28 }}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {TYPES.map(type => (
                  <tr key={type}>
                    <td style={{ color: typeColor[type], fontWeight:600, padding:"2px 4px", whiteSpace:"nowrap", fontSize:10 }}>
                      {type === "Входящая бизнес-миссия" ? "Вх. миссия" : type}
                    </td>
                    {MONTHS_S.map(m => {
                      const val = heatmap[m]?.[type] || 0;
                      const intensity = val / heatMax;
                      const bg = val === 0 ? C.bg : `rgba(${type==="Выставка"?"59,130,246":type==="Бизнес-миссия"?"212,168,67":type==="Форум"?"45,212,191":"167,139,250"}, ${0.15 + intensity * 0.85})`;
                      return (
                        <td key={m} style={{ background: bg, borderRadius:3, padding:"4px 0", textAlign:"center", minWidth:28, height:24 }}>
                          <span style={{ fontSize:10, fontWeight: val>0 ? 700 : 400, color: val>0 ? "#fff" : C.muted }}>
                            {val > 0 ? val : "·"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ROW 3: White spots ── */}
      <div style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color: C.textSub, textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
          🗺️ Белые пятна — регионы без активности
        </div>
        {whiteSpots.length === 0 ? (
          <div style={{ color: C.green, fontSize:13 }}>✅ Все ключевые регионы охвачены</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px,1fr))", gap:12 }}>
            {whiteSpots.map(r => (
              <div key={r.region} style={{ background: C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color: C.orange, marginBottom:8 }}>
                  ⚠️ {r.region}
                </div>
                {r.covered.length > 0 && (
                  <div style={{ marginBottom:6 }}>
                    <div style={{ fontSize:10, color: C.green, marginBottom:3 }}>✅ Есть активность:</div>
                    <div style={{ fontSize:11, color: C.textSub }}>{r.covered.join(", ")}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:10, color: C.red, marginBottom:3 }}>❌ Нет мероприятий:</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {r.missing.map(c => (
                      <span key={c} style={{ fontSize:10, background: C.red+"11", color: C.red, border:`1px solid ${C.red}33`, borderRadius:3, padding:"1px 6px" }}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
