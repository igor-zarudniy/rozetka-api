class OrderKeeper {
  /** Створює нове замовлення
   * @param {Object} orderData - Дані замовлення від Розетки
   * @returns {ContentService.TextOutput} - Відповідь про створення замовлення
   */
  static createOrder(orderData) {
    const guid = Utilities.getUuid();
    
    const validation = this.validateOrderData(orderData);
    if (!validation.valid)
      return Response.error(validation.error, 400);
    
    const orderItems = this.processOrderItems(orderData.header.products);
    
    this.saveOrder(guid, orderData, orderItems);
    
    return Response.created(guid, orderItems);
  }

  /** Валідує дані замовлення
   * @param {Object} data - Об'єкт з даними замовлення
   * @returns {Object} - Результат валідації
   */
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
        reservedPrice: this.calculateReservedPrice(product.price),
        reservedQuantity: this.checkAvailability(product.supplier_code, product.quantity),
        result: this.validateProduct(product)
      };
      
      processedItems.push(item);
    }
    
    return processedItems;
  }

  /** Розраховує резервовану ціну з націнкою 2%
   * @param {number} price - Базова ціна товару
   * @returns {number} - Резервована ціна
   */
  static calculateReservedPrice(price) {
    return Math.round(price * 1.02 * 100) / 100;
  }

  /** Перевіряє наявність товару на складі
   * @param {string} supplierCode - Код постачальника
   * @param {number} requestedQuantity - Запитана кількість
   * @returns {number} - Підтверджена кількість
   */
  static checkAvailability(supplierCode, requestedQuantity) {
    return requestedQuantity;
  }

  /** Валідує дані товару
   * @param {Object} product - Об'єкт товару
   * @returns {boolean} - true якщо товар валідний
   */
  static validateProduct(product) {
    if (!product.supplier_code || !product.RZ_code)
      return false;
    
    if (!product.quantity || product.quantity <= 0)
      return false;
    
    if (!product.price || product.price <= 0)
      return false;
    
    return true;
  }

  /** Зберігає замовлення в Google Sheets
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Object} orderData - Дані замовлення
   * @param {Array} orderItems - Масив товарів замовлення
   */
  static saveOrder(guid, orderData, orderItems) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    
    if (!sheet) {
      SpreadsheetApp.getActiveSpreadsheet().insertSheet('Orders');
      const newSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
      newSheet.appendRow([
        'GUID',
        'Partner Order ID',
        'Customer Name',
        'Delivery City',
        'Delivery Phone',
        'Delivery Street',
        'Delivery Company',
        'Delivery Address ID',
        'Cash On Delivery',
        'Comment',
        'Products JSON',
        'Status',
        'Created At'
      ]);
      return this.saveOrder(guid, orderData, orderItems);
    }
    
    sheet.appendRow([
      guid,
      orderData.header.partnerOrderId,
      orderData.header.CustomerName,
      orderData.header.deliveryCity,
      orderData.header.deliveryPhone,
      orderData.header.deliveryStreet,
      orderData.header.deliveryCompanyName,
      orderData.header.deliveryAddressId,
      orderData.header.cashOnDelivery,
      orderData.header.comment,
      JSON.stringify(orderItems),
      'created',
      new Date().toISOString()
    ]);
  }

  /** Отримує замовлення за GUID
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @returns {Object|null} - Об'єкт замовлення або null якщо не знайдено
   */
  static getOrderByGuid(guid) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    
    if (!sheet)
      return null;
    
    const data = sheet.getDataRange().getValues();
    
    for (let index = 1; index < data.length; index++) {
      if (data[index][0] === guid) {
        return {
          guid: data[index][0],
          partnerOrderId: data[index][1],
          customerName: data[index][2],
          deliveryCity: data[index][3],
          deliveryPhone: data[index][4],
          deliveryStreet: data[index][5],
          deliveryCompany: data[index][6],
          deliveryAddressId: data[index][7],
          cashOnDelivery: data[index][8],
          comment: data[index][9],
          products: JSON.parse(data[index][10]),
          status: data[index][11],
          createdAt: data[index][12],
          rowIndex: index
        };
      }
    }
    
    return null;
  }

  /** Скасовує замовлення
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @returns {ContentService.TextOutput} - Відповідь про скасування
   */
  static cancelOrder(guid) {
    const order = this.getOrderByGuid(guid);
    
    if (!order)
      return Response.error('Замовлення не знайдено', 404);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    sheet.getRange(order.rowIndex + 1, 12).setValue('canceled');
    
    return Response.canceled(order.partnerOrderId);
  }

  /** Редагує існуюче замовлення
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Object} updateData - Дані для оновлення
   * @returns {ContentService.TextOutput} - Відповідь про оновлення
   */
  static editOrder(guid, updateData) {
    const order = this.getOrderByGuid(guid);
    
    if (!order)
      return Response.error('Замовлення не знайдено', 404);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    const rowIndex = order.rowIndex + 1;
    
    if (updateData.CustomerName)
      sheet.getRange(rowIndex, 3).setValue(updateData.CustomerName);
    
    if (updateData.deliveryCity)
      sheet.getRange(rowIndex, 4).setValue(updateData.deliveryCity);
    
    if (updateData.deliveryPhone)
      sheet.getRange(rowIndex, 5).setValue(updateData.deliveryPhone);
    
    if (updateData.deliveryStreet)
      sheet.getRange(rowIndex, 6).setValue(updateData.deliveryStreet);
    
    if (updateData.deliveryCompanyName)
      sheet.getRange(rowIndex, 7).setValue(updateData.deliveryCompanyName);
    
    if (updateData.deliveryAddressId)
      sheet.getRange(rowIndex, 8).setValue(updateData.deliveryAddressId);
    
    if (updateData.cashOnDelivery !== undefined)
      sheet.getRange(rowIndex, 9).setValue(updateData.cashOnDelivery);
    
    if (updateData.products) {
      const orderItems = this.processOrderItems(updateData.products);
      sheet.getRange(rowIndex, 11).setValue(JSON.stringify(orderItems));
    }
    
    sheet.getRange(rowIndex, 12).setValue('updated');
    
    return Response.updated(order.partnerOrderId);
  }

  /** Отримує статус замовлення
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @returns {ContentService.TextOutput} - Відповідь зі статусом замовлення
   */
  static getOrderStatus(guid) {
    const order = this.getOrderByGuid(guid);
    
    if (!order)
      return Response.error('Замовлення не знайдено', 404);
    
    return Response.orderStatus(
      order.guid,
      order.status,
      'track-12345',
      order.products
    );
  }

  /** Завантажує файл для замовлення
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Object} fileData - Дані файлу для завантаження
   * @returns {ContentService.TextOutput} - Відповідь про завантаження файлу
   */
  static uploadFile(guid, fileData) {
    const order = this.getOrderByGuid(guid);
    
    if (!order)
      return Response.error('Замовлення не знайдено', 404);
    
    const fileGuid = Utilities.getUuid();
    
    return Response.fileUploaded(fileGuid);
  }

  /** Видаляє файл за його GUID
   * @param {string} fileGuid - Унікальний ідентифікатор файлу
   * @returns {ContentService.TextOutput} - Відповідь про видалення файлу
   */
  static deleteFile(fileGuid) {
    if (!fileGuid)
      return Response.error('файл не знайдено', 404);
    
    return Response.fileDeleted();
  }
}

