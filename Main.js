/** Обробляє POST запити від Розетки
 * @param {Object} e - Об'єкт події з параметрами запиту
 * @returns {ContentService.TextOutput} - JSON відповідь
 */
function doPost(e) {
  try {
    const authResult = Auth.validateApiKey(e);

    if (!authResult.valid)
      return Response.error(authResult.error, authResult.code);

    const action = e.parameter.action;
    const guid = e.parameter.guid;

    if (action === 'deleteFile' && guid)
      return OrderKeeper.deleteFile(guid);

    if (!e.postData || !e.postData.contents)
      return Response.error('Невірний формат запиту або відсутні параметри.', 400);

    const requestData = JSON.parse(e.postData.contents);

    if (action === 'upload' && guid) {
      return OrderKeeper.uploadFile(guid, requestData);
    }

    if (action === 'create')
      return OrderKeeper.createOrder(requestData);

    if (action === 'cancel' && guid)
      return OrderKeeper.cancelOrder(guid);

    if (action === 'edit' && guid)
      return OrderKeeper.editOrder(guid, requestData);

    return Response.error('Невідома дія або відсутній GUID', 400);

  } catch (error) {
    console.log('Помилка в doPost: ' + error.toString());
    console.log('Stack trace: ' + error.stack);

    const action = e.parameter.action || 'unknown';
    const guid = e.parameter.guid || '';
    TelegramManager.notifyError(action, error.message, guid);

    return Response.error('Загальні помилки сервера: ' + error.message, 500);
  }
}


/** Обробляє GET запити від Розетки
 * @param {Object} e - Об'єкт події з параметрами запиту
 * @returns {ContentService.TextOutput} - JSON відповідь*/
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
    console.log('Помилка в doGet: ' + error.toString());
    return Response.error('Загальні помилки сервера', 500);
  }
}