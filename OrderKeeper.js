const PROJECT_ID = '1n-OJR0yWGvLK-3GUePfQlj_LI7g1q4T5WeHUJy7P0yQ'
const FILES_FOLDER_ID = '1Q8DqJGifnvGsa6DDJXBwBw4kfGmga4DO'
const MAIN_SHEET = '🛒 Замовлення'

function testCreateOrders() {
  const requestData = {
    "header": {
      "comment": "Доставити після 18:00, подзвонити за годину",
      "isFileRequired": true,
      "partnerOrderId": "ROZ123456789",
      "deliveryAddresType": "DropShipping",
      "cashOnDelivery": 0,
      "deliveryAddressId": "12345",
      "deliveryCompanyName": "Нова Пошта",
      "CustomerName": "Іван Петренко",
      "deliveryCity": "Київ",
      "deliveryPhone": "+380501234567",
      "deliveryStreet": "вул. Хрещатик, буд. 1, кв. 10",
      "products": [
        {
          "supplier_code": "SUP12345",
          "RZ_code": "11254855",
          "quantity": 2,
          "price": 100.50
        },
        {
          "supplier_code": "SUP67890",
          "RZ_code": "11254800",
          "quantity": 1,
          "price": 250.00
        }
      ]
    }
  }

  console.log(OrderKeeper.deleteFile('1hR4PweHB71vUNO5i0Nw9IuX8lvEALS1f'))
}


class OrderKeeper {
  /** Створює нове замовлення
   * @param {Object} orderData - Дані замовлення від Розетки
   * @returns {ContentService.TextOutput} - Відповідь про створення замовлення*/
  static createOrder(orderData) {
    const validation = this.validateOrderData(orderData);
    if (!validation.valid)
      return Response.error(validation.error, 400);

    // Спочатку обробляємо товари та отримуємо reservedQuantity
    const orderItems = this.processOrderItems(orderData.header.products);
    
    // Створюємо products з order_quantity (запитано) та quantity (зарезервовано)
    const productsWithReserved = orderItems.map(item => ({
      supplier_code: item.supplier_code,
      RZ_code: item.RZ_code,
      order_quantity: item.quantity,        // Скільки Розетка запитала
      quantity: item.reservedQuantity,      // Скільки ми зарезервували
      price: item.price
    }));
    
    // Зберігаємо замовлення з обома значеннями кількості
    orderData.header.products = productsWithReserved;
    const guid = this.saveOrderToSheet(orderData);
    
    // Сповіщаємо в Telegram про створення замовлення
    TelegramManager.notifyOrderCreated(orderData.header.partnerOrderId, orderItems);
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
    console.warn({ guid })
    let products = orderData.products
    let productKeys = Object.keys(products[0]);
    let preparedOrder = {};

    for (let keyIndex = 0; keyIndex < productKeys.length; keyIndex++) {
      const key = productKeys[keyIndex];
      const values = [];

      for (let productIndex = 0; productIndex < products.length; productIndex++) {
        const value = products[productIndex][key];
        values.push(value !== undefined && value !== null ? value : '');
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
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', MAIN_SHEET)
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, MAIN_SHEET)
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)
    sheetRange.insertRowBefore(2)
    const array = [];

    for (let key in headerMap) {
      const elIndex = headerMap[key].colIndex;
      const value = preparedOrder[key];
      if (value === undefined || value === null || value === '') continue
      array[elIndex] = value;
    }
    sheetRange.getRange(2, 1, 1, array.length).setValues([array])
    return preparedOrder.guid
  }

  /** Обробляє список товарів замовлення з перевіркою залишків на складі
   * @param {Array} products - Масив товарів
   * @returns {Array} - Масив оброблених товарів з реальними reservedQuantity
   */
  static processOrderItems(products) {
    const processedItems = [];
    const stocks = StockKeeper.trackStocks();

    for (let index = 0; index < products.length; index++) {
      const product = products[index];
      
      // Отримуємо доступну кількість на складі
      const availableStock = stocks[product.supplier_code] || 0;
      
      // Резервуємо тільки те що є на складі (але не більше ніж запитано)
      const reservedQuantity = Math.min(product.quantity, availableStock);
      
      // Якщо зарезервована кількість співпадає з запитаною - true, інакше - false
      const result = reservedQuantity === product.quantity;

      const item = {
        supplier_code: product.supplier_code,
        RZ_code: product.RZ_code,
        price: product.price,
        quantity: product.quantity,
        reservedPrice: product.price,
        reservedQuantity: reservedQuantity,
        result: result
      };

      processedItems.push(item);
    }

    return processedItems;
  }

