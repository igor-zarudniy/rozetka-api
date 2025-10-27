const PROJECT_ID = '1n-OJR0yWGvLK-3GUePfQlj_LI7g1q4T5WeHUJy7P0yQ'
const FILES_FOLDER_ID = '1Q8DqJGifnvGsa6DDJXBwBw4kfGmga4DO'

class OrderKeeper {
  /** Створює нове замовлення
   * @param {Object} orderData - Дані замовлення від Розетки
   * @returns {ContentService.TextOutput} - Відповідь про створення замовлення*/
  static createOrder(orderData) {
    const validation = this.validateOrderData(orderData);
    if (!validation.valid)
      return Response.error(validation.error, 400);

    const guid = this.saveOrderToSheet(orderData);
    const orderItems = this.processOrderItems(orderData.header.products);
    return Response.created(guid, orderItems);
  }


  /** Валідує дані замовлення
   * @param {Object} data - Об'єкт з даними замовлення
   * @returns {Object} - Результат валідації*/
  static validateOrderData(data) {
    if (!data.header)
      return { valid: false, error: 'Недійсні дані замовлення' };

    if (!data.header.products || !Array.isArray(data.header.products))
      return { valid: false, error: 'Недійсні дані замовлення' };

    if (data.header.products.length === 0)
      return { valid: false, error: 'Недійсні дані замовлення' };

    if (!data.header.partnerOrderId)
      return { valid: false, error: 'Недійсні дані замовлення' };

    return { valid: true };
  }

  /** Перетворює масив товарів замовлення в окремі поля з об'єднаними значеннями
   * @param {Object} orderData - Об'єкт з даними замовлення
   * @param {Object} orderData.header - Заголовок замовлення з даними клієнта та товарами
   * @returns {Object} - Об'єкт замовлення з розгорнутими полями products (значення через \n)*/
  static flattenOrder(orderData, status = 'created', uuid) {
    let guid = !uuid ? Utilities.getUuid() : uuid;
    let products = orderData.products
    let productKeys = Object.keys(products[0]);
    let preparedOrder = {};

    for (let keyIndex = 0; keyIndex < productKeys.length; keyIndex++) {
      const key = productKeys[keyIndex];
      const values = [];

      for (let productIndex = 0; productIndex < products.length; productIndex++) {
        values.push(products[productIndex][key] || '');
      }

      preparedOrder[key] = values.join('\n');
    }

    preparedOrder = { ...preparedOrder, ...orderData, guid }
    delete preparedOrder.products
    delete preparedOrder.deliveryAddresType
    preparedOrder.status = status
    preparedOrder.date = DateManager.createCurrentDate()
    return preparedOrder
  }

