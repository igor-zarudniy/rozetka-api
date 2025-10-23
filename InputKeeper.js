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
  
    /** Будує налаштування сторінки з даних локалізатора
       * @param {Object} params - Параметри функції
       * @param {string} params.sheetName - Назва аркуша
       * @param {Object} [sheetConfigurations={}] - Існуючі налаштування
       * @returns {Object} Налаштування сторінки*/
    static buildSheetSettings({ sheetName }, sheetConfigurations = {}) {
      const { rowIndex, colIndex } = this.findHeaderCoordinates(LOCALIZER, 'localizer')
      const colIndices = this.getSettingsColIndices(sheetName)
      let currentRowIndex = rowIndex + 1
  
      while (LOCALIZER[currentRowIndex][colIndex] !== 'stop') {
        const rowData = LOCALIZER[currentRowIndex]
        const key = rowData[colIndex]
        const header = rowData[colIndices.headers]
        const actualHeader = rowData[colIndices.actualHeader]
        const custom = rowData[colIndices.custom]
  
        sheetConfigurations[key] = {}
        const [reading_type, direction, rawStep, data_type] = `${rowData[colIndices.navigation]}`.split(', ')
        const step = typeof rawStep === 'number' ? rawStep : Number(rawStep)
        const navigation = { reading_type, direction, step, data_type }
  
        sheetConfigurations[key] = { navigation, header }
  
        if (actualHeader) sheetConfigurations[key].actualHeader = actualHeader
        if (custom) sheetConfigurations[key].custom = custom
  
        !header && delete sheetConfigurations[key]
        currentRowIndex++
      }
      console.warn(`InputKeeper: Налаштування для аркуша "${sheetName}" створено`)
      return sheetConfigurations
    }
  
    /** Отримує індекси колонок налаштувань для аркуша
     * @param {string} sheetName - Назва аркуша
     * @returns {Object} Індекси колонок налаштувань*/
    static getSettingsColIndices(sheetName) {
      return {
        headers: InputKeeper.findHeaderCoordinates(LOCALIZER, sheetName).colIndex,
        navigation: InputKeeper.findHeaderCoordinates(LOCALIZER, `⚙️${sheetName}`).colIndex,
        actualHeader: InputKeeper.findHeaderCoordinates(LOCALIZER, `🏷️${sheetName}`).colIndex,
        custom: InputKeeper.findHeaderCoordinates(LOCALIZER, `🎨${sheetName}`).colIndex
      }
    }
  
    /** Витягує та обробляє дані з колонки аркуша
     * @param {Array} sheetData - Дані аркуша
     * @param {Object} params - Параметри витягування
     * @param {string} params.actualHeader - Заголовок для пошуку позиції
     * @param {string} params.header - Заголовок колонки з даними
     * @param {Object} params.navigation - Налаштування обробки
     * @returns {Array} Масив оброблених даних*/
    static extractColumnData(sheetData, sheetConfigurations, actualKey, header, data_type) {
      const actualHeader = sheetConfigurations[actualKey].header
      const { rowIndex, colIndex } = this.findHeaderCoordinates(sheetData, actualHeader)
      const headerColIndex = this.findHeaderCoordinates(sheetData, header).colIndex
      let currentRowIndex = rowIndex + 1
      let resultArray = []
  
      while (sheetData[currentRowIndex][colIndex]) {
        const rawValue = sheetData[currentRowIndex][headerColIndex]
        const processedValue = this.formatValue(data_type, rawValue)
        resultArray.push(processedValue)
        currentRowIndex++
      }
      return resultArray
    }
  
  
    static generateVirtualData(formData, sheetConfigurations) {
  
      for (let key in sheetConfigurations) {
        let processedValue
        if (key === 'index') processedValue = Array.from({ length: formData.breed.length }, (_, index) => 1 + index)
        if (key === 'dateUpdate') processedValue = DateManager.getCurrentFormattedDate()
        if (key === 'status' && !formData.status) processedValue = sheetConfigurations[key].custom
        if (processedValue) formData[key] = processedValue
      }
    }
    /** Читає та форматує значення з аркуша за напрямком
    * @param {Array} sheetData - Дані аркуша
    * @param {string} header - Заголовок для пошуку позиції
    * @param {string} direction - Напрямок читання
    * @param {number} step - Крок переміщення
    * @param {string} data_type - Тип даних для форматування
    * @param {*} rawValue - Сире значення
    * @returns {*} Відформатоване значення*/
    static readFormattedValue(sheetData, header, direction, step, data_type, rawValue) {
      let { rowIndex, colIndex } = this.findHeaderCoordinates(sheetData, header)
      if (direction === 'down') rawValue = sheetData[rowIndex + step][colIndex]
      else if (direction === 'up') rawValue = sheetData[rowIndex - step][colIndex]
      else if (direction === 'right') rawValue = sheetData[rowIndex][colIndex + step]
      else if (direction === 'left') rawValue = sheetData[rowIndex][colIndex - step]
      const processedValue = this.formatValue(data_type, rawValue)
      return processedValue
    }
  
  
    /** Форматує значення відповідно до типу даних
     * @param {string} data_type - Тип даних для форматування
     * @param {*} rawValue - Сире значення для обробки
     * @returns {*} Відформатоване значення*/
    static formatValue(data_type, rawValue) {
      if (data_type === 'date') return rawValue ? DateManager.formatDate(rawValue) : DateManager.getCurrentFormattedDate()
      if (data_type === 'hour') return DateManager.formatTime(rawValue)
      if (data_type === 'numeric') return rawValue ? parseFloat(rawValue.toFixed(2)) : 0
      return rawValue
    }
  
    /** Повертає об’єкт деталей з рядка за індексами локалізації.
     * @param {Array} rowData — дані рядка.
     * @param {Object} localization — карта колонок.
     * @param {Object} details — об’єкт для заповнення (опційно).
     * @returns {Object} Об’єкт з деталями.*/
    static mapRowData(rowData, headerMap, extractedData = {}) {
      for (let key in headerMap) {
        const colIndex = headerMap[key].colIndex
        const value = rowData[colIndex]
  
        extractedData[key] = value
      }
      return extractedData
    }
  }