/** Обробляє POST запити від Розетки
 * @param {Object} e - Об'єкт події з параметрами запиту
 * @returns {ContentService.TextOutput} - JSON відповідь
 */
function doPost(e) {
  try {
    const authResult = Auth.validateApiKey(e);
    
    if (!authResult.valid)
      return Response.error(authResult.error, authResult.code);
    
    if (!e.postData || !e.postData.contents)
      return Response.error('Відсутні дані запиту', 400);
    
    const action = e.parameter.action;
    const guid = e.parameter.guid;
    
    // Для завантаження файлів не парсимо JSON, а передаємо сирі дані
    if (action === 'upload' && guid) {
      return OrderKeeper.uploadFile(guid, e.postData);
    }
    
    // Для всіх інших запитів парсимо JSON як зазвичай
    const requestData = JSON.parse(e.postData.contents);
    
    if (action === 'create')
      return OrderKeeper.createOrder(requestData);
    
    if (action === 'cancel' && guid)
      return OrderKeeper.cancelOrder(guid);
    
    if (action === 'edit' && guid)
      return OrderKeeper.editOrder(guid, requestData);
    
    if (action === 'deleteFile' && guid)
      return OrderKeeper.deleteFile(guid);
    
    return Response.error('Невідома дія або відсутній GUID', 400);
    
  } catch (error) {
    Logger.log('Помилка в doPost: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    return Response.error('Загальні помилки сервера: ' + error.message, 500);
  }
}

/** Обробляє GET запити від Розетки
 * @param {Object} e - Об'єкт події з параметрами запиту
 * @returns {ContentService.TextOutput} - JSON відповідь
 */
function doGet(e) {
  try {
    const authResult = Auth.validateApiKey(e);
    
    if (!authResult.valid)
      return Response.error(authResult.error, authResult.code);
    
    const action = e.parameter.action;
    const guid = e.parameter.guid;
    
    if (action === 'status' && guid)
      return OrderKeeper.getOrderStatus(guid);
    
    return Response.error('Невідома дія або відсутній GUID', 400);
    
  } catch (error) {
    Logger.log('Помилка в doGet: ' + error.toString());
    return Response.error('Загальні помилки сервера', 500);
  }
}

/** Отримує поточний API ключ з конфігурації
 * @returns {string} - Поточний API ключ
 */
function getApiKey() {
  const apiKey = Auth.getApiKey();
  Logger.log('Поточний API ключ: ' + apiKey);
  return apiKey;
}

