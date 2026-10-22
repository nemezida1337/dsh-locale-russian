/**
 * Разбор аргументов командной строки для инструментов репозитория.
 *
 * Поддерживает обе привычные формы: `--name value` и `--name=value`, а также
 * флаги без значения. Один помощник вместо копии в каждом инструменте.
 */
import process from 'node:process'

/**
 * Создаёт разборщик аргументов.
 * @param argv - аргументы; по умолчанию всё после имени скрипта.
 * @returns функции `option` и `flag` плюс исходный список аргументов.
 */
export function createArgs(argv = process.argv.slice(2)) {
  return {
    argv,
    /**
     * Значение опции.
     * @param name - имя без `--`.
     * @param fallback - значение, когда опции нет.
     * @returns строковое значение или fallback.
     */
    option(name, fallback) {
      const prefix = `--${name}=`
      const inline = argv.find((arg) => arg.startsWith(prefix))
      if (inline !== undefined) return inline.slice(prefix.length)
      const index = argv.indexOf(`--${name}`)
      if (index === -1) return fallback
      const value = argv[index + 1]
      return value === undefined || value.startsWith('--') ? fallback : value
    },
    /**
     * Есть ли флаг.
     * @param name - имя без `--`.
     * @returns true, когда флаг передан.
     */
    flag(name) {
      return argv.includes(`--${name}`)
    },
  }
}
