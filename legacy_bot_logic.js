/* eslint-disable @typescript-eslint/no-unused-vars -- Google Apps Script entrypoints and catch parameters are referenced by the external runtime. */
// --- Константы ---
var PROPS = PropertiesService.getScriptProperties();
var TOKEN = PROPS.getProperty('TG_TOKEN');
var SHEET_ID = PROPS.getProperty('SHEET_ID');
var EXTERNAL_SHEET_ID = PROPS.getProperty('EXTERNAL_SHEET_ID');
var TEST_CHAT_ID = parseInt(PROPS.getProperty('TEST_CHAT_ID'), 10);

var CLIENTS_SHEET = "Info";
var TODAY_SHEET = "Today";
var LOGS_SHEET = "Logs";

var MENU_SHEET = "Menu";
var ORDERS_SHEET = "Orders";

// Колонки (1-based для удобства, в коде используем -1 при индексировании массивов)
var PHONE_COL = 3;          // C
var CHAT_COL = 5;           // E
var NOTE_COL = 7;           // G
var GENERAL_NOTE_COL = 8;   // H (общая заметка — только в H2)
var DELIVERY_TIME_COL = 6;  // F

// Админы
var ADMIN_CHAT_IDS = [TEST_CHAT_ID];

// --- Нормализация номера ---
function normalizePhone(phone) {
  if (!phone && phone !== 0) return "";
  phone = phone.toString().replace(/\D/g,'');
  if (phone.length === 9) phone = "0" + phone;
  if (phone.length === 12 && phone.startsWith("380")) phone = "0" + phone.slice(3);
  if (phone.length === 10 && phone.startsWith("0")) return phone;
  return "";
}

function isValidUAphone(phone) {
  const validPrefixes = ["039","050","063","066","067","068","091","092","093","094",
                         "095","096","097","098","099","073","089"];
  if (!phone) return false;
  phone = normalizePhone(phone);
  if (!/^0\d{9}$/.test(phone)) return false;
  return validPrefixes.indexOf(phone.substr(0,3)) !== -1;
}

// --- Логирование (Только ошибки) ---
function logEvent() {
  var args = Array.prototype.slice.call(arguments);
  var type = String(args[0]).toLowerCase();

  if (!type.includes('error')) return;

  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(LOGS_SHEET);
    var row = [new Date()].concat(args);
    sheet.appendRow(row);
  } catch(e) {}
}

// --- Анти-спам UI (Трекер повідомлень) ---
function setLastMenuId(chatId, messageId) {
  if (messageId) {
    PropertiesService.getDocumentProperties().setProperty("menu_msg_" + chatId, messageId.toString());
  }
}

function clearOldMenu(chatId) {
  var props = PropertiesService.getDocumentProperties();
  var oldMsgId = props.getProperty("menu_msg_" + chatId);
  if (oldMsgId) {
    try { 
        fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { 
            method: "post", contentType: "application/json", 
            payload: JSON.stringify({ chat_id: chatId, message_id: parseInt(oldMsgId, 10) }) 
        }); 
    } catch(e) {}
    props.deleteProperty("menu_msg_" + chatId);
  }
}

// --- fetch с retry ---
function fetchWithRetry(url, options, attempts) {
  attempts = attempts || 3;
  var wait = 500;
  for (var i=0;i<attempts;i++){
    try {
      return UrlFetchApp.fetch(url, options);
    } catch(e) {
      Utilities.sleep(wait);
      wait *= 2;
      if (i === attempts-1) throw e;
    }
  }
}

// --- Telegram ---
function sendTelegramMessage(chatId, message, inlineKeyboard) {
  try {
    var payload = { chat_id: chatId, text: message || "Сообщение", parse_mode: "HTML", reply_markup: {} };
    if (inlineKeyboard && inlineKeyboard.length) {
      payload.reply_markup = JSON.stringify({ inline_keyboard: inlineKeyboard });
    }
    var options = { method: "post", contentType: "application/json", payload: JSON.stringify(payload) };
    var response = fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/sendMessage", options);
    
    // Запам'ятовуємо ID повідомлення, якщо воно було з кнопками
    var resObj = JSON.parse(response.getContentText());
    if (resObj.ok && inlineKeyboard && inlineKeyboard.length) {
        setLastMenuId(chatId, resObj.result.message_id);
    }
  } catch(e) {}
}

function sendTelegramPhoto(chatId, fileId, caption, inlineKeyboard) {
  try {
    var payload = { chat_id: chatId, photo: fileId, caption: caption || "", parse_mode: "HTML", reply_markup: {} };
    if (inlineKeyboard && inlineKeyboard.length) {
      payload.reply_markup = JSON.stringify({ inline_keyboard: inlineKeyboard });
    }
    
    var options = { 
      method: "post", 
      contentType: "application/json", 
      payload: JSON.stringify(payload),
      muteHttpExceptions: true 
    };
    var response = fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/sendPhoto", options);
    
    var resObj = JSON.parse(response.getContentText());
    if (resObj.ok) {
        if (inlineKeyboard && inlineKeyboard.length) {
            setLastMenuId(chatId, resObj.result.message_id);
        }
    } else {
        // Фолбэк на текст при невалидном file_id
        sendTelegramMessage(chatId, caption + "\n\n<i>[Фото десь загубилося]</i>", inlineKeyboard);
    }
  } catch(e) {}
}

// --- Получить chatId из Info по номеру ---
function getChatFromInfoByPhone(phone, clientsData) {
  if (!phone) return "";
  var norm = normalizePhone(phone);
  for (var i = 1; i < clientsData.length; i++) {
    var rowPhone = normalizePhone(clientsData[i][PHONE_COL-1]);
    var rowChat = (clientsData[i][CHAT_COL-1] || "").toString().trim();
    if (rowPhone === norm && rowChat) return rowChat;
  }
  return "";
}

// --- Привязка chatId (bind) ---
function bindChatId(phone, chatId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CLIENTS_SHEET);
    var data = sheet.getDataRange().getValues();
    var normalized = normalizePhone(phone);

    logEvent('bindChatId start', phone, '->', normalized, 'chatId', chatId);

    if (!isValidUAphone(normalized)) {
      logEvent('bindChatId invalid phone', normalized);
      return "invalid";
    }

    var oldIndexes = [], targetIndexes = [];
    for (var i = 1; i < data.length; i++) {
      var rowPhone = normalizePhone(data[i][PHONE_COL-1]);
      var rowChat = data[i][CHAT_COL-1];
      if (rowChat == chatId) oldIndexes.push(i);
      if (rowPhone === normalized) targetIndexes.push(i);
    }

    if (targetIndexes.length === 0) {
      logEvent('bindChatId not_found', normalized);
      return "not_found";
    }

    for (var t of targetIndexes) {
      var existingChat = data[t][CHAT_COL-1];
      if (existingChat && existingChat != chatId) {
        logEvent('bindChatId conflict existingChat', existingChat, 'at row', t+1);
        return "already";
      }
    }

    // Очистка старых chatId
    for (var oi of oldIndexes) {
      if (targetIndexes.indexOf(oi) === -1) {
        data[oi][CHAT_COL-1] = "";
        logEvent('cleared old chatId at row', oi+1);
      }
    }

    // Проставляем chatId всем строкам targetIndexes
    for (var ti of targetIndexes) data[ti][CHAT_COL-1] = chatId;

    // batch set
    sheet.getRange(2, CHAT_COL, data.length-1, 1).setValues(data.slice(1).map(r=>[r[CHAT_COL-1]]));

    logEvent('bindChatId OK for', normalized, 'rows', JSON.stringify(targetIndexes));
    return "ok";
  } finally {
    lock.releaseLock();
  }
}

// --- Управление статусами ---
function setUserStatus(chatId, status) {
  var props = PropertiesService.getDocumentProperties();
  if (status && status !== '') props.setProperty('status_' + chatId, status);
  else props.deleteProperty('status_' + chatId);
  logEvent('setUserStatus', chatId, status || '(cleared)');
}
function getUserStatus(chatId) { return PropertiesService.getDocumentProperties().getProperty('status_' + chatId) || ''; }
function clearUserStatus(chatId) { setUserStatus(chatId, ''); }

// --- Обработка ввода номера (UI в чате) ---
function handlePhoneInput(chatId, text) {
  var phone = normalizePhone(text);
  
  // Оновлені кнопки для успішної прив'язки
  var inlineKeyboard_ok = [
    [{ text: "🛒 Зробити замовлення", callback_data: "new_order" }],
    [{ text: "📋 Мої замовлення", callback_data: "my_orders" }],
    [{ text: "⚙️ Змінити номер", callback_data: "change_yes" }]
  ];
  
  var inlineKeyboard_again = [[{ text: "Ввести інший номер", callback_data: "change_yes" }]];

  var bindResult = bindChatId(phone, chatId);
  switch(bindResult) {
    case "ok": 
      sendTelegramMessage(chatId, `✅ Ваш чат успішно прив'язано до номера: ${phone}`, inlineKeyboard_ok); 
      break;
    case "already": 
      sendTelegramMessage(chatId,"❌ Цей номер вже прив'язаний до іншого акаунту.", inlineKeyboard_again); 
      break;
    case "not_found": 
      sendTelegramMessage(chatId,"❌ Вас немає у списку клієнтів. Перевірте номер або зверніться до адміністратора.", inlineKeyboard_again); 
      break;
    default: 
      sendTelegramMessage(chatId,"❌ Невірний номер. Спробуйте формат 0XXXXXXXXX", inlineKeyboard_again); 
      break;
  }

  clearUserStatus(chatId);
}

function getDraft(chatId) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("draft_" + chatId);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {
      return null;
    }
  }
  return null;
}

function saveDraft(chatId, draftObj) {
  var cache = CacheService.getScriptCache();
  cache.put("draft_" + chatId, JSON.stringify(draftObj), 21600);
}

function deleteDraft(chatId) {
  var cache = CacheService.getScriptCache();
  cache.remove("draft_" + chatId);
}

function showMainMenu(chatId, text) {
  var menu = [
    [{ text: "🛒 Зробити замовлення", callback_data: "new_order" }],
    [{ text: "📋 Мої замовлення", callback_data: "my_orders" }],
    [{ text: "⚙️ Змінити номер", callback_data: "change_yes" }]
  ];
  sendTelegramMessage(chatId, text || "Ось ваше головне меню:", menu);
}

// --- Логика заказа: Шаг 1 (Выбор пакета) ---
function handleNewOrder(chatId, messageIdToEdit) {
  var keyboard = [
    [{ text: "🥗 Slim [1200-1300 ккал]", callback_data: "view_package_Slim" }],
    [{ text: "🍲 Balance [1500-1600 ккал]", callback_data: "view_package_Balance" }],
    [{ text: "💪 Active [1800-2000 ккал]", callback_data: "view_package_Active" }],
    [{ text: "⚡️ Sport Active+ [2200-2400 ккал]", callback_data: "view_package_Sport Active+" }],
    [{ text: "🔥 Сушка (Фіксоване меню) ⬇️", callback_data: "submenu_sushka" }],
    [{ text: "🧩 Індивідуальний [Вільний вибір]", callback_data: "view_package_Індивідуальний" }],
    [{ text: "🔙 Головне меню", callback_data: "main_menu" }]
  ];
  var text = "🍽 Оберіть ваш тарифний план для перегляду деталей:";
  
  if (messageIdToEdit) {
    editTextMessage(chatId, messageIdToEdit, text, keyboard);
  } else {
    sendTelegramMessage(chatId, text, keyboard);
  }
}

function showPackageDetails(chatId, packageName, messageIdToEdit) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var menuSheet = ss.getSheetByName(MENU_SHEET);
  // Читаем диапазон L2:M7 (где L - названия, M - ID фото)
  var pkgData = menuSheet.getRange("L2:M7").getValues();
  
  var photoId = "";
  for (var i = 0; i < pkgData.length; i++) {
    if (String(pkgData[i][0]).trim() === packageName) {
      photoId = pkgData[i][1];
      break;
    }
  }

  // Удаляем текстовое меню
  if (messageIdToEdit) {
    try {
      fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", {
        method: "post", contentType: "application/json",
        payload: JSON.stringify({ chat_id: chatId, message_id: messageIdToEdit })
      });
    } catch(e) {}
  }

  var caption = "<b>Програма: " + packageName + "</b>\n\nБажаєте замовити цей пакет?";
  var keyboard = [
    [{ text: "✅ Так, обрати цей пакет", callback_data: "set_package_" + packageName }],
    [{ text: "🔙 Назад до вибору", callback_data: "new_order_edit_photo" }]
  ];

  if (photoId) {
    sendTelegramPhoto(chatId, photoId, caption, keyboard);
  } else {
    // Фолбэк, если в таблице нет ID фото
    sendTelegramMessage(chatId, caption + "\n\n<i>(Фото не знайдено в таблиці)</i>", keyboard);
  }
}

/* --- Логика заказа: Шаг 2 (Выбор недели) ---
function askWeekSelection(chatId, selectedPackage) {
  // 1. Создаем/Обновляем черновик с выбранным пакетом
  var draft = getDraft(chatId) || {};
  draft.package = selectedPackage;
  draft.step = "week_selection";
  draft.orders = draft.orders || {}; 
  
  saveDraft(chatId, draft);

  // 2. Рассчитываем даты
  var today = new Date();
  var currentMonday = getMonday(today);
  var nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  var currEnd = new Date(currentMonday); currEnd.setDate(currEnd.getDate()+6);
  var nextEnd = new Date(nextMonday); nextEnd.setDate(nextEnd.getDate()+6);

  var btnCurrent = `Поточний тиждень (${formatDate(currentMonday)} - ${formatDate(currEnd)})`;
  var btnNext = `Наступний тиждень (${formatDate(nextMonday)} - ${formatDate(nextEnd)})`;

  var keyboard = [
    [{ text: btnCurrent, callback_data: "set_week_" + toIsoDate(currentMonday) }],
    [{ text: btnNext, callback_data: "set_week_" + toIsoDate(nextMonday) }],
  ];
  keyboard.push([{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]);
  
  sendTelegramMessage(chatId, `Тариф: <b>${selectedPackage}</b> ✅\nОберіть тиждень доставки:`, keyboard);
}*/