  /** Зберігає замовлення в Google Sheets
   * @param {Object} orderData - Дані замовлення від Розетки*/
  static saveOrderToSheet(orderData) {
    const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
    const preparedOrder = this.flattenOrder(orderData.header)
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', 'Orders')
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, 'Orders')
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)
    sheetRange.insertRowBefore(2)
    const array = [];

    for (let key in headerMap) {
      const elIndex = headerMap[key].colIndex;
      const value = preparedOrder[key];
      if(value) continue
      array[elIndex] = value;
    }
    sheetRange.getRange(2, 1, 1, array.length).setValues([array])
    return orderData.guid
  }

  /** Обробляє список товарів замовлення
   * @param {Array} products - Масив товарів
   * @returns {Array} - Масив оброблених товарів
   */
  static processOrderItems(products) {
    const processedItems = [];

    for (let index = 0; index < products.length; index++) {
      const product = products[index];

      const item = {
        supplier_code: product.supplier_code,
        RZ_code: product.RZ_code,
        price: product.price,
        quantity: product.quantity,
        reservedPrice: product.price,
        reservedQuantity: product.quantity,
        result: true
      };

      processedItems.push(item);
    }

    return processedItems;
  }

  /** Скасовує замовлення за GUID
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @returns {ContentService.TextOutput} - Відповідь про скасування замовлення*/
  static cancelOrder(guid) {
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, 'Orders')
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid)
    if (!coordinates?.colIndex) return Response.error('Замовлення не знайдено', 404)

    const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', 'Orders')
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)
    sheetRange.getRange(coordinates.rowIndex + 1, headerMap.status.colIndex + 1).setValue('canceled')
    return Response.canceled(guid)
  }

  /** Редагує існуюче замовлення в Google Sheets
   * Знаходить замовлення за GUID та оновлює тільки змінені поля
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Object} requestData - Об'єкт з даними для оновлення
   * @returns {ContentService.TextOutput} - JSON відповідь з підтвердженням оновлення або помилка 404*/
  static editOrder(guid, requestData) {
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, 'Orders')
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid)
    if (!coordinates?.colIndex) return Response.error('Замовлення не знайдено', 404)

    const preparedOrder = this.flattenOrder(requestData, 'pending', guid)
    const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', 'Orders')
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)

    for (let key in headerMap) {
      if (key === 'date') continue
      const colIndex = headerMap[key].colIndex
      const rowIndex = coordinates.rowIndex
      const value = preparedOrder[key]
      const currentValue = sheetData[rowIndex][colIndex]
      if (!value || value === currentValue) continue

      sheetRange.getRange(rowIndex + 1, colIndex + 1).setValue(value)
    }
    return Response.updated(guid)
  }

  /** Завантажує файл для замовлення в Google Drive
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Object} filePayload - Об'єкт з base64 даними файлу
   * @returns {ContentService.TextOutput} - JSON відповідь з file_guid або помилка 404*/
  static uploadFile(guid, filePayload) {
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, 'Orders')
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid)
    if (!coordinates?.colIndex) return Response.error('Замовлення не знайдено', 404)

    try {
      if (!filePayload.fileData || !filePayload.isBase64) {
        return Response.error('Невірний формат файлу', 400);
      }

      const fileName = `order_${guid}_${DateManager.createCurrentDate()}`;
      const mimeType = filePayload.mimeType || 'application/octet-stream';
      const binaryData = Utilities.base64Decode(filePayload.fileData);

      const fileBlob = Utilities.newBlob(binaryData, mimeType, fileName);

      Logger.log(`Створюємо файл: ${fileName}, MIME: ${mimeType}, Розмір blob: ${fileBlob.getBytes().length} байт`);

      const fileMetadata = {
        name: fileName,
        parents: [FILES_FOLDER_ID],
        mimeType: mimeType
      };

      const file = Drive.Files.create(fileMetadata, fileBlob, {
        fields: 'id,name,size,mimeType'
      });

      const fileGuid = file.id;

      Logger.log(`Файл успішно завантажено: ${fileGuid}, розмір: ${file.size} байт, назва: ${file.name}`);

      const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
      const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', 'Orders')
      InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)

      if (headerMap.file_guid) {
        const colIndex = headerMap.file_guid.colIndex + 1
        const fileIndex = headerMap.file_url.colIndex + 1
        const rowIndex = coordinates.rowIndex + 1
        sheetRange.getRange(rowIndex, colIndex).setValue(fileGuid)
        sheetRange.getRange(rowIndex, fileIndex).setValue(`https://drive.google.com/file/d/${fileGuid}`)
      }

      return Response.fileUploaded(fileGuid);

    } catch (error) {
      Logger.log('Помилка при завантаженні файлу: ' + error.toString());
      Logger.log('Stack trace: ' + error.stack);
      return Response.error('Помилка при завантаженні файлу: ' + error.message, 500);
    }
  }

  /** Видаляє файл з Google Drive та очищує дані в таблиці
   * @param {string} fileGuid - Унікальний ідентифікатор файлу в Google Drive
   * @returns {ContentService.TextOutput} - JSON відповідь з підтвердженням видалення або помилка 404*/
  static deleteFile(fileGuid) {
    try {
      let fileExists = false;
      try {
        Drive.Files.get(fileGuid);
        fileExists = true;
      } catch (e) {
        Logger.log('Файл не знайдено в Drive: ' + fileGuid);
      }

      if (fileExists) {
        Drive.Files.remove(fileGuid);
        Logger.log('Файл видалено з Drive: ' + fileGuid);
      }

      const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, 'Orders');
      const coordinates = InputKeeper.findHeaderCoordinates(sheetData, fileGuid);

      if (!coordinates?.colIndex) {
        Logger.log('Рядок з file_guid не знайдено в таблиці');
        return Response.fileDeleted();
      }

      const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData;
      const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', 'Orders');
      InputKeeper.mapHeadersToCoordinates(sheetData, headerMap);

      const rowIndex = coordinates.rowIndex;

      if (headerMap.file_guid) {
        sheetRange.getRange(rowIndex + 1, headerMap.file_guid.colIndex + 1).clearContent();
        Logger.log('Очищено file_guid в рядку ' + (rowIndex + 1));
      }

      if (headerMap.file_url) {
        sheetRange.getRange(rowIndex + 1, headerMap.file_url.colIndex + 1).clearContent();
        Logger.log('Очищено file_url в рядку ' + (rowIndex + 1));
      }

      return Response.fileDeleted();

    } catch (error) {
      Logger.log('Помилка при видаленні файлу: ' + error.toString());
      Logger.log('Stack trace: ' + error.stack);
      return Response.error('Помилка при видаленні файлу: ' + error.message, 500);
    }
  }

  /** Отримує статус замовлення за GUID
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @returns {ContentService.TextOutput} - JSON відповідь зі статусом замовлення або помилка 404*/
  static getOrderStatus(guid) {
    const { sheetData } = InputKeeper.readSheetData(PROJECT_ID, 'Orders');
    const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData;
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', 'Orders');
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap);
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid);
    
    if (!coordinates?.colIndex) {
      return Response.error('Замовлення не знайдено', 404);
    }

    const rowIndex = coordinates.rowIndex;
    
    // Збираємо всі дані з рядка
    const orderData = {};
    for (let key in headerMap) {
      const colIndex = headerMap[key].colIndex;
      orderData[key] = sheetData[rowIndex][colIndex];
    }

    // Розбиваємо дані товарів (вони зберігаються через \n)
    const supplierCodes = (orderData.supplier_code || '').toString().split('\n');
    const rzCodes = (orderData.RZ_code || '').toString().split('\n');
    const quantities = (orderData.quantity || '').toString().split('\n');
    const prices = (orderData.price || '').toString().split('\n');
    
    // Розбиваємо серійні номери (вони зберігаються через кому для всіх товарів)
    const allSerialNumbers = (orderData.SerialNumber || '').toString()
      .split(',')
      .map(sn => sn.trim())
      .filter(sn => sn.length > 0);

    // Формуємо масив products
    const products = [];
    let serialNumberIndex = 0; // Індекс для розподілу серійних номерів

    for (let i = 0; i < supplierCodes.length; i++) {
      if (!supplierCodes[i]) continue; // Пропускаємо порожні

      const quantity = parseInt(quantities[i]) || 0;
      
      // Беремо серійні номери для цього товару згідно quantity
      const productSerialNumbers = [];
      for (let j = 0; j < quantity; j++) {
        if (serialNumberIndex < allSerialNumbers.length) {
          productSerialNumbers.push(allSerialNumbers[serialNumberIndex]);
          serialNumberIndex++;
        }
      }

      products.push({
        supplier_code: supplierCodes[i].trim(),
        RZ_code: parseInt(rzCodes[i]) || rzCodes[i],
        quantity: quantity,
        reservedQuantity: quantity,
        SerialNumber: productSerialNumbers
      });
    }

    // Визначаємо який статус повертати
    const status = orderData.status || 'created';
    
    // Якщо замовлення в процесі обробки (created/updated) → 250 OK
    if (status === 'created' || status === 'updated') {
      return Response.orderStatusPending(orderData.partnerOrderId, status);
    }
    
    // Якщо замовлення відвантажено (shipped) → 200 OK з повними даними
    if (status === 'shipped') {
      return Response.orderStatus(
        guid,
        status,
        orderData.tracking_number || '',
        products
      );
    }
    
    // Для інших статусів (якщо є) повертаємо 250 за замовчуванням
    return Response.orderStatusPending(orderData.partnerOrderId, status);
  }
}