  /** Скасовує замовлення за GUID
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @returns {ContentService.TextOutput} - Відповідь про скасування замовлення*/
  static cancelOrder(guid) {
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, MAIN_SHEET)
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid)
    if (!coordinates?.colIndex) return Response.error('Замовлення не знайдено', 400)

    const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', MAIN_SHEET)
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)

    const rowIndex = coordinates.rowIndex
    const partnerOrderId = sheetData[rowIndex][headerMap.partnerOrderId.colIndex]

    sheetRange.getRange(rowIndex + 1, headerMap.status.colIndex + 1).setValue('canceled')

    TelegramManager.notifyOrderCanceled(partnerOrderId)

    return Response.canceled(guid)
  }

  /** Редагує існуюче замовлення в Google Sheets
   * Знаходить замовлення за GUID та оновлює тільки змінені поля
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Object} requestData - Об'єкт з даними для оновлення
   * @returns {ContentService.TextOutput} - JSON відповідь з підтвердженням оновлення або помилка 404*/
  static editOrder(guid, requestData) {
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, MAIN_SHEET)
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid)
    if (!coordinates?.colIndex) return Response.error('Замовлення не знайдено', 404)

    // Обробляємо товари та перевіряємо залишки (як при створенні)
    const orderItems = this.processOrderItems(requestData.products)
    
    // Створюємо products з order_quantity (запитано) та quantity (зарезервовано)
    const productsWithReserved = orderItems.map(item => ({
      supplier_code: item.supplier_code,
      RZ_code: item.RZ_code,
      order_quantity: item.quantity,        // Скільки Розетка запитала
      quantity: item.reservedQuantity,      // Скільки ми зарезервували
      price: item.price
    }))
    
    requestData.products = productsWithReserved
    const preparedOrder = this.flattenOrder(requestData, 'created', guid)
    
    const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', MAIN_SHEET)
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)

    for (let key in headerMap) {
      if (key === 'date') continue
      const colIndex = headerMap[key].colIndex
      const rowIndex = coordinates.rowIndex
      const value = preparedOrder[key]
      const currentValue = sheetData[rowIndex][colIndex]
      if (value === undefined || value === null || value === '') continue
      if (value === currentValue) continue

      sheetRange.getRange(rowIndex + 1, colIndex + 1).setValue(value)
    }
    
    const orderId = sheetData[coordinates.rowIndex][headerMap.partnerOrderId.colIndex]
    TelegramManager.notifyOrderEdited(orderId, orderItems)

    return Response.created(guid, orderItems)
  }

  /** Завантажує файл для замовлення в Google Drive
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Object} filePayload - Об'єкт з base64 даними файлу
   * @returns {ContentService.TextOutput} - JSON відповідь з file_guid або помилка 404*/
  static uploadFile(guid, filePayload) {
    const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, MAIN_SHEET)
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

      console.log(`Створюємо файл: ${fileName}, MIME: ${mimeType}, Розмір blob: ${fileBlob.getBytes().length} байт`);

      const fileMetadata = {
        name: fileName,
        parents: [FILES_FOLDER_ID],
        mimeType: mimeType
      };

      const file = Drive.Files.create(fileMetadata, fileBlob, {
        fields: 'id,name,size,mimeType'
      });

      const fileGuid = file.id;

      console.log(`Файл успішно завантажено: ${fileGuid}, розмір: ${file.size} байт, назва: ${file.name}`);

      const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData
      const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', MAIN_SHEET)
      InputKeeper.mapHeadersToCoordinates(sheetData, headerMap)

      const rowIndex = coordinates.rowIndex
      const partnerOrderId = sheetData[rowIndex][headerMap.partnerOrderId.colIndex]

      if (headerMap.file_guid) {
        const colIndex = headerMap.file_guid.colIndex + 1
        const fileIndex = headerMap.file_url.colIndex + 1
        sheetRange.getRange(rowIndex + 1, colIndex).setValue(fileGuid)
        sheetRange.getRange(rowIndex + 1, fileIndex).setValue(`https://drive.google.com/file/d/${fileGuid}`)
      }


      TelegramManager.notifyFileUploaded(partnerOrderId, fileGuid)

      return Response.fileUploaded(fileGuid);

    } catch (error) {
      console.log('Помилка при завантаженні файлу: ' + error.toString());
      console.log('Stack trace: ' + error.stack);
      return Response.error('Помилка при завантаженні файлу: ' + error.message, 500);
    }
  }

  /** Видаляє файл з Google Drive та очищує дані в таблиці
   * @param {string} fileGuid - Унікальний ідентифікатор файлу в Google Drive
   * @returns {ContentService.TextOutput} - JSON відповідь з підтвердженням видалення або помилка 404*/
  static deleteFile(fileGuid) {
    try {
      Drive.Files.remove(fileGuid)
      const { sheetRange, sheetData } = InputKeeper.readSheetData(PROJECT_ID, MAIN_SHEET);
      const coordinates = InputKeeper.findHeaderCoordinates(sheetData, fileGuid);
      const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData;
      const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', MAIN_SHEET);
      InputKeeper.mapHeadersToCoordinates(sheetData, headerMap);
      console.warn()
      const rowIndex = coordinates?.rowIndex;

      if (rowIndex) {
        sheetRange.getRange(rowIndex + 1, headerMap.file_guid.colIndex + 1).clearContent();
        sheetRange.getRange(rowIndex + 1, headerMap.file_url.colIndex + 1).clearContent();
      }

      TelegramManager.notifyFileDeleted(fileGuid)

      return Response.fileDeleted();

    } catch (error) {
      console.log('Помилка при видаленні файлу: ' + error.toString());
      console.log('Stack trace: ' + error.stack);
      return Response.error('Замовлення не знайдено', 404);
    }
  }

  /** Отримує статус замовлення за GUID
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @returns {ContentService.TextOutput} - JSON відповідь зі статусом замовлення або помилка 404*/
  static getOrderStatus(guid) {
    const { sheetData } = InputKeeper.readSheetData(PROJECT_ID, MAIN_SHEET);
    const localizer = InputKeeper.readSheetData(PROJECT_ID, '🌐Localizer').sheetData;
    const headerMap = InputKeeper.createMapToStop(localizer, 'localizer', MAIN_SHEET);
    InputKeeper.mapHeadersToCoordinates(sheetData, headerMap);
    const coordinates = InputKeeper.findHeaderCoordinates(sheetData, guid);
    console.warn({ coordinates })
    if (!coordinates?.colIndex) {
      return Response.error('Замовлення не знайдено', 404);
    }

    const rowIndex = coordinates.rowIndex;
    const orderData = {};
    for (let key in headerMap) {
      const colIndex = headerMap[key].colIndex;
      orderData[key] = sheetData[rowIndex][colIndex];
    }

    const supplierCodes = (orderData.supplier_code || '').toString().split('\n');
    const rzCodes = (orderData.RZ_code || '').toString().split('\n');
    const quantities = (orderData.quantity || '').toString().split('\n');
    const allSerialNumbers = (orderData.SerialNumber || '').toString()
      .split(',')
      .map(sn => sn.trim())
      .filter(sn => sn.length > 0);

    const products = [];
    let serialNumberIndex = 0; 

    for (let i = 0; i < supplierCodes.length; i++) {
      if (!supplierCodes[i]) continue;

      const quantity = parseInt(quantities[i]) || 0;
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

    const status = orderData.status || 'created';
    if (status === 'created' || status === 'updated') {
      return Response.orderStatusPending(guid, status);
    }

    if (status === 'shipped') {
      return Response.orderStatus(
        guid,
        status,
        orderData.tracking_number || '',
        products
      );
    }

    return Response.orderStatusPending(guid, status);
  }
}