// --- Логика заказа: Шаг 3 (Мультивыбор дней с проверкой времени) ---
function askDaySelection(chatId, messageIdToEdit) {
  var draft = getDraft(chatId);
  if (!draft) return;

  var now = new Date();
  var timeZone = "Europe/Kyiv";

  var dayOfWeek = now.getDay(); 
  var targetMonday = getMonday(now);
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5) PropertiesService.getScriptProperties().setProperty('NEXT_WEEK_OPEN', 'false');
  var isNextWeekOpen = PropertiesService.getScriptProperties().getProperty('NEXT_WEEK_OPEN') === 'true';

  if ((dayOfWeek === 6 && isNextWeekOpen) || dayOfWeek === 0) {
      targetMonday.setDate(targetMonday.getDate() + 7);
  }
  var availableDays = [];
  var daysNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
  
  for (var i = 0; i < 7; i++) {
      var targetDate = new Date(targetMonday);
      targetDate.setDate(targetMonday.getDate() + i);
      var tDay = targetDate.getDay(); 
      
      var deadline = new Date(targetDate);
      
      if (tDay === 1) { 
          // Понедельник: дедлайн Суббота 23:00 предыдущей недели
          deadline.setDate(targetDate.getDate() - 2); 
          deadline.setHours(23, 0, 0, 0);
      } else if (tDay === 6 || tDay === 0) {
          // Суббота и Воскресенье: дедлайн Четверг 14:00
          var daysToSubtract = (tDay === 6) ? 2 : 3;
          deadline.setDate(targetDate.getDate() - daysToSubtract);
          deadline.setHours(14, 0, 0, 0);
      } else {
          // Вторник, Среда, Четверг, Пятница: за 2 дня до 14:00
          deadline.setDate(targetDate.getDate() - 2);
          deadline.setHours(14, 0, 0, 0);
      }

      if (now.getTime() < deadline.getTime()) {
          var btnText = daysNames[tDay] + " (" + Utilities.formatDate(targetDate, timeZone, "dd.MM") + ")";
          if (draft.selectedDays && draft.selectedDays.indexOf(toIsoDate(targetDate)) !== -1) {
              btnText += " ✅";
          }
          availableDays.push({
              text: btnText,
              callback_data: "toggle_day_" + toIsoDate(targetDate)
          });
      }
  }

  if (availableDays.length === 0) {
      sendTelegramMessage(chatId, "⚠️ Наразі замовлення закриті.\n\nМеню на наступний тиждень публікується в суботу о 12:00 (приблизно). У п'ятницю замовлення не приймаються.", [[{ text: "🔙 Головне меню", callback_data: "main_menu" }]]);
      return;
  }

  var keyboard = [];
  for (var j = 0; j < availableDays.length; j++) {
      keyboard.push([availableDays[j]]);
  }
  
  if (draft.selectedDays && draft.selectedDays.length > 0) {
      keyboard.push([{ text: "✅ Продовжити", callback_data: "confirm_days" }]);
  }
  keyboard.push([{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]);

  var text = "Оберіть дні доставки:\n\n<i>(Замовлення оформлюється за 2 дні до бажаної дати до 14:00.\n Понеділок наступного тижня — до кінця суботи цього тижня. Субота та неділя — до четверга 14:00)\n\nМОЖНА ОБРАТИ ОДРАЗУ ДЕКІЛЬКА ДНІВ</i>";
  
  if (messageIdToEdit) {
      editTextMessage(chatId, messageIdToEdit, text, keyboard);
  } else {
      sendTelegramMessage(chatId, text, keyboard);
  }
}

