class Response {
  /** Повертає JSON відповідь
   * @param {Object} data - Дані для відповіді
   * @param {number} statusCode - HTTP статус код
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static json(data, statusCode = 200) {
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  /** Повертає успішну відповідь зі статусом 200
   * @param {Object} data - Дані для відповіді
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static success(data) {
    return this.json(data, 200);
  }

  /** Повертає відповідь з помилкою
   * @param {string} message - Текст помилки
   * @param {number} code - HTTP статус код помилки
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static error(message, code = 400) {
    return this.json({ error: message }, code);
  }

  /** Повертає відповідь при створенні замовлення
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {Array} orderItems - Масив товарів замовлення
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static created(guid, orderItems) {
    return this.json({
      guid: guid,
      orderItems: orderItems,
      status: 'created'
    }, 200);
  }

  /** Повертає відповідь при скасуванні замовлення
   * @param {string} partnerOrderId - ID замовлення партнера
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static canceled(partnerOrderId) {
    return this.json({
      partnerOrderId: partnerOrderId,
      status: 'canceled'
    }, 200);
  }

  /** Повертає відповідь при оновленні замовлення
   * @param {string} partnerOrderId - ID замовлення партнера
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static updated(partnerOrderId) {
    return this.json({
      partnerOrderId: partnerOrderId,
      status: 'pending'
    }, 200);
  }

  /** Повертає статус замовлення (250 - в процесі обробки)
   * @param {string} partnerOrderId - ID замовлення партнера
   * @param {string} status - Статус замовлення (created/updated)
   * @returns {ContentService.TextOutput} - Об'єкт відповіді зі статусом 250
   */
  static orderStatusPending(partnerOrderId, status) {
    return this.json({
      partnerOrderId: partnerOrderId,
      status: status
    }, 250);
  }

  /** Повертає статус замовлення (200 - відвантажено)
   * @param {string} guid - Унікальний ідентифікатор замовлення
   * @param {string} status - Статус замовлення
   * @param {string} trackingNumber - Номер відстеження
   * @param {Array} products - Масив товарів
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static orderStatus(guid, status, trackingNumber, products) {
    return this.json({
      guid: guid,
      status: status,
      tracking_number: trackingNumber,
      products: products
    }, 200);
  }

  /** Повертає відповідь при успішному завантаженні файлу
   * @param {string} fileGuid - Унікальний ідентифікатор файлу
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static fileUploaded(fileGuid) {
    return this.json({
      success: true,
      file_guid: fileGuid,
      message: 'Файл успішно завантажено'
    }, 200);
  }

  /** Повертає відповідь при успішному видаленні файлу
   * @returns {ContentService.TextOutput} - Об'єкт відповіді
   */
  static fileDeleted() {
    return this.json({
      success: true,
      message: 'Файл успішно видалено'
    }, 200);
  }
}

