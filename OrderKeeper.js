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
   * @param {Object} postData - Об'єкт з даними файлу (e.postData)
   * @returns {ContentService.TextOutput} - JSON відповідь з file_guid або помилка 404*/
  static uploadFile(guid, postData) {
    // Перевіряємо чи існує замовлення з таким GUID
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, 'Orders')
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid)
    if (!coordinates?.colIndex) return Response.error('Замовлення не знайдено', 404)

    try {
      // Створюємо Blob з файлу
      const fileName = `order_${guid}_${DateManager.createCurrentDate()}`;
      const fileBlob = Utilities.newBlob(
        postData.contents,
        postData.type || 'application/octet-stream',
        fileName
      );

      // Зберігаємо файл у Google Drive використовуючи Drive API (працює в Web App)
      const fileMetadata = {
        name: fileName,
        parents: [FILES_FOLDER_ID],
        mimeType: postData.type || 'application/octet-stream'
      };

      const file = Drive.Files.create(fileMetadata, fileBlob, {
        fields: 'id,name,size,mimeType'
      });

      const fileGuid = file.id;

      Logger.log(`Файл успішно завантажено: ${fileGuid}, розмір: ${file.size} байт, назва: ${file.name}`);

      // Зберігаємо file_guid в таблицю Orders (якщо є така колонка)
      const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
      const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', 'Orders')
      InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)

      // Якщо є колонка file_guid в таблиці, зберігаємо туди ID файлу
      if (headerMap.file_guid) {
        const colIndex = headerMap.file_guid.colIndex
        const rowIndex = coordinates.rowIndex
        sheetRange.getRange(rowIndex + 1, colIndex + 1).setValue(fileGuid)
      }

      return Response.fileUploaded(fileGuid);

    } catch (error) {
      Logger.log('Помилка при завантаженні файлу: ' + error.toString());
      return Response.error('Помилка при завантаженні файлу: ' + error.message, 500);
    }
  }
}