// Хелпер для редактирования сообщений (красивые галочки)
function editTextMessage(chatId, messageId, text, inlineKeyboard) {
  try {
    var payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML",
      reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard })
    };
    fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/editMessageText", {
      method: "post", contentType: "application/json", payload: JSON.stringify(payload)
    });
    // Оновлюємо трекер
    setLastMenuId(chatId, messageId);
  } catch(e) {}
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var chatId = data.message?.chat?.id || data.callback_query?.message?.chat?.id;
  var text = (data.message?.text || "").trim();
  var callbackData = data.callback_query?.data;

  if (!chatId) return ContentService.createTextOutput("ok");

  // --- 1. АДМИН КОМАНДЫ И ФОТО ---
  if (ADMIN_CHAT_IDS.includes(chatId)) {
    
    // Перехват фото (теперь работает независимо от наличия текста)
    if (data.message && data.message.photo) {
      var photoArray = data.message.photo;
      var fileId = photoArray[photoArray.length - 1].file_id; 
      sendTelegramMessage(chatId, "<b>ID вашого фото:</b>\n\n<code>" + fileId + "</code>");
      return ContentService.createTextOutput("ok");
    }

    if (text && text.startsWith("/")) {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(CLIENTS_SHEET);
      var parts = text.split(" ");
      switch(parts[0]) {
        case "/forcebind":
          if (parts.length === 3) {
            var phone = normalizePhone(parts[1]);
            var targetChatId = parseInt(parts[2],10);
            var res = bindChatId(phone,targetChatId);
            sendTelegramMessage(chatId,"Force bind result: " + res);
          }
          return ContentService.createTextOutput("ok");

        case "/unbind":
          if (parts.length === 2) {
            var phone = normalizePhone(parts[1]);
            var sheetData = sheet.getDataRange().getValues();
            for(var i=1;i<sheetData.length;i++){
              if(normalizePhone(sheetData[i][PHONE_COL-1])===phone) sheet.getRange(i+1, CHAT_COL).setValue("");
            }
            sendTelegramMessage(chatId,"Unbind done for: " + phone);
          }
          return ContentService.createTextOutput("ok");

        case "/dump":
          var all = sheet.getDataRange().getValues()
              .slice(1)
              .map(r => normalizePhone(r[PHONE_COL-1]) + " : " + (r[CHAT_COL-1] || "—"))
              .join("\n");
          sendTelegramMessage(chatId,"Dump:\n"+all);
          return ContentService.createTextOutput("ok");

        case "/reload":
        var cache = CacheService.getScriptCache();
        var days = ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"];
        days.forEach(day => cache.remove("menu_" + day));
        sendTelegramMessage(chatId, "✅ Кеш меню очищено. Дані будуть оновлені при наступному запиті.");
        return ContentService.createTextOutput("ok");
      }
    }
  }

  // --- 2. ОБРАБОТКА КНОПОК ---
  if (callbackData) {
    if (callbackData === "new_order") {
      handleNewOrder(chatId, data.callback_query.message.message_id);
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "new_order_edit_inline") {
      handleNewOrder(chatId, data.callback_query.message.message_id);
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "submenu_sushka") {
      var keyboard = [
        [{ text: "🔥 Сушка XS (1200-1300 ккал)", callback_data: "view_package_Сушка XS" }],
        [{ text: "🔥 Сушка S (1500-1600 ккал)", callback_data: "view_package_Сушка S" }],
        [{ text: "🔙 Назад", callback_data: "new_order_edit_inline" }]
      ];
      editTextMessage(chatId, data.callback_query.message.message_id, "Оберіть варіант Сушки:", keyboard);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData.startsWith("my_orders")) {
      var page = 0;
      if (callbackData !== "my_orders") {
          page = parseInt(callbackData.replace("my_orders_", ""), 10);
      }
      sendMyOrders(chatId, data.callback_query.message.message_id, page);
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "main_menu") {
        quickAnswer(data.callback_query.id);
        var inlineKeyboard = [
          [{ text: "🛒 Зробити замовлення", callback_data: "new_order" }],
          [{ text: "📋 Мої замовлення", callback_data: "my_orders" }],
          [{ text: "⚙️ Змінити номер телефону", callback_data: "change_yes" }]
        ];
        editTextMessage(chatId, data.callback_query.message.message_id, "Ось ваше головне меню:", inlineKeyboard);
        return ContentService.createTextOutput("ok");
    }
    if (callbackData === "change_yes") {
        setUserStatus(chatId, "waiting_for_phone");
        try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
        sendTelegramMessage(chatId, "Введіть новий номер телефону:");
        quickAnswer(data.callback_query.id);
        return ContentService.createTextOutput("ok");
    }
    // Просмотр карточки программы
    if (callbackData.startsWith("view_package_")) {
      var pkg = callbackData.replace("view_package_", "");
      showPackageDetails(chatId, pkg, data.callback_query.message.message_id);
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    // Возврат из карточки (удаляем фото и шлем текстовое меню заново)
    if (callbackData === "new_order_edit_photo") {
      try {
        fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", {
          method: "post", contentType: "application/json",
          payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id })
        });
      } catch(e) {}
      handleNewOrder(chatId);
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData.startsWith("set_package_")) {
        var pkg = callbackData.replace("set_package_", "");
        var draft = getDraft(chatId) || {};
        draft.package = pkg;
        draft.step = "day_selection"; 
        draft.orders = draft.orders || {};
        draft.selectedDays = [];
        
        var today = new Date();

        var dayOfWeek = today.getDay();
        var targetMonday = getMonday(today);
        
        if (dayOfWeek >= 1 && dayOfWeek <= 5) PropertiesService.getScriptProperties().setProperty('NEXT_WEEK_OPEN', 'false');
        var isNextWeekOpen = PropertiesService.getScriptProperties().getProperty('NEXT_WEEK_OPEN') === 'true';
        
        if ((dayOfWeek === 6 && isNextWeekOpen) || dayOfWeek === 0) {
            targetMonday.setDate(targetMonday.getDate() + 7);
        }

        draft.weekStart = toIsoDate(targetMonday); // Зберігаємо для запису в таблицю Orders
        
        saveDraft(chatId, draft);
        quickAnswer(data.callback_query.id);
        
        try {
            fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", {
                method: "post", contentType: "application/json",
                payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id })
            });
        } catch(e) {}

        askDaySelection(chatId);
        return ContentService.createTextOutput("ok");
    }
    if (callbackData.startsWith("set_cutlery_")) {
      var amount = callbackData.replace("set_cutlery_", "");
      var draft = getDraft(chatId);
      if (draft) {
        draft.cutlery = amount === "0" ? "Без приборів" : amount + " шт";
        saveDraft(chatId, draft);
        
        // Если заметки уже есть (редактирование) — возврат в финал
        if (draft.notes) {
          finishOrder(chatId, data.callback_query.message.message_id);
        } else {
          askNotes(chatId, data.callback_query.message.message_id);
        }
      }
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "skip_notes") {
      var draft = getDraft(chatId);
      if (draft) {
        draft.notes = draft.notes || "—"; // Сохраняет старые, если они есть
        saveDraft(chatId, draft);
        clearUserStatus(chatId);
        finishOrder(chatId, data.callback_query.message.message_id);
      }
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData.startsWith("toggle_day_")) {
      var dateToToggle = callbackData.replace("toggle_day_", "");
      var draft = getDraft(chatId);
      if (draft) {
        draft.selectedDays = draft.selectedDays || [];
        var idx = draft.selectedDays.indexOf(dateToToggle);
        if (idx === -1) {
          draft.selectedDays.push(dateToToggle);
          draft.selectedDays.sort();
        } else {
          draft.selectedDays.splice(idx, 1);
        }
        saveDraft(chatId, draft);
        askDaySelection(chatId, data.callback_query.message.message_id);
      }
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "confirm_days") {
        var draft = getDraft(chatId);
        if (!draft) {
            quickAnswer(data.callback_query.id, "⚠️ Час сесії вичерпано. Оновлюємо меню для нового замовлення...");
            try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
            handleNewOrder(chatId);
            return ContentService.createTextOutput("ok");
        }
        quickAnswer(data.callback_query.id);
        draft.currentDayIndex = 0;
        var pkg = (draft.package || "").toUpperCase();
        
        
// БАЙПАС ДЛЯ СУШКИ (Показ меню з таблиці по дням)
        if (pkg.includes("СУШКА")) {
            draft.orders = {};
            var ss = SpreadsheetApp.openById(SHEET_ID);
            var menuSheet = ss.getSheetByName(MENU_SHEET);
            var dataInfo = menuSheet.getDataRange().getValues();

            var isS = (pkg === "СУШКА S"); 
            var fullCaptionText = `🔥 <b>Меню для ${draft.package}:</b>\n\n`;
            var firstPhotoId = "";

            for (var i = 0; i < draft.selectedDays.length; i++) {
                var d = draft.selectedDays[i]; 
                var dateObj = new Date(d);
                var dayNameUkr = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"][dateObj.getDay()];
                var searchKey = (dayNameUkr + " Сушка").toLowerCase();
                
                var sushkaPhotoId = "";
                var dayDishesFull = [];
                var dayDishesShort = [];
                
                for (var r = 0; r < dataInfo.length; r++) {
                    var rowA = String(dataInfo[r][0]).toLowerCase().trim();
                    if (rowA === searchKey) {
                        sushkaPhotoId = String(dataInfo[r][1] || "").trim(); // Колонка B
                        // Берем фото первого выбранного дня для вывода в ТГ
                        if (!firstPhotoId && sushkaPhotoId.length > 10) firstPhotoId = sushkaPhotoId;
                        
                        var breakfast = parseDishName(dataInfo[r][2]); // Колонка C
                        var lunch = parseDishName(dataInfo[r][3]);     // Колонка D
                        var dinner = parseDishName(dataInfo[r][4]);    // Колонка E
                        var snack = parseDishName(dataInfo[r][5]);     // Колонка F
                        
                        if (breakfast.name) { dayDishesFull.push("🍳 " + breakfast.name); dayDishesShort.push(breakfast.short); }
                        if (lunch.name) { dayDishesFull.push("🍲 " + lunch.name); dayDishesShort.push(lunch.short); }
                        if (dinner.name) { dayDishesFull.push("🥗 " + dinner.name); dayDishesShort.push(dinner.short); }
                        
                        // Если пакет S — докидываем перекус
                        if (isS && snack.name) { 
                            dayDishesFull.push("🥪 " + snack.name); dayDishesShort.push(snack.short); 
                        }
                        break;
                    }
                }
                
                var shortText = dayDishesShort.join("+");
                if (!shortText) shortText = "Меню формується";
                
                draft.orders[d] = [{ category: "Сушка", dish: shortText, count: 1 }];
                
                var niceDate = Utilities.formatDate(dateObj, "Europe/Kyiv", "dd.MM");
                fullCaptionText += `📅 <b>${dayNameUkr} (${niceDate})</b>\n`;
                fullCaptionText += dayDishesFull.length > 0 ? dayDishesFull.join("\n") : "<i>Меню ще не заповнено</i>";
                fullCaptionText += "\n\n";
            }
            
            saveDraft(chatId, draft);
            try { 
                fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { 
                    method: "post", contentType: "application/json", 
                    payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) 
                }); 
            } catch(e) {}
            
            fullCaptionText += "Бажаєте підтвердити та перейти до оформлення?";
            var keyboard = [
                [{ text: "✅ Підтвердити меню", callback_data: "sushka_confirm_menu" }],
                [{ text: "🔙 Змінити дні", callback_data: "back_to_days" }],
                [{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]
            ];

            if (firstPhotoId && firstPhotoId.length > 10) {
                sendTelegramPhoto(chatId, firstPhotoId, fullCaptionText, keyboard);
            } else {
                sendTelegramMessage(chatId, fullCaptionText, keyboard);
            }
            return ContentService.createTextOutput("ok");
        }
        
        // обычный флоу (не Сушка)
        saveDraft(chatId, draft);
        if (pkg.includes("ІНД") || pkg.includes("IND")) {
            askDishSelection(chatId, data.callback_query.message.message_id);
        } else {
            startLinearDay(chatId, data.callback_query.message.message_id);
        }
        return ContentService.createTextOutput("ok");
    }
    if (callbackData === "sushka_confirm_menu") {
      quickAnswer(data.callback_query.id);
      try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
      askCutlery(chatId);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData.startsWith("view_cat_")) {
      showCategoryDishes(chatId, callbackData.replace("view_cat_", ""), data.callback_query.message.message_id, data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "back_to_day_menu") {
      askDishSelection(chatId, data.callback_query.message.message_id);
      quickAnswer(data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "back_to_days") {
      quickAnswer(data.callback_query.id);
      try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
      askDaySelection(chatId);
      return ContentService.createTextOutput("ok");
    }
    if (callbackData === "edit_order_menu") {
        var draft = getDraft(chatId);
        if (!draft) return ContentService.createTextOutput("ok");
        quickAnswer(data.callback_query.id);
        
        var keyboard = [];
        // Якщо це не Сушка, дозволяємо редагувати конкретні дні
        if (!draft.package.toUpperCase().includes("СУШКА")) {
            for (var i = 0; i < draft.selectedDays.length; i++) {
                var dateStr = draft.selectedDays[i];
                var dateObj = new Date(dateStr);
                var dayName = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][dateObj.getDay()];
                var niceDate = Utilities.formatDate(dateObj, "Europe/Kyiv", "dd.MM");
                keyboard.push([{ text: "📅 " + niceDate + " (" + dayName + ")", callback_data: "edit_day_" + i }]);
            }
        }
        keyboard.push([{ text: "🍴 Змінити прибори", callback_data: "edit_cutlery" }]);
        keyboard.push([{ text: "📝 Змінити побажання", callback_data: "edit_notes" }]);
        keyboard.push([{ text: "🔙 Назад до підсумку", callback_data: "go_to_summary" }]);

        editTextMessage(chatId, data.callback_query.message.message_id, "<b>Що саме хочете змінити?</b>\nОберіть параметр зі списку нижче:", keyboard);
        return ContentService.createTextOutput("ok");
    }

    if (callbackData === "go_to_summary") {
        quickAnswer(data.callback_query.id);
        try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
        finishOrder(chatId);
        return ContentService.createTextOutput("ok");
    }

    if (callbackData === "edit_cutlery") {
        quickAnswer(data.callback_query.id);
        try { 
            fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { 
                method: "post", contentType: "application/json", 
                payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) 
            }); 
        } catch(e) {}
        askCutlery(chatId);
        return ContentService.createTextOutput("ok");
    }

    if (callbackData === "edit_notes") {
        quickAnswer(data.callback_query.id);
        askNotes(chatId, data.callback_query.message.message_id);
        return ContentService.createTextOutput("ok");
    }

    if (callbackData.startsWith("edit_day_")) {
        quickAnswer(data.callback_query.id);
        var dayIdx = parseInt(callbackData.replace("edit_day_", ""), 10);
        var draft = getDraft(chatId);
        if (draft) {
            draft.currentDayIndex = dayIdx;
            saveDraft(chatId, draft);
            askDishSelection(chatId, data.callback_query.message.message_id);
        }
        return ContentService.createTextOutput("ok");
    }

    if (callbackData === "confirm_order") {
        quickAnswer(data.callback_query.id);
        executeOrder(chatId, data.callback_query.message.message_id);
        return ContentService.createTextOutput("ok");
    }
    
    if (callbackData === "cancel_order") {
        quickAnswer(data.callback_query.id, "Замовлення скасовано.");
        deleteDraft(chatId);
        try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
        
        var keyboard = [[{ text: "🛒 Зробити замовлення", callback_data: "new_order" }], [{ text: "📋 Мої замовлення", callback_data: "my_orders" }]];
        sendTelegramMessage(chatId, "Ось ваше головне меню:", keyboard);
        return ContentService.createTextOutput("ok");
    }
    
    if (callbackData === "empty_menu") {
        quickAnswer(data.callback_query.id, "⛔️ Меню на цей день ще не заповнено шеф-кухарем.");
        return ContentService.createTextOutput("ok");
    }
    // --- Мгновенный возврат при ручном редактировании (toggle_dish) ---
    if (callbackData.startsWith("toggle_dish_")) {
      var parts = callbackData.replace("toggle_dish_", "").split("_");
      var cat = parts[0];
      var dishIndex = parseInt(parts[1], 10);
      
      var draft = getDraft(chatId);
      if (!draft) {
          quickAnswer(data.callback_query.id, "⚠️ Сесія вичерпана.");
          return ContentService.createTextOutput("ok");
      }
      var dayIndex = draft.currentDayIndex || 0;
      var date = draft.selectedDays[dayIndex];
      draft.orders = draft.orders || {};
      draft.orders[date] = draft.orders[date] || [];
      
      var daysNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
      var menu = getMenuForDay(daysNames[new Date(date).getDay()]) || {};
      var dishList = cat.startsWith("snack") ? menu.allSnacks : menu[cat];
      if (cat === "extra") {
        var allD = [].concat(menu.breakfast||[], menu.lunch||[], menu.dinner||[], menu.allSnacks||[]);
        var unique = [], seen = {};
        for(var d=0; d<allD.length; d++) { if(!seen[allD[d].short]) { seen[allD[d].short]=true; unique.push(allD[d]); } }
        dishList = unique;
      }
      var dishName = dishList[dishIndex].short;

      var exactDishIdx = draft.orders[date].findIndex(o => 
        o.category === cat && normalizeString(o.dish) === normalizeString(dishName)
      );
      var limit = getPackageLimit(draft.package);
      var isIndiv = draft.package.toLowerCase().includes("інд") || draft.package.toLowerCase().includes("ind");
      
      // Підрахунок поточної кількості
      var currentTotal = 0;
      for (var m=0; m<draft.orders[date].length; m++) currentTotal += draft.orders[date][m].count;

      if (exactDishIdx !== -1) {
        // Страва вже є - змінюємо count або видаляємо
        if (isIndiv) {
            var newTotal = currentTotal + 1; // Після збільшення
            if (draft.orders[date][exactDishIdx].count < 3 && newTotal <= limit) {
                draft.orders[date][exactDishIdx].count++;
            } else if (newTotal > limit) {
                quickAnswer(data.callback_query.id, "❌ Ліміт страв (" + limit + ") вичерпано!");
                return ContentService.createTextOutput("ok");
            } else {
                draft.orders[date].splice(exactDishIdx, 1); // Видалення після 3-ї порції
            }
        } else {
            draft.orders[date].splice(exactDishIdx, 1);
        }
      } else {
        // Страви немає - додаємо нову
        if (!isIndiv) {
            draft.orders[date] = draft.orders[date].filter(o => o.category !== cat);
        }
        
        if (currentTotal < limit) {
            draft.orders[date].push({ category: cat, dish: dishName, count: 1 });
        } else {
            quickAnswer(data.callback_query.id, "❌ Ліміт страв (" + limit + ") вичерпано!");
            return ContentService.createTextOutput("ok");
        }
      }
      
      saveDraft(chatId, draft);
      Utilities.sleep(50);
      showCategoryDishes(chatId, cat, data.callback_query.message.message_id, data.callback_query.id);
      return ContentService.createTextOutput("ok");
    }
    
    if (callbackData === "next_day") {    
        var draft = getDraft(chatId);
        if (!draft || !draft.selectedDays) {
            quickAnswer(data.callback_query.id, "⚠️ Час сесії вичерпано. Оновлюємо меню для нового замовлення...");
            try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
            handleNewOrder(chatId);
            return ContentService.createTextOutput("ok");
        }
        quickAnswer(data.callback_query.id);

        var currentDayDate = draft.selectedDays[draft.currentDayIndex || 0];
        var ordersForDay = draft.orders?.[currentDayDate] || [];
        var limit = getPackageLimit(draft.package);
        var isIndiv = draft.package.toLowerCase().includes("інд") || draft.package.toLowerCase().includes("ind");

        var currentCount = 0;
        for(var o=0; o<ordersForDay.length; o++) currentCount += ordersForDay[o].count;

        // Валидация: Обычный тариф = строго лимит. Индивидуальный = от 1 до лимита.
        if (isIndiv) {
          if (currentCount === 0) {
            quickAnswer(data.callback_query.id, "⚠️ Оберіть хоча б одну страву.");
            return ContentService.createTextOutput("ok");
          }
        } else if (currentCount < limit) {
          quickAnswer(data.callback_query.id, "⚠️ Треба обрати ВСІ страв (" + limit + "). У вас: " + currentCount);
          return ContentService.createTextOutput("ok");
        }

        draft.currentDayIndex = (draft.currentDayIndex || 0) + 1;
        saveDraft(chatId, draft);
        
        if (draft.currentDayIndex < draft.selectedDays.length) {
          if (isIndiv) {
            askDishSelection(chatId, data.callback_query.message.message_id);
          } else {
            startLinearDay(chatId, data.callback_query.message.message_id);
          }
        } else {
          try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
          askCutlery(chatId);
        }
        return ContentService.createTextOutput("ok");
    }
    
    // --- Обработка линейного выбора ---
    if (callbackData.startsWith("lin_dish_")) {
        var draft = getDraft(chatId);
        if (!draft) {
            quickAnswer(data.callback_query.id, "⚠️ Час сесії вичерпано. Оновлюємо меню для нового замовлення...");
            try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
            handleNewOrder(chatId);
            return ContentService.createTextOutput("ok");
        }
        var parts = callbackData.replace("lin_dish_", "").split("_");
        var cat = parts[0]; 
        var dishIndex = parseInt(parts[1], 10);

        var expectedCat = draft.catSequence[draft.currentCatIndex];
        if (cat !== expectedCat) {
            quickAnswer(data.callback_query.id); // Ігноруємо старий/дублюючий клік
            return ContentService.createTextOutput("ok");
        }
        quickAnswer(data.callback_query.id);
        
        var date = draft.selectedDays[draft.currentDayIndex || 0];

        draft.orders = draft.orders || {};
        draft.orders[date] = draft.orders[date] || [];

        var daysNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
        var menu = getMenuForDay(daysNames[new Date(date).getDay()]) || {};

        // ВИПРАВЛЕННЯ: Беремо страви з allSnacks, якщо це будь-який перекус
        var dishList = cat.startsWith("snack") ? menu.allSnacks : menu[cat];
        if (cat === "extra") {
          var allD = [].concat(menu.breakfast||[], menu.lunch||[], menu.dinner||[], menu.allSnacks||[]);
          var unique = [], seen = {};
          for(var d=0; d<allD.length; d++) { if(!seen[allD[d].short]) { seen[allD[d].short]=true; unique.push(allD[d]); } }
          dishList = unique;
        }
        var dishName = dishList[dishIndex].short;

        draft.orders[date] = draft.orders[date].filter(o => o.category !== cat); 
        draft.orders[date].push({ category: cat, dish: dishName, count: 1 });
        draft.currentCatIndex++;
        saveDraft(chatId, draft);
        
        if (draft.currentCatIndex < draft.catSequence.length) {
            showLinearCategory(chatId, data.callback_query.message.message_id, data.callback_query.id, false);
        } else {
            askDishSelection(chatId, data.callback_query.message.message_id);
            quickAnswer(data.callback_query.id);
        }
        return ContentService.createTextOutput("ok");
    }

    if (callbackData.startsWith("lin_skip_")) {
        var draft = getDraft(chatId);
        if (!draft) {
            quickAnswer(data.callback_query.id, "⚠️ Час сесії вичерпано. Оновлюємо меню для нового замовлення...");
            try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.callback_query.message.message_id }) }); } catch(e) {}
            handleNewOrder(chatId);
            return ContentService.createTextOutput("ok");
        }
        
        var cat = callbackData.replace("lin_skip_", "");
        
        var expectedCat = draft.catSequence[draft.currentCatIndex];
        if (cat !== expectedCat) {
            quickAnswer(data.callback_query.id);
            return ContentService.createTextOutput("ok");
        }

        quickAnswer(data.callback_query.id);
        draft.currentCatIndex++;
        saveDraft(chatId, draft);
        if (draft.currentCatIndex < draft.catSequence.length) {
            showLinearCategory(chatId, data.callback_query.message.message_id, data.callback_query.id, false);
        } else {
            askDishSelection(chatId, data.callback_query.message.message_id);
            quickAnswer(data.callback_query.id);
        }
        return ContentService.createTextOutput("ok");
    }
  }

// --- 3. ОБРАБОТКА ТЕКСТА (Пользовательская логика) ---
  if (text) {
    clearOldMenu(chatId);
    if (text.startsWith("/")) {
        try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: data.message.message_id }) }); } catch(e) {}
    }
    // 1. Команды из меню (Приоритет)
    if (text === "/new_order") { handleNewOrder(chatId); return ContentService.createTextOutput("ok"); }
    if (text === "/my_orders") { sendMyOrders(chatId); return ContentService.createTextOutput("ok"); }
    if (text === "/change_phone") {
        setUserStatus(chatId, "waiting_for_phone");
        sendTelegramMessage(chatId, "Введіть новий номер телефону у форматі 0XXXXXXXXX:");
        return ContentService.createTextOutput("ok");
    }

    var ssClients = SpreadsheetApp.openById(SHEET_ID);
    var sheetClients = ssClients.getSheetByName(CLIENTS_SHEET);
    var clients = sheetClients.getDataRange().getValues();
    var existingIndexes = [];

    for (var i = 1; i < clients.length; i++) {
        if (clients[i][CHAT_COL-1] == chatId) existingIndexes.push(i); 
    }

    // Если пользователь ЕСТЬ в базе
    if (existingIndexes.length > 0) {
      var status = getUserStatus(chatId);
      
      if (status === "waiting_for_phone") {
        handlePhoneInput(chatId, text);
        return ContentService.createTextOutput("ok");
      }

      if (status === "waiting_for_notes") {
        var draft = getDraft(chatId);
        if (draft) {
          draft.notes = text || "—";
          saveDraft(chatId, draft);
          clearUserStatus(chatId);
          finishOrder(chatId);
        }
        return ContentService.createTextOutput("ok");
      }
      
      clearUserStatus(chatId);
      // Если это просто /start или любой текст от старого юзера — шлем в меню
      var welcome = (text === "/start") ? "Вітаємо! Головне меню:" : "Ось ваше головне меню:";
      showMainMenu(chatId, welcome);
      return ContentService.createTextOutput("ok");
    }

    // Если пользователя НЕТ в базе
    if (text === "/start") {
        sendTelegramMessage(chatId, "Привіт! Для початку роботи введіть свій номер телефону (формат 0XXXXXXXXX) 📞");
    } else {
        handlePhoneInput(chatId, text);
    }
  }

  return ContentService.createTextOutput("ok");
}

