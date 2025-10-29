const STOCK_ID = `1TQmD12CIMQNbq1Ewm2CS-j5oPFUlhA7see7Dh9eYqS0`
const STOCK_SHEET = `stock.import`
const STOCK_MAP = { code: 'Артикул ', quantity: 'Наявність повного комплекту' }

class StockKeeper {
  /** Отримує залишки товарів на складі
   * @returns {Object} Об'єкт з кодами товарів та їх доступною кількістю */
  static trackStocks() {
    const sheetData = InputKeeper.readSheetData(STOCK_ID, STOCK_SHEET).sheetData
    InputKeeper.mapHeadersToCoordinates(sheetData, STOCK_MAP)
    const stocks = {}
    for (let index = STOCK_MAP.code.rowIndex + 1; index < sheetData.length; index++) {
      let code = sheetData[index][STOCK_MAP.code.colIndex]
      let quantity = sheetData[index][STOCK_MAP.quantity.colIndex] - 2
      if (quantity <= 0) quantity = 0
      stocks[code] = quantity
    }

    return stocks
  }
}