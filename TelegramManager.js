const TELEGRAM_BOT_TOKEN = '8272074521:AAGwXTUem-LBJ-2tQYUqcht-WOSYLL0zwCQ';
const TELEGRAM_CHAT_ID = '-4851269062';

class TelegramManager {
  /** Відправляє повідомлення в Telegram групу
   * @param {string} message - Текст повідомлення*/
  static sendMessage(message) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      };

      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      UrlFetchApp.fetch(url, options);
    } catch (error) {
      console.log('Помилка відправки в Telegram: ' + error.toString());
    }
  }

  /** Сповіщення про створення замовлення
   * @param {string} partnerOrderId - Номер замовлення
   * @param {Array} orderItems - Масив оброблених товарів з reservedQuantity*/
  static notifyOrderCreated(partnerOrderId, orderItems) {
    let message = `🆕 <b>Розетка створила замовлення</b>\n\n`;
    message += `📋 <b>Номер замовлення:</b> ${partnerOrderId}\n\n`;
    message += `📦 <b>Перелік товарів:</b>\n`;

    orderItems.forEach((item, index) => {
      const status = item.reservedQuantity === item.quantity ? '✅' : '⚠️';
      message += `${index + 1}. ${item.RZ_code} — ${item.quantity} шт. (заброньовано ${item.reservedQuantity} шт.) ${status}\n`;
    });

    this.sendMessage(message);
  }

  /** Сповіщення про редагування замовлення
   * @param {string} partnerOrderId - Номер замовлення
   * @param {Array} orderItems - Масив оброблених товарів з reservedQuantity*/
  static notifyOrderEdited(partnerOrderId, orderItems) {
    let message = `✏️ <b>Розетка змінює замовлення</b>\n\n`;
    message += `📋 <b>Номер замовлення:</b> ${partnerOrderId}\n\n`;
    message += `📦 <b>Новий перелік товарів:</b>\n`;

    orderItems.forEach((item, index) => {
      const status = item.reservedQuantity === item.quantity ? '✅' : '⚠️';
      message += `${index + 1}. ${item.RZ_code} — ${item.quantity} шт. (заброньовано ${item.reservedQuantity} шт.) ${status}\n`;
    });

    this.sendMessage(message);
  }

  /** Сповіщення про скасування замовлення
   * @param {string} partnerOrderId - Номер замовлення*/
  static notifyOrderCanceled(partnerOrderId) {
    const message = `❌ <b>Розетка видалила замовлення</b>\n\n` +
                   `📋 <b>Номер замовлення:</b> ${partnerOrderId}`;
    
    this.sendMessage(message);
  }

  /** Сповіщення про завантаження файлу
   * @param {string} partnerOrderId - Номер замовлення
   * @param {string} fileGuid - ID файлу в Google Drive*/
  static notifyFileUploaded(partnerOrderId, fileGuid) {
    const fileUrl = `https://drive.google.com/file/d/${fileGuid}/view`;
    const message = `📄 <b>Розетка відправила документ</b>\n\n` +
                   `📋 <b>Замовлення:</b> ${partnerOrderId}\n` +
                   `🔗 <b>Посилання:</b> <a href="${fileUrl}">Переглянути документ</a>`;
    
    this.sendMessage(message);
  }

  /** Сповіщення про видалення файлу
   * @param {string} fileGuid - ID файлу*/
  static notifyFileDeleted(fileGuid) {
    const message = `🗑️ <b>Розетка видалила документ</b>\n\n` +
                   `📁 <b>ID документа:</b> ${fileGuid}`;
    
    this.sendMessage(message);
  }

  /** Сповіщення про помилку
   * @param {string} action - Дія в якій сталася помилка
   * @param {string} errorMessage - Текст помилки
   * @param {string} guid - GUID (якщо є)*/
  static notifyError(action, errorMessage, guid = '') {
    let message = `⚠️ <b>Тільки що сталась помилка!</b>\n\n`;
    message += `🔧 <b>Дія:</b> ${action}\n`;
    
    if (guid) {
      message += `🆔 <b>GUID:</b> ${guid}\n`;
    }
    
    message += `❗ <b>Помилка:</b> ${errorMessage}`;
    
    this.sendMessage(message);
  }
}