// --- Работа с датами ---
function getMonday(d) {
  d = new Date(d);
  var day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  var dd = date.getDate();
  var mm = date.getMonth() + 1;
  return (dd < 10 ? '0' + dd : dd) + '.' + (mm < 10 ? '0' + mm : mm);
}

function toIsoDate(date) {
  // YYYY-MM-DD для JSON и сравнений
  return Utilities.formatDate(date, "Europe/Kyiv", "yyyy-MM-dd");
}

// --- Core рассылки ---
// notifyTodayOrdersCore: отправляет только по времени доставки; chatId берём обязательно из Info
function notifyTodayOrdersCore() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheetClients = ss.getSheetByName(CLIENTS_SHEET);
  var clientsData = sheetClients.getDataRange().getValues();
  var sheetToday = ss.getSheetByName(TODAY_SHEET);
  var todayData = sheetToday.getDataRange().getValues();
  var sent = 0;
  var skipped_no_info_chat = 0;
  var skipped_no_time = 0;

  for (var i = 1; i < todayData.length; i++) {
    var phone = normalizePhone(todayData[i][PHONE_COL-1]);
    var deliveryTime = (todayData[i][DELIVERY_TIME_COL-1] || "").toString().trim();

    if (!deliveryTime) {
      skipped_no_time++;
      continue;
    }

    var infoChat = getChatFromInfoByPhone(phone, clientsData);
    if (infoChat) {
      // перезаписываем Today chatId априори
      todayData[i][CHAT_COL-1] = infoChat;
      var message = `Сьогодні у вас доставка:\nПІБ: <b>${todayData[i][1] || "Невідомо"}</b>\nЧас доставки: ${deliveryTime}⏰`;
      sendTelegramMessage(infoChat, message);
      sent++;
    } else {
      skipped_no_info_chat++;
    }
  }

  // batch update chatId в Today (только колонка Chat)
  if (todayData.length > 1) {
    sheetToday.getRange(2, CHAT_COL, todayData.length-1, 1)
      .setValues(todayData.slice(1).map(r => [r[CHAT_COL-1]]));
  }

  logEvent('notifyTodayOrdersCore', 'sent', sent, 'skipped_no_info_chat', skipped_no_info_chat, 'skipped_no_time', skipped_no_time);
  return { sent: sent, skipped_no_info_chat: skipped_no_info_chat, skipped_no_time: skipped_no_time };
}

// sendNotesTodayCore: отправляет индивидуальные заметки и общую (из H2) — chatId берём из Info
function sendNotesTodayCore() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheetToday = ss.getSheetByName(TODAY_SHEET);
  var todayData = sheetToday.getDataRange().getValues();
  var sheetClients = ss.getSheetByName(CLIENTS_SHEET);
  var clientsData = sheetClients.getDataRange().getValues();

  var individualNotesSent = 0;
  var generalNotesSent = 0;
  var skippedIndividual = [];
  var skippedGeneral = [];

  var generalNote = "";
  if (todayData.length > 1) generalNote = (todayData[1][GENERAL_NOTE_COL-1] || "").toString().trim();

  for (var i = 1; i < todayData.length; i++) {
    var phone = normalizePhone(todayData[i][PHONE_COL-1]);
    var note = (todayData[i][NOTE_COL-1] || "").toString().trim();

    var infoChat = getChatFromInfoByPhone(phone, clientsData);
    if (infoChat) {
      // перезаписываем Today chatId априори
      todayData[i][CHAT_COL-1] = infoChat;

      if (note) {
        sendTelegramMessage(infoChat, `Нотатка для Вас:\n${note}`);
        individualNotesSent++;
      }
      if (generalNote) {
        sendTelegramMessage(infoChat, `Загальна нотатка:\n${generalNote}`);
        generalNotesSent++;
      }
    } else {
      if (note) skippedIndividual.push(todayData[i][1] || phone || ("row " + (i+1)));
      if (generalNote) skippedGeneral.push(todayData[i][1] || phone || ("row " + (i+1)));
    }
  }

  // batch update chatId в Today
  if (todayData.length > 1) {
    sheetToday.getRange(2, CHAT_COL, todayData.length-1, 1)
      .setValues(todayData.slice(1).map(r => [r[CHAT_COL-1]]));
  }

  var summary = `Індивідуальних: ${individualNotesSent}, Загальних: ${generalNotesSent}. Пропущено індивідуальних: ${skippedIndividual.length}, пропущено загальних: ${skippedGeneral.length}`;
  SpreadsheetApp.getUi().alert("Відправлено нотаток:\n" + summary);
  logEvent('sendNotesTodayCore', summary, JSON.stringify({ skippedIndividual, skippedGeneral }));

  return { individualNotesSent, generalNotesSent, skippedIndividual, skippedGeneral };
}

// sendAllToday: агрегация любых полей (time, personal note, general note) и отправка (chatId из Info)
function sendAllToday() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheetToday = ss.getSheetByName(TODAY_SHEET);
  var data = sheetToday.getDataRange().getValues();
  var sheetClients = ss.getSheetByName(CLIENTS_SHEET);
  var clientsData = sheetClients.getDataRange().getValues();

  var sent = 0;
  var skippedNoChat = [];
  var skippedNoFields = [];

  var generalNote = "";
  if (data.length > 1) generalNote = (data[1][GENERAL_NOTE_COL - 1] || "").toString().trim();

  for (var i = 1; i < data.length; i++) {
    var name = data[i][1] || "Невідомо";
    var phone = normalizePhone(data[i][PHONE_COL - 1]);
    var time = (data[i][DELIVERY_TIME_COL - 1] || "").toString().trim();
    var note = (data[i][NOTE_COL - 1] || "").toString().trim();

    // если нет ничего — пропускаем
    if (!time && !note && !generalNote) {
      skippedNoFields.push(name + (phone ? " ("+phone+")" : ""));
      continue;
    }

    // chatId исключительно из Info
    var infoChat = getChatFromInfoByPhone(phone, clientsData);
    if (!infoChat) {
      skippedNoChat.push(name + (phone ? " ("+phone+")" : ""));
      continue;
    }

    // перезаписываем Today chatId априори
    data[i][CHAT_COL - 1] = infoChat;

    var parts = [];
    parts.push(`ПІБ: <b>${name}</b>`);
    if (time) parts.push(`Час доставки: ${time}⏰`);
    if (note) parts.push(`<b>Нотатка для Вас:</b>\n${note}`);
    if (generalNote) parts.push(`<b>Загальна нотатка:</b>\n${generalNote}`);

    var message = `Сьогодні у вас інформація:\n` + parts.join("\n\n");
    sendTelegramMessage(infoChat, message);
    Utilities.sleep(600);
    sent++;
  }

  // batch update chatId в Today
  if (data.length > 1) {
    sheetToday.getRange(2, CHAT_COL, data.length-1, 1)
      .setValues(data.slice(1).map(r => [r[CHAT_COL-1]]));
  }

  var summary = `Відправлено: ${sent}\nПропущено (немає полей): ${skippedNoFields.length}\nПропущено (немає chat в Info): ${skippedNoChat.length}`;
  SpreadsheetApp.getUi().alert(summary);
  logEvent('sendAllToday', summary, JSON.stringify({ skippedNoFields, skippedNoChat }));
}

// preview — показывает, что будет отправлено (использует chatId из Info)
function previewTodayMessages() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheetToday = ss.getSheetByName(TODAY_SHEET);
  var data = sheetToday.getDataRange().getValues();
  var sheetClients = ss.getSheetByName(CLIENTS_SHEET);
  var clientsData = sheetClients.getDataRange().getValues();

  var messages = [];
  var skipped = 0;

  var generalNote = "";
  if (data.length > 1) generalNote = (data[1][GENERAL_NOTE_COL - 1] || "").toString().trim();

  for (var i = 1; i < data.length; i++) {
    var name = data[i][1] || "Невідомо";
    var phone = normalizePhone(data[i][PHONE_COL - 1]);
    var infoChat = getChatFromInfoByPhone(phone, clientsData);
    var time = (data[i][DELIVERY_TIME_COL - 1] || "").toString().trim();
    var note = (data[i][NOTE_COL - 1] || "").toString().trim();

    if (!time && !note && !generalNote) {
      skipped++;
      continue;
    }

    var msg = `ПІБ: ${name}\nТел: ${phone}\nChat (Info): ${infoChat || "—"}\nЧас доставки: ${time || "—"}`;
    if (note) msg += `\nНотатка для Вас: ${note}`;
    if (generalNote) msg += `\nЗагальна нотатка: ${generalNote}`;

    messages.push(msg);
  }

  var summary = `📋 Попередній перегляд повідомлень (${messages.length} шт.)\n\n` +
                messages.join("\n\n──────────────\n\n") +
                `\n\n⚠️ Пропущено ${skipped} запис(ів) (немає жодного поля для відправки)`;

  SpreadsheetApp.getUi().alert(summary);
}

// sendTestToday — шлёт тестовые сообщения в TEST_CHAT_ID, показывает целевой chatId (из Info)
function sendTestToday() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheetClients = ss.getSheetByName(CLIENTS_SHEET);
  var clientsData = sheetClients.getDataRange().getValues();
  var sheetToday = ss.getSheetByName(TODAY_SHEET);
  var todayData = sheetToday.getDataRange().getValues();
  var sent = 0;

  var generalNote = "";
  if (todayData.length > 1) generalNote = (todayData[1][GENERAL_NOTE_COL-1] || "").toString().trim();

  for (var i = 1; i < todayData.length; i++) {
    var phone = normalizePhone(todayData[i][PHONE_COL-1]);
    var infoChat = getChatFromInfoByPhone(phone, clientsData);
    var name = todayData[i][1] || "Невідомо";
    var time = (todayData[i][DELIVERY_TIME_COL-1] || "—").toString();
    var note = (todayData[i][NOTE_COL-1] || "").toString().trim();

    var parts = [];
    parts.push(`ПІБ: <b>${name}</b>`);
    parts.push(`Час доставки: ${time}`);
    if (note) parts.push(`Нотатка для Вас:\n${note}`);
    if (generalNote) parts.push(`Загальна нотатка:\n${generalNote}`);
    var message = `ТЕСТОВО → To: ${infoChat || "—"}\n\n` + parts.join("\n\n");

    sendTelegramMessage(TEST_CHAT_ID, message);
    sent++;
  }

  SpreadsheetApp.getUi().alert(`Тестова розсилка завершена. Повідомлень відправлено: ${sent}`);
}

// --- Обёртки для меню (чтобы меню вызывало существующие core-функции) ---
function sendNotesToday() {
  // вызывает core, который сам показывает подробный алерт/лог
  sendNotesTodayCore();
}

function sendTodayNow() {
  // notifyTodayOrdersCore возвращает объект {sent, skipped_no_info_chat, skipped_no_time}
  var res = notifyTodayOrdersCore();
  SpreadsheetApp.getUi().alert(
    'Відправлено замовлень сьогодні: ' + (res.sent || 0) +
    '\nПропущено (немає chat в Info): ' + (res.skipped_no_info_chat || 0) +
    '\nПропущено (немає часу): ' + (res.skipped_no_time || 0)
  );
}

