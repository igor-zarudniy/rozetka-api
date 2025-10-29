class InputKeeper {
  /** Читає дані з аркуша Google Sheets
   * @param {string} spreadSheetId - ID таблиці
   * @param {string} sheetName - Назва аркуша
   * @param {string} [readType='values'] - Тип читання
   * @returns {Object|Sheet} Дані або аркуш*/
  static readSheetData(spreadSheetId, sheetName, readType = 'values') {
    console.log(`InputKeeper: Читаю таблицю ${spreadSheetId}. Аркуш: ${sheetName}. Тип читання: ${readType}`)
    const sheetRange = SpreadsheetApp.openById(spreadSheetId).getSheetByName(sheetName)

    if (readType != 'values') return sheetRange
    const sheetData = sheetRange.getDataRange().getValues()
    return { sheetRange, sheetData }
  }

  /** Створює мапу ключ-значення з даних аркуша до зустрічі зі стопером
   * @param {Object} params - Параметри функції
   * @param {Array} params.sheetData - Дані аркуша
   * @param {string} keyHeader - Заголовок колонки з ключами
   * @param {string} valueHeader - Заголовок колонки зі значеннями
   * @returns {Object} Мапа ключ-значення*/
  static createMapToStop(sheetData, keyHeader, valueHeader) {
    const { rowIndex, colIndex } = this.findHeaderCoordinates(sheetData, keyHeader)
    const valueHeaderCoordinates = this.findColumnIndexInRow(sheetData, rowIndex, colIndex, valueHeader)

    const resultMap = {}
    let currentRowIndex = rowIndex + 1

    while (sheetData[currentRowIndex][colIndex] !== 'stop') {

      let key = sheetData[currentRowIndex][colIndex]
      let value = sheetData[currentRowIndex][valueHeaderCoordinates]
      resultMap[key] = value

      !value && delete resultMap[key]
      currentRowIndex++
    }
    return resultMap
  }

  /** Знаходить індекс колонки з потрібним заголовком в рядку
   * @param {Array} sheetData - Дані аркуша
   * @param {number} searchRowIndex - Індекс рядка для пошуку
   * @param {number} searchColIndex - Індекс колонки для початку пошуку
   * @param {string} header - Заголовок для пошуку
   * @returns {number} Індекс знайденої колонки*/
  static findColumnIndexInRow(sheetData, searchRowIndex, searchColIndex, header) {
    for (let colIndex = searchColIndex + 1; colIndex < sheetData[searchRowIndex].length; colIndex++) {
      const currentHeader = `${sheetData[searchRowIndex][colIndex]}`
      const targetHeader = `${header}`

      if (currentHeader === targetHeader) return colIndex
    }
  }

  /** Знаходить координати заголовка в даних аркуша
   * @param {Array} sheetData - Дані аркуша
   * @param {string} header - Заголовок для пошуку
   * @returns {Object} Координати { rowIndex, colIndex }*/
  static findHeaderCoordinates(sheetData, header) {
    for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
      for (let colIndex = 0; colIndex < sheetData[rowIndex].length; colIndex++) {
        const currentHeader = `${sheetData[rowIndex][colIndex]}`
        const targetHeader = `${header}`

        if (currentHeader === targetHeader) return { rowIndex, colIndex }
      }
    }
  }

  /** Мапить заголовки до координат в даних аркуша
   * @param {Array} sheetData - Дані аркуша
   * @param {Object} headerMap - Мапа заголовків для обробки*/
  static mapHeadersToCoordinates(sheetData, headerMap) {
    for (let key in headerMap) {
      const header = headerMap[key]
      const coordinates = this.findHeaderCoordinates(sheetData, header)
      if (!coordinates) continue
      const { rowIndex, colIndex } = coordinates
      headerMap[key] = { header, colIndex, rowIndex }
    }
  }
}