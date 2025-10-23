class DateManager {
    /** Створює поточну дату та час у форматованому вигляді
     * @returns {string} - Дата у форматі "dd.MM.yyyy HH:mm" (GMT+3)*/
    static createCurrentDate() {
      const currentDate = new Date()
      const formattedDate = Utilities.formatDate(currentDate, 'GMT+3', 'dd/MM/yyyy HH:mm')
      return formattedDate
    }
  }