function exportToExternalSheet() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt("Експорт в 'Учет блюд'", "Введіть дату доставки (формат: 16.02):", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var fullDate = response.getResponseText().trim();
  if (!fullDate) return;

  var match = fullDate.match(/^(\d{2}\.\d{2})/);
  if (!match) {
    ui.alert("Неправильний формат дати.");
    return;
  }
  var targetSheetName = match[1];

  try {
    var extSS = SpreadsheetApp.openById(EXTERNAL_SHEET_ID);
    var extSheet = extSS.getSheetByName(targetSheetName);

    if (!extSheet) {
      ui.alert("Лист з назвою '" + targetSheetName + "' не знайдено!");
      return;
    }

    var localSS = SpreadsheetApp.openById(SHEET_ID);
    var ordersSheet = localSS.getSheetByName(ORDERS_SHEET);
    var infoSheet = localSS.getSheetByName(CLIENTS_SHEET);

    var extData = extSheet.getDataRange().getValues();
    var ordMaxRow = Math.max(ordersSheet.getLastRow(), 1);
    var orders = ordersSheet.getRange(1, 1, ordMaxRow, 13).getValues();
    var infoData = infoSheet.getDataRange().getValues();

    function cleanId(val) {
        if (!val) return "";
        return String(val).split('.')[0].replace(/\D/g, "");
    }

    // Збираємо ПІБ, телефон, адресу та нотатки з Info
    var infoLookup = {};
    for (var j = 1; j < infoData.length; j++) {
       var infoChatId = cleanId(infoData[j][4]);
       if (infoChatId) {
          var rawPhone = infoData[j][2] ? String(infoData[j][2]) : "—";
          if (rawPhone !== "—" && !rawPhone.startsWith("'")) rawPhone = "'" + rawPhone;
          
          infoLookup[infoChatId] = {
             name: infoData[j][1] || "—",
             phone: rawPhone,
             address: infoData[j][3] || "—",
             cutlery: String(infoData[j][6] || "").trim(),
             notes: String(infoData[j][7] || "").trim()
          };
       }
    }

    // Шукаємо вільні рядки у шаблоні
    var availableRows = {};
    for (var r = 0; r < extData.length; r++) { 
       var chatIdCell = cleanId(extData[r][5]); // Колонка F (Chat ID)
       var dishesCell = String(extData[r][7]).trim(); // Колонка H (Страви)

       if (chatIdCell.length >= 6 && dishesCell === "") {
          if (!availableRows[chatIdCell]) availableRows[chatIdCell] = [];
          availableRows[chatIdCell].push(r + 1);
       }
    }

    var updates = [];
    var missing = [];
    var rowsToMark = [];

    // Формуємо масив на експорт
    for (var i = 1; i < orders.length; i++) {
      var dateDelivery = String(orders[i][4]);
      //var isPaid = (orders[i][10] === true || String(orders[i][10]).toUpperCase() === "TRUE");

      //if (isPaid && dateDelivery.includes(fullDate)) {
        if (dateDelivery.includes(fullDate)) {
         var localChatId = cleanId(orders[i][1]);
         var localPhone = orders[i][0];

         var packageType = orders[i][5];
         var rawOrderText = orders[i][6].replace(/^Пакет.*:\n/i, "").replace(/🔹 /g, "");
         var lines = rawOrderText.split("\n");
         var parsedItems = [];
         
        for (var L = 0; L < lines.length; L++) {  
            var line = lines[L].trim();
            if (!line) continue;
            
            var dishPart = line.split(": ")[1] || line;
            
            // Поддержка старых записей
            var match = dishPart.match(/(.*?)\s\((\d+)\sшт\)$/);
          if (match) {
            var name = match[1].trim();
            var count = parseInt(match[2], 10);
            for (var c = 0; c < count; c++) parsedItems.push(name);
          } else {
            // Обработка нового формата (Блюдо + Блюдо)
            var subItems = dishPart.split(/\s*\+\s*/);
            for (var s = 0; s < subItems.length; s++) {
              if (subItems[s]) parsedItems.push(subItems[s].trim());
            }
          }
        }
         
        var summary = parsedItems.join("+");
                                  
        var orderCutlery = String(orders[i][11] || "").trim();
        var orderNotes = String(orders[i][12] || "").trim();

        var clientName = infoLookup[localChatId] ? infoLookup[localChatId].name : "—";
        var clientPhone = infoLookup[localChatId] ? infoLookup[localChatId].phone : localPhone;
        var clientAddress = infoLookup[localChatId] ? infoLookup[localChatId].address : "—";
        var infoCutlery = infoLookup[localChatId] ? infoLookup[localChatId].cutlery : "";
        var infoNotes = infoLookup[localChatId] ? infoLookup[localChatId].notes : "";

        var cutlery = orderCutlery || infoCutlery || "";
        if (cutlery === "Без приборів" || cutlery === "—") cutlery = "";
        
        var notes = orderNotes || infoNotes || "";
        if (notes === "—") notes = "";

        if (availableRows[localChatId] && availableRows[localChatId].length > 0) {
          var targetRow = availableRows[localChatId].shift(); 
          updates.push({
              row: targetRow,
              clientData: [clientName, clientPhone, clientAddress], // Стовпці C, D, E
              orderData: [packageType, summary, cutlery, notes]     // Стовпці G, H, I, J
          });
          rowsToMark.push(i + 1);
         } else {
            missing.push("Тел: " + localPhone + " | ChatID: " + localChatId);
         }
      }
    }

    // Пакетний запис
    if (updates.length > 0) {
       for (var u = 0; u < updates.length; u++) {
          extSheet.getRange(updates[u].row, 3, 1, 3).setValues([updates[u].clientData]); 
          extSheet.getRange(updates[u].row, 7, 1, 4).setValues([updates[u].orderData]);  
       }
       for (var m = 0; m < rowsToMark.length; m++) {
          ordersSheet.getRange(rowsToMark[m], 10).setValue("Передано в учёт");
       }
    }
    
    var alertMsg = "Експорт завершено!\nЕкспортовано замовлень: " + updates.length;
    if (missing.length > 0) {
       alertMsg += "\n\nПОМИЛКА: Для наступних замовлень не знайдено ChatID або не вистачило вільних рядків у шаблоні:\n" + missing.join("\n");
    }
    ui.alert(alertMsg);

  } catch (e) {
    ui.alert("Системна помилка:\n" + e.message);
  }
}

// --- UI меню ---
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Delivery')
    .addItem('Зібрати таблицю Today (по даті)', 'buildTodaySheet')
    .addItem('Підтвердити оплати (зміна статусу + повідомлення)', 'confirmPayments')
    .addItem('Експортувати дані в файл (по дням который)', 'exportToExternalSheet')
    .addSeparator()
    .addItem('📦 Архівувати старі замовлення (Вручну)', 'manualArchiveDaily')
    .addItem('🔄 Відкрити замовлення на новий тиждень', 'openNextWeekMenu')
    .addSeparator()
    .addItem('Відправити сьогоднішні нотатки', 'sendNotesToday')
    .addItem('Відправити сьогоднішній час доставки', 'sendTodayNow')
    .addItem('Відправити ВСЕ (час доставки + персональні та загальні нотатки)', 'sendAllToday')
    .addSeparator()
    .addItem('Попередній перегляд повідомлень', 'previewTodayMessages')
    .addItem('Тестова розсилка на мій чат', 'sendTestToday')
    .addToUi();
}

// --- Чтение меню из таблицы (Smart Search + Cache) ---
function getMenuForDay(dayName) {
  var search = dayName.toLowerCase();
  var cache = CacheService.getScriptCache();
  var cachedMenu = cache.get("menu_" + search);

  if (cachedMenu) {
    return JSON.parse(cachedMenu);
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var menuSheet = ss.getSheetByName(MENU_SHEET);
  var data = menuSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var cellVal = String(data[i][0]).toLowerCase();
    if (cellVal.includes(search)) {
      // Внутри функции getMenuForDay измени объект result:
      var result = {
        photoId: String(data[i][1] || "").trim(),
        breakfast: [parseDishName(data[i][2]), parseDishName(data[i][3])].filter(d => d.name),
        lunch:     [parseDishName(data[i][4]), parseDishName(data[i][5])].filter(d => d.name),
        dinner:    [parseDishName(data[i][6]), parseDishName(data[i][7])].filter(d => d.name),
        // Объединяем колонки I и J в один массив страв
        allSnacks: [parseDishName(data[i][8]), parseDishName(data[i][9])].filter(d => d.name)
      };
      cache.put("menu_" + search, JSON.stringify(result), 600);
      return result;
    }
  }
  return null;
}

// Разделяет "Борщ || Borch" на объект
function parseDishName(rawString) {
  if (!rawString) return { name: "", short: "" };
  var parts = rawString.toString().split("||");
  var fullName = parts[0].trim();
  var shortName = (parts.length > 1 && parts[1].trim()) ? parts[1].trim() : fullName; 
  return { name: fullName, short: shortName };
}

function normalizeString(str) {
  if (!str) return "";
  return str.toString()
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Невидимі символи
    .replace(/\s+/g, ' ')                  // Всі пробіли → один
    .replace(/<[^>]*>/g, '')               // HTML
    .replace(/&nbsp;/g, ' ')
    .toLowerCase();
}

// Получить лимит блюд по пакету
function getPackageLimit(packageName) {
  if (!packageName) return 4;
  var p = packageName.toLowerCase();
  if (p.includes("слім") || p.includes("slim") || p.includes("слим")) return 3;
  if (p.includes("sport")) return 5;
  if (p.includes("інд") || p.includes("ind")) return 10; // Ліміт страв для вільного вибору
  return 4; // Balance, Active
}

// --- Линейный алгоритм выбора (Шаг за шагом) ---
function startLinearDay(chatId, messageIdToEdit) {
  var draft = getDraft(chatId);
  if (!draft || !draft.package) return;
  
  var p = draft.package.toLowerCase();
  var isSlim = p.includes("slim") || p.includes("слім");
  var isSport = p.includes("sport");

  // Формуємо послідовність кроків
  draft.catSequence = ["breakfast", "lunch", "dinner"];
 if (isSport) {
  draft.catSequence.push("snack1", "extra"); // 5-е блюдо на выбор
 } else if (!isSlim) {
    draft.catSequence.push("snack"); // Один крок для Balance/Active
  }

  draft.currentCatIndex = 0;
  saveDraft(chatId, draft);
  showLinearCategory(chatId, messageIdToEdit, null, true);
}

function showLinearCategory(chatId, messageIdToEdit, queryId, forceResend) {
  if (queryId) quickAnswer(queryId);
  var draft = getDraft(chatId);
  var dateStr = draft.selectedDays[draft.currentDayIndex || 0];
  var dayName = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"][new Date(dateStr).getDay()];
  var menu = getMenuForDay(dayName) || {};
  
  var category = draft.catSequence[draft.currentCatIndex];
  var dishes = (menu && menu[category]) ? menu[category] : [];
  
  if (category.startsWith("snack")) {
  dishes = menu.allSnacks || [];
 } else if (category === "extra") {
    var allD = [].concat(menu.breakfast||[], menu.lunch||[], menu.dinner||[], menu.allSnacks||[]);
    var unique = [], seen = {};
    for(var d=0; d<allD.length; d++) { if(!seen[allD[d].short]) { seen[allD[d].short]=true; unique.push(allD[d]); } }
    dishes = unique;
 }
  // Если категория пустая в таблице - пропускаем её
  if (dishes.length === 0) {
      draft.currentCatIndex++;
      saveDraft(chatId, draft);
      if (draft.currentCatIndex < draft.catSequence.length) showLinearCategory(chatId, messageIdToEdit, null, forceResend);
      else askDishSelection(chatId, messageIdToEdit); // Переход к финальному обзору
      return;
  }
  
  var keyboard = dishes.map((d, i) => ([{ text: d.name, callback_data: `lin_dish_${category}_${i}` }]));
  keyboard.push([{ text: "Пропустити ➡️", callback_data: "lin_skip_" + category }]);
  
  var catUkr = {
  'breakfast': 'Сніданок',
  'lunch': 'Обід',
  'dinner': 'Вечеря',
  'snack': 'Перекус',
  'snack1': 'Перекус 1',
  'snack2': 'Перекус 2',
  'extra': 'Дод. страва'
}[category];
  var text = `📅 <b>${dayName}</b>\nКрок ${draft.currentCatIndex + 1}/${draft.catSequence.length} — ${catUkr}\nОберіть страву:`;
  var isPhoto = (menu.photoId && menu.photoId.length > 10);
  
  if (forceResend) {
      if (messageIdToEdit) { try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: messageIdToEdit }) }); } catch(e) {} }
      if (isPhoto) sendTelegramPhoto(chatId, menu.photoId, text, keyboard);
      else sendTelegramMessage(chatId, text, keyboard);
  } else {
      var payload = { chat_id: chatId, message_id: messageIdToEdit, parse_mode: "HTML", reply_markup: JSON.stringify({ inline_keyboard: keyboard }) };
      if (isPhoto) {
          payload.caption = text;
          try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/editMessageCaption", { method: "post", contentType: "application/json", payload: JSON.stringify(payload) }); } catch(e) {}
      } else {
          payload.text = text;
          try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/editMessageText", { method: "post", contentType: "application/json", payload: JSON.stringify(payload) }); } catch(e) {}
      }
  }
}

// --- Логика заказа: Шаг 4 (Категории) ---
function askDishSelection(chatId, messageIdToEdit) {
  var draft = getDraft(chatId);
  if (!draft || !draft.selectedDays || draft.selectedDays.length === 0) {
    sendTelegramMessage(chatId, "⚠️ Оберіть дні спочатку.");
    return;
  }

  var dayIndex = draft.currentDayIndex || 0;
  if (dayIndex >= draft.selectedDays.length) {
    askCutlery(chatId); 
    return;
  }

  var currentDayDate = draft.selectedDays[dayIndex];
  var dateObj = new Date(currentDayDate);
  var daysNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
  var dayName = daysNames[dateObj.getDay()];

  var menu = getMenuForDay(dayName);
  if (!menu) {
    var fallbackKeyboard = [
        [{ text: "🔙 Обрати інший день", callback_data: "back_to_days" }],
        [{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]
    ];
    sendTelegramMessage(chatId, `❌ На ${dayName} (${currentDayDate}) меню ще не заповнено.`, fallbackKeyboard);
    return;
  }

  var ordersForDay = (draft.orders && draft.orders[currentDayDate]) ? draft.orders[currentDayDate] : [];
  var limit = getPackageLimit(draft.package);
  var isIndiv = draft.package.toLowerCase().includes("інд") || draft.package.toLowerCase().includes("ind");

  // Считаем общее количество выбранных блюд (с учетом порций)
  var currentCount = 0;
  for(var c=0; c<ordersForDay.length; c++) currentCount += ordersForDay[c].count;

  var remaining = limit - currentCount;
  var statusLine = (remaining > 0) ? `\n\nМожна обрати ще: <b>${remaining}</b> позиції` : `\n\n✅ Денне меню сформовано!`;

  // Подсказка для Индивидуального тарифа
  var indivHint = isIndiv ? "\n\nℹ️ <b>Тариф «Індивідуальний»:</b>\nОбирайте будь-які страви (до 10 порцій сумарно). 1 клік = +1 порція, після 3-ї — видалення." : "";

  // Внутренняя функция для кнопок категорий со счетчиками
  function makeCatBtn(catCode, catName, dishArray) {
    if (!dishArray || dishArray.length === 0) return null;
    var countInCat = 0;
    ordersForDay.forEach(o => { if(o.category === catCode) countInCat += o.count; });
    
    var icon = countInCat > 0 ? `✅ (${countInCat}) ` : "⚪️ ";
    // Если тариф не индивидуальный, просто ставим галочку без цифр для чистоты UX
    if (!isIndiv) icon = countInCat > 0 ? "✅ " : "⚪️ ";
    
    return { text: icon + catName, callback_data: "view_cat_" + catCode };
  }

  var p = (draft.package || "").toLowerCase();
  var isSlim = p.includes("slim") || p.includes("слім");
  var isSport = p.includes("sport");
  var isStandard = !isSlim && !isSport && !isIndiv;

  var keyboard = [];
  // Ряд 1: Завтрак и Обед
  keyboard.push([
    makeCatBtn("breakfast", "Сніданок", menu.breakfast),
    makeCatBtn("lunch", "Обід", menu.lunch)
  ].filter(Boolean));

  // Ряд 2: Ужин и Перекус (для стандартных)
  var row2 = [makeCatBtn("dinner", "Вечеря", menu.dinner)];
  if (isStandard || isIndiv) {
    row2.push(makeCatBtn("snack", "Перекус", menu.allSnacks));
  }
  keyboard.push(row2.filter(Boolean));

// Спец-ряд для Спорта: два перекуса
 if (isSport) {
  var allD = [].concat(menu.breakfast||[], menu.lunch||[], menu.dinner||[], menu.allSnacks||[]);
  var unique = [], seen = {};
  for(var d=0; d<allD.length; d++) { if(!seen[allD[d].short]) { seen[allD[d].short]=true; unique.push(allD[d]); } }
  var rowSport = [
   makeCatBtn("snack1", "Перекус 1 🍎", menu.allSnacks),
   makeCatBtn("extra", "Дод. страва 🌟", unique)
  ].filter(Boolean);
  keyboard.push(rowSport);
 }

  // Проверка: заполнены ли ВСЕ дни заказа?
  var isAllFilled = true;
  for (var i = 0; i < draft.selectedDays.length; i++) {
      var dOrders = draft.orders[draft.selectedDays[i]] || [];
      var dCount = 0;
      for (var k=0; k<dOrders.length; k++) dCount += dOrders[k].count;
      
      var dLimit = getPackageLimit(draft.package);
      // Для обычных — строго лимит, для индива — хотя бы 1 блюдо
      if (isIndiv) { if (dCount === 0) isAllFilled = false; }
      else { if (dCount < dLimit) isAllFilled = false; }
  }

  // Логика главной кнопки действия
  if (isAllFilled && dayIndex < draft.selectedDays.length - 1) {
      // Если всё заполнено (редактирование), даем кнопку быстрого выхода к чеку
      keyboard.push([{ text: "✅ ДО ПІДСУМКУ", callback_data: "go_to_summary" }]);
  } else {
      // Иначе стандартный путь: Наступный день или Оформить
      var canGoNext = isIndiv ? (currentCount > 0) : (currentCount === limit);
      if (canGoNext) {
          var nextText = (dayIndex < draft.selectedDays.length - 1) ? "Наступний день ➡️" : "✅ ОФОРМИТИ ЗАМОВЛЕННЯ";
          keyboard.push([{ text: nextText, callback_data: "next_day" }]);
      }
  }

  keyboard.push([{ text: "🔙 Змінити дні", callback_data: "back_to_days" }]);
  keyboard.push([{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]);

  var hint = isSport ? "\n\n<i>*У вашому пакеті передбачена додаткова страва. П'ятою позицією можна обрати будь-що з денного меню (можна дублювати страви).</i>" : "";
  var statusText = isIndiv ? `Обрано: <b>${currentCount}</b> (макс. ${limit})` : `Обрано: <b>${currentCount} / ${limit}</b>`;
  
  var text = `📅 <b>${dayName} (${formatDate(dateObj)})</b>\n` +
             `Пакет: ${draft.package}\n` +
             `${statusText}${statusLine}${hint}${indivHint}\n\n` +
             `Оберіть категорію:`;

  if (messageIdToEdit) {
    try { fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, message_id: messageIdToEdit }) });
    } catch(e) {}
  }

  if (menu.photoId && menu.photoId.length > 10) {
    sendTelegramPhoto(chatId, menu.photoId, text, keyboard);
  } else {
    sendTelegramMessage(chatId, text, keyboard);
  }
}

// вечеря/сниданок/обид/перекус
function showCategoryDishes(chatId, category, messageIdToEdit, queryId) {
  var draft = getDraft(chatId);
  var dayIndex = draft.currentDayIndex || 0;
  var currentDayDate = draft.selectedDays[dayIndex];
  var dateObj = new Date(currentDayDate);
  var daysNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
  var dayName = daysNames[dateObj.getDay()];
  
  var menu = getMenuForDay(dayName) || {};
  var dishes = (menu && menu[category]) ? menu[category] : [];

  if (category === "snack" || category === "snack1" || category === "snack2") {
    dishes = menu.allSnacks || [];
   } else if (category === "extra") {
    var allD = [].concat(menu.breakfast||[], menu.lunch||[], menu.dinner||[], menu.allSnacks||[]);
    var unique = [], seen = {};
    for(var d=0; d<allD.length; d++) { if(!seen[allD[d].short]) { seen[allD[d].short]=true; unique.push(allD[d]); } }
    dishes = unique;
   }

   var isIndiv = draft.package.toLowerCase().includes("інд") || draft.package.toLowerCase().includes("ind");  

  if (dishes.length === 0) {
    quickAnswer(queryId, "⚠️ Категорія '" + category + "' на " + dayName + " порожня.");
    return;
  }

  var ordersForDay = (draft.orders && draft.orders[currentDayDate]) ? draft.orders[currentDayDate] : [];
  var keyboard = [];
  
  for (var i = 0; i < dishes.length; i++) {
    var dishFull = dishes[i].name;  // Повна назва для кнопки
    var dishShort = dishes[i].short; // Коротка назва для пошуку в базі
    
    var selectedItem = ordersForDay.find(o => o.category === category && normalizeString(o.dish) === normalizeString(dishShort));
    
    var icon = selectedItem ? "✅ " : "⬜️ ";
    var countLabel = (selectedItem && selectedItem.count > 1) ? (" — " + selectedItem.count + " шт") : "";
    
    keyboard.push([{ 
      text: icon + dishFull + countLabel, 
      callback_data: `toggle_dish_${category}_${i}` 
    }]);
  }

  keyboard.push([{ text: "🔙 Назад", callback_data: "back_to_day_menu" }]);
  var counterHint = isIndiv ? "\n\n<i>(1 клік = +1 порція, після 3-ї — видалення)</i>" : "";
  var catUkr = category === 'breakfast' ? 'Сніданок' : category === 'lunch' ? 'Обід' : category === 'dinner' ? 'Вечеря' : category === 'extra' ? 'Дод. страва' : 'Перекус';
  var text = `🍽 <b>${dayName}</b> — ${catUkr}\nОберіть страву:${counterHint}`;

  // ОПРЕДЕЛЕНИЕ МЕТОДА: если в меню есть фото, используем Caption
  var isPhoto = (menu.photoId && menu.photoId.length > 10);
  var method = isPhoto ? "editMessageCaption" : "editMessageText";
  
  var payload = {
    chat_id: chatId,
    message_id: messageIdToEdit,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({ inline_keyboard: keyboard })
  };
  
  if (isPhoto) payload.caption = text; else payload.text = text;

  fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/" + method, {
    method: "post", contentType: "application/json", payload: JSON.stringify(payload)
  });

  quickAnswer(queryId); 
}

// --- Логика заказа: Шаг 5 (Приборы) ---
function askCutlery(chatId) {
  var draft = getDraft(chatId);
  draft.step = "cutlery";
  saveDraft(chatId, draft);

  var keyboard = [
    [{ text: "1", callback_data: "set_cutlery_1" }, { text: "2", callback_data: "set_cutlery_2" }],
    [{ text: "3", callback_data: "set_cutlery_3" }, { text: "4", callback_data: "set_cutlery_4" }],
    [{ text: "Без приборів ❌", callback_data: "set_cutlery_0" }]
  ];
  keyboard.push([{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]);
  sendTelegramMessage(chatId, "🍴 Оберіть кількість приборів:", keyboard);
}

// --- Логика заказа: Шаг 6 (Пожелания) ---
function askNotes(chatId, messageIdToEdit) {
  var draft = getDraft(chatId);
  draft.step = "notes";
  saveDraft(chatId, draft);

  var btnText = (draft.notes && draft.notes !== "—") ? "Залишити поточні ➡️" : "Пропустити ➡️";
  var keyboard = [
    [{ text: btnText, callback_data: "skip_notes" }]
  ];
  keyboard.push([{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]);
  setUserStatus(chatId, "waiting_for_notes");
  
  var text = "📝 Напишіть ваші побажання або особливості (наприклад: 'не їм цибулю','алергія на яйця'):\n\nАбо натисніть '" + btnText.replace(" ➡️", "") + "'.";
  if (draft.notes && draft.notes !== "—") {
      text += "\n\nПоточні: <i>" + draft.notes + "</i>";
  }
  
  if (messageIdToEdit) {
      editTextMessage(chatId, messageIdToEdit, text, keyboard);
  } else {
      sendTelegramMessage(chatId, text, keyboard);
  }
}

// --- Финиш: Сохранение в таблицу Orders (Сгруппированный заказ) ---
function executeOrder(chatId, messageId){
  var draft = getDraft(chatId);
  if (!draft || !draft.orders) {
    sendTelegramMessage(chatId, "⚠️ Помилка: Кошик порожній.");
    return;
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var infoSheet = ss.getSheetByName(CLIENTS_SHEET);
  var clients = infoSheet.getDataRange().getValues();
  
  var phone = "";
  var clientName = "Невідомо";
  
  // Достаем телефон и имя из Info
  for (var i = 1; i < clients.length; i++) {
     if (clients[i][CHAT_COL-1] == chatId) {
         phone = clients[i][PHONE_COL-1];
         clientName = clients[i][1] || "Невідомо";
         break;
     }
  }

  var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
  var newRows = [];
  var now = new Date();
  var timeZone = "Europe/Kyiv";

  function getNiceDate(dateObj) {
     var d = new Date(dateObj);
     var days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
     var dd = d.getDate();
     var mm = d.getMonth() + 1;
     return (dd < 10 ? '0'+dd : dd) + "." + (mm < 10 ? '0'+mm : mm) + " (" + days[d.getDay()] + ")";
  }

  var catNames = { "breakfast": "Сніданок", "lunch": "Обід", "dinner": "Вечеря", "snack1": "Перекус 1", "snack2": "Перекус 2", "extra": "Дод. страва" };

  for (var dateKey in draft.orders) {
    var dayOrders = draft.orders[dateKey];
    if (!dayOrders || dayOrders.length === 0) continue;

    var dayName = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"][new Date(dateKey).getDay()];
    var menu = getMenuForDay(dayName) || {};

    var orderText = "Пакет " + draft.package + ":\n";
    for (var k = 0; k < dayOrders.length; k++) {
      var item = dayOrders[k];
      var dishName = item.dish;
      
      var isBig = false;
      if (item.category === "lunch" || item.category === "dinner") {
          isBig = true;
      } else if (item.category === "extra") {
          var inLunch = (menu.lunch || []).some(d => d.short === item.dish);
          var inDinner = (menu.dinner || []).some(d => d.short === item.dish);
          if (inLunch || inDinner) isBig = true;
      }

      if (draft.package && draft.package.match(/Active|Sport/i) && isBig) {
          dishName += "(1,5)";
      }

      if (item.category === "Сушка") {
        orderText += "🔹 " + dishName + "\n";
      } else {
        var catName = catNames[item.category] || item.category;
        var dishRepeated = Array(item.count).fill(dishName).join(" + ");
        orderText += "🔹 " + catName + ": " + dishRepeated + "\n";
      }
    }

     var row = [
         "'" + phone,                                    // A: Телефон
         chatId,                                         // B: Chat id
         getNiceDate(now),                               // C: Дата заказа
         getNiceDate(draft.weekStart),                   // D: Начало недели
         getNiceDate(dateKey),                           // E: День еды
         draft.package,                                  // F: Категория
         orderText.trim(),                               // G: Блюдо
         1,                                              // H: Количество
         Utilities.formatDate(now, timeZone, "HH:mm:ss"),// I: Время записи
         "Новий",                                        // J: Статус
         false,                                          // K: Оплачено
         draft.cutlery || "—",                           // L: Прибори (из бота)
         draft.notes || "—",                             // M: Особливості (из бота)
         clientName                                      // N: Ім'я
     ];
     newRows.push(row);
  }

  if (newRows.length === 0) {
     sendTelegramMessage(chatId, "Замовлення скасовано: не обрано жодної страви.");
     deleteDraft(chatId);
     return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
      ordersSheet.insertRowsAfter(1, newRows.length);
      ordersSheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
      ordersSheet.getRange(2, 11, newRows.length).insertCheckboxes();
  } catch (e) {
      logEvent('executeOrder Lock Error', e.message);
  } finally {
      lock.releaseLock();
  }
  deleteDraft(chatId);

  try { 
    fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/deleteMessage", { 
      method: "post", 
      contentType: "application/json", 
      payload: JSON.stringify({ chat_id: chatId, message_id: messageId }) 
    }); 
  } catch(e) {}

  var keyboard = [
      [{ text: "📋 Мої замовлення", callback_data: "my_orders" }],
      [{ text: "🛒 Нове замовлення", callback_data: "new_order" }]
  ];
  sendTelegramMessage(chatId, "✅ <b>Ваше замовлення прийнято!</b>\n\nДані передані адміністратору. \nБудь ласка, очікуйте підтвердження оплати.", keyboard);

  var orderedDaysList = Object.keys(draft.orders).map(function(d) {
      return Utilities.formatDate(new Date(d), "Europe/Kyiv", "dd.MM");
  }).join(", ");

  var adminMsg = `🚨 <b>Нове замовлення!</b>\n` +
                 `👤 Клієнт: <b>${clientName}</b> (${phone})\n` +
                 `📦 Пакет: ${draft.package}\n` +
                 `🗓 Дні (${Object.keys(draft.orders).length} шт): ${orderedDaysList}\n` +
                 `🍴 Прибори: ${draft.cutlery || "—"}\n` +
                 `📝 Особливості: <i>${draft.notes || "—"}</i>\n\n` +
                 `👉 Перевірте таблицю Orders для підтвердження оплати.`;
  ADMIN_CHAT_IDS.forEach(function(adminId) {
    sendTelegramMessage(adminId, adminMsg);
  });
}

function finishOrder(chatId, messageIdToEdit) {
  var draft = getDraft(chatId);
  if (!draft || !draft.orders) {
    sendTelegramMessage(chatId, "⚠️ Помилка: Кошик порожній.");
    return;
  }

  var orderText = "🛒 <b>Підсумок замовлення</b>\nПакет: <b>" + draft.package + "</b>\n\n";
  var catNames = { "breakfast": "Сніданок", "lunch": "Обід", "dinner": "Вечеря", "snack1": "Перекус 1", "snack2": "Перекус 2", "extra": "Дод. страва" };

  for (var dateKey in draft.orders) {
     var dayOrders = draft.orders[dateKey];
     if (!dayOrders || dayOrders.length === 0) continue;
     orderText += "📅 <b>" + dateKey + "</b>\n";
     
     var dayName = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"][new Date(dateKey).getDay()];
     var menu = getMenuForDay(dayName) || {};

     for (var k = 0; k < dayOrders.length; k++) {
      var item = dayOrders[k];
      var dishName = item.dish;

      var isBig = false;
      if (item.category === "lunch" || item.category === "dinner") {
          isBig = true;
      } else if (item.category === "extra") {
          var inLunch = (menu.lunch || []).some(d => d.short === item.dish);
          var inDinner = (menu.dinner || []).some(d => d.short === item.dish);
          if (inLunch || inDinner) isBig = true;
      }

      if (draft.package && draft.package.match(/Active|Sport/i) && isBig) {
          dishName += "(1,5)";
      }

      if (item.category === "Сушка") {
        orderText += "🔹 " + dishName + "\n";
      } else {
        var catName = catNames[item.category] || item.category;
        var dishRepeated = Array(item.count).fill(dishName).join(" + ");
        orderText += "🔹 " + catName + ": " + dishRepeated + "\n";
      }
    }
    orderText += "\n";
  }
  orderText += "🍽 Прибори: " + (draft.cutlery || "—") + "\n📝 Особливості: " + (draft.notes || "—");

  var keyboard = [
    [{ text: "✅ Підтвердити та відправити", callback_data: "confirm_order" }],
    [{ text: "✏️ Редагувати замовлення", callback_data: "edit_order_menu" }],
    [{ text: "❌ Скасувати замовлення", callback_data: "cancel_order" }]
  ];
  if (messageIdToEdit) {
      editTextMessage(chatId, messageIdToEdit, orderText, keyboard);
  } else {
      sendTelegramMessage(chatId, orderText, keyboard);
  }
}

// Подтвреждение оплаты, через кнопку (В таблицах)
function confirmPayments() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(ORDERS_SHEET);
  var data = sheet.getDataRange().getValues();

  var infoSheet = ss.getSheetByName(CLIENTS_SHEET);
  var infoData = infoSheet.getDataRange().getValues();
  var infoModified = false;
  
  var usersToNotify = {};
  var rowsToConfirm = [];
  var rowsToRevert = [];

  for (var i = 1; i < data.length; i++) {
    var phone = data[i][0];           // Колонка A (Телефон, индекс 0)
    var chatId = data[i][1];          // Колонка B (Chat id, индекс 1)
    var orderSummary = data[i][6];        // Колонка G: текст замовлення
    var foodDay = data[i][4];             // Колонка E: дата замовлення
    var status = String(data[i][9]).trim(); // Колонка J (Статус, индекс 9)
    var isPaid = data[i][10];         // Колонка K (Оплачено, индекс 10)

    var packageType = data[i][5];
    var cutlery = data[i][11] || "—";
    var notes = data[i][12] || "—";

    if (!phone) continue;

    if (isPaid === true) {
      // Відправляємо повідомлення ТІЛЬКИ якщо статус не "Оплачено" і не "Перенесено"
      if (status !== "Оплачено" && status !== "Перенесено" && status !== "Передано в учёт") {
        rowsToConfirm.push(i + 1);
        if (chatId) {
            // Групуємо замовлення за користувачем, якщо їх декілька
            if (!usersToNotify[chatId]) usersToNotify[chatId] = [];
            usersToNotify[chatId].push("📅 <b>На дату: " + foodDay + "</b>\n" + orderSummary);

            // Синхронізація з Info
            for (var j = 1; j < infoData.length; j++) {
                if (infoData[j][CHAT_COL-1] == chatId) {
                    infoData[j][5] = packageType; // F: Пакет
                    infoData[j][6] = cutlery;     // G: Прибори
                    infoData[j][7] = notes;       // H: Особливості
                    infoModified = true;
                    break;
                }
            }
        }
      }
    } else {
      if (status !== "Новий") {
        rowsToRevert.push(i + 1);
      }
    }
  }

  if (rowsToConfirm.length === 0 && rowsToRevert.length === 0) {
    SpreadsheetApp.getUi().alert("Немає змін для обробки.");
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (var r = 0; r < rowsToConfirm.length; r++) {
      sheet.getRange(rowsToConfirm[r], 10).setValue("Оплачено"); 
    }
    for (var r = 0; r < rowsToRevert.length; r++) {
      sheet.getRange(rowsToRevert[r], 10).setValue("Новий"); 
    }
    if (infoModified) {
        var outData = infoData.slice(1).map(function(row) {
            while (row.length < 8) row.push(""); 
            return row.slice(0, 8);
        });
        infoSheet.getRange(2, 1, outData.length, 8).setValues(outData);
    }
  } finally {
    lock.releaseLock();
  }

  var count = 0;
  for (var chat in usersToNotify) {
    if (chat) {
       var fullMessage = "✅ <b>Оплату отримано. Замовлення підтверджено!</b>\n\n" + 
                         usersToNotify[chat].join("\n\n──────────────\n\n");
       
       sendTelegramMessage(chat, fullMessage);
       Utilities.sleep(100);
       count++;
    }
  }

  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).sort([{column: 10, ascending: true}]);

  SpreadsheetApp.getUi().alert(
    "Статуси 'Оплачено': " + rowsToConfirm.length + 
    "\nСтатуси 'Новий' (перезаписано): " + rowsToRevert.length + 
    "\nПовідомлень: " + count
  );
}

// сборка листа "today"
function buildTodaySheet() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt("Формування таблиці Today", "Введіть дату доставки (формат: 16.02):", ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var targetDate = response.getResponseText().trim();
  
  if (!targetDate) return;

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
  var todaySheet = ss.getSheetByName(TODAY_SHEET);
  var infoSheet = ss.getSheetByName(CLIENTS_SHEET);

  var orders = ordersSheet.getDataRange().getValues();
  var info = infoSheet.getDataRange().getValues();

  var newRows = [];
  var rowsToMark = [];

  for (var i = 1; i < orders.length; i++) {
    //var isPaid = orders[i][10]; 
    var dateDelivery = String(orders[i][4]); 
    var status = String(orders[i][9]).trim();
    
    //if (isPaid === true && dateDelivery.includes(targetDate) && status !== "Перенесено") {
    if (dateDelivery.includes(targetDate) && status !== "Перенесено") {
      var phone = normalizePhone(orders[i][0]);
      var chatId = orders[i][1];
      var packageType = orders[i][5];
      var summary = orders[i][6].replace(/^Пакет.*:\n/i, "").trim().replace(/ \+ /g, "+");
      var cutlery = orders[i][11] || "";
      if (cutlery === "Без приборів" || cutlery === "—") cutlery = "";
      var notes = orders[i][12] || "";
      if (notes === "—") notes = "";

      var clientName = "—";
      var clientAddress = "—";
      
      for (var j = 1; j < info.length; j++) {
        if (normalizePhone(info[j][PHONE_COL-1]) === phone) {
          clientName = info[j][1] || "—";    
          clientAddress = info[j][3] || "—"; 
          break;
        }
      }

      newRows.push([
        "",             
        clientName,     
        "'" + phone,    
        clientAddress,  
        chatId,         
        "",             
        "",             
        "",             
        packageType,    
        summary,        
        cutlery,        
        notes,          
        ""              
      ]);
      rowsToMark.push(i + 1);
    }
  }

  if (newRows.length > 0) {
    var lastRow = todaySheet.getLastRow();
    var insertRow = lastRow > 0 ? lastRow + 1 : 2;
    
    todaySheet.getRange(insertRow, 1, newRows.length, newRows[0].length).setValues(newRows);
    
    for (var r = 0; r < rowsToMark.length; r++) {
      ordersSheet.getRange(rowsToMark[r], 10).setValue("Перенесено");
    }
    
    ui.alert("✅ Додано нових замовлень на " + targetDate + ": " + newRows.length + " шт.");
  } else {
    ui.alert("⚠️ Не знайдено нових оплачених замовлень на дату: " + targetDate);
  }
}

// --- Кнопка "Мої замовлення" (Активні + Історія) ---
function sendMyOrders(chatId, messageIdToEdit, page) {
  page = page || 0;
  var pageSize = 5;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
  var activeOrders = [];
  var lastRow = ordersSheet.getLastRow();
  
  if (lastRow >= 2) {
     var startRow = Math.max(2, lastRow - 500); // Скануємо лише останні 500
     var orders = ordersSheet.getRange(startRow, 1, lastRow - startRow + 1, 13).getValues();
     for (var i = orders.length - 1; i >= 0; i--) {
        if (orders[i][1] == chatId) {
           var rawDate = orders[i][4];
           var date = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "Europe/Kyiv", "dd.MM") : String(rawDate).replace(/\.\d{4}/, "");
           var isPaid = orders[i][10] ? "✅ Оплачено" : "⏳ Очікує оплати";
           var pkg = orders[i][5];
           activeOrders.push(`📅 <b>${date}</b> | ${pkg}\nСтатус: ${isPaid}`);
        }
     }
  }
  
  var archiveSheet = ss.getSheetByName("Archive");
  var historyOrders = [];
  if (archiveSheet) {
     var archLastRow = archiveSheet.getLastRow();
     if (archLastRow >= 2) {
         var aStartRow = Math.max(2, archLastRow - 500); // Скануємо лише останні 500
         var archiveData = archiveSheet.getRange(aStartRow, 1, archLastRow - aStartRow + 1, 13).getValues();
         for (var j = archiveData.length - 1; j >= 0; j--) {
            if (archiveData[j][1] == chatId) {
               var rawDate = archiveData[j][4];
               var date = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "Europe/Kyiv", "dd.MM") : String(rawDate).replace(/\.\d{4}/, "");
               var pkg = archiveData[j][5];
               historyOrders.push(`✔️ <b>${date}</b> | ${pkg}`);
            }
         }
     }
  }
  
  var allItems = activeOrders.concat(historyOrders);
  var totalPages = Math.ceil(allItems.length / pageSize);
  if (totalPages === 0) totalPages = 1;
  if (page >= totalPages) page = totalPages - 1;
  if (page < 0) page = 0;

  var itemsToShow = allItems.slice(page * pageSize, (page + 1) * pageSize);

  var textParts = [];
  if (allItems.length === 0) {
      textParts.push("🟢 <b>Ваші замовлення:</b>\nНемає історії доставок.");
  } else {
      textParts.push(`🟢 <b>Ваші замовлення (Сторінка ${page + 1} з ${totalPages}):</b>\n\n` + itemsToShow.join("\n\n"));
  }

  var text = textParts.join("\n\n──────────────\n\n");
  
  var keyboard = [];
  var navRow = [];
  if (page > 0) navRow.push({ text: "⬅️ Назад", callback_data: "my_orders_" + (page - 1) });
  if (page < totalPages - 1) navRow.push({ text: "Вперед ➡️", callback_data: "my_orders_" + (page + 1) });
  if (navRow.length > 0) keyboard.push(navRow);
  
  keyboard.push([{ text: "🔙 Головне меню", callback_data: "main_menu" }]);

  if (messageIdToEdit) {
      editTextMessage(chatId, messageIdToEdit, text, keyboard);
  } else {
      sendTelegramMessage(chatId, text, keyboard);
  }
}

// quickanswer
function quickAnswer(queryId, text) {
  var payload = { callback_query_id: queryId };
  if (text) {
    payload.text = text;
    payload.show_alert = true;
  }
  fetchWithRetry("https://api.telegram.org/bot" + TOKEN + "/answerCallbackQuery", {
    method: "post", contentType: "application/json", payload: JSON.stringify(payload)
  });
}

function autoArchiveDaily() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
    
    var archiveSheet = ss.getSheetByName("Archive");
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet("Archive");
      var header = ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getValues();
      archiveSheet.appendRow(header[0]);
    }
    
    var data = ordersSheet.getDataRange().getValues();
    var rowsToDelete = [];
    var rowsToArchive = [];
    
    var nowKyiv = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Kyiv"}));
    var todayMidnight = new Date(nowKyiv.getFullYear(), nowKyiv.getMonth(), nowKyiv.getDate()).getTime();
    var sevenDaysAgo = todayMidnight - (7 * 24 * 60 * 60 * 1000);
    
    for (var i = data.length - 1; i >= 1; i--) {
      var rawDate = data[i][4]; 
      var status = String(data[i][9]).trim();
      var isPaid = (data[i][10] === true || String(data[i][10]).toUpperCase() === "TRUE");
      var orderDate = null;
      
      if (rawDate instanceof Date) {
        orderDate = new Date(nowKyiv.getFullYear(), rawDate.getMonth(), rawDate.getDate());
      } else if (rawDate) {
        var match = String(rawDate).match(/(\d{2})\.(\d{2})/);
        if (match) {
          var d = parseInt(match[1], 10);
          var m = parseInt(match[2], 10) - 1;
          var y = nowKyiv.getFullYear();
          orderDate = new Date(y, m, d);
          if (m === 11 && nowKyiv.getMonth() === 0) orderDate.setFullYear(y - 1);
        }
      }
      
      if (orderDate) {
         var orderTime = orderDate.getTime();
         
         if (orderTime < todayMidnight) {
            
            /* СТАРАЯ ЛОГИКА (Удаление неоплаченных (может понадобиться позже)):
            if (!isPaid) {
                rowsToDelete.push(i + 1);
            } else {
                var isProcessed = (status === "Перенесено" || status === "Передано в учёт" || status === "Виконано");
                
                if (isProcessed) {
                    rowsToArchive.push(data[i]);
                    rowsToDelete.push(i + 1);
                } else if (orderTime <= sevenDaysAgo) {
                    rowsToArchive.push(data[i]);
                    rowsToDelete.push(i + 1);
                }
            }
            */

            // НОВАЯ ЛОГИКА (Архивация обработанных или оплаченных, удаление мусора старше 7 дней):
            var isProcessed = (status === "Перенесено" || status === "Передано в учёт" || status === "Виконано");
            
            if (isProcessed || isPaid) {
                rowsToArchive.push(data[i]);
                rowsToDelete.push(i + 1);
            } else if (orderTime <= sevenDaysAgo) {
                rowsToDelete.push(i + 1);
            }
         }
      }
    }
    
    if (rowsToArchive.length > 0) {
       rowsToArchive.reverse(); 
       
       for (var r = 0; r < rowsToArchive.length; r++) {
           var phoneStr = String(rowsToArchive[r][0] || "");
           if (phoneStr && !phoneStr.startsWith("'")) {
               rowsToArchive[r][0] = "'" + phoneStr;
           }
       }
       
       archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length).setValues(rowsToArchive);
    }
    
    var archivedCount = rowsToArchive.length;
    var deletedTrashCount = rowsToDelete.length - rowsToArchive.length;

    if (rowsToDelete.length > 0) {
       for (var k = 0; k < rowsToDelete.length; k++) {
          ordersSheet.deleteRow(rowsToDelete[k]);
       }
       logEvent('autoArchiveDaily', 'Архівовано: ' + archivedCount + ', Видалено сміття: ' + deletedTrashCount);
    }
    
    return { archived: archivedCount, deleted: deletedTrashCount }; 
    
  } finally {
    lock.releaseLock();
  }
}

function manualArchiveDaily() {
  var result = autoArchiveDaily(); 
  var ui = SpreadsheetApp.getUi();
  
  if (result.archived > 0 || result.deleted > 0) {
     var msg = "Обробку старих замовлень завершено!\n\n";
     
     if (result.archived > 0) {
         msg += "Перенесено в Архів: " + result.archived + " шт.\n";
     }
     if (result.deleted > 0) {
         msg += "Видалено (старі неоплачені): " + result.deleted + " шт.";
     }
     
     ui.alert(msg);
  } else {
     ui.alert("Немає замовлень з минулими датами для обробки.");
  }
}

function openNextWeekMenu() {
  PropertiesService.getScriptProperties().setProperty('NEXT_WEEK_OPEN', 'true');
  
  // Очищення кешу меню
  var cache = CacheService.getScriptCache();
  ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"].forEach(day => cache.remove("menu_" + day));
  
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Меню відкрито",
    "Замовлення на наступний тиждень відкрито.\nВведіть текст повідомлення для розсилки всім активним клієнтам (або залиште порожнім, щоб оновити тихо):",
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    var text = response.getResponseText().trim();
    if (text) {
      var sent = sendBroadcastWebRPC(text, "active", "");
      ui.alert("Розсилка завершена. Відправлено повідомлень: " + sent);
    } else {
      ui.alert("Тихе оновлення. Розсилку скасовано.");
    }
  }
}

// --- WEB INTERFACE (Admin Panel SPA) ---
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Адмін-панель доставки')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- RPC: Меню ---
function getMenuDataRPC() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var fullData = ss.getSheetByName(MENU_SHEET).getDataRange().getDisplayValues();
  var menuData = [], packageData = [];
  for (var i = 1; i < fullData.length; i++) {
    if (fullData[i][0] && String(fullData[i][0]).trim() !== "") {
       var mRow = [];
       for (var c = 0; c < 10; c++) mRow.push(fullData[i][c] !== undefined ? fullData[i][c] : "");
       menuData.push(mRow);
    }
    if (fullData[i].length > 11 && fullData[i][11] && String(fullData[i][11]).trim() !== "") {
       packageData.push([fullData[i][11], fullData[i].length > 12 ? fullData[i][12] : ""]);
    }
  }
  return { menu: menuData, packages: packageData };
}

function saveMenuDataRPC(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(MENU_SHEET);
    if (payload.menu && payload.menu.length > 0) sheet.getRange(2, 1, payload.menu.length, 10).setValues(payload.menu);
    if (payload.packages && payload.packages.length > 0) sheet.getRange(2, 12, payload.packages.length, 2).setValues(payload.packages);
    ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"].forEach(day => CacheService.getScriptCache().remove("menu_" + day));
    return "ok";
  } catch (e) { return e.message; } finally { lock.releaseLock(); }
}

// --- RPC: CRM (Касса) ---
// --- АВТОРИЗАЦИЯ ТА RPC ---
function verifyAdminPinRPC(pin) {
  var correctPin = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN') || "1234";
  return pin === correctPin;
}

function requireAuth(pin) {
  if (!verifyAdminPinRPC(pin)) throw new Error("Unauthorized");
}

function getPendingOrdersRPC(pin) {
  requireAuth(pin);
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(ORDERS_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  var startRow = Math.max(2, lastRow - 500); // Читаємо лише останні 500 рядків
  var numRows = lastRow - startRow + 1;
  var data = sheet.getRange(startRow, 1, numRows, 13).getDisplayValues();
  
  var pending = [];
  for(var i=0; i<data.length; i++) {
     if (!data[i][0] || String(data[i][0]).trim() === "") continue; 
     if(data[i][9] === "Новий" || data[i][10].toLowerCase() === "false") {
        pending.push({ rowIdx: startRow + i, phone: data[i][0], chatId: data[i][1], date: data[i][4], pkg: data[i][5], summary: data[i][6] });
     }
  }
  return pending;
}

function confirmOrderWebRPC(rowNum, pin) {
  requireAuth(pin);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
    var rowData = ordersSheet.getRange(rowNum, 1, 1, 13).getValues()[0];
    ordersSheet.getRange(rowNum, 10).setValue("Оплачено");
    ordersSheet.getRange(rowNum, 11).setValue(true);
    
    var infoSheet = ss.getSheetByName(CLIENTS_SHEET);
    var infoData = infoSheet.getDataRange().getValues();
    for(var i=1; i<infoData.length; i++) {
       if(infoData[i][4] == rowData[1]) {
          infoSheet.getRange(i+1, 6).setValue(rowData[5]);
          infoSheet.getRange(i+1, 7).setValue(rowData[11] || "—");
          infoSheet.getRange(i+1, 8).setValue(rowData[12] || "—");
          break;
       }
    }
    sendTelegramMessage(rowData[1], "✅ <b>Оплату отримано. Замовлення підтверджено!</b>\n\n📅 <b>На дату: " + rowData[4] + "</b>\n" + rowData[6]);
    return "ok";
  } catch(e) { return e.message; } finally { lock.releaseLock(); }
}

function rejectOrderWebRPC(rowNum, chatId, pin) {
  requireAuth(pin);
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ORDERS_SHEET);
  sheet.deleteRow(rowNum);
  if(chatId) sendTelegramMessage(chatId, "❌ Ваше замовлення було відхилено адміністратором (немає оплати або скасовано).");
  return "ok";
}

// --- RPC: Логистика (Today) ---
function buildTodayWebRPC(targetDate, pin) {
   requireAuth(pin);
   var ss = SpreadsheetApp.openById(SHEET_ID);
   var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
   var todaySheet = ss.getSheetByName(TODAY_SHEET);
   var infoSheet = ss.getSheetByName(CLIENTS_SHEET);
   var orders = ordersSheet.getDataRange().getValues();
   var info = infoSheet.getDataRange().getValues();
   var newRows = [], rowsToMark = [];

   for (var i = 1; i < orders.length; i++) {
     //if (orders[i][10] === true && String(orders[i][4]).includes(targetDate) && String(orders[i][9]).trim() !== "Перенесено") {
    if (String(orders[i][4]).includes(targetDate) && String(orders[i][9]).trim() !== "Перенесено") {
       var phone = normalizePhone(orders[i][0]); 
       var clientName = "—", clientAddress = "—";
       for (var j = 1; j < info.length; j++) {
         if (normalizePhone(info[j][PHONE_COL-1]) === phone) { clientName = info[j][1] || "—"; clientAddress = info[j][3] || "—"; break; }
       }
       newRows.push(["", clientName, "'" + phone, clientAddress, orders[i][1], "", "", "", orders[i][5], orders[i][6].replace(/^Пакет.*:\n/i, "").trim(), orders[i][11] || "", orders[i][12] || "", ""]);
       rowsToMark.push(i + 1);
     }
   }
   if (newRows.length > 0) {
     todaySheet.getRange(todaySheet.getLastRow() > 0 ? todaySheet.getLastRow() + 1 : 2, 1, newRows.length, newRows[0].length).setValues(newRows);
     for (var r = 0; r < rowsToMark.length; r++) ordersSheet.getRange(rowsToMark[r], 10).setValue("Перенесено");
     return "Додано: " + newRows.length;
   } else return "Немає нових замовлень.";
}

function getTodaySheetRPC(pin) {
  requireAuth(pin);
  var data = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TODAY_SHEET).getDataRange().getDisplayValues();
  if(data.length < 2) return { rows: [], general: "" };
  var rows = [];
  for(var i = 1; i < data.length; i++) {
    if(!data[i][2] && !data[i][1]) continue; 
    rows.push({ 
      rowIdx: i + 1, 
      name: data[i][1], 
      phone: data[i][2], 
      address: data[i][3], 
      time: data[i][5], 
      note: data[i][6] 
    });
  }
  return { rows: rows, general: data[1][7] || "" };
}

function saveTodaySheetRPC(payload, pin) {
  requireAuth(pin);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TODAY_SHEET);
    if(payload.rows && payload.rows.length > 0) {
       for(var i = 0; i < payload.rows.length; i++) {
         var r = payload.rows[i];
         var phoneVal = String(r.phone);
         if (phoneVal && !phoneVal.startsWith("'")) phoneVal = "'" + phoneVal;
         
         if (r.rowIdx) {
           sheet.getRange(r.rowIdx, 2, 1, 3).setValues([[r.name, phoneVal, r.address]]);
           sheet.getRange(r.rowIdx, 6, 1, 2).setValues([[r.time, r.note]]);
         } else {
           sheet.appendRow(["", r.name, phoneVal, r.address, "", r.time, r.note]);
         }
       }
    }
    sheet.getRange("H2").setValue(payload.general);
    return "ok";
  } catch (e) { return e.message; } finally { lock.releaseLock(); }
}

// --- RPC Меню ---
function getMenuDataRPC(pin) {
  requireAuth(pin);
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var fullData = ss.getSheetByName(MENU_SHEET).getDataRange().getDisplayValues();
  var menuData = [], packageData = [];
  for (var i = 1; i < fullData.length; i++) {
    if (fullData[i][0] && String(fullData[i][0]).trim() !== "") {
       var mRow = [];
       for (var c = 0; c < 10; c++) mRow.push(fullData[i][c] !== undefined ? fullData[i][c] : "");
       menuData.push(mRow);
    }
    if (fullData[i].length > 11 && fullData[i][11] && String(fullData[i][11]).trim() !== "") {
       packageData.push([fullData[i][11], fullData[i].length > 12 ? fullData[i][12] : ""]);
    }
  }
  return { menu: menuData, packages: packageData };
}

function saveMenuDataRPC(payload, pin) {
  requireAuth(pin);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(MENU_SHEET);
    if (payload.menu && payload.menu.length > 0) sheet.getRange(2, 1, payload.menu.length, 10).setValues(payload.menu);
    if (payload.packages && payload.packages.length > 0) sheet.getRange(2, 12, payload.packages.length, 2).setValues(payload.packages);
    ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"].forEach(day => CacheService.getScriptCache().remove("menu_" + day));
    return "ok";
  } catch (e) { return e.message; } finally { lock.releaseLock(); }
}

// --- АСИНХРОННА ЧЕРГА РОЗСИЛОК ---
function sendAllTodayWebRPC(pin) {
  requireAuth(pin);
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var data = ss.getSheetByName(TODAY_SHEET).getDataRange().getValues();
  var clientsData = ss.getSheetByName(CLIENTS_SHEET).getDataRange().getValues();
  var generalNote = data.length > 1 ? (data[1][7] || "").toString().trim() : "";
  
  var queueItems = [];
  for (var i = 1; i < data.length; i++) {
    var time = (data[i][5] || "").toString().trim();
    var note = (data[i][6] || "").toString().trim();
    if (!time && !note && !generalNote) continue;
    var infoChat = getChatFromInfoByPhone(normalizePhone(data[i][2]), clientsData);
    if (!infoChat) continue;
    var parts = [`ПІБ: <b>${data[i][1] || "Невідомо"}</b>`];
    if (time) parts.push(`Час доставки: ${time}⏰`);
    if (note) parts.push(`<b>Нотатка для Вас:</b>\n${note}`);
    if (generalNote) parts.push(`<b>Загальна нотатка:</b>\n${generalNote}`);
    
    queueItems.push({ text: `Сьогодні у вас інформація:\n` + parts.join("\n\n"), chatIds: [infoChat] });
  }
  
  if (queueItems.length === 0) return 0;
  enqueuePromoTasks(queueItems);
  return queueItems.length;
}

function sendBroadcastWebRPC(text, target, customPhone, pin) {
  // Для виклику з меню Google Sheets (де немає pin) або з Web App
  if (pin !== undefined) requireAuth(pin); 
  
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var chatIds = [];
  
  if(target === "all") {
     var info = ss.getSheetByName(CLIENTS_SHEET).getDataRange().getValues();
     for(var i=1; i<info.length; i++) if(info[i][4]) chatIds.push(info[i][4]);
  } else if(target === "active") {
     var orders = ss.getSheetByName(ORDERS_SHEET).getDataRange().getValues();
     for(var j=1; j<orders.length; j++) {
        if((orders[j][9] === "Новий" || orders[j][9] === "Оплачено" || orders[j][9] === "Перенесено") && orders[j][1]) chatIds.push(orders[j][1]);
     }
  } else if(target === "today") {
     var todayData = ss.getSheetByName(TODAY_SHEET).getDataRange().getValues();
     var infoData = ss.getSheetByName(CLIENTS_SHEET).getDataRange().getValues();
     for(var t=1; t<todayData.length; t++) {
        var phone = normalizePhone(todayData[t][2]); 
        if (phone) {
           for(var k=1; k<infoData.length; k++) {
              if(normalizePhone(infoData[k][2]) === phone && infoData[k][4]) {
                 chatIds.push(infoData[k][4]);
                 break;
              }
           }
        }
     }
  } else if(target === "custom") {
     var norm = normalizePhone(customPhone);
     var info = ss.getSheetByName(CLIENTS_SHEET).getDataRange().getValues();
     for(var k=1; k<info.length; k++) {
        if(normalizePhone(info[k][2]) === norm && info[k][4]) chatIds.push(info[k][4]);
     }
  }
  
  chatIds = chatIds.filter(function(item, pos) { return chatIds.indexOf(item) == pos; });
  if (chatIds.length === 0) return 0;
  
  enqueuePromoTasks([{ text: text, chatIds: chatIds }]);
  return chatIds.length;
}

function enqueuePromoTasks(tasks) {
  var props = PropertiesService.getScriptProperties();
  var queue = JSON.parse(props.getProperty('PROMO_QUEUE') || "[]");
  queue = queue.concat(tasks);
  props.setProperty('PROMO_QUEUE', JSON.stringify(queue));
  
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = triggers.some(t => t.getHandlerFunction() === 'processPromoQueue');
  if (!hasTrigger) {
      ScriptApp.newTrigger('processPromoQueue').timeBased().everyMinutes(1).create();
  }
}

function processPromoQueue() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // Запобіжник від паралельного виконання тригерів
  
  try {
     var queueStr = props.getProperty('PROMO_QUEUE');
     if (!queueStr) return clearPromoTriggers();
     
     var queue = JSON.parse(queueStr);
     if (queue.length === 0) return clearPromoTriggers();
     
     var batchLimit = 30; // Максимум 30 повідомлень за 1 хвилину
     var sent = 0;
     
     while (queue.length > 0 && sent < batchLimit) {
         var task = queue[0];
         if (task.chatIds.length === 0) {
             queue.shift(); // Завдання виконано
             continue;
         }
         var chatId = task.chatIds.shift();
         sendTelegramMessage(chatId, task.text);
         sent++;
         Utilities.sleep(100);
     }
     
     props.setProperty('PROMO_QUEUE', JSON.stringify(queue));
  } catch(e) {
     logEvent('processPromoQueue error', e.message);
  } finally {
     lock.releaseLock();
  }
}

function clearPromoTriggers() {
   PropertiesService.getScriptProperties().deleteProperty('PROMO_QUEUE');
   var triggers = ScriptApp.getProjectTriggers();
   for (var i = 0; i < triggers.length; i++) {
       if (triggers[i].getHandlerFunction() === 'processPromoQueue') {
           ScriptApp.deleteTrigger(triggers[i]);
       }
   }
}
/*function debugExternalSheet() {
  var extSS = SpreadsheetApp.openById(PROPS.getProperty('EXTERNAL_SHEET_ID'));
  var sheet = extSS.getSheetByName("23.02"); // вказати актуальну назву листа
  var data = sheet.getRange("A1:L5").getValues();
  Logger.log(JSON.stringify(data));
}*/
