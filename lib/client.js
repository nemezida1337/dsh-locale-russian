window.__ModuleLoader__.load({
	// Module id must equal the package name: the client module system matches
	// the resolved package against the registered id.
	id: "dsh-locale-russian",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/**
		 * Russian language pack for the web client: the language definition, the
		 * translated dictionaries, and Russian plural-form selection.
		 *
		 * The locale runtime has no plural rules (dictionary lookup returns one
		 * template), while components choose the `.one`/`.other` key by
		 * `count === 1`. Russian needs three forms, so this pack wraps
		 * `LocaleRuntime.prototype.translate`: a dictionary value may carry up to
		 * three `|`-separated forms, and the wrapper picks one through
		 * `Intl.PluralRules('ru')`. Only the active `ru` locale takes this path —
		 * every other locale calls the original method unchanged.
		 */

		/** Language definition registered into the extensible locale catalog. */
		const LANGUAGE = { id: "ru", label: "Русский", fallback: "en" };

		/** Dictionary digest, so a running page can be matched to a pack build. */
		const DICTIONARY_DIGEST = "99b06228dac75430";

		/** Namespace dictionaries: namespace -> key -> Russian copy. */
		const DICTIONARIES = {"actionCards":{"collapseBrief":"Свернуть","dismiss":"Не сейчас","dismissed":"Скрыто","expandBrief":"Показать больше","replaced":"Заменено","row.error":"Не показано","row.inspect":"Открыть вызов","row.ok":"Предложено","row.preparing":"Подготовка карточки","row.running":"Предлагается","row.stopped":"Прервано","row.title":"Карточка действия","transport":"Не удалось подтвердить результат. Переподключитесь и проверьте карточку, прежде чем повторять.","unavailable":"Действие недоступно. Проверьте плагин на странице «Плагины»."},"agent-team":{"blocked":"Заблокирована зависимостями","blockedBy":"Зависит от","current":"Текущий чат","empty":"Общих задач пока нет. Создайте их через диалог.","failure":"Некорректная сохранённая запись команды: {message}","loading":"Загрузка команды…","memberStatus.failed":"Сбой","memberStatus.inactive":"Неактивен","memberStatus.provisioning":"Подготовка","memberStatus.running":"Выполняется","model":"Модель","open":"Открыть диалог с участником","owner":"Владелец","ready":"Готова","roster":"Участники","status.completed":"Завершено","status.in_progress":"В работе","status.pending":"Ожидает","task.collapse":"Свернуть","task.expand":"Развернуть","tasks":"Общие задачи","trigger":"Команда агентов","unavailable":"Команда недоступна","unowned":"Не назначен","writeScopes":"Области записи"},"approval":{"allow":"Разрешить","allowAlways":"Разрешать всегда","allowOnce":"Разрешить один раз","detail.aria":"Подробности подтверждения","escalation":"Инструмент {toolName} запрашивает привилегированное выполнение","reject":"Отклонить","waiting":"Ожидает подтверждения"},"chat":{"chat.deepDiving":"Углубляемся…","chat.deepDivingFor":"Углубляемся {duration} ···","chat.loadError":"Не удалось загрузить историю: {message} ({code})","chat.loadingHistory":"Загрузка истории…","chat.loadOlder":"Загрузить более ранние","chat.toBottom":"Вернуться вниз","chat.turnNavigation.jump":"Перейти к ходу {turn}","chat.turnNavigation.jumpLoad":"Загрузить и перейти к ходу {turn}","chat.turnNavigation.label":"Навигация по ходам","chat.turnNavigation.turn":"Ход {turn}","clock.md":"{d}.{m}","clock.ymd":"{d}.{m}.{y}","command.done":"Завершено","command.failed":"Сбой команды","command.running":"Выполняется…","command.title":"Команда","duration.compactMinutes":"{minutes} мин {seconds} сек","duration.compactSeconds":"{seconds} сек","duration.hourUnit":"ч ","duration.milliseconds":"{milliseconds} мс","duration.minutes":"{minutes} мин {seconds} сек","duration.minuteUnit":"мин ","duration.seconds":"{seconds} сек","duration.secondUnit":"с","fileOpen.title":"Не удалось открыть файл","fileOpen.unknown":"Не удалось открыть этот файл","image.close":"Закрыть предпросмотр изображения","image.dialog":"Предпросмотр изображения","image.failed":"Предпросмотр изображения недоступен","image.loading":"Загрузка изображения…","image.open":"Открыть целиком","json.truncated":"… обрезано, всего символов: {total}","message.branch":"Ответвить в новый диалог","message.branchUnavailable":"Доступно только для последнего сообщения завершённого хода","message.compaction":"Контекст сжат","message.compaction.commandTitle":"compact","message.compaction.completed":"Сжато записей истории: {items} (~{tokens} токен.)|Сжато записей истории: {items} (~{tokens} токена.)|Сжато записей истории: {items} (~{tokens} токенов.)","message.compaction.expand":"Показать сводку сжатия","message.compaction.running":"Сжатие контекста…","message.compaction.unavailable":"Сводка сжатия недоступна","message.context.catalog.more":"… ещё {count} элемент|… ещё {count} элемента|… ещё {count} элементов","message.context.catalog.replaced":"Каталог заменён","message.context.instructions.added":"добавлен","message.context.instructions.loaded":"загружен","message.context.instructions.removed":"удалён","message.context.instructions.updated":"обновлён","message.context.recall.counts":"{retained} оставлено · {omitted} пропущено","message.context.recall.truncated":"обрезано","message.context.relay.from":"Из сессии {session}","message.context.snapshot.supersedes":"Заменяет прежние снимки","message.contextInjection":"Внедрение контекста","message.contextRecall":"Воспоминания из сессий","message.extraBlock":"Дополнительный блок содержимого","message.failure.accountSignedOut":"Остановлено: вы вышли из DeepSeek.","message.failure.accountSignInRequired":"Войдите в DeepSeek и убедитесь, что адрес запроса поддерживает аутентификацию по учётной записи.","message.failure.auth":"Ключ API недействителен","message.failure.interrupted":"Процесс DSH завершился до окончания этого хода (например, был принудительно завершён, аварийно завершился или превысил время при остановке), поэтому при перезапуске DSH ход был закрыт. Исход незавершённых вызовов инструментов неизвестен.","message.failure.quota":"Квота запросов исчерпана.","message.maxTokens":"Достигнут лимит выходных токенов","message.maxTokens.hint":"Ответ обрезан; прежний вывод сохранён в диалоге. Отправьте «continue», чтобы модель продолжила.","message.ranFor":"Выполнялось {duration}","message.referenceSeparator":", ","message.referenceSummary":"Ссылка на сессию · {labels}","message.retry.active":"Повтор запроса к модели","message.retry.cancelled":"Повтор запроса к модели отменён","message.retry.delay":"Задержка повтора: ","message.retry.failure":"Причина сбоя: ","message.retry.scheduled":"Ожидание повтора запроса к модели","message.retry.started":"Запрос к модели повторён","message.retry.status":"{label} ({retry}/{maximum}) · {seconds} сек","message.stepProcess.code":"Выполняем код","message.stepProcess.comma":", ","message.stepProcess.commands":"Выполняем команды","message.stepProcess.done.code":"Выполнил код","message.stepProcess.done.commands":"Выполнил команды","message.stepProcess.done.edit":"Изменил файлы","message.stepProcess.done.plan":"Обновил план","message.stepProcess.done.questions":"Задал вопросы","message.stepProcess.done.read":"Прочитал файлы","message.stepProcess.done.readImage":"Прочитал изображения","message.stepProcess.done.search":"Искал в коде","message.stepProcess.done.subagents":"Скоординировал субагентов","message.stepProcess.done.thinking":"Анализ завершён","message.stepProcess.done.tools":"Вызвал инструменты","message.stepProcess.done.webFetch":"Открыл веб-страницы","message.stepProcess.done.webSearch":"Искал в интернете","message.stepProcess.done.write":"Записал файлы","message.stepProcess.edit":"Редактируем файлы","message.stepProcess.joinTwo":"{first} и {second}","message.stepProcess.more":"{title} и т. д.","message.stepProcess.plan":"Обновляем план","message.stepProcess.prepare.code":"Готовимся выполнять код","message.stepProcess.prepare.commands":"Готовимся выполнять команды","message.stepProcess.prepare.edit":"Готовимся редактировать файлы","message.stepProcess.prepare.plan":"Готовимся обновить план","message.stepProcess.prepare.questions":"Готовимся задать вопросы","message.stepProcess.prepare.read":"Готовимся читать файлы","message.stepProcess.prepare.readImage":"Готовимся читать изображения","message.stepProcess.prepare.search":"Готовимся искать в коде","message.stepProcess.prepare.subagents":"Готовимся координировать субагентов","message.stepProcess.prepare.tools":"Готовимся вызывать инструменты","message.stepProcess.prepare.webFetch":"Готовимся открывать веб-страницы","message.stepProcess.prepare.webSearch":"Готовимся искать в интернете","message.stepProcess.prepare.write":"Готовимся записывать файлы","message.stepProcess.questions":"Ждём вашего действия","message.stepProcess.read":"Читаем файлы","message.stepProcess.readImage":"Читаем изображения","message.stepProcess.search":"Ищем в коде","message.stepProcess.sharedPrefix":"","message.stepProcess.subagents":"Координируем субагентов","message.stepProcess.thinking":"Анализируем запрос","message.stepProcess.tools":"Вызываем инструменты","message.stepProcess.webFetch":"Открываем веб-страницы","message.stepProcess.webSearch":"Ищем в интернете","message.stepProcess.write":"Записываем файлы","message.stopped":"Остановлено","message.systemPrompt":"Системный промпт","message.systemPromptUpdate":"Обновление системного промпта","message.taskStopped":"Задача остановлена","message.think":"Рассуждения","message.tokensPerSecond":"{tps} токен/с|{tps} токена/с|{tps} токенов/с","message.toolAdded":"Инструмент добавлен: {name}","message.toolRemoved":"Инструмент удалён: {name}","message.toolsAdded":"Добавлено: {names}","message.toolsAddedCount":"{count} добавлен|{count} добавлено|{count} добавлено","message.toolsChanged":"добавлено {added}, удалено {removed}","message.toolsRemoved":"Удалено: {names}","message.toolsRemovedCount":"{count} удалён|{count} удалено|{count} удалено","message.toolsUpdated":"Инструменты обновлены","message.trigger.agent":"Получено сообщение задачи","message.trigger.explanation":"Это уведомление вызвало этот ответ.","message.trigger.github":"Получено событие GitHub","message.trigger.goal":"Продолжаем работу над целью","message.trigger.job":"Фоновая задача обновлена","message.trigger.plugin":"Состояние плагина обновлено","message.trigger.request":"Запрошено выполнение","message.trigger.schedule":"Автоматическая задача","message.trigger.subagent":"Состояние подзадачи обновлено","message.trigger.team":"Получено сообщение команды","message.trigger.webhook":"Получено внешнее событие","message.turnError":"Ход завершился с ошибкой","message.turnProcess.failed":"Сбой","message.turnProcess.messages.one":"{count} сообщение","message.turnProcess.messages.other":"{count} сообщения|{count} сообщений","message.turnProcess.separator":" · ","message.turnProcess.subagents.one":"{count} субагент","message.turnProcess.subagents.other":"{count} субагента|{count} субагентов","message.turnProcess.thoughtForAWhile":"Думал некоторое время","message.turnProcess.took":"Завершено за ","message.turnProcess.toolCalls.one":"{count} вызов инструмента","message.turnProcess.toolCalls.other":"{count} вызова инструмента|{count} вызовов инструмента","message.turnProcess.worked":"Завершено","message.turnTime.duration":"Общее время выполнения","message.turnTime.speed":"Токенов в секунду (TPS)","message.turnTime.title":"Время и скорость хода","message.turnTime.ttft":"Время до первого токена (TTFT)","message.turnUsage.cacheHit":"Попадание в кэш","message.turnUsage.cacheRead":"Ввод из кэша","message.turnUsage.cacheWrite":"Запись в кэш","message.turnUsage.consumed":"Использовано {total}","message.turnUsage.count":"{count} токен|{count} токена|{count} токенов","message.turnUsage.input":"Ввод без кэша","message.turnUsage.model":"Провайдер / модель","message.turnUsage.output":"Вывод","message.turnUsage.reasoning":" (рассуждения: {tokens})","message.turnUsage.title":"Расход за ход","message.unknownBlock":"Неизвестный блок содержимого","message.unknownSurface":"Неизвестное событие surface: {type}","number.groupSeparator":" ","row.failed":"Сбой","row.running":"Выполняется","settings.collapse.completion":"По завершении","settings.collapse.description":"Выберите, когда автоматически сворачивать подробности работы","settings.collapse.nextInput":"При новом сообщении","settings.collapse.title":"Когда сворачивать подробности работы","settings.foldedReplies.all":"Все ответы","settings.foldedReplies.description":"Выберите, какие ответы ассистента остаются видимыми при сворачивании подробностей","settings.foldedReplies.final":"Только итоговый ответ","settings.foldedReplies.title":"Ответы после сворачивания","settings.links.description":"Выберите, где открывать веб-ссылки","settings.links.newTab":"Браузер по умолчанию","settings.links.sidebar":"Боковая панель приложения","settings.links.title":"Где открывать ссылки из чата","settings.performance.compact":"Компактный","settings.performance.description":"Выберите, сколько показывать сведений о производительности и расходе","settings.performance.detailed":"Подробный","settings.performance.title":"Производительность и расход","settings.transcript.compact":"Компактный","settings.transcript.description":"Выберите, насколько подробно показывать вызовы инструментов","settings.transcript.detailed":"Подробный","settings.transcript.normal":"Обычный","settings.transcript.standard":"Обычный","settings.transcript.title":"Подробности работы","settings.transcript.verbose":"Развёрнутый","stats.cacheHit":"Попадание в кэш {percent}%","stats.counts":"Ходов: {turns}, шагов: {steps}","stats.dialog.llmTime":"Время LLM","stats.dialog.speed":"Токенов в секунду (TPS)","stats.dialog.title":"Статистика сессии","stats.dialog.toolTime":"Время инструментов","stats.dialog.ttft":"Среднее время до первого токена (TTFT)","stats.dialog.usageTitle":"Расход токенов","view.chat":"Чат"},"claude-code-mods":{"band":"Моды Claude Code","press.failed":"Кнопка не сработала: {message}","press.stale":"Эта кнопка относится к более ранней отрисовке; панель обновилась","pressing":"Обработка…"},"command":{"description.compact":"Сжать прежнюю историю диалога","description.export":"Скачать журнал этой сессии как ZIP-архив","description.feedback":"Оставить отзыв об этой сессии","description.goal":"Задать или посмотреть цель длительной задачи","description.permission":"Переключить набор разрешений (режим песочницы + политика подтверждений)","description.plan":"Войти или выйти из режима планирования","label.compact":"Сжать","label.export":"Экспорт","label.feedback":"Отзыв","label.goal":"Цель","label.permission":"Разрешения","label.plan":"План","listbox.aria":"Совпадения для /{command}","notice.attachmentsUnsupported":"/{command} не принимает вложения; сначала удалите их","overlay.aria":"Варианты для /{command}","search.aria":"Фильтр вариантов","search.placeholder":"Поиск…","section.add":"Добавить","section.commands":"Команды","status.applying":"Применение…","status.empty":"Нет вариантов","status.loading":"Загрузка вариантов…","token.compact":"compact","token.export":"export","token.feedback":"feedback","token.goal":"goal","token.permission":"permission","token.plan":"plan"},"common":{"back":"Назад","brand.localBuild":"Локальная сборка DSH","cancel":"Отмена","close":"Закрыть","codeBlock.title":"Блок кода","codeBlock.unwrap":"Не переносить строки","codeBlock.wrap":"Переносить строки","collapse":"Свернуть","copied":"Скопировано","copy":"Копировать","copy.compactJson":"Копировать компактный JSON","copy.failed":"Не удалось скопировать","copy.json":"Копировать JSON","copy.optionsHint":"{action}; щелчок правой кнопкой — варианты копирования","copy.path":"Копировать путь к свойству","copy.prettyJson":"Копировать форматированный JSON","copy.value":"Копировать значение","delete":"Удалить","edit":"Изменить","expand":"Развернуть","json.collapseNode":"Свернуть узел JSON","json.expandNode":"Развернуть узел JSON","json.label":"JSON","load.failed":"Не удалось загрузить","loading":"Загрузка…","markdown.footnotes":"Сноски","markdown.truncatedCharacters":"… обрезано после {total} символов","more":"Ещё","next":"Далее","none":"Нет","number.million":"{value} млн","number.thousand":"{value} тыс.","ok":"ОК","previous":"Назад","retry":"Повторить","save":"Сохранить","search":"Поиск","skip":"Пропустить","submit":"Отправить","submitting":"Отправка…","truncated":"Обрезано","unknown":"Неизвестно","workspace.defaultName":"Рабочая область по умолчанию"},"contextMenu":{"failed":"Не удалось выполнить действие. Повторите попытку."},"conversation":{"// The Host terminal_send presenter has no locale seat; keep its fallbacks\n  // aligned with these English values.\n  'terminal.sendInput'":"(отправить ввод)","access.confirm.acknowledge":"Я понимаю риски и хочу продолжить","access.confirm.cancel":"Отмена","access.confirm.description":"Полный доступ сокращает число шагов подтверждения и позволяет агенту напрямую выполнять больше действий, включая чувствительные операции, изменение файлов и внешние команды. Используйте его, только если доверяете текущей задаче.","access.confirm.enable":"Включить полный доступ","access.confirm.title":"Включить полный доступ?","access.preset.fullAccess":"Полный доступ","access.preset.readOnly":"Только чтение","access.preset.workspaceWrite":"Запись в рабочей области","ask.answered":"{answered}/{total} с ответом","ask.cancelled":"отменено","ask.cancelledDetail":"Этот набор вопросов отменён до отправки ответов.","ask.closed":"закрыто","ask.closedDetail":"Этот вопрос закрыт; результат — в диалоге ниже.","ask.interrupted":"прервано","ask.interruptedDetail":"Этот набор вопросов прерван до отправки ответов.","ask.pending":"продолжено; ответ ещё доступен","ask.pendingDetail":"На эти ожидающие вопросы ещё можно ответить из поля ввода.","ask.reopen":"Ответить","ask.review":"Посмотреть ответы","ask.rowTitle":"Задать вопрос","ask.skipped":"Без ответа","ask.waiting":"ожидание","attachment.directoryDesktopOnly":"Папки можно добавлять только в настольном приложении; в браузере добавляйте отдельные файлы","attachment.dropBlocked":"Сейчас нельзя добавить файлы и изображения","attachment.dropDesc":"Лимит изображений: до {count} изображения, по {size}|Лимит изображений: до {count} изображений, по {size}|Лимит изображений: до {count} изображений, по {size}","attachment.dropTitle":"Перетащите сюда файлы или изображения, чтобы добавить их","attachment.pathUnavailable":"Не удалось получить путь к папке; перетащите её снова","attachment.pathUnsupported":"Путь содержит символы, недопустимые в ссылке; переименуйте и повторите","attachment.pending":"Вложения к отправке","attachment.scrollLeft":"Прокрутить вложения влево","attachment.scrollRight":"Прокрутить вложения вправо","bash.failed":"Сбой","bash.running":"Выполняется","bash.stopped":"Остановлено","command.attachmentsUnsupported":"/{command} не принимает вложения; сначала удалите их","context.aria":"израсходовано {percent} контекста","context.messages":"Сообщения","context.system":"Системный промпт","context.tools":"Определения инструментов","context.used":"Расход контекста","detail.agent.reply":"Ответ агента","detail.agents.count":"{count} агент|{count} агента|{count} агентов","detail.days":"{count} д","detail.empty":"Нет результатов","detail.event.neighbors":"Соседние события","detail.field.agent":"ID агента","detail.field.agents":"Запущено агентов","detail.field.availability":"Доступность","detail.field.bestMatch":"Лучшее совпадение","detail.field.callId":"ID вызова","detail.field.content":"Содержимое","detail.field.context":"Контекст","detail.field.currentPackage":"Текущий пакет","detail.field.data":"Данные","detail.field.dependencies":"Зависимости","detail.field.depth":"Глубина","detail.field.diagnostics":"Диагностика","detail.field.exitCode":"Код выхода","detail.field.id":"ID","detail.field.inputSchema":"Схема входа","detail.field.job":"ID задачи","detail.field.latestRun":"Последний запуск","detail.field.message":"Сообщение","detail.field.messageId":"ID сообщения","detail.field.methods":"Методы","detail.field.model":"Модель","detail.field.nextPackage":"Следующий пакет","detail.field.outputSchema":"Схема выхода","detail.field.owner":"Владелец","detail.field.packages":"Пакеты","detail.field.parent":"Родитель","detail.field.pid":"PID","detail.field.platform":"Платформа","detail.field.previousStatus":"Предыдущее состояние","detail.field.processGroup":"Группа процессов","detail.field.props":"Свойства","detail.field.provider":"Провайдер","detail.field.ready":"Готов","detail.field.registrations":"Регистрации","detail.field.result":"Результат","detail.field.revision":"Ревизия","detail.field.role":"Роль","detail.field.root":"Корень","detail.field.seq":"Номер события","detail.field.signal":"Сигнал","detail.field.source":"Источник","detail.field.step":"Шаг","detail.field.surface":"Состояние записи","detail.field.target":"Целевое событие","detail.field.task":"Задача","detail.field.time":"Время","detail.field.turn":"Ход","detail.field.type":"Тип","detail.field.warnings":"Предупреждения","detail.field.writeScopes":"Области записи","detail.goal.active":"Активна","detail.goal.blocked":"Заблокирована","detail.goal.complete":"Завершена","detail.goal.disarmed":"Ожидает продолжения","detail.goal.empty":"Нет цели","detail.goal.paused":"Приостановлена","detail.goal.reason":"Препятствие","detail.goal.rounds":"Циклы","detail.hours":"{count} ч","detail.jobs.count":"{count} фоновая задача|{count} фоновые задачи|{count} фоновых задач","detail.location":"Строка {line}, столбец {column}","detail.locations.count":"{count} позиция|{count} позиции|{count} позиций","detail.matches.capped":"Достигнут предел результатов; сузьте поиск, чтобы увидеть больше","detail.matches.count":"{count} совпадение|{count} совпадения|{count} совпадений","detail.minutes":"{count} мин","detail.models.title":"Доступные модели","detail.moreInInspect":"В «Подробнее» доступно ещё {count} элемент.|В «Подробнее» доступно ещё {count} элемента.|В «Подробнее» доступно ещё {count} элементов.","detail.no":"Нет","detail.none":"Нет","detail.output.lines":"Строки {begin}–{end} из {total}","detail.output.truncated":"Вывод обрезан","detail.plugins.count":"{count} динамический плагин|{count} динамических плагина|{count} динамических плагинов","detail.providers.count":"{count} провайдер проверки|{count} провайдера проверки|{count} провайдеров проверки","detail.ralph.limit":"Достигнут предел циклов","detail.ralph.reportedBlocker":"Исполнитель сообщил о препятствии","detail.ralph.reportedComplete":"Исполнитель сообщил о завершении","detail.receipt.alreadyFinished":"Уже завершено","detail.receipt.cancel":"Запрошена отмена","detail.receipt.closed":"Закрыто","detail.receipt.closing":"Закрывается","detail.receipt.delivered":"Сообщение доставлено","detail.receipt.interrupt":"Запрошено прерывание","detail.receipt.signal":"Сигнал отправлен","detail.receipt.started":"Запущено","detail.recordedResult":"Записанный результат","detail.report.nextSteps":"Оставшаяся работа","detail.schedule.active":"Включено","detail.schedule.count":"{count} задача автоматизации|{count} задачи автоматизации|{count} задач автоматизации","detail.schedule.cron":"Cron {expression} ({zone})","detail.schedule.custom":"Свой","detail.schedule.daily":"Каждый день в {time} ({zone})","detail.schedule.deleted":"Удалено","detail.schedule.empty":"Нет задач автоматизации","detail.schedule.ended":"Завершено","detail.schedule.every":"Каждые {interval}","detail.schedule.frequency":"Повтор","detail.schedule.once":"Один раз","detail.schedule.overdue":"Просрочено, ожидает продолжения сессии","detail.schedule.paused":"Приостановлено","detail.schedule.scheduled":"Запланировано","detail.schedule.weekly":"Еженедельно: {days} в {time} ({zone})","detail.schedule.when":"Запланировано на","detail.seconds":"{count} с","detail.state":"Состояние","detail.status.accepted":"Принято","detail.status.completed":"Завершено","detail.status.deleted":"Удалено","detail.status.exited":"Завершён","detail.status.failed":"Сбой","detail.status.idle":"Простой","detail.status.inactive":"Неактивен","detail.status.killed":"Отменено","detail.status.provisioning":"Подготовка","detail.status.queued":"В очереди","detail.status.ready":"Готов","detail.status.running":"Выполняется","detail.tasks.count":"{count} задача команды|{count} задачи команды|{count} задач команды","detail.tasks.nextPage":"Есть ещё задачи; следующий курсор — {cursor}","detail.terminals.count":"{count} терминал|{count} терминала|{count} терминалов","detail.todo.completed":"Выполнено","detail.todo.empty":"Список задач пуст","detail.todo.in_progress":"В работе","detail.todo.pending":"Ожидает","detail.trace.ancestors":"Сессии-предки","detail.trace.derived":"Производные события","detail.trace.descendants":"Сессии-потомки","detail.trace.replacedBy":"Заменено на","detail.trace.replacementChain":"Цепочка замен","detail.trace.replaces":"Заменённые события","detail.trace.sources":"События-источники","detail.wait.changed":"Обнаружено изменение","detail.wait.noProgress":"Нет активных субагентов","detail.wait.timeout":"Время ожидания истекло","detail.wait.title":"Активность субагентов","detail.weekday.1":"Пн","detail.weekday.2":"Вт","detail.weekday.3":"Ср","detail.weekday.4":"Чт","detail.weekday.5":"Пт","detail.weekday.6":"Сб","detail.weekday.7":"Вс","detail.weekday.join":", ","detail.workflow.script":"Скрипт рабочего процесса","detail.yes":"Да","details.running":"Выполняется…","diff.collapseAria":"Свернуть изменения","diff.expandAria":"Развернуть ещё {count} строку изменений|Развернуть ещё {count} строки изменений|Развернуть ещё {count} строк изменений","diff.expandRest":"… ещё {count} строка|… ещё {count} строки|… ещё {count} строк","diff.files.one":"{count} файл","diff.files.other":"{count} файла|{count} файлов","error.sessionInUse":"Эта сессия уже используется — возможно, другим запущенным экземпляром DSH (например, dsh web или настольным приложением). Закройте другие запущенные экземпляры DSH и повторите попытку.","file.attach":"Добавить вложение","file.label":"Файл","file.notStaged":"Файл загрузился не до конца; добавьте его снова и повторите","file.pending":"Файлы к отправке","file.remove":"Удалить файл {name}","file.retry":"Повторить загрузку {name}","file.sessionUnavailable":"Сессия недоступна; загрузка файлов невозможна","file.stillUploading":"Файлы ещё загружаются; отправьте, когда они загрузятся","file.uploadFailed":"Загрузка не удалась; нажмите, чтобы повторить","file.uploading":"Загрузка…","hero.chooseWorkspace":"Выбрать рабочую область","hero.headline":"В неизведанное","hero.preview":"Предварительная версия","hint.goal":"опишите цель длительной задачи","hint.goal.active":"цель активна — edit / pause / resume / clear","hint.plan":"опишите задачу, чтобы создать план","image.closePreview":"Закрыть просмотр оригинала","image.dimensionTooLarge":"Стороны изображения не должны превышать {size}px; уменьшите его и повторите","image.fileTooLarge":"Каждое изображение должно быть меньше {size}","image.label":"Изображение","image.loadFailed":"Изображение не загрузилось; нажмите, чтобы повторить","image.loading":"Загрузка изображения…","image.modelUnsupported":"Текущая модель не поддерживает изображения; переключитесь на модель, которая их поддерживает","image.openOriginal":"Открыть оригинал","image.openOriginalLabel":"{label}, нажмите, чтобы открыть оригинал","image.original":"Оригинальное изображение","image.pending":"Изображения к отправке","image.preview":"Просмотр оригинала","image.remove":"Удалить изображение {name}","image.sendFailed":"Не удалось отправить изображения ({reason}); добавьте их снова и повторите","image.tooMany":"В одно сообщение можно добавить до {count} изображения|В одно сообщение можно добавить до {count} изображений|В одно сообщение можно добавить до {count} изображений","image.tooManyPixels":"Слишком высокое разрешение изображения; сожмите его и повторите","image.totalTooLarge":"Суммарный размер изображений превышает {size}; удалите лишние и повторите","image.unsupportedType":"Поддерживаются только изображения PNG, JPG, WebP и GIF","input.accessMode":"Текущий режим доступа: {name}","input.commands":"Добавить файлы или выполнить команды","input.file":"Файл","input.send":"Отправить сообщение","input.send.queue":"Отправить в очередь","input.send.steer":"Вмешаться в работу","input.sending":"Отправка сообщения","input.stop":"Остановить генерацию","placeholder.default":"Сообщение или задача; / — команды, @ — файлы и сессии","placeholder.hero":"Опишите, что хотите создать; / — команды, @ — файлы и сессии","placeholder.parentOffline":"Родительская сессия не в сети; отправка недоступна, но запуск можно остановить","placeholder.plan":"опишите задачу, чтобы создать план","placeholder.steerQueue":"Cmd/Ctrl+Enter — отправить всю очередь с вмешательством","placeholder.unavailable":"Сессия недоступна","placeholder.workspace":"Выберите рабочую область, чтобы начать","queue.cancelEdit":"Отменить редактирование","queue.count":"{n} сообщение в очереди|{n} сообщения в очереди|{n} сообщений в очереди","queue.edit":"Изменить сообщение в очереди","queue.edit.unsupported":"Содержит нетекстовое содержимое; редактирование пока не поддерживается","queue.editFailed":"Не удалось изменить: возможно, сообщение уже начало отправляться.","queue.file":"Файл {name} в очереди","queue.image":"Изображение в очереди","queue.remove":"Удалить сообщение из очереди","queue.removeFailed":"Не удалось удалить: возможно, сообщение уже начало отправляться.","queue.save":"Сохранить сообщение в очереди","queue.sending":"Отправка…","queue.steer":"Вмешаться с сообщением","queue.steer.unavailable":"Вмешаться можно, только пока агент работает","queue.steerFailed":"Не удалось вмешаться. Повторите.","quote.remove":"Убрать цитату","read.collapseAria":"Свернуть содержимое","read.expandAria":"Развернуть ещё {count} строку|Развернуть ещё {count} строки|Развернуть ещё {count} строк","read.expandRest":"… ещё {count} строка|… ещё {count} строки|… ещё {count} строк","read.window":"Показано {shown} из {total} строк","row.commandArguments":"Аргументы команды","row.failed":"Сбой","row.imageSize":"{width}x{height}px, {bytes} байт","row.imageSizeDownscaled":"{width}x{height}px (уменьшено с {originalWidth}x{originalHeight}px), {bytes} байт","row.input":"ВВОД","row.inspect":"Подробнее","row.output":"ВЫВОД","row.preparing":"Подготовка вызова инструмента","row.running":"Выполняется","row.stopped":"Остановлено","search.collapseAria":"Свернуть результаты","search.expandAria":"Развернуть ещё {count} строку результатов|Развернуть ещё {count} строки результатов|Развернуть ещё {count} строк результатов","search.expandRest":"… ещё {count} строка|… ещё {count} строки|… ещё {count} строк","search.matches":"Совпадений: {shown} · файлов: {files}","search.matches.truncated":"Показано {shown} из {total} совпадений · файлов: {files}","search.noResults":"Нет результатов","search.paths":"Путей: {shown}","search.paths.truncated":"Показано {shown} из {total} путей","session.hierarchy":"Иерархия сессий","session.moreViews":"Ещё представления диалога","session.moreViewsCurrent":"Ещё представления диалога · {name}","settings.enter.description":"Что делают Enter и кнопка отправки, пока агент работает; Cmd/Ctrl+Enter использует другое поведение","settings.enter.queue":"В очередь","settings.enter.steer":"Вмешаться","settings.enter.title":"Поведение отправки, когда агент занят","shortcut.complementary":"Другое действие: «В очередь» или «Вмешаться»","shortcut.mention":"Открыть меню ссылок","shortcut.newline":"Перенос строки","shortcut.slash":"Открыть меню команд","terminal.collapseAria":"Свернуть вывод","terminal.commandLine":"Строка команды {n}","terminal.done":"Готово","terminal.exitCode":"код выхода {code}","terminal.expandAria":"Развернуть оставшуюся {n} строку вывода|Развернуть оставшиеся {n} строки вывода|Развернуть оставшиеся {n} строк вывода","terminal.expandRest":"… ещё {n} строка|… ещё {n} строки|… ещё {n} строк","terminal.failed":"Сбой","terminal.noExitCode":"нет кода выхода","terminal.noOutput":"Нет вывода","terminal.running":"Выполняется","terminal.sendInput":"(отправить ввод)","terminal.session":"Терминал {sessionId}","terminal.signal":"сигнал {signal}","todo.completed":"{done}/{total} выполнено","todo.diff.added":"{count} добавлен|{count} добавлено|{count} добавлено","todo.diff.addedItem":"Добавлено","todo.diff.compare":"Изменения по сравнению с прошлым списком","todo.diff.initial":"Исходный список","todo.diff.movedItem":"Порядок изменён","todo.diff.noChanges":"В списке нет изменений","todo.diff.removed":"{count} удалён|{count} удалено|{count} удалено","todo.diff.removedItem":"Удалено","todo.diff.unavailable":"Прошлый список недоступен","todo.diff.unchanged":"{count} без изменений","todo.diff.updated":"{count} обновлён|{count} обновлено|{count} обновлено","todo.diff.updatedItem":"Статус изменён","todo.progress.active":"{active} в работе","todo.progress.done":"{done} выполнено","todo.progress.pending":"{pending} ожидает","todo.rowTitle":"Обновить список задач","todo.status.completed":"Выполнено","todo.status.inProgress":"В работе","todo.status.pending":"Ожидает","todo.title":"Задачи","tool.autoReviewNotExecuted":"Инструмент не выполнен. Причина: {reason}","tool.autoReviewReasonFallback":"Автопроверка не разрешила это действие","tool.autoReviewRejected":"Отклонено автопроверкой","tool.preparing.content":"{kilobytes} КБ","tool.title.applyPatch":"Применить патч","tool.title.bash":"Bash","tool.title.closeTerminal":"Закрыть терминал","tool.title.code":"Код","tool.title.createGoal":"Создать цель","tool.title.createSchedule":"Создать задачу автоматизации","tool.title.createTeamTask":"Создать задачу команды","tool.title.deleteSchedule":"Удалить задачу автоматизации","tool.title.edit":"Изменение","tool.title.editSchedule":"Изменить задачу автоматизации","tool.title.findDefinition":"Найти определение","tool.title.findImplementation":"Найти реализацию","tool.title.findReferences":"Найти ссылки","tool.title.generic":"Вызов инструмента","tool.title.getGoal":"Посмотреть цель","tool.title.getTeamTask":"Прочитать задачу команды","tool.title.glob":"Glob","tool.title.grep":"Grep","tool.title.hoverSymbol":"Просмотр символа","tool.title.inspect":"Запрос окружения Cordis","tool.title.inspectPlugins":"Просмотр плагинов","tool.title.inspectProviders":"Просмотр провайдеров","tool.title.interruptAgent":"Прервать агента","tool.title.killJob":"Отменить фоновую задачу","tool.title.listAgents":"Список субагентов","tool.title.listJobs":"Список фоновых задач","tool.title.listModels":"Список моделей","tool.title.listSchedules":"Список задач автоматизации","tool.title.listTeamTasks":"Список задач команды","tool.title.listTerminals":"Список терминалов","tool.title.lsp":"Запрос символов кода","tool.title.openTerminal":"Открыть терминал","tool.title.pwsh":"PowerShell","tool.title.queryRuntime":"Запрос среды выполнения","tool.title.ralph":"Запуск цикла ralph","tool.title.read":"Чтение","tool.title.readEvent":"Прочитать событие","tool.title.readImage":"Чтение изображения","tool.title.readJob":"Прочитать вывод задачи","tool.title.readTerminal":"Прочитать терминал","tool.title.removeCordis":"Удалить плагин Cordis","tool.title.runCordis":"Запустить плагин Cordis","tool.title.search":"Поиск","tool.title.searchEvents":"Поиск событий","tool.title.searchSessions":"Поиск сессий","tool.title.sendMessage":"Отправить сообщение","tool.title.signalTerminal":"Послать сигнал терминалу","tool.title.spawnTeammate":"Создать участника команды","tool.title.stopCordis":"Остановить плагин Cordis","tool.title.subagent":"Создать субагента","tool.title.traceEvent":"Трассировка события","tool.title.traceSession":"Трассировка сессии","tool.title.updateGoal":"Обновить цель","tool.title.updateSchedule":"Изменить задачу автоматизации","tool.title.updateTeamTask":"Обновить задачу команды","tool.title.viewSchedule":"Просмотреть задачу автоматизации","tool.title.waitAgent":"Дождаться субагента","tool.title.webFetch":"Получение","tool.title.webSearch":"Поиск","tool.title.workflow":"Запуск рабочего процесса","tool.title.write":"Запись","web.contentTruncated":"Содержимое обрезано","web.http":"HTTP","web.noResults":"Ничего не найдено","web.sourcesTruncated":"Список источников обрезан"},"cordis":{"a11y.defining":"Определение плагина","a11y.failed":"Ошибка определения","a11y.preparing":"Подготовка вызова инструмента Cordis","a11y.stopped":"Определение прервано","action.approve":"Подтвердить","action.approveOnce":"Подтвердить только эту версию","action.approvePlugin":"Подтвердить будущие версии этого плагина","action.decline":"Отклонить","action.inspect":"Подробнее","action.remove":"Удалить","action.retry":"Повторить","action.rollback":"Откатить","action.run":"Запустить","action.stop":"Остановить","body.clientCode":"Клиент","body.copied":"Скопировано","body.copy":"Копировать","body.hostCode":"Хост","body.output":"Результат","body.source":"Код плагина","panel.approvals.aria":"Подтверждения Cordis","panel.current":"Текущий: {packageId}","panel.empty":"Плагины ещё не определены","panel.group.current":"Эта сессия","panel.group.others":"Другие сессии","panel.hint":"Управление запуском — в панели Cordis над настройками","panel.loading":"Чтение…","panel.next":"Следующий: {packageId}","panel.plugins.aria":"Плагины Cordis","panel.readFailed":"Не удалось прочитать состав плагинов: {message}","panel.runningCount":"{count} запущен|{count} запущено|{count} запущено","panel.title":"Плагины Cordis","panel.trigger":"Плагин Cordis","panel.version":"Версия","purpose.missing":"(назначение не указано)","render.failedAbdicated":"Сбой отрисовки в {slot}; восстановлен интерфейс по умолчанию:","render.failedHeld":"Сбой отрисовки в {slot}:","row.defineTitle":"Зарегистрировать плагин Cordis","row.removeTitle":"Удалить плагин Cordis","row.runTitle":"Запустить плагин Cordis","row.stopTitle":"Остановить плагин Cordis","row.updateTitle":"Обновить плагин Cordis","run.removed":"Этот пакет больше не существует","run.superseded":"Ниже доступна карточка более нового запуска","status.awaitingApproval":"Ожидает подтверждения","status.clientPending":"Клиент готов к активации","status.failed":"Сбой запуска","status.idle":"Готов","status.removed":"Удалён","status.running":"Запущен","status.superseded":"Есть более новый запуск"},"cotTranslation":{"anonymousNotice":"Bing и Google не требуют входа или ключа API для перевода. Их анонимные эндпоинты могут отклонять запросы или ограничивать их.","bing":"Bing","codeTitle":"Блок кода","copied":"Скопировано","copy":"Копировать","deepseekAccount":"DeepSeek Flash — учётная запись (платно)","deepseekOfficial":"DeepSeek Flash — официальный API (платно)","failed":"Сбой перевода. Показан оригинал.","footnotes":"Сноски","google":"Google","invalidLanguage":"Введите auto или код языка, например zh, en или ja.","invalidProvider":"Выберите сервис перевода.","original":"Показать оригинал","overridden":"Переопределено","paidNotice":"Для каждого фрагмента, которого нет в кэше, отправляется отдельный платный запрос DeepSeek Flash через выбранную учётную запись или учётные данные официального API. При повторном раскрытии рассуждений используются сохранённые результаты; смена сервиса, языка, исходного текста или настроек запроса может отправить новый платный запрос.","privacy":"Раскрытые рассуждения отправляются в выбранный сервис. Они могут содержать приватный код или детали диалога.","provider":"Сервис перевода","providerUnavailable":"Этот сервис недоступен. Настройте учётную запись DeepSeek или провайдера официального API либо выберите доступный сервис.","providerUnavailableOption":"{provider} — недоступно","readOnly":"Настройки этой установки доступны только для чтения.","reset":"Сбросить по умолчанию","retry":"Повторить","save":"Сохранить","saveFailed":"Установка не приняла эти значения; они остались, чтобы вы их исправили.","saving":"Сохранение…","targetLanguage":"Язык перевода","targetLanguageHint":"auto соответствует языку интерфейса; также можно указать код языка, например zh, en или ja.","translating":"Перевод рассуждений","translation":"Показать перевод","unavailable":"Настройки перевода недоступны.","unwrap":"Не переносить строки","wrap":"Переносить строки"},"creationRecommendations":{"access-denied":"Это подключение не может менять плагины.","applicationCancelled":"Последнее изменение отменено.","applicationFailed":"Последнее изменение не применилось. Проверьте «Плагины».","cancel":"Отменить создание","cancelled":"Отменено","cancelling":"Отменяется…","closing":"Плагин создания останавливается. Повторите после перезагрузки.","collapseContent":"Свернуть содержимое","create":"Создать","creating":"Создание в фоне","creationBackground":"Нажмите «Создать», чтобы запустить в фоне. Здесь можно продолжать общение.","creationCost":"Создание может занять время и потратить много токенов.","creationInfo":"Как устроено создание и расход токенов","creationMethod":"Режим создания собирает новую страницу, которую можно удалить в любой момент.","custom":"Своё расположение","customHint":"Опишите, где она должна быть","customLabel":"Где она должна появиться?","customPlaceholder":"Например, запись в левой панели, открывающая календарь на всю страницу","dismiss":"Не сейчас","dismissed":"Скрыто","expandContent":"Показать всё содержимое","failed":"Создание не удалось. Повторите.","heading":"Персональные страницы","initialContent":"Начальное содержимое","installed":"Установлено","installing":"Установка…","interrupted":"Создание прервано. Повторите.","invalid-location":"Выберите расположение или опишите его не длиннее 1000 знаков.","keep":"Оставить","kept":"Оставлено","location":"Добавить в","not-live-root":"Откройте исходный диалог, чтобы использовать эту карточку.","overridden":"Изменение перекрыто другой конфигурацией.","page":"Вкладка сессии","pageHint":"Открывается рядом с «Чатом» и «Траекторией»","read-only":"Эта сессия доступна только для чтения. Переключите набор разрешений, чтобы создавать страницы.","removed":"Удалено","replaced":"Заменено","restart-required":"Изменение сохранено. Перезапустите DSH, чтобы применить.","restore":"Восстановить","restoring":"Восстановление…","retry":"Создать заново","scope":"Можно удалить в любой момент","sidebar-left":"Глобальная страница","sidebar-leftHint":"Открывается из левой боковой панели","sidebar-right":"Правая боковая панель","sidebar-rightHint":"Открывается рядом с этим диалогом","source-missing":"Файлы страницы исчезли. Запросите новое предложение.","sourceRetained":"Отмена сохраняет исходные файлы в папке .dsh-created-plugins/ исходной рабочей области.","starting":"Запуск…","transport":"Не удалось подтвердить результат. Переподключитесь и проверьте карточку, прежде чем повторять.","unavailable":"Действие недоступно. Проверьте плагин на странице «Плагины».","unconfirmed":"Результат не подтверждён. Повторите проверку.","undo":"Отменить","unknown":"Рекомендация больше недоступна."},"cuaPermissions":{"accessibility":"Универсальный доступ","accessibilityPermission":"В «Системных настройках» разрешите приложению {application} читать элементы интерфейса, нажимать и печатать.","accessibilityUse":"Читать элементы интерфейса, нажимать и печатать.","allowedApps":"Приложения с постоянным доступом","applicationsFailed":"Не удалось загрузить список приложений: {message}","applicationsTitle":"Управление доступом приложений для управления компьютером","blockedApps":"Запрещённые приложения","close":"Закрыть","defaultBody":"Управление компьютером доступно только в режиме PTC.","defaultConfirm":"Сделать PTC режимом по умолчанию","defaultFailed":"Не удалось изменить режим по умолчанию: {message}","defaultNotSaved":"Режим по умолчанию не сохранён. Повторите.","defaultReadOnly":"Настройки режима по умолчанию доступны только для чтения.","defaultSet":"PTC — режим по умолчанию","defaultTitle":"Режим по умолчанию для новых сессий","defaultUnavailable":"Не удалось прочитать режим по умолчанию. Проверьте его в настройках.","failed":"Не удалось обновить разрешения: {message}","granted":"Разрешено","iconsFailed":"Не удалось загрузить значки приложений: {message}","later":"Позже","noApps":"Нет приложений с постоянным доступом или запретом.","opened":"Системные настройки открыты","openSetup":"Открыть настройки","permissionHint":"Управляйте разрешениями в «Системных настройках» для приложения, которое указывает macOS.","persistentBody":"Сохранять переменные и объекты приложений между вызовами инструментов. Переключение перезапускает среду выполнения PTC.","persistentConfirm":"Включить постоянный режим","persistentFailed":"Не удалось изменить режим выполнения PTC: {message}","persistentNotSaved":"Режим выполнения PTC не сохранён. Повторите.","persistentReadOnly":"Настройки выполнения PTC доступны только для чтения.","persistentSet":"Постоянный режим включён","persistentTitle":"Режим выполнения PTC","persistentUnavailable":"Не удалось прочитать режим выполнения PTC. Проверьте его в настройках.","queryFailed":"Не удалось проверить разрешения: {message}","request":"Запросить разрешение","requested":"Подтвердите запрос macOS или откройте «Системные настройки», если он не появился","retry":"Повторить","retryAllowed":"При следующем выборе приложения запрос появится снова; доступ пока не предоставлен","retryApproval":"Разрешить спрашивать снова","revoke":"Отозвать","revoked":"Доступ приложения отозван","screenRecording":"Запись экрана","screenRecordingPermission":"В «Системных настройках» разрешите приложению {application} записывать окна приложений.","screenRecordingUse":"Записывать окно выбранного приложения.","settings":"Открыть системные настройки","setupBody":"Управление компьютером включено. Перед использованием переключитесь в режим PTC и предоставьте разрешения «Универсальный доступ» и «Запись экрана». Откройте подробности плагина, чтобы завершить настройку.","setupQueryFailed":"Управление компьютером включено, но проверить системные разрешения не удалось. Откройте подробности плагина, посмотрите ошибку и повторите.","setupTitle":"Настройте управление компьютером перед использованием","title":"Разрешить управление компьютером","unknown":"Неизвестно"},"deepseek-model-label-1017":{"badge.label":"1017"},"deliverables":{"changes.added":"+{count}","changes.all":"Все {count} файл|Все {count} файла|Все {count} файлов","changes.binary":"двоичный","changes.collapse":"Свернуть","changes.collapseAria":"Свернуть изменённые файлы","changes.deleted":"-{count}","changes.expandAria":"Показать все {count} изменённый файл|Показать все {count} изменённых файла|Показать все {count} изменённых файлов","changes.openReview":"Проверить изменения этого хода на боковой панели","changes.oversized":"слишком большой","changes.singleTitle":"Изменён {name}","changes.title":"Изменён {count} файл|Изменены {count} файла|Изменено {count} файлов","changes.viewDiff":"Открыть изменения {name}","diff.binary":"Двоичный файл; изменения показать нельзя","diff.coarse":"Время построчного сравнения истекло; показана замена файла целиком","diff.created":"Создан в этом ходе","diff.deleted":"Удалён в этом ходе","diff.error":"Не удалось прочитать изменения","diff.loading":"Чтение изменений…","diff.missing":"Содержимое изменений этого хода больше недоступно","diff.oversized":"Файл слишком большой; изменения показать нельзя","diff.truncated":"Показана первая {count} строка|Показаны первые {count} строки|Показаны первые {count} строк","diff.unchanged":"Строки с обеих сторон совпадают","presented.action":"Открыть","presented.all":"Все {count} файл|Все {count} файла|Все {count} файлов","presented.collapse":"Свернуть","presented.collapseAria":"Свернуть список переданных файлов","presented.defaultApp":"Открыть в приложении по умолчанию","presented.directory":"Открыть папку с файлом","presented.directoryError":"Не удалось открыть папку с файлом. Повторите попытку.","presented.directoryOpened":"Запрошено открытие папки с файлом","presented.directoryOpening":"Открытие папки с файлом…","presented.error":"Не удалось открыть. Нажмите, чтобы повторить.","presented.expandAria":"Показать все {count} переданный файл|Показать все {count} переданных файла|Показать все {count} переданных файлов","presented.explorer":"Показать в Проводнике","presented.file":"Файл","presented.finder":"Показать в Finder","presented.hostError":"Не удалось прочитать сведения о рабочем столе хоста","presented.more":"Другие действия с файлом {name}","presented.nativeUnavailable":"У этого файла нет доступного пути на хосте. Откройте предпросмотр на боковой панели.","presented.open":"Открыть {name} в приложении по умолчанию","presented.opened":"Запрошено открытие","presented.opening":"Открытие…","presented.preview":"Предпросмотр на боковой панели","presented.previewButton":"Открыть {name} на боковой панели","presented.previewCard":"Предпросмотр {name} на боковой панели","presented.retry":"Повторить","presented.revealed":"Запрошен показ в файловом менеджере","presented.revealError":"Не удалось показать в файловом менеджере. Повторите попытку.","presented.revealing":"Показ в файловом менеджере…","presented.unavailable":"У этого хоста нет доступного рабочего стола, поэтому открыть файлы и папки во внешних приложениях нельзя. Файлы по-прежнему можно просмотреть на боковой панели.","produced.label":"Изменённые файлы","produced.more":"+ {count} файл|+ {count} файла|+ {count} файлов","produced.moreOne":"+ 1 файл","produced.open":"Открыть {name}","review.nowrap":"Выключить перенос строк","review.openFile":"Открыть весь файл на боковой панели","review.openFileAria":"Открыть {name} на боковой панели","review.selectFile":"Выбор файла для проверки","review.split":"Переключить на разделённый вид","review.splitAria":"Разделённый вид","review.title":"Проверка · ход {turn}","review.unified":"Переключить на объединённый вид","review.wrap":"Включить перенос строк","review.wrapAria":"Перенос строк","row.error":"Не удалось передать","row.inspect":"Показать вызов","row.ok":"Передано","row.preparing":"Подготовка передачи","row.running":"Передача…","row.stopped":"Прервано","row.title":"Передать файлы"},"directory-browser":{"browser.cancel":"Отмена","browser.create":"Создать","browser.createIn":"Новая папка в «{name}»","browser.editPath":"Изменить путь","browser.folderName":"Имя папки","browser.home":"Домашний каталог","browser.loading":"Загрузка…","browser.newFolder":"Новая папка","browser.open":"Открыть","browser.showHidden":"Показывать скрытые файлы","browser.title":"Выбор каталога рабочей области","browser.truncated":"Слишком много папок — показано только начало.","browser.untitledFolder":"Папка без названия"},"documentHtml":{"failed":"Не удалось показать предпросмотр этого HTML-документа.","frame":"Предпросмотр HTML-документа","loading":"Отрисовка документа…","title":"HTML"},"documentMarkdown":{"code.copied":"Скопировано","code.copy":"Копировать","footnotes":"Сноски","viewer.label":"Markdown"},"entryCustomization":{"create":"Создать свой плагин","createPrompt.conversation":"Создать плагин представления диалога для DSH.","createPrompt.rightbar":"Создать плагин DSH с записью в правой боковой панели.","createPrompt.sidebar":"Создать плагин DSH с записью в левой боковой панели.","install":"Обзор других плагинов"},"feedback":{"action.dislike":"Плохой ответ","action.dislikeActive":"Убрать оценку","action.like":"Хороший ответ","action.likeActive":"Убрать оценку","category.instruction-following":"Понимание инструкций и следование им","category.other":"Другое","category.product-interaction":"Функции продукта и взаимодействие","category.resource-cost":"Расход ресурсов и стоимость","category.security-privacy-permission":"Безопасность, конфиденциальность и разрешения","category.service-stability":"Стабильность и скорость","category.task-result":"Результат задачи","dialog.categories":"Категория отзыва","dialog.detail":"Подробности отзыва","dialog.hint":"Добавьте подробности, чтобы помочь нам стать лучше. В отзыв войдёт журнал текущего диалога.","dialog.title":"Отправить отзыв","error.conflict":"Этот отзыв изменён в другом месте; показано последнее состояние","error.generic":"Не удалось сохранить отзыв","error.load":"Не удалось загрузить отзыв","error.noteTooLarge":"Описание слишком длинное; сократите его и отправьте снова","toast.recorded":"Спасибо за ваш отзыв"},"fileActions":{"menu.copied":"Скопировано","menu.copyFailed":"Не удалось скопировать. Проверьте доступность содержимого и повторите попытку.","menu.copyImage":"Копировать изображение","menu.download":"Скачать","menu.downloaded":"Скачивание завершено","menu.downloadStarted":"Скачивание началось","menu.finder":"Показать в Finder","menu.reveal":"Показать в папке","menu.saveAs":"Сохранить как…","menu.saved":"Сохранено","menu.saveFailed":"Не удалось сохранить. Проверьте источник и назначение и повторите попытку.","path.revealError":"Не удалось показать расположение файла. Повторите попытку."},"fileDrag":{"failed":"Не удалось перетащить. Попробуйте ещё раз."},"forgePanel":{"branch.linked":"Рабочее дерево: {path}","branch.missing":"Рабочее дерево недоступно: {path}","branch.project":"Каталог проекта: {path}","branch.worktree":"Рабочее дерево (от {base}): {path}","change.check.queued":"В очереди","change.check.running":"Выполняется","change.checks.cancelled":"{count} отменено","change.checks.failed":"ошибок: {count}","change.checks.loadFailed":"Не удалось загрузить ещё проверки: {message}","change.checks.loading":"Загрузка проверок","change.checks.other":"прочих: {count}","change.checks.passed":"пройдено: {count}","change.checks.retry":"Повторить загрузку проверок","change.checks.running":"выполняется: {count}","change.checks.truncated":"Показаны только первые {count}","change.ci.cancelled":"Проверок отменено: {count}","change.ci.failed":"Проверок с ошибкой: {count}","change.ci.failedUnlisted":"Проверки не пройдены","change.ci.none":"Проверок нет","change.ci.passed":"Проверки пройдены","change.ci.running":"Проверки выполняются","change.collapse":"Свернуть {name}","change.copy":"Скопировать ссылку на запрос изменения","change.expand":"Развернуть {name}","change.failure.notFound":"Запрос изменения не существует или недоступен","change.failure.unauthenticated":"Войдите, чтобы прочитать его состояние","change.failure.unavailable":"Не удалось прочитать состояние запроса изменения","change.flag.changesRequested":"Запрошены изменения","change.flag.conflicting":"Конфликты","change.flag.draft":"Черновик","change.markReady":"Готов к проверке","change.merge":"Слить","change.merge.conflicting":"Конфликты с {base}","change.merge.mergeable":"Конфликтов нет","change.merge.unknown":"Проверка конфликтов","change.mergeChanged":"Пришли новые коммиты. Просмотрите их, прежде чем открывать меню слияния снова.","change.mergeConfirm":"Подтвердить слияние","change.mergedTo":"Слито в {base}","change.mergeMethod.merge":"Создать коммит слияния","change.mergeMethod.rebase":"Перебазировать и слить","change.mergeMethod.squash":"Сжать и слить","change.mergeNote.merge":"Сохранить все коммиты и добавить коммит слияния","change.mergeNote.rebase":"Применить каждый коммит поверх {base}","change.mergeNote.squash":"Объединить все коммиты в один","change.mergeTitle":"Слить {name} в {base}","change.number":"#{number}","change.remove":"Убрать из этой сессии","change.removeAria":"Убрать {name} из этой сессии","change.review.approved":"Одобрено","change.review.changesRequested":"Запрошены изменения","change.review.none":"Проверка не запрошена","change.review.required":"Требуется проверка","change.review.threads":"{review} · не решено: {count}","change.row.changes":"Изменения","change.row.checks":"Проверки","change.row.merge":"Слияние","change.row.review":"Проверка","change.state.blocked":"Требует внимания","change.state.closed":"Закрыт","change.state.draft":"Черновик","change.state.merged":"Слит","change.state.open":"Открыт","change.state.unknown":"Неизвестно","change.stateAria":"Состояние запроса изменения: {state}","change.unserved":"Состояние запросов изменения для этого хостинга кода пока не поддерживается","change.view":"Открыть в браузере","change.viewChangesAria":"Изменения {name}: добавлено строк {added}, удалено строк {deleted}","changes.empty":"В этой сессии пока нет запросов изменения","changes.emptyHint":"Здесь появятся запросы изменения, связанные с этой сессией (созданные, просмотренные, изменённые, выгруженные или открытые в текущей либо отправленной ветке)","changes.local.create":"Создать запрос изменения","changes.local.files":"файлов: {count}","changes.local.prompt":"Создать запрос изменения для изменений этой сессии","changes.local.refs":"{head} → {base}","changes.local.title":"Изменения","changes.local.viewAria":"Изменения этой сессии: файлов {count}, добавлено строк {added}, удалено строк {deleted}","changes.title":"Запросы изменения этой сессии · {count}","checkout.copyProjectPath":"Скопировать путь каталога проекта","checkout.copyWorktreePath":"Скопировать путь рабочего дерева","checkout.detached":"Не на ветке","checkout.failed":"Не удалось прочитать сведения Git","checkout.none":"Этот каталог не является репозиторием Git","checkout.project":"Каталог проекта","checkout.restore":"Восстановить","checkout.worktree":"Рабочее дерево","checkout.worktreeFrom":"Рабочее дерево · от {base}","creation.base":"От","creation.branch":"Ветка","creation.cancel":"Отмена","creation.checkout":"Выгрузить файлы","creation.details":"Подробнее","creation.error":"Причина","creation.failed":"Не удалось создать рабочее дерево","creation.head":"Текущий HEAD","creation.prepare":"Создать ветку","creation.retry":"Повторить","creation.skip":"Продолжить без рабочего дерева","creation.stopped":"Создание рабочего дерева остановлено","creation.title":"Создание рабочего дерева","creation.waiting":"Сообщение будет отправлено, когда рабочее дерево появится","diff.allFiles":"Все файлы ({count})","diff.badgeUncommitted":"Не закоммичено","diff.binary":"Двоичный файл; его изменения показать нельзя","diff.binaryLabel":"Двоичный","diff.collapseAll":"Свернуть все файлы","diff.copyPath":"Скопировать путь","diff.deletedFile":"Удалён","diff.empty":"Изменений нет","diff.error":"Не удалось прочитать изменения","diff.expandAll":"Развернуть все файлы","diff.fileTooLarge":"Файл слишком большой для показа","diff.fileTree":"Дерево файлов","diff.filterConfigFailed":"Сравнение не выполнено: настройки фильтров Git прочитаны не полностью. Проверьте настройки Git и лимит вывода, затем повторите.","diff.filterFiles":"Фильтр файлов…","diff.hideFileTree":"Скрыть дерево файлов","diff.largeCollapsed":"Большой файл: свёрнуто {count} изменённая строка|Большой файл: свёрнуто {count} изменённые строки|Большой файл: свёрнуто {count} изменённых строк","diff.moreActions":"Ещё действия для {name}","diff.moveFileTreeRight":"Переместить дерево файлов вправо","diff.newFile":"Новый файл","diff.noForkPoint":"Точка ветвления для этой ветки не найдена; выберите другой охват","diff.noMatchingFiles":"Нет подходящих файлов","diff.nowrap":"Отключить перенос длинных строк","diff.omitted":"Ещё {count} неотслеживаемый файл не показан|Ещё {count} неотслеживаемых файла не показаны|Ещё {count} неотслеживаемых файлов не показаны","diff.openFileInBrowser":"Открыть файл в браузере","diff.openFileInSidebar":"Открыть файл целиком в боковой панели","diff.refresh":"Обновить изменения","diff.renamed":"Переименован из {from}","diff.renamedPath":"{from} → {path}","diff.resizeFileTree":"Изменить размер дерева файлов","diff.scope.branch":"Ветка","diff.scope.staged":"Проиндексировано","diff.scope.uncommitted":"Не закоммичено","diff.scope.unstaged":"Не проиндексировано","diff.scopeNote.branch":"Сравнение с {base}, включая незакоммиченные изменения","diff.scopeNote.staged":"Индекс в сравнении с HEAD","diff.scopeNote.uncommitted":"Сравнение с HEAD, включая неотслеживаемые файлы","diff.scopeNote.unstaged":"Сравнение с индексом, включая неотслеживаемые файлы","diff.showFileTreeLeft":"Показать дерево файлов слева","diff.split":"Показать рядом","diff.splitAria":"Рядом","diff.stale":"В локальной ветке {count} неотправленный коммит; это изменения из запроса изменения|В локальной ветке {count} неотправленных коммита; это изменения из запроса изменения|В локальной ветке {count} неотправленных коммитов; это изменения из запроса изменения","diff.tab":"Изменения","diff.tabNumbered":"Изменения в #{number}","diff.tooLarge":"Эти изменения слишком большие, чтобы показать их здесь","diff.unchanged":"{count} неизменённая строка|{count} неизменённые строки|{count} неизменённых строк","diff.unchangedRest":"Остальные неизменённые строки","diff.unified":"Показать в одну колонку","diff.viewInBrowser":"Открыть в браузере","diff.wrap":"Переносить длинные строки","diff.wrapAria":"Перенос строк","duration.hours":"{hours} ч {minutes} мин","duration.minutes":"{minutes} мин {seconds} с","duration.seconds":"{seconds} с","guide.description":"Просматривайте изменения кода и запросы на изменения в этой сессии","guide.title":"Проверка кода и изменения","header.attention":"Запросы изменения этой сессии требуют внимания","header.label":"Запросы изменения этой сессии","list.more":"Ещё {count} запрос изменения|Ещё {count} запроса изменения|Ещё {count} запросов изменения","list.stateChecks":"{state} · {checks}","list.worktree":"В своём рабочем дереве","missing.kept":"Рабочее дерево ветки {branch} можно восстановить на прежнем месте. Незакоммиченные изменения, сделанные до удаления, восстановить нельзя","missing.leave":"Продолжить в проекте","missing.recreated":"Ветка {branch} тоже была удалена. Восстановление создаст её заново на коммите, с которого началось рабочее дерево, без последующих коммитов и незакоммиченных изменений","missing.restore":"Восстановить рабочее дерево","missing.title":"Рабочее дерево недоступно","missing.unknown":"Восстановление рабочего дерева не завершено, и ветку {branch} проверить нельзя. Исправьте ошибку восстановления и повторите либо продолжите в проекте.","missing.waiting":"Сообщение будет отправлено после восстановления рабочего дерева или продолжения в проекте","refresh":"Обновить состояние","restoration.prepare":"Подготовить рабочее дерево","restoration.title":"Восстановление рабочего дерева","retry":"Повторить","review.addComment":"Добавить комментарий","review.addToInput":"Добавить в поле ввода","review.approve":"Одобрить","review.cancel":"Отмена","review.close":"Закрыть","review.comment":"Оставить комментарий…","review.commentOnly":"Комментарий","review.confirmRetry":"Проверено — можно отправить повторно","review.done":"Готово","review.drafts":"Неотправленные комментарии ({count})","review.edit":"Изменить","review.failed":"Не удалось отправить ревью: {message}","review.githubActions":"Параметры комментария GitHub","review.inputFailed":"Поле ввода пока не принимает ссылку. Повторите позже.","review.loadFailed":"Не удалось прочитать черновики ревью. Проверьте хранилище браузера.","review.outdated":"Код обновлён","review.pending":"Ожидает","review.publish":"Опубликовать один комментарий","review.published":"Опубликовано на GitHub","review.publishing":"Публикация…","review.queue":"Добавить в ревью","review.quoted":"Добавлено в поле ввода","review.range":"Комментарий к {range}","review.recheck":"Открыть на GitHub","review.remove":"Удалить","review.requestChanges":"Запросить изменения","review.saveFailed":"Не удалось сохранить черновик ревью. Проверьте хранилище браузера и повторите.","review.selectLine":"Выберите строку {line}","review.stale":"В PR появились новые коммиты. Обновите и снова выберите строки комментария.","review.startReview":"Начать ревью","review.submit":"Отправить ревью","review.submitted":"Ревью отправлено","review.submitting":"Отправляем…","review.summary":"Итог ревью…","review.summaryRequired":"Введите итог ревью, чтобы запросить изменения.","review.unknown":"Результат отправки неизвестен. Проверьте GitHub, прежде чем публиковать снова.","review.unsupported":"Этот хостинг кода не поддерживает отправку ревью.","review.yourComment":"Ваш комментарий","signin.copy":"Скопировать команду входа","signin.title":"Войдите в {host}, чтобы показывать состояние запросов изменения","signin.unavailable":"Не удалось прочитать запросы изменения на {host}: {message}","stream.failed":"Не удалось загрузить панель запросов изменения","tab.title":"Запросы изменения","time.days":"{n} дн. назад","time.finished":"{state} · {time}","time.hours":"{n} ч назад","time.minutes":"{n} мин назад","time.months":"{n} мес. назад","time.now":"только что","time.years":"{n} г. назад","toast.branchesFailed":"Не удалось прочитать ветки","toast.copied":"Ссылка скопирована","toast.copyFailed":"Не удалось скопировать","toast.expandFailed":"Не удалось показать неизменённые строки: {message}","toast.expandStale":"Файл изменился после чтения его изменений; обновите перед разворачиванием","toast.leaveFailed":"Не удалось перейти в каталог проекта; повторите","toast.markedReady":"{name} отмечен готовым к проверке","toast.markReadyFailed":"Не удалось отметить готовым: {message}","toast.merged":"{name} слит","toast.mergeFailed":"Не удалось слить: {message}","toast.mergeStale":"У {name} появились новые коммиты; просмотрите их перед слиянием","toast.pathCopied":"Путь скопирован","toast.prompted":"Отправлено: {text}","toast.promptFailed":"Не удалось отправить сообщение","toast.refreshFailed":"Не удалось обновить","toast.removed":"{name} убран из этой сессии","toast.removeFailed":"Не удалось убрать","toast.restored":"Рабочее дерево восстановлено","toast.restoreFailed":"Не удалось восстановить рабочее дерево: {message}","toast.undo":"Отменить","toast.undoFailed":"Не удалось отменить","toast.worktreeFailed":"Не удалось изменить вариант с рабочим деревом","toast.worktreeStarted":"Эта сессия уже запущена, поэтому рабочее дерево ей больше не доступно","worktree.base":"От {branch}","worktree.baseHead":"От текущего HEAD","worktree.baseMenu":"Базовая ветка","worktree.blocked.not-git":"Эта рабочая область не является репозиторием Git, поэтому рабочее дерево недоступно","worktree.blocked.outside-writable-root":"Данные Git этой рабочей области лежат вне каталогов, доступных для записи (например, когда сама область — рабочее дерево), поэтому рабочее дерево пока недоступно","worktree.blocked.read-only":"Сессия только для чтения не может использовать рабочее дерево","worktree.currentBranch":"Текущая","worktree.currentBranchTip":"Текущая ветка: {branch}","worktree.detachedTip":"Не в ветке · {commit}","worktree.hint":"Запустить эту сессию в собственном рабочем дереве: при отправке из выбранной ветки создаётся новая, поэтому изменения и коммиты не затрагивают каталог проекта","worktree.label":"Рабочее дерево"},"goal":{"action.cancel":"Отменить редактирование","action.clear":"Очистить цель","action.edit":"Изменить цель","action.pause":"Приостановить цель","action.resume":"Продолжить цель","action.save":"Сохранить цель","commandInput.aria":"Ввод команды","objective.aria":"Текст цели","phase.active":"Активная цель","phase.active.disarmed":"Неактивная цель","phase.blocked":"Заблокированная цель","phase.paused":"Приостановленная цель"},"inspectorPanel":{"close":"Свернуть","frameTitle":"NodeJS Inspector","resize":"Изменить размер панели NodeJS Inspector","title":"NodeJS Inspector","toggle":"Переключить NodeJS Inspector"},"job":{"count.idle.one":"{count} фоновая задача","count.idle.other":"{count} фоновые задачи|{count} фоновых задач","count.live.one":"{count} фоновая задача выполняется","count.live.other":"{count} фоновые задачи выполняются|{count} фоновых задач выполняются","duration.hours":"{hours} ч {minutes} мин","duration.minutes":"{minutes} мин {seconds} сек","duration.seconds":"{seconds} сек","duration.title.done":"Заняло {duration}","duration.title.live":"Выполняется {duration}","kill.confirm":"Нажмите ещё раз для подтверждения","kill.confirmAction":"Подтвердить остановку","kill.failed":"Не удалось остановить","kill.stop":"Остановить задачу {label}","list.aria":"Фоновые задачи","output.error":"поток вывода в реальном времени прерван: {error}","output.gap":"… предыдущий вывод потерян …","row.collapseAria":"Скрыть вывод {label} в реальном времени","row.expandAria":"Показать вывод {label} в реальном времени","section.clear":"Очистить","section.live":"Выполняются","section.settledCount":"{count} завершена|{count} завершено|{count} завершено","status.completed":"завершена","status.failed":"сбой","status.killed":"отменена","status.running":"выполняется","status.stopping":"останавливается","terminal.collapse":"Свернуть","terminal.collapseAria":"Свернуть вывод","terminal.commandLine":"Строка команды {n}","terminal.copied":"Скопировано","terminal.copy":"Копировать","terminal.done":"готово","terminal.exitCode":"код выхода {code}","terminal.expand":"Показать ещё {n} строку|Показать ещё {n} строки|Показать ещё {n} строк","terminal.expandAria":"Развернуть оставшуюся {n} строку вывода|Развернуть оставшиеся {n} строки вывода|Развернуть оставшиеся {n} строк вывода","terminal.failed":"сбой","terminal.noExitCode":"нет кода выхода","terminal.noOutput":"Нет вывода","terminal.running":"выполняется","terminal.signal":"сигнал {signal}"},"liveshare":{"dialog.accessUnavailable":"Сведения о доступе для этого общего доступа недоступны. Существующие разрешения не изменены.","dialog.addressHint":"Сначала сохраните адрес сервиса общего доступа.","dialog.allowsFork":"Разрешить зрителям делать форк сессии","dialog.allowsForkHint":"Форки сессии сохраняют те же разрешения, что и исходная сессия.","dialog.cancel":"Отмена","dialog.capabilities":"Эндпоинты плагинов","dialog.capabilities.count":"Эндпоинтов, открытых зрителям: {count}","dialog.capabilities.createFailed":"Общий доступ создан, но эндпоинты плагинов не сохранены; повторите в разделе «Разрешения общего доступа».","dialog.capabilities.description":"Выберите для этого общего доступа один уровень; при сохранении он раскрывается в эндпоинты, которые плагины объявляют сейчас, поэтому добавленные позже останутся закрытыми.","dialog.capabilities.empty":"Ни один плагин сейчас не объявляет эндпоинты для общего доступа.","dialog.capabilities.none":"Зрителям не открыто","dialog.capabilities.noReadable":"Ни один плагин не предлагает эндпоинт только для чтения, поэтому «Только чтение» выбрать нельзя.","dialog.capabilities.noWritable":"Ни один плагин не предлагает эндпоинт для записи, поэтому «Запись» выбрать нельзя.","dialog.capabilities.stale":"Сохранённый выбор не образует целого уровня; при повторном сохранении он заменится выбранным уровнем.","dialog.capabilities.summary.read":"Только чтение · эндпоинтов: {count}","dialog.capabilities.summary.write":"Запись · только чтение: {readable} + запись: {writable}","dialog.capabilities.tier.none":"Недоступно","dialog.capabilities.tier.read":"Только чтение","dialog.capabilities.tier.write":"Запись","dialog.capabilities.writeHint":"Эндпоинт для записи действует, только если общая сессия разрешает запись, и внутри общего доступа с записью может быть разрушительным.","dialog.connectivityChecking":"Проверяем, отвечает ли адрес сервиса общего доступа…","dialog.copied":"Скопировано","dialog.copy":"Копировать ссылку","dialog.copyFailed":"Не удалось скопировать ссылку. Выделите её и скопируйте вручную.","dialog.create":"Создать общий доступ","dialog.creating":"Создание…","dialog.deploymentAccess":"Учётных записей с правом развёртывания: {count}. Это не единственное правило доступа.","dialog.description":"Создать ссылку Liveshare только для чтения на {title}","dialog.diagnostics":"Сведения о соединении","dialog.done":"Готово","dialog.expiry":"Истекает","dialog.expiry.clear":"Не истекает","dialog.expiry.day":"Через 24 часа","dialog.expiry.hour":"Через 1 час","dialog.expiry.never":"Никогда","dialog.expiry.until":"До {time}","dialog.expiry.week":"Через 7 дней","dialog.help":"Открывает доступ только к этой сессии; разрешение сессии определяет, что может делать зритель, а прекратить доступ можно в любой момент в «Управлении доступом».","dialog.hostUnavailable":"Не удалось связаться с сервисом общего доступа DSH Liveshare.","dialog.identity.expired":"Ваш вход истёк. Войдите снова, прежде чем создавать общий доступ.","dialog.identity.expires":"Действует до {time}","dialog.identity.loginBlocked":"Не удалось открыть окно входа (возможно, браузер его заблокировал). Разрешите всплывающие окна и повторите.","dialog.identity.loginCancelled":"Вход отменён; учётные данные не сохранены.","dialog.identity.loginDone":"Вход выполнен; читаем состояние учётной записи.","dialog.identity.loginExpired":"Этот вход истёк; начните заново.","dialog.identity.loginFailed":"Вход не завершён. Повторите.","dialog.identity.loginMismatch":"Ответ на вход относился к другому запросу и был проигнорирован.","dialog.identity.loginOpening":"Начинаем вход…","dialog.identity.loginReplayed":"Этот вход уже использован; начните заново.","dialog.identity.loginUnavailable":"Не удалось начать вход: Relay недоступен или этот адрес его не поддерживает.","dialog.identity.loginVerifying":"Подтверждаем результат входа…","dialog.identity.loginWaiting":"Завершите вход в открывшемся окне.","dialog.identity.relayChanged":"Текущий вход относится к другому адресу Relay. Войдите снова на этом адресе.","dialog.identity.relayUnsupported":"Relay на этом адресе пока не проверяет личности. Обновите его, прежде чем создавать общий доступ; анонимный доступ эта страница не создаст.","dialog.identity.renewed":"Продлено автоматически в пределах выданного разрешения.","dialog.identity.retry":"Повторить","dialog.identity.reverify":"Войти снова","dialog.identity.unknown":"Состояние входа сейчас недоступно. Повторите позже; до входа общий доступ не создаётся.","dialog.identity.unverified":"Вы не вошли, поэтому не можете создать общий доступ.","dialog.identity.verify":"Войти","dialog.identity.verifyBlocked":"Сохраните адрес и убедитесь, что он отвечает, прежде чем входить.","dialog.linkHelp":"Закрытие этой панели не прекращает общий доступ.","dialog.linkSharing":"Общий доступ по ссылке","dialog.manage":"Управление доступом","dialog.mode.open":"Любой в организации, у кого есть ссылка","dialog.mode.selected":"Отдельные коллеги","dialog.noOutgoing":"Общих доступов пока нет","dialog.open":"Открыть","dialog.outgoing":"Открыто мной","dialog.permissionChecking":"Проверяем, может ли этот хост публиковать по этому адресу…","dialog.permissionFailed":"Проверка разрешения не завершилась (хост не сообщил причину).","dialog.permissionOk":"Вход выполнен; этот хост может публиковать общий доступ.","dialog.permissionPending":"Перед созданием общего доступа этот адрес нужно проверить.","dialog.permissions":"Разрешения общего доступа","dialog.permissions.discard":"Есть несохранённые изменения; повторное нажатие «Готово» их отбросит.","dialog.permissions.failed":"Разрешения общего доступа не сохранены. Повторите.","dialog.permissions.modeUnsupported":"Этот Harness не сообщил разрешение сессии, поэтому изменить его здесь нельзя.","dialog.permissions.partial":"Разрешение сессии обновлено, но эндпоинты плагинов не сохранены. Повторите.","dialog.permissions.save":"Сохранить изменения","dialog.permissions.saved":"Разрешения общего доступа и эндпоинты плагинов сохранены.","dialog.permissions.saving":"Сохранение…","dialog.permissions.unsaved":"Есть несохранённые изменения.","dialog.relay":"Адрес сервиса общего доступа","dialog.relayCurrent":"Текущий адрес","dialog.relayInvalid":"Введите полный адрес, начинающийся с http:// или https://.","dialog.relayReverify":"Адрес изменился; войдите снова на новом адресе.","dialog.relaySaved":"Сохранено. Новые общие доступы используют этот адрес.","dialog.relaySource.saved":"Сохранённый адрес","dialog.relaySource.unset":"Не задан","dialog.relayUnsavedHint":"Этот адрес ещё не сохранён; сохраните его, чтобы он вступил в силу.","dialog.relayUnset":"Адрес не задан","dialog.relayUnverified":"Не проверен на этом адресе","dialog.relayVerified":"Проверен на этом адресе","dialog.selectedCount":"Подтверждённых людей: {count}.","dialog.selectedRetired":"Этот общий доступ сохраняет прежний охват «отдельные коллеги»; новые общие доступы предлагают только два режима выше.","dialog.sessionMode":"Разрешение сессии","dialog.sessionMode.hint.view":"Только чтение: зрители читают файлы и запись сессии в пределах общего доступа и могут отправлять сообщения в сессию, но все инструменты работают в песочнице только для чтения, и ни один файл нельзя записать.","dialog.sessionMode.hint.write":"Запись в рабочую область: зритель работает в ограниченной песочнице с записью — он изменяет файлы внутри охвата общего доступа в пределах разрешённого потолка; чтение и запись за его пределами отклоняются, а ваши глобальные настройки, учётные данные и другие сессии остаются закрыты.","dialog.sessionMode.notGranted":"Этот Harness не вернул разрешение сессии: сборке владельца нужно обновление, прежде чем общий доступ сможет его передавать.","dialog.sessionMode.view":"Только чтение","dialog.sessionMode.write":"Запись в рабочую область","dialog.share.offline":"Не в сети","dialog.share.online":"В сети","dialog.shareLink":"Ссылка общего доступа","dialog.stop":"Прекратить доступ","dialog.stopFailed":"Не удалось прекратить доступ. Повторите.","dialog.testFail":"Соединение с Relay не удалось (хост не сообщил причину).","dialog.testing":"Подключение к сервису общего доступа…","dialog.testOk":"Соединение с Relay работает","dialog.testWarn":"HTTP Relay доступен, но регистрация не завершилась, и хост не сообщил причину. Общий доступ всё равно можно создать; шлюз повторит попытку.","dialog.title":"Открыть доступ к сессии","header.action":"Поделиться","inputOrigin.sharedSession":"Из общей сессии [{subjectId}]","manage.allowsForkSwitch":"Могут ли зрители делать форк «{title}»","manage.audit.accessApproved":"Запрос одобрен","manage.audit.accessGrant":"Доступ на просмотр выдан","manage.audit.accessRequest":"Запрошен доступ на просмотр","manage.audit.accessRevoke":"Доступ на просмотр отозван","manage.audit.shareCreate":"Общий доступ создан","manage.audit.shareStop":"Общий доступ прекращён","manage.cancelShare":"Отменить общий доступ","manage.capabilities":"Эндпоинты плагинов","manage.description":"Смотреть состояние в сети и охват доступа всех общих доступов.","manage.done":"Готово","manage.empty":"Общих доступов пока нет.","manage.expiredAt":"Истёк {time}","manage.expiresAt":"Истекает {time}","manage.history":"История","manage.historyFailed":"Не удалось загрузить историю. Повторите.","manage.historyLoading":"Загрузка истории…","manage.identityExpired":"Этот вход истёк, из-за чего нельзя создавать новые общие доступы. На опубликованные ниже это не влияет: их ссылки по-прежнему копируются, и ими можно управлять.","manage.loading":"Загрузка общих доступов…","manage.open":"Управлять","manage.refresh":"Перезагрузить","manage.sessionMode":"Разрешение сессии","manage.sessionModeFailed":"Разрешение сессии не сохранено. Повторите.","manage.sessionModeSwitch":"Разрешение сессии для «{title}»","manage.sessionModeUnsupported":"Этот Harness не сообщил разрешение сессии, поэтому задать его здесь нельзя.","manage.stop.acknowledge":"Я понимаю, что опубликованная ссылка сразу перестанет работать","manage.stop.description":"Опубликованная ссылка сразу перестанет работать, и все, кто её смотрит, потеряют доступ.","manage.stop.title":"Прекратить общий доступ?","manage.title":"Управление общим доступом","manage.unavailable":"Не удалось загрузить общие доступы. Показано последнее известное состояние.","viewer.action.directory":"К списку доступов","viewer.action.reload":"Перезагрузить","viewer.action.retry":"Повторить","viewer.action.signIn":"Войти снова","viewer.brand":"LiveShare","viewer.empty":"В этой сессии пока нет содержимого для показа.","viewer.expired":"Этот общий доступ истёк и больше не даёт доступа. Попросите владельца открыть его заново.","viewer.expiresAt":"Доступ до {time}","viewer.home":"На главную LiveShare","viewer.loading":"Подключение к сессии…","viewer.model.locked":"Зрители не могут менять модель","viewer.model.title":"Модель, на которой работает эта сессия; её выбрал владелец, открывший доступ","viewer.noAnswer":"нет ответа","viewer.offline":"Общий доступ не в сети. Он переподключится автоматически.","viewer.permission.locked":"Зрители не могут изменить это сами","viewer.permission.title":"Разрешение сессии, которое несёт этот общий доступ; задаёт владелец","viewer.permission.unconfirmed":"Пока не подтверждено","viewer.picker.groupCount":"доступов: {count}","viewer.picker.historical":"Непроверенная история","viewer.picker.historicalNote":"Эти доступы появились до проверки личностей; их права не изменены.","viewer.picker.offline":"Не в сети","viewer.picker.online":"В сети","viewer.picker.ownerUnknown":"Владелец неизвестен","viewer.picker.subjectLabel":"subject …{label}","viewer.picker.version":"DSH","viewer.readonlyNote":"Только чтение: вы можете управлять этой сессией, но читаете файлы только в пределах общего доступа и ничего не изменяете.","viewer.reason.fork-ceiling-uninstalled":"Этот хост не установил ограничения выполнения только для чтения","viewer.reason.fork-enforcement-failed":"Ветка сессии создана, но её ограничения песочницы установить не удалось, поэтому использовать её нельзя","viewer.reason.fork-not-implemented":"Эта установка пока не поддерживает ветвление.","viewer.reason.fork-not-permitted":"Владелец не разрешает ветвить эту сессию","viewer.reason.fork-operation-conflict":"В этом запросе ветвления указан другой префикс, чем в предыдущем, поэтому новая сессия не создана","viewer.reason.fork-prepare-failed":"Хост не смог подготовить эту ветку, поэтому действие не выполнено","viewer.reason.fork-source-revoked":"Общий доступ, из которого получена эта ветка, больше не активен","viewer.reason.fork-unknown-child":"Эта сессия не является веткой общего доступа","viewer.reason.fork-viewer-mismatch":"Эта ветка принадлежит другому зрителю","viewer.reason.fork-viewer-unknown":"Relay не подтвердил вашу личность, поэтому ветку создать нельзя","viewer.reason.liveshare/read-only":"Эта сессия вне вашего общего доступа, поэтому запись не выполнена","viewer.reason.mode-view":"Владелец открыл этот доступ только для чтения","viewer.reason.prompt-identity-missing":"В этой отправке не было личности запроса, к которой её отнести, поэтому хост её не выполнил","viewer.reason.share-expired":"Общий доступ истёк","viewer.reason.share-not-found":"Такого общего доступа больше нет","viewer.reason.share-not-writable":"Владелец не разрешает запись в эту сессию","viewer.reason.share-stopped":"Общий доступ прекращён","viewer.reason.source-session-mismatch":"В ветке указана другая сессия, чем в общем доступе","viewer.reason.source-write-unavailable":"Этот хост не смог ограничить общую сессию, поэтому управлять ею нельзя","viewer.reason.unconfirmed":"Текущее состояние этого общего доступа подтвердить не удалось; до подтверждения он остаётся только для чтения","viewer.reason.viewer-not-authorized":"У вашей учётной записи больше нет доступа к этому общему доступу","viewer.reason.write-not-implemented":"Эта установка пока не поддерживает запись.","viewer.reauthenticate":"Ваш вход истёк. Пожалуйста, войдите снова.","viewer.reauthenticateAction":"Войти снова","viewer.reconnecting":"Соединение прервано, повторяем…","viewer.refused":"liveshare: {subject} отклонён со статусом {status}","viewer.relayAnswered":"liveshare: Relay ответил {status}","viewer.relaySilent":"liveshare: Relay ничего не ответил по {subject}","viewer.relayVersion":"relay {release}","viewer.retry":"Повторить сейчас","viewer.revoked":"Владелец прекратил доступ или отозвал ваши права.","viewer.role.assistant":"Ассистент","viewer.role.tool":"Инструмент","viewer.role.user":"Пользователь","viewer.row.branchRefused":"Не удалось выполнить ветвление: {reason}","viewer.row.fork":"Форк сессии","viewer.row.forkSource":"Форк «{title}»","viewer.sharedBy":"Открыл {owner} · {title}","viewer.sharedByShort":"Открыл {owner}","viewer.sharePath.unavailable":"Эта страница не может открывать файлы рабочей области: общий доступ передаёт пути к файлам, а не их содержимое.","viewer.status.connecting":"Подключение к общему доступу…","viewer.status.expired":"Этот общий доступ истёк.","viewer.status.expiredHint":"Попросите владельца открыть доступ к сессии заново.","viewer.status.invalid":"Эта ссылка недействительна или доступ был удалён.","viewer.status.invalidHint":"Проверьте, что ссылка полная, или попросите владельца новую.","viewer.status.offline":"Владелец сейчас не в сети; страница переподключится автоматически.","viewer.status.offlineHint":"Подождите немного или нажмите «Повторить»; если доступ останется не в сети, свяжитесь с владельцем.","viewer.status.reauthenticate":"Ваш вход истёк.","viewer.status.stopped":"Владелец прекратил этот общий доступ.","viewer.status.stoppedHint":"Попросите владельца включить его снова, если доступ всё ещё нужен.","viewer.status.unavailable":"Сервис общего доступа сейчас недоступен; повторяем.","viewer.status.unavailableHint":"Повторите чуть позже; если сервис не вернётся, зайдите позже.","viewer.title":"Сессия Liveshare только для чтения","viewer.transcriptLabel":"Содержимое сессии (только чтение)","viewer.unreachable":"liveshare: {subject} не дошёл до Relay, повторяем","viewer.writeUnavailableNote":"Владелец разрешил запись, но этой сессией сейчас управлять нельзя; отправка станет доступна, когда она будет подготовлена."},"messageQuotes":{"quote.add":"Цитировать текст"},"model":{"action.reload":"Перезагрузить","blocked.composer":"Эта модель недоступна — выберите другую, чтобы продолжить","command.description":"Выберите модель для этого диалога","command.label":"Модель","effort.providerDefault":"По умолчанию","empty.efforts":"Эта модель не поддерживает уровни глубины рассуждений.","empty.models":"Нет доступных моделей.","error.action":"Не удалось выполнить операцию с моделью: {message}","error.sessionInUse":"Эта сессия уже используется — возможно, другим запущенным экземпляром DSH (например, dsh web или настольным приложением). Закройте другие запущенные экземпляры DSH и повторите попытку.","menu.aria":"Модель и глубина рассуждений","menu.effort":"Глубина рассуждений","menu.model":"Модель","option.deepseekV4Flash.description":"Быстрая, эффективная и экономичная; подходит для целенаправленных, рутинных или параллельных задач.","option.deepseekV4Pro.description":"Сильнее в агентном программировании, знаниях и сложных рассуждениях; подходит для сложных задач и задач с приоритетом качества, но обходится дороже.","option.loadError":"Не удалось загрузить каталог: {message}","provider.account":"Учётная запись DeepSeek","search.clear":"Очистить поиск","search.empty":"Нет подходящих моделей.","search.placeholder":"Поиск моделей…","status.loading":"Обновление списка моделей…","trigger.aria":"Выберите модель, текущая — {model}","trigger.ariaEffort":"Выберите модель, текущая — {model}, глубина рассуждений — {effort}","trigger.fallback":"Выберите модель","trigger.loading":"Загрузка моделей…","trigger.selectAria":"Выберите модель","warning.groupLoad":"Не удалось загрузить {name}: {message}"},"open-in-app":{"app.androidstudio":"Android Studio","app.cursor":"Cursor","app.explorer":"Проводник","app.filemanager":"Файлы","app.finder":"Finder","app.fork":"Fork","app.ghostty":"Ghostty","app.gitbash":"Git Bash","app.github":"GitHub Desktop","app.gitkraken":"GitKraken","app.gnometerminal":"GNOME Terminal","app.goland":"GoLand","app.intellij":"IntelliJ IDEA","app.iterm":"iTerm2","app.kitty":"kitty","app.konsole":"Konsole","app.phpstorm":"PhpStorm","app.pycharm":"PyCharm","app.rider":"Rider","app.rustrover":"RustRover","app.smartgit":"SmartGit","app.sourcetree":"Sourcetree","app.sublimemerge":"Sublime Merge","app.sublimetext":"Sublime Text","app.terminal":"Терминал","app.tower":"Tower","app.vscode":"VS Code","app.vscodeinsiders":"VS Code Insiders","app.warp":"Warp","app.webstorm":"WebStorm","app.windowsterminal":"Windows Terminal","app.windsurf":"Windsurf","app.xcode":"Xcode","app.zed":"Zed","menu.aria":"Открыть с помощью","menu.copied":"Скопировано","menu.copyDirectoryPath":"Скопировать путь к папке","menu.copyFailed":"Не удалось скопировать. Проверьте доступность содержимого и повторите.","menu.copyLink":"Скопировать адрес ссылки","menu.copyPath":"Скопировать путь к файлу","menu.defaultApp":"Открыть в приложении по умолчанию","menu.external":"Открыть во внешнем браузере","menu.finder":"Показать в Finder","menu.openInFloat":"Открыть в плавающей панели","menu.openInSidebar":"Открыть в боковой панели","menu.reveal":"Показать в папке","menu.toggle":"Выберите приложение для открытия","open.error":"Не удалось открыть","open.title":"Открыть в {app}","open.tooltip":"Открыть локально","path.appDefault":"{app} (по умолчанию)","path.appsError":"Не удалось загрузить приложения","path.more":"Другие способы открыть","path.open":"Открыть","path.opened":"Открыто на другом устройстве","path.openError":"Не удалось открыть. Повторите попытку.","path.reveal":"Показать расположение файла","path.revealed":"Расположение файла показано на другом устройстве","path.revealError":"Не удалось показать расположение файла. Повторите попытку.","shortcut.busy":"Открывается рабочая область","shortcut.unavailable":"Текущая рабочая область или локальное приложение недоступны"},"permission.access":{"auto.badge":"EXP","auto.confirm.acknowledge":"Я понимаю эти риски и хочу продолжить","auto.confirm.description":"Автопроверка работает без песочницы. Перед каждым нативным вызовом инструмента и внутренним вызовом PTC та же модель, что и у текущего агента, решает, разрешить ли вызов; каждый вызов, который она не разрешила, вы подтверждаете или отклоняете. Функция экспериментальная: она может ошибочно разрешить или отклонить действие и расходует дополнительные токены.","auto.confirm.enable":"Включить автопроверку","auto.confirm.title":"Включить автопроверку (экспериментально)?","auto.description":"Работа без песочницы после экспериментальной проверки той же моделью каждого нативного вызова инструмента и внутреннего вызова PTC.","auto.label":"Автопроверка","close":"Закрыть","confirm.acknowledge":"Я понимаю риски и хочу продолжить","confirm.cancel":"Отмена","confirm.description":"Полный доступ сокращает число шагов подтверждения и позволяет агенту напрямую выполнять больше действий, включая чувствительные операции, изменение файлов и внешние команды. Используйте его, только если доверяете текущей задаче.","confirm.enable":"Включить полный доступ","confirm.title":"Включить полный доступ?","mode":"Текущий режим доступа: {name}","preset.fullAccess":"Полный доступ","preset.readOnly":"Только чтение","preset.workspaceWrite":"Запись в рабочей области"},"plan":{"chip.exitFailed":"Не удалось выйти из режима планирования","chip.label":"План","chip.off.aria":"Режим планирования выключен, нажмите, чтобы включить","chip.off.title":"Режим планирования выключен — нажмите, чтобы включить (/plan)","chip.on.aria":"Режим планирования включён, нажмите, чтобы выключить","chip.on.title":"Режим планирования включён — нажмите, чтобы выключить (/plan off)","preview.action":"Открыть","preview.document":"План · Markdown","preview.expired":"Срок временного предпросмотра плана истёк. Откройте его заново из карточки, ожидающей проверки.","preview.failed":"Не удалось загрузить план","preview.full":"Открыть план целиком","preview.historyUnavailable":"История сессии недоступна","preview.invalidAddress":"Неверный адрес плана","preview.loading":"Загрузка плана…","preview.notFound":"План не найден","preview.open":"Открыть план в боковой панели","preview.openNamed":"Открыть план: {title}","preview.title":"План","preview.unavailable":"Предпросмотр плана недоступен"},"pluginManager":{"addPlugin":"Добавить плагин","applyingChange":"Применение изменений к {name}","backToList":"К списку плагинов","backToPackage":"Назад к {name}","basicTitle":"Настройки встроенных плагинов","bundlesTitle":"Установленные плагины","cancel":"Отмена","chooseAddMethod":"Выберите способ добавления плагина","close":"Закрыть","configureRow":"Настроить {name}","confirmUninstall":"Удалить","confirmUninstallDescription":"После удаления всё, что он предоставляет, исчезнет.","confirmUninstallTitle":"Удалить «{name}»?","crumbRoot":"Плагины","detailFailed":"Не удалось прочитать подробности.","detailFootnotes":"Сноски","detailInvalid":"Плагин объявляет некорректный файл подробностей.","detailLoading":"Чтение подробностей","detailNetwork":"Не удалось связаться с источником подробностей.","detailTitle":"Подробности","detailTooLarge":"Подробности превышают предел размера и не были загружены.","empty":"Плагины пока не установлены.","enableToggle":"Включить {name}","error":"Не удалось прочитать все плагины — возможно, проблема с сетью","extensionsTitle":"Экспериментальные плагины","failedDisable":"Не удалось выключить: {reason}","failedEnable":"Не удалось включить: {reason}","failedRowDisable":"Не удалось выключить компонент: {reason}","failedRowEnable":"Не удалось включить компонент: {reason}","failedUninstall":"Не удалось удалить: {reason}","infoDescription":"Здесь настраиваются официальные плагины, а также устанавливаются и управляются остальные. Список встроенных плагинов и их состояние при работе — в разделе «Настройки → Встроенные».","infoLabel":"О плагинах","installApplying":"Применяем конфигурацию, подождите…","installApplyingCancellationError":"Отмена не подтверждена. Установка уже применяется, дождитесь её результата. {reason}","installApprovalCaution":"Разрешайте только доверенные пакеты.","installApprovalConsequence":"После разрешения скрипты выполняются здесь от вашего имени, а само разрешение сохраняется в этом профиле.","installApprovalDescription":"У этих пакетов есть скрипты установки, которые pnpm не выполнил.","installApprovalTitle":"Скриптам установки нужно разрешение","installApproveAndRetry":"Разрешить эти скрипты и повторить","installAttempt":"{previous} не смог выдать пакет; повторяем через {registry} (реестр {index} из {total})","installAttemptBadge":"Попытка {index} · {registry}","installAwaitingAcceptance":"Ожидаем, пока хост примет установку. После подтверждения отмена повторится автоматически.","installBackgroundApplying":"Установка применяется, отменить её нельзя. Откройте ход установки.","installBackgroundDone":"Установка завершена. Откройте подробности установки.","installBackgroundFailed":"Установка не удалась. Откройте подробности установки.","installBackgroundUnconfirmed":"Состояние установки не подтверждено. Откройте установку, чтобы увидеть подробности.","installBackgroundUnknown":"Результат установки недоступен. Проверьте список плагинов.","installBundledDescription":"Включите его, не скачивая вторую копию","installBundledTitle":"Этот плагин поставляется вместе с DSH","installCancel":"Отменить установку","installCancelAndEdit":"Отменить установку и вернуться к редактированию","installCancelled":"Установка отменена; плагин не включён, скачанные файлы могут остаться","installCancelledShort":"Отменено","installCancelling":"Останавливаем установку…","installCancelUnconfirmed":"Остановка установки не подтверждена. Повторите отмену или дождитесь результата установки. {reason}","installChangeRegistry":"Сменить реестр","installChecking":"Проверяем…","installClose":"Готово","installCloseCancels":"Отменить установку и закрыть","installConfirmedRefused":"Этот плагин нельзя установить","installConfirmedTitle":"Установка плагина","installDescription":"Введите имя пакета плагина, адрес репозитория GitHub или путь к локальному каталогу.","installDetailsHide":"Свернуть подробности установки","installDetailsNoOutput":"Вывод терминала этой установки не попал в подробности","installDetailsShow":"Показать подробности установки","installDoneApproved":"Скрипты установки разрешены для {names}","installDoneNothing":"Установка завершена, новых зависимостей нет.","installDoneOtherVersion":"По политике безопасности цепочки поставок pnpm (minimumReleaseAge) версии, опубликованные позже установленного срока, не устанавливаются автоматически, поэтому сейчас установлена {installed}, а не последняя версия {version}. У только что опубликованной версии этот срок ожидания ещё не истёк, и она может содержать незамеченный вредоносный код или дефекты. Если вам нужна {version}, удалите текущую версию и установите {exact}, чтобы запросить её.","installDoneRestart":"Плагин установлен; перезапустите DSH, чтобы его загрузить. {reason}","installEdit":"Изменить","installEditAria":"Вернуться к редактированию","installedTab":"Установленные","installedTitle":"Установленные","installEnableNow":"Включить сейчас","installExisting":"Установить сторонний плагин","installExistingDescription":"Поддерживаются пакеты npm, репозитории Git и локальные каталоги","installFailedEnabling":"Установка завершилась; не удалось включить плагин","installFailedTitle":"Не удалось установить плагин","installFailureBuildBlocked":"Скрипты установки зависимости требуют вашего разрешения, иначе установка не продолжится","installFailureBuildBlockedManual":"pnpm заблокировал скрипты установки; разрешите их в allowBuilds файла pnpm-workspace.yaml и повторите","installFailureDiskFull":"Диск заполнен, установка остановлена","installFailureGeneric":"Команда установки завершилась ошибкой; причина указана в подробностях","installFailureIntegrity":"Скачанный пакет не прошёл проверку целостности","installFailureNetwork":"Не удалось подключиться к сети","installFailureNetworkAll":"Ни один реестр недоступен (проверены: {registries}). Проверьте сеть или настройки прокси, либо смените реестр и повторите.","installFailureNetworkHost":"Не удалось подключиться к {host}. Адрес GitHub или прямая ссылка .tgz не загружаются через реестр: эта машина должна иметь к ним прямой доступ или доступ через прокси. Если плагин также опубликован в npm, укажите вместо этого имя пакета.","installFailureNoMatchingVersion":"Нет подходящей версии","installFailureNotFound":"Плагин не найден","installFailurePermission":"Нет разрешения на запись, плагин нельзя установить","installFailurePnpmMissing":"pnpm не найден, установка невозможна","installFailureTimeout":"Время установки истекло","installGithubFailedDescription":"Попробуйте другой источник установки.","installGithubFailedTitle":"Нет доступа к GitHub","installGithubTimeoutTitle":"Истекло время подключения к GitHub","installGitTemplateHint":"Замените это на реальный адрес репозитория Git.","installGuideExampleLabel":"Например: ","installGuideFill":"Взять пример","installGuideFillAria":"Взять пример {example}","installGuideHide":"Свернуть руководство","installGuideIdExample":"dsh-plugin-whale-pet","installGuideIdHint":"Имя пакета плагина — это имя пакета npm (например, dsh-xxx или @author/plugin): часть после dsh plugin add или pnpm add в команде установки из README плагина сообщества.","installGuideIdTitle":"Укажите имя пакета npm для плагина","installGuideSafety":"Устанавливайте только те плагины, которым доверяете: они работают от вашего имени и могут повредить DeepSeek Harness или привести к утечке ваших данных.","installGuideToggle":"Руководство и примеры установки","installingTitle":"Установка плагина…","installLocation":"Устанавливается в {dir}","installLogPath":"Полный журнал: {path}","installPackageLabel":"Имя пакета плагина","installPathTemplateHint":"Замените это на реальный путь к локальному каталогу плагина.","installProblemInstalled":"Этот плагин уже установлен. Чтобы обновить его, удалите и установите заново","installProblemInvalid":"Такое имя пакета или адрес установить нельзя: {reason}","installProblemNetwork":"Не удалось подключиться к реестру плагинов; проверьте сеть и повторите попытку","installProblemNetworkAll":"Ни один реестр недоступен (проверены: {registries}); проверьте сеть или настройки прокси, либо смените реестр","installProblemNotBundle":"Пакет не объявляет набор, поэтому его нельзя установить как плагин: {reason}","installProblemNotFound":"Плагин не найден","installProblemNotPackage":"Путь не существует или не является допустимым пакетом плагина","installProblemShipped":"Этот плагин входит в состав DSH; обновление DSH обновит и его","installProblemUnknown":"Не удалось получить сведения о плагине: {reason}","installReconcile":"Проверить состояние установки","installResultUnconfirmed":"Результат установки не получен. Проверьте состояние установки. {reason}","installRetry":"Повторить","installRun":"Установить","installSpecLabel":"Имя пакета или адрес","installSpecPlaceholder":"например, dsh-plugin-whale-pet","installStarting":"Подготовка к установке…","installSubjectGit":"Репозиторий Git","installSubjectPath":"Локальный каталог","installSubjectTarball":"Архив tar","installTitle":"Добавить плагин","installTryAnotherWay":"Попробовать другой способ","installUnconfirmedTitle":"Состояние установки не подтверждено","installUnknownDescription":"У хоста нет активной установки с этим идентификатором запроса. Перед новой попыткой проверьте список плагинов.","installUnknownTitle":"Результат установки недоступен","installUpgradeNotice":"Официальные плагины, установленные по запросу, предлагают обновление, когда их версия отличается от версии DSH. Чтобы обновить остальные плагины, удалите и установите их заново.","installUseGithubMirror":"Использовать зеркало материкового Китая","installVersion":"Версия {version}","installViewTask":"Открыть установку","intro":"Устанавливайте, включайте и настраивайте плагины","loading":"Чтение плагинов…","metadataError":"Ошибка метаданных пакета: {error}","moreAction":"Ещё","moreTitle":"Экспериментальные плагины","openDetail":"Открыть {name}","overriddenNotice":"{name} сохранён, но конфигурация с более высоким приоритетом переопределяет его, поэтому он не действует","panel":"Плагины","partOff":"Выключен","partsCountFailed":"{count} сбой|{count} сбоя|{count} сбоев","partsCountOff":"{count} выключен|{count} выключено|{count} выключено","partsCountRunning":"{count} запущен|{count} запущено|{count} запущено","partsCountTotal":"{count} всего","partsEmpty":"В этом наборе плагина нет компонентов.","partsFilter":"Фильтр компонентов","partsFilterEmpty":"Нет подходящих компонентов.","partsLabel":"Компоненты","partToggle":"Включить компонент {name}","previewAlt":"Предпросмотр возможностей {name}","previewUnavailable":"Не удалось показать предпросмотр возможностей","reasonAlreadyInstalled":"Этот пакет уже установлен; чтобы установить другую версию, сначала удалите его.","reasonAmbiguousInstall":"По изменению зависимостей нельзя определить, какой пакет был установлен.","reasonBundleInUse":"Другая конфигурация всё ещё использует компоненты этого набора; сначала выключите их.","reasonIncompatibleInstall":"Установите версию плагина, совместимую с этим DSH.","reasonIncompatibleInstalled":"Удалите его и установите версию, совместимую с этим DSH.","reasonIncompatibleVersion":"{plugin} несовместим с DSH {runtime} (требуется {requirements}); его запуск может привести к сбоям или потере данных.","reasonIncompatibleVersionUnnamed":"Этот плагин несовместим с запущенной версией DSH; его запуск может привести к сбоям или потере данных.","reasonInvalidSpec":"Укажите допустимое имя пакета или адрес.","reasonLabel":"Причина","reasonManagementRequired":"Он нужен для управления плагинами, поэтому его нельзя выключить или удалить.","reasonNotBundle":"Пакет не объявляет набор, поэтому им нельзя управлять как плагином.","reasonNotRemovable":"Этот пакет не принадлежит профилю или нужен для управления плагинами.","reasonOperationError":"Хост сообщил об ошибке.","reasonStaleApproval":"Список ожидающих подтверждения скриптов изменился; установите заново, чтобы его обновить.","reasonStopProfile":"Этот профиль работает без HMR; остановите его и удалите пакет командой dsh plugin.","reasonUnaddressable":"Патч профиля не может однозначно указать эту запись.","reasonUnknownPlugin":"Плагин не найден.","reasonUnsupportedPlatform":"Плагин не поддерживает операционную систему, в которой работает DSH.","refresh":"Обновить","refreshError":"Не удалось обновить. Повторите попытку.","registryCustom":"Свой адрес","registryCustomHint":"Укажите адрес внутреннего или частного реестра npm, начинающийся с http:// или https://. Если для него требуется вход, сохраните учётные данные в ~/.npmrc на этой машине.","registryCustomInvalid":"Укажите адрес, начинающийся с http:// или https://","registryCustomPlaceholder":"https://npm.example.com/","registryDefault":"Реестр по умолчанию","registryLegend":"Реестр npm, из которого скачивается плагин","registryListSeparator":", ","registryNpmmirror":"Зеркало материкового Китая","registryOfficial":"Официальный реестр npm","registryToggle":"Реестр","restartNotice":"Перезапустите DSH, чтобы применить изменение. {reason}","restartReasonHostModule":"Изменение затрагивает модули, загруженные самим DSH.","restartReasonModuleComparison":"DSH не смог сравнить загруженные плагины с их файлами.","restartReasonNoHmr":"Этот профиль применяет изменения только при запуске.","restartReasonPackageMoved":"Установленный пакет теперь разрешается в другой каталог, либо изменение заменяет пакет, входящий в состав DSH. Прежде чем устанавливать пакет из другого места, удалите его.","restartReasonUnmanagedPlugin":"Изменение затрагивает плагин, работающий вне списка плагинов.","retry":"Повторить","rowPhaseActive":"Запущен","rowPhaseFailed":"Проблема","rowPhaseLoading":"Загрузка","rowPhasePending":"Ожидание зависимостей","rowPhaseUnloading":"Выгрузка","rowStateIdle":"Не запущен","sentenceSeparator":" ","sourceBuiltIn":"Встроенный","sourceNotInstalled":"Не установлен","sourceSpec":"Источник кода","sourceTargetSpec":"Источник для этого DSH","sourceTargetVersion":"Версия для этого DSH","sourceTitle":"Источник","sourceVersion":"Текущая версия","statusBeta":"Экспериментальный","statusMissingFiles":"Пакет недоступен","statusNotInstalled":"Не установлен","statusProblem":"Проблема","statusUpdateAvailable":"Доступно обновление","tabsLabel":"Разделы плагинов","terminalCollapse":"Свернуть","terminalCollapseAria":"Свернуть вывод","terminalCommandLine":"Строка команды {n}","terminalCopied":"Скопировано","terminalCopy":"Копировать","terminalDone":"Готово","terminalExitCode":"код выхода {code}","terminalExpand":"… ещё {n} строка|… ещё {n} строки|… ещё {n} строк","terminalExpandAria":"Развернуть оставшуюся {n} строку вывода|Развернуть оставшиеся {n} строки вывода|Развернуть оставшиеся {n} строк вывода","terminalFailed":"Сбой","terminalNoExitCode":"нет кода выхода","terminalNoOutput":"Нет вывода","terminalRunning":"Выполняется","terminalSignal":"сигнал {signal}","title":"Плагины","unavailable":"В этой установке нет профиля, доступного для управления, поэтому здесь нельзя устанавливать, включать и выключать плагины.","uninstall":"Удалить","uninstallLabel":"Удалить {name}","update":"Обновить","updateBroken":"Обновление не удалось; плагин не установлен","updateBrokenDetail":"Не удалось установить {to}, а повторная установка {from} тоже не удалась. Установите {name} заново через «Добавить плагин».","updateDescription":"Обновление заменит {from} на {to}; плагин может ненадолго остановиться. Если установка не удастся, {from} сохранится или будет установлена заново.","updateDone":"Обновлено до {version}","updateDoneDetail":"Новая версия работает.","updateFinish":"Готово","updateKept":"Не удалось обновить до {version}","updateKeptDetail":"{from} не была удалена и продолжает использоваться. {reason}","updateLabel":"Обновить {name}","updateLost":"Результат обновления неизвестен","updateLostDetail":"Соединение с DSH прервалось: {reason}. Обновите список плагинов, чтобы увидеть установленную версию.","updateOutput":"Показать вывод установки","updateRefused":"Нельзя обновить до {version}","updateRemoveFailed":"Не удалось удалить {version}","updateRestart":"{version} установлена; применится после перезапуска","updateRestored":"Обновление не удалось; восстановлена {version}","updateRestoredDetail":"Не удалось установить {to}; {from} установлена заново.","updateRunning":"Обновление","updatesAvailable":"Доступны обновления: {count}","updatesFailed":"Некоторые плагины проверить не удалось","updatesNone":"Все плагины обновлены","updateSource":"Откуда установить","updateStepChecking":"Проверить {version}","updateStepInstalling":"Установить {version} из {registry}","updateStepRemoving":"Остановить и удалить {version}","updateStepRestoring":"Установить {version} заново","updateTitle":"Обновить {name}","versionsAvailable":"Доступно обновление до {version}","versionsBlocked":"Новые версии требуют обновления DSH","versionsBlockedDetail":"Для {version} нужен {peers}; здесь DSH {runtime}","versionsCheckedAt":"Последняя проверка: {time}","versionsCheckedAtLabel":"Проверено","versionsChecking":"Проверка обновлений","versionsCollapse":"Свернуть","versionsDeprecatedTag":"Устаревшая","versionsDetails":"Подробности","versionsFailedNetwork":"Не удалось связаться с реестром","versionsFailedOther":"Не удалось проверить обновления","versionsFallbackHint":"{registry} недоступен; список получен из резервного реестра","versionsFallbackTag":"Резервный","versionsInstalledTag":"Установлена","versionsLatest":"Актуально","versionsNeedsDsh":"Нужен {peers}","versionsNewerCount":"Новее: {count}","versionsNoneInstallable":"Нет более новой версии для прямой установки","versionsNoneInstallableDetail":"Более новые версии устарели, являются предварительными или не объявляют набор. Разверните, чтобы увидеть их","versionsNotBundle":"Эта версия не объявляет набор и не может быть установлена","versionsOmitted":"Ещё {count} версия новее установленной не показана|Ещё {count} версии новее установленной не показаны|Ещё {count} версий новее установленной не показаны","versionsPrereleaseTag":"Предварительная","versionsPrimaryTag":"Первая","versionsProblemNetwork":"Недоступен","versionsProblemNotFound":"Не найдена","versionsProblemUnknown":"Ошибка","versionsPublished":"Опубликована {date}","versionsRecheck":"Проверить снова","versionsRegistry":"Реестр","versionsShowPrerelease":"Показывать предварительные версии","versionsTitle":"Версии","versionsUpdateLabel":"Обновить до {version}","versionTag":"v{version}"},"pluginMarket":{"addFirstSource":"Добавить источник индекса","addSource":"Добавить","allCategories":"Все","backToList":"Обзор","cancel":"Отмена","categoriesLabel":"Категории","close":"Закрыть","confirmTitle":"Установить «{name}»?","detailDenied":"Нет доступа к репозиторию с подробностями. Проверьте учётные данные Git.","detailFailed":"Не удалось прочитать подробности.","detailGitUnavailable":"Подробности лежат в репозитории, который читается через Git, но Git не запустился. Установите Git и повторите.","detailInvalid":"Плагин объявляет некорректный файл подробностей.","detailLoading":"Чтение подробностей","detailNetwork":"Не удалось связаться с источником подробностей.","detailTitle":"Подробности","detailTooLarge":"Подробности или их репозиторий превышают предел размера и не были загружены.","emptyDescription":"Добавьте индекс плагинов, чтобы просматривать и устанавливать его плагины здесь.","emptyIndex":"В этом индексе нет плагинов.","emptyTitle":"Индексов плагинов пока нет","entryMeta":"{version} · {date}","entryMetaAuthor":"{version} · {author} · {date}","exempted":"Эта версия несовместима с запущенным DSH, но вы задали для неё исключение по совместимости.","factAuthor":"Автор","factCategory":"Категория","factCommit":"Коммит","factDirectory":"Каталог","factHomepage":"Домашняя страница","factLabels":"Метки","factMarket":"Индекс плагинов","factPackage":"Пакет","factPublished":"Опубликовано","factRegistry":"Реестр","factRepository":"Репозиторий","factSource":"Источник","factSourceCode":"Исходный код","filter":"Метки","filterCount":"Метка · {count}|Метки · {count}|Меток · {count}","footnotes":"Сноски","incompatible":"Эта версия несовместима с запущенным DSH {runtime}; требуется DSH {range}.","install":"Установить","installTitle":"Установить {name}","installTrust":"Плагины работают на этой машине с вашими разрешениями. Убедитесь, что доверяете источнику этого плагина.","installVersionTitle":"Установить {name} {version}","loading":"Чтение индекса","manageSources":"Управление источниками индексов…","marketMenu":"Переключить индекс плагинов, текущий: {market}","noCompatibleVersion":"Нет версии, совместимой с DSH {runtime}","noMatches":"Нет подходящих плагинов.","openEntry":"Открыть {name}","openInstalled":"Открыть {name} в разделе «Установленные»","readChanged":"Индекс изменился во время загрузки.","readFailed":"Не удалось прочитать этот индекс.","readInvalid":"Этот индекс имеет недопустимый формат.","refresh":"Обновить","removeSource":"Удалить","removeSourceNamed":"Удалить {url}","retry":"Повторить","search":"Поиск плагинов","showMore":"Показать ещё","sortBy":"Сортировка: {sort}","sortDefault":"Порядок по умолчанию","sortPublished":"Дата публикации","sortRelevance":"Лучшее совпадение","sourceDuplicate":"Этот источник индекса уже добавлен.","sourceFailed":"Не удалось сохранить источники индексов.","sourceInvalid":"Используйте адрес http или https без имени пользователя, пароля и фрагмента #.","sourcePlaceholder":"https://example.com/index.json","sourcesDescription":"Индекс плагинов публикуется как URL одного файла. «Обзор» показывает индексы, перечисленные здесь.","sourcesFailed":"Не удалось прочитать источники индексов.","sourcesLabel":"Добавленные источники индексов","sourcesTitle":"Источники индексов","sourcesTrust":"Индексы поступают от третьих сторон. Добавляйте только те источники, которым доверяете: после установки их плагины работают с вашими разрешениями.","sourceUnavailable":"Здесь нельзя сохранить источники индексов.","sourceUrl":"URL индекса","statusInstalled":"Установлен","statusProvided":"Поставляется с DSH","statusUpdate":"Доступно обновление","switchToAscending":"По возрастанию","switchToDescending":"По убыванию","title":"Обзор","versionDefault":"Рекомендуемая","versionExempted":"Исключение","versionIncompatible":"Несовместима","versionInstalled":"Установлена","versionPrerelease":"Предварительная","versionsLabel":"Версии {name}","versionsTitle":"Версии"},"pluginRecommendations":{"access-denied":"У вас нет прав на изменение этого профиля.","already-enabled":"Уже выбрано на странице «Плагины». Откройте подробности, чтобы проверить состояние.","closing":"Сервис перезагружается. Повторите чуть позже.","detailsFor":"Подробнее: {title}","dismiss":"Не сейчас","dismissed":"Скрыто","enable":"Включить","enabled":"Включено","failed":"Не удалось включить. Повторите или проверьте «Плагины».","heading":"Рекомендуемый плагин","lookup-failed":"Не удалось загрузить подробности плагина. Повторите.","management-error":"Не удалось включить плагин. Откройте подробности, проверьте ошибку и повторите.","not-live-root":"Используйте рекомендацию в исходном диалоге.","official":"Официальный","replaced":"Заменено","restart-required":"Сохранено. Перезапустите DSH, чтобы применить.","retry":"Повторить включение","retryLookup":"Повторить","scope":"Доступен во всех диалогах, когда включён","transport":"Не удалось подтвердить результат. Обновите страницу и повторите.","unavailable":"Сейчас этот плагин включить нельзя. Проверьте «Плагины».","unconfirmed":"Не удалось подтвердить, включён ли плагин. Повторите проверку.","unknown":"Рекомендация недоступна. Откройте диалог заново.","version-error":"Плагин несовместим с этой версией DSH. Обновите DSH и повторите.","working":"Выполняется…"},"question":{"action.next":"Далее","action.skip":"Пропустить","custom.placeholder":"Введите ответ","error.incomplete":"Сначала ответьте на этот вопрос.","error.resubmit":"Ответ не дошёл, работа продолжилась; отправьте его ещё раз.","error.unanswered":"Выберите вариант или введите свой ответ.","error.unavailable":"Сейчас отправить нельзя; попробуйте чуть позже.","nav.cancel":"Отменить все вопросы","nav.close":"Закрыть панель — открыть заново можно из вызова инструмента","nav.maximize":"Развернуть карточку вопроса","nav.minimize":"Свернуть карточку вопроса","nav.next":"Следующий вопрос","nav.prev":"Предыдущий вопрос","option.recommended":"Рекомендуем","plan.approve":"Подтвердить","plan.decline":"Отклонить","plan.discuss":"Запросить изменения","plan.header":"Проверка плана","reply.answerLabel":"Ответ: ","reply.close":"Свернуть подробности вопроса","reply.label":"Вопросы и ответы","reply.open":"Развернуть подробности вопроса","reply.skipped":"Пропущено","review.skipped":"Этот вопрос был пропущен.","review.status":"Отвечено","status.sent":"Ответ отправлен; панель не удалось закрыть.","text.collapse":"Свернуть","text.expand":"Развернуть","wait.continued":"Работа продолжилась — ответить всё ещё можно","wait.countdown":"Продолжение через {seconds} с","wait.held":"Ждём вашего ответа","wait.paused":"Пауза · осталось {seconds} с","wait.takeTime":"Не спешить"},"reference":{"candidate.noCwd":"(нет рабочего каталога)","crumb.root":"Рабочая область","fileOpen.close":"Закрыть","fileOpen.failed":"Не удалось открыть «{path}». Повторите попытку или закройте это сообщение.","fileOpen.retry":"Повторить","fileOpen.title":"Не удалось открыть файл","section.files":"Файлы и папки","section.sessions":"Сессии","section.subagents":"Субагенты","time.days":"{n} день|{n} дня|{n} дней","time.hours":"{n} час|{n} часа|{n} часов","time.minutes":"{n} минута|{n} минуты|{n} минут","time.months":"{n} месяц|{n} месяца|{n} месяцев","time.now":"сейчас","time.years":"{n} год|{n} года|{n} лет"},"schedule.catalog":{"cron.day.both":"{days} числа каждого месяца или {weekdays}{months}","cron.day.bothStarred":"{days} числа каждого месяца и {weekdays}{months}","cron.day.every":"Каждый день{months}","cron.day.monthDays":"{days} числа каждого месяца{months}","cron.day.weekdays":"{weekdays}{months}","cron.hours.list":"{hours}","cron.hours.range":"{from}–{to}","cron.list.join":", ","cron.months":" ({months})","cron.part.join":" ","cron.time.at":"в {times}","cron.time.everyHour":"Каждый час","cron.time.everyMinute":"Каждую минуту","cron.time.everyMinutes":"Каждые {step} мин","cron.time.everyNHours":"Каждые {count} час|Каждые {count} часа|Каждые {count} часов","cron.time.hourlyAt":"Каждый час в минуту {minutes}","cron.time.hoursAt":"в минуту {minutes} часов {hours}","cron.time.hoursEveryMinute":"каждую минуту в часы {hours}","cron.time.hoursEveryMinutes":"каждые {step} мин в часы {hours}","cron.time.joinedEveryHour":"каждый час","cron.time.joinedEveryMinute":"каждую минуту","cron.time.joinedEveryMinutes":"каждые {step} мин","cron.time.joinedEveryNHours":"каждые {count} час|каждые {count} часа|каждые {count} часов","cron.time.joinedHourlyAt":"каждый час в минуту {minutes}","cron.weekday.name":"{weekday}","cron.weekday.range":"{from}–{to}","delete.action":"Удалить","delete.label":"Удалить задачу автоматизации: {title}","delete.pending":"Удаление…","frequency.cron":"Своё расписание ({timeZone})","frequency.cronLocal":"Своё расписание","frequency.cronRule":"{rule} ({timeZone})","frequency.daily":"Каждый день в {time} ({timeZone})","frequency.dailyLocal":"Каждый день в {time}","frequency.every":"Раз в {value} {unit}","frequency.hostCustom":"Свой","frequency.hostDailyInterval":"Каждые {interval} дн. в {time}","frequency.hostMonthly":"Ежемесячно в день {days} в {time} или в конце месяца","frequency.hostMonthlyInterval":"Каждые {interval} мес. в день {days} в {time} или в конце месяца","frequency.hostWeeklyInterval":"Каждые {interval} нед. по {weekdays} в {time}","frequency.hostZone":"{rule} ({timeZone})","frequency.once":"Один раз","frequency.weekday.1":"Пн","frequency.weekday.2":"Вт","frequency.weekday.3":"Ср","frequency.weekday.4":"Чт","frequency.weekday.5":"Пт","frequency.weekday.6":"Сб","frequency.weekday.7":"Вс","frequency.weekday.join":", ","frequency.weekly":"Еженедельно: {weekdays} в {time} ({timeZone})","frequency.weeklyLocal":"Еженедельно: {weekdays} в {time}","hover.more":"ещё {count} задача|ещё {count} задачи|ещё {count} задач","list.aria":"Включённые задачи автоматизации","list.error":"Не удалось загрузить задачи автоматизации.","list.loading":"Загрузка задач автоматизации…","list.nextRun":"Следующий запуск","list.open":"Открыть подробности задачи автоматизации: {title}","list.retry":"Повторить","mark.aria":"{count} задача автоматизации|{count} задачи автоматизации|{count} задач автоматизации","relative.future":"через {value} {unit}","relative.now":"Срок наступил","relative.overdue":"просрочено на {value} {unit}","status.overdue":"Просрочено","status.scheduled":"Запланировано","time.locale":"ru","time.utcPrefix":"UTC","trigger.label":"Задачи автоматизации","trigger.one":"{count} задача автоматизации","trigger.other":"{count} задачи автоматизации|{count} задач автоматизации","unit.day.one":"день","unit.day.other":"дня|дней","unit.hour.one":"час","unit.hour.other":"часа|часов","unit.minute.one":"минуту","unit.minute.other":"минуты|минут","unit.second.one":"секунду","unit.second.other":"секунды|секунд"},"schedule.manager":{"card.deleted":"Удалено","card.open":"Открыть","card.openLabel":"Открыть подробности задачи: {title}","clear.action":"Очистить все неактивные задачи","clear.close":"Закрыть подтверждение очистки","clear.confirm":"Очистить задачи","clear.description":"Эти задачи и их сохранённые записи доставки будут удалены навсегда. Включённые задачи, исходные сессии и сообщения в очереди не затрагиваются.","clear.pending":"Очистка…","clear.title":"Очистить неактивные задачи ({count})?","cron.day.both":"{days} числа каждого месяца или {weekdays}{months}","cron.day.bothStarred":"{days} числа каждого месяца и {weekdays}{months}","cron.day.every":"Каждый день{months}","cron.day.monthDays":"{days} числа каждого месяца{months}","cron.day.weekdays":"{weekdays}{months}","cron.hours.list":"{hours}","cron.hours.range":"{from}–{to}","cron.list.join":", ","cron.months":" ({months})","cron.part.join":" ","cron.time.at":"в {times}","cron.time.everyHour":"Каждый час","cron.time.everyMinute":"Каждую минуту","cron.time.everyMinutes":"Каждые {step} мин","cron.time.everyNHours":"Каждые {count} час|Каждые {count} часа|Каждые {count} часов","cron.time.hourlyAt":"Каждый час в минуту {minutes}","cron.time.hoursAt":"в минуту {minutes} часов {hours}","cron.time.hoursEveryMinute":"каждую минуту в часы {hours}","cron.time.hoursEveryMinutes":"каждые {step} мин в часы {hours}","cron.time.joinedEveryHour":"каждый час","cron.time.joinedEveryMinute":"каждую минуту","cron.time.joinedEveryMinutes":"каждые {step} мин","cron.time.joinedEveryNHours":"каждые {count} час|каждые {count} часа|каждые {count} часов","cron.time.joinedHourlyAt":"каждый час в минуту {minutes}","cron.weekday.name":"{weekday}","cron.weekday.range":"{from}–{to}","cronForm.atMinute":"В какую минуту","cronForm.daily":"Ежедневно","cronForm.dateOption":"День {day}","cronForm.dates":"По датам","cronForm.frequency":"Частота","cronForm.minuteDecrease":"Уменьшить минуту","cronForm.minuteIncrease":"Увеличить минуту","cronForm.monthly":"Ежемесячно","cronForm.weekly":"Еженедельно","delete.action":"Удалить задачу","delete.cancel":"Отмена","delete.close":"Закрыть подтверждение удаления","delete.confirm":"Подтвердить удаление","delete.description":"Задача перестанет срабатывать и будет удалена вместе с сохранёнными записями доставки. Исходная сессия и её сообщения останутся; сообщения в очереди не отзываются.","delete.pending":"Удаление…","delete.title":"Удалить эту задачу?","delivery.collapse":"Свернуть","delivery.cursorError":"Записи обновлены.","delivery.empty":"Записей доставки нет","delivery.error":"Не удалось загрузить записи доставки.","delivery.expand":"Развернуть","delivery.label":"Сохранённая запись доставки","delivery.loading":"Загрузка записей доставки…","delivery.loadMore":"Загрузить ещё","delivery.notFound":"Эта задача больше недоступна.","delivery.pruned":"Более ранние записи доставки очищены","delivery.refresh":"Обновить","delivery.retention":"Правила хранения","delivery.retentionBounds":"Каждая задача хранит до {records} записи доставки за последние {days} день.|Каждая задача хранит до {records} записей доставки за последние {days} дня.|Каждая задача хранит до {records} записей доставки за последние {days} дней.","delivery.retentionExplanation":"При сохранении новой записи старые записи за пределами этих ограничений очищаются автоматически. Очистка записей не останавливает задачу.","delivery.retry":"Повторить","detail.close":"Закрыть подробности","detail.frequency":"Частота","detail.id":"ID задачи","detail.instruction":"Инструкция автоматической задачи","detail.instructionPlaceholder":"Опишите задачу и результат. Например: «Соберите мой список чтения со ссылками на источники».","detail.label":"Подробности задачи","detail.missing":"Задача недоступна. Возможно, она удалена.","detail.more":"Действия с автоматической задачей","detail.name":"Название автоматической задачи","detail.namePlaceholder":"Напр.: ежедневная сводка чтения","detail.next":"Время следующего запуска","detail.nextRun":"Следующий запуск","detail.openSession":"Связанная сессия: открыть связанную сессию","detail.openSessionTitle":"Связанная сессия {title}: открыть связанную сессию","detail.records":"Записи","detail.rule":"Правила","detail.session":"Связанная сессия","detail.sessionArchived":"Связанная сессия в архиве.","detail.sessionLoading":"Загрузка сведений о связанной сессии.","detail.sessionUnavailable":"Связанная сессия недоступна.","detail.status":"Состояние","detail.tabs":"Разделы подробностей задачи","empty.action":"Новая автоматическая задача","frequency.cron":"Своё расписание ({timeZone})","frequency.cronLocal":"Своё расписание","frequency.cronRule":"{rule} ({timeZone})","frequency.daily":"Каждый день в {time} ({timeZone})","frequency.dailyLocal":"Каждый день в {time}","frequency.every":"Раз в {value} {unit}","frequency.hostCustom":"Своё","frequency.hostDailyInterval":"Каждые {interval} дн. в {time}","frequency.hostMonthly":"Ежемесячно {days} числа в {time} или в конце месяца","frequency.hostMonthlyInterval":"Каждые {interval} мес. {days} числа в {time} или в конце месяца","frequency.hostWeeklyInterval":"Каждые {interval} нед. по {weekdays} в {time}","frequency.hostZone":"{rule} ({timeZone})","frequency.once":"Один раз","frequency.weekday.1":"Пн","frequency.weekday.2":"Вт","frequency.weekday.3":"Ср","frequency.weekday.4":"Чт","frequency.weekday.5":"Пт","frequency.weekday.6":"Сб","frequency.weekday.7":"Вс","frequency.weekday.join":", ","frequency.weekly":"Еженедельно: {weekdays} в {time} ({timeZone})","frequency.weeklyLocal":"Еженедельно: {weekdays} в {time}","host.chatCreate":"Создать в сессии","host.closeCreate":"Закрыть форму создания","host.conflict":"Задача изменена в другом месте. Сверьте последние значения со своими правками или отмените изменения.","host.create":"Создать","host.createError":"Не удалось создать задачу. Введённые данные сохранены; повторите попытку.","host.createMethod":"Выберите способ создания","host.createPrompt":"Создай задачу автоматизации по требованиям.","host.creating":"Создание…","host.currentConversation":"Текущая связанная сессия","host.customRule":"Настроить","host.defaultProject":"Рабочая область по умолчанию","host.executionActive":"Задача в очереди или выполняется. Управляйте ею в сессии.","host.executionPending":"Эта задача в очереди, выполняется или только что доставлена. Повторите позже.","host.frequency.advanced":"Свой","host.frequency.monthly":"Каждый месяц","host.interval":"Интервал","host.invalidRule":"Проверьте правило и часовой пояс","host.latestConversation":"Последняя сессия запуска","host.limitsError":"Не удалось загрузить минимальный интервал запуска. Повторите перед сохранением.","host.limitsLoading":"Загрузка минимального интервала запуска","host.manualCreate":"Создать вручную","host.monthDay":"День месяца","host.newSessionInterval":"Минимальный интервал запуска: {interval}","host.notFuture":"Выберите будущее расписание; измените время задачи перед продолжением","host.openDeliverySession":"Открыть сессию","host.pause":"Приостановить","host.project":"Связанная рабочая область","host.reapply":"Проверить с моими правками","host.resume":"Продолжить","host.run":"Запустить сейчас","host.runAfterInterval":"Минимальный интервал запуска ещё не прошёл. Запустить сейчас можно в {time}.","host.runError":"Не удалось поставить задачу в очередь. Повторите.","host.saveError":"Не удалось сохранить. Ваши изменения сохранены; повторите попытку.","host.sessionAfterFirstRun":"Ожидает создания","host.target":"Где запускать","host.targetNew":"Новая сессия для каждого запуска","host.targetNewHelp":"Создавать отдельную сессию для каждого запуска","host.targetNewOnce":"Создать сессию и переиспользовать её","host.targetNewOnceHelp":"Создать при первом запуске и дальше использовать её","host.ungrouped":"Без группы","list.empty":"Задач пока нет. Задачи, созданные в ваших сессиях, появятся здесь.","list.emptyActive":"Нет активных задач автоматизации","list.emptyInactive":"Нет завершённых задач автоматизации","list.emptyPaused":"Нет приостановленных задач автоматизации","list.error":"Не удалось загрузить задачи.","list.label":"Каталог задач","list.loading":"Загрузка задач…","list.more":"Ещё действия с задачами","list.nextPrefix":"Время следующего запуска: ","list.noMatches":"Нет подходящих задач","list.retry":"Повторить","new.action":"Создать","panel":"Задачи автоматизации","relative.future":"через {value} {unit}","relative.now":"Срок наступил","relative.overdue":"просрочено на {value} {unit}","rule.cancel":"Сбросить","rule.cron":"Свой","rule.cronInvalid":"Введите cron-выражение из пяти полей, например 0 9 * * 1-5.","rule.cronLabel":"Cron-выражение","rule.daily":"Ежедневно","rule.error.conflict":"Задача изменилась до сохранения обновления. В строке показано сохранённое правило; повторите попытку.","rule.error.notFound":"Эта задача больше недоступна.","rule.error.unknown":"Не удалось подтвердить обновление правила. В строке показано сохранённое правило.","rule.everyHours":"Каждые N часов","rule.everyMinutes":"Каждые N минут","rule.everySeconds":"Каждые N секунд","rule.invalid":"Измените своё правило, выберите другой вариант повтора или попросите агента исправить его.","rule.invalidInterval":"Введите целое число не меньше 1 для интервала.","rule.invalidMonthDay":"Введите день месяца от 1 до 31.","rule.invalidPrompt":"Введите инструкцию задачи.","rule.invalidTime":"Выберите корректные дату и время в выбранном часовом поясе.","rule.invalidTitle":"Название задачи: от 1 до 120 символов.","rule.invalidZone":"Выберите корректный часовой пояс.","rule.once":"Один раз","rule.repeat":"Повтор","rule.requiredWeekday":"Выберите хотя бы один день недели.","rule.save":"Сохранить изменения","rule.saving":"Сохранение…","rule.title":"Время запуска","rule.tooComplex":"Это правило слишком частое или сложное. Выберите вариант повтора или попросите агента упростить его.","rule.unsaved":"Несохранённые изменения","rule.weekday":"День недели","rule.weekdayOption":"День недели {weekday}","rule.weekdays":"По будням","rule.weekly":"Еженедельно","rule.zone.system":" (системная)","search.clear":"Очистить поиск","search.label":"Поиск задач","search.placeholder":"Поиск автоматических задач","status.active":"Включена","status.ended":"Завершено","status.inactive":"Неактивна","status.paused":"Пауза","statusFilter.all":"Все","statusFilter.label":"Состояние задачи","time.locale":"ru","time.utcPrefix":"UTC","timing.conflict":"Задача изменилась во время редактирования. Черновик сохранён. Чтобы изменить актуальное правило, после обновления отмените и откройте редактор заново.","timing.date":"Дата","timing.error":"Не удалось подтвердить изменение времени. Черновик сохранён. Проверьте задачу перед повтором.","timing.hour":"Час","timing.inactive":"Неактивные задачи — только чтение. Их время нельзя изменить.","timing.interval":"Повторять каждые","timing.intervalDecrease":"Уменьшить интервал","timing.intervalHint.hour":"Не менее 1 часа. Интервал отсчитывается от создания задачи или последнего изменения правила и не зависит от часовых поясов.","timing.intervalHint.minute":"Не менее 1 минуты. Интервал отсчитывается от создания задачи или последнего изменения правила и не зависит от часовых поясов.","timing.intervalHint.second":"Не менее 60 секунд. Интервал отсчитывается от создания задачи или последнего изменения правила и не зависит от часовых поясов.","timing.intervalIncrease":"Увеличить интервал","timing.invalid":"Введите допустимые дату и время или проверьте поля времени.","timing.invalidInterval":"Введите интервал не менее 1 минуты.","timing.invalidInterval.hour":"Введите интервал не менее 1 часа.","timing.invalidInterval.minute":"Введите интервал не менее 1 минуты.","timing.invalidInterval.second":"Введите интервал не менее 60 секунд.","timing.invalidZone":"Введите допустимый часовой пояс IANA, например Asia/Shanghai.","timing.minute":"Минута","timing.nextMonth":"Следующий месяц","timing.notFound":"Эта задача больше недоступна. Черновик сохранён; отмените, чтобы закрыть редактор.","timing.notFuture":"Выберите дату и время в будущем.","timing.prevMonth":"Предыдущий месяц","timing.second":"Секунда","timing.subagentSession":"Эта сессия принадлежит субагенту, который никогда не получает доставленные напоминания.","timing.time":"Время","timing.unit.hour":"ч","timing.unit.minute":"мин","timing.unit.second":"сек","timing.zone":"Часовой пояс","timing.zoneNoResults":"Нет подходящих часовых поясов","timing.zoneNoStored":"Разовая задача хранит только момент срабатывания, а не часовой пояс. Дата и время интерпретируются в выбранном часовом поясе.","timing.zoneSearch":"Поиск по смещению UTC, IANA ID или городу","title":"Задачи автоматизации","toast.cleared.one":"Очищена {count} неактивная задача.","toast.cleared.other":"Очищено {count} неактивные задачи.|Очищено {count} неактивных задач.","toast.clearedNone":"Неактивных задач для очистки нет.","toast.clearFailed":"Не удалось очистить задачи.","toast.deleted":"Задача удалена.","toast.deleteFailed":"Не удалось удалить задачу.","tool.invoked":"Вызван {name}","unit.day.one":"день","unit.day.other":"дня|дней","unit.hour.one":"час","unit.hour.other":"часа|часов","unit.minute.one":"минуту","unit.minute.other":"минуты|минут","unit.second.one":"секунду","unit.second.other":"секунды|секунд"},"secretMask":{"secret.hide":"Скрыть секрет","secret.reveal":"Показать секрет"},"session-inspector":{"filter.apply":"Применить фильтр","filter.cancel":"Отмена","filter.candidates":"Подсказки по типам","filter.clear":"Очистить","filter.context":"Родительский контекст подходящей записи","filter.failed":"Не удалось загрузить подсказки по типам.","filter.help":"Совпадение по вхождению (*ключевое слово*). Enter подтверждает, Esc отменяет.","filter.input":"Ключевое слово типа","filter.loading":"Поиск подсказок…","filter.noCandidates":"Подсказок нет. Ключевое слово всё равно можно применить.","filter.placeholder":"Введите фрагмент, напр. delta","filter.title":"Фильтр по типам","object.absent":"[Пустой слот]","object.accessor":"[Getter / Setter, не вычислено]","object.empty":"Пусто","object.group":"Группа","object.groupData":"Данные группы","object.more":"Показать ещё","object.navigation":"Навигация по исходным данным","object.node":"Узел","object.nodeData":"Данные узла","object.properties":"Другие свойства","object.step":"Шаг","object.stepData":"Данные шага","object.turn":"Ход","object.turnData":"Данные хода","picker.cancel":"Отменить выбор (Esc)","picker.instructions":"Наведите курсор в основном чате для предпросмотра, затем щёлкните, чтобы выбрать. Esc отменяет.","picker.noChat":"Откройте эту сессию в основном чате, прежде чем выбирать.","picker.noMatch":"В этой таблице нет подходящей записи. Выберите другой элемент или нажмите Esc для отмены.","picker.pick":"Выберите элемент в представлении чата","tab.description":"Анализируйте исходные журналы и сгруппированные сообщения чата текущей сессии на боковой панели.","tab.title":"Журнал сессии","table.close":"Закрыть","table.collapse":"Свернуть дочерние строки","table.data":"Данные","table.empty":"Нет записей","table.expand":"Развернуть дочерние строки","table.id":"Индекс","table.latest":"Следить за новыми","table.loading":"Загрузка…","table.location":"Ход/шаг","table.older":"Загрузить более ранние","table.raw":"Исходные данные","table.rawError":"Не удалось сериализовать эту запись. Выберите другую запись, чтобы продолжить.","table.removed":"Эта запись удалена или завершена. Выберите текущую запись.","table.resizeDetails":"Изменить размер панели исходных данных","table.time":"Время (UTC)","table.type":"Тип","view.chatNode":"Группа чата","view.presentation":"Представление","view.sessionLog":"Исходный журнал"},"session-log-download":{"dialog.close":"Закрыть","dialog.commandFailed":"Не удалось запустить экспорт сессии.","dialog.errorTitle":"Ошибка экспорта сессии","dialog.preparingDescription":"Готовим ZIP-архив с этой сессией, её дочерними сессиями и вложениями.","dialog.preparingTitle":"Экспорт сессии","dialog.successDescription":"Браузер скачивает ZIP-архив сессии.","dialog.successTitle":"Скачивание сессии началось","header.more":"Другие действия","menu.copyMarkdown":"Скопировать сессию как Markdown","menu.download":"Скачать журнал сессии","menu.feedback":"Отзыв","toast.clipboardFailed":"Не удалось записать в буфер обмена. Проверьте разрешение и повторите.","toast.copied":"Сессия скопирована как Markdown.","toast.preparationFailed":"Не удалось прочитать сессию для копирования. Повторите."},"settings":{"close":"Закрыть","connection.connected":"Подключено","connection.connecting":"Переподключение","connection.error":"Нет подключения","connection.reconnect":"Нет подключения, переподключиться сейчас","connection.restart":"Переподключение, переподключиться сейчас","connection.retry":"Переподключиться сейчас","desktop.update.available":"Обновление","desktop.update.checkFailed":"Не удалось проверить обновления. Повторите попытку позже.","desktop.update.checking":"Проверка обновлений…","desktop.update.checkNetworkFailed":"Не удалось проверить обновления. Проверьте подключение и повторите попытку.","desktop.update.downloadDetail":"Загрузка обновления: {percent}%\nЦелевая версия: {version}","desktop.update.downloadFailed":"Не удалось скачать обновление. Повторите попытку.","desktop.update.downloadNetworkFailed":"Не удалось скачать обновление. Проверьте подключение и повторите попытку.","desktop.update.fullscreenTimeout":"Не удалось выйти из полноэкранного режима. Выйдите из него и повторите обновление.","desktop.update.installFailed":"Не удалось установить обновление. Повторите попытку позже.","desktop.update.installing":"Подготовка к перезапуску…","desktop.update.installNetworkFailed":"Не удалось установить обновление. Проверьте подключение и повторите попытку.","desktop.update.progress":"{percent}%","desktop.update.ready":"Установить и перезапустить","desktop.update.retry":"Повторить обновление","desktop.update.stopFailed":"Не удалось безопасно остановить задачи. Обновление не установлено. Повторите попытку позже.","desktop.update.tasksChanged":"Запустились новые задачи. Подтвердите ещё раз остановку задач и обновление.","desktop.update.tasksUnavailable":"Статус задач недоступен. Повторите обновление, когда рабочая область будет готова.","desktop.update.verifying":"Проверка файлов обновления…","desktop.update.versionDetail":"{label}: {version}","developerTools.description":"Показывает траекторию, изменения кода и все пресеты агента","developerTools.error":"Не удалось сохранить. Повторите попытку.","developerTools.title":"Показывать представление кода","general.currentVersion":"Текущая версия: {version}","general.nav":"Общие","hostRelease.description":"Версия сервиса изменилась. Эта страница приостановила горячее обновление; перезагрузите её, чтобы загрузить новую версию.","hostRelease.later":"Не сейчас","hostRelease.page":"Страница","hostRelease.reload":"Перезагрузить, чтобы загрузить новую версию","hostRelease.service":"Сервис","hostRelease.title":"Версия сервиса изменилась","hostRelease.unknown":"Неизвестно","openDocument":"Открыть файл конфигурации","openDocument.error":"Не удалось открыть файл конфигурации","shortcut.open":"Открыть настройки","title":"Настройки","trigger":"Настройки"},"settings.account":{"accountInfo":"Подробнее об учётной записи","addApiKey":"Добавить ключ API","backToHarness":"Назад в DeepSeek Harness","balance":"Пополненный баланс","balanceSignedOut":"Войдите, чтобы увидеть","balanceUnavailable":"Посмотреть на платформе","bonusBalance":"Бонусный баланс","bonusNoticeTitle":"Бонус зачислен","browserDescription":", затем откройте её в браузере, чтобы завершить вход.","browserPrompt":"Страница не открылась автоматически? ","browserTitle":"Ожидание входа","cancel":"Отмена","close":"Закрыть","completing":"Завершаем вход…","contactUs":"Отзыв","copiedLink":"Ссылка скопирована","copyFailed":"Не удалось скопировать","copyLink":"Скопировать ссылку для входа","expired":"Срок входа истёк. Повторите.","failed":"Не удалось выполнить операцию. Повторите.","failureTitle":"Не удалось войти","initializing":"Начинаем вход…","loading":"Загрузка…","loginDescription":"Войдите в учётную запись DeepSeek или добавьте ключ API, чтобы начать. Ваши проекты и файлы хранятся локально.","loginTitle":"Начало работы","menu":"Меню учётной записи","modelSignInRequired":"Модель недоступна. Войдите и повторите попытку.","more":"Ещё","nav":"Учётная запись","noResponse":"Что-то пошло не так. Проверьте подключение к сети и повторите попытку.","onboardingArtworkLocale":"ru","onboardingBack":"Назад","onboardingBrand":"DeepSeek Harness","onboardingCompact":"Только результаты","onboardingCompactDescription":"Видеть только результаты в простом и понятном интерфейсе","onboardingContinue":"Продолжить","onboardingCredit":"Пополнить баланс","onboardingCreditDescription":"DeepSeek Harness списывает средства с баланса исходя из числа токенов, которые используют модели и инструменты. Пополните баланс заранее, чтобы ваши задачи не прерывались. Ваш баланс расходуется, только пока агент работает над задачей.","onboardingDetailed":"Все подробности","onboardingDetailedDescription":"Весь процесс работы: так проще отлаживать и устранять неполадки","onboardingDevelopment":"Код и разработка","onboardingDevelopmentDescription":"Изменять код, искать и исправлять ошибки, выполнять команды, управлять файлами проекта и другое","onboardingEnter":"Открыть приложение","onboardingFundedTopUp":"Пополнить баланс","onboardingGoTopUp":"Пополнить баланс","onboardingIntroduction":"DeepSeek Harness работает в локальной папке и с помощью инструментов читает и записывает файлы на вашем компьютере. Он помогает искать и упорядочивать информацию, создавать документы и таблицы, писать код, устранять неполадки и многое другое.","onboardingKeepSetting":"Продолжить настройку","onboardingLater":"Далее","onboardingLoading":"Загрузка настроек…","onboardingNoCreditDescription":"Без баланса DeepSeek Harness не может начинать новые задачи. Пополнить баланс можно позже в разделе «Настройки» → «Учётная запись».","onboardingNoCreditTitle":"Пропустить пополнение баланса?","onboardingOffice":"Офисные задачи и творчество","onboardingOfficeDescription":"Редактировать документы, упорядочивать данные, создавать презентации и другое","onboardingProcess":"Сколько подробностей вы хотите видеть?","onboardingProcessDescription":"Это меняет только отображение процесса работы, а не возможности DeepSeek Harness.","onboardingPurposeDescription":"Мы настроим интерфейс и инструменты под ваш стиль работы.","onboardingPurposePrefix":"В чём вам","onboardingPurposeSuffix":"поможет?","onboardingRetry":"Повторить","onboardingSaveFailed":"Не удалось сохранить настройки. Повторите.","onboardingSkip":"Пропустить","onboardingSkipDescription":"Вы можете в любой момент изменить отображение процесса работы, производительности и расхода или включить представление кода в разделе «Настройки» → «Общие».","onboardingSkipTitle":"Пропустить настройку?","onboardingStandard":"Ключевые детали","onboardingStandardDescription":"Главное — результат: только самые важные шаги и действия","onboardingStart":"Начать настройку","onboardingTopUp":"Пополнить баланс","onboardingUnderstood":"Понятно","onboardingWelcome":"Добро пожаловать в","open":"Открыть браузер","platformFailed":"Не удалось выполнить операцию. Повторите.","platformRetry":"Повторить","profileUnavailable":"Сведения об учётной записи пока недоступны.","quotaDescription":"DeepSeek Harness не может начать новую задачу с этой учётной записью, если нет доступного баланса. Хотите пополнить баланс? Это также можно сделать позже в разделе «Настройки» → «Учётная запись».","quotaTitle":"Нет доступного баланса","quotaTopUp":"Пополнить","retry":"Войти снова","sessionExpired":"Вы вышли из учётной записи, войдите снова.","settings":"Настройки","settingsSignedOutDescription":"Войдите в DeepSeek Harness, чтобы получить персональный ключ API","settingsSignedOutTitle":"Вы не вошли в DeepSeek Harness","signedIn":"Вы вошли в DeepSeek","signedOut":"Вы не вошли","signIn":"Войти","signInDescription":"Войдите в учётную запись DeepSeek, чтобы начать.","signOut":"Выйти","signOutDescription":"Выход не удалит никакие данные, и вы сможете снова войти в эту учётную запись.","signOutRunningDescription":"Сейчас выполняются задачи. Выход прервёт их. Выйти сейчас?","signOutUnknownDescription":"Не удалось проверить выполняющиеся задачи. Выход может прервать задачи, использующие эту учётную запись. Выйти сейчас?","timeoutDescription":"Войдите снова, чтобы продолжить.","timeoutTitle":"Время входа истекло","topUp":"Пополнить","usage":"Посмотреть расход","waiting":"Продолжите в браузере"},"settings.agentLoop":{"description":"Как агент распределяет вызовы инструментов.","invalidNumber":"Введите число или оставьте поле пустым, чтобы использовать значение по умолчанию.","maxParallel":"Параллельные вызовы инструментов","maxParallelHint":"Сколько безопасных для параллельного запуска вызовов может выполняться одновременно за один шаг.","overridden":"Переопределено","readOnly":"Настройки этой установки доступны только для чтения.","reset":"Сбросить по умолчанию","save":"Сохранить","saveFailed":"Установка не приняла эти значения; они остались, чтобы вы их исправили.","saving":"Сохранение…","title":"Цикл агента","unavailable":"Этот плагин не загружен, поэтому сейчас его нельзя настроить."},"settings.agentPreset":{"brokenBadge":"Не загрузился","brokenNoCopy":"Пресет, который не загрузился, нельзя скопировать","builtIn":"Встроенный","builtInGroup":"Встроенные","cancel":"Отмена","close":"Закрыть","composition":"Состав (agent.cordis.yml)","copyIntro":"Пресет целиком копируется на этой машине. Идентификатор станет именем каталога, и изменить его позже нельзя; всё остальное редактируется в собственных файлах пресета.","copyOf":"Скопировано из","copyTitle":"Копировать пресет","create":"Создать","createPlugin":"Создать плагин с помощью агента","createPluginChecking":"Проверяем, доступен ли режим создания","createPluginDescription":"Перейдите в режим создания и сделайте свой плагин DSH","createPluginMissing":"Режим создания не входит в эту конфигурацию","createPluginUnavailable":"Временно недоступно. Откройте это меню заново, чтобы повторить","creating":"Создание…","creatorDraft":"Пусть агент поможет мне создать пресет","customGroup":"Свои","delete":"Удалить","deleteConfirm":"Удалить","deleteDescription":"Каталог пресета удаляется. Сессии, которые уже работают на нём, продолжат работу; новые сессии не смогут его выбрать.","deleteTitle":"Удалить этот пресет?","deleting":"Удаление…","displayName":"Название","displayNamePlaceholder":"Показывается в списке выбора; по умолчанию — идентификатор","duplicate":"Дублировать","duplicateUnavailable":"В этой установке нет каталога пресетов, доступного для записи.","error":"Не удалось загрузить пресеты агента.","guideCopied":"Скопировано","guideCopy":"Копировать","guideCordisExplanation":"### Что можно создать\n\nРежим создания включает стандартные инструменты для задач, а также проверку во время выполнения, управление постоянными плагинами и подсказки по разработке плагинов Cordis и пресетов агента. Он может создать плагин, добавляющий возможность или интерфейс, либо пресет, который объединяет инструменты и промпты под конкретную задачу.\n\n### Плагины и режимы\n\nПлагин добавляет DSH возможности: инструмент, подключение к сервису или элемент интерфейса. Режим — это пресет агента, который выбирает инструменты и определяет, как агент работает над задачей. Плагин может входить в собственный пресет.\n\n### Как результат вступает в силу\n\nПопросите агента установить и проверить результат, а не просто сгенерировать исходный код. Плагин может загрузиться сразу или потребовать перезапуска — в зависимости от того, что он меняет. Новый пресет выбирается при запуске новой задачи.","guideCordisIntro":"Для новой задачи выберите режим создания. Опишите нужную возможность, где она должна появиться и как вы будете её проверять.","guideCordisUsage":"### Добавить интерфейс\n\n> Создайте плагин DSH, который добавляет в боковую панель пункт «Заметки проекта». Позвольте мне просматривать Markdown-файлы в этой рабочей области и открывать предпросмотр выбранной заметки. Установите его и проверьте, что страница открывается.\n\nОжидаемый результат: установленный плагин с работающим пунктом и страницей предпросмотра, а также оставшиеся шаги активации.\n\n### Добавить инструмент\n\n> Создайте плагин с инструментом, который читает отчёт о тестах этого проекта и обобщает упавшие тесты. Зарегистрируйте его и проверьте на образце отчёта.\n\nОжидаемый результат: плагин с вызываемым инструментом и проверенным примером вызова.\n\n### Создать свой режим\n\n> Создайте режим «Проверка кода» на основе стандартного режима. Пусть он в первую очередь ищет потенциальные ошибки и пробелы в тестах, указывает пути к файлам и номера строк и спрашивает перед изменением файлов. Сохраните его как пресет, доступный для выбора.\n\nОжидаемый результат: свой пресет для новых задач. Эти инструкции по проверке направляют агента, а какие действия он может выполнять, определяют настройки разрешений.","guideExampleTask":"Пример задачи","guideFootnotes":"Сноски","guideMinimalExplanation":"### Что входит\n\nОдин постоянный инструмент оболочки, read_image и фиксированный системный промпт. Для чтения изображений нужна модель с поддержкой изображений. При нехватке места в контексте старая история сжимается автоматически; пока агент простаивает, сожмите её вручную командой /compact. Встроенный пресет не загружает навыки, планирование и стандартный контекст выполнения.\n\n### Когда его выбирать\n\nИспользуйте его как точку отсчёта для экспериментов и сравнений. Он по-прежнему может читать файлы и выполнять скрипты командами оболочки, но предлагает меньше встроенных способов вести длительную задачу. Меньше инструментов — не значит проще для новичка.","guideMinimalIntro":"Для новой задачи выберите минимальный режим. Для сравнения оставляйте неизменными модель, разрешения, входные данные и исходное состояние рабочей области от запуска к запуску.","guideMinimalUsage":"### Сравнить работу на небольшом исправлении\n\n> Запустите тесты этого проекта, найдите причину сбоя и внесите минимальное исправление. Снова запустите нужные тесты и сообщите результат.\n\nВыполните одну и ту же задачу отдельно в стандартном и минимальном режимах из одного и того же исходного состояния. Сравните выполнение задачи, вызовы инструментов и итоговые изменения. Минимальный режим выполняет работу через команды терминала.","guidePtcExplanation":"### Как вызываются инструменты\n\nPTC — это Programmatic Tool Calling, то есть программный вызов инструментов. В этом встроенном пресете агент через run_code пишет программу на TypeScript, которая вызывает инструменты через сгенерированный SDK. Программа может использовать циклы, условия, обработку ошибок и параллельные вызовы, где это уместно.\n\n### Что попадает в модель\n\nРезультаты инструментов сначала попадают в программу, которая может их отфильтровать и объединить. Модель получает то, что программа выводит или возвращает; результаты с изображениями прикладываются отдельно. Вложенные вызовы инструментов по-прежнему записываются и подчиняются разрешениям инструментов.\n\n### Чем отличается от стандартного режима\n\nОба режима справляются с программированием и пакетными задачами. Стандартный режим даёт модели отдельные инструменты напрямую; PTC организует вызовы инструментов в коде. Текущий пресет PTC оставляет инструмент workflow отключённым. Скорость и расход токенов зависят от задачи и от того, как программа обрабатывает результаты.","guidePtcIntro":"При запуске новой задачи выберите режим PTC. Укажите входные файлы, правила обработки и формат вывода. Код напишет агент.","guidePtcUsage":"### Проверить набор файлов конфигурации\n\n> Проверьте все JSON-файлы в configs/. По schema.json перечислите отсутствующие обязательные поля и недопустимые значения. Сохраните CSV, где каждая проблема — отдельная строка. Включите в отчёт нечитаемые файлы и продолжайте проверять остальные. Исходные файлы не меняйте.\n\nОжидаемый результат: сводка проблем и отчёт в формате CSV. Программа может выполнять одни и те же проверки, обрабатывать отдельные сбои и собирать результаты.\n\n### Свести журналы ошибок в сводку\n\n> Проанализируйте файлы журналов в logs/. Сгруппируйте ошибки по сервису и типу ошибки. Покажите десять самых частых групп и по одному примеру из каждой. Полные счётчики сохраните в CSV.\n\nОжидаемый результат: основные группы ошибок и полная таблица счётчиков. Промежуточные данные можно агрегировать в программе, прежде чем сводка попадёт в модель.","guideSections":"Разделы справки","guideStandardExplanation":"### Как это работает\n\nАгент напрямую вызывает инструменты, чтобы читать и редактировать файлы, искать информацию и выполнять команды терминала. Он включает навыки, планирование, цели, субагентов, рабочие процессы и сжатие контекста.\n\n### Когда его выбирать\n\nС него стоит начинать повседневное программирование, работу с файлами и поиск информации. Стандартный режим также умеет писать скрипты и обрабатывать файлы пакетами. PTC меняет способ организации вызовов инструментов; для пакетных задач он не обязателен.","guideStandardIntro":"При запуске новой задачи выберите стандартный режим. Опишите, чего нужно достичь, укажите нужные файлы и объясните, как проверить результат.","guideStandardUsage":"### Исправить ошибку\n\n> Выясните, почему при повторной отправке формы поиска результаты исчезают. Исправьте это и запустите нужные тесты. Объясните причину и что изменилось.\n\nОжидаемый результат: изменение в коде, результаты нужных тестов и объяснение причины.\n\n### Упорядочить заметки проекта\n\n> Прочитайте заметки Markdown в этом проекте. Суммируйте принятые решения и открытые вопросы, приложив ссылки на исходные файлы.\n\nОжидаемый результат: сводка со ссылками, по которым можно сверить её с исходными заметками.","headerHint":"Пресет агента, выбранный при запуске этой задачи","howToUse":"Использование","idInvalid":"Используйте строчные буквы, цифры и дефисы; начинайте с буквы или цифры","idRequired":"Укажите идентификатор пресета.","idTaken":"Пресет с таким идентификатором уже существует.","inUse":"Основной","modeExplanation":"Описание режима","nav":"Пресеты агента","noDescription":"Нет описания.","openLocation":"Открыть папку","presetCordisDescription":"Настраивайте DSH в диалоге. Пусть агент пишет плагины, которые добавляют возможности или интерфейс, либо создаёт свой режим из инструментов и промптов.","presetCordisName":"Создание","presetId":"Идентификатор","presetIdPlaceholder":"my-agent","presetMinimalDescription":"Агент использует терминал и чтение изображений, а также сжатие контекста. Подходит для проверки и сравнения его базовых показателей.","presetMinimalName":"Минимум","presetPtcDescription":"Включает все возможности стандартного режима. Лучше подходит для задач, где нужно пакетно вызывать инструменты, а затем фильтровать, упорядочивать, удалять дубликаты, подсчитывать или обобщать результаты.","presetPtcName":"Режим PTC","presetStandardDescription":"Работа с кодом, файлами и информацией. Подходит для большинства задач: поиск, редактирование, команды терминала и другие инструменты доступны по мере необходимости.","presetStandardName":"Стандарт","retry":"Повторить","revealedPathLabel":"Файлы пресета:","seatHint":"Выберите пресет агента для новой задачи","sectionIntro":"Выберите инструменты агента и то, как он работает. Для повседневных задач используйте стандартный режим, а для расширения возможностей DSH — режим создания.","setDefault":"Сделать по умолчанию для новых задач","showLocation":"Показать путь","standardUnavailable":"Стандартный режим недоступен. Восстановите его или выберите другой доступный режим.","switchRefused":"Не удалось переключиться на «{name}»: {reason}","userTrust":"Свой","view":"Посмотреть конфигурацию"},"settings.locale":{"language.title":"Язык"},"settings.models":{"accountSignedIn":"Выполнен вход","add":"Добавить провайдера модели","addCatalog":"Сторонний провайдер модели","addCatalogExhausted":"Все провайдеры из каталога уже настроены.","addCatalogHint":"Выберите OpenAI, Anthropic, Kimi или другого провайдера из встроенного каталога и введите его ключ API.","addCustom":"Свой API модели","addCustomHint":"Подключите ретранслятор, собственный сервер или любой другой адрес, совместимый с OpenAI или Anthropic, указав его базовый URL, протокол и модели.","addCustomUnavailable":"Нет доступных протоколов API для объявления.","addMode":"Способ добавления","addModel":"Добавить модель","advancedHint":"Остальные поля находятся в cordis.patch.yml; отредактируйте этот раздел напрямую.","apply":"Применить","applying":"Применение…","authHelp":"Подробнее об аутентификации","baseUrl":"Базовый URL","baseUrlConfigured":"Настроено провайдером","baseUrlDefault":"Нет адреса по умолчанию","baseUrlEnvironment":"Конфигурация адреса провайдера: {env}","baseUrlPlaceholder":"{url}","cancel":"Отмена","close":"Закрыть","conflict":"Пока эта карточка была открыта, настройки изменил кто-то другой. Закройте её и откройте заново, чтобы изменить текущие значения.","contextWindow":"Окно контекста","contextWindowPlaceholder":"По умолчанию у провайдера","create":"Создать провайдера","creating":"Создание…","credentialConfigured":"Ключ API настроен","credentialMissing":"Ключ API отсутствует","customAdd":"Добавить своего провайдера","customAnthropicBaseUrlPlaceholder":"https://gateway.example","customApi":"Протокол API","customApiUnset":"Не выбран","customBaseUrlInvalid":"Введите корректный URL HTTP или HTTPS.","customBaseUrlPlaceholder":"https://gateway.example/v1","customDisplayName":"Отображаемое имя","customized":"Изменённые настройки","customNeedsBaseUrl":"Своему провайдеру нужен базовый URL.","customNeedsModels":"Своему провайдеру нужна хотя бы одна модель.","customRoute":"ID провайдера","customRouteHint":"Идентификатор в нижнем регистре, начинающийся с буквы, который однозначно называет этого провайдера в запросах и служит именем его учётных данных.","customRouteInvalid":"Начните со строчной буквы; далее — строчные буквы, цифры и дефисы.","customRouteTaken":"Этот ID уже занят провайдером.","customTag":"Свой","customTitle":"Свой провайдер","deepSeekAccount":"Учётная запись DeepSeek","deepSeekBaseUrl":"https://api.deepseek.com/anthropic (по умолчанию используется DEEPSEEK_BASE_URL)","deepSeekEndpointHint":"Используйте адрес API, совместимый с Anthropic Messages.","deleteConfirm":"Удалить {provider}","deleteDescription":"При удалении {provider} удалится его конфигурация. Используемые им учётные данные управляются в другом месте и сохранятся.","deleteDescriptionWithCredential":"При удалении {provider} удалятся его конфигурация и сохранённый ключ API.","deleteTitle":"Удалить {provider}?","deleting":"Удаление {provider}…","edit":"Изменить","editProvider":"Изменить {provider}","fetchAdopt":"Обновить список","fetchDescription":"Это модели, доступные у провайдера. Отмеченные модели попадают в список.","fetchDeselectAll":"Снять выделение","fetchEmpty":"Провайдер не указал ни одной модели. Добавьте их вручную.","fetching":"Запрос к провайдеру…","fetchKeepOne":"Оставьте отмеченной хотя бы одну модель.","fetchModels":"Получить доступные модели","fetchNeedsBaseUrl":"Сначала укажите базовый URL, затем получите список.","fetchNoMatches":"Нет подходящих моделей.","fetchSearch":"Поиск моделей","fetchSelectAll":"Выбрать все","fetchTitle":"Выберите модели","intro":"Укажите ключи API, чтобы использовать модели следующих провайдеров.","keyBlank":"Введите ключ API или оставьте поле пустым — сохранённый ключ останется.","keyBlankNew":"Введите ключ API или оставьте поле пустым, если провайдер аутентифицируется другим способом.","keyEnvLocked":"Задано средой запуска (только чтение)","keyFallbackDetected":"Обнаружена переменная среды ({hint}).","keyFallbackDetectedHidden":"Обнаружена переменная среды.","keyFallbackMissing":"Переменная среды не обнаружена. Введите ключ API или задайте {hint} в среде.","keyFallbackUnchecked":"Статус учётных данных среды не подтверждён.","keyHelp":"Сначала используются сохранённые учётные данные. Резервные варианты из среды показаны здесь по порядку: {env}. Источники: среда запуска, $cwd/.env, затем $DSH_HOME/.env.","keyHide":"Скрыть секрет","keyIllegalCharacters":"Этот ключ API имеет неверный формат. Проверьте его.","keyInput":"Ключ API","keyPlaceholder":"Введите ключ API","keyPlaceholderFallback":"Оставьте пустым для аутентификации из среды ({hint})","keyPlaceholderNative":"Введите ключ API или оставьте поле пустым для аутентификации из среды","keyPlaceholderSaved":"Оставьте пустым для сохранённых учётных данных","keyRequired":"Чтобы продолжить, введите ключ API.","keyReveal":"Показать секрет","keyStored":"Настроен — введите новое значение, чтобы заменить","loadFailed":"Не удалось загрузить каталог провайдеров","maxTokens":"Максимум выходных токенов","maxTokensPlaceholder":"По умолчанию у провайдера","model":"Модель","modelAdvanced":"Параметры модели","modelCapacityInvalid":"Ёмкость должна быть числом, при необходимости с суффиксом K или M.","modelContextInvalid":"Окно контекста должно быть положительным числом, например 131072, 256K или 1M.","modelContextWindow":"Окно контекста","modelDuplicate":"Каждый ID модели может встречаться только один раз.","modelId":"ID модели","modelIdDuplicate":"ID модели должен быть уникальным.","modelIdRequired":"Укажите ID модели.","modelInputImage":"Изображение","modelInputText":"Текст","modelInputTypes":"Типы ввода","modelMaxTokens":"Максимум выходных токенов","modelMaxTokensInvalid":"Максимум выходных токенов должен быть положительным числом, например 8192, 64K или 1M.","modelName":"Отображаемое имя","modelNameInvalid":"Отображаемое имя не может быть пустым.","modelNamePlaceholder":"Если пусто, используется ID модели","modelReasoning":"Уровни рассуждений","modelReasoningAdd":"Добавить уровень","modelReasoningHelp":"О уровнях рассуждений","modelReasoningHelpText":"Значение API передаётся в поле reasoning-effort запроса, например в reasoning_effort у OpenAI. По умолчанию подставляется название уровня; если документация API провайдера модели указывает другое значение, руководствуйтесь ею. Off отключает рассуждения и не требует значения; значение, уже записанное в конфигурации, сохраняется и отправляется.","modelReasoningLevel":"Уровень","modelReasoningNeedsLevel":"Добавьте хотя бы один уровень, кроме Off, или отключите уровни рассуждений.","modelReasoningOffValuePlaceholder":"Отключает рассуждения","modelReasoningRemove":"Удалить уровень","modelReasoningValue":"Значение API","modelReasoningValueRequired":"Каждому уровню, кроме Off, нужно значение API, и ни одно значение не может быть пустым.","models":"Модели","modelsCustomized":"Изменённый каталог моделей","modelsEmpty":"В списке выбора моделей не будет ни одной модели. ID вне списка всё равно можно отправлять напрямую.","modelsInherited":"Используются значения адаптера по умолчанию","nav":"Модели","onboardingDescription":"Настройте официальный провайдер DeepSeek, чтобы начать работу.","onboardingLater":"Настроить позже","onboardingSave":"Сохранить и продолжить","onboardingSaving":"Сохранение…","onboardingTitle":"Добавьте ключ API, чтобы начать","protocolAnthropicMessages":"Anthropic Messages","protocolOpenAiCompletions":"OpenAI Chat Completions","protocolOpenAiResponses":"OpenAI Responses","provider":"Провайдер","readOnly":"Документ настроек этой установки доступен только для чтения.","remove":"Удалить","removeModel":"Удалить модель","removeProvider":"Удалить {provider}","reorderModel":"Изменить порядок моделей","reorderModelHelp":"Перетащите или используйте стрелки вверх и вниз.","resetModels":"Вернуть по умолчанию","retry":"Повторить","savedProvider":"Сохранено: {provider}.","settingsPathUnresolvable":"не удаётся определить путь к настройкам","title":"Модели","welcomeBody":"DeepSeek Harness 0.2 всё ещё в статусе предварительной версии: многие области требуют дальнейшей доработки и шлифовки. Мы будем рады отзывам и предложениям от всех разработчиков и пользователей. Новое настольное приложение теперь рассчитано на широкую аудиторию, а дополнительные функции для разработчиков можно включить в настройках. Ожидается, что функции продукта и API плагинов DeepSeek Harness продолжат быстро развиваться и меняться, а со временем постепенно станут стабильными.\n\nМы надеемся вместе с пользователями и разработчиками со всего мира исследовать пределы интеллекта, опираясь на инфраструктуру с открытым исходным кодом, переиспользуемую и компонуемую. Приглашаем всех воплощать свои идеи с помощью DeepSeek Harness и участвовать в сообществе, чтобы обогатить экосистему плагинов.","welcomeContinue":"Продолжить","welcomeError":"Не удалось сохранить подтверждение. Повторите попытку.","welcomeTitle":"Уведомление о предварительной версии"},"settings.permission":{"confirm.acknowledge":"Я понимаю риски и хочу продолжить","confirm.cancel":"Отмена","confirm.description":"Полный доступ позволяет новым сессиям сократить число шагов подтверждения и выполнять больше действий напрямую, включая чувствительные операции, изменение файлов и внешние команды. Используйте его, только если доверяете последующим задачам.","confirm.enable":"Включить полный доступ","confirm.title":"Включить полный доступ?","description":"Выберите режим разрешений по умолчанию для новых сессий","loading":"Загрузка","preset.fullAccess":"Полный доступ","preset.readOnly":"Только чтение","preset.workspaceWrite":"Запись в рабочей области","title":"Разрешения","unavailable":"Недоступно"},"settings.pluginInventory":{"active":"Запущен","clientSyncFailed":"Некоторые плагины не удалось синхронизировать на этой странице. Включение на хосте не изменилось.","clientSyncing":"Синхронизация плагинов на этой странице…","clientSyncRetry":"Повторить синхронизацию","condition":"Отключён при","conditionalTag":"Условно","configuration":"Конфигурация","countUnit":"шт.","disabledTag":"Выключен","empty":"Нет доступных плагинов.","emptySearch":"Нет подходящих плагинов.","enabledIn":"Включён в","enabledTag":"Включён","error":"Плагины временно недоступны.","failed":"Не удалось запустить","failedCountLabel":"со сбоем","failedTag":"Сбой","fromPreset":"Из пресета","globalSubtitle":"Общие для системы и всех сессий","globalTitle":"Глобальные плагины","loading":"Чтение плагинов…","loadingPhase":"Загрузка","matchesInOtherPresets":"ещё {count} совпадение в других пресетах: |ещё {count} совпадения в других пресетах: |ещё {count} совпадений в других пресетах: ","metadataError":"Ошибка метаданных пакета: {error}","moduleLabel":"Модуль","pending":"Ожидание зависимостей","presetEnabledTag":"Через пресеты","presetOptionBroken":"{name} (не удалось загрузить)","presetOptionDefault":"{name} (по умолчанию)","presetProvidedDetail":"Отключён глобально; пресеты агента предоставляют его для каждой сессии","presetSubtitle":"Собирается для каждой сессии пресетами агента","presetTitle":"Плагины сессии","retry":"Повторить","runtime":"Состояние","search":"Поиск плагинов","switcherLabel":"Выберите пресет агента для просмотра","tab":"Список плагинов","unloading":"Выгрузка","unobserved":"Не запущен","viewInPreset":"Открыть в группе пресетов"},"settings.plugins":{"agentLoopDescription":"Как агент распределяет вызовы инструментов.","agentLoopMaxParallel":"Параллельные вызовы инструментов","agentLoopMaxParallelHint":"Сколько безопасных для параллельного запуска вызовов может выполняться одновременно за один шаг.","agentLoopTitle":"Цикл агента","bashDescription":"Ограничивает каждую команду, которую запускает агент.","bashMaxOutputBytes":"Лимит вывода на поток (байты)","bashMaxOutputBytesHint":"Вывод сверх этого предела сбрасывается во временный файл, а не теряется.","bashTimeoutMs":"Тайм-аут команды (мс)","bashTimeoutMsHint":"Сколько одна команда может выполняться до принудительного завершения.","bashTitle":"Оболочка","collapse":"Скрыть настройки","configurableTab":"Настройки плагинов","discard":"Сбросить","empty":"В этой установке нет настроек плагинов.","expand":"Показать настройки","intro":"Плагины, входящие в эту установку.","invalidNumber":"Введите число или оставьте поле пустым, чтобы использовать значение по умолчанию.","nav":"Встроенные","overridden":"Переопределено","readOnly":"Настройки этой установки доступны только для чтения.","reset":"Сбросить по умолчанию","save":"Сохранить","saveFailed":"Установка не приняла эти значения; они остались, чтобы вы их исправили.","saving":"Сохранение…","subagentModelSelectionAllowed":"Модели, доступные агентам","subagentModelSelectionChoose":"Когда включено, агенты могут выбирать провайдера, модель и глубину рассуждений для каждого субагента из разрешённых моделей ниже. Действует только для новых сессий.","subagentModelSelectionConflict":"Настройки изменились в другом месте. Отмените изменения и повторите попытку.","subagentModelSelectionDescription":"Определяет, какие модели агенты могут выбирать для субагентов.","subagentModelSelectionEmpty":"Ни один провайдер моделей пока не объявил ни одной модели.","subagentModelSelectionLoadFailed":"Не удалось загрузить модели.","subagentModelSelectionLoading":"Загрузка моделей…","subagentModelSelectionOff":"Субагенты используют заданные по умолчанию значения или наследуют модель родительского агента. Ранее выбранные модели сохраняются.","subagentModelSelectionPartial":"Некоторые провайдеры моделей не удалось загрузить; сохранённый выбор по-прежнему можно удалить.","subagentModelSelectionRequired":"Перед сохранением выберите хотя бы одну модель.","subagentModelSelectionRetry":"Повторить","subagentModelSelectionTitle":"Субагент","subagentModelSelectionToggle":"Разрешить агентам выбирать модели для субагентов","subagentModelSelectionUnavailable":"Сейчас недоступно","subagentModelSelectionUnavailableGroup":"Сохранено, но сейчас недоступно","tabs":"Разделы плагинов","title":"Встроенные плагины","unsaved":"Не сохранено","webSearchApiKey":"Ключ API","webSearchApiKeyHint":"Хранится вне файла настроек. Оставьте поле пустым, чтобы сохранить текущий ключ.","webSearchApiKeySet":"Ключ настроен.","webSearchApiKeyUnset":"Ключ не настроен; поиск недоступен, пока он не задан.","webSearchBaseUrl":"Адрес","webSearchBaseUrlHint":"Пустое поле — адрес провайдера по умолчанию.","webSearchDescription":"Поисковый провайдер DeepSeek.","webSearchMaxUses":"Максимум поисков на запрос","webSearchMaxUsesHint":"Сколько раз один запрос может выполнить поиск, прежде чем должен ответить.","webSearchTitle":"Поиск в интернете"},"settings.sessionLog":{"description":"Помогите улучшить модели и продукты DeepSeek.","failed":"Не удалось сохранить настройку","saved":"Настройка сохранена","title":"Загружать журнал сессии при использовании официального API модели"},"settings.shell":{"description":"Ограничивает время работы каждой команды и объём её вывода.","invalidNumber":"Введите число или оставьте поле пустым, чтобы использовать значение по умолчанию.","maxOutputBytes":"Лимит вывода на поток (байты)","maxOutputBytesHint":"Вывод сверх этого предела сбрасывается во временный файл, а не теряется.","overridden":"Переопределено","readOnly":"Настройки этой установки доступны только для чтения.","reset":"Сбросить по умолчанию","save":"Сохранить","saveFailed":"Установка не приняла эти значения; они остались, чтобы вы их исправили.","saving":"Сохранение…","timeoutMs":"Тайм-аут команды (мс)","timeoutMsHint":"Сколько одна команда может выполняться до принудительного завершения.","title":"Оболочка","unavailable":"Этот плагин не загружен, поэтому сейчас его нельзя настроить."},"settings.subagent":{"overridden":"Переопределено","readOnly":"Настройки этой установки доступны только для чтения.","reset":"Сбросить по умолчанию","save":"Сохранить","saveFailed":"Установка не приняла эти значения; они остались, чтобы вы их исправили.","saving":"Сохранение…","subagentCapacityHelp":"Общее число одновременно работающих субагентов у одного главного агента на всех уровнях рекурсии. Главный агент не учитывается. Когда лимит достигнут, новые запросы на запуск отклоняются.","subagentCapacityHelpLabel":"О лимите параллелизма субагентов","subagentCapacityInvalid":"Введите целое число не меньше 1.","subagentDepthHelp":"Ограничивает, сколько уровней субагентов может создать агент.","subagentDepthHelpLabel":"О максимальной глубине рекурсии","subagentDepthInvalid":"Введите целое число не меньше 0.","subagentDepthOne":"Только главный агент может создавать субагентов","subagentDepthOverride":"Если инструмент задаёт свою максимальную глубину рекурсии, приоритет у его настройки.","subagentDepthZero":"Субагенты выключены","subagentDescription":"Настройте глубину рекурсии, количество и модели субагентов.","subagentLimitsTitle":"Лимиты","subagentMaxActive":"Лимит параллелизма субагентов","subagentMaxDepth":"Максимальная глубина рекурсии","subagentModelSelectionAllowed":"Модели, доступные агентам","subagentModelSelectionChoose":"Когда включено, агенты могут выбирать провайдера, модель и глубину рассуждений для каждого субагента из разрешённых моделей ниже. Действует только для новых сессий.","subagentModelSelectionConflict":"Настройки изменились в другом месте. Отмените изменения и повторите попытку.","subagentModelSelectionEmpty":"Ни один провайдер моделей пока не объявил ни одной модели.","subagentModelSelectionLoadFailed":"Не удалось загрузить модели.","subagentModelSelectionLoading":"Загрузка моделей…","subagentModelSelectionOff":"Субагенты используют заданные по умолчанию значения или наследуют модель родительского агента. Ранее выбранные модели сохраняются.","subagentModelSelectionPartial":"Некоторые провайдеры моделей не удалось загрузить; сохранённый выбор по-прежнему можно удалить.","subagentModelSelectionRequired":"Перед сохранением выберите хотя бы одну модель.","subagentModelSelectionRetry":"Повторить","subagentModelSelectionTitle":"Выбор модели","subagentModelSelectionToggle":"Разрешить агентам выбирать модели для субагентов","subagentModelSelectionUnavailable":"Сейчас недоступно","subagentModelSelectionUnavailableGroup":"Сохранено, но сейчас недоступно","subagentTitle":"Субагент","unavailable":"Этот плагин не загружен, поэтому сейчас его нельзя настроить."},"settings.theme":{"appearance.dark":"Тёмная","appearance.light":"Светлая","appearance.system":"Системная","appearance.title":"Оформление","fontFamily.code.description":"Для блоков кода, встроенного кода и вывода инструментов. Разделяйте шрифты запятыми; пустое поле — шрифт по умолчанию","fontFamily.code.title":"Шрифт кода","fontFamily.placeholder":"По умолчанию","fontFamily.terminal.description":"Для терминала на боковой панели. Разделяйте шрифты запятыми; пустое поле — шрифт по умолчанию","fontFamily.terminal.title":"Шрифт терминала","fontFamily.text.description":"Для интерфейса и текста диалога. Разделяйте шрифты запятыми; пустое поле — шрифт по умолчанию","fontFamily.text.title":"Шрифт текста","fontSize.code.decrease":"Уменьшить размер шрифта кода","fontSize.code.description":"Для блоков кода, встроенного кода и вывода инструментов","fontSize.code.increase":"Увеличить размер шрифта кода","fontSize.code.title":"Размер шрифта кода","fontSize.decrease":"Уменьшить размер шрифта","fontSize.description":"Влияет только на содержимое диалога","fontSize.increase":"Увеличить размер шрифта","fontSize.more":"Другие настройки шрифта","fontSize.terminal.decrease":"Уменьшить размер шрифта терминала","fontSize.terminal.description":"Для терминала на боковой панели","fontSize.terminal.increase":"Увеличить размер шрифта терминала","fontSize.terminal.title":"Размер шрифта терминала","fontSize.text.decrease":"Уменьшить размер шрифта","fontSize.text.description":"Влияет только на содержимое диалога","fontSize.text.increase":"Увеличить размер шрифта","fontSize.text.title":"Размер шрифта","fontSize.title":"Размер шрифта","fontSize.unit":"px"},"settings.webSearch":{"apiKey":"Ключ API","apiKeyHint":"Хранится вне файла настроек. Оставьте поле пустым, чтобы сохранить текущий ключ.","apiKeySet":"Ключ настроен.","apiKeyUnset":"Ключ не настроен; через адрес по умолчанию искать могут только диалоги с моделью «Учётная запись DeepSeek».","baseUrl":"Базовый адрес Messages API","baseUrlHint":"Укажите адрес с префиксом API, например https://api.deepseek.com/anthropic/v1. Провайдер дописывает /messages. Оставьте поле пустым, чтобы вернуть значение по умолчанию.","count":"Результатов на поиск","countHint":"Число результатов, возвращаемых на один запрос: целое число от 1 до 50, по умолчанию 10. Задаёт количество результатов, а не число вызовов поиска. web_search сохраняет не больше источников, чем допускает его собственный лимит результатов.","description":"Настройка поискового провайдера DeepSeek.","invalidCount":"Введите целое число от 1 до 50 или оставьте поле пустым, чтобы использовать значение по умолчанию.","invalidNumber":"Введите число или оставьте поле пустым, чтобы использовать значение по умолчанию.","maxUses":"Максимум поисков на запрос","maxUsesHint":"Сколько поисков вспомогательная модель может выполнить в рамках одного запроса Messages. Действует только для Messages API.","overridden":"Переопределено","readOnly":"Настройки этой установки доступны только для чтения.","reset":"Сбросить по умолчанию","save":"Сохранить","saveFailed":"Установка не приняла эти значения; они остались, чтобы вы их исправили.","saving":"Сохранение…","searchApiBaseUrl":"Базовый адрес Search / Fetch API","searchApiBaseUrlHint":"Укажите адрес с префиксом API, например https://api.deepseek.com/v1/tools. Провайдер дописывает /search или /fetch. Оставьте поле пустым, чтобы вернуть значение по умолчанию.","searchGuide":"Руководство по Search и Fetch","searchGuideUrl":"https://api-docs.deepseek.com/guides/search","title":"Поиск в интернете","unavailable":"Этот плагин не загружен, поэтому сейчас его нельзя настроить.","useSearchApi":"Использовать новый Web Search API","useSearchApiHint":"По умолчанию выключено: поиск идёт через DeepSeek Messages. Возможности и тарифы нового Web Search API см. "},"shortcuts":{"application":"Приложение","approval":"Область подтверждения","cancel":"Отмена","clear":"Удалить","clear-search":"Очистить поиск","close":"Закрыть сочетания клавиш","close-confirmation":"Закрыть окно подтверждения","conflict":"Уже используется: «{commands}»","description":"Просмотр и изменение доступных сочетаний клавиш и действий при вводе","desktop-document":"userData/keybindings.json","desktop-reload":"перезапустите Harness","dismiss":"Закрыть меню или верхнее окно","edit-label":"Изменить сочетание для {command}","empty":"Нет подходящих сочетаний клавиш","future":"Конфигурация сочетаний клавиш ({location}) создана более новой версией. Обновите Harness и повторите попытку.","global-hint":"Открыть из любого места","input":"Ввод сообщения","invalid":"Конфигурация сочетаний клавиш ({location}) повреждена. Создайте резервную копию и исправьте эту конфигурацию, затем {reload}.","macos-web-help":"Используйте Command+/, Command+,, Command+Backslash, Control+Backquote, Command+Option+клавиша или Command+Shift+клавиша. Также поддерживаются сочетания с тремя или четырьмя разными модификаторами. Сочетания, занятые браузером или системой, могут не доходить до страницы.","menus":"Меню и окна","modified-count":"{count} сочетание изменено|{count} сочетания изменены|{count} сочетаний изменено","modifier-required":"Включите в сочетание Command, Ctrl или Alt.","move":"Переместить выделение в меню","native-failed":"Не удалось защитить запись клавиш в настольном приложении. Остановите запись и повторите попытку.","not-ready":"Сочетания клавиш ещё не готовы. Повторите попытку.","open":"Открыть сочетания клавиш","read":"Не удалось прочитать {location}. Проверьте разрешения на доступ, затем {reload}.","record":"Нажмите сочетание клавиш","record-help":"Отпустите клавиши, чтобы сохранить. Tab переключает действия; Esc отменяет.","reserved":"Это сочетание зарезервировано для системных действий и редактирования текста.","reset":"Вернуть по умолчанию","reset-all":"Вернуть все по умолчанию","reset-description":"Сочетания клавиш этой платформы вернутся к значениям по умолчанию, включая изменённые и удалённые. На другие платформы это не повлияет.","reset-failed":"Не удалось вернуть значения по умолчанию. Ваши сочетания клавиш не изменились. Повторите попытку.","reset-saved":"Сочетания по умолчанию восстановлены","reset-title":"Вернуть все сочетания клавиш по умолчанию?","retry-save":"Повторить сохранение","review":"Я проверил актуальную конфигурацию","saved":"Изменено","search":"Поиск сочетаний клавиш","select":"Выбрать пункт меню","settings":"Сочетания клавиш","stale":"Конфигурация сочетаний клавиш или доступные команды изменились. Проверьте актуальные сочетания перед сохранением.","title":"Сочетания клавиш","too-many-keys":"Удерживайте не более двух клавиш, не считая модификаторов. Отпустите клавиши и повторите попытку.","unbound":"Нет сочетания","unsupported-browser":"Этот браузер пока не поддерживает такое сочетание.","unsupported-key":"Эта клавиша не поддерживается.","using-accepted":"Продолжают действовать последние успешно прочитанные сочетания клавиш.","using-defaults":"Действуют сочетания клавиш по умолчанию.","view":"Изменить сочетания","web-document":"запись dsh.keybindings.v1 в localStorage этого сайта","web-help":"Сочетания в браузере: Mod+/, Mod+Shift+,, Mod+Shift+.. Mod — это Command на Mac и Ctrl в других системах.","web-reload":"обновите страницу","windows-web-help":"Используйте Ctrl+/, Ctrl+,, Ctrl+Alt+клавиша или Ctrl+Shift+клавиша. Также поддерживаются сочетания с тремя или четырьмя разными модификаторами. Сочетания, занятые браузером или системой, могут не доходить до страницы.","write-failed":"Не удалось сохранить. Ваши прежние сочетания клавиш и текущий черновик не потеряны. Повторите попытку."},"shortcuts.layout":{"toggle":"Переключить левую боковую панель"},"sidebar":{"navigation.label":"Навигация","panels.label":"Глобальные панели","panels.more":"Ещё","session.new":"Новая сессия","session.new.label":"Новая сессия","toggle.collapse":"Свернуть боковую панель","toggle.open":"Открыть боковую панель","version.copied":"Версия скопирована"},"sidebarBrowser":{"address.changed":"URL изменился","address.placeholder":"Введите адрес HTTP(S)","address.unknown":"Страница перешла; текущий механизм встраивания не может прочитать её новый URL.","back":"Назад","error.application-origin":"Встроенный браузер не может открыть само приложение DSH.","error.credentials":"Адрес не может содержать имя пользователя или пароль.","error.empty":"Введите адрес.","error.invalid":"Этот адрес некорректен или слишком длинный.","error.protocol":"Поддерживаются только адреса HTTP и HTTPS; для локальных файлов используйте «Предпросмотр документа».","external":"Открыть в системном браузере","forward":"Вперёд","go":"Перейти","guide.description":"Просмотр веб-страниц","guide.title":"Браузер","load.failed":"Не удалось загрузить страницу; обновите её или откройте в системном браузере.","load.failed.detail":"Не удалось загрузить страницу ({code}): {description}","loading":"Открытие…","reload":"Обновить","restore.action":"Восстановить страницу","restore.previous":"Ранее открытая страница","sandbox.disable":"Выключить ограничения песочницы","sandbox.enable":"Восстановить ограничения песочницы","sandbox.warning":"Ограничения песочницы выключены; страница может перенаправлять приложение верхнего уровня, а также запускать скачивание, открывать модальные окна и блокировать ввод.","shortcut.noSession":"Сначала откройте сессию","start":"Введите адрес HTTP(S), чтобы начать просмотр","type.label":"Браузер"},"sidebarCodePreview":{"copied":"Скопировано","copy":"Копировать","title":"Код"},"sidebarDocumentPreview":{"autoRefresh":"Автообновление","autoRefresh.disable":"Выключить автообновление","autoRefresh.enable":"Включить автообновление","changed":"Файл изменился, показано прежнее содержимое.","copied":"Скопировано","copy":"Копировать","error.notFound":"Файл не найден. Возможно, он перемещён или удалён.","error.notRegularFile":"Это не обычный файл — показывать нечего.","error.notText":"Предпросмотр для этого типа файлов пока недоступен.","error.tooLarge":"Страница превышает предел {limit}, чтение невозможно.","error.unavailable":"Не удалось прочитать: {message}","loading":"Отрисовка документа…","loadMore":"Загрузить ещё","openWith":"Открыть с помощью","reload":"Прочитать файл заново","reloadNow":"Перечитать","rendererUnavailable":"Предпросмотр «{name}» недоступен.","resourceUnavailable":"Служба файловых ресурсов недоступна.","retry":"Повторить","title":"Код","unsupportedFile":"Предпросмотр для этого типа файлов пока недоступен.","viewer.text":"Обычный текст","wrap.aria":"Перенос строк","wrap.disable":"Выключить перенос строк","wrap.enable":"Включить перенос строк"},"sidebarExcel":{"charts":"диаграммы","conditionalFormatting":"условное форматирование","encoding":"Не удалось определить кодировку этого текста. Сохраните файл в UTF-8 или UTF-16 с BOM и повторите.","featureSeparator":", ","formulaWarning":"В книге есть формулы. Показанные результаты могут отсутствовать или быть неточными.","images":"изображения","invalid":"Не удалось открыть таблицу. Проверьте формат, содержимое или защиту паролем.","language":"ru","loading":"Отрисовка документа…","retry":"Повторить","shapes":"фигуры","timeout":"Время открытия книги истекло. Попробуйте файл меньшего размера.","title":"Таблица","tooLarge":"Книга превышает предел размера для предпросмотра.","unsupportedNotice":"Предпросмотр не поддерживает {features} в этой книге. Откройте её в системном приложении, чтобы увидеть всё содержимое."},"sidebarFiles":{"autoRefresh":"Автообновление","autoRefresh.disable":"Выключить автообновление","autoRefresh.enable":"Включить автообновление","empty":"Пустой каталог","entry.noViewer":"Ни один просмотрщик не может открыть этот файл.","entry.other":"Это не файл и не каталог, поэтому открыть его нельзя.","error.notDirectory":"Это не каталог.","error.notFound":"Этого каталога больше нет. Возможно, его переместили или удалили.","error.outsideWorkspace":"Этот каталог вне рабочей области, поэтому боковая панель его не читает.","error.unavailable":"Не удалось прочитать: {message}","guide.description":"Просмотр файлов в рабочей области этой сессии","guide.title":"Файлы рабочей области","loading":"Чтение…","navigator.hide":"Скрыть дерево файлов","navigator.resize":"Изменить размер дерева файлов","navigator.show":"Показать дерево файлов","noWorkspace":"У этой сессии нет каталога рабочей области.","reload":"Обновить","shortcut.noSession":"Сначала выберите сессию","truncated":"Слишком много элементов — показана только часть.","type.label":"Файлы"},"sidebarImage":{"failed":"Не удалось отобразить изображение.","loading":"Отрисовка документа…","preview":"Предпросмотр изображения: {name}","title":"Изображение","unsupported":"Для предпросмотра изображения требуется полное содержимое файла.","zoomControls":"Управление масштабом","zoomFitWidth":"По ширине","zoomIn":"Увеличить","zoomMenu":"Выбрать масштаб","zoomOut":"Уменьшить","zoomValue":"{percent}%"},"sidebarOffice":{"busy":"Предпросмотр Office занят. Повторите попытку чуть позже.","changed":"Файл изменился во время чтения. Откройте предпросмотр заново.","closeDetails":"Закрыть сведения о шрифтах","failed":"Преобразование Office не дало пригодного PDF. Проверьте файл и повторите попытку.","invalid":"Этот файл Office нельзя открыть в предпросмотре. Возможно, он повреждён, защищён паролем или имеет неверное расширение.","loading":"Отрисовка документа…","missingFontsCount":"{count} шрифт|{count} шрифта|{count} шрифтов","missingFontsDescription":"Эти шрифты недоступны в этом предпросмотре. Текст и вёрстка могут отличаться от исходного документа.","missingFontsTitle":"Отсутствующие шрифты","retry":"Повторить","timeout":"Время преобразования Office истекло. Повторите попытку.","title":"Документ Office","tooLarge":"Файл Office или преобразованный PDF превышает предельный размер предпросмотра. Уменьшите размер файла или измените конфигурацию предпросмотра.","unavailable":"Предпросмотр Office недоступен. Включите службу предпросмотра документов на компьютере, где запущен DeepSeek Harness.","viewMissingFonts":"Отсутствует {count} шрифт. Нажмите, чтобы посмотреть.|Отсутствуют {count} шрифта. Нажмите, чтобы посмотреть.|Отсутствуют {count} шрифтов. Нажмите, чтобы посмотреть."},"sidebarPdf":{"failed":"Не удалось показать PDF: {message}","loading":"Отрисовка документа…","pageImage":"Страница {page} PDF","password":"Для этого PDF нужен пароль; предпросмотр файлов, защищённых паролем, не поддерживается.","rendering":"Отрисовка страницы…","retry":"Повторить","title":"PDF","unsupported":"Для предпросмотра PDF требуется полное содержимое файла.","workerFailed":"Процесс отрисовки PDF не может продолжить работу. Повторите попытку.","zoomControls":"Управление масштабом","zoomFitWidth":"По ширине","zoomIn":"Увеличить","zoomMenu":"Выбрать масштаб","zoomOut":"Уменьшить","zoomValue":"{percent}%"},"sidebarRight":{"chrome.collapse":"Свернуть боковую панель","chrome.collapseAria":"Свернуть правую боковую панель","chrome.exitFullscreen":"Выйти из полноэкранного режима","chrome.expand":"Открыть боковую панель","chrome.expandAria":"Открыть правую боковую панель","chrome.toFullscreen":"На весь экран","command.budget":"Максимум две панели","command.close":"Закрыть текущую страницу или окно","command.collapsed":"Сначала разверните правую боковую панель","command.empty":"Сначала откройте страницу","command.float":"Это действие недоступно в плавающей панели","command.fullscreen":"Переключить полноэкранный режим панели","command.noFocus":"Сначала переведите фокус на панель справа","command.noRefresh":"Эту страницу нельзя обновить","command.noSession":"Сначала выберите сессию","command.refresh":"Обновить текущую страницу","command.stale":"Страница сменилась — переведите фокус заново","command.toggle":"Переключить правую боковую панель","command.width":"Не хватает ширины для разделения — расширьте боковую панель","dock.addTab":"Новая вкладка","dock.closeFloat":"Закрыть","dock.closeTab":"Закрыть","dock.dockFloat":"Вернуть в боковую панель","dock.drop.bottom":"Разделить снизу","dock.drop.center":"Переместить сюда","dock.drop.left":"Разделить слева","dock.drop.right":"Разделить справа","dock.drop.top":"Разделить сверху","dock.emptyPane":"Пустая панель","dock.splitPane":"Разделить","dock.splitPaneDisabled":"Максимум две панели","dock.splitPaneNarrow":"Не хватает ширины для разделения — расширьте боковую панель","menu.close":"Закрыть","menu.closeOthers":"Закрыть другие вкладки","menu.closeRight":"Закрыть вкладки справа","tab.guide.more":"Ещё инструменты","tab.guide.title":"Начало","tab.unavailable":"Здесь пока нечем просмотреть содержимое этого типа."},"sidebarTerminal":{"attachmentEnded":"Соединение с терминалом завершено. Переподключитесь, чтобы продолжить.","cleanupFailed":"Не удалось завершить терминал «{title}»: {message}","closed":"Терминал закрыт.","connecting":"Подключение…","control":"Взять управление","creating":"Запуск…","description":"Запуск команд в рабочей области сессии","disconnected":"Соединение разорвано.","exited":"Процесс завершился ({code})","failed":"Ошибка терминала: {message}","inputFull":"Буфер ввода заполнен. Переподключитесь и повторите попытку.","invalidOutput":"Не удалось получить экран терминала. Переподключитесь, чтобы восстановить его.","loading":"Чтение окружения терминала…","missingTerminal":"Этого терминала больше нет. Откройте новый терминал.","new":"Новый терминал","readonly":"Этот экран доступен только на чтение.","reconnect":"Переподключиться","recoveryFailed":"Не удалось восстановить терминал: {message}","rename":"Название терминала","retry":"Повторить","retryRecovery":"Повторить восстановление терминала","shell":"Выбрать оболочку","shellEmpty":"Нет доступных оболочек","shellLoading":"Загрузка оболочек…","shortcut.noSession":"Сначала выберите сессию","terminalLimit":"Достигнут предел числа терминалов. Закройте неиспользуемые терминалы и повторите попытку. Завершённые терминалы тоже учитываются.","title":"Терминал","unavailable":"Недоступно"},"skill":{"menu.userOnly":"только вручную","row.failed":"Сбой загрузки навыка","row.inspect":"Подробнее","row.instructions":"Инструкции","row.preparing":"Подготовка к загрузке навыка","row.running":"Загрузка навыка","row.stopped":"Загрузка навыка остановлена","row.title":"Навык"},"slash.menu":{"command":"Команды","crumbs.aria":"Навигация по папкам","drill.aria":"Открыть папку","drill.hint":"Открыть папку","drill.key":"Tab","loading":"Загрузка…","skill":"Навыки","subagent":"Субагенты","suggestions.aria":"Подсказки триггера"},"stats":{"bar.gap":"промежуток с предыдущего шага {value}","bar.gen":"генерация {value}","bar.rest":"прочее {value}","bar.running":"ещё не завершено: показано затраченное время","bar.start":"начало {clock}","bar.tool":"вызовы инструментов {value}","bar.ttft":"первый токен {value}","bar.wall":"всего {value}","cache.detail":"чтение кэша {read} · ввод {input} · запись кэша {write}","collapse.all":"Свернуть всё","column.cache":"Попадание в кэш","column.cache.title":"чтение кэша ÷ (ввод + чтение кэша + запись кэша): доля промпта, обслуженная из кэша","column.context":"Контекст","column.context.title":"токены ввода + чтение кэша + запись кэша","column.did":"Выполнение","column.did.title":"Инструменты, которые вызвал этот шаг, и сколько раз; шаг без вызовов показывает начало своего ответа","column.model":"Время модели","column.model.title":"от начала шага до готового ответа (включая задержку первого токена)","column.output":"Вывод","column.output.title":"токены вывода на шаге","column.prompt":"Триггер","column.prompt.title":"Что запустило этот ход: у запроса человека показывается текст, у автоматики — метка источника","column.scope":"Ход / шаг","column.scope.title":"Строка хода содержит итог хода; нажмите на строку, чтобы развернуть или свернуть шаги","column.time":"Общее время","column.time.title":"разбивка: голубым — первый токен, синим — генерация, оранжевым — вызовы инструментов, серым — остальное. Длина полосы в масштабе квадратного корня; шаги сравнимы только с шагами того же хода, ходы — с ходами","column.tool":"Время инструментов","column.tool.title":"сумма каждого вызова инструмента до его результата внутри шага; вызовы без результата не учитываются","column.tps":"Скорость вывода","column.tps.title":"токены вывода ÷ секунды генерации (TPS, ток/с)","column.ttft":"Первый токен","column.ttft.title":"от начала шага до первого фрагмента вывода (TTFT)","compaction.label":"Сжатие","compaction.running":"Сжатие…","compaction.shadowed":"Обрезан {tokens} токен истории|Обрезано {tokens} токена истории|Обрезано {tokens} токенов истории","compaction.summary":"Сводка: {chars} знак|Сводка: {chars} знака|Сводка: {chars} знаков","compaction.title":"Прогоны сжатия показываются отдельно и не входят в итоги шагов хода","context.delta.show":"Показать прирост контекста","context.delta.title":"Прирост промпта относительно предыдущего измеренного шага хода; отрицательное значение означает, что контекст уменьшился (например, после сжатия)","contextMode.cumulative":"Накопительно","contextMode.cumulative.title":"Строки хода показывают сумму размеров промпта по шагам хода (накопительная обработка); итоговая строка всегда накопительная","contextMode.label":"Основа контекста","contextMode.latest":"Последний","contextMode.latest.title":"Строки хода показывают размер промпта последнего измеренного шага (итоговый контекст); итоговая строка всегда накопительная","detail.answer":"Ответ","detail.answer.truncated":"Ответ длинный; сохранены только первые 16 000 знаков","detail.args":"исходные аргументы","detail.calls":"вызовов инструментов: {count}","detail.chars":"знаков: {chars}","detail.code.title":"Блок кода","detail.code.unwrap":"Без переноса","detail.code.wrap":"Переносить строки","detail.copied":"Скопировано","detail.copy":"Копировать","detail.copy.title":"Скопировать этот текст","detail.copyFailed":"Не удалось скопировать","detail.diff":"изменение","detail.emptyBody":"Этот вызов не оставил текста","detail.file":"файл","detail.footnotes":"Сноски","detail.hidden":"Ещё {count} вызов не показан (не более {limit} на шаг)|Ещё {count} вызова не показаны (не более {limit} на шаг)|Ещё {count} вызовов не показаны (не более {limit} на шаг)","detail.hide":"скрыть","detail.lineCap":"Показаны первые {shown} из {total} строк","detail.lines":"строк: {lines}","detail.raw.title":"Показать исходные JSON-аргументы","detail.show":"подробности","detail.title":"Нажмите на строку, чтобы развернуть или свернуть подробности вызова","detail.truncated":"Слишком длинно: сохранён только {chars} знак.|Слишком длинно: сохранены только первые {chars} знака.|Слишком длинно: сохранены только первые {chars} знаков.","detail.wrap":"Перенос","detail.wrap.title":"Переносить длинные строки вместо горизонтальной прокрутки","did.aborted":"без ответа","did.answer":"ответ","did.chars":"знаков: {chars}","did.lines":"строк: {lines}","did.lines.unit":"строк","did.more":"ещё {count}","did.output":"→ {chars} знак|→ {chars} знака|→ {chars} знаков","did.rest":"ещё вызовов: {count}","did.retry":"повторов: {count}×","did.title":"вызовов: {calls}; {tools}","did.total":"{chars} знак вывода инструментов на этом шаге; он войдёт в следующий промпт.|{chars} знака вывода инструментов на этом шаге; они войдут в следующий промпт.|{chars} знаков вывода инструментов на этом шаге; они войдут в следующий промпт.","did.working":"генерация","empty":"В текущем окне нет измеримых шагов.","event.approval":"Подтверждение","event.approval.allowed":"разрешено один раз","event.approval.asked":"ожидание","event.approval.cancelled":"отменено","event.approval.detail":"{tool} · {status}","event.approval.rejected":"отклонено","event.approval.unavailable":"недоступно","event.attempt.detail":"Попытка модели без зафиксированного сообщения","event.context-prune":"Обрезка контекста","event.context-refresh":"Обновление контекста","event.context.detail":"{provider} / {model} · режим промпта {mode}","event.header.detail":"{reason} · инструментов: {tools}","event.model-attempt":"Попытка модели","event.model-retry":"Повтор модели","event.prune.detail":"обрезан {tokens} токен|обрезано {tokens} токена|обрезано {tokens} токенов","event.reason.change":"изменение","event.reason.initial":"начало","event.reason.resume":"возобновление","event.reason.series":"новая серия","event.refresh.detail":"{source} · {chars} знак|{source} · {chars} знака|{source} · {chars} знаков","event.request-context":"Контекст запроса","event.request-header":"Заголовок запроса","event.retry.detail":"повтор {retry} · ожидание {delay}","event.series":"новая серия","event.show":"Показать строки событий (включая сжатие)","event.source.runtime":"контекст выполнения","event.source.time":"контекст времени","event.system-prompt":"Системный промпт","event.system.append":"дополнение","event.system.clear":"очистка","event.system.detail":"{action} · {chars} знак|{action} · {chars} знака|{action} · {chars} знаков","event.system.replace":"замена","event.title":"Строки событий вне шагов: запрос, промпт, набор инструментов, повторы, обновление контекста, подтверждения и обрезки — не входят в итоги шагов хода","event.tool-set":"Смена набора инструментов","event.tools.added":"добавлены: {tools}","event.tools.removed":"убраны: {tools}","expand.all":"Развернуть всё","imagePreview.alt":"Изображение {index}","imagePreview.close":"Закрыть предпросмотр изображения","imagePreview.dialog":"Предпросмотр изображения","imagePreview.failed":"Не удалось загрузить изображение","imagePreview.hint":"Наведите или сфокусируйтесь, чтобы увидеть изображения хода; нажмите, чтобы открыть целиком","imagePreview.loading":"Загрузка изображения…","imagePreview.open":"Изображение {index} из {count}","imagePreview.retry":"Повторить","loadOlder":"Загрузить более ранние","loadOlder.done":"Достигнуто начало истории","loadOlder.failed":"Не удалось загрузить, повторите","loadOlder.loading":"Загрузка более ранних ходов…","partial":"{count} вызов инструмента ещё без результата; это нижняя граница известного времени.|{count} вызова инструментов ещё без результата; это нижняя граница известного времени.|{count} вызовов инструментов ещё без результата; это нижняя граница известного времени.","state.aborted":"не завершено","state.aborted.title":"Шаг закрылся без готового ответа (обычно отменён или завершился ошибкой)","state.cacheMiss":"промах кэша","state.cacheMiss.title":"Промпт почти не попал в кэш: обычно это первый запрос после перезапуска или возобновления сессии, оплачивается по полной цене ввода","state.interrupted":"прервано","state.running":"выполняется","step.label":"Шаг {step}","step.partial":"начало неизвестно","step.partial.title":"События начала и конца этого шага не попали в текущее окно событий (обрезаны при переподключении вкладки или перестройке окна), поэтому первому токену, времени модели и общему времени не от чего отнимать начало; перезагрузка вкладки соберёт данные из полного окна","step.started.title":"Шаг начался в {time}","step.toggle.aria":"Развернуть или свернуть подробности инструментов шага {step}","steps.all":"Показать все шаги ({total})","steps.clear":"Сбросить фильтр","steps.filter":"Только {tool}","steps.matched":"{count} шаг использовал {tool}|{count} шага использовали {tool}|{count} шагов использовали {tool}","steps.tail":"только последние {limit}","steps.total":"{total} шаг|{total} шага|{total} шагов","summary":"Ходов: {turns} · шагов: {steps}","table.showTotals":"Показать итоговую строку","tool.failed":"ошибок: {count}","tool.failed.title":"{count} вызов инструмента на этом шаге вернул ошибку.|{count} вызова инструментов на этом шаге вернули ошибку.|{count} вызовов инструментов на этом шаге вернули ошибку.","totals.full":"Итог всей сессии","totals.full.title":"Итоги по всей сессии; общее время — время модели + время инструментов (без промежутков между ходами)","totals.window":"Итог окна","totals.window.title":"Итоги по ходам, загруженным в это окно; ячейка контекста накопительная по шагам","trigger.agent-message":"Сообщение агента","trigger.context":"Пробуждение контекста","trigger.cordis-host-runner":"Запуск плагина","trigger.goal":"Раунд цели","trigger.other":"Автоматический ход","trigger.schedule":"По расписанию","trigger.subagent-settled":"Субагент завершён","trigger.team-message":"Сообщение команды","trigger.tool-jobs":"Фоновая задача","trigger.webhook":"Вебхук","turn.collapse":"Скрыть","turn.expand":"Показать","turn.images":"{count} изображение|{count} изображения|{count} изображений","turn.label":"Ход {turn}","turn.started":"этот ход начался в {time}","turn.toggle.aria":"Развернуть или свернуть ход {turn}","turn.toggle.title":"Развернуть или свернуть шаги этого хода","unknown":"не записано","view.stats":"Статистика"},"subagent":{"activity.completed":"завершён","activity.inactive":"не выполняется","activity.running":"выполняется","branch.collapse":"Свернуть дочерних субагентов {label}","branch.expand":"Развернуть дочерних субагентов {label}","catalog.migrationRequired":"Требуется миграция","count.running.one":"{count} субагент выполняется","count.running.other":"{count} субагента выполняются|{count} субагентов выполняются","count.total.one":"{count} субагент","count.total.other":"{count} субагента|{count} субагентов","diagnostic.corrupt":"запись сессии повреждена","diagnostic.unavailable":"запись сессии временно недоступна","diagnostic.unsupported":"неподдерживаемая версия записи субагента","duration.days":"{days} дн","duration.daysHours":"{days} дн {hours} ч","duration.exactDays":"{days} дн {hours} ч {minutes} мин {seconds} сек","duration.exactTitle":"Общее активное время: {duration}","duration.hours":"{hours} ч {minutes} мин {seconds} сек","duration.minutes":"{minutes} мин {seconds} сек","duration.months":"~{months} мес","duration.monthsDays":"~{months} мес {days} дн","duration.seconds":"{seconds} сек","duration.years":"~{years} г","duration.yearsMonths":"~{years} г {months} мес","load.error":"Не удалось загрузить субагентов","loading.aria":"Загрузка субагентов","loading.label":"Загрузка субагентов…","mode.continuable":"с продолжением","mode.external":"Внешняя задача","mode.oneShot":"однократный","mode.unknown":"неизвестный режим","open.floatWindow":"Открыть в плавающей панели","open.sidebar":"Открыть на боковой панели","open.sidebar.aria":"Открыть {label} на боковой панели","readonly.body":"Родительская сессия не в сети; откройте её заново, чтобы продолжить отправлять сообщения.","readonly.oneShot.body":"Однократные задачи не принимают последующих сообщений; полную запись выполнения можно посмотреть здесь.","readonly.oneShot.title":"Запись однократного субагента","readonly.title":"Этот субагент пока доступен только на чтение","readonly.unknown.body":"Прочитайте дочернюю сессию, чтобы определить, можно ли её продолжить.","retry":"Повторить","sidebar.chat":"Чат","switcher.aria":"Переключить субагента: {title}","tokens.million":"{value} млн","tokens.thousand":"{value} тыс.","tokens.total":"{value} токен|{value} токена|{value} токенов","tree.aria":"Сессии субагентов"},"trajectory":{"attachment.imageName":"Изображение {index}","attachment.list":"Вложения","block.label":"Блок #{index} {type}","block.openSummary":"Открыть сводку вызовов инструментов блока #{index}","block.openSummaryTitle":"Открыть сводку вызовов инструментов","code.copyOutput":"Копировать вывод","code.copySource":"Копировать код","code.originalJson":"Исходный JSON","code.output":"Вывод","code.running":"Выполняется…","code.source":"Код","column.input":"Ввод","column.model":"Модель","column.output":"Вывод","column.think":"Рассуждения","column.time":"Время","column.tools":"Инструменты","details.assistantMessage":"Сообщение ассистента","details.close":"Закрыть подробности","details.compacted":"Сжатие контекста","details.error":"Ошибка","details.event":"Подробности события","details.failure.auth":"Ключ API недействителен","details.hierarchy":"Иерархия","details.lastAttemptError":"Ошибка последней попытки","details.model":"Модель","details.provider":"Провайдер","details.purpose":"Назначение","details.resize":"Изменить ширину подробностей","details.resizeTitle":"Перетащите, чтобы изменить ширину. Двойной щелчок сбрасывает.","details.result":"Результат","details.retry":"Повторить","details.retryDelay":"Задержка повтора","details.scheduled":"Запланировано","details.source":"Источник","details.status":"Состояние","details.subtoolCalls":"Вызовы субинструментов","details.toolCall":"Вызов инструмента","details.toolCalls":"Вызовы инструментов","group.compaction":"Сжатие контекста {seq}","group.message":"Сообщение","group.step":"Шаг {step}","history.clickToLoadEarlier":"Нажмите, чтобы загрузить более раннюю историю","history.loadEarlier":"Загрузить более раннюю историю","history.loadingEarlier":"Загрузка более ранней истории…","history.loadingEarlierAria":"Загрузка более ранней истории…","history.loadingTrajectory":"Загрузка траектории…","kind.assistant":"АССИСТЕНТ","kind.compacted":"СЖАТО","kind.context":"КОНТЕКСТ","kind.message":"Сообщение","kind.sub":"Субинструмент","kind.subtool":"СУБИНСТРУМЕНТ","kind.system":"СИСТЕМА","kind.tool":"ИНСТРУМЕНТ","kind.user":"ПОЛЬЗОВАТЕЛЬ","layout.compacted":"Контекст сжат","layout.compacting":"Сжатие контекста…","layout.compactionFailed":"Не удалось сжать контекст","layout.compactionInterrupted":"Сжатие контекста прервано до завершения.","layout.fileAttachments":"×{count} файл|×{count} файла|×{count} файлов","layout.imageCount":"×{count} изображение|×{count} изображения|×{count} изображений","layout.imageOnly":"×{count} изображение|×{count} изображения|×{count} изображений","layout.initialSystemPrompt":"Исходный системный промпт","layout.systemPromptAndToolsUpdated":"Системный промпт и инструменты обновлены","layout.systemPromptUpdated":"Системный промпт обновлён","layout.toolAdded":"Инструмент добавлен: {name}","layout.toolCallOnly":"Только вызов инструмента","layout.toolRemoved":"Инструмент удалён: {name}","layout.toolsAdded":"Добавлено: {names}","layout.toolsAddedCount":"{count} добавлен|{count} добавлено|{count} добавлено","layout.toolsChanged":"добавлено {added}, удалено {removed}","layout.toolsRemoved":"Удалено: {names}","layout.toolsRemovedCount":"{count} удалён|{count} удалено|{count} удалено","layout.toolsUpdated":"Инструменты обновлены","layout.toolUpdateNotice":"Инструменты обновлены","options.json":"JSON параметров запроса","options.notRecorded":"Параметры не записаны","record.json":"JSON","record.namedParametersJson":"JSON параметров {name}","record.noContent":"Нет содержимого","record.noOutput":"Нет вывода","record.noPayload":"Данные не записаны","record.noResult":"Результат не записан","record.outputJson":"JSON результата","record.parameters":"Параметры","record.parametersJson":"JSON параметров","record.payloadJson":"JSON данных","record.rawResult":"Необработанный результат","record.rawResultUnavailable":"Необработанный результат доступен только для активных вызовов инструментов","record.renderedResult":"Оформленный результат","record.resultJson":"JSON результата","record.schemaUnavailable":"Схема недоступна","record.systemPrompt":"Системный промпт","record.systemPromptMissing":"В этом запросе нет системного промпта","record.thinking":"Рассуждения","record.toolCallOnly":"(только вызов инструмента)","record.tools":"Инструменты","record.toolsMissing":"В этом запросе нет инструментов","record.wrapLines":"Переносить строки","request.collapsedAssistant":"ассистента","request.collapsedSummary":"Свёрнутая сводка {kind}, {summary}","request.collapsedTool":"вложенные вызовы","request.collapsedTurn":"хода","request.compaction":"Сжатие контекста · {section}","request.compactionPurpose":"Сжатие контекста","request.label":"Запрос #{request}","request.labelCompaction":"Запрос #{request} · Сжатие контекста","request.noContent":"нет содержимого","request.retryProgress":"{retry} из {maximum}","request.rowAria":"{request}{kind} — {content}","request.rowAriaCompaction":"Запрос {request}, сжатие контекста","request.rowPrefix":"Запрос {request}, ","section.betweenTurns":"Между ходами","source.goal":"Цель","source.goalRound":"Цель · цикл {round}","source.messageJson":"JSON источника сообщения","source.notRecorded":"Источник не записан","source.plugin":"Плагин","source.pluginNamed":"Плагин · {plugin}","source.unknown":"Неизвестно","source.user":"Пользователь","status.completed":"Завершено","status.failed":"Сбой","status.pending":"Ожидает","summary.steps.one":"{count} шаг","summary.steps.other":"{count} шага|{count} шагов","summary.toolCalls.one":"{count} вызов инструмента","summary.toolCalls.other":"{count} вызова инструмента|{count} вызовов инструмента","tab.diff":"Изменения","tab.options":"Параметры","tab.payload":"Данные","tab.preview":"Предпросмотр","tab.raw":"Исходный текст","tab.rawOutput":"Исходный вывод","tab.result":"Результат","tab.schema":"Схема","tab.source":"Источник","tab.summary":"Сводка","tab.systemPrompt":"Системный промпт","tab.timing":"Время","tab.tools":"Инструменты","tab.usage":"Расход","timeline.aria":"Временная шкала траектории","timeline.noTimingData":"Нет данных о времени","timeline.overviewAria":"Общий вид временной шкалы; потяните по горизонтали, чтобы сфокусироваться на событиях","timeline.started":"Начало {time}","timeline.total":"Всего {duration}","timeline.ttftDecoding":"TTFT {ttft} · Декодирование {decoding}","timing.duration":"Длительность","timing.durationTooShort":"Длительность слишком мала","timing.firstTokenUnavailable":"Время до первого токена недоступно","timing.generation":"Генерация","timing.notAvailable":"Недоступно","timing.notRecorded":"Не записано","timing.outputTokensUnavailable":"Выходные токены недоступны","timing.request":"Время запроса","timing.sessionTimestamps":"Метки времени сессии","timing.sessionTimestampsRunning":"Метки времени сессии (выполняется)","timing.showLocalTime":"Показывать местное время","timing.showUnixTimestamp":"Показывать метку времени Unix","timing.source":"Источник времени","timing.started":"Начало","timing.stepStartUnavailable":"Время начала шага недоступно","timing.throughput":"Пропускная способность","timing.totalDuration":"Общая длительность","timing.ttft":"TTFT","timing.usageUnavailable":"Расход недоступен","toolbar.actualTime":"Фактическое время","toolbar.aria":"Панель инструментов траектории","toolbar.calls":"Вызовы","toolbar.collapseCalls":"Свернуть вызовы","toolbar.collapseSubCalls":"Свернуть вложенные вызовы","toolbar.collapseTurns":"Свернуть ходы","toolbar.duration":"Длительность","toolbar.expandCalls":"Развернуть вызовы","toolbar.expandSubCalls":"Развернуть вложенные вызовы","toolbar.expandTurns":"Развернуть ходы","toolbar.search":"Поиск по траектории","toolbar.searchPlaceholder":"Поиск","toolbar.subCalls":"Вложенные вызовы","toolbar.turns":"Ходы","toolbar.useActualDuration":"Использовать фактическую длительность","toolbar.useEqualWidth":"Использовать одинаковую ширину операций","turn.label":"Ход {turn}","unit.milliseconds":"{value} мс","unit.seconds":"{value} с","unit.tokens":"{value} токен|{value} токена|{value} токенов","unit.tokensPerSecond":"{value} токен/с|{value} токена/с|{value} токенов/с","usage.cacheCreated":"Запись в кэш","usage.cached":"Чтение из кэша","usage.content":"Содержимое","usage.input":"Ввод","usage.notReported":"Расход не указан","usage.other":"Прочее","usage.output":"Вывод","usage.reasoning":"Рассуждения","usage.sessionCumulative":"Итого за сессию","usage.thisRequest":"Этот запрос","usage.tokens":"Токены","view.trajectory":"Траектория"},"voice-input":{"auto":"Автоопределение","cancel":"Отмена","cancelled":"Голосовой ввод отменён.","cancelPrepare":"Отменить подготовку","cloud":"Аудио будет отправлено в выбранный облачный сервис.","cloudReady":"Облачное распознавание речи готово.","conflict":"Черновик изменился. Распознанный текст сохранён, его можно вставить в текущую позицию курсора.","de":"Немецкий","deviceMissing":"Микрофон недоступен. Выберите другое устройство ввода.","deviceUnavailable":"Недоступно","dictate":"Диктовать","discard":"Удалить распознанный текст","download.certificate":"Не удалось скачать {resource}: не прошла проверка сертификата.","download.dns":"Не удалось скачать {resource}: не удалось разрешить адрес загрузки.","download.http":"Не удалось скачать {resource}: сервис загрузки вернул HTTP {status}.","download.integrity":"Загрузка {resource} неполная или не прошла проверку.","download.network":"Не удалось скачать {resource}: не удалось подключиться к сервису загрузки.","download.storage":"Не удалось сохранить {resource}: не хватает места на диске или нет разрешения на запись.","download.timeout":"Время загрузки {resource} истекло.","download.unknown":"Не удалось подготовить {resource}.","downloadAdvice.certificate":"Проверьте системное время, доверенные сертификаты и настройки прокси на машине, где запущен DSH, и повторите.","downloadAdvice.dns":"Проверьте настройки DNS и прокси на машине, где запущен DSH. Убедитесь, что домен источника загрузки разрешается, и повторите.","downloadAdvice.http":"Убедитесь, что адрес загрузки доступен и прокси может подключиться к сервису загрузки, или повторите позже.","downloadAdvice.integrity":"Повторите загрузку. Остальные завершённые и проверенные файлы сохранятся.","downloadAdvice.network":"Проверьте, что машина, где запущен DSH, имеет доступ к источнику загрузки и его сервисам загрузки моделей. При необходимости настройте прокси на этой машине и повторите.","downloadAdvice.storage":"Проверьте свободное место на диске и разрешение на запись в каталог моделей на машине, где запущен DSH, и повторите.","downloadAdvice.timeout":"Проверьте сетевое соединение или соединение через прокси на машине, где запущен DSH, и повторите позже. Скачанные и проверенные файлы сохранятся.","downloadAdvice.unknown":"Проверьте сеть, место на диске и разрешения для каталога моделей на машине, где запущен DSH, и повторите.","downloadBytes":"Загрузка: {completed} / {total} МБ, {percent}%","downloadCode":"Код ошибки: {code}","downloadProgress":"Ход загрузки","downloadSource":"Источник загрузки: {source}","downloadUnknown":"Скачано {completed} МБ","elapsed":"Ожидание {seconds} сек","empty":"Речь не распознана","en":"Английский","es":"Испанский","failed":"Сбой распознавания речи: {message}","fr":"Французский","inputDevice":"Устройство ввода","inputLevel":"Уровень сигнала микрофона","insert":"Вставить текст","interrupted":"Запись прервана. Повторите попытку.","ja":"Японский","ko":"Корейский","language":"Язык распознавания","loading":"Загрузка сервисов распознавания…","local":"Аудио распознаётся на машине, где запущен DSH. Если модели нужно скачать, эта машина должна иметь доступ к выбранному источнику и его файловым сервисам. При необходимости настройте прокси на этой машине.","permission":"Доступ к микрофону выключен. Разрешите его в настройках браузера и системы.","preparation.cancelled":"Подготовка отменена. Завершённые загрузки сохранятся.","preparation.cancelling":"Отмена подготовки…","preparation.checking":"Проверка локальных ресурсов…","preparation.loading":"Загрузка {name}…","preparation.ready":"Локальное распознавание речи готово.","preparation.standby":"Локальные ресурсы подготовлены. Запись пробуждает распознавание.","preparation.unprepared":"При первом использовании скачиваются локальные модели распознавания.","preparation.waking":"Пробуждение локального распознавания речи…","preparationFailed":"Сбой подготовки: {message}","preparationSteps":"Шаги подготовки","prepare":"Скачать и подготовить","provider":"Сервис распознавания","pt":"Португальский","reconnecting":"Подключение к сервису распознавания речи…","recording":"Запись…","requesting":"Разрешите доступ к микрофону, чтобы продолжить…","retryPrepare":"Повторить подготовку","retryRecording":"Записать снова","ru":"Русский","setup.disk":"Место на диске","setup.diskValue":"Заложите около {gb} ГБ на модели, среду выполнения и кэши загрузок","setup.estimateNote":"Значения ориентировочные; при медленной сети может занять больше времени. Загрузки используются повторно; неактивные модели по умолчанию освобождают память.","setup.local":"Локальные модели будут скачаны на машину, где запущен DSH. Python или компилятор не требуются.","setup.memory":"Память","setup.memoryValue":"Около {gb} ГБ с загруженной моделью; при распознавании может потребоваться больше","setup.time":"Первая настройка","setup.timeValue":"Заложите примерно {min}–{max} мин в зависимости от сети и машины","setupPrompt.body":"Голосовой ввод включён. При первом использовании нужно скачать и подготовить локальные модели распознавания. Откройте сведения о плагине, чтобы оценить место на диске, память и время, прежде чем начинать настройку.","setupPrompt.details":"Открыть настройки плагина голосового ввода","setupPrompt.later":"Позже","setupPrompt.open":"Перейти к настройке","setupPrompt.title":"Настройте голосовой ввод перед записью","setupPrompt.trigger":"Открыть настройку голосового ввода","setupPrompt.unavailableBody":"Откройте сведения о плагине голосового ввода, чтобы проверить состояние распознавания, ход подготовки или ошибки.","setupPrompt.unavailableTitle":"Распознавание речи не готово","short.downloading":"Загрузка","short.failed":"Сбой настройки","sourceAuto":"Автоматически (рекомендуется)","sourceAutoHelp":"Сначала используется первый ответивший источник, при сбое загрузки — другой.","sourceChoice":"Источник загрузки моделей","sourceHuggingFace":"Hugging Face","sourceManualHelp":"Скачивание только из выбранного источника. Скачанные и проверенные файлы используются повторно.","sourceMirror":"HF-Mirror (зеркало в Китае)","start":"Начать запись","step.check":"Проверка локальных ресурсов","step.load":"Загрузка {name}","step.model":"Подготовка модели распознавания","step.vad":"Подготовка модели определения голоса","step.verify":"Проверка файлов модели","stepStatus.cancelled":"Отменено","stepStatus.complete":"Завершено","stepStatus.failed":"Сбой","stepStatus.pending":"Не начато","stepStatus.running":"В работе","stop":"Остановить и распознать","systemMicrophone":"По умолчанию","systemMicrophoneNamed":"По умолчанию ({name})","tooLarge":"Запись превышает ограничение сервиса. Попробуйте записать короче.","transcribingShort":"Распознавание…","unavailable":"Этот браузер не может записывать звук. Используйте браузер с поддержкой микрофона.","unnamedMicrophone":"Микрофон {number}","unnamedSelectedMicrophone":"Микрофон","wakingShort":"Пробуждение…","yue":"Кантонский","zh":"Китайский"},"workflowRun":{"member.empty":"Пустое имя участника","member.open":"Открыть {name}","phase.empty":"Пустое имя фазы","phase.unassigned":"Без фазы","run.empty":"Участники не запущены","run.members.one":"{count} участник","run.members.other":"{count} участника|{count} участников","run.title":"{name}","status.cancelled":"Отменено","status.completed":"Завершено","status.failed":"Сбой","status.interrupted":"Прервано","status.running":"Выполняется","statusCount.cancelled":"{count} отменён|{count} отменено|{count} отменено","statusCount.completed":"{count} завершён|{count} завершено|{count} завершено","statusCount.failed":"{count} сбой|{count} сбоя|{count} сбоев","statusCount.interrupted":"{count} прерван|{count} прервано|{count} прервано","statusCount.running":"{count} выполняется|{count} выполняются|{count} выполняются"},"workspace":{"actions.archive":"Архивировать","actions.newSession":"Новая сессия","actions.newSession.aria":"Новая сессия в «{name}»","actions.pin":"Закрепить","actions.session.aria":"Действия с сессией «{name}»","actions.unarchive":"Разархивировать","actions.unpin":"Открепить","actions.workspace.aria":"Действия с рабочей областью «{name}»","archive.confirm.action":"Остановить и архивировать","archive.confirm.activity":"Работа, которая будет остановлена","archive.confirm.desc":"В сессии «{title}» ещё есть незавершённая работа. При архивации она сначала останавливается; сессию можно будет восстановить через фильтр «Все диалоги (показывать архивные)» в боковой панели, а остановленная работа не возобновится сама.","archive.confirm.jobs.one":"{n} фоновая задача: {names}","archive.confirm.jobs.other":"{n} фоновые задачи: {names}|{n} фоновых задач: {names}","archive.confirm.listSeparator":", ","archive.confirm.other.one":"{n} другая работа ({kind})","archive.confirm.other.other":"{n} другие работы ({kind})|{n} других работ ({kind})","archive.confirm.pending":"Остановка и архивация…","archive.confirm.schedules.one":"{n} напоминание по расписанию: {names}","archive.confirm.schedules.other":"{n} напоминания по расписанию: {names}|{n} напоминаний по расписанию: {names}","archive.confirm.subagents.one":"{n} работающий субагент: {names}","archive.confirm.subagents.other":"{n} работающих субагента: {names}|{n} работающих субагентов: {names}","archive.confirm.title":"Остановить и архивировать эту сессию?","archive.confirm.turn":"Текущий ход","conflict.named":"Рабочая область с именем «{name}» уже существует.","date.ymd":"{d}.{m}.{y}","defaultWorkspace.failed":"Не удалось создать рабочую область по умолчанию. Выберите папку через «Выбрать рабочую область».","delete.desc":"Удаляет «{name}» из списка рабочих областей. Папка и журналы сессий сохранятся, а её сессии появятся в разделе «Без группы».","delete.pending":"Удаление рабочей области…","delete.workspace":"Удалить рабочую область","draft.initializationFailed":"Не удалось заполнить черновик. Повторите попытку чуть позже.","draft.workspaceRequired":"Сначала выберите рабочую область.","empty.noMatches":"Нет совпадений","empty.none":"Сессий пока нет","empty.noneArchived":"Архивных сессий пока нет","empty.viewOthers":"Посмотреть другие сессии","field.sessionName":"Имя сессии","field.workspaceName":"Имя рабочей области","filterBy.label":"Фильтр сессий","folderError.retry":"Выбрать снова","folderError.title":"Не удалось открыть папку","group.ungrouped":"Без группы","groupBy.flat":"Одним списком","groupBy.label":"Группировка","groupBy.workspace":"Рабочая область","groupBy.workspaceTree":"Дерево рабочих областей","hover.copied":"Скопировано","hover.created":"Создано {time}","menu.addWorkspace":"Добавить рабочую область…","menu.archiveSession":"Архивировать сессию","menu.fork":"Ответвить сессию","menu.pinSession":"Закрепить сессию","menu.sessionId":"Копировать Session ID","menu.unarchiveSession":"Разархивировать сессию","menu.unpinSession":"Открепить сессию","orderBy.label":"Сортировка","orderBy.manual":"Вручную","orderBy.updated":"Последнее обновление","picker.loading":"Загрузка рабочих областей…","rename":"Переименовать","rename.session.title":"Переименовать сессию","rename.workspace.title":"Переименовать рабочую область","row.archived":"В архиве","row.pinned":"Закреплена","schedule.active":"Есть активная задача по расписанию","search.clear":"Очистить поиск","search.hasMore":"Показано только {n} результат. Уточните запрос.|Показано только {n} результата. Уточните запрос.|Показано только {n} результатов. Уточните запрос.","search.noMatches":"Нет подходящих сессий","search.pending":"Поиск по истории сессий…","search.placeholder":"Поиск по названиям сессий","search.results.aria":"Результаты поиска","search.sessions.aria":"Поиск сессий","search.unavailable":"Поиск по содержимому временно недоступен. Показаны совпадения по названию.","section.sessions":"Сессии","section.workspaces":"Рабочие области","session.new":"Новая сессия","session.untitled":"Без названия","sessions.collapse":"Свернуть","sessions.count.one":"{n} сессия","sessions.count.other":"{n} сессии|{n} сессий","sessions.expand":"Показать ещё {n} сессию|Показать ещё {n} сессии|Показать ещё {n} сессий","shortcut.directoryBusy":"Идёт выбор или добавление рабочей области","shortcut.forkFailed":"Не удалось ответвить сессию. Повторите попытку.","shortcut.noCompletedTurn":"В этой сессии нет завершённых ходов","shortcut.noPicker":"Выбор каталога недоступен","shortcut.noSession":"Сначала выберите сессию","status.compact.answer":"Ответ","status.compact.approval":"Подтверждение","status.compact.planReview":"Проверка плана","status.completed":"Завершено","status.idle":"Простой","status.planReview":"План на проверке","status.running":"Выполняется","status.subagentsRunning.one":"{n} субагент работает","status.subagentsRunning.other":"{n} субагента работают|{n} субагентов работают","status.waitingAnswer":"Ожидает ответа","status.waitingApproval":"Ожидает подтверждения","time.ago":"{t} назад","time.days":"{n} день|{n} дня|{n} дней","time.hours":"{n} час|{n} часа|{n} часов","time.minutes":"{n} минута|{n} минуты|{n} минут","time.months":"{n} месяц|{n} месяца|{n} месяцев","time.now":"сейчас","time.years":"{n} год|{n} года|{n} лет","toast.archived":"Сессия в архиве. Можно ","toast.archivedFilter":"отфильтровать архивные сессии","toast.archivedNotOpenable":"Архивные сессии нельзя открыть. Чтобы посмотреть, разархивируйте их.","toast.archivedOr":" или ","toast.archivedUndo":"Отменить","toast.createFailed":"Не удалось создать сессию: {message}","toast.forkRequiresOpen":"Откройте исходную сессию, чтобы завершить миграцию, прежде чем создавать ветку.","toast.openForkSource":"Открыть исходную сессию","toast.pinFailed":"Не удалось закрепить. Повторите попытку позже.","toast.sessionIdCopied":"Session ID скопирован","toast.sessionIdCopyFailed":"Не удалось скопировать. Повторите.","toast.stoppedAndArchived":"Сессия остановлена и архивирована. Можно ","toast.unpinFailed":"Не удалось открепить. Повторите попытку позже.","viewOptions.hideArchived":"Скрыть архивные","viewOptions.label":"Параметры вида","viewOptions.onlyArchived":"Только архивные","viewOptions.showArchived":"Все диалоги (показывать архивные)","workspace.add":"Добавить рабочую область"}};

		/**
		 * Plugin display metadata: package descriptions and human titles keyed by
		 * their English text. The Host builds those values from each package.json
		 * and hands them to the browser as LocalizedText, so official packages
		 * arrive English-only; installPluginText resolves them for Russian.
		 */
		const PLUGIN_TEXT = {"A collection of common utilities":"Набор общих утилит","Abstract bash executor seam (ctx.shell) for the DeepSeek Harness":"Внутренний интерфейс выполнения команд bash (ctx.shell)","Abstract compaction service seam (ctx.compaction) for the DeepSeek Harness":"Внутренний интерфейс сжатия контекста (ctx.compaction)","Abstract credential seam (ctx.credentials): settings carry references to secrets, providers own the values":"Внутренний интерфейс учётных данных (ctx.credentials): настройки хранят ссылки на секреты, а значения — у провайдеров","Abstract durable session persistence seam (ctx.sessionPersistence) for the DeepSeek Harness":"Внутренний интерфейс хранения сессий (ctx.sessionPersistence)","Abstract filesystem capability seam (ctx.fs) for the DeepSeek Harness — vocabulary types, the FileSystem service (text IO + optional version-guarded atomic mutations), and the fs/* policy event vocabulary":"Внутренний интерфейс файловой системы (ctx.fs): типы, сервис FileSystem (чтение и запись плюс атомарные изменения с проверкой версии) и события политики fs/*","Abstract LSP capability seam (ctx.lsp) for the DeepSeek Harness — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy":"Внутренний интерфейс LSP (ctx.lsp): реестр языковых серверов по id и расширениям, выбор провайдера для каждого запроса, нормализованные запросы и ответы (определение, ссылки, реализации, подсказки) и ошибки LspError","Abstract process-sandbox seam (ctx.sandbox) for the DeepSeek Harness: same-world confinement vocabulary and the SandboxProvider contract":"Внутренний интерфейс песочницы процессов (ctx.sandbox): ограничения и контракт SandboxProvider","Abstract PTC execution seam (ctx.ptcRuntime) for the DeepSeek Harness":"Внутренний интерфейс выполнения PTC (ctx.ptcRuntime)","Abstract spill storage seam (ctx.spillStore) for the DeepSeek Harness — save oversized tool text and return a retrieval locator":"Внутренний интерфейс хранилища больших выводов (ctx.spillStore): сохраняет слишком длинный текст инструмента и возвращает ссылку на него","Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents":"Внутренний интерфейс субагентов (ctx.subagents): реестр провайдеров для делегирования дочерним агентам","Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs":"Внутренний интерфейс вопросов пользователю (ctx.userQuestions): агент спрашивает человека во время работы","Abstract user-settings seam (ctx.settings) for the DeepSeek Harness":"Внутренний интерфейс пользовательских настроек (ctx.settings)","Abstract web access capability seam (ctx.web) for the DeepSeek Harness — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy":"Внутренний интерфейс веб-доступа (ctx.web): реестр провайдеров поиска и загрузки, выбор провайдера, типы запросов и ответов и ошибки WebError","Abstract workspace-directory picking seam (ctx.directoryPicker) for the DeepSeek Harness web GUI host":"Внутренний интерфейс выбора каталога (ctx.directoryPicker) для веб-интерфейса","Access files through the local filesystem.":"Доступ к файлам через локальную файловую систему.","ACP profile":"Профиль ACP","ACP server":"Сервер ACP","Action card display":"Показ карточек действий","Action cards":"Карточки действий","Active Loader-backed plugin package inventory for official DeepSeek LLM API requests":"Состав активных пакетов плагинов для официальных запросов к DeepSeek LLM API","Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the DeepSeek Harness web GUI host":"Выбор реализации выбора каталога: при запуске определяет окружение и подключает системный или встроенный просмотр файлов","Add an Auto review permission mode that uses the model to assess authorization before each tool call.":"Добавляет режим разрешений «Автопроверка»: модель проверяет авторизацию перед каждым вызовом инструмента.","Additive request-field registry for the official DeepSeek LLM API adapter":"Реестр дополнительных полей запроса для официального адаптера DeepSeek LLM API","Adds a Discover tab to Plugins for browsing and installing bundles from plugin market indexes you add":"Добавляет в «Плагины» вкладку «Обзор»: можно просматривать и ставить наборы из добавленных индексов рынка плагинов","Adds a Discover tab to Plugins, where you browse and install plugins from plugin indexes you add.":"Добавляет в «Плагины» вкладку «Обзор», где можно просматривать и устанавливать плагины из добавленных вами индексов.","Adds an Auto review access mode: before each tool call, a model checks it against what you asked for, runs allowed calls at once, and holds denied calls for your approval.":"Добавляет режим доступа «Автопроверка»: перед каждым вызовом инструмента модель сверяет его с вашей задачей, разрешённые вызовы выполняет сразу, а отклонённые придерживает до вашего подтверждения.","Agent interface, registry, initiator scope, and event vocabulary for the DeepSeek Harness":"Интерфейс агента, реестр, область инициатора и события","Agent skill provider registry for the DeepSeek Harness":"Реестр провайдеров навыков агента","Agent teams":"Команды агентов","Agent Teams":"Команды агентов","Agent Teams collaboration, tools, and Web UI in one experimental bundle":"Совместная работа Agent Teams, инструменты и веб-интерфейс в одном экспериментальном наборе","Agent-plane presentation selector: composes one agent's tools as PTC mode or native tool calls":"Представление инструментов агента: режим PTC (программные вызовы) или обычные вызовы инструментов","Agent-plane presentation selector: composes one agent's tools as PTC mode, native, or both":"Селектор представления на уровне агента: собирает инструменты агента в режиме PTC, в нативном виде или в обоих","Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor":"Настройки пресета агента: значение по умолчанию для новых сессий, место текущей сессии и редактор состава","Agent-scoped browser file upload, streaming intake, and staged receipt service":"Загрузка файлов из браузера, потоковый приём и получение результатов для агента","All-message session titles":"Названия сессий по всем сообщениям","All-user-messages LLM provider plugin for DeepSeek Harness session titles":"Провайдер LLM для заголовков сессий по всем сообщениям пользователя","Anonymous HTTP(S) fetch provider for the DeepSeek Harness web capability seam (ctx.web)":"Анонимный HTTP(S)-провайдер загрузки для веб-возможностей DeepSeek Harness (ctx.web)","Anonymous public HTTP(S) fetch provider for the DeepSeek Harness web capability seam (ctx.web)":"Провайдер анонимной загрузки HTTP(S) для веб-доступа","Application keyboard command registry and physical-key routing":"Реестр клавиатурных команд приложения и маршрутизация клавиш","Approval composer takeover over the scoped Remote Event waterfall":"Перехват поля ввода подтверждения в цепочке удалённых событий","Ask about earlier work, such as “How did we fix the pool leak last week?”, and the agent searches your earlier sessions in the same workspace to answer.":"Спросите о прошлой работе — например, «Как мы исправили утечку пула на прошлой неделе?» — и агент найдёт ответ в ваших прежних сессиях той же рабочей области.","Ask for a Ralph loop with a goal, and the agent starts a fresh agent on it round after round until the goal is met, a blocker is reported, or the round limit is reached.":"Попросите цикл Ralph с целью — и агент будет запускать нового агента раунд за раундом, пока цель не будет достигнута, не сообщит о блокере или не исчерпает лимит раундов.","Ask for work on a new branch, and the agent creates a separate Git worktree and continues there, leaving your current checkout as it is.":"Попросите работу в новой ветке — и агент создаст отдельное рабочее дерево Git и продолжит там, не трогая вашу текущую копию.","Authenticated experimental speech transcription for browser clients":"Аутентифицированная экспериментальная расшифровка речи для браузерных клиентов","Authenticated RPC transport and generation lifecycle":"Транспорт RPC с аутентификацией и жизненный цикл генерации","Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human":"Интерфейс авторизации (ctx.authorization): сценарии плагинов, которые получают учётные данные в диалоге с человеком","Authorize DeepSeek accounts through browser PKCE":"Вход в учётную запись DeepSeek через браузер (PKCE)","Auto authorization review":"Автоматическая проверка разрешений","Auto Authorization Review":"Автопроверка авторизации","Automation tasks":"Автоматические задачи","Automation-only Agent Client Protocol server for driving DeepSeek Harness agents over JSON-RPC stdio":"Сервер Agent Client Protocol для автоматизации: управляет агентами через JSON-RPC stdio","Background job registry (ctx.jobs) for the DeepSeek Harness — shared ids, owner isolation, polling, cancellation, and completion listeners for long-running tool work":"Реестр фоновых задач (ctx.jobs): общие id, изоляция владельцев, опрос, отмена и уведомления о завершении","Bind change requests to the Session that created, pushed, or tracked them, and watch their status.":"Привязывает запросы изменения к сессии, которая их создала, отправила или отслеживала, и следит за их состоянием.","Bridge plugin: run a Claude Code hooks.json / settings hook config on the DeepSeek Harness interception seams":"Мост для хуков Claude Code: запускает hooks.json и настройки хуков на точках перехвата DeepSeek Harness","Bridge plugin: run a Codex hooks.json hook config on the DeepSeek Harness interception seams":"Мост для хуков Codex: запускает hooks.json на точках перехвата DeepSeek Harness","Browse configured plugin indexes and install their packages.":"Просмотр настроенных индексов плагинов и установка их пакетов.","Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries":"Браузерная часть динамических плагинов: подписка на события, вычисление замыканий, защитный слой и записи загрузчика","Browser test runtimes: a jsdom slot bench with test-owned Session and Workspace doubles, and a whole-client tier that boots the web roster through the production bootClient over an endpoint-named Remote mock":"Среды для браузерных тестов: стенд jsdom с тестовыми Session и Workspace и уровень целого клиента, поднимающий веб-состав через боевой bootClient поверх Remote-мока","Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root":"Отрисовка браузерного интерфейса: привязки слотов React, ctx.uiRenderer и корень приложения","Browser Use (Chrome DevTools)":"Работа с браузером (Chrome DevTools)","Browser Use (Playwright)":"Работа с браузером (Playwright)","Browser-only harness runtime: in-memory VFS, module transform and loader, postMessage tunnel, and the dedicated Web Worker assembly, with the Node-compatibility layer that lets the host tree run unchanged":"Браузерная среда Harness: виртуальная файловая система в памяти, преобразование и загрузка модулей, туннель postMessage, Web Worker и слой совместимости с Node","Browser-safe Workspace path and display helpers":"Пути и отображение рабочей области, безопасные для браузера","Build-static first-party Session format codec and migration catalog":"Кодек формата сессий и каталог миграций","Build-time packer for the browser runtime's base VFS image and ordered data-overlay archives":"Сборка образа виртуальной файловой системы и архивов данных для браузерной среды","Built-in plugins settings section for the dsh web client: the Settings navigation entry and the tab chrome feature-owned tabs register into":"Раздел настроек встроенных плагинов в веб-клиенте: пункт в навигации настроек и вкладки плагинов","Bundled dsh badge skill provider for DeepSeek Harness":"Встроенный провайдер навыка бейджа dsh для DeepSeek Harness","Bundled Word, PowerPoint, and Excel workflows and LibreOffice Kit operations":"Работа с Word, PowerPoint и Excel и операции LibreOffice Kit","Bundled Word, PowerPoint, and Excel workflows and structural checks":"Встроенные рабочие процессы и структурные проверки для Word, PowerPoint и Excel","Caller-relative, success-cached lazy loading for CommonJS-compatible Host dependencies":"Ленивая загрузка зависимостей Host с кэшированием успешных результатов","Canonical Session-log ratings and notes for finalized assistant messages":"Оценки и заметки к ответам ассистента в журнале сессий","Change request panel":"Панель запросов изменения","Change requests":"Запросы изменения","Change requests & worktrees":"Запросы изменения и рабочие деревья","Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web":"Карточка изменённых файлов: сравнение по файлам, карточки поставки и ссылки на файлы в финальном ответе","Chat Conversation target, node definitions, renderers, and details surface":"Цель разговора, узлы, отрисовка и панель подробностей","Claude Code subagent":"Субагент Claude Code","Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry":"Команды клиента: кэш каталогов, источник «/», три вида интерфейса команд и реестр popupSelect","Client module system, dual-face: node half composes the __DSH_BOOT__ entry graph (incremental dsh.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam":"Модульная система клиента: узловая половина собирает граф загрузки __DSH_BOOT__ (сканирование dsh.client, маршрут бандла, индекс, сервис webPlugins), браузерная — таблицу модулей для загрузчика cordis","Client Tool call-tree renderer and keyed per-tool presentation slot":"Отрисовка дерева вызовов инструментов и слоты представления по каждому инструменту","Codex subagent":"Субагент Codex","Combined session query service contract with concrete reads, traces, and filters":"Контракт службы запросов к сессиям: чтение, трассировка и фильтры","Compiler-independent Remote metadata and Typert provider protocols":"Независимые от компилятора протоколы метаданных Remote и провайдеров Typert","Composition-authored deployment persona section for the DeepSeek Harness":"Раздел о роли агента (персона), который задаётся конфигурацией","Computer provider registry":"Реестр провайдеров компьютера","Computer use":"Управление компьютером","Computer Use (Cua Driver MCP)":"Работа с компьютером (Cua Driver MCP)","Computer Use (Cua Driver)":"Работа с компьютером (Cua Driver)","Computer Use service":"Сервис управления компьютером","Concrete ctx.sessionQuery backend with SQLite FTS5 search":"Бэкенд запросов к сессиям с поиском SQLite FTS5","Configured plugin market indexes for the Web Discover page and the plugin_market agent tool":"Индексы рынка плагинов для страницы «Обзор» и инструмента plugin_market","Connect to MCP servers and make their tools available in Harness.":"Подключение к серверам MCP и доступ к их инструментам из Harness.","Console logger exporter for cordis":"Экспорт журналов в консоль для cordis","Context menus":"Контекстные меню","Control which methods non-owner connections can access and retain permission snapshots for each connection.":"Управляет доступом сторонних подключений к методам и сохраняет снимки разрешений для каждого подключения.","Conversation-following titles":"Заголовки по ходу диалога","Convert, recalculate, and render Office documents with prebuilt LibreOffice":"Конвертация, пересчёт и отрисовка документов Office на предустановленном LibreOffice","Coordinated module and profile configuration hot reload":"Согласованная горячая перезагрузка модулей и конфигурации профиля","Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch":"Карточка динамического плагина cordis: строка инструмента cordis_define с кнопкой запуска и остановки","Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels":"Служба cordis для независимых каналов OTLP: обычные события и журналы сессий с ограничением размера","CPython subprocess implementation of the DeepSeek Harness PTC execution seam":"Запуск PTC через подпроцесс CPython","Create named Git worktrees and change the current session's working directory.":"Создание именованных рабочих деревьев Git и смена рабочего каталога текущей сессии.","Create, view, update, and delete automated tasks.":"Создание, просмотр, изменение и удаление автоматических задач.","Creates a named Git worktree and changes the calling Session working directory":"Создаёт именованное рабочее дерево Git и переключает туда рабочую сессию","Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver)":"Ссылки на снимки других сессий и долговременный контекст модели (ctx.sessionReferenceResolver)","Current-profile plugin and bundle management shared by dsh CLI, Web and agent tools":"Управление плагинами и наборами текущего профиля: общее для CLI, веба и инструментов агента","Currently supports macOS; Windows support is in development. Loads computer use for existing and new PTC sessions. Switch to PTC mode and grant Accessibility and Screen Recording permissions to use it.":"Сейчас поддерживается macOS; поддержка Windows в разработке. Подключает управление компьютером для существующих и новых сессий PTC. Чтобы им пользоваться, переключитесь в режим PTC и предоставьте разрешения «Универсальный доступ» и «Запись экрана».","Custom plugin indexes":"Свои индексы плагинов","Custom plugin markets":"Пользовательские рынки плагинов","Customize plugin entries in the left sidebar, conversation views, and right sidebar, and quickly create new plugins.":"Настройка пунктов плагинов в левой панели, разговоре и правой панели, а также быстрое создание новых плагинов.","Declarative Agent preset registry and profile-backed editing":"Реестр пресетов агента и их редактирование в профиле","Declare an Agent capability composition in Cordis YAML":"Описание состава возможностей агента в Cordis YAML","DeepSeek account provider authentication and discovery":"Аутентификация и обнаружение учётной записи DeepSeek","DeepSeek api-key provider authentication and discovery":"Аутентификация и обнаружение провайдера по API-ключу DeepSeek","DeepSeek Messages adapter":"Адаптер DeepSeek Messages","DeepSeek Search and Fetch API providers for the DeepSeek Harness web capability seam (ctx.web)":"Провайдеры DeepSeek Search и Fetch для веб-доступа","DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the DeepSeek Harness web capability seam (ctx.web)":"Поисковый провайдер на базе DeepSeek (web_search через API, совместимый с Anthropic)","Default model selection shared by Agent entry points":"Выбор модели по умолчанию для точек входа агента","Delegate one task to Claude Code using its native authentication and settings.":"Делегирует одну задачу Claude Code с его собственными настройками и авторизацией.","Delegate one task to Codex using its native authentication and settings.":"Делегирует одну задачу Codex с его собственными настройками и авторизацией.","Deliverable file references":"Ссылки на файлы-результаты","Deprecated tool presentation selector; use dsh-tool-executor-native or dsh-tool-executor-ptc directly":"Устаревший выбор представления инструментов; используйте dsh-tool-executor-native или dsh-tool-executor-ptc напрямую","Desktop product event collection and authenticated Host reporting":"Сбор событий продукта и отправка на хост с аутентификацией","Developer tools":"Инструменты разработчика","Developer Tools":"Инструменты разработчика","Discover tab of the dsh web Plugins page: browse configured plugin market indexes and install their bundles":"Вкладка «Обзор» в «Плагинах»: просмотр индексов рынка и установка наборов","Display expanded reasoning in another language using machine translation.":"Показ развёрнутых рассуждений на другом языке с помощью машинного перевода.","Docking layout kit: split-tree engine with invertible operations, and the React components that render and drive it (zero cordis)":"Набор для компоновки панелей: движок дерева разбиений с обратимыми операциями и компоненты React","Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the DeepSeek Harness":"Доменные данные (ctx.storage.domain): KV-домены с валидацией схемы и событиями поверх хранилища","Drag original files into the composer or other applications, with localized failure feedback.":"Перетаскивание исходных файлов в поле ввода и другие приложения с понятными сообщениями об ошибках.","DSH":"DSH","DSH badge skill":"Навык значка DSH","dsh CLI: profile launch, plugin management, and configuration inspection":"CLI dsh: запуск профиля, управление плагинами и просмотр конфигурации","Duplicate-install-safe value primitives for the DeepSeek Harness":"Безопасные примитивы значений, устойчивые к дублированию установки","Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry":"Долговременное вытеснение изображений: слишком большие изображения в запросе заменяются заглушками с повтором","Durable immutable attachment storage seam for the DeepSeek Harness":"Внутренний интерфейс долговременного хранения вложений","Durable per-step context with the current time and elapsed time":"Долговременный контекст на каждый шаг с текущим и прошедшим временем","Durable workflow-run Conversation Node and nested member disclosure for dsh web":"Узел разговора для запусков workflow и раскрытие вложенных участников","Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots":"Показ вложений в поле ввода, сообщениях и траектории","Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages":"Реестр динамических пакетов, жизненный цикл песочницы на хосте и обработчики вызовов для плагинов из двух половин","Enable analysis of the current session's raw data and grouped chat messages in the session sidebar.":"Анализ сырых данных текущей сессии и сгруппированных сообщений в боковой панели.","Enable team collaboration, team tools, the member roster, and the shared task board.":"Совместная работа команды: инструменты, список участников и общая доска задач.","Endpoint-named mock for Typert Remote traffic: unary answers and stream scripts per <namespace>/<method>, live stream control, a log, and the Connection carrier face whole-client specs install":"Мок Typert Remote по эндпоинтам: унарные ответы и сценарии потоков для <namespace>/<method>, управление потоком, журнал и Connection-носитель для спецификаций клиента","Event-sourced same-session goal state and lifecycle service for the DeepSeek Harness":"Состояние и жизненный цикл целей в рамках сессии на основе журнала событий","Event-sourced session store for the DeepSeek Harness":"Хранилище сессий на основе журнала событий","Exa-backed search provider for the DeepSeek Harness web capability seam (ctx.web)":"Поисковый провайдер Exa для веб-доступа","Exclusive named browser-use provider registration":"Регистрация провайдера браузерных действий с уникальным именем","Exclusive named computer-use provider registration":"Регистрация провайдера управления компьютером с уникальным именем","Executes model tool calls directly.":"Выполняет вызовы инструментов модели напрямую.","Executes tools through run_code programs and generates SDK bindings.":"Выполняет инструменты через программы run_code и генерирует привязки SDK.","Experimental bridge: load Claude Code mods (hooks modules) and run their hook chains on DeepSeek Harness extension points":"Экспериментальный мост: загружает моды Claude Code (модули хуков) и запускает их цепочки на точках расширения DeepSeek Harness","Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection":"Экспериментальный кросс-реалмовый CDP-хаб для отладки Хоста и инспекции Client Runtime","Experimental custom plugin markets: a Discover tab that browses and installs bundles from plugin market indexes":"Экспериментальные пользовательские рынки плагинов: вкладка «Обзор», просматривающая и устанавливающая наборы из индексов рынков плагинов","Experimental machine translation of expanded reasoning":"Экспериментальный машинный перевод развёрнутых рассуждений","Experimental speech recognition with independently selectable providers":"Экспериментальное распознавание речи с независимо выбираемыми провайдерами","Experimental Stagehand browser tools with separately configured native models":"Экспериментальные браузерные инструменты Stagehand с отдельной настройкой моделей","Experimental virtualized Session log and live Chat group/node inspectors":"Экспериментальные виртуализированные инспекторы журнала сессии, групп и узлов активного чата","Experimental voice input with local SenseVoice; downloads its runtime on first use":"Экспериментальный голосовой ввод с локальным SenseVoice; скачивает свою среду выполнения при первом использовании","Explicit product usage events exported through OpenTelemetry HTTP logs":"События использования продукта через журналы OpenTelemetry HTTP","Explicit workspace file delivery declarations for the DeepSeek Harness":"Объявления доставки файлов рабочей области","Expose safe account operations over authenticated Remote":"Безопасные операции с учётной записью через аутентифицированный Remote","Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text":"Расширяемые превью боковой панели для документов Office, таблиц, Markdown, кода, изображений, PDF, HTML и обычного текста","Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests":"Журналы сессий с авторизацией по отзывам через HTTP-запросы OpenTelemetry с ограничением размера","File actions":"Действия с файлами","File dragging":"Перетаскивание файлов","File-backed credentials provider ($DSH_HOME/.env under the live process environment) for the DeepSeek Harness":"Провайдер учётных данных из файла ($DSH_HOME/.env в окружении запущенного процесса)","File-context policy plugin for the DeepSeek Harness — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API)":"Политика контекста файлов: учёт наблюдаемого состояния, чтение перед изменением и запись/правка с проверкой версии через события fs/* (без API сервиса)","File-reference discovery contract and shared @file grammar":"Контракт поиска ссылок на файлы и общий синтаксис @file","Filesystem provider over the shared POSIX SSH helper":"Провайдер файловой системы через общий помощник POSIX SSH","Fire-and-forget webhook rule runtime that creates Workspace-backed DeepSeek Harness Sessions":"Правила вебхуков: создают сессии DeepSeek Harness, привязанные к рабочей области","First-message LLM provider plugin for DeepSeek Harness session titles":"Провайдер LLM для заголовков сессий по первому сообщению","For troubleshooting: view what DSH recorded for a session in Session log, inspect per-turn and per-step statistics in the Statistics tab, and debug the DSH backend in Chrome DevTools.":"Для диагностики: смотрите, что DSH записал о сессии, в «Журнале сессии», изучайте статистику по ходам и шагам на вкладке «Статистика» и отлаживайте серверную часть DSH в Chrome DevTools.","Frozen released-v0 Session codec and identity migration to v1":"Кодек формата сессий v0 и миграция идентичности на v1","Frozen released-v1 Session codec and assistant-stream migration to v2":"Кодек формата сессий v1 и миграция потока ассистента на v2","General settings control for Session-log upload with DeepSeek API requests":"Общая настройка отправки журналов сессий вместе с запросами к DeepSeek API","Generate session titles from all user messages in the session.":"Названия сессий генерируются по всем сообщениям пользователя в сессии.","Generic stdio language-server provider for the DeepSeek Harness LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace":"Провайдер языковых серверов через stdio: запускает настроенные серверы, переводит JSON-RPC и выполняет запросы определения, ссылок, реализаций и подсказок в файловой системе хоста","Git worktrees":"Рабочие деревья Git","Git Worktrees":"Рабочие деревья Git","GitHub change requests":"Запросы изменения GitHub","Give agents tools to coordinate members, exchange messages, and manage shared tasks.":"Даёт агентам инструменты для координации участников, обмена сообщениями и управления общими задачами.","Give Agents tools to search and read earlier sessions from the current workspace.":"Даёт агентам инструменты поиска и чтения прошлых сессий в текущей рабочей области.","Give the model the Harness source directory and Web URL without changing its system prompt.":"Передаёт модели каталог исходников Harness и веб-адрес, не меняя системный промпт.","Gives the agent terminals whose processes keep running in the background between tool calls, so it can start a dev server or REPL and come back later to read output or type input.":"Даёт агенту терминалы, процессы которых продолжают работать между вызовами инструментов: можно запустить сервер разработки или REPL и позже вернуться, чтобы прочитать вывод или ввести команды.","Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations":"Инструменты send_message, interrupt_agent и list_agents для продолжений субагентов","Harness development context":"Контекст разработки Harness","Headless profile":"Профиль без интерфейса","Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes":"Серверная часть open-in-app: каталог приложений, иконки и точка запуска в виде трёх маршрутов webServer","Host task management page and Session reminder catalog":"Хостовая страница управления задачами и каталог напоминаний сессии","Host-native command and path-opening utilities with shell-free execution, cancellation, desktop detection, and WSL handoff":"Системные команды и открытие путей без оболочки: отмена, определение рабочего стола и передача в WSL","Host-wide durable reminders with shared management and original-Session delivery":"Долговременные напоминания в масштабе хоста с общим управлением и доставкой в исходную сессию","Hot Module Replacement Plugin for Cordis":"Плагин горячей замены модулей для Cordis","Human-facing slash command for explicit session compaction":"Команда для явного сжатия сессии","Human-facing slash command for persisted same-session goals":"Команда для сохранённых целей текущей сессии","Immutable command-line handoff from a dsh launcher to any app plugin that injects cmdlineArgs":"Неизменяемая передача аргументов командной строки от запуска dsh любому плагину приложения","Immutable DeepSeek Harness launch environment that records which layer supplied each value":"Неизменяемое окружение запуска DeepSeek Harness с указанием, какой слой задал каждое значение","Implicit-root Agent Teams roster, direct peer messaging, and shared task DAG":"Состав участников Agent Teams с неявным корнем, прямой обмен сообщениями между участниками и общий DAG задач","In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem)":"Встроенный просмотр каталогов: список и создание в файловой системе хоста","In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives":"Просмотр каталогов в приложении: отрисовка списка и создание каталогов рабочей области","In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log":"Форк субагента в том же процессе: дочерний агент с начальным фрагментом журнала родителя","In-process spawn subagent backend: runs a fresh child agent on ctx.agents":"Запуск субагента в том же процессе: новый дочерний агент на ctx.agents","Include files in cordis configurations":"Включение файлов в конфигурации cordis","Incremental lossless session-log request extension for the official DeepSeek LLM API":"Дополнение запросов к официальному DeepSeek LLM API без потери журнала сессии","Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources":"Обработка триггеров ввода: распознавание «/» и «@», меню кандидатов и маршрутизация к источникам","Inspect and debug raw session data, grouped chat messages, and the NodeJS backend.":"Просмотр и отладка сырых данных сессии, сгруппированных сообщений и бэкенда NodeJS.","Installation-owned lists of official dsh bundles (shipped profile templates, optional, on-demand, and retired bundles) and the plugin manager's protected and presented packages":"Списки официальных наборов dsh, принадлежащие установке (шаблоны профилей, дополнительные, по требованию и снятые с поддержки наборы), а также защищённые и показываемые пакеты менеджера плагинов","Interactive shell tabs for the right Sidebar":"Вкладки интерактивной оболочки в правой панели","Interface customization":"Настройка интерфейса","Job Remote observation stream and the reference-counted client job-output service":"Поток наблюдения за фоновыми задачами и служба вывода задач с подсчётом ссылок","JSON file KV storage backend for the DeepSeek Harness storage hub":"Бэкенд KV-хранилища в JSON-файле для хранилища DeepSeek Harness","JSONL durable session persistence backend for the DeepSeek Harness":"Бэкенд долговременного хранения сессий в JSONL","Keep linked GitHub pull requests beside your conversation: follow checks and reviews, inspect diffs, and send feedback to the agent. Review local changes and use a separate worktree to isolate each task. GitHub features require the gh CLI installed and signed in on the host.":"Держите связанные пул-реквесты GitHub рядом с диалогом: следите за проверками и проверками кода, просматривайте изменения и отправляйте отзывы агенту. Проверяйте локальные изменения и используйте отдельное рабочее дерево, чтобы изолировать каждую задачу. Для функций GitHub нужен установленный и авторизованный gh CLI на хосте.","Keep shell processes alive across tool calls.":"Сохраняет процессы оболочки между вызовами инструментов.","Keyboard shortcut reference, recording, and local preference editing":"Справка по сочетаниям клавиш, запись и локальные настройки","Let agents add a “powered by dsh” badge to documents, pull requests, and other outputs.":"Даёт агентам возможность добавлять значок «powered by dsh» в документы, пул-реквесты и другие материалы.","Let the agent create a new Git branch and worktree, then continue there.":"Агент создаёт ветку и рабочее дерево Git и продолжает работу там.","Let the model browse and operate web pages through Playwright MCP in a launched Chromium.":"Модель просматривает и управляет веб-страницами через Playwright MCP в запущенном Chromium.","Let the model inspect and operate web pages through Chrome DevTools MCP in a launched Chrome.":"Модель просматривает и управляет веб-страницами через Chrome DevTools MCP в запущенном Chrome.","Let the model operate the desktop through a separately installed cua-driver executable.":"Модель управляет рабочим столом через отдельно установленный cua-driver.","Let the model operate the desktop with the bundled Cua Driver runtime; needs desktop permissions for the app that launches dsh.":"Модель управляет рабочим столом через встроенную среду Cua Driver; нужны разрешения рабочего стола для приложения, запускающего dsh.","Lets the agent you talk to split a job among named teammates, track it on a shared task board, and report back with their results.":"Позволяет агенту распределить работу между именованными участниками, вести её на общей доске задач и вернуть вам их результаты.","Linux arm64 system binaries: static Landlock launcher and glibc/musl Node-API flock addons":"Системные бинарники Linux arm64: статический запуск Landlock и Node-API-аддоны flock для glibc/musl","Linux Node WebAssembly OOXML-to-PDF engine assets":"Ресурсы движка OOXML-to-PDF на Node WebAssembly для Linux","Linux x64 system binaries: static Landlock launcher and glibc/musl Node-API flock addons":"Системные бинарники Linux x64: статический запуск Landlock и Node-API-аддоны flock для glibc/musl","LiveShare Session Sharing":"Общий доступ к сессиям LiveShare","Liveshare wire frames and the identity contract shared by the owner bundle and the Relay":"Форматы обмена Liveshare и контракт личности, общие для набора владельца и Relay","Loader integration for generated Typert package contributions":"Интеграция загрузчика для вкладов пакетов Typert","Local Bash execution":"Локальное выполнение Bash","Local filesystem":"Локальная файловая система","Local filesystem skill provider for the DeepSeek Harness":"Провайдер навыков из локальной файловой системы","Local PowerShell execution":"Локальное выполнение PowerShell","Local PowerShell implementation of the DeepSeek Harness bash executor seam":"Локальная реализация PowerShell для выполнения bash-команд","Local process-sandbox backends for the DeepSeek Harness sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed":"Локальные бэкенды песочницы: bwrap, landlock-run из npm, macOS Seatbelt или Windows ACL с ограниченным токеном — с проверкой работоспособности и отказом при сбое","Local SenseVoice ONNX transcription with a managed sherpa-onnx process":"Локальная расшифровка SenseVoice ONNX с управляемым процессом sherpa-onnx","Local SenseVoice recognition":"Локальное распознавание SenseVoice","Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes":"Провайдер ссылок на файлы (ctx.fileReferences) с нечётким поиском по индексам","Local-filesystem implementation of the DeepSeek Harness filesystem seam (ctx.fs)":"Реализация файловой системы (ctx.fs) на локальной файловой системе","Local-filesystem implementation of the DeepSeek Harness spill storage seam (private session-scoped files)":"Реализация хранилища больших выводов в локальных файлах сессии","Local-subprocess implementation of the DeepSeek Harness bash executor seam":"Реализация выполнения bash через локальный подпроцесс","Local-subprocess implementation of the DeepSeek Harness subprocess seam":"Реализация подпроцессов через локальный подпроцесс","Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries":"Локализация: сохранённые настройки, расширяемый каталог языков, резервный вариант для браузера и встроенные словари","Log-backed session title service and provider registry for the DeepSeek Harness":"Служба заголовков сессий и реестр провайдеров на основе журнала","Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command":"Отзывы в журнале сессий: событие записи, Remote-интерфейс и команда для пользователя","Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit":"Режим планирования для агента: план, рекомендации по развёртыванию, команда и подтверждение выхода пользователем","Machine translation of expanded reasoning; source text is sent to the selected service":"Машинный перевод развёрнутых рассуждений; исходный текст отправляется в выбранный сервис","Machine translation of reasoning":"Машинный перевод рассуждений","Machine translation with reusable Session results":"Машинный перевод с повторным использованием результатов сессии","macOS Computer Use provider":"Провайдер управления компьютером для macOS","macOS native provider for shared Computer Use application and window objects":"Системный провайдер macOS для общих объектов приложений и окон Computer Use","Manage application access, permissions, and logged tool execution for Computer Use.":"Управление доступом приложений, разрешениями и журналированием вызовов инструментов для управления компьютером.","Manage configured plugin indexes for plugin discovery and the plugin_market tool.":"Управление настроенными индексами плагинов для поиска плагинов и инструмента plugin_market.","Manage DeepSeek login and open Platform billing pages":"Управление входом в DeepSeek и открытие страниц оплаты Platform","Manage session working directories, save directory changes, and provide the model with working-directory context.":"Управление рабочими каталогами сессий, сохранение изменений каталога и передача модели контекста рабочего каталога.","Manage speech transcription and select a recognition service.":"Управление расшифровкой речи и выбор сервиса распознавания.","Manage team members, member messages, and shared tasks.":"Управление участниками команды, сообщениями и общими задачами.","Masks recognized keys, tokens, and passwords in sent messages.":"Скрывает распознанные ключи, токены и пароли в отправляемых сообщениях.","MCP client":"Клиент MCP","MCP client bridge: connects to MCP servers and registers their tools on ctx.tools":"Мост MCP-клиента: подключается к серверам MCP и регистрирует их инструменты в ctx.tools","Message quotes":"Цитаты сообщений","Meta-Framework for Modern JavaScript Applications":"Мета-фреймворк для современных JavaScript-приложений","Method-level Remote access control for non-owner Peers and the per-Peer access snapshot":"Контроль доступа к методам Remote для чужих Peers и снимок доступа по каждому Peer","Model context naming the DeepSeek Harness checkout and Web GUI URL without letting either change the system prompt":"Контекст модели с путём к DeepSeek Harness и адресом веб-интерфейса, без изменения системного промпта","Model selection over the shared model catalog, Session projection, and session.selectModel":"Выбор модели по общему каталогу, проекция сессии и session.selectModel","Model tool that creates and enters a new Git worktree":"Инструмент модели, создающий новое рабочее дерево Git и переходящий в него","Model-facing ask_user_question tool over the ctx.userQuestions seam":"Инструмент ask_user_question для модели через интерфейс вопросов пользователю","Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry":"Инструменты управления фоновыми задачами (job_output, job_list, job_kill)","Model-facing bash tool with optional generic background-job and sandbox-escalation support":"Инструмент bash для модели с фоновыми задачами и расширением песочницы","Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep)":"Инструменты поиска по файлам (glob, grep) на встроенном ripgrep (@vscode/ripgrep)","Model-facing filesystem tools (read, write, edit) over the DeepSeek Harness filesystem seam (ctx.fs)":"Инструменты работы с файлами (read, write, edit) для модели","Model-facing fresh-agent Ralph loop over the workflow and subagent seams":"Цикл Ralph для модели: новые агенты на каждой итерации через workflow и субагентов","Model-facing lsp tool over the DeepSeek Harness LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization":"Инструмент lsp для модели: определение, ссылки, реализации и подсказки, координаты в UTF-16, ограниченный вывод","Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service":"Постоянный инструмент bash для владельца сессии на службе PTY","Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service":"Постоянный инструмент PowerShell для владельца сессии на службе PTY","Model-facing pwsh tool over the bash executor seam":"Инструмент pwsh для модели через интерфейс выполнения bash","Model-facing reminder management tools (schedule_create, schedule_list, schedule_update, schedule_delete) over the Host ctx.schedule service":"Инструменты напоминаний для модели (schedule_create, schedule_list, schedule_update, schedule_delete) через службу ctx.schedule","Model-facing same-session goal tools with execution-time authority checks":"Инструменты целей текущей сессии для модели с проверкой прав во время выполнения","Model-facing skill loading tool for the DeepSeek Harness":"Инструмент загрузки навыков для модели","Model-facing subagent delegation tool over the ctx.subagents seam":"Инструмент делегирования субагенту для модели","Model-facing todo_write tool over the DeepSeek Harness event-sourced session log":"Инструмент todo_write для модели через журнал сессии","Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service":"Инструмент просмотра, создания, замены и вставки строк в файлы для модели","Model-facing web tools (web_search, web_fetch) over the DeepSeek Harness web capability seam (ctx.web)":"Веб-инструменты для модели (web_search, web_fetch) через интерфейс веб-доступа","Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine":"Инструмент workflow для модели: запускает JavaScript-скрипт оркестрации","Models settings and shared product-onboarding dialogs over existing settings and credential joins":"Настройки моделей и диалоги первого запуска поверх существующих настроек и учётных данных","Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser":"Системный выбор каталога: рабочая область открывает локальный выбор каталога настольного приложения или системы","Native tool execution":"Прямое выполнение инструментов","Native-OS-chooser backend of the directory-picker seam for the DeepSeek Harness web GUI host":"Системный выбор каталога для веб-интерфейса","Nested plugin group for cordis":"Вложенная группа плагинов для cordis","Node PTC execution with async function, REPL and VM Script evaluators and optional retained state":"Выполнение PTC в Node с вычислителями async-функций, REPL и VM Script и необязательным сохраняемым состоянием","Node PTC execution with per-call sandboxed processes or in-memory REPL state":"Выполнение PTC в Node: песочница на каждый вызов или состояние REPL в памяти","NodeJS inspector":"Инспектор Node.js","NodeJS Inspector":"NodeJS Inspector","Office skills":"Навыки Office","Official DeepSeek Harness brand occupants for the Web client's sidebar slots":"Официальные элементы бренда DeepSeek Harness для слотов боковой панели веб-клиента","Opt-in durable per-step context with this agent's tmux pane and window location":"Дополнительный контекст на каждом шаге: панель и окно tmux текущего агента","Optional machine translation of expanded reasoning, preserving original Session text":"Необязательный машинный перевод развёрнутых рассуждений с сохранением исходного текста сессии","Optional Web bundle for raw Session logs and Chat node inspection":"Необязательный веб-набор для необработанных журналов сессий и просмотра узлов чата","Original-file saving and image clipboard actions for Web and Desktop":"Сохранение исходных файлов и работа с изображениями из буфера обмена для Web и Desktop","Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol":"Субагент через ACP в отдельном процессе: дочерний агент управляется по Agent Client Protocol","Out-of-process SDK subagent backend: drives a child DeepSeek Harness runtime subprocess over stdio JSON-RPC through the TypeScript SDK client":"Субагент через SDK в отдельном процессе: дочерний рантайм DeepSeek Harness управляется по JSON-RPC stdio через TypeScript SDK","Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family":"Политика песочницы на каждый вызов и контекст модели: резервные значения развёртывания, режим и корень рабочей области каждой сессии","Per-tool LLM authorization review for the DeepSeek Harness Auto permission preset":"Проверка авторизации LLM для каждого инструмента в наборе разрешений «Auto» DeepSeek Harness","Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the DeepSeek Harness":"Изменения файлов рабочей области по шагам на основе снимков git и полных копий файлов, со сравнением по файлам","Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection":"Разрешения: значение по умолчанию для новых сессий в общих настройках и окно /permission для текущей сессии","Perplexity-backed search provider for the DeepSeek Harness web capability seam (ctx.web)":"Поисковый провайдер Perplexity для веб-доступа","Persist plugin configuration through profile patches and Loader reconciliation":"Сохранение конфигурации плагинов через патчи профиля и согласование загрузчика","Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read":"Кэш проекций сессий (ctx.sessionProjectionCache): контрольные точки на домене session_projcache, отложенная запись и чтение списка","Persistent append-only chunked lists with bounded copying and JSON checkpoint validation":"Долговременные списки блоков только на добавление с ограниченным копированием и проверкой JSON","Persistent PTY session seam for the DeepSeek Harness — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup":"Интерфейс постоянных PTY-сессий: изоляция владельцев, реестр бэкендов, отправка, чтение, сигналы и очистка","Persistent shell PTY backend over the DeepSeek Harness subprocess terminal primitive":"Бэкенд PTY для оболочки на примитиве подпроцессов","Persistent terminal tools":"Инструменты постоянных терминалов","Persistent terminals":"Постоянные терминалы","Personalized page cards":"Карточки персональных страниц","Personalized pages":"Персональные страницы","Personalized recommendations":"Персональные рекомендации","pi-ai-backed DeepSeek adapter for the DeepSeek Harness LLM seam (design-verification twin of dsh-llm-deepseek)":"Адаптер DeepSeek на базе pi-ai (проверочный двойник dsh-llm-deepseek)","Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews":"Управление режимом планирования, карточки плана в стенограмме и превью Markdown в боковой панели","Plugin detail documents: meta.detail or README selection, image paths, and local and npm CDN file sources":"Документы подробностей плагина: выбор meta.detail или README, пути к изображениям и источники файлов локально и через CDN npm","Plugin discovery":"Поиск плагинов","Plugin indexes":"Индексы плагинов","Plugin loader for cordis":"Загрузчик плагинов для cordis","Plugin management for the dsh web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages":"Управление плагинами в веб-клиенте: панель «Плагины» устанавливает, включает, выключает и перезапускает пакеты плагинов","Plugin market index format 1: JSON validation, relative icon resolution, and pinned install arguments":"Формат индекса рынка плагинов 1: проверка JSON, относительные иконки и закреплённые аргументы установки","Plugin recommendation cards":"Карточки рекомендаций плагинов","Plugin recommendations":"Рекомендации плагинов","Plugin-owned human command registry for DeepSeek Harness UIs":"Реестр команд пользователя, принадлежащих плагинам","Prebuilt LibreOfficeKit engine for darwin-arm64":"Предустановленный движок LibreOfficeKit для darwin-arm64","Prebuilt LibreOfficeKit engine for win32-x64":"Предустановленный движок LibreOfficeKit для win32-x64","Prebuilt POSIX flock Node-API binding for macOS arm64":"Готовый Node-API-аддон POSIX flock для macOS arm64","Prebuilt POSIX flock Node-API binding for macOS x64":"Готовый Node-API-аддон POSIX flock для macOS x64","Prebuilt system primitives: a Linux Landlock launcher and asynchronous POSIX flock through stable Node-API":"Системные примитивы: запуск Landlock для Linux и асинхронный POSIX flock через стабильный Node-API","Prerequisite mounting, production AgentLoop drivers, and Inbox stubs for tests":"Монтирование зависимостей, боевые драйверы AgentLoop и заглушки Inbox для тестов","Press Ctrl/Cmd+Shift+. to open Chrome DevTools in the bottom panel for development and debugging.":"Ctrl/Cmd+Shift+. открывает Chrome DevTools в нижней панели для разработки и отладки.","Private content-addressed DSH_HOME attachment storage":"Хранилище вложений DSH_HOME с адресацией по содержимому","Process-local implementation of the DeepSeek Harness background job registry seam":"Реализация реестра фоновых задач в процессе","Process-wide outbound HTTP proxy policy for DeepSeek Harness: resolve it from the launch environment and install it as undici's global dispatcher":"Общая политика исходящих HTTP-запросов: берётся из окружения запуска и устанавливается глобальным диспетчером undici","Proposes a page or small tool you can keep, below the answer; after you click Create it is built in the background as a plugin page that you can cancel, undo and restore. A build takes minutes and many tokens.":"Предлагает под ответом страницу или небольшой инструмент, который можно сохранить; после нажатия «Создать» он собирается в фоне как страница-плагин, которую можно отменить, откатить и восстановить. Сборка занимает минуты и много токенов.","Provide absolute paths to the bundled Python, Node.js, and pnpm runtimes.":"Даёт абсолютные пути к поставляемым средам Python, Node.js и pnpm.","Provide automation-only ACP communication and process lifecycle management over dsh-base.":"Связь ACP только для автоматизации и управление жизненным циклом процессов поверх dsh-base.","Provide built-in Word, PowerPoint, and Excel workflows and LibreOffice Kit operations.":"Встроенные сценарии Word, PowerPoint и Excel и операции LibreOffice Kit.","Provide JSON-RPC over standard input and output and manage the process lifecycle over dsh-base.":"JSON-RPC через стандартный ввод-вывод и управление жизненным циклом процессов поверх dsh-base.","Provide native macOS applications and windows for the shared Computer Use service.":"Нативные приложения и окна macOS для общего сервиса управления компьютером.","Provide shared model guidance for file links and deliverables across application environments.":"Общие указания модели о ссылках на файлы и результатах работы в разных приложениях.","Provide six persistent PTY tools with isolated session ownership and background task integration.":"Шесть постоянных инструментов PTY с изолированным владением сессиями и интеграцией с фоновыми задачами.","Provide speech transcription for browser clients.":"Расшифровка речи для браузерных клиентов.","Provide the official powered-by-DSH badge skill.":"Официальный навык для значка «powered by DSH».","Provider-neutral LLM service interface for the DeepSeek Harness":"Независимый от провайдера интерфейс службы LLM","Provider-routed LLM request retry policy for the DeepSeek Harness":"Политика повторных запросов LLM по маршруту провайдера","PTC tool execution":"Выполнение инструментов через PTC","Pure Codex-style patch parser and LF text updater with structured match failures":"Чистый парсер патчей в стиле Codex и обновление текста с LF со структурированными ошибками сопоставления","Pure React atoms for the dsh web UI: controls, icons, markdown, and JSON inspectors (zero cordis)":"Чистые React-атомы для веб-интерфейса: элементы управления, иконки, Markdown и просмотр JSON (без cordis)","Quote selected text and display it as a Markdown block quote.":"Цитирование выделенного текста в виде блочной цитаты Markdown.","Race-fenced same-session goal-round driver":"Драйвер раундов целей в рамках сессии с защитой от гонок","Ralph loops":"Циклы Ralph","React-free observable and snapshot-store contracts with the shared Zustand/Immer engine":"Контракты наблюдаемых состояний и снимков без React с движком Zustand/Immer","Read account state and resolve official API credentials":"Чтение состояния учётной записи и получение официальных учётных данных API","Read and change the active Session working directory":"Чтение и смена рабочего каталога активной сессии","Read and change the current session's working directory.":"Чтение и смена рабочего каталога текущей сессии.","Read GitHub change requests for the forge registry through the GitHub CLI on the host.":"Чтение запросов изменения GitHub для реестра forge через GitHub CLI на хосте.","Read-only Cordis Loader inventory tab in Web Plugins settings":"Вкладка состава загрузчика Cordis в настройках плагинов (только чтение)","Read-only Remote projection of current Cordis Loader plugin state":"Проекция состояния плагинов Cordis Loader только для чтения","Read-only runtime API inspection for Harness plugin development":"Просмотр API рантайма только для чтения — для разработки плагинов","Record speech and insert editable text into the conversation draft":"Запись речи и вставка редактируемого текста в черновик диалога","Record speech and insert editable text into the conversation draft.":"Запись речи и вставка редактируемого текста в черновик сообщения.","Refresh session titles as new human prompts arrive.":"Обновление заголовков сессий по мере поступления новых сообщений.","Register code host providers and poll change request status through one provider-neutral service.":"Регистрирует провайдеры хостингов кода и опрашивает состояние запросов изменения через один независимый от провайдера сервис.","Register Computer Use providers by name, with one provider per name.":"Регистрирует провайдеры управления компьютером по имени, по одному на имя.","Registry service for package-owned DeepSeek Harness runtime invariants":"Сервис-реестр инвариантов времени выполнения DeepSeek Harness, принадлежащих пакетам","Remote access control":"Управление удалённым доступом","Remote BFF assembly for application-selected Host capabilities":"Сборка Remote BFF для выбранных хостом возможностей","Remote owner for the configuration surfaces over the settings-domain seams":"Владелец конфигурационных экранов на интерфейсах настроек","Remote POSIX sandbox argv provider over the shared SSH helper":"Провайдер аргументов POSIX-песочницы через общий SSH-помощник","Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls":"Защита от повторов: напоминания, когда агент зацикливается на одинаковых вызовах инструментов","Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests)":"Плагин воспроизведения LLM: отдаёт записанные ответы из JSONL сессии для тестов без ключей","Replay-aware token measurement service (ctx.tokenMeter) for the DeepSeek Harness":"Служба измерения токенов с учётом воспроизведения (ctx.tokenMeter)","Replay-safe model-free head/middle/tail pruning for tool-result surface nodes":"Сокращение начала, середины и конца результатов инструментов без модели — безопасно для воспроизведения","Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it":"Правая панель: состояние, привязанное к сессии, панель и кнопка раскрытия, служба навигации","Run a single task directly with the core Agent/Session runner over dsh-base, without a Host, HTTP, or browser layer.":"Запускает одну задачу напрямую через основной исполнитель Agent/Session поверх dsh-base, без хоста, HTTP и браузерного слоя.","Run agents through JSON-RPC over standard input and output for automation.":"Запуск агентов через JSON-RPC по стандартному вводу-выводу для автоматизации.","Run Bash commands in local subprocesses.":"Выполнение команд Bash в локальных подпроцессах.","Run commands through local PowerShell.":"Выполнение команд через локальный PowerShell.","Run explicitly requested repeated work with fresh agents.":"Повторяет явно запрошенную работу с новыми агентами.","Run tasks in your sessions at a set time or on a repeating schedule.":"Запускает задачи в ваших сессиях в заданное время или по повторяющемуся расписанию.","Runtime registry for generated package reflection and Zod schemas":"Реестр рантайма для отражения пакетов и схем Zod","Sandbox-consuming implementation of the DeepSeek Harness bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts)":"Реализация выполнения bash с песочницей: каждая команда ограничивается через ctx.sandbox, отказ и результат сообщаются","Sandbox-consuming implementation of the DeepSeek Harness PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts)":"Реализация выполнения PowerShell с песочницей: каждая команда ограничивается через ctx.sandbox","Sandbox-enforcing implementation of the DeepSeek Harness filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through":"Файловая система с песочницей: запись и правка ограничены режимом песочницы (только чтение запрещает изменения, запись в рабочую область — только рабочая область и временные каталоги), чтение проходит","Sandboxed Node process implementation of the DeepSeek Harness PTC execution capability":"Реализация возможности выполнения PTC в DeepSeek Harness через процесс Node в песочнице","Sandboxed Web browser tabs for the right Sidebar":"Вкладки браузера в песочнице для правой панели","Save tmux pane and window locations for each step when needed.":"Сохраняет расположение панелей и окон tmux для каждого шага, когда это нужно.","Scheduling tools":"Инструменты планирования","Scoped MCP resource discovery and reading through shared model tools":"Поиск и чтение ресурсов MCP через общие инструменты модели","Scoped model-facing Agent Teams tools over ctx.agentTeams":"Доступные модели инструменты Agent Teams с ограничением области поверх ctx.agentTeams","Scoped-context registration primitive (scope tags, scope-filtered event dispatch) for the DeepSeek Harness":"Примитив регистрации областей контекста (теги и фильтрация событий по области)","Scriptable Messages HTTP/SSE fault server for LLM recovery tests":"Сервер сбоев Messages HTTP/SSE для проверки восстановления LLM","SDK profile":"Профиль SDK","SDK server":"Сервер SDK","Search session history and read trajectories and events according to workspace permissions.":"Поиск по истории сессий и чтение траекторий и событий в соответствии с разрешениями рабочей области.","Semantic session durability checkpoints before model requests and tool side effects":"Смысловые контрольные точки сохранности сессии перед запросами к модели и побочными эффектами инструментов","Serve SDK clients in separate processes through JSON-RPC over standard input and output.":"Обслуживание клиентов SDK в отдельных процессах через JSON-RPC по стандартному вводу-выводу.","Serve the Web application's entry page and static files, reject paths outside their directory, and return 404 for missing resources.":"Отдаёт входную страницу веб-приложения и статические файлы, отклоняет пути за пределами их каталога и возвращает 404 для отсутствующих ресурсов.","Session change requests":"Запросы изменения сессии","Session Controller adapter for React and session-scoped slots":"Адаптер Session Controller для React и слотов сессии","Session goal surface: GoalBar docked above the composer, read from the goal session projection":"Цель сессии: панель GoalBar над полем ввода, данные из проекции цели","Session history tools":"Инструменты истории сессий","Session log":"Журнал сессии","Session Log":"Журнал сессии","Session Remote commands, cold reads, and live control transport":"Команды Remote сессии, холодное чтение и живой транспорт управления","Session search":"Поиск по сессиям","Session working directories":"Рабочие каталоги сессий","Session working directories with durable changes and model context":"Рабочие каталоги сессии с сохранением изменений и контекстом модели","Session-header background-job list with on-demand streaming record panels":"Список фоновых задач в заголовке сессии с потоковыми панелями по запросу","Session-log snapshot core with an ACP protocol adapter, expected-output normalization, and fixture invariants":"Ядро снимков журнала сессий с адаптером ACP, нормализацией ожидаемого вывода и фикстурами","Session-owned browser resource lifecycles and MCP integration for experimental providers":"Жизненный цикл браузерных ресурсов сессии и интеграция MCP для экспериментальных провайдеров","Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control":"Интерактивные терминалы сессии: поиск оболочки, восстановление экрана и управление через Remote","Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state":"Интерфейс проекций сессии: таблица типов, контракт провайдера и реестр ctx.sessionProjections","SessionTelemetryBackend seam for the DeepSeek Harness: session-event capture, projection, redaction, and handoff to a reporting backend":"Интерфейс телеметрии сессий: сбор событий, проекция, скрытие секретов и передача в бэкенд отчётности","Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract":"Базовый плагин настроек: общие формы конфигурации и контракт слотов настроек","Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice":"Настройки и первый запуск: общий раздел, оформление, словари настроек и приветствие с версией","Settings page of Subagent delegation on the dsh web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents":"Страница делегирования субагентам: глубина рекурсии, параллелизм и модели для субагентов","Settings page of the agent loop on the dsh web client's Plugins page: the parallel tool-call cap of the agent-loop namespace":"Страница цикла агента: лимит параллельных вызовов инструментов","Settings page of the DeepSeek web-search provider on the dsh web client's Plugins page: its API key, endpoint, and per-request search budget":"Страница провайдера веб-поиска DeepSeek: API-ключ, эндпоинт и лимит поиска на запрос","Settings page of the shell executor on the dsh web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace":"Страница выполнения команд: тайм-аут команды и лимит вывода на поток","Share the current Session with a colleague, who can drive it in a browser, edit files inside the granted workspace when the share allows writes, or branch their own Session from the completed history.":"Открывает текущую сессию коллеге: он может управлять ею в браузере, изменять файлы в разрешённой рабочей области, если доступ позволяет запись, или ответвить собственную сессию из завершённой истории.","Shared anonymous user identity for DeepSeek Harness telemetry and feedback correlation":"Общая анонимная идентичность для телеметрии и обратной связи","Shared boot glue for the app bins: .env loading, fail-loud Loader guards, snapshot-aware config resolution, and the Loader boot sequence":"Общая загрузка приложений: .env, защита загрузчика, конфигурация со снимками и последовательность запуска","Shared Claude Code / Codex hook wire protocol: matcher engine, stdin/exit-code/stdout codec, multi-hook merge, and hook/* session events":"Общий протокол хуков Claude Code / Codex: сопоставление, кодирование stdin/код выхода/stdout, объединение хуков и события hook/*","Shared Computer Use application objects, authorization, and logged tool execution":"Общие объекты приложений Computer Use, авторизация и журналируемое выполнение инструментов","Shared filesystem path helpers for the DeepSeek Harness":"Общие помощники путей файловой системы","Shared in-process subagent run driver: drives a child agent on ctx.agents (used by the spawn and fork backends)":"Общий драйвер запуска субагента внутри процесса: ведёт дочернего агента на ctx.agents (используется бэкендами spawn и fork)","Shared LLM generation policy for DeepSeek Harness session-title providers":"Общая политика генерации для провайдеров заголовков сессий","Shared low-level Win32 process, stdio, and Job Object primitives":"Общие низкоуровневые примитивы Win32: процессы, stdio и Job Object","Shared messaging, interruption, and child discovery tools for subagents":"Общие инструменты сообщений, прерывания и поиска дочерних задач для субагентов","Shared Office-to-PDF conversion with bounded queues and caching":"Общее преобразование Office в PDF с очередями и кэшированием","Shared OpenSSH connection and versioned POSIX remote helper":"Общее подключение OpenSSH и версионируемый помощник POSIX","Shared subprocess and direct-agent harness for keyless real-Loader example smoke tests":"Общий стенд подпроцессов и прямых агентов для дымовых тестов на настоящем загрузчике","Shared type declarations for package.json.dsh configuration fields":"Общие типы для полей конфигурации package.json.dsh","Shared wire protocol for the DeepSeek Harness SDK runtime: the newline-delimited JSON-RPC stdio transport and the named request, result, and notification types spoken between the runtime server and SDK clients":"Общий протокол SDK-рантайма: JSON-RPC stdio с построчным разделением и типы запросов, ответов и уведомлений","Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels)":"Плагин оболочки: трёхколоночный AppFrame с перетаскиванием и служба состояния раскладки (навигация и панели)","Show optional action cards below answers for enabled experiments, and report the user's choices back to the conversation.":"Показывает под ответами необязательные карточки действий для включённых экспериментов и возвращает выбор пользователя в диалог.","Show optional action cards below answers, with each experiment's own controls.":"Показывает под ответами необязательные карточки действий со своими элементами управления для каждого эксперимента.","Show per-turn and per-step context, timing, cache, and tool cost beside Chat.":"Показывает рядом с «Чатом» контекст, время, кэш и стоимость инструментов по ходам и шагам.","Show the Enable card for a recommended official plugin after an answer, with its details and your choice.":"Показывает после ответа карточку включения рекомендованного официального плагина с его подробностями и вашим выбором.","Show the proposal card after an answer with location choice, creation progress, retention and undo.":"Показывает после ответа карточку предложения с выбором расположения, ходом создания, сохранением и отменой.","Shows a Session's change requests in a sidebar tab and lets a new Session start in a worktree.":"Показывает запросы изменения сессии на вкладке боковой панели и позволяет новой сессии начать в рабочем дереве.","Shows recommendation cards below the answer for what you want from DSH: when you want a page or small tool you can keep, it proposes a new personalized page, built in the background after you click Create; when you ask how to do something in this app or say a capability is missing, it recommends the built-in plugin that provides it, turned on when you click Enable.":"Показывает под ответом карточки рекомендаций под ваши задачи в DSH: если вам нужна страница или небольшой инструмент, который можно сохранить, предлагает новую персональную страницу, собираемую в фоне после нажатия «Создать»; если вы спрашиваете, как что-то сделать в приложении, или говорите, что не хватает возможности, рекомендует встроенный плагин, который её даёт, — он включится после нажатия «Включить».","Sidebar plugin: session multi-level tree, search, grouping, state dots":"Плагин боковой панели: дерево сессий, поиск, группировка и индикаторы состояния","Signed GitHub HTTP webhook adapter for the DeepSeek Harness webhook runtime":"Адаптер подписанных вебхуков GitHub для правил вебхуков","Single file-extension to syntax-highlighting language table shared by Client code surfaces and the Host read card":"Общая таблица расширений файлов и языков подсветки для кода в клиенте и карточки файлов на хосте","Six model-facing persistent PTY tools with owner isolation and generic background-job integration":"Шесть постоянных PTY-инструментов для модели с изоляцией владельца и интеграцией фоновых задач","Slot registry pure core: typed ordinary Slots and reusable Component Factories, derived props, Store seats, and renderer installation":"Ядро реестра слотов: типизированные слоты, фабрики компонентов, производные свойства, места в Store и установка отрисовщика","SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses":"Раздача SPA для веб-оболочки: резервный маршрут веб-сервера, индекс и статические файлы с защитой от обхода путей и 404","Speech recognition":"Распознавание речи","Speech transcription API":"API расшифровки речи","SQLite storage backend (kv facet) for the DeepSeek Harness storage hub":"Бэкенд хранилища SQLite (KV) для хранилища DeepSeek Harness","Stateless branded primitive types for the DeepSeek Harness":"Неизменяемые брендированные типы-примитивы","Static frontend server":"Статический сервер интерфейса","Statistics view":"Статистика","Stdio JSON-RPC server plugin for out-of-process DeepSeek Harness SDK clients":"Сервер JSON-RPC stdio для внешних клиентов SDK","Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the DeepSeek Harness":"Хранилище (ctx.storage): реестр именованных бэкендов и подключённые формы данных","Stores automation tasks, runs each in its original session when it is due, and gives the agent tools to manage them.":"Хранит автоматические задачи, запускает их в исходной сессии по расписанию и даёт агенту инструменты управления.","Streaming adjacent Session format migration machinery":"Потоковая миграция формата сессий","Streaming system-prompt, canonical-envelope and PTC migration into V3":"Потоковая миграция системного промпта, канонического конверта и PTC в V3","Streaming tool-role migration and delivery validation from Session V3 to V4":"Потоковая миграция ролей инструментов и проверка поставки из V3 в V4","Strict instant and IANA zone parsing, millisecond spans, and bounded Cron/RRULE recurrence arithmetic":"Строгий разбор моментов времени и зон IANA, интервалы в миллисекундах и ограниченная арифметика повторений Cron/RRULE","Subagent conversation catalog, continuation routing UI, and '@' reference source":"Каталог разговоров субагентов, маршрутизация продолжений и источник ссылок «@»","Subprocess and terminal provider over the shared POSIX SSH helper":"Провайдер подпроцессов и терминалов через общий SSH-помощник","Subprocess seam (ctx.subprocess) for the DeepSeek Harness — managed process groups, bounded spill-backed output, and escalated kills behind one abstract service":"Интерфейс подпроцессов (ctx.subprocess): группы процессов, вывод с ограничением и запись во временные файлы, принудительное завершение","System prompt assembly registry for the DeepSeek Harness":"Реестр сборки системного промпта","Target-neutral Conversation assembly, shell, composer, queue, and view navigation":"Сборка разговора, оболочка, поле ввода, очередь и навигация — независимо от цели","Task interface":"Интерфейс задач","Task scheduling":"Планирование задач","Team collaboration":"Командная работа","Team Collaboration":"Командная работа","Team panel":"Панель команды","Team Panel":"Панель команды","Team tools":"Инструменты команды","Team Tools":"Инструменты команды","Tells the model the current time, the browser's time zone, and the time since the previous message at each step.":"Сообщает модели текущее время, часовой пояс браузера и время с прошлого сообщения на каждом шаге.","Temporary 1017 release badge for official DeepSeek Flash model labels":"Временный значок релиза 1017 для названий моделей DeepSeek Flash","Text editor tools":"Инструменты текстового редактора","The Automation tasks page in the sidebar, plus task cards and reminder marks in sessions.":"Страница автоматических задач в боковой панели, карточки задач и отметки напоминаний в сессиях.","The concrete agent loop plugin for the DeepSeek Harness":"Конкретная реализация цикла агента","The dsh ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over dsh-base":"Набор профиля ACP: JSON-RPC stdio только для автоматизации и жизненный цикл процессов поверх dsh-base","The dsh browser-surface bundle: the web patch layer over dsh-base plus the runtime glue plugin (frontend dist serving, bash runtime variables, URL line)":"Набор браузерного слоя dsh: веб-слой патчей поверх dsh-base и связующий плагин рантайма (раздача фронтенда, переменные bash, адрес)","The dsh browser-surface bundle: the web patch layer over dsh-base plus the runtime glue plugin (frontend dist serving, bash runtime variables, URL line) — ":"Набор браузерного слоя dsh: веб-слой патчей поверх dsh-base и связующий плагин рантайма (раздача фронтенда, переменные bash, адрес)","The dsh browser-surface bundle: the web patch layer over dsh-base plus the runtime glue plugin (frontend dist serving, web-surface prompt, bash runtime variables, URL line)":"Набор для браузерной поверхности dsh: веб-слой патчей поверх dsh-base и связующий плагин рантайма (отдача сборки фронтенда, промпт веб-поверхности, переменные bash, строка URL)","The dsh one-shot bundle: a direct core Agent/Session runner over dsh-base with no Host, HTTP, or browser layer":"Набор one-shot: прямой запуск ядра Agent/Session поверх dsh-base без хоста, HTTP и браузера","The dsh SDK profile bundle: stdio JSON-RPC serving and process lifecycle over dsh-base":"Набор профиля SDK: JSON-RPC stdio и жизненный цикл процессов поверх dsh-base","The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload":"Инструмент load_workspace_dependencies: абсолютные пути к встроенным Python, Node.js и pnpm","The shared dsh core as a profile bundle: the first patch layer of base-backed profiles, inserting core rows over the empty profile root":"Общее ядро dsh как набор профиля: первый слой патчей профилей на dsh-base","The standalone minimal SDK profile bundle: JSON-RPC, one DeepSeek adapter, persistent shell, and JSONL sessions":"Минимальный набор SDK: JSON-RPC, один адаптер DeepSeek, постоянная оболочка и сессии JSONL","The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes":"Веб-отзывы: кнопки «Нравится/Не нравится» у ответов ассистента и диалог отзывов, плюс команда /feedback","The workspace files page and one workspace directory tree per pane beside docked and floating file previews, listed lazily over the workspaceFiles Remote namespace":"Страница файлов рабочей области и дерево каталогов рабочей области для каждой панели рядом с закреплёнными и плавающими просмотрами файлов, с ленивой загрузкой через Remote-пространство имён workspaceFiles","Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row":"Тема: загрузка палитры до плагинов, ThemeRuntime для светлой/тёмной/системной темы, стили --dsw-* и строка «Внешний вид»","Theme plugin: Host bootstrap for the pre-plugin palette; ThemeRuntime for light/dark/system state and icon replacements; --dsw-* token styles and Appearance settings row":"Плагин темы: загрузка палитры до подключения плагинов на хосте; ThemeRuntime для светлой, тёмной и системной темы и замены значков; стили токенов --dsw-* и строка настроек внешнего вида","Time awareness":"Текущее время","Time vocabulary shared by the boundaries that accept a caller's zone, a wall-clock selector, or an elapsed time: canonicalClientTimeZone (IANA zone validation and canonicalization), strict RFC 3339 instant, local-calendar, and zone resolution, and a millisecond Duration span":"Словарь времени, общий для границ, принимающих часовой пояс вызывающего, выбор настенных часов или прошедшее время: canonicalClientTimeZone (проверка и канонизация зоны IANA), строгий момент RFC 3339, разрешение локального календаря и зоны, а также промежуток Duration в миллисекундах","Timer service for cordis":"Служба таймеров для cordis","tmux context":"Контекст tmux","Token-budgeted tool-result retention with recoverable text and image paths":"Хранение результатов инструментов в пределах бюджета токенов с восстановимыми текстом и путями к изображениям","Token-meter-driven compaction policy and LLM summarization backend for the DeepSeek Harness":"Политика сжатия по счётчику токенов и суммаризация через LLM","Tool registry and execution pipeline for the DeepSeek Harness":"Реестр инструментов и конвейер выполнения","Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins":"Политика тайм-аута вызова инструмента: дедлайн на каждый инструмент и ошибка TOOL_TIMEOUT","Tool-independent managed DSH_* shell environment registry":"Реестр переменных окружения DSH_*, не зависящий от инструментов","Track each Session's change requests with their checks and reviews, and start new Sessions in a Git worktree; uses the gh CLI for GitHub.":"Отслеживает запросы изменения каждой сессии вместе с их проверками и рецензиями и запускает новые сессии в рабочем дереве Git; для GitHub использует gh CLI.","Trajectory event ledger and timing overview with live tool-result inspection":"Журнал событий траектории и обзор времени с просмотром результатов инструментов в реальном времени","Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service)":"Журнал событий траектории с интерактивным обзором времени: плагин для ViewMap разговора (без сервиса)","Transcribe recordings into text locally with SenseVoice.":"Локальная расшифровка записей в текст с SenseVoice.","Transcribe recordings locally with SenseVoice; first use requires installing dependencies":"Локальная расшифровка записей с SenseVoice; при первом использовании нужно установить зависимости","Transcribe recordings locally with SenseVoice; first use requires installing dependencies.":"Распознавание записей локально с SenseVoice; при первом использовании нужно установить зависимости.","Translate text and reuse translations saved in the session.":"Перевод текста с повторным использованием сохранённых в сессии переводов.","Translates expanded Think rows into your chosen language as the agent writes them, and View original switches back.":"Переводит раскрытые строки размышлений на выбранный язык по мере их написания агентом; «Показать оригинал» возвращает исходный текст.","Translation service":"Сервис перевода","Type driven schema validator":"Валидатор схем по типам","Typed, plugin-extensible context menus with captured targets and shared Web presentation":"Типизированные контекстные меню с расширением через плагины, захваченными целями и общим представлением для Web","Typert Remote Host dispatcher and Client API endpoint":"Диспетчер Remote Host и точка входа клиентского API Typert","TypeScript client SDK for driving a DeepSeek Harness runtime subprocess over stdio JSON-RPC: the DeepSeekHarness high-level turns API and the lower-level HarnessClient":"TypeScript SDK для управления рантаймом DeepSeek Harness через JSON-RPC stdio: высокоуровневый API DeepSeekHarness и HarnessClient","TypeScript project analyzer and model-driven Typert artifact generator":"Анализатор TypeScript-проектов и генератор артефактов Typert по модели","Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook":"Единая модель ресурсов клиента: провайдеры превращают URL в живые значения через хук useResource","Unified Web @file and @session reference source":"Единый источник ссылок @file и @session в вебе","User-approval seam (ctx.approval) for the DeepSeek Harness: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default":"Интерфейс подтверждений (ctx.approval): решения о разрешениях передаются собранным обработчикам, по умолчанию отказ при сбое","User-facing permission presets (ctx.permissionPresets) for the DeepSeek Harness: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events":"Пресеты разрешений (ctx.permissionPresets): единый выбор «Разрешения», объединяющий режим песочницы и политику подтверждений","View team members and shared tasks, and navigate to member conversations.":"Просмотр участников команды и общих задач с переходом к разговорам участников.","View, create, replace, and insert text through the filesystem service.":"Просмотр, создание, замена и вставка текста через файловый сервис.","Voice input":"Голосовой ввод","Voice recording":"Запись голоса","Web \"Open In...\" controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file":"Кнопки «Открыть в…» в вебе: открытие каталога рабочей области в установленном приложении и выбор приложения для файла","Web Agent Teams roster, task board, and teammate navigation":"Состав участников Agent Teams, доска задач и навигация по участникам команды в веб-интерфейсе","Web application entry: vite build over the @deepseek-ai/dsh-client-web shell library; dist/ served by apps/cli's dsh web":"Точка входа веб-приложения: сборка vite над библиотекой dsh-client-web; dist/ раздаёт dsh web","Web ask_user_question composer takeover and plan-review presentation UI":"Перехват поля ввода для ask_user_question и показ плана на проверку","Web band above the prompt for Claude Code mods: draws each session's mod tree and sends button presses back to the bridge":"Веб-панель над полем ввода для модов Claude Code: дерево модов сессии и кнопки, отправляющие нажатия в мост","Web boot kernel: static module table, Cordis loader, framework-free boot page, and UI-renderer handoff":"Загрузочное ядро веба: таблица модулей, загрузчик Cordis, страница запуска без фреймворка и передача отрисовщику","Web client graph synchronization and rebuilt-bundle reload transport":"Синхронизация графа веб-клиента и перезагрузка пересобранных бандлов","Web display masking for recognized credentials in sent user text":"Маскирование распознанных учётных данных в отправляемом тексте пользователя в веб-интерфейсе","Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts":"Плагин маршрутов веба: HTTP и upgrade-маршруты, изменения индекса и статический dist; не знает о Harness","Web route-registration plugin: HTTP and upgrade routes, per-Peer index transform taps, and static dist fallback":"Плагин регистрации веб-маршрутов: HTTP-маршруты и маршруты обновления соединения, перехваты преобразования индекса для каждого пира и отдача статической сборки","Web Session-log export command and shared download dialog":"Экспорт журнала сессии в вебе и общий диалог скачивания","Web Session-log ZIP export and Session Markdown copy":"Экспорт журнала веб-сессии в ZIP и копирование сессии в Markdown","Web skill references and the dedicated skill tool row":"Ссылки на навыки в вебе и отдельная строка инструмента skill","When you ask how to do something in this app or say a capability is missing, recommends the built-in plugin that provides it below the answer; Enable turns it on for every conversation, and you can turn it off on the Plugins page.":"Если вы спрашиваете, как что-то сделать в приложении, или говорите, что не хватает возможности, рекомендует под ответом встроенный плагин, который её даёт; «Включить» включает его для всех диалогов, а выключить можно на странице «Плагины».","Whole-log conversation counts and wall times projection (sessionStats) for the DeepSeek Harness":"Проекция счётчиков разговора и времени по всему журналу (sessionStats)","Whole-log turn outline projection (turnOutline) for the DeepSeek Harness":"Проекция структуры ходов по всему журналу (turnOutline)","Windows ACL write-restriction sandbox backend (restricted-token spawn with capability-SID write allowlist) for the DeepSeek Harness sandbox seam":"Бэкенд песочницы Windows ACL: запуск с ограниченным токеном и списком разрешённой записи","Workflow capability seam: ctx.workflowEngine service, run vocabulary, and workflow/* events":"Интерфейс workflow: служба ctx.workflowEngine, типы запусков и события workflow/*","Workflow orchestration in the shared sandboxed Node PTC runtime":"Оркестрация workflow в общей песочнице Node PTC","Working directory tools":"Инструменты рабочего каталога","Workspace context loader for AGENTS.md/CLAUDE.md instruction files":"Подхватывает правила проекта из AGENTS.md и CLAUDE.md и передаёт их агенту","Workspace dependencies":"Зависимости рабочей области","Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the DeepSeek Harness":"Реестр рабочих областей (ctx.workspaceRegistry): долговременные записи с проверкой привязки сессии","Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace":"Служба файлов рабочей области и провайдер ресурсов клиента: чтение с ограничениями, список каталогов и живые метаданные","Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar":"Вкладка дерева файлов в правой панели: ленивый список каталогов и открытие файлов в боковой панели","Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots":"Плагин выбора рабочей области: WorkspacePicker в боковой панели и пустом состоянии","Workspace Remote commands and reconnect-safe state transport":"Команды Remote рабочей области и транспорт состояния, устойчивый к переподключению","Workspace-authorized model-facing session history search, trace, and event read tools":"Инструменты поиска, трассировки и чтения истории сессий с проверкой рабочей области","Worktree service":"Сервис рабочих деревьев","Writes a session's title from all of your messages and updates it when the main task changes, instead of only from the first message.":"Составляет название сессии по всем вашим сообщениям и обновляет его при смене основной задачи, а не только по первому сообщению.","Zero-dependency atomic file replacement: exclusive-create random-suffix temp + rename carrying the caller-stated permissions (writeFileAtomic)":"Атомарная замена файлов без зависимостей: временный файл с уникальным суффиксом и rename с заданными правами","Zero-dependency bounded-retention primitive: ItemRetainer/TextRetainer + neutral notice helpers (what did we keep, what did we omit)":"Примитив ограниченного хранения без зависимостей: ItemRetainer/TextRetainer и уведомления о том, что сохранено и что отброшено","Zero-dependency browser-safe UUID and byte-encoding helpers":"UUID и кодирование байтов без зависимостей, безопасно для браузера","Zero-dependency circular deque with amortized constant-time end operations and bounded vacant storage":"Кольцевая очередь без зависимостей с амортизированно постоянными операциями на концах","Zero-dependency time vocabulary shared by wire boundaries: canonicalClientTimeZone (IANA zone validation and canonicalization only, no formatting)":"Общие типы времени для границ передачи: canonicalClientTimeZone (проверка и канонизация IANA, без форматирования)","Zero-dependency timeout/deadline primitive: clampTimeout, deadline, timeoutOf, TimeoutReason (timing + classification only, no termination)":"Примитив тайм-аута без зависимостей: clampTimeout, deadline, timeoutOf, TimeoutReason (только время и классификация)"};

		/** Parameter names that carry a countable value, most specific first. */
		const COUNT_PARAMETERS = ["n", "count", "total", "size"];

		/**
		 * Classifies a count by Russian plural rules.
		 * @param value - the number the copy agrees with.
		 * @returns the CLDR plural category for Russian.
		 */
		/** CLDR plural rules for Russian, created once; null when Intl is unusable. */
		let pluralRules;

		function pluralCategory(value) {
			if (pluralRules === undefined && typeof Intl !== "undefined" && typeof Intl.PluralRules === "function") {
				try {
					pluralRules = new Intl.PluralRules("ru");
				} catch {
					pluralRules = null;
				}
			}
			if (pluralRules !== undefined && pluralRules !== null) return pluralRules.select(value);
			const mod10 = Math.abs(value) % 10;
			const mod100 = Math.abs(value) % 100;
			if (mod10 === 1 && mod100 !== 11) return "one";
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
			return "many";
		}

		/**
		 * Reads a number out of one parameter. Components often pass an already
		 * formatted count ("12.5K", "1 234"), which still carries the number the
		 * copy has to agree with.
		 * @param value - the parameter value.
		 * @returns the parsed count, or undefined.
		 */
		function parseCount(value) {
			if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
			if (typeof value !== "string") return undefined;
			const normalized = value.replace(/[\s\u00a0\u202f]/g, "").replace(/,/, ".");
			const match = /^\d+(?:\.\d+)?/.exec(normalized);
			if (match === null) return undefined;
			const parsed = Number(match[0]);
			return Number.isFinite(parsed) ? parsed : undefined;
		}

		/**
		 * Finds the countable parameter of one translate call.
		 * @param params - the interpolation parameters.
		 * @returns the number used for agreement and the text to interpolate.
		 */
		function countParameter(params) {
			if (params === undefined || params === null) return undefined;
			const candidates = COUNT_PARAMETERS.map((name) => params[name]).concat(Object.values(params));
			for (const value of candidates) {
				const number = parseCount(value);
				if (number !== undefined) return { number, text: String(value) };
			}
			return undefined;
		}

		/**
		 * Substitutes `{name}` placeholders exactly like the locale runtime does,
		 * and additionally fills any count placeholder the caller named
		 * differently (`{n}` against a `count` parameter and the reverse).
		 * @param template - the selected template.
		 * @param params - the interpolation parameters.
		 * @param count - the countable value of the call, when it carries one.
		 * @returns the rendered string.
		 */
		function interpolate(template, params, countText) {
			if (params === undefined || params === null) {
				return countText === undefined ? template : template.replace(/\{\w+\}/g, (match) => match === "{n}" ? countText : match);
			}
			return template.replace(/\{(\w+)\}/g, (match, name) => {
				if (name in params) return String(params[name]);
				if (countText !== undefined && COUNT_PARAMETERS.indexOf(name) !== -1) return countText;
				return match;
			});
		}

		/**
		 * Selects one form out of a `|`-separated plural value.
		 * @param forms - one, two (`few|many`), or three (`one|few|many`) forms.
		 * @param category - the CLDR plural category.
		 * @returns the selected form.
		 */
		function selectForm(forms, category) {
			if (forms.length === 1) return forms[0];
			if (forms.length === 2) return category === "few" ? forms[0] : forms[1];
			if (category === "one") return forms[0];
			if (category === "few") return forms[1];
			return forms[2];
		}

		/**
		 * Installs plural selection on the locale runtime prototype, so every bound
		 * translate function — including the framework `t` seat — follows it.
		 * @param locale - the `locale` service instance.
		 * @returns the disposer restoring the original method.
		 */
		function installPluralForms(locale, occupied) {
			const prototype = Object.getPrototypeOf(locale);
			const original = prototype.translate;
			if (typeof original !== "function") return () => {};
			if (Object.prototype.hasOwnProperty.call(prototype, "__dshLocaleRuPlural")) return prototype.__dshLocaleRuPlural;
			const patched = function (ns, key, params) {
				if (locale.getSnapshot().active !== LANGUAGE.id) return original.call(this, ns, key, params);
				// DSH 0.2.2+ registers its own (tiny) Russian dictionaries for a few
				// namespaces and rejects ours, so for those the pack resolves from its
				// own table first and falls back to the built-in copy for missing keys.
				if (occupied.has(ns)) {
					const own = Object.prototype.hasOwnProperty.call(DICTIONARIES, ns)
						? DICTIONARIES[ns][key]
						: undefined;
					if (typeof own === "string" && own.length > 0) {
						const count = countParameter(params);
						const category = count === undefined ? "many" : pluralCategory(count.number);
						return interpolate(selectForm(own.split("|"), category), params, count === undefined ? undefined : count.text);
					}
				}
				const raw = original.call(this, ns, key, undefined);
				if (typeof raw !== "string" || raw.indexOf("|") === -1) return original.call(this, ns, key, params);
				const forms = raw.split("|");
				const count = countParameter(params);
				if (count === undefined) return interpolate(selectForm(forms, "many"), params);
				const category = pluralCategory(count.number);
				let template;
				if (category === "one" && forms.length === 2) {
					const sibling = key.replace(/\.other$/, ".one");
					template = sibling !== key ? original.call(this, ns, sibling, undefined) : forms[0];
				} else {
					template = selectForm(forms, category);
				}
				if (typeof template !== "string" || template.indexOf("|") !== -1) template = forms[0];
				return interpolate(template, params, count.text);
			};
			const restore = () => {
				if (prototype.translate === patched) {
					prototype.translate = original;
					delete prototype.__dshLocaleRuPlural;
				}
			};
			prototype.translate = patched;
			prototype.__dshLocaleRuPlural = restore;
			return restore;
		}

		/**
		 * Resolves plugin display metadata for Russian without touching any other
		 * locale: `resolveText` is the single point every LocalizedText passes
		 * through, and only strings present in the table are replaced.
		 * @param locale - the `locale` service instance.
		 * @returns the disposer restoring the original method.
		 */
		function installPluginText(locale) {
			const prototype = Object.getPrototypeOf(locale);
			const original = prototype.resolveText;
			if (typeof original !== "function") return () => {};
			if (Object.prototype.hasOwnProperty.call(prototype, "__dshLocaleRuMeta")) return prototype.__dshLocaleRuMeta;
			const patched = function (text) {
				const resolved = original.call(this, text);
				if (this.getSnapshot().active !== LANGUAGE.id) return resolved;
				return Object.prototype.hasOwnProperty.call(PLUGIN_TEXT, resolved) ? PLUGIN_TEXT[resolved] : resolved;
			};
			const restore = () => {
				if (prototype.resolveText === patched) {
					prototype.resolveText = original;
					delete prototype.__dshLocaleRuMeta;
				}
			};
			prototype.resolveText = patched;
			prototype.__dshLocaleRuMeta = restore;
			return restore;
		}

		/** Required service: the extensible locale catalog. */
		const inject = ["locale"];

		/**
		 * Registers the Russian language, its dictionaries, and plural selection.
		 * @param ctx - client Cordis context carrying the `locale` service.
		 */
		/**
		 * DSH 0.2.2+ ships its own Russian catalog: `addLanguage` and `register`
		 * reject an id or a namespace locale that already exists. The pack then
		 * complements the built-in catalog instead of replacing it, so both steps
		 * ignore an occupied slot and keep the built-in copy for it.
		 * @param task - registration returning its disposer.
		 * @returns the disposer, or a no-op when the slot is already taken.
		 */
		/** Ports the host half listens on for the personal dictionary (see the host template). */
		const DICTIONARY_PORTS = [47118, 47119, 47120, 47121, 47122];
		/** Last port that answered: avoids scanning five ports on every request. */
		let knownHostPort;
		function hostPortOrder() {
			if (knownHostPort === undefined || !DICTIONARY_PORTS.includes(knownHostPort)) return DICTIONARY_PORTS;
			return [knownHostPort, ...DICTIONARY_PORTS.filter((port) => port !== knownHostPort)];
		}
		function markHostPort(port) {
			knownHostPort = port;
		}

		/**
		 * Adds a "+ в словарь" chip next to a text selection inside an editable
		 * field: the corrected word goes to the personal hotwords dictionary of the
		 * host half, so the engine recognises it next time. The chip is explicit —
		 * nothing is corrected silently.
		 * @returns disposer that removes the chip and its listeners.
		 */
		/** Shared toast element and its timer. */
		let sharedToast;
		let sharedToastTimer;

		/** Shows a short confirmation at the bottom of the window. */
		function showToast(text, ok, action) {
			if (typeof document === "undefined" || typeof document.createElement !== "function" || document.body === undefined) return;
			if (sharedToast !== undefined) {
				if (typeof sharedToast.remove === "function") sharedToast.remove();
				sharedToast = undefined;
			}
			sharedToast = document.createElement("div");
			sharedToast.textContent = text;
			sharedToast.style.cssText = "position:fixed;z-index:2147483647;padding:6px 12px;border-radius:999px;"
				+ "background:" + (ok ? "rgba(28,92,58,.96)" : "rgba(92,28,28,.96)") + ";color:#fff;"
				+ "font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
				+ "box-shadow:0 2px 10px rgba(0,0,0,.35);transition:opacity .2s;"
				+ "pointer-events:" + (action === undefined ? "none" : "auto");
			if (action !== undefined) {
				// Действие в тосте: «Вернуть», «Повторить» и т.п.
				const button = document.createElement("span");
				button.setAttribute("role", "button");
				button.textContent = ` · ${action.label}`;
				button.style.cssText = "cursor:pointer;text-decoration:underline;margin-left:2px;font-weight:700";
				button.addEventListener("click", () => {
					if (sharedToast !== undefined && typeof sharedToast.remove === "function") sharedToast.remove();
					sharedToast = undefined;
					action.onClick();
				});
				sharedToast.appendChild(button);
			}
			sharedToast.style.left = "50%";
			sharedToast.style.transform = "translateX(-50%)";
			sharedToast.style.bottom = "84px";
			document.body.appendChild(sharedToast);
			clearTimeout(sharedToastTimer);
			sharedToastTimer = setTimeout(() => {
				if (sharedToast !== undefined) {
					sharedToast.style.opacity = "0";
					setTimeout(() => {
						if (sharedToast !== undefined && typeof sharedToast.remove === "function") sharedToast.remove();
						sharedToast = undefined;
					}, 220);
				}
			}, action === undefined ? 1800 : 6000);
		}

		/** When the last replacement notice was shown, to avoid repeats. */
		let replacementNoticeAt = 0;

		/**
		 * Shows a notice when the dictation text contains learned replacements:
		 * the host applied them, and the user must see what changed.
		 * @param editable - the composer element.
		 */
		async function notifyReplacements(editable) {
			if (editable === null || editable === undefined) return;
			if (Date.now() - replacementNoticeAt < 5000) return;
			const dictionary = await fetchDictionary();
			const pairs = Object.entries(dictionary.replacements ?? {});
			if (pairs.length === 0) return;
			let text = String(editable.innerText ?? "").toLowerCase();
			// Если известна вставка — проверяем только её, а не весь черновик.
			if (dictationInsertion !== null) {
				const current = String(editable.innerText ?? "");
				if (current.startsWith(dictationInsertion.prefix) && current.endsWith(dictationInsertion.suffix)) {
					text = current.slice(dictationInsertion.prefix.length, current.length - dictationInsertion.suffix.length).toLowerCase();
				}
			}
			const applied = pairs.filter(([, chosen]) => chosen !== "" && text.includes(String(chosen).toLowerCase()));
			if (applied.length === 0) return;
			replacementNoticeAt = Date.now();
			const detail = applied.slice(0, 2).map(([heard, chosen]) => `${heard} → ${chosen}`).join(", ");
			showToast(`Словарь: заменено ${applied.length}${applied.length === 1 ? "" : ""}: ${detail}`, true);
		}

		/** Composer element seen last; used by the dictation hooks. */
		let lastComposer = null;
		/** Composer text right before the dictation insertion. */
		let dictationBeforeText = null;
		/** Captured insertion: prefix + inserted + suffix, for auto-learning. */
		let dictationInsertion = null;
		/** When the insertion was captured. */
		let dictationInsertedAt = 0;
		/** Session id captured when the current recording started. */
		let dictationSessionId;
		/** Whether the caret fix still waits for the insertion mutation. */
		let caretFixPending = false;
		/** Debounce timer for auto-learning. */
		let learnTimer;

		/** Recovery state for dictations whose transcript never reached a composer. */
		let recoveryTimer;
		let recoveryPanel;
		let recoveryQueue = [];
		let recoveryCurrent;
		let recoveryTitle;
		let recoveryText = "";
		let recoveryWatchTimer;
		let recoveryProcessing = false;
		let pendingDictations = [];
		const RECOVERY_STORAGE_KEY = "dsh-locale-ru-recovery";

		/** Reads the current DSH session id, when the app exposes it. */
		function currentSessionId() {
			try {
				const raw = localStorage.getItem("dsh.sessions.current");
				if (raw === null || raw === "") return undefined;
				const parsed = JSON.parse(raw);
				return typeof parsed?.sessionId === "string" ? parsed.sessionId : undefined;
			} catch (error) {
				return undefined;
			}
		}

		/** Persists the recovery queue; the open panel is stored first. */
		function persistRecoveryQueue() {
			try {
				const items = [];
				if (recoveryCurrent !== undefined) items.push(recoveryCurrent);
				items.push(...recoveryQueue);
				if (items.length === 0) {
					localStorage.removeItem(RECOVERY_STORAGE_KEY);
					return;
				}
				localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({
					items: items.map((item) => ({ at: item.at, endedAt: item.endedAt, text: item.text, session: item.session })),
				}));
			} catch (error) {
				// localStorage недоступен
			}
		}

		/** Drops the stored recovery queue. */
		function clearStoredRecovery() {
			try {
				localStorage.removeItem(RECOVERY_STORAGE_KEY);
			} catch (error) {
				// localStorage недоступен
			}
		}

		/** Removes the panel DOM and stops its watcher. */
		function removeRecoveryPanel() {
			clearInterval(recoveryWatchTimer);
			recoveryWatchTimer = undefined;
			if (recoveryPanel === undefined) return;
			if (typeof recoveryPanel.remove === "function") recoveryPanel.remove();
			else if (recoveryPanel.parentNode) recoveryPanel.parentNode.removeChild(recoveryPanel);
			recoveryPanel = undefined;
		}

		/** Hard-hides recovery: used on dispose and by the debug bridge. */
		function hideRecoveryPanel() {
			removeRecoveryPanel();
			recoveryCurrent = undefined;
			recoveryQueue = [];
			recoveryText = "";
			clearStoredRecovery();
		}

		/** Normalized words, for checking whether the transcript already reached a draft. */
		function recoveryWords(text) {
			return String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/u).filter((word) => word.length >= 3);
		}

		/** Compact normalized text, for exact matching. */
		function recoveryCompact(text) {
			return String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
		}

		/** All composers currently mounted in the app. */
		function recoveryComposers() {
			const roots = [];
			try {
				if (typeof document.querySelectorAll === "function") roots.push(...document.querySelectorAll("[contenteditable=true]"));
			} catch (error) {
				// фолбэк ниже
			}
			if (roots.length === 0 && document.body !== undefined && document.body !== null) {
				const stack = [...(document.body.children ?? [])];
				while (stack.length > 0) {
					const element = stack.pop();
					if (element === null || element === undefined) continue;
					if (typeof element.getAttribute === "function" && element.getAttribute("contenteditable") === "true") roots.push(element);
					stack.push(...(element.children ?? []));
				}
			}
			return roots;
		}

		/**
		 * True when some composer already contains the recovered transcript.
		 * Вставка идёт по span, зафиксированному до записи: если он устарел,
		 * стоковый плагин возвращает false, но текст мог появиться другим путём
		 * (поздняя вставка, ChronoFlow, ручная правка). Показывать панель и
		 * тем более вставлять повторно в этом случае нельзя — иначе дубль.
		 */
		/** Counts transcript words found in order in the draft (greedy subsequence). */
		function orderedWordMatches(words, haystackWords) {
			let pointer = 0;
			let matched = 0;
			for (const word of words) {
				let index = pointer;
				while (index < haystackWords.length && haystackWords[index] !== word) index += 1;
				if (index >= haystackWords.length) continue;
				matched += 1;
				pointer = index + 1;
			}
			return matched;
		}

		function composerWithText(text) {
			for (const element of recoveryComposers()) {
				if (composerHasText(element, text)) return element;
			}
			return undefined;
		}

		function composerHasText(element, text) {
			const words = recoveryWords(text);
			if (words.length === 0) return false;
			const haystack = String(element.innerText ?? element.textContent ?? "");
			const compactText = recoveryCompact(text).slice(0, 160);
			const compactHaystack = recoveryCompact(haystack);
			if (compactText.length >= 8 && compactHaystack.includes(compactText)) return true;
			const hayWords = recoveryWords(haystack);
			if (words.length <= 4) return orderedWordMatches(words, hayWords) === words.length;
			// Порядок слов важнее набора: иначе две разные диктовки с общими
			// словами («потерянная диктовка про…») выглядят одинаковыми.
			const matched = orderedWordMatches(words, hayWords);
			return matched >= Math.max(5, Math.ceil(words.length * 0.75));
		}

		function composerContainsText(text) {
			return composerWithText(text) !== undefined;
		}

		/** Finds the composer that should receive the recovered text. */
		function activeComposer() {
			const active = document.activeElement;
			if (active !== null && active !== undefined && typeof active.closest === "function") {
				const editable = active.closest("[contenteditable=true]");
				if (editable !== null) return editable;
			}
			if (lastComposer !== null && document.body !== undefined && document.body.contains(lastComposer)) return lastComposer;
			const mounted = recoveryComposers();
			return mounted.length === 1 ? mounted[0] : null;
		}

		/** Moves the caret to the end of an editable, when the editor supports it. */
		function moveCaretToEnd(composer) {
			try {
				const selection = document.getSelection();
				if (!selection || typeof document.createRange !== "function") return;
				const range = document.createRange();
				range.selectNodeContents(composer);
				range.collapse(false);
				selection.removeAllRanges();
				selection.addRange(range);
			} catch (error) {
				// редактор мог размонтироваться
			}
		}

		/**
		 * Inserts recovered text at the end of the live composer.
		 * @param text - transcript to insert.
		 * @param session - session id captured during dictation, when known.
		 * @returns "already" | "wrong-session" | true | false.
		 */
		function insertRecoveredText(text, session) {
			if (composerContainsText(text)) return "already";
			const liveSession = currentSessionId();
			if (typeof session === "string" && session !== "" && typeof liveSession === "string" && liveSession !== "" && session !== liveSession) {
				return "wrong-session";
			}
			const composer = activeComposer();
			if (composer === null) return false;
			const draft = String(composer.innerText ?? composer.textContent ?? "");
			const separator = draft.trim() === "" ? "" : (draft.endsWith("\n") ? "" : "\n\n");
			const inserted = separator + text;
			try {
				composer.focus();
				moveCaretToEnd(composer);
				let ok = false;
				if (typeof document.execCommand === "function" && document.execCommand("insertText", false, inserted)) {
					const after = String(composer.innerText ?? composer.textContent ?? "");
					ok = after.includes(text.slice(0, 24));
				}
				if (!ok) {
					composer.innerText = draft + inserted;
					try {
						if (typeof Event === "function" && typeof composer.dispatchEvent === "function") {
							composer.dispatchEvent(new Event("input", { bubbles: true }));
						}
					} catch (error) {
						// тестовый/упрощённый DOM может не поддерживать Event
					}
					ok = true;
				}
				if (ok) adoptManualInsertion(composer, draft);
				return ok;
			} catch (error) {
				return false;
			}
		}

		/** Small DOM helper for the recovery panel (modalElement lives deeper). */
		function recoveryElement(tag, style, text) {
			const element = document.createElement(tag);
			if (style !== undefined && style !== "") element.style.cssText = style;
			if (text !== undefined) element.textContent = text;
			return element;
		}

		/** Copies the currently shown recovery text to the clipboard. */
		async function copyRecoveredText() {
			try {
				await navigator.clipboard.writeText(recoveryText);
				showToast("Текст скопирован", true);
			} catch (error) {
				showToast("Не удалось скопировать текст", false);
			}
		}

		/** After a manual recovery insertion: enable highlights and auto-learning. */
		function adoptManualInsertion(composer, beforeText) {
			try {
				const after = String(composer.innerText ?? composer.textContent ?? "");
				const insertion = splitInsertion(beforeText, after);
				if (insertion === undefined) return;
				dictationInsertion = insertion;
				dictationInsertedAt = Date.now();
				dictationBeforeText = after;
				dictationHighlightDismissed = false;
				dictationHighlightDrawn = false;
				try {
					void highlightDictationResult(composer);
				} catch (error) {
					// подсветка не критична
				}
				scheduleLearn(composer);
			} catch (error) {
				// не мешаем вставке
			}
		}

		/** Closes the current panel and shows the next queued recovery. */
		function dismissCurrentRecovery() {
			removeRecoveryPanel();
			recoveryCurrent = undefined;
			recoveryText = "";
			persistRecoveryQueue();
			if (recoveryQueue.length > 0) setTimeout(() => {
				if (clientDisposed !== true) showNextRecovery();
			}, 250);
		}

		/** Shows the next queued transcript, skipping ones already in a composer. */
		function showNextRecovery() {
			if (clientDisposed === true) return;
			if (recoveryCurrent !== undefined) return;
			while (recoveryQueue.length > 0) {
				const item = recoveryQueue.shift();
				if (composerContainsText(item.text)) continue;
				recoveryCurrent = item;
				recoveryText = item.text;
				persistRecoveryQueue();
				renderRecoveryPanel();
				startRecoveryWatch();
				return;
			}
			persistRecoveryQueue();
		}

		/** Renders the panel for the current recovery item. */
		function renderRecoveryPanel() {
			if (clientDisposed === true) return;
			removeRecoveryPanel();
			if (recoveryCurrent === undefined) return;
			const text = recoveryCurrent.text;
			const panel = recoveryElement("div", "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:420px;display:flex;flex-direction:column;gap:8px;"
				+ "padding:12px 14px;border-radius:12px;background:rgba(20,20,22,.97);border:1px solid rgba(122,162,255,.4);box-shadow:0 10px 32px rgba(0,0,0,.5);color:#f2f2f5;"
				+ "font:500 12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
			panel.setAttribute("data-dsh-locale-ru-recovery", "");
			const queued = recoveryQueue.length;
			recoveryTitle = recoveryElement("div", "font-weight:700;font-size:13px", queued > 0 ? `Диктовка не попала в поле ввода · ещё ${queued}` : "Диктовка не попала в поле ввода");
			panel.appendChild(recoveryTitle);
			panel.appendChild(recoveryElement("div", "color:#b6c0d2;max-height:120px;overflow:auto;white-space:pre-wrap", text.length > 400 ? `${text.slice(0, 400)}…` : text));
			const actions = recoveryElement("div", "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap");
			const insert = recoveryElement("div", "cursor:pointer;padding:6px 10px;border-radius:8px;background:rgba(40,60,110,.95);color:#fff;font-weight:600", "Вставить");
			insert.setAttribute("role", "button");
			insert.addEventListener("click", () => {
				const result = insertRecoveredText(text, recoveryCurrent?.session);
				if (result === "already") {
					dismissCurrentRecovery();
					showToast("Диктовка уже в поле ввода — вставлять не нужно", true);
				} else if (result === "wrong-session") {
					void copyRecoveredText();
					dismissCurrentRecovery();
					showToast("Диктовка была в другом чате — текст скопирован, вставьте вручную", false);
				} else if (result) {
					dismissCurrentRecovery();
					showToast("Диктовка вставлена в конец поля", true);
				} else {
					showToast("Некуда вставить — текст скопирован. Вставьте в поле ввода", true);
					void copyRecoveredText();
				}
			});
			const copy = recoveryElement("div", "cursor:pointer;padding:6px 10px;border-radius:8px;background:rgba(60,60,66,.9);color:#f2f2f5;font-weight:600", "Скопировать");
			copy.setAttribute("role", "button");
			copy.addEventListener("click", () => void copyRecoveredText());
			const close = recoveryElement("div", "cursor:pointer;padding:6px 10px;border-radius:8px;background:rgba(60,60,66,.65);color:#b6c0d2;font-weight:600", "Закрыть");
			close.setAttribute("role", "button");
			close.addEventListener("click", () => dismissCurrentRecovery());
			actions.appendChild(insert);
			actions.appendChild(copy);
			actions.appendChild(close);
			panel.appendChild(actions);
			if (document.body !== undefined) document.body.appendChild(panel);
			recoveryPanel = panel;
		}

		/** Watches the open panel: late insertion should hide it instead of duplicating. */
		function startRecoveryWatch() {
			clearInterval(recoveryWatchTimer);
			recoveryWatchTimer = setInterval(() => {
				if (recoveryCurrent === undefined) {
					clearInterval(recoveryWatchTimer);
					recoveryWatchTimer = undefined;
					return;
				}
				if (!composerContainsText(recoveryCurrent.text)) return;
				dismissCurrentRecovery();
				showToast("Диктовка появилась в поле ввода — вставлять не нужно", true);
			}, 1500);
		}

		/** Adds one recovered transcript to the queue, skipping duplicates. */
		function enqueueRecovery(item) {
			if (item === null || item === undefined) return;
			if (clientDisposed === true) return;
			const text = String(item.text ?? "");
			if (text.trim() === "") return;
			if (composerContainsText(text)) return;
			const same = (entry) => entry !== undefined && recoveryCompact(entry.text) === recoveryCompact(text);
			if (same(recoveryCurrent) || recoveryQueue.some(same)) return;
			const at = Number(item.at) || Date.now();
			recoveryQueue.push({
				text,
				at,
				endedAt: Number(item.endedAt) || at,
				session: typeof item.session === "string" ? item.session : undefined,
			});
			while (recoveryQueue.length > 10) recoveryQueue.shift();
			persistRecoveryQueue();
			if (recoveryCurrent !== undefined) {
				if (recoveryTitle !== undefined) recoveryTitle.textContent = `Диктовка не попала в поле ввода · ещё ${recoveryQueue.length}`;
			} else {
				showNextRecovery();
			}
		}

		/** Public/debug entry point: queue a transcript for recovery. */
		function showRecoveryPanel(text, at) {
			enqueueRecovery({ text, at: Number(at) || Date.now(), endedAt: Number(at) || Date.now(), session: currentSessionId() });
		}

		/** Fetches all recent host transcriptions newer than `after`. */
		async function fetchTranscriptionsAfter(after) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/transcriptions?after=${encodeURIComponent(String(after))}`, { signal: AbortSignal.timeout(1500) });
					if (!response.ok) continue;
					markHostPort(port);
					const payload = await response.json();
					return Array.isArray(payload?.items) ? payload.items : [];
				} catch (error) {
					// следующий порт
				}
			}
			return [];
		}

		/** Promise-based sleep for the recovery scheduler. */
		function recoverySleep(ms) {
			return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
		}

		/**
		 * Maps transcripts to pending dictations without stealing a neighbour's
		 * text when one recognition failed. Mirror of the host helper, kept on
		 * the client because the pending list lives here.
		 */
		function assignTranscriptsToPending(pending, transcripts, graceMs = 500) {
			const entries = [...pending].sort((left, right) => left.endedAt - right.endedAt);
			const items = [...transcripts]
				.filter((item) => Number.isFinite(item?.at) && typeof item?.text === "string" && item.text !== "")
				.sort((left, right) => left.at - right.at);
			const assignments = new Map();
			for (const item of items) {
				for (let index = 0; index < entries.length; index += 1) {
					const entry = entries[index];
					if (assignments.has(entry) || entry.transcript !== undefined) continue;
					if (item.at <= entry.endedAt) continue;
					const next = entries.slice(index + 1).find((candidate) => !assignments.has(candidate));
					if (next !== undefined && item.at > next.endedAt + graceMs) continue;
					assignments.set(entry, item);
					break;
				}
			}
			return assignments;
		}

		/**
		 * Processes pending dictations one by one: maps each to its own host
		 * transcript entry, waits for the stock insertion, and queues recovery
		 * only when the text really is absent from the composer.
		 */
		async function processPendingRecoveries() {
			if (recoveryProcessing) return;
			if (clientDisposed === true) return;
			recoveryProcessing = true;
			try {
				while (true) {
					if (clientDisposed === true) break;
					const now = Date.now();
					pendingDictations = pendingDictations.filter((entry) => entry.resolved !== true && now - entry.endedAt < 60000);
					const entry = pendingDictations.find((candidate) => candidate.resolved !== true);
					if (entry === undefined) break;
					if (entry.transcript === undefined) {
						const pending = pendingDictations.filter((candidate) => candidate.resolved !== true);
						const oldest = Math.min(...pending.map((candidate) => candidate.endedAt));
						const items = await fetchTranscriptionsAfter(oldest);
						const assignments = assignTranscriptsToPending(pending, items);
						for (const [candidate, item] of assignments) candidate.transcript = item;
						if (entry.transcript === undefined) {
							await recoverySleep(700);
							continue;
						}
					}
					// Даём стоковой вставке и ChronoFlow время завершиться.
					await recoverySleep(2500);
					if (!composerContainsText(entry.transcript.text)) {
						enqueueRecovery({
							text: entry.transcript.text,
							at: entry.transcript.at,
							endedAt: entry.endedAt,
							session: entry.session,
						});
					} else if (entry.endedAt === dictationEndedAt && typeof entry.beforeText === "string") {
						const composer = composerWithText(entry.transcript.text);
						if (composer !== undefined) adoptManualInsertion(composer, entry.beforeText);
					}
					entry.resolved = true;
				}
			} finally {
				recoveryProcessing = false;
			}
		}

		/** Starts or restarts the recovery scheduler. */
		function scheduleRecoveryProcessing(delay = 600) {
			clearTimeout(recoveryTimer);
			recoveryTimer = setTimeout(() => {
				void processPendingRecoveries();
			}, delay);
		}

		/** Restores stored recovery items after an app reload. */
		function restoreStoredRecovery() {
			try {
				const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
				if (raw === null || raw === "") return;
				const parsed = JSON.parse(raw);
				const items = Array.isArray(parsed?.items)
					? parsed.items
					: (typeof parsed?.text === "string" ? [parsed] : []);
				const now = Date.now();
				for (const item of items) {
					if (typeof item?.text !== "string" || item.text.trim() === "") continue;
					if (now - (Number(item.at) || 0) > 30 * 60 * 1000) continue;
					enqueueRecovery({
						text: item.text,
						at: Number(item.at) || now,
						endedAt: Number(item.endedAt) || Number(item.at) || now,
						session: typeof item.session === "string" ? item.session : undefined,
					});
				}
			} catch (error) {
				// битые данные — просто забываем
			}
		}

		try {
			globalThis.__dshLocaleRuRecovery = {
				show: showRecoveryPanel,
				hide: hideRecoveryPanel,
				restore: restoreStoredRecovery,
			};
		} catch (error) {
			// среда без globalThis
		}

		// Окна DSH делят localStorage: если recovery очистили в другом окне,
		// здесь панель тоже должна исчезнуть, иначе текст вставят дважды.
		try {
			if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
				window.addEventListener("storage", (event) => {
					if (event === null || event === undefined || event.key !== RECOVERY_STORAGE_KEY) return;
					if (event.newValue !== null && event.newValue !== "") return;
					removeRecoveryPanel();
					recoveryCurrent = undefined;
					recoveryQueue = [];
					recoveryText = "";
				});
			}
		} catch (error) {
			// среда без window
		}

		/** Marks the moment a dictation recording ended; the insertion follows. */
		function markDictationEnded(durationMs) {
			const endedAt = Date.now();
			dictationEndedAt = endedAt;
			dictationHighlightDismissed = false;
			dictationHighlightDrawn = false;
			clearDictationHighlights();
			caretFixPending = true;
			dictationInsertion = null;
			dictationInsertedAt = 0;
			dictationBeforeText = lastComposer === null ? null : String(lastComposer.innerText ?? "");
			if (Number(durationMs) < 500) return;
			pendingDictations.push({
				endedAt,
				session: dictationSessionId ?? currentSessionId(),
				beforeText: dictationBeforeText,
				resolved: false,
				transcript: undefined,
			});
			if (pendingDictations.length > 12) {
				pendingDictations = pendingDictations.filter((entry) => entry.resolved !== true).slice(-12);
			}
			scheduleRecoveryProcessing(600);
		}

		/**
		 * Splits the text change into prefix / inserted / suffix using the common
		 * prefix and suffix of the before and after texts.
		 * @param before - composer text before the insertion.
		 * @param after - composer text after the insertion.
		 * @returns the parts, or undefined when nothing was inserted.
		 */
		function splitInsertion(before, after) {
			if (typeof before !== "string" || typeof after !== "string" || after.length <= before.length) return undefined;
			let prefix = 0;
			while (prefix < before.length && before[prefix] === after[prefix]) prefix += 1;
			let suffix = 0;
			while (suffix < before.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
			const inserted = after.slice(prefix, after.length - suffix);
			if (inserted.trim() === "") return undefined;
			return { prefix: after.slice(0, prefix), inserted, suffix: suffix === 0 ? "" : after.slice(after.length - suffix) };
		}

		/** Strips punctuation around a word. */
		function trimWord(word) {
			return String(word).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
		}

		/** Text that should never be learned: links, paths, code, numbers. */
		const LEARN_NOISE = /(https?:\/\/|www\.|[\/\\_@#$%^&*()\[\]{}<>|`~]|\d)/iu;

		/** Russian function words: a correction between them is grammar, not terminology. */
		const RUSSIAN_STOPWORDS = new Set([
			"и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все",
			"она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по",
			"только", "ее", "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из",
			"ему", "теперь", "когда", "даже", "ну", "вдруг", "ли", "если", "уже", "или",
			"ни", "быть", "был", "него", "до", "вас", "нибудь", "опять", "уж", "вам", "ведь",
			"там", "потом", "себя", "ничего", "ей", "может", "они", "тут", "где", "есть",
			"надо", "ней", "для", "мы", "тебя", "их", "чем", "была", "сам", "чтоб", "без",
			"будто", "чего", "раз", "тоже", "себе", "под", "будет", "ж", "тогда", "кто",
			"этот", "того", "потому", "этого", "какой", "совсем", "ним", "здесь", "этом",
			"один", "почти", "мой", "тем", "чтобы", "нее", "сейчас", "были", "куда", "зачем",
			"всех", "никогда", "можно", "при", "наконец", "два", "об", "другой", "хоть",
			"после", "над", "больше", "тот", "через", "эти", "нас", "про", "всего", "них",
			"какая", "много", "разве", "три", "эту", "моя", "впрочем", "хорошо", "свою",
			"этой", "перед", "иногда", "лучше", "чуть", "том", "нельзя", "такой", "им",
			"более", "всегда", "конечно", "всю", "между",
		]);

		/** True for a pair that looks like a real misrecognition correction. */
		function learnablePair(heard, chosen) {
			const left = heard.toLowerCase();
			const right = chosen.toLowerCase();
			if (RUSSIAN_STOPWORDS.has(left) || RUSSIAN_STOPWORDS.has(right)) return false;
			// Склонение/окончание («сделал» → «сделала») — грамматика, не термин.
			if (right.startsWith(left) || left.startsWith(right)) return false;
			// Совсем другое слово — это смысловая правка, её не учим.
			if (similarity(heard, chosen) < 0.45) return false;
			return true;
		}

		/**
		 * Pairs changed words between the inserted and the edited text. Only
		 * same-length word lists are compared, so a rewrite of the whole phrase
		 * is not learned.
		 * @param inserted - text the dictation inserted.
		 * @param edited - the same region after the user edited it.
		 * @returns heard → chosen pairs.
		 */
		function pairChangedWords(inserted, edited) {
			const left = String(inserted).split(/\s+/u).filter((word) => word !== "");
			const right = String(edited).split(/\s+/u).filter((word) => word !== "");
			if (left.length === 0) return [];
			const pairs = [];
			if (left.length === right.length) {
				for (let index = 0; index < left.length; index += 1) {
					const heard = trimWord(left[index]);
					const chosen = trimWord(right[index]);
					if (heard === chosen) continue;
					if (heard.length < 2 || chosen.length < 2 || heard.length > 64 || chosen.length > 64) continue;
					if (LEARN_NOISE.test(heard) || LEARN_NOISE.test(chosen)) continue;
					if (!learnablePair(heard, chosen)) continue;
					pairs.push({ heard, chosen });
				}
				return pairs;
			}
			// Пользователь склеил два слова в одно («гит хаб» → GitHub) или наоборот.
			if (left.length === 2 && right.length === 1) {
				const heard = `${trimWord(left[0])} ${trimWord(left[1])}`;
				const chosen = trimWord(right[0]);
				if (heard.length > 2 && chosen.length > 1 && similarity(heard, chosen) >= 0.6 && !LEARN_NOISE.test(chosen) && learnablePair(heard, chosen)) {
					pairs.push({ heard, chosen });
				}
				return pairs;
			}
			if (left.length === 1 && right.length === 2) {
				const heard = trimWord(left[0]);
				const chosen = `${trimWord(right[0])} ${trimWord(right[1])}`;
				if (heard.length > 1 && chosen.length > 2 && similarity(heard, chosen) >= 0.6 && !LEARN_NOISE.test(heard) && learnablePair(heard, chosen)) {
					pairs.push({ heard, chosen });
				}
				return pairs;
			}
			return [];
		}

		/**
		 * Asks the user before learning a pair that is not an obvious
		 * misrecognition (similarity below 0.8). Returns true to learn it.
		 * @param pairs - heard → chosen pairs.
		 * @returns whether the user confirmed.
		 */
		function confirmLearn(pairs) {
			return new Promise((resolve) => {
				if (typeof document === "undefined" || typeof document.createElement !== "function" || document.body === undefined) {
					resolve(false);
					return;
				}
				const panel = document.createElement("div");
				panel.setAttribute("data-dsh-locale-ru-learn", "");
				panel.style.cssText = "position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);bottom:84px;"
					+ "padding:8px;border-radius:12px;background:rgba(20,20,22,.97);"
					+ "border:1px solid rgba(122,162,255,.35);box-shadow:0 6px 22px rgba(0,0,0,.45);"
					+ "display:flex;flex-direction:column;gap:4px;min-width:240px;max-width:340px";
				const title = document.createElement("div");
				title.textContent = "Запомнить исправление?";
				title.style.cssText = "padding:2px 8px;color:#8a8a95;font:500 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
				panel.appendChild(title);
				for (const pair of pairs.slice(0, 3)) {
					const row = document.createElement("div");
					row.textContent = `${pair.heard} → ${pair.chosen}`;
					row.style.cssText = "padding:4px 8px;color:#f2f2f5;font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
						+ "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
					panel.appendChild(row);
				}
				const actions = document.createElement("div");
				actions.style.cssText = "display:flex;gap:6px;padding:2px 4px 0";
				const makeButton = (label, value) => {
					const button = document.createElement("div");
					button.setAttribute("role", "button");
					button.textContent = label;
					button.style.cssText = "flex:1;text-align:center;padding:6px 10px;border-radius:8px;cursor:pointer;"
						+ "color:#f2f2f5;font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
						+ "background:" + (value ? "rgba(28,92,58,.9)" : "rgba(60,60,66,.9)");
					button.addEventListener("mousedown", (event) => {
						event.preventDefault();
					});
					button.addEventListener("click", () => {
						if (typeof panel.remove === "function") panel.remove();
						resolve(value);
					});
					return button;
				};
				actions.appendChild(makeButton("Запомнить", true));
				actions.appendChild(makeButton("Не надо", false));
				panel.appendChild(actions);
				document.body.appendChild(panel);
			});
		}

		/** Schedules a check for user edits of the last dictation text. */
		function scheduleLearn(editable) {
			if (dictationInsertion === null || editable === null || editable === undefined) return;
			clearTimeout(learnTimer);
			learnTimer = setTimeout(() => {
				void learnEdits(editable);
			}, 900);
		}

		/**
		 * Learns corrections the user made to the dictated text: compares the
		 * captured insertion with the current composer text and posts changed
		 * words to the host (chosen word joins the dictionary, the pair joins the
		 * replacements). Nothing is learned outside the post-dictation window.
		 * @param editable - the composer element.
		 */
		async function learnEdits(editable) {
			const insertion = dictationInsertion;
			if (insertion === null) return;
			// Пользователь мог выключить авто-обучение в настройках диктовки.
			const settings = await (globalThis.__dshLocaleRuSettings?.fetch?.() ?? { autoLearn: true });
			if (settings.autoLearn === false) return;
			if (Date.now() - dictationInsertedAt > 60000) {
				dictationInsertion = null;
				return;
			}
			const current = String(editable.innerText ?? "");
			if (!current.startsWith(insertion.prefix) || !current.endsWith(insertion.suffix)) return;
			const edited = current.slice(insertion.prefix.length, current.length - insertion.suffix.length);
			if (edited === insertion.inserted) return;
			const pairs = pairChangedWords(insertion.inserted, edited);
			if (pairs.length === 0) return;
			const confident = pairs.filter((pair) => similarity(pair.heard, pair.chosen) >= 0.8);
			const uncertain = pairs.filter((pair) => similarity(pair.heard, pair.chosen) < 0.8);
			const learned = [];
			for (const pair of confident) {
				const result = await postDictionary("/learn", { ...pair, source: "auto" });
				if (result !== undefined && result.ok) learned.push(pair);
			}
			if (uncertain.length > 0 && await confirmLearn(uncertain)) {
				for (const pair of uncertain) {
					const result = await postDictionary("/learn", pair);
					if (result !== undefined && result.ok) learned.push(pair);
				}
			}
			// Обновляем сохранённую вставку, чтобы не учить одну пару повторно.
			dictationInsertion = { ...insertion, inserted: edited };
			if (learned.length > 0) {
				dictionaryCache.at = 0;
				showToast(`Выучено: ${learned.map((pair) => `${pair.heard} → ${pair.chosen}`).join(", ")}`, true);
			}
		}

		/** Cyrillic → Latin map for phonetic matching of dictated terms. */
		const TRANSLIT = {
			"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
			"ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
			"н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
			"ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
			"ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
		};
		/** How long the fetched dictionary stays fresh. */
		const DICTIONARY_CACHE_MS = 30000;
		/** Cached dictionary: words and heard → chosen replacements. */
		let dictionaryCache = { at: 0, words: [], replacements: {} };

		/** Transliterates Cyrillic text to Latin. */
		function transliterate(value) {
			return Array.from(String(value ?? "")).map((character) => TRANSLIT[character.toLowerCase()] ?? character).join("");
		}

		/** Normalizes a term for comparison: Latin letters and digits only. */
		function normalizeTerm(value) {
			return transliterate(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
		}

		/** Levenshtein distance between two strings. */
		function editDistance(left, right) {
			const rows = left.length + 1;
			const columns = right.length + 1;
			let previous = new Array(columns);
			let current = new Array(columns);
			for (let column = 0; column < columns; column += 1) previous[column] = column;
			for (let row = 1; row < rows; row += 1) {
				current[0] = row;
				for (let column = 1; column < columns; column += 1) {
					const cost = left[row - 1] === right[column - 1] ? 0 : 1;
					current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
				}
				const swap = previous;
				previous = current;
				current = swap;
			}
			return previous[columns - 1];
		}

		/** Similarity of two terms in [0, 1], comparing phonetic forms. */
		function similarity(heard, term) {
			const left = normalizeTerm(heard);
			const right = normalizeTerm(term);
			if (left === "" || right === "") return 0;
			if (left === right) return 1;
			const distance = editDistance(left, right);
			return 1 - distance / Math.max(left.length, right.length);
		}

		/**
		 * Picks replacement candidates for a heard word.
		 * @param heard - the selected word as recognized.
		 * @param dictionary - words and replacements from the host.
		 * @param limit - how many candidates to return.
		 * @returns candidates sorted by similarity.
		 */
		function pickCandidates(heard, dictionary, limit = 5) {
			const scored = [];
			for (const term of dictionary.words ?? []) {
				const score = similarity(heard, term);
				if (score >= 0.5) scored.push({ term, score, kind: "word" });
			}
			for (const [from, to] of Object.entries(dictionary.replacements ?? {})) {
				const score = similarity(heard, from);
				if (score >= 0.5) scored.push({ term: to, score: Math.min(1, score + 0.05), kind: "replacement" });
			}
			scored.sort((left, right) => right.score - left.score);
			const seen = new Set();
			const result = [];
			for (const candidate of scored) {
				const key = candidate.term.toLowerCase();
				if (seen.has(key)) continue;
				seen.add(key);
				result.push(candidate);
				if (result.length >= limit) break;
			}
			return result;
		}

		/** Fetches the dictionary from the host half, cached for a short time. */
		async function fetchDictionary() {
			if (Date.now() - dictionaryCache.at < DICTIONARY_CACHE_MS) return dictionaryCache;
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/dictionary`, { signal: AbortSignal.timeout(1200) });
					if (!response.ok) continue;
					markHostPort(port);
					const data = await response.json();
					dictionaryCache = {
						at: Date.now(),
						words: Array.isArray(data.words) ? data.words : [],
						replacements: data.replacements !== null && typeof data.replacements === "object" ? data.replacements : {},
						sources: data.sources !== null && typeof data.sources === "object" ? data.sources : {},
					};
					return dictionaryCache;
				} catch (error) {
					// порт не слушается — пробуем следующий
				}
			}
			return dictionaryCache;
		}

		/** Posts a JSON payload to the first responding dictionary port. */
		async function postDictionary(path, payload) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}${path}`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify(payload),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/**
		 * Replaces the current selection in the composer. The editor is Lexical,
		 * so the replacement goes through execCommand, which the editor treats as
		 * a regular text input.
		 * @param text - replacement text.
		 * @returns whether the browser accepted the edit.
		 */
		function replaceSelection(text) {
			try {
				const selection = document.getSelection();
				if (!selection || selection.rangeCount === 0) return false;
				return document.execCommand("insertText", false, text);
			} catch (error) {
				return false;
			}
		}

		/** Overlay highlights of the last dictation: {range, element, kind}. */
		let dictationHighlights = [];
		/** How long after insertion highlights may be drawn (ms). */
		const HIGHLIGHT_WINDOW_MS = 10000;
		/** The user dismissed highlights (typing/click): do not redraw them. */
		let dictationHighlightDismissed = false;
		/** Highlights were already drawn for the current insertion. */
		let dictationHighlightDrawn = false;
		/** Timer that hides highlights after a while. */
		let highlightClearTimer;
		/** Applied replacements of the last dictation: chosen → heard. */
		let lastAppliedReplacements = {};
		/** Hook set by the popover: opens it for the current selection. */
		let openSelectionPopover = () => {};

		/** Clears highlight overlays. */
		function clearDictationHighlights() {
			clearTimeout(highlightClearTimer);
			highlightClearTimer = undefined;
			for (const entry of dictationHighlights) {
				const element = entry.element ?? entry;
				if (typeof element.remove === "function") element.remove();
				else if (element.parentNode) element.parentNode.removeChild(element);
			}
			dictationHighlights = [];
		}

		/** Collects text nodes of the editable. */
		function textNodesOf(root, out = []) {
			for (const node of root.childNodes ?? []) {
				if (node.nodeType === 3) out.push(node);
				else if (node.nodeType === 1) textNodesOf(node, out);
			}
			return out;
		}

		/**
		 * Builds a flat text map of the editable: concatenated text and node
		 * offsets, so a range can be created from character offsets.
		 * @param editable - contenteditable element.
		 * @returns the text and node positions.
		 */
		function textMapOf(editable) {
			const nodes = [];
			const starts = [];
			let text = "";
			const BLOCK = /^(DIV|P|LI|UL|OL|TR|TD|TH|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|FIGURE|TABLE|TBODY|THEAD)$/u;
			const append = (node) => {
				starts.push(text.length);
				nodes.push(node);
				text += String(node.data ?? "");
			};
			const walk = (element) => {
				for (const child of element.childNodes ?? []) {
					if (child.nodeType === 3) {
						append(child);
						continue;
					}
					if (child.nodeType !== 1) continue;
					const tag = String(child.tagName ?? "").toUpperCase();
					if (tag === "BR") {
						text += "\n";
						continue;
					}
					const block = BLOCK.test(tag);
					// innerText разделяет блоки переводами строк — повторяем это,
					// иначе вставка с абзацами не находится в текстовой карте.
					if (block && text !== "" && !text.endsWith("\n")) text += "\n";
					walk(child);
					if (block && !text.endsWith("\n")) text += "\n";
				}
			};
			walk(editable);
			return { text, nodes, starts };
		}

		/** Creates a DOM range for character offsets in the text map. */
		function rangeFromOffsets(map, start, end) {
			if (start < 0 || end > map.text.length || start >= end) return undefined;
			let startNode;
			let startOffset = 0;
			let endNode;
			let endOffset = 0;
			for (let index = 0; index < map.nodes.length; index += 1) {
				const nodeStart = map.starts[index];
				const nodeEnd = nodeStart + String(map.nodes[index].data ?? "").length;
				if (startNode === undefined && start >= nodeStart && start < nodeEnd) {
					startNode = map.nodes[index];
					startOffset = start - nodeStart;
				}
				if (end >= nodeStart && end <= nodeEnd) {
					endNode = map.nodes[index];
					endOffset = end - nodeStart;
					break;
				}
			}
			if (startNode === undefined || endNode === undefined) return undefined;
			try {
				const range = document.createRange();
				range.setStart(startNode, startOffset);
				range.setEnd(endNode, endOffset);
				return range;
			} catch (error) {
				return undefined;
			}
		}

		/** Collapses whitespace runs to one space (for innerText/map comparison). */
		function collapseWhitespace(value) {
			return String(value ?? "").replace(/\s+/gu, " ").trim();
		}

		/**
		 * Builds a whitespace-collapsed copy of the text plus a map back to the
		 * original offsets: needed because innerText and the text map disagree on
		 * newlines around block elements.
		 * @param text - original text.
		 * @returns normalized text and original offsets.
		 */
		function normalizeWithPositions(text) {
			let normalized = "";
			const positions = [];
			let lastSpace = true;
			for (let index = 0; index < text.length; index += 1) {
				const character = text[index];
				if (/\s/u.test(character)) {
					if (!lastSpace) {
						normalized += " ";
						positions.push(index);
						lastSpace = true;
					}
					continue;
				}
				normalized += character;
				positions.push(index);
				lastSpace = false;
			}
			// Хвостовой пробел не нужен: он мешает сравнениям.
			if (normalized.endsWith(" ")) {
				normalized = normalized.slice(0, -1);
				positions.pop();
			}
			return { text: normalized, positions };
		}

		/**
		 * Locates the inserted dictation fragment inside the current text.
		 * The fragment must be recent: highlights are a short-lived hint, not a
		 * permanent decoration.
		 * @param map - text map of the editable.
		 * @returns start/end offsets of the inserted text.
		 */
		function locateInsertedFragment(map) {
			if (dictationInsertion === null || dictationInsertion === undefined) return undefined;
			if (dictationInsertedAt === 0 || Date.now() - dictationInsertedAt > HIGHLIGHT_WINDOW_MS) return undefined;
			const inserted = String(dictationInsertion.inserted ?? "");
			if (inserted === "") return undefined;
			const prefix = String(dictationInsertion.prefix ?? "");
			const suffix = String(dictationInsertion.suffix ?? "");
			// innerText и карта текста расходятся в переводах строк (<p> даёт
			// пустую строку, <br> съедает пробел), поэтому сравниваем по
			// нормализованным пробелам с обратным отображением позиций.
			const normalized = normalizeWithPositions(map.text);
			const needle = collapseWhitespace(inserted);
			if (needle === "") return undefined;
			const prefixNorm = collapseWhitespace(prefix);
			const suffixNorm = collapseWhitespace(suffix);
			const expected = prefixNorm.length;
			let best;
			let bestDistance = Number.POSITIVE_INFINITY;
			let index = normalized.text.indexOf(needle);
			while (index !== -1) {
				// +1 — запас на пробел-разделитель после нормализации.
				const before = normalized.text.slice(Math.max(0, index - prefixNorm.length - 1), index).trimEnd();
				const after = normalized.text.slice(index + needle.length, index + needle.length + suffixNorm.length + 1).trimStart();
				// Окружение должно совпасть: без этого после удаления вставки
				// подсветился бы такой же текст в другом месте.
				if (before.endsWith(prefixNorm) && after.startsWith(suffixNorm)) {
					const distance = Math.abs(index - expected);
					if (distance < bestDistance) {
						best = index;
						bestDistance = distance;
					}
				}
				index = normalized.text.indexOf(needle, index + 1);
			}
			if (best === undefined) return undefined;
			const start = normalized.positions[best];
			const endIndex = best + needle.length - 1;
			const end = normalized.positions[Math.min(endIndex, normalized.positions.length - 1)] + 1;
			if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
			return { start, end };
		}

		/**
		 * Finds a whole-word occurrence inside [from, to) of the text map.
		 * @returns the character offsets, or undefined.
		 */
		function findWordOffsets(map, word, from, to) {
			const needle = String(word).toLowerCase();
			if (needle === "") return undefined;
			const lower = map.text.toLowerCase();
			const boundary = (character) => /[^\p{L}\p{N}]/u.test(character);
			let index = lower.indexOf(needle, from);
			while (index !== -1 && index + needle.length <= to) {
				const before = index === 0 ? " " : map.text[index - 1];
				const after = index + needle.length >= map.text.length ? " " : map.text[index + needle.length];
				if (boundary(before) && boundary(after)) return { start: index, end: index + needle.length };
				index = lower.indexOf(needle, index + needle.length);
			}
			return undefined;
		}

		/** Repositions overlays after scroll/resize; drops detached ranges. */
		function refreshHighlightPositions() {
			if (dictationHighlights.length === 0) return;
			for (const entry of dictationHighlights) {
				let rect;
				try {
					rect = entry.range.getBoundingClientRect();
				} catch (error) {
					clearDictationHighlights();
					return;
				}
				if (!rect || rect.width === 0) {
					clearDictationHighlights();
					return;
				}
				entry.element.style.left = `${rect.left - 1}px`;
				entry.element.style.top = `${rect.top - 1}px`;
				entry.element.style.width = `${rect.width + 2}px`;
				entry.element.style.height = `${rect.height + 2}px`;
			}
		}

		/** Draws a highlight overlay over a range; a click selects the word. */
		function drawHighlight(range, kind) {
			let rect;
			try {
				rect = range.getBoundingClientRect();
			} catch (error) {
				return;
			}
			if (!rect || rect.width === 0) return;
			const element = document.createElement("div");
			element.setAttribute("data-dsh-locale-ru-highlight", kind);
			element.style.cssText = "position:fixed;z-index:2147483645;pointer-events:auto;cursor:pointer;"
				+ "background:" + (kind === "replaced" ? "rgba(122,162,255,.22)" : "rgba(240,190,60,.25)") + ";"
				+ "border-bottom:2px dashed " + (kind === "replaced" ? "rgba(122,162,255,.9)" : "rgba(240,190,60,.95)") + ";"
				+ "border-radius:3px";
			element.style.left = `${rect.left - 1}px`;
			element.style.top = `${rect.top - 1}px`;
			element.style.width = `${rect.width + 2}px`;
			element.style.height = `${rect.height + 2}px`;
			element.addEventListener("click", () => {
				try {
					const selection = document.getSelection();
					selection.removeAllRanges();
					selection.addRange(range);
				} catch (error) {
					// выделение не удалось — просто убираем подсветку
				}
				clearDictationHighlights();
				openSelectionPopover();
			});
			if (document.body !== undefined) document.body.appendChild(element);
			dictationHighlights.push({ range, element, kind });
		}

		/**
		 * Keeps overlays in place and removes them when the text changes or the
		 * user clicks elsewhere: a highlight is a short-lived hint, not a
		 * permanent decoration.
		 * @returns disposer that removes the listeners.
		 */
		function installHighlightMaintenance() {
			if (typeof document === "undefined" || typeof document.addEventListener !== "function") return () => {};
			const onScroll = () => refreshHighlightPositions();
			const onResize = () => refreshHighlightPositions();
			const onPointerDown = (event) => {
				if (dictationHighlights.length === 0) return;
				const target = event !== null && event !== undefined ? event.target : null;
				if (target === null || target === undefined) return;
				const inside = dictationHighlights.some((entry) => {
					const element = entry.element ?? entry;
					if (typeof element.contains === "function" && element.contains(target)) return true;
					return element === target;
				});
				if (!inside) {
					dictationHighlightDismissed = true;
					clearDictationHighlights();
				}
			};
			const onInput = () => {
				dictationHighlightDismissed = true;
				clearDictationHighlights();
			};
			document.addEventListener("scroll", onScroll, true);
			document.addEventListener("pointerdown", onPointerDown, true);
			document.addEventListener("input", onInput, true);
			if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
				window.addEventListener("resize", onResize);
			}
			return () => {
				document.removeEventListener("scroll", onScroll, true);
				document.removeEventListener("pointerdown", onPointerDown, true);
				document.removeEventListener("input", onInput, true);
				if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
					window.removeEventListener("resize", onResize);
				}
				clearDictationHighlights();
			};
		}

		/** Fetches info about the last transcription from the host. */
		async function fetchLastTranscription() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/last-transcription`, { signal: AbortSignal.timeout(1200) });
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// порт не слушается — пробуем следующий
				}
			}
			return undefined;
		}

		/**
		 * Highlights applied replacements and suggests terms for suspicious words.
		 * Only the freshly inserted dictation fragment is decorated: scanning the
		 * whole composer used to highlight old words and made the overlays jump.
		 */
		async function highlightDictationResult(editable) {
			if (editable === null || editable === undefined) return;
			if (dictationInsertion === null || dictationInsertedAt === 0) return;
			if (dictationHighlightDismissed || dictationHighlightDrawn) return;
			if (Date.now() - dictationInsertedAt > HIGHLIGHT_WINDOW_MS) return;
			const info = await fetchLastTranscription();
			if (dictationHighlightDismissed) return;
			if (info === null || info === undefined) return;
			// Устаревшая транскрипция (диктовки подряд, печать) не подсвечивается.
			if (typeof info.at === "number" && typeof dictationEndedAt === "number" && info.at < dictationEndedAt - 2000) return;
			const map = textMapOf(editable);
			const fragment = locateInsertedFragment(map);
			if (fragment === undefined) return;
			clearDictationHighlights();
			const applied = Array.isArray(info.applied) ? info.applied : [];
			lastAppliedReplacements = {};
			for (const pair of applied) {
				const chosen = String(pair.chosen ?? "");
				if (chosen === "") continue;
				lastAppliedReplacements[chosen.toLowerCase()] = String(pair.heard ?? "");
				const offsets = findWordOffsets(map, chosen, fragment.start, fragment.end);
				if (offsets === undefined) continue;
				const range = rangeFromOffsets(map, offsets.start, offsets.end);
				if (range !== undefined) drawHighlight(range, "replaced");
			}
			// Подсказки: слова внутри вставки, похожие на термины словаря.
			const dictionary = await fetchDictionary();
			if (dictationHighlightDismissed) return;
			const seen = new Set();
			const fragmentText = map.text.slice(fragment.start, fragment.end);
			for (const match of fragmentText.matchAll(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]{3,}/gu)) {
				const token = match[0];
				const lower = token.toLowerCase();
				if (seen.has(lower)) continue;
				// Уже подсвечено как заменённое — второй подсветки не нужно.
				if (lastAppliedReplacements[lower] !== undefined) continue;
				// Латинские искажения («gighab») похожи слабее — порог ниже.
				const threshold = /[A-Za-z]/u.test(token) ? 0.65 : 0.72;
				const candidates = pickCandidates(token, dictionary, 3).filter((candidate) => candidate.kind === "word"
					&& candidate.score >= threshold
					&& candidate.term.toLowerCase() !== lower);
				if (candidates.length === 0) continue;
				seen.add(lower);
				const absolute = fragment.start + match.index;
				const offsets = findWordOffsets(map, token, absolute, absolute + token.length);
				if (offsets === undefined) continue;
				const range = rangeFromOffsets(map, offsets.start, offsets.end);
				if (range !== undefined) drawHighlight(range, "suggestion");
			}
			if (dictationHighlights.length > 0) {
				dictationHighlightDrawn = true;
				clearTimeout(highlightClearTimer);
				highlightClearTimer = setTimeout(() => clearDictationHighlights(), 15000);
			}
		}

		/**
		 * Shows a popover next to a text selection in the composer: candidate
		 * replacements from the personal dictionary plus "add to dictionary".
		 * Picking a candidate replaces the selection and teaches the pair.
		 * @returns disposer that removes the popover and its listeners.
		 */
		function installDictionaryChip() {
			if (typeof document === "undefined" || typeof document.addEventListener !== "function") return () => {};
			if (typeof document.createElement !== "function") return () => {};
			let panel;
			let panelPhrase = "";
			let current = "";
			let selectionTimer;
			let removed = false;

			/** Removes the popover. */
			function hidePanel() {
				if (panel === undefined) return;
				if (typeof panel.remove === "function") panel.remove();
				else if (panel.parentNode) panel.parentNode.removeChild(panel);
				panel = undefined;
				panelPhrase = "";
			}

			/** Builds one clickable row of the popover. */
			function buildRow(label, onPick) {
				const row = document.createElement("div");
				row.setAttribute("role", "button");
				row.textContent = label;
				row.style.cssText = "padding:8px 12px;border-radius:9px;cursor:pointer;color:#f2f2f5;"
					+ "font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
					+ "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
				row.addEventListener("mousedown", (event) => {
					event.preventDefault();
				});
				row.addEventListener("click", () => {
					hidePanel();
					void onPick();
				});
				return row;
			}

		/** Modal state: words, replacements and the current query. */
		let dictionaryModal;

		/** Creates a styled element. */
		function modalElement(tag, cssText, textContent) {
			const element = document.createElement(tag);
			if (cssText !== undefined) element.style.cssText = cssText;
			if (textContent !== undefined) element.textContent = textContent;
			return element;
		}

		/** Closes the dictionary modal. */
		function closeDictionaryModal() {
			dictionaryOpenGeneration += 1;
			if (dictionaryModal === undefined) return;
			const { backdrop } = dictionaryModal;
			if (typeof backdrop.remove === "function") backdrop.remove();
			else if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
			dictionaryModal = undefined;
		}

		/** Adds comma/newline separated words to the dictionary. */
		async function addWordsToList(raw) {
			const wordsToAdd = String(raw ?? "")
				.split(/[\n,;]+/u)
				.map((word) => word.trim())
				.filter((word) => word !== "")
				.slice(0, 50);
			if (wordsToAdd.length === 0) {
				showToast("Введите слово", false);
				return 0;
			}
			let added = 0;
			for (const word of wordsToAdd) {
				const result = await postDictionary("/hotwords", word);
				if (result !== undefined && result.ok) added += 1;
			}
			dictionaryCache.at = 0;
			if (dictionaryModal !== undefined) {
				const nextField1 = await fetchDictionary();
				if (dictionaryModal === undefined) return;
				dictionaryModal.dictionary = nextField1;
				renderDictionaryModal();
			}
			showToast(added > 0 ? `Добавлено: ${added}` : "Не удалось добавить", added > 0);
			return added;
		}

		/** Fetches the engine settings from the host. */
		async function fetchEngineInfo() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/engine`, { signal: AbortSignal.timeout(1200) });
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Saves the engine choice through the host. */
		async function saveEngineChoice(engine, merge) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/engine`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify({ engine, merge }),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Fetches term suggestions from the host (garbled terms from transcripts). */
		async function fetchSuggestions() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/suggestions`, { signal: AbortSignal.timeout(1500) });
					if (!response.ok) continue;
					markHostPort(port);
					const payload = await response.json();
					return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
				} catch (error) {
					// следующий порт
				}
			}
			return [];
		}

		/** Fetches auto-learned pairs awaiting review. */
		/** True when the review queue file is corrupt: the UI must warn the user. */
		let reviewCorrupt = false;

		async function fetchReview() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/review`, { signal: AbortSignal.timeout(1500) });
					if (!response.ok) continue;
					markHostPort(port);
					const payload = await response.json();
					reviewCorrupt = payload?.corrupt === true;
					return Array.isArray(payload?.pairs) ? payload.pairs : [];
				} catch (error) {
					// следующий порт
				}
			}
			return [];
		}

		/** Words that look like fragments of longer words («Harness» → «DeepSeek Harness»). */
		function findFragmentWords(words) {
			const result = [];
			for (const word of words) {
				const lower = word.toLowerCase();
				if (lower.length < 3) continue;
				const longer = words.find((other) => {
					if (other === word || other.length <= word.length) return false;
					const otherLower = other.toLowerCase();
					const index = otherLower.indexOf(lower);
					if (index === -1) return false;
					// «GitHub» ⊂ «GitHub Actions» — нормальная составная фраза, не обрывок.
					if (index === 0 && /^\s/u.test(otherLower.slice(lower.length))) return false;
					return true;
				});
				if (longer !== undefined) result.push({ word, longer });
			}
			return result;
		}

		/** Asks the agent to review transcripts and extend the dictionary. */
		function requestAgentCoaching() {
			const prompt = "Проверь последние диктовки в ~/.dsh/speech-ru/transcripts.json: "
				+ "сравни GigaAM и Whisper, найди искажённые термины и добавь нужные слова и замены в словарь. "
				+ "Проверь, что замены не слишком широкие, и прогони тесты.";
			try {
				void navigator.clipboard.writeText(prompt);
				showToast("Запрос скопирован — вставьте в чат с агентом", true);
			} catch (error) {
				showToast("Не удалось скопировать запрос", false);
			}
		}

		/** Voice-input settings: cached auto-learn flag. */
		let settingsCache = { at: 0, autoLearn: true };

		/** Fetches voice-input settings from the host. */
		async function fetchSettings() {
			if (Date.now() - settingsCache.at < 30000) return settingsCache;
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/settings`, { signal: AbortSignal.timeout(1200) });
					if (!response.ok) continue;
					markHostPort(port);
					const payload = await response.json();
					settingsCache = { at: Date.now(), autoLearn: payload?.autoLearn !== false };
					return settingsCache;
				} catch (error) {
					// следующий порт
				}
			}
			return settingsCache;
		}

		/** Saves the auto-learn toggle. */
		async function saveAutoLearn(value) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/settings`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify({ autoLearn: value }),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
					markHostPort(port);
					settingsCache = { at: Date.now(), autoLearn: value };
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Fetches dynamic dictionary profiles. */
		async function fetchProfiles() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/profiles`, { signal: AbortSignal.timeout(1500) });
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Switches the active dynamic dictionary. */
		async function switchProfileById(id) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/profiles/switch`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify({ id }),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Creates a dynamic dictionary from the current one. */
		async function createProfileByName(name) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/profiles/create`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify({ name }),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Deletes a dynamic dictionary. */
		async function deleteProfileById(id) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/profiles/delete`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify({ id }),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Saves one boolean setting (autoLearn / autoSwitch). */
		async function saveSetting(partial) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/settings`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify(partial),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Suggests a matching dynamic dictionary after a dictation. */
		let lastProfileSuggestionAt = 0;
		async function checkProfileSuggestion() {
			const payload = await fetchProfiles();
			// Автопереключение важнее троттлинга подсказок.
			if (payload?.switched !== undefined && payload.switched !== null) {
				lastProfileSuggestionAt = Date.now();
				showToast(`Словарь «${payload.switched.name}» включён автоматически`, true);
				return;
			}
			if (Date.now() - lastProfileSuggestionAt < 30000) return;
			const suggestion = payload?.suggestion;
			if (payload?.autoSwitch === false || payload?.mode === "auto" || suggestion === undefined || suggestion === null) return;
			lastProfileSuggestionAt = Date.now();
			showToast(`Похоже, словарь «${suggestion.name}» — переключить?`, true, {
				label: "Переключить",
				onClick: async () => {
					const result = await switchProfileById(suggestion.id);
					if (result !== undefined && result.ok) {
						dictionaryCache.at = 0;
						showToast(`Словарь «${suggestion.name}» включён`, true);
					} else {
						showToast("Не удалось переключить словарь", false);
					}
				},
			});
		}

		/** Fetches the voice-input status (engine, model, preparation). */
		async function fetchVoiceStatus() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1500) });
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Fetches dictionary usage statistics. */
		async function fetchStats() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/stats`, { signal: AbortSignal.timeout(1500) });
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Removes never-used dictionary words (preview with dryRun). */
		async function pruneDictionary(dryRun = true) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/stats/prune`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify({ dryRun }),
						signal: AbortSignal.timeout(2000),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Imports a dictionary from a URL. */
		async function importDictionaryUrl(url) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/dictionary/import-url`, {
						method: "POST",
						headers: { "content-type": "application/json", "x-dsh-locale-client": "1" },
						body: JSON.stringify({ url }),
						signal: AbortSignal.timeout(15000),
					});
					// 4xx — это ответ нашего хоста (плохой URL, SSRF, лимит),
					// его причину нужно показать, а не перебирать порты.
					if (response.status >= 400 && response.status < 500) {
						return await response.json().catch(() => ({ ok: false, reason: `http-${response.status}` }));
					}
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Runs the health checks. */
		async function fetchDoctor() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/doctor`, { signal: AbortSignal.timeout(2000) });
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Asks the host to prepare the recognition engine and model. */
		async function prepareModel() {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/model/prepare`, {
						method: "POST",
						headers: { "x-dsh-locale-client": "1" },
						signal: AbortSignal.timeout(2000),
					});
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Settings window state. */
		let voiceSettingsModal;

		/** Closes the settings window. */
		function closeVoiceSettingsModal() {
			voiceSettingsGeneration += 1;
			if (voiceSettingsModal === undefined) return;
			clearInterval(voiceSettingsModal.poll);
			const { backdrop } = voiceSettingsModal;
			if (typeof backdrop.remove === "function") backdrop.remove();
			else if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
			voiceSettingsModal = undefined;
		}

		try {
			globalThis.__dshLocaleRuCloseWindows = () => {
				closeDictionaryModal();
				closeVoiceSettingsModal();
			};
		} catch (error) {
			// среда без globalThis
		}

		/** Toggles the settings window. */
		function toggleVoiceSettingsModal() {
			if (voiceSettingsModal !== undefined) closeVoiceSettingsModal();
			else void openVoiceSettingsModal();
		}

		/** Renders the settings window: engine, auto-learn, model, doctor, limits. */
		function renderVoiceSettingsModal() {
			if (voiceSettingsModal === undefined) return;
			const { body, status, doctor } = voiceSettingsModal;
			while (body.firstChild !== undefined && body.firstChild !== null) body.removeChild(body.firstChild);
			const section = (title) => {
				body.appendChild(modalElement("div", "padding:12px 4px 4px;color:#8a8a95;font:600 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-transform:uppercase;letter-spacing:.04em", title));
			};
			const line = (text, ok) => {
				const row = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;border-radius:8px;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
				row.appendChild(modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", text));
				row.appendChild(modalElement("span", "flex:none;font-weight:700;color:" + (ok ? "#9fe6b4" : "#e69f9f"), ok ? "✓" : "✗"));
				return row;
			};

			// Движок и стратегия.
			section("Движок");
			const engineRow = modalElement("div", "display:flex;gap:6px;padding:2px 4px 4px;flex-wrap:wrap");
			for (const engine of [
				{ id: "auto", label: "Авто (быстро)" },
				{ id: "gigaam", label: "GigaAM" },
				{ id: "whisper", label: "Whisper" },
				{ id: "hybrid", label: "Гибрид" },
			]) {
				const active = status?.engine === engine.id;
				const button = modalElement("div", "cursor:pointer;padding:6px 12px;border-radius:8px;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
					+ "background:" + (active ? "rgba(40,60,110,.95)" : "rgba(60,60,66,.9)") + ";color:#fff", engine.label);
				button.setAttribute("role", "button");
				button.addEventListener("click", async () => {
					const result = await saveEngineChoice(engine.id, status?.merge ?? "sentences");
					if (result !== undefined && result.ok) {
						const nextField2 = await fetchVoiceStatus();
						if (voiceSettingsModal === undefined) return;
						voiceSettingsModal.status = nextField2;
						renderVoiceSettingsModal();
						showToast(`Движок: ${engine.id} — перезапустите приложение`, true);
					} else {
						showToast("Не удалось сохранить движок", false);
					}
				});
				engineRow.appendChild(button);
			}
			body.appendChild(engineRow);
			const strategyRow = modalElement("div", "display:flex;gap:6px;padding:0 4px 6px;flex-wrap:wrap");
			for (const merge of ["sentences", "text", "auto", "words"]) {
				const active = (status?.merge ?? "sentences") === merge;
				const button = modalElement("div", "cursor:pointer;padding:5px 10px;border-radius:8px;font:500 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
					+ "background:" + (active ? "rgba(122,162,255,.25)" : "rgba(60,60,66,.7)") + ";color:#f2f2f5", merge);
				button.setAttribute("role", "button");
				button.addEventListener("click", async () => {
					const result = await saveEngineChoice(status?.engine ?? "hybrid", merge);
					if (result !== undefined && result.ok) {
						const nextField3 = await fetchVoiceStatus();
						if (voiceSettingsModal === undefined) return;
						voiceSettingsModal.status = nextField3;
						renderVoiceSettingsModal();
						showToast(`Стратегия: ${merge} — перезапустите приложение`, true);
					} else {
						showToast("Не удалось сохранить стратегию", false);
					}
				});
				strategyRow.appendChild(button);
			}
			body.appendChild(strategyRow);

			// Авто-обучение.
			section("Авто-обучение");
			const autoLearn = status?.settings?.autoLearn !== false;
			const toggle = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;background:rgba(30,34,44,.9);cursor:pointer;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
			toggle.appendChild(modalElement("span", "", "Запоминать исправления после диктовки"));
			toggle.appendChild(modalElement("span", "flex:none;padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;background:" + (autoLearn ? "rgba(28,92,58,.9)" : "rgba(60,60,66,.9)"), autoLearn ? "включено" : "выключено"));
			toggle.setAttribute("role", "button");
			toggle.addEventListener("click", async () => {
				const result = await saveAutoLearn(!autoLearn);
				if (result !== undefined && result.ok) {
					const nextField4 = await fetchVoiceStatus();
					if (voiceSettingsModal === undefined) return;
					voiceSettingsModal.status = nextField4;
					renderVoiceSettingsModal();
					showToast(result.settings.autoLearn ? "Авто-обучение включено" : "Авто-обучение выключено", true);
				} else {
					showToast("Не удалось сохранить настройку", false);
				}
			});
			body.appendChild(toggle);

			// Динамические словари: контекстные наборы вместо одного лимита.
			section("Динамические словари");
			const profilesPayload = voiceSettingsModal.profiles;
			if (profilesPayload === undefined) {
				body.appendChild(modalElement("div", "padding:4px 10px 6px;color:#8a8a95;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Загрузка…"));
			} else if (profilesPayload === "error") {
				const failure = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 10px 6px;color:#e69f9f;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Не удалось загрузить словари: хост не отвечает.");
				const retry = modalElement("span", "cursor:pointer;color:#9fe6b4;font-weight:700;flex:none", "Повторить");
				retry.setAttribute("role", "button");
				retry.addEventListener("click", async () => {
					if (voiceSettingsModal === undefined) return;
					voiceSettingsModal.profiles = undefined;
					renderVoiceSettingsModal();
					const next = await fetchProfiles();
					if (voiceSettingsModal === undefined) return;
					voiceSettingsModal.profiles = next ?? "error";
					renderVoiceSettingsModal();
				});
				failure.appendChild(retry);
				body.appendChild(failure);
			} else {
				const activeId = profilesPayload.active;
				for (const profile of profilesPayload.profiles ?? []) {
					const activeProfile = profile.id === activeId;
					const row = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;background:"
						+ (activeProfile ? "rgba(40,60,110,.55)" : "rgba(30,34,44,.7)") + ";color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
					row.appendChild(modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", `${profile.name} · ${profile.words} слов · ${profile.replacements} замен`));
					const actions = modalElement("div", "display:flex;gap:10px;flex:none;align-items:center");
					if (activeProfile) {
						actions.appendChild(modalElement("span", "color:#9fe6b4;font-weight:700;font-size:11px", "активен"));
					} else {
						const pick = modalElement("span", "cursor:pointer;color:#9fe6b4;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Переключить");
						pick.setAttribute("role", "button");
						pick.addEventListener("click", async () => {
							const result = await switchProfileById(profile.id);
							if (result !== undefined && result.ok) {
								dictionaryCache.at = 0;
								const nextField5 = await fetchProfiles();
								if (voiceSettingsModal === undefined) return;
								voiceSettingsModal.profiles = nextField5;
								renderVoiceSettingsModal();
								showToast(`Словарь «${profile.name}» включён`, true);
							} else {
								showToast("Не удалось переключить словарь", false);
							}
						});
						const drop = modalElement("span", "cursor:pointer;color:#e69f9f;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Удалить");
						drop.setAttribute("role", "button");
						drop.addEventListener("click", async () => {
							const result = await deleteProfileById(profile.id);
							if (result !== undefined && result.ok) {
								const nextField6 = await fetchProfiles();
								if (voiceSettingsModal === undefined) return;
								voiceSettingsModal.profiles = nextField6;
								renderVoiceSettingsModal();
								showToast(`Словарь «${profile.name}» удалён`, true);
							} else {
								showToast("Не удалось удалить словарь", false);
							}
						});
						actions.appendChild(pick);
						actions.appendChild(drop);
					}
					row.appendChild(actions);
					body.appendChild(row);
				}
				const createRow = modalElement("div", "display:flex;gap:6px;padding:4px 8px 4px");
				const nameInput = modalElement("input", "flex:1;min-width:0;padding:6px 9px;border-radius:8px;border:1px solid rgba(122,162,255,.3);"
					+ "background:rgba(10,10,12,.9);color:#f2f2f5;font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;outline:none");
				nameInput.setAttribute("placeholder", "Новый словарь, например «Проект X»");
				const createButton = modalElement("div", "cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(28,92,58,.95);color:#fff;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Создать");
				createButton.setAttribute("role", "button");
				createButton.addEventListener("click", async () => {
					const name = String(nameInput.value ?? "").trim();
					if (name === "") {
						showToast("Введите название словаря", false);
						return;
					}
					const result = await createProfileByName(name);
					if (result !== undefined && result.ok) {
						dictionaryCache.at = 0;
						const nextField7 = await fetchProfiles();
						if (voiceSettingsModal === undefined) return;
						voiceSettingsModal.profiles = nextField7;
						renderVoiceSettingsModal();
						showToast(`Словарь «${result.name}» создан`, true);
					} else {
						showToast("Не удалось создать словарь", false);
					}
				});
				createRow.appendChild(nameInput);
				createRow.appendChild(createButton);
				body.appendChild(createRow);
				const autoSwitch = profilesPayload.autoSwitch !== false;
				const autoMode = profilesPayload.mode === "auto";
				const modeToggle = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;background:rgba(30,34,44,.9);cursor:pointer;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
				modeToggle.appendChild(modalElement("span", "", "Переключать словарь без вопроса"));
				modeToggle.appendChild(modalElement("span", "flex:none;padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;background:" + (autoMode ? "rgba(28,92,58,.9)" : "rgba(60,60,66,.9)"), autoMode ? "авто" : "подсказка"));
				modeToggle.setAttribute("role", "button");
				modeToggle.addEventListener("click", async () => {
					const result = await saveSetting({ autoSwitchMode: autoMode ? "suggest" : "auto" });
					if (result !== undefined && result.ok) {
						const nextField8 = await fetchProfiles();
						if (voiceSettingsModal === undefined) return;
						voiceSettingsModal.profiles = nextField8;
						renderVoiceSettingsModal();
						showToast(autoMode ? "Буду спрашивать перед переключением" : "Буду переключать автоматически", true);
					} else {
						showToast("Не удалось сохранить настройку", false);
					}
				});
				body.appendChild(modeToggle);
				const switchToggle = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;background:rgba(30,34,44,.9);cursor:pointer;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
				switchToggle.appendChild(modalElement("span", "", "Подсказывать словарь по контексту"));
				switchToggle.appendChild(modalElement("span", "flex:none;padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;background:" + (autoSwitch ? "rgba(28,92,58,.9)" : "rgba(60,60,66,.9)"), autoSwitch ? "включено" : "выключено"));
				switchToggle.setAttribute("role", "button");
				switchToggle.addEventListener("click", async () => {
					const result = await saveSetting({ autoSwitch: !autoSwitch });
					if (result !== undefined && result.ok) {
						const nextField9 = await fetchProfiles();
						if (voiceSettingsModal === undefined) return;
						voiceSettingsModal.profiles = nextField9;
						renderVoiceSettingsModal();
						showToast(result.settings.autoSwitch ? "Подсказки включены" : "Подсказки выключены", true);
					} else {
						showToast("Не удалось сохранить настройку", false);
					}
				});
				body.appendChild(switchToggle);
			}

			// Модель и подготовка.
			section("Модель");
			body.appendChild(line("Движок GigaAM", status?.gigaam?.binary === true));
			body.appendChild(line("Модель GigaAM", status?.gigaam?.model === true));
			body.appendChild(line("Whisper", status?.whisper?.binary === true));
			body.appendChild(line("Модель Whisper", status?.whisper?.model === true));
			const preparation = status?.preparation;
			const preparing = preparation !== undefined && ["checking", "downloading", "loading"].includes(preparation.phase);
			if (preparing) {
				body.appendChild(modalElement("div", "padding:4px 10px 6px;color:#8a8a95;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", `Подготовка: ${preparation.phase}${preparation.resource === undefined ? "" : ` · ${preparation.resource}`}`));
			} else if (status?.gigaam?.model !== true || status?.gigaam?.binary !== true) {
				const prepareButton = modalElement("div", "cursor:pointer;margin:4px 10px 8px;padding:8px 12px;border-radius:9px;background:rgba(40,60,110,.95);color:#fff;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Подготовить движок и модель");
				prepareButton.setAttribute("role", "button");
				prepareButton.addEventListener("click", async () => {
					const result = await prepareModel();
					if (result !== undefined && result.ok) {
						showToast("Подготовка началась", true);
						const nextField10 = await fetchVoiceStatus();
						if (voiceSettingsModal === undefined) return;
						voiceSettingsModal.status = nextField10;
						renderVoiceSettingsModal();
					} else {
						showToast("Не удалось запустить подготовку", false);
					}
				});
				body.appendChild(prepareButton);
			}

			// Доктор.
			section("Доктор");
			const doctorButton = modalElement("div", "cursor:pointer;margin:2px 10px 6px;padding:8px 12px;border-radius:9px;background:rgba(60,60,66,.9);color:#f2f2f5;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Проверить диктовку");
			doctorButton.setAttribute("role", "button");
			doctorButton.addEventListener("click", async () => {
				const result = await fetchDoctor();
				if (voiceSettingsModal === undefined) return;
				if (result === undefined) {
					showToast("Не удалось проверить: хост не отвечает", false);
					return;
				}
				voiceSettingsModal.doctor = result;
				renderVoiceSettingsModal();
				showToast(result.ok === true ? "Всё в порядке" : "Есть проблемы — смотрите список", result.ok === true);
			});
			body.appendChild(doctorButton);
			if (doctor !== undefined) {
				for (const item of doctor.items ?? []) body.appendChild(line(item.label, item.ok === true));
			}

			// Лимиты.
			section("Лимиты");
			body.appendChild(modalElement("div", "padding:2px 10px 8px;color:#8a8a95;font:500 12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Слова: 400 (до 64 символов) · замены: без счётчика · сканирование проекта: 150 · prompt Whisper: 60 терминов"));
			if (status?.dictionary !== undefined) {
				body.appendChild(modalElement("div", "padding:0 10px 10px;color:#6f7c94;font:500 11.5px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", `Сейчас: слов ${status.dictionary.words ?? 0}, замен ${status.dictionary.replacements ?? 0}, в очереди ${status.dictionary.review ?? 0}`));
			}
		}

		/** Opens the settings window. */
		let voiceSettingsOpening = false;
		let voiceSettingsGeneration = 0;
		async function openVoiceSettingsModal() {
			if (voiceSettingsModal !== undefined || voiceSettingsOpening === true) return;
			voiceSettingsOpening = true;
			const generation = ++voiceSettingsGeneration;
			const [status, profiles] = await Promise.all([fetchVoiceStatus(), fetchProfiles()]);
			voiceSettingsOpening = false;
			if (clientDisposed === true || generation !== voiceSettingsGeneration) return;
			const profilesState = profiles ?? "error";
			const backdrop = modalElement("div", "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px");
			const panel = modalElement("div", "width:min(540px,92vw);max-height:80vh;display:flex;flex-direction:column;"
				+ "background:rgba(20,20,22,.98);border:1px solid rgba(122,162,255,.35);border-radius:16px;"
				+ "box-shadow:0 18px 60px rgba(0,0,0,.55);overflow:hidden");
			panel.setAttribute("data-dsh-locale-ru-settings", "");
			panel.addEventListener("mousedown", (event) => event.stopPropagation());
			backdrop.addEventListener("mousedown", (event) => {
				if (event.target === backdrop) closeVoiceSettingsModal();
			});
			const header = modalElement("div", "display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px");
			header.appendChild(modalElement("div", "color:#f2f2f5;font:600 15px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Настройки диктовки"));
			const close = modalElement("div", "cursor:pointer;color:#8a8a95;font-size:18px;line-height:1;padding:2px 6px", "×");
			close.setAttribute("role", "button");
			close.addEventListener("click", () => closeVoiceSettingsModal());
			header.appendChild(close);
			panel.appendChild(header);
			const body = modalElement("div", "flex:1;overflow-y:auto;overscroll-behavior:contain;padding:0 12px 12px;display:flex;flex-direction:column;gap:2px");
			body.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
			panel.appendChild(body);
			const footer = modalElement("div", "display:flex;gap:8px;justify-content:flex-end;padding:10px 16px 14px;border-top:1px solid rgba(255,255,255,.06)");
			const dictionaryButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(60,60,66,.9);color:#f2f2f5;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Словарь");
			dictionaryButton.setAttribute("role", "button");
			dictionaryButton.addEventListener("click", () => {
				closeVoiceSettingsModal();
				void openDictionaryModal();
			});
			const doneButton = modalElement("div", "cursor:pointer;padding:7px 14px;border-radius:9px;background:rgba(40,60,110,.95);color:#fff;"
				+ "font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Готово");
			doneButton.setAttribute("role", "button");
			doneButton.addEventListener("click", () => closeVoiceSettingsModal());
			footer.appendChild(dictionaryButton);
			footer.appendChild(doneButton);
			panel.appendChild(footer);
			backdrop.appendChild(panel);
			if (document.body !== undefined) document.body.appendChild(backdrop);
			voiceSettingsModal = { backdrop, panel, body, status, profiles: profilesState, doctor: undefined, poll: undefined };
			renderVoiceSettingsModal();
			// Пока идёт подготовка — обновляем статус.
			voiceSettingsModal.poll = setInterval(async () => {
				if (voiceSettingsModal === undefined) return;
				const next = await fetchVoiceStatus();
				if (voiceSettingsModal === undefined) return;
				voiceSettingsModal.status = next;
				renderVoiceSettingsModal();
				const preparing = next?.preparation !== undefined && ["checking", "downloading", "loading"].includes(next.preparation.phase);
				if (!preparing) clearInterval(voiceSettingsModal.poll);
			}, 1500);
		}

		/** One-time onboarding hint after the first launch. */
		function maybeShowOnboarding() {
			try {
				if (typeof localStorage === "undefined") return;
				if (localStorage.getItem("dsh-locale-ru-onboarding") === "1") return;
				localStorage.setItem("dsh-locale-ru-onboarding", "1");
			} catch (error) {
				return;
			}
			const backdrop = modalElement("div", "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:24px");
			const panel = modalElement("div", "width:min(460px,92vw);background:rgba(20,20,22,.98);border:1px solid rgba(122,162,255,.35);border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:10px");
			panel.setAttribute("data-dsh-locale-ru-onboarding", "");
			panel.appendChild(modalElement("div", "color:#f2f2f5;font:600 16px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Диктовка готова. Три шага:"));
			panel.appendChild(modalElement("div", "color:#b6c0d2;font:500 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "1. Проверьте модель и движок в настройках диктовки.\n2. Нажмите микрофон в поле ввода и продиктуйте фразу.\n3. Исправьте ошибки в тексте — словарь запомнит термины."));
			const buttons = modalElement("div", "display:flex;gap:8px;justify-content:flex-end;margin-top:4px");
			const openSettings = modalElement("div", "cursor:pointer;padding:8px 12px;border-radius:9px;background:rgba(40,60,110,.95);color:#fff;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Настройки диктовки");
			openSettings.setAttribute("role", "button");
			openSettings.addEventListener("click", () => {
				backdrop.remove?.();
				void openVoiceSettingsModal();
			});
			const close = modalElement("div", "cursor:pointer;padding:8px 12px;border-radius:9px;background:rgba(60,60,66,.9);color:#f2f2f5;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Понятно");
			close.setAttribute("role", "button");
			close.addEventListener("click", () => backdrop.remove?.());
			buttons.appendChild(openSettings);
			buttons.appendChild(close);
			panel.appendChild(buttons);
			backdrop.appendChild(panel);
			if (document.body !== undefined) document.body.appendChild(backdrop);
		}

		try {
			globalThis.__dshLocaleRuOnboarding = maybeShowOnboarding;
			// Настройки объявлены ниже по модулю; мост нужен для вызовов из
			// ранних функций (авто-обучение, горячие клавиши).
			globalThis.__dshLocaleRuSettings = {
				fetch: fetchSettings,
				open: openVoiceSettingsModal,
				toggle: toggleVoiceSettingsModal,
			};
			globalThis.__dshLocaleRuProfiles = { suggest: checkProfileSuggestion };
		} catch (error) {
			// среда без globalThis
		}

		/** Renders the modal content: search, add row, words and replacements. */
		function renderDictionaryModal() {
			if (dictionaryModal === undefined) return;
			const { body, addInput, searchInput, dictionary } = dictionaryModal;
			const query = String(searchInput.value ?? "").trim().toLowerCase();
			const sources = dictionary.sources ?? {};
			const sourceOfWord = (word) => sources.words?.[word] ?? "manual";
			const sourceOfPair = (heard) => sources.replacements?.[heard] ?? "manual";
			const wordFilter = dictionaryModal.wordFilter ?? "all";
			const allWords = (dictionary.words ?? []).filter((word) => query === "" || word.toLowerCase().includes(query));
			const words = allWords.filter((word) => wordFilter === "all" || sourceOfWord(word) === wordFilter);
			const pairs = Object.entries(dictionary.replacements ?? {}).filter(([heard, chosen]) => query === "" || `${heard} ${chosen}`.toLowerCase().includes(query));
			while (body.firstChild !== undefined && body.firstChild !== null) body.removeChild(body.firstChild);

			if (dictionaryModal.hostMissing === true) {
				const failure = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 4px 2px;padding:8px 10px;border-radius:9px;background:rgba(80,30,30,.45);border:1px solid rgba(230,120,120,.3);color:#f0c9c9;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Хост словаря не отвечает: изменения не сохранятся.");
				const retry = modalElement("span", "cursor:pointer;color:#9fe6b4;font-weight:700;flex:none", "Повторить");
				retry.setAttribute("role", "button");
				retry.addEventListener("click", () => {
					closeDictionaryModal();
					setTimeout(() => void openDictionaryModal(), 50);
				});
				failure.appendChild(retry);
				body.appendChild(failure);
			}

			const section = (title, count) => {
				body.appendChild(modalElement("div", "padding:10px 4px 4px;color:#8a8a95;font:600 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-transform:uppercase;letter-spacing:.04em", `${title} (${count})`));
			};
			const row = (label, onRemove, options = {}) => {
				const line = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 10px;border-radius:8px;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
				const text = modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", label);
				if (options.onEdit !== undefined) {
					text.style.cursor = "pointer";
					text.setAttribute("title", "Нажмите, чтобы изменить");
					text.addEventListener("click", () => options.onEdit(text, line));
				}
				line.appendChild(text);
				if (options.hint !== undefined && options.hint !== "") {
					line.appendChild(modalElement("span", "color:#6f7c94;font:500 10.5px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;flex:none", options.hint));
				}
				const remove = modalElement("span", "cursor:pointer;color:#8a8a95;padding:0 4px;font-size:15px;line-height:1", "×");
				remove.setAttribute("role", "button");
				remove.addEventListener("click", onRemove);
				line.appendChild(remove);
				return line;
			};

			const wordStats = (word) => (dictionaryModal.stats?.words ?? []).find((entry) => entry.word === word) ?? { hits: 0 };
			const pairStats = (heard) => (dictionaryModal.stats?.replacements ?? []).find((entry) => entry.heard === heard) ?? { applied: 0 };

			// Активный словарь и быстрое переключение прямо из окна.
			const profilesPayload = dictionaryModal.profiles;
			if (profilesPayload !== undefined) {
				section("Словарь", (profilesPayload.profiles ?? []).length);
				const activeProfile = (profilesPayload.profiles ?? []).find((profile) => profile.id === profilesPayload.active);
				const profileRow = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:8px;background:rgba(40,60,110,.45);color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
				profileRow.appendChild(modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", activeProfile === undefined ? "—" : `${activeProfile.name} · ${activeProfile.words} слов`));
				const toggle = modalElement("span", "cursor:pointer;color:#9fe6b4;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;flex:none", dictionaryModal.profilesOpen === true ? "Скрыть" : "Сменить");
				toggle.setAttribute("role", "button");
				toggle.addEventListener("click", () => {
					dictionaryModal.profilesOpen = dictionaryModal.profilesOpen !== true;
					renderDictionaryModal();
				});
				profileRow.appendChild(toggle);
				body.appendChild(profileRow);
				if (dictionaryModal.profilesOpen === true) {
					for (const profile of profilesPayload.profiles ?? []) {
						if (profile.id === profilesPayload.active) continue;
						const line = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;border-radius:8px;color:#f2f2f5;font:500 12.5px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
						line.appendChild(modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", `${profile.name} · ${profile.words} слов · ${profile.replacements} замен`));
						const pick = modalElement("span", "cursor:pointer;color:#9fe6b4;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;flex:none", "Включить");
						pick.setAttribute("role", "button");
						pick.addEventListener("click", async () => {
							const result = await switchProfileById(profile.id);
							if (result !== undefined && result.ok) {
								dictionaryCache.at = 0;
								const nextField11 = await fetchDictionary();
								if (dictionaryModal === undefined) return;
								dictionaryModal.dictionary = nextField11;
								const nextField12 = await fetchStats();
								if (dictionaryModal === undefined) return;
								dictionaryModal.stats = nextField12;
								const nextField13 = await fetchProfiles();
								if (dictionaryModal === undefined) return;
								dictionaryModal.profiles = nextField13;
								if (dictionaryModal === undefined) return;
								dictionaryModal.profilesOpen = false;
								renderDictionaryModal();
								showToast(`Словарь «${profile.name}» включён`, true);
							} else {
								showToast("Не удалось переключить словарь", false);
							}
						});
						line.appendChild(pick);
						body.appendChild(line);
					}
				}
			}

			// Движок и стратегия: настройка гибрида «для продвинутых».
			const engineInfo = dictionaryModal.engineInfo;
			if (engineInfo !== undefined) {
				section("Движок", 0);
				const engineRow = modalElement("div", "display:flex;gap:6px;padding:2px 4px 4px;flex-wrap:wrap");
				const engineButtons = [
					{ id: "auto", label: "Авто (быстро)" },
					{ id: "gigaam", label: "GigaAM" },
					{ id: "whisper", label: "Whisper" },
					{ id: "hybrid", label: "Гибрид" },
				];
				for (const engine of engineButtons) {
					const active = engineInfo.engine === engine.id;
					const button = modalElement("div", "cursor:pointer;padding:6px 12px;border-radius:8px;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
						+ "background:" + (active ? "rgba(40,60,110,.95)" : "rgba(60,60,66,.9)") + ";color:#fff", engine.label);
					button.setAttribute("role", "button");
					button.addEventListener("click", async () => {
						const result = await saveEngineChoice(engine.id, engineInfo.merge);
						if (dictionaryModal === undefined) return;
						if (result !== undefined && result.ok) {
							dictionaryModal.engineInfo = { ...engineInfo, engine: engine.id };
							renderDictionaryModal();
							showToast(`Движок: ${engine.id} — перезапустите приложение`, true);
						} else {
							showToast("Не удалось сохранить движок", false);
						}
					});
					engineRow.appendChild(button);
				}
				body.appendChild(engineRow);
				const strategyRow = modalElement("div", "display:flex;gap:6px;padding:0 4px 6px;flex-wrap:wrap");
				for (const merge of ["auto", "sentences", "text", "words"]) {
					const active = (engineInfo.merge ?? "auto") === merge;
					const button = modalElement("div", "cursor:pointer;padding:5px 10px;border-radius:8px;font:500 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
						+ "background:" + (active ? "rgba(122,162,255,.25)" : "rgba(60,60,66,.7)") + ";color:#f2f2f5", merge);
					button.setAttribute("role", "button");
					button.addEventListener("click", async () => {
						const result = await saveEngineChoice(engineInfo.engine, merge);
						if (dictionaryModal === undefined) return;
						if (result !== undefined && result.ok) {
							dictionaryModal.engineInfo = { ...engineInfo, merge };
							renderDictionaryModal();
							showToast(`Стратегия: ${merge} — перезапустите приложение`, true);
						} else {
							showToast("Не удалось сохранить стратегию", false);
						}
					});
					strategyRow.appendChild(button);
				}
				body.appendChild(strategyRow);
				body.appendChild(modalElement("div", "padding:0 8px 6px;color:#8a8a95;font:500 11px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Применится после перезапуска приложения"));
			}
			// Авто-выученные пары: пользователь решает, оставить их или убрать.
			if (reviewCorrupt) {
				section("Авто-выучено", 0);
				body.appendChild(modalElement("div", "padding:4px 8px 6px;color:#e69f9f;font:500 11.5px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Файл очереди повреждён — пары не показываются. Проверьте ~/.dsh/speech-ru/learned.json."));
			}
			const review = (dictionaryModal.review ?? []).slice().sort((left, right) => (right.at ?? 0) - (left.at ?? 0));
			if (review.length > 0) {
				section("Авто-выучено", review.length);
				body.appendChild(modalElement("div", "padding:2px 8px 4px;color:#8a8a95;font:500 11px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Эти замены запомнились сами. Оставьте нужные, уберите лишние"));
				for (const pair of review.slice(0, 20)) {
					const line = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:8px;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
					line.appendChild(modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", `${pair.heard} → ${pair.chosen}`));
					const actions = modalElement("div", "display:flex;gap:10px;flex:none");
					const keep = modalElement("span", "cursor:pointer;color:#9fe6b4;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Оставить");
					keep.setAttribute("role", "button");
					keep.addEventListener("click", async () => {
						const result = await postDictionary("/review/keep", { heard: pair.heard });
						if (result !== undefined && result.ok) {
							dictionaryCache.at = 0;
							const nextField14 = await fetchReview();
							if (dictionaryModal === undefined) return;
							dictionaryModal.review = nextField14;
							if (dictionaryModal === undefined) return;
							renderDictionaryModal();
							showToast(`Оставлено: ${pair.heard}`, true);
						}
					});
					const drop = modalElement("span", "cursor:pointer;color:#e69f9f;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Убрать");
					drop.setAttribute("role", "button");
					drop.addEventListener("click", async () => {
						const result = await postDictionary("/review/forget", { heard: pair.heard });
						if (result !== undefined && result.ok) {
							dictionaryCache.at = 0;
							const nextField15 = await fetchDictionary();
							if (dictionaryModal === undefined) return;
							dictionaryModal.dictionary = nextField15;
							const nextField16 = await fetchReview();
							if (dictionaryModal === undefined) return;
							dictionaryModal.review = nextField16;
							if (dictionaryModal === undefined) return;
							renderDictionaryModal();
							showToast(`Убрано: ${pair.heard}`, true);
						}
					});
					actions.appendChild(keep);
					actions.appendChild(drop);
					line.appendChild(actions);
					body.appendChild(line);
				}
				const keepAll = modalElement("div", "cursor:pointer;color:#9fe6b4;padding:6px 10px;border-radius:8px;background:rgba(28,92,58,.35);font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", `Оставить все (${review.length})`);
				keepAll.setAttribute("role", "button");
				keepAll.addEventListener("click", async () => {
					for (const pair of review) await postDictionary("/review/keep", { heard: pair.heard });
					dictionaryCache.at = 0;
					const nextField17 = await fetchReview();
					if (dictionaryModal === undefined) return;
					dictionaryModal.review = nextField17;
					if (dictionaryModal === undefined) return;
					renderDictionaryModal();
					showToast(`Оставлено: ${review.length}`, true);
				});
				body.appendChild(keepAll);
			}
			// Предложения из последних диктовок: искажённые термины.
			const suggestions = dictionaryModal.suggestions ?? [];
			if (suggestions.length > 0) {
				section("Предложения", suggestions.length);
				for (const suggestion of suggestions.slice(0, 10)) {
					const line = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:8px;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
					line.appendChild(modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", `${suggestion.heard} → ${suggestion.chosen}`));
					const remember = modalElement("span", "cursor:pointer;color:#9fe6b4;padding:0 4px;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Запомнить");
					remember.setAttribute("role", "button");
					remember.addEventListener("click", async () => {
						const result = await postDictionary("/learn", { heard: suggestion.heard, chosen: suggestion.chosen });
						if (result !== undefined && result.ok) {
							dictionaryCache.at = 0;
							const nextField18 = await fetchDictionary();
							if (dictionaryModal === undefined) return;
							dictionaryModal.dictionary = nextField18;
							const nextField19 = await fetchSuggestions();
							if (dictionaryModal === undefined) return;
							dictionaryModal.suggestions = nextField19;
							renderDictionaryModal();
							showToast(`Запомнено: ${suggestion.heard} → ${suggestion.chosen}`, true);
						} else {
							showToast("Не удалось запомнить", false);
						}
					});
					line.appendChild(remember);
					body.appendChild(line);
				}
				const rememberAll = modalElement("div", "cursor:pointer;color:#9fe6b4;padding:6px 10px;border-radius:8px;background:rgba(28,92,58,.35);font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", `Запомнить все (${suggestions.length})`);
				rememberAll.setAttribute("role", "button");
				rememberAll.addEventListener("click", async () => {
					let learned = 0;
					for (const suggestion of suggestions) {
						const result = await postDictionary("/learn", { heard: suggestion.heard, chosen: suggestion.chosen });
						if (result !== undefined && result.ok) learned += 1;
					}
					dictionaryCache.at = 0;
					const nextField20 = await fetchDictionary();
					if (dictionaryModal === undefined) return;
					dictionaryModal.dictionary = nextField20;
					const nextField21 = await fetchSuggestions();
					if (dictionaryModal === undefined) return;
					dictionaryModal.suggestions = nextField21;
					renderDictionaryModal();
					showToast(learned > 0 ? `Запомнено: ${learned}` : "Не удалось запомнить", learned > 0);
				});
				body.appendChild(rememberAll);
			}
			section("Слова", words.length);
			// Фильтр по источнику: проект / вручную.
			if (allWords.length > 0) {
				const filterRow = modalElement("div", "display:flex;gap:6px;padding:2px 4px 6px;flex-wrap:wrap");
				for (const option of [
					{ id: "all", label: "Все" },
					{ id: "project", label: "Из проекта" },
					{ id: "manual", label: "Вручную" },
				]) {
					const active = wordFilter === option.id;
					const button = modalElement("div", "cursor:pointer;padding:4px 10px;border-radius:999px;font:500 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
						+ "background:" + (active ? "rgba(122,162,255,.25)" : "rgba(60,60,66,.7)") + ";color:#f2f2f5", option.label);
					button.setAttribute("role", "button");
					button.addEventListener("click", () => {
						dictionaryModal.wordFilter = option.id;
						renderDictionaryModal();
					});
					filterRow.appendChild(button);
				}
				body.appendChild(filterRow);
			}
			if (words.length === 0) body.appendChild(modalElement("div", "padding:6px 10px;color:#8a8a95;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", query === "" ? "Пока пусто — добавьте слово сверху" : "Ничего не найдено"));
			for (const word of words.slice(0, 200)) {
				body.appendChild(row(word, async () => {
					const result = await postDictionary("/forget", word);
					if (result !== undefined && result.ok) {
						dictionaryCache.at = 0;
						const nextField22 = await fetchDictionary();
						if (dictionaryModal === undefined) return;
						dictionaryModal.dictionary = nextField22;
						renderDictionaryModal();
						showToast(`Убрано: ${word}`, true, { label: "Вернуть", onClick: () => void addWordsToList(word) });
					} else {
						showToast("Не удалось удалить", false);
					}
				}, { hint: [sourceOfWord(word) === "project" ? "проект" : "", wordStats(word).hits > 0 ? `×${wordStats(word).hits}` : ""].filter(Boolean).join(" · ") }));
			}
			// Обрывки: слово входит в другое слово — частый источник ошибок.
			const fragments = findFragmentWords(dictionary.words ?? []).filter((item) => (wordFilter === "all" || sourceOfWord(item.word) === wordFilter)
				&& (query === "" || item.word.toLowerCase().includes(query)));
			if (fragments.length > 0) {
				section("Похожие слова", fragments.length);
				body.appendChild(modalElement("div", "padding:2px 8px 4px;color:#8a8a95;font:500 11px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Возможно, обрывок: короткое слово входит в длинное и путает движок"));
				for (const fragment of fragments.slice(0, 20)) {
					body.appendChild(row(`${fragment.word} ⊂ ${fragment.longer}`, async () => {
						const result = await postDictionary("/forget", fragment.word);
						if (result !== undefined && result.ok) {
							dictionaryCache.at = 0;
							const nextField23 = await fetchDictionary();
							if (dictionaryModal === undefined) return;
							dictionaryModal.dictionary = nextField23;
							renderDictionaryModal();
							showToast(`Убрано: ${fragment.word}`, true, { label: "Вернуть", onClick: () => void addWordsToList(fragment.word) });
						} else {
							showToast("Не удалось удалить", false);
						}
					}, { hint: "обрывок" }));
				}
			}
			if (pairs.length > 0) {
				section("Замены", pairs.length);
				for (const [heard, chosen] of pairs.slice(0, 200)) {
					body.appendChild(row(`${heard} → ${chosen}`, async () => {
						const result = await postDictionary("/forget-pair", { heard });
						if (result !== undefined && result.ok) {
							dictionaryCache.at = 0;
							const nextField24 = await fetchDictionary();
							if (dictionaryModal === undefined) return;
							dictionaryModal.dictionary = nextField24;
							renderDictionaryModal();
							showToast(`Убрана замена: ${heard}`, true, {
								label: "Вернуть",
								onClick: async () => {
									await postDictionary("/learn", { heard, chosen });
									dictionaryCache.at = 0;
									const nextField25 = await fetchDictionary();
									if (dictionaryModal === undefined) return;
									dictionaryModal.dictionary = nextField25;
									const nextField26 = await fetchSuggestions();
									if (dictionaryModal === undefined) return;
									dictionaryModal.suggestions = nextField26;
									if (dictionaryModal === undefined) return;
									renderDictionaryModal();
									showToast(`Возвращена замена: ${heard}`, true);
								},
							});
						} else {
							showToast("Не удалось удалить замену", false);
						}
					}, {
						hint: [sourceOfPair(heard) === "auto" ? "авто" : "", pairStats(heard).applied > 0 ? `×${pairStats(heard).applied}` : ""].filter(Boolean).join(" · "),
						onEdit: (text, line) => {
							const input = modalElement("input", "flex:1;min-width:0;padding:5px 8px;border-radius:7px;border:1px solid rgba(122,162,255,.4);"
								+ "background:rgba(10,10,12,.9);color:#f2f2f5;font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;outline:none");
							input.value = chosen;
							line.removeChild(text);
							line.insertBefore?.(input, line.children[0] ?? null);
							if (typeof line.insertBefore !== "function") line.children.unshift(input);
							input.focus?.();
							// Enter и blur могут сработать подряд; Escape — отмена.
							let settled = false;
							let cancelled = false;
							const save = async () => {
								if (settled || cancelled) return;
								settled = true;
								const next = String(input.value ?? "").trim();
								if (next === "" || next === chosen) { renderDictionaryModal(); return; }
								const result = await postDictionary("/learn", { heard, chosen: next });
								if (result !== undefined && result.ok) {
									dictionaryCache.at = 0;
									const nextField27 = await fetchDictionary();
									if (dictionaryModal === undefined) return;
									dictionaryModal.dictionary = nextField27;
									if (dictionaryModal === undefined) return;
									renderDictionaryModal();
									showToast(`Замена обновлена: ${heard} → ${next}`, true);
								} else {
									showToast("Не удалось изменить замену", false);
								}
							};
							input.addEventListener("keydown", (event) => {
								if (event.key === "Enter") { event.preventDefault?.(); void save(); }
								if (event.key === "Escape") {
									cancelled = true;
									event.preventDefault?.();
									event.stopPropagation?.();
									renderDictionaryModal();
								}
							});
							input.addEventListener("blur", () => void save());
						},
					}));
				}
			}
			if (addInput.value === undefined) addInput.value = "";
		}

		/** Opens the dictionary modal: search, add field and both lists. */
		let dictionaryModalOpening = false;
		let dictionaryOpenGeneration = 0;

		async function openDictionaryModal() {
			if (dictionaryModal !== undefined || dictionaryModalOpening === true) return;
			dictionaryModalOpening = true;
			const generation = ++dictionaryOpenGeneration;
			const [dictionary, engineInfo, suggestions, review, stats, profiles] = await Promise.all([
				fetchDictionary(),
				fetchEngineInfo(),
				fetchSuggestions(),
				fetchReview(),
				fetchStats(),
				fetchProfiles(),
			]);
			dictionaryModalOpening = false;
			if (generation !== dictionaryOpenGeneration || clientDisposed === true) return;
			const hostMissing = engineInfo === undefined && profiles === undefined;
			const backdrop = modalElement("div", "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px");
			const panel = modalElement("div", "width:min(520px,92vw);max-height:76vh;display:flex;flex-direction:column;"
				+ "background:rgba(20,20,22,.98);border:1px solid rgba(122,162,255,.35);border-radius:16px;"
				+ "box-shadow:0 18px 60px rgba(0,0,0,.55);overflow:hidden");
			panel.setAttribute("data-dsh-locale-ru-modal", "");
			panel.addEventListener("mousedown", (event) => event.stopPropagation());
			backdrop.addEventListener("mousedown", (event) => {
				if (event.target === backdrop) closeDictionaryModal();
			});

			const header = modalElement("div", "display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px");
			header.appendChild(modalElement("div", "color:#f2f2f5;font:600 15px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Словарь распознавания"));
			const close = modalElement("div", "cursor:pointer;color:#8a8a95;font-size:18px;line-height:1;padding:2px 6px", "×");
			close.setAttribute("role", "button");
			close.addEventListener("click", () => closeDictionaryModal());
			header.appendChild(close);
			panel.appendChild(header);

			const addRow = modalElement("div", "display:flex;gap:8px;padding:0 16px 8px");
			const addInput = modalElement("input", "flex:1;min-width:0;padding:8px 10px;border-radius:9px;border:1px solid rgba(122,162,255,.3);"
				+ "background:rgba(10,10,12,.9);color:#f2f2f5;font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;outline:none");
			addInput.setAttribute("placeholder", "Слово или фраза (можно несколько через запятую)");
			const addButton = modalElement("div", "cursor:pointer;padding:8px 14px;border-radius:9px;background:rgba(28,92,58,.95);color:#fff;"
				+ "font:600 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Добавить");
			addButton.setAttribute("role", "button");
			addButton.addEventListener("click", async () => {
				const value = addInput.value;
				addInput.value = "";
				await addWordsToList(value);
			});
			addInput.addEventListener("keydown", async (event) => {
				if (event.key !== "Enter") return;
				event.preventDefault?.();
				const value = addInput.value;
				addInput.value = "";
				await addWordsToList(value);
			});
			addRow.appendChild(addInput);
			addRow.appendChild(addButton);
			panel.appendChild(addRow);

			const searchInput = modalElement("input", "margin:0 16px 6px;padding:7px 10px;border-radius:9px;border:1px solid rgba(122,162,255,.18);"
				+ "background:rgba(10,10,12,.7);color:#f2f2f5;font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;outline:none");
			searchInput.setAttribute("placeholder", "Поиск по словарю и заменам");
			searchInput.addEventListener("input", () => renderDictionaryModal());
			panel.appendChild(searchInput);

			// Импорт словаря по URL (командный словарь из GitHub и т.п.).
			const urlRow = modalElement("div", "display:flex;gap:6px;margin:0 16px 8px");
			const urlInput = modalElement("input", "flex:1;min-width:0;padding:6px 9px;border-radius:8px;border:1px solid rgba(122,162,255,.22);"
				+ "background:rgba(10,10,12,.7);color:#f2f2f5;font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;outline:none");
			urlInput.setAttribute("placeholder", "URL словаря (https://…/.json)");
			const urlButton = modalElement("div", "cursor:pointer;padding:6px 11px;border-radius:8px;background:rgba(60,60,66,.9);color:#f2f2f5;"
				+ "font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;flex:none", "Импорт по URL");
			urlButton.setAttribute("role", "button");
			urlButton.addEventListener("click", async () => {
				const url = String(urlInput.value ?? "").trim();
				if (url === "") {
					showToast("Введите URL словаря", false);
					return;
				}
				const result = await importDictionaryUrl(url);
				if (result !== undefined && result.ok === true) {
					dictionaryCache.at = 0;
					const nextField28 = await fetchDictionary();
					if (dictionaryModal === undefined) return;
					dictionaryModal.dictionary = nextField28;
					const nextField29 = await fetchSuggestions();
					if (dictionaryModal === undefined) return;
					dictionaryModal.suggestions = nextField29;
					const nextField30 = await fetchStats();
					if (dictionaryModal === undefined) return;
					dictionaryModal.stats = nextField30;
					if (dictionaryModal === undefined) return;
					renderDictionaryModal();
					showToast(`Импортировано по URL: слов ${result.words}, замен ${result.replacements}`, true);
				} else {
					showToast(`Не удалось импортировать: ${result?.reason ?? "ошибка"}`, false);
				}
			});
			urlRow.appendChild(urlInput);
			urlRow.appendChild(urlButton);
			panel.appendChild(urlRow);

			const body = modalElement("div", "flex:1;overflow-y:auto;overscroll-behavior:contain;padding:0 12px 12px;display:flex;flex-direction:column;gap:2px");
			body.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
			panel.appendChild(body);

			const footer = modalElement("div", "display:flex;gap:8px;justify-content:flex-end;padding:10px 16px 14px;border-top:1px solid rgba(255,255,255,.06)");
			const agentButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(80,60,110,.9);color:#f2f2f5;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Попросить агента дообучить");
			agentButton.setAttribute("role", "button");
			agentButton.addEventListener("click", () => requestAgentCoaching());
			const importButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(60,60,66,.9);color:#f2f2f5;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Импорт");
			importButton.setAttribute("role", "button");
			importButton.addEventListener("click", () => {
				if (typeof document.createElement !== "function") return;
				const input = document.createElement("input");
				input.type = "file";
				input.accept = ".json,.txt";
				input.style.display = "none";
				input.addEventListener("change", () => {
					const file = input.files?.[0];
					input.remove?.();
					if (file === undefined || file === null) return;
					if (typeof file.size === "number" && file.size > 256 * 1024) {
						showToast("Файл слишком большой (макс. 256 КБ)", false);
						return;
					}
					if (typeof FileReader !== "function") {
						showToast("Импорт недоступен", false);
						return;
					}
					const reader = new FileReader();
					reader.onload = async () => {
						try {
							const text = String(reader.result ?? "");
							const trimmed = text.trim();
							let wordsToAdd = [];
							let pairsToAdd = [];
							// JSON начинается с { или [ — тогда никакого текстового fallback:
							// битый JSON не должен засорять словарь кусками строки.
							if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
								let parsed;
								try {
									parsed = JSON.parse(trimmed);
								} catch (error) {
									showToast("Некорректный JSON — импорт отменён", false);
									return;
								}
								wordsToAdd = Array.isArray(parsed)
									? parsed.filter((word) => typeof word === "string")
									: Array.isArray(parsed?.words) ? parsed.words.filter((word) => typeof word === "string") : [];
								pairsToAdd = parsed?.replacements !== null && typeof parsed?.replacements === "object"
									? Object.entries(parsed.replacements).filter(([heard, chosen]) => typeof heard === "string" && typeof chosen === "string")
									: [];
							} else {
								wordsToAdd = trimmed.split(/[\n,;]+/u).map((word) => word.trim()).filter((word) => word !== "");
							}
							const limit = 100;
							const total = wordsToAdd.length + pairsToAdd.length;
							if (total > limit) {
								showToast(`Слишком много записей (${total}) — импортирую первые ${limit}`, false);
								wordsToAdd = wordsToAdd.slice(0, limit);
								pairsToAdd = pairsToAdd.slice(0, Math.max(0, limit - wordsToAdd.length));
							}
							let wordsOk = 0;
							let pairsOk = 0;
							for (const word of wordsToAdd) {
								const result = await postDictionary("/hotwords", word);
								// Дубликат — не новое слово: в счётчик добавленных не идёт.
								if (result !== undefined && result.ok && result.duplicate !== true) wordsOk += 1;
							}
							for (const [heard, chosen] of pairsToAdd) {
								const result = await postDictionary("/learn", { heard, chosen });
								if (result !== undefined && result.ok) pairsOk += 1;
							}
							if (dictionaryModal === undefined) return;
							dictionaryCache.at = 0;
							const nextField31 = await fetchDictionary();
							if (dictionaryModal === undefined) return;
							dictionaryModal.dictionary = nextField31;
							const nextField32 = await fetchSuggestions();
							if (dictionaryModal === undefined) return;
							dictionaryModal.suggestions = nextField32;
							const nextField33 = await fetchReview();
							if (dictionaryModal === undefined) return;
							dictionaryModal.review = nextField33;
							if (dictionaryModal === undefined) return;
							renderDictionaryModal();
							const added = wordsOk + pairsOk;
							showToast(`Импортировано: слов ${wordsOk}, замен ${pairsOk}`, added > 0);
						} catch (error) {
							showToast("Не удалось импортировать", false);
						}
					};
					reader.readAsText(file);
				});
				if (document.body !== undefined) document.body.appendChild(input);
				input.click?.();
			});
			const exportButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(60,60,66,.9);color:#f2f2f5;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Экспорт");
			exportButton.setAttribute("role", "button");
			exportButton.addEventListener("click", async () => {
				try {
					const dictionary = dictionaryModal?.dictionary ?? await fetchDictionary();
					const payload = JSON.stringify({ words: dictionary.words ?? [], replacements: dictionary.replacements ?? {} }, null, 2);
					const canDownload = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
						&& typeof Blob === "function" && typeof document.createElement === "function";
					if (canDownload) {
						const blob = new Blob([payload], { type: "application/json" });
						const url = URL.createObjectURL(blob);
						const anchor = document.createElement("a");
						anchor.href = url;
						anchor.download = "dsh-locale-dictionary.json";
						anchor.click?.();
						setTimeout(() => URL.revokeObjectURL?.(url), 1000);
						showToast("Словарь сохранён в файл", true);
					} else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText !== undefined) {
						await navigator.clipboard.writeText(payload);
						showToast("Словарь скопирован в буфер", true);
					} else {
						showToast("Экспорт недоступен", false);
					}
				} catch (error) {
					showToast("Не удалось экспортировать", false);
				}
			});
			const clipboardButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(60,60,66,.9);color:#f2f2f5;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "＋ из буфера обмена");
			clipboardButton.setAttribute("role", "button");
			clipboardButton.addEventListener("click", async () => {
				try {
					const text = await navigator.clipboard.readText();
					await addWordsToList(text);
				} catch (error) {
					showToast("Нет доступа к буферу обмена", false);
				}
			});
			const doneButton = modalElement("div", "cursor:pointer;padding:7px 14px;border-radius:9px;background:rgba(40,60,110,.95);color:#fff;"
				+ "font:600 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Готово");
			doneButton.setAttribute("role", "button");
			doneButton.addEventListener("click", () => closeDictionaryModal());
			const retentionButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(60,60,66,.9);color:#f2f2f5;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Неиспользуемые");
			retentionButton.setAttribute("role", "button");
			retentionButton.addEventListener("click", async () => {
				const stats = dictionaryModal?.stats ?? await fetchStats();
				if (dictionaryModal === undefined) return;
				const dictations = Number(stats?.dictations ?? 0);
				const min = Number(stats?.minDictations ?? 30);
				if (dictations < min) {
					showToast(`Данных пока мало: ${dictations} из ${min} диктовок`, false);
					return;
				}
				const preview = await pruneDictionary(true);
				if (dictionaryModal === undefined) return;
				if (preview?.ok !== true) {
					showToast("Не удалось проверить неиспользуемые слова", false);
					return;
				}
				const stale = Array.isArray(preview.stale) ? preview.stale : [];
				if (stale.length === 0) {
					showToast("Неиспользуемых слов нет", true);
					return;
				}
				const names = stale.slice(0, 3).map((entry) => entry.word).join(", ");
				showToast(`Неиспользуемых: ${stale.length} (${names}${stale.length > 3 ? "…" : ""})`, true, {
					label: "Удалить",
					onClick: async () => {
						const result = await pruneDictionary(false);
						if (dictionaryModal === undefined) return;
						if (result !== undefined && result.ok === true) {
							const removed = Array.isArray(result.removed) ? result.removed : [];
							dictionaryCache.at = 0;
							const nextDictionary = await fetchDictionary();
							const nextStats = await fetchStats();
							if (dictionaryModal === undefined) return;
							dictionaryModal.dictionary = nextDictionary;
							dictionaryModal.stats = nextStats;
							renderDictionaryModal();
							showToast(`Удалено: ${removed.length}`, true, removed.length === 0 ? undefined : {
								label: "Вернуть",
								onClick: async () => {
									for (const word of removed) await postDictionary("/hotwords", word);
									dictionaryCache.at = 0;
									const restored = await fetchDictionary();
									if (dictionaryModal === undefined) return;
									dictionaryModal.dictionary = restored;
									const nextField34 = await fetchStats();
									if (dictionaryModal === undefined) return;
									dictionaryModal.stats = nextField34;
									renderDictionaryModal();
									showToast(`Возвращено: ${removed.length}`, true);
								},
							});
						} else {
							showToast("Не удалось почистить словарь", false);
						}
					},
				});
			});
			const settingsButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(40,60,110,.95);color:#fff;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Настройки диктовки");
			settingsButton.setAttribute("role", "button");
			settingsButton.addEventListener("click", () => {
				closeDictionaryModal();
				void globalThis.__dshLocaleRuSettings?.open?.();
			});
			footer.appendChild(retentionButton);
			footer.appendChild(settingsButton);
			footer.appendChild(agentButton);
			footer.appendChild(importButton);
			footer.appendChild(exportButton);
			footer.appendChild(clipboardButton);
			footer.appendChild(doneButton);
			panel.appendChild(footer);

			backdrop.appendChild(panel);
			if (document.body !== undefined) document.body.appendChild(backdrop);
			dictionaryModal = { backdrop, panel, body, addInput, searchInput, dictionary, engineInfo, suggestions, review, stats, profiles, hostMissing, wordFilter: "all", profilesOpen: false };
			renderDictionaryModal();
			addInput.focus?.();
		}

		/** Toggles the dictionary modal. */
		function toggleDictionaryModal() {
			if (dictionaryModal !== undefined) closeDictionaryModal();
			else void openDictionaryModal();
		}

					/** Shows the popover for the selection with the given candidates. */
			function showPanel(rect, phrase, candidates, dictionary) {
				current = phrase;
				panelPhrase = phrase;
				hidePanel();
				panelPhrase = phrase;
				panel = document.createElement("div");
				panel.addEventListener("mousedown", (event) => {
					event.preventDefault();
				});
				panel.setAttribute("data-dsh-locale-ru-dictionary", "");
				panel.style.cssText = "position:fixed;z-index:2147483647;min-width:150px;max-width:280px;"
					+ "padding:6px;border-radius:12px;background:rgba(20,20,22,.97);"
					+ "border:1px solid rgba(122,162,255,.35);box-shadow:0 6px 22px rgba(0,0,0,.45);"
					+ "display:flex;flex-direction:column;gap:2px";
				const top = rect.top > 200 ? rect.top - 8 - Math.min(40 + candidates.length * 28, 220) : rect.bottom + 8;
				panel.style.left = `${Math.max(8, Math.min(rect.left, (window.innerWidth ?? 1200) - 300))}px`;
				panel.style.top = `${Math.max(8, top)}px`;
				if (candidates.length > 0) {
					const title = document.createElement("div");
					title.textContent = `Замена для «${phrase}»`;
					title.style.cssText = "padding:2px 8px 4px;color:#8a8a95;font:500 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
					panel.appendChild(title);
					for (const candidate of candidates) {
						panel.appendChild(buildRow(candidate.term, async () => {
							if (!replaceSelection(candidate.term)) {
								showToast("Не удалось заменить — выделите слово заново", false);
								return;
							}
							const result = await postDictionary("/learn", { heard: phrase, chosen: candidate.term });
							if (result !== undefined && result.ok) {
								showToast(`Заменено: ${phrase} → ${candidate.term}`, true);
								dictionaryCache.at = 0;
							} else {
								showToast("Заменено, но не удалось запомнить", false);
							}
						}));
					}
				}
				const appliedHeard = lastAppliedReplacements[phrase.toLowerCase()];
				if (appliedHeard !== undefined && appliedHeard !== "") {
					panel.appendChild(buildRow(`Вернуть: ${appliedHeard}`, async () => {
						if (!replaceSelection(appliedHeard)) {
							showToast("Не удалось вернуть слово", false);
							return;
						}
						showToast(`Возвращено: ${appliedHeard}`, true);
					}));
				}
				const words = dictionary.words ?? [];
				if (words.length > 0) {
					panel.appendChild(buildRow(`Словарь (${words.length})`, async () => {
						hidePanel();
						void openDictionaryModal();
					}));
				}
				const inDictionary = (dictionary.words ?? []).some((word) => String(word).toLowerCase() === phrase.toLowerCase());
				if (inDictionary) {
					panel.appendChild(buildRow("− убрать из словаря", async () => {
						const result = await postDictionary("/forget", phrase);
						if (result !== undefined && result.ok) {
							showToast("Удалено из словаря", true);
							dictionaryCache.at = 0;
						} else {
							showToast("Не удалось удалить: плагин не активен", false);
						}
					}));
				} else {
					const addLabel = candidates.length > 0 ? "＋ в словарь" : `＋ «${phrase}» в словарь`;
					panel.appendChild(buildRow(addLabel, async () => {
						const result = await postDictionary("/hotwords", phrase);
						if (result !== undefined && result.ok) {
							showToast(result.duplicate ? "Уже в словаре" : "Добавлено в словарь", true);
							dictionaryCache.at = 0;
						} else {
							showToast("Не удалось добавить: плагин не активен", false);
						}
					}));
				}
				if (document.body !== undefined) document.body.appendChild(panel);
				// Не перекрываем выделенный текст: если поповер залез на него, поднимаем выше.
				try {
					const panelRect = panel.getBoundingClientRect?.();
					if (panelRect !== undefined && panelRect !== null && panelRect.width > 0) {
						const overlaps = !(panelRect.bottom <= rect.top || panelRect.top >= rect.bottom
							|| panelRect.right <= rect.left || panelRect.left >= rect.right);
						if (overlaps) {
							const above = rect.top - panelRect.height - 10;
							panel.style.top = `${Math.max(8, above)}px`;
							const adjusted = panel.getBoundingClientRect?.();
							if (adjusted !== undefined && adjusted !== null && adjusted.top < 8) {
								panel.style.top = `${Math.min((window.innerHeight ?? 800) - panelRect.height - 8, rect.bottom + 10)}px`;
							}
						}
					}
				} catch (error) {
					// измерение недоступно — оставляем как есть
				}
			}

			/** Handles a selection change with a short debounce. */
			function onSelectionChange() {
				if (removed) return;
				clearTimeout(selectionTimer);
				selectionTimer = setTimeout(handleSelection, 120);
			}

			/** Shows or hides the popover for the current selection. */
			function handleSelection() {
				if (removed) return;
				let selection;
				try {
					selection = document.getSelection();
				} catch (error) {
					return;
				}
				if (!selection || selection.isCollapsed === true || selection.rangeCount === 0) {
					hidePanel();
					return;
				}
				const phrase = String(selection.toString()).replace(/\s+/g, " ").trim();
				if (phrase.length === 0 || phrase.length > 64) {
					hidePanel();
					return;
				}
				const anchor = selection.anchorNode;
				let element = null;
				if (anchor !== null && anchor !== undefined) {
					element = anchor.nodeType === 1 ? anchor : anchor.parentElement === undefined ? null : anchor.parentElement;
				}
				if (element === null || typeof element.closest !== "function" || element.closest("[contenteditable=true]") === null) {
					hidePanel();
					return;
				}
				// Та же фраза или открытый список словаря — не пересобираем панель.
				if (panel !== undefined && (panelPhrase === phrase || panelPhrase === "__dictionary__")) return;
				let rect;
				try {
					rect = selection.getRangeAt(0).getBoundingClientRect();
				} catch (error) {
					hidePanel();
					return;
				}
				void (async () => {
					const dictionary = await fetchDictionary();
					if (removed) return;
					// Пока грузили словарь, выделение могло смениться.
					let fresh;
					try {
						fresh = document.getSelection();
					} catch (error) {
						return;
					}
					if (!fresh || fresh.isCollapsed === true) return;
					if (String(fresh.toString()).replace(/\s+/g, " ").trim() !== phrase) return;
					showPanel(rect, phrase, pickCandidates(phrase, dictionary), dictionary);
				})();
			}

			const onScroll = (event) => {
				// Прокрутка внутри самой панели (список словаря) не должна её закрывать.
				const target = event !== null && event !== undefined ? event.target : null;
				if (panel !== undefined && target !== null && target !== undefined
					&& typeof panel.contains === "function" && panel.contains(target)) return;
				hidePanel();
			};
			const onHotkey = (event) => {
				if (event === null || event === undefined) return;
				if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
				if (event.repeat === true) return;
				const key = String(event.key ?? "").toLowerCase();
				if (key !== "d" && key !== ",") return;
				if (typeof event.preventDefault === "function") event.preventDefault();
				if (removed) return;
				if (key === ",") globalThis.__dshLocaleRuSettings?.toggle?.();
				else toggleDictionaryModal();
			};
			document.addEventListener("keydown", onHotkey);
			const onDocumentMouseDown = (event) => {
				if (panel === undefined) return;
				const target = event !== null && event !== undefined ? event.target : null;
				if (target === null || target === undefined) return;
				const inside = typeof panel.contains === "function" ? panel.contains(target) : false;
				if (!inside) hidePanel();
			};
			openSelectionPopover = () => {
				handleSelection();
			};
			const onKeyDown = (event) => {
				if (event === null || event === undefined) return;
				if (event.key !== "Escape" && event.keyCode !== 27) return;
				if (voiceSettingsModal !== undefined || voiceSettingsOpening === true) {
					closeVoiceSettingsModal();
					return;
				}
				if (dictionaryModal !== undefined || dictionaryModalOpening === true) {
					closeDictionaryModal();
					return;
				}
				if (recoveryCurrent !== undefined) {
					dismissCurrentRecovery();
					return;
				}
				dictationHighlightDismissed = true;
				clearDictationHighlights();
				hidePanel();
			};
			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("mouseup", onSelectionChange);
			document.addEventListener("keyup", onSelectionChange);
			document.addEventListener("keydown", onKeyDown);
			document.addEventListener("mousedown", onDocumentMouseDown);
			window.addEventListener("scroll", onScroll, true);
			return () => {
				removed = true;
				clearTimeout(selectionTimer);
				document.removeEventListener("selectionchange", onSelectionChange);
				document.removeEventListener("mouseup", onSelectionChange);
				document.removeEventListener("keyup", onSelectionChange);
				document.removeEventListener("keydown", onKeyDown);
				document.removeEventListener("keydown", onHotkey);
				document.removeEventListener("mousedown", onDocumentMouseDown);
				closeDictionaryModal();
				window.removeEventListener("scroll", onScroll, true);
				hidePanel();
			};
		}

		/** When the last dictation recording stopped; the insertion follows shortly. */
		let dictationEndedAt = 0;
		/** How long after the recording stop an insertion is expected. */
		const DICTATION_INSERT_WINDOW_MS = 8000;

		/**
		 * Moves the caret to the end of the composer after a dictation insertion.
		 * The stock flow captures the insertion span before recording starts; when
		 * the caret stays at the start of the draft, the next dictation lands above
		 * the previous text. Moving the caret to the end keeps insertions in order.
		 * @returns disposer that stops the observer and listeners.
		 */
		function installDictationCaretFix() {
			if (typeof MutationObserver !== "function" || typeof document === "undefined") return () => {};
			if (typeof document.createRange !== "function") return () => {};
			let removed = false;
			const moveToEnd = (editable) => {
				try {
					const selection = document.getSelection();
					if (!selection) return;
					const range = document.createRange();
					range.selectNodeContents(editable);
					range.collapse(false);
					selection.removeAllRanges();
					selection.addRange(range);
				} catch (error) {
					// редактор мог размонтироваться
				}
			};
			const onFocusIn = (event) => {
				const target = event !== null && event !== undefined ? event.target : null;
				if (target === null || target === undefined || typeof target.closest !== "function") return;
				const editable = target.closest("[contenteditable=true]");
				if (editable !== null) lastComposer = editable;
			};
			document.addEventListener("focusin", onFocusIn);
			const onInput = (event) => {
				const target = event !== null && event !== undefined ? event.target : null;
				if (target === null || target === undefined || typeof target.closest !== "function") return;
				const editable = target.closest("[contenteditable=true]");
				if (editable === null) return;
				if (dictationInsertion === null || dictationInsertedAt === 0) return;
				if (Date.now() - dictationInsertedAt > 60000) return;
				scheduleLearn(editable);
			};
			document.addEventListener("input", onInput);
			const observer = new MutationObserver((records) => {
				if (removed) return;
				// Оверлеи подсветки живут в body: без этого фильтра observer
				// реагирует на их добавление и подсветка удаляет сама себя.
				if (Array.isArray(records) && records.length > 0) {
					const onlyHighlights = records.every((record) => {
						const nodes = [...(record.addedNodes ?? []), ...(record.removedNodes ?? [])];
						if (nodes.length === 0) return true;
						return nodes.every((node) => node !== null && node !== undefined && node.nodeType === 1
							&& typeof node.getAttribute === "function"
							&& node.getAttribute("data-dsh-locale-ru-highlight") !== null);
					});
					if (onlyHighlights) return;
				}
				if (Date.now() - dictationEndedAt > DICTATION_INSERT_WINDOW_MS) return;
				const active = document.activeElement;
				const editable = active !== null && active !== undefined && typeof active.closest === "function"
					? active.closest("[contenteditable=true]")
					: null;
				const target = editable === null ? lastComposer : editable;
				if (target === null) return;
				// Реагируем только на изменение текста в поле, а не на любую
				// DOM-мутацию: иначе тост/оверлей ChronoFlow «съедает» ожидание
				// вставки, каретка не уезжает в конец, и следующая диктовка
				// вставляется выше предыдущей.
				const currentText = String(target.innerText ?? target.textContent ?? "");
				if (dictationBeforeText !== null && currentText === dictationBeforeText) return;
				// Каретку двигаем один раз на диктовку — после вставки; дальше не
				// мешаем выделять и править текст.
				const fixCaret = caretFixPending;
				caretFixPending = false;
				setTimeout(() => {
					if (removed) return;
					if (fixCaret) {
						moveToEnd(target);
						const after = String(target.innerText ?? "");
						if (dictationBeforeText !== null && after !== dictationBeforeText) {
							const insertion = splitInsertion(dictationBeforeText, after);
							if (insertion !== undefined) {
								dictationInsertion = insertion;
								dictationInsertedAt = Date.now();
								dictationBeforeText = after;
								dictationHighlightDismissed = false;
								dictationHighlightDrawn = false;
							}
						}
						// Одноразовая подсказка: текст вставляется по курсору.
						try {
							if (typeof localStorage !== "undefined" && localStorage.getItem("dsh-locale-ru-insert-hint") !== "1") {
								localStorage.setItem("dsh-locale-ru-insert-hint", "1");
								showToast("Диктовка вставляется туда, где стоит курсор", true);
							}
						} catch (error) {
							// localStorage может быть недоступен
						}
					}
					void notifyReplacements(target);
					void highlightDictationResult(target);
					void globalThis.__dshLocaleRuProfiles?.suggest?.();
					scheduleLearn(target);
				}, 0);
			});
			const observeTarget = document.body !== undefined && document.body !== null ? document.body : document.documentElement;
			if (observeTarget === undefined || observeTarget === null) return () => {};
			observer.observe(observeTarget, { childList: true, subtree: true, characterData: true });
			return () => {
				removed = true;
				observer.disconnect();
				document.removeEventListener("focusin", onFocusIn);
				document.removeEventListener("input", onInput);
			};
		}

		/** Marker on the patched EventTarget prototype: the voice keep-alive is installed. */
		const VOICE_KEEPALIVE_MARKER = "__dshLocaleRuVoiceKeepAlive";

		/**
		 * Keeps the stock voice input recording when the window loses focus.
		 *
		 * The stock client cancels the capture on `blur` and on a hidden page, so a
		 * user who switches to another window loses the dictation. Only those two
		 * listeners are suppressed (recognised by their source); the active
		 * MediaRecorder is tracked, and a background indicator is shown: a dot in the
		 * window title and a system notification. Everything is restored on dispose.
		 * @returns disposer that restores the patched APIs.
		 */
		function installVoiceKeepAlive() {
			if (typeof window === "undefined" || typeof document === "undefined") return () => {};
			const prototype = window.EventTarget === undefined ? undefined : window.EventTarget.prototype;
			if (prototype === undefined || typeof prototype.addEventListener !== "function") return () => {};
			if (Object.prototype.hasOwnProperty.call(prototype, VOICE_KEEPALIVE_MARKER)) return () => {};

			const originalAdd = prototype.addEventListener;
			const originalRemove = prototype.removeEventListener;
			const suppressed = new WeakMap();
			const recorders = new Set();
			let baseTitle;
			let notification;
			let badge;
			let titleChanged = false;

			/** True for the stock cancel-on-blur/visibility listener, recognised by its source. */
			function isCancelListener(listener) {
				if (typeof listener !== "function") return false;
				let source;
				try {
					source = Function.prototype.toString.call(listener);
				} catch (error) {
					return false;
				}
				if (source.indexOf("cancel") === -1) return false;
				return source.indexOf("recording") !== -1
					|| source.indexOf("transcribing") !== -1
					|| source.indexOf("document.hidden") !== -1;
			}

			/** True while a tracked recorder is capturing. */
			function isRecording() {
				let active = false;
				recorders.forEach((recorder) => {
					if (recorder.state === "recording") active = true;
				});
				return active;
			}

			/** Adds a small in-app badge: visible when the app window is in sight. */
			function showBadge() {
				if (badge !== undefined || typeof document.createElement !== "function" || document.body === undefined) return;
				badge = document.createElement("div");
				badge.textContent = "● Диктовка идёт в фоне";
				badge.setAttribute("data-dsh-locale-ru-voice", "");
				badge.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;padding:6px 10px;border-radius:999px;background:rgba(20,20,22,.92);color:#fff;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none";
				document.body.appendChild(badge);
			}

			/** Removes the in-app badge. */
			function hideBadge() {
				if (badge === undefined) return;
				if (typeof badge.remove === "function") badge.remove();
				else if (badge.parentNode !== null && badge.parentNode !== undefined) badge.parentNode.removeChild(badge);
				badge = undefined;
			}

			/** Shows the background indicator once. */
			function showIndicator() {
				if (!isRecording()) return;
				showBadge();
				if (!titleChanged) {
					baseTitle = document.title;
					titleChanged = true;
					document.title = "● Диктовка — " + baseTitle;
				}
				if (notification !== undefined) return;
				try {
					if (typeof Notification === "undefined" || Notification.permission === "denied") return;
					notification = new Notification("Диктовка продолжается", {
						body: "Запись идёт в фоне. Вернитесь в DeepSeek Harness и нажмите «Стоп», чтобы вставить текст.",
						silent: true,
						tag: "dsh-locale-ru-voice",
					});
				} catch (error) {
					notification = undefined;
				}
			}

			/** Hides the indicator when nothing is recorded anymore. */
			function hideIndicator() {
				if (isRecording()) return;
				if (titleChanged) {
					titleChanged = false;
					if (baseTitle !== undefined) document.title = baseTitle;
				}
				if (notification !== undefined) {
					try {
						notification.close();
					} catch (error) {
						// уведомление могло быть уже закрыто системой
					}
					notification = undefined;
				}
				hideBadge();
			}

			/** Tracks MediaRecorder instances so the plugin knows when dictation runs. */
			function trackRecorders() {
				if (typeof window.MediaRecorder !== "function") return () => {};
				const Original = window.MediaRecorder;
				const tracked = new Proxy(Original, {
					construct(target, args) {
						const recorder = Reflect.construct(target, args);
						dictationSessionId = currentSessionId();
						const startedAt = Date.now();
						recorders.add(recorder);
						recorder.addEventListener("stop", () => {
							recorders.delete(recorder);
							markDictationEnded(Date.now() - startedAt);
							hideIndicator();
						});
						return recorder;
					},
				});
				window.MediaRecorder = tracked;
				return () => {
					window.MediaRecorder = Original;
				};
			}

	

		function patchedAdd(type, listener, options) {
				if ((type === "blur" || type === "visibilitychange") && isCancelListener(listener)) {
					const wrapped = function () {
						showIndicator();
					};
					suppressed.set(listener, wrapped);
					return originalAdd.call(this, type, wrapped, options);
				}
				return originalAdd.call(this, type, listener, options);
			}

			function patchedRemove(type, listener, options) {
				const wrapped = suppressed.get(listener);
				if (wrapped !== undefined) {
					suppressed.delete(listener);
					return originalRemove.call(this, type, wrapped, options);
				}
				return originalRemove.call(this, type, listener, options);
			}

			prototype.addEventListener = patchedAdd;
			prototype.removeEventListener = patchedRemove;
			Object.defineProperty(prototype, VOICE_KEEPALIVE_MARKER, { value: true, configurable: true });
			const untrack = trackRecorders();
			return () => {
				untrack();
				prototype.addEventListener = originalAdd;
				prototype.removeEventListener = originalRemove;
				delete prototype[VOICE_KEEPALIVE_MARKER];
				hideIndicator();
				recorders.clear();
			};
		}

		let clientDisposed = false;

		function closeAllModalWindows() {
			// Мост выставляет installDictionaryChip, где определены обе функции.
			try {
				globalThis.__dshLocaleRuCloseWindows?.();
			} catch (error) {
				// окна уже закрыты
			}
		}

		function apply(ctx) {
			// Патч диктовки ставится сразу: он должен успеть до монтирования
			// интерфейса голосового ввода. Локаль регистрируем на следующем тике.
			const restoreVoice = installVoiceKeepAlive();
			const restoreChip = installDictionaryChip();
			const restoreCaret = installDictationCaretFix();
			const restoreHighlights = installHighlightMaintenance();
			ctx.effect(() => () => {
				clientDisposed = true;
				clearTimeout(recoveryTimer);
				hideRecoveryPanel();
				closeAllModalWindows();
			});
			setTimeout(() => restoreStoredRecovery(), 2000);
			// Функция онбординга живёт в том же модуле, но вызываем через
			// globalThis: так её видно из apply независимо от порядка объявлений.
			setTimeout(() => {
				try {
					globalThis.__dshLocaleRuOnboarding?.();
				} catch (error) {
					// онбординг не критичен
				}
			}, 1500);
			ctx.effect(() => {
				let dispose = () => {};
				const timer = setTimeout(() => {
					try {
						dispose = registerAll(ctx);
					} catch (error) {
						console.error("[dsh-locale-russian] registration failed", error);
					}
				}, 0);
				return () => {
					clearTimeout(timer);
					dispose();
					restoreVoice();
					restoreChip();
					restoreCaret();
					restoreHighlights();
				};
			}, "dsh-locale-russian: registration");
		}

		/**
		 * Registers the language, dictionaries and patches once the boot settles.
		 * @param ctx - client Cordis context carrying the `locale` service.
		 * @returns disposer that removes every registration.
		 */
		function registerAll(ctx) {
			const locale = ctx.locale;
			/** Namespaces the built-in catalog already owns; the pack overrides them via translate. */
			const occupied = new Set();
			const disposers = [];
			// DSH 0.2.2+ поставляется с нативным русским языком и словарями.
			// Регистрировать свои в этом случае нельзя: стоковые плагины падают
			// на «locale namespace ... already has locale "ru"» и не активируются.
			let nativeRussian = false;
			try {
				disposers.push(locale.addLanguage(LANGUAGE));
			} catch (error) {
				if (!(error instanceof Error) || error.message.indexOf("already") === -1) throw error;
				nativeRussian = true;
			}
			// Маркер для gui-sweep: нативная русская копия — не наша, её обрезка
			// не должна считаться провалом проверки вёрстки.
			globalThis.__dshLocaleRuLocaleMode = nativeRussian ? "native" : "own";
			if (nativeRussian) {
				// Нативные словари не трогаем, но описания сторонних плагинов
				// нативный перевод не покрывает — наш wrapper остаётся полезен.
				disposers.push(installPluginText(locale));
				return () => {
					for (const dispose of disposers.reverse()) dispose();
				};
			}
			for (const namespace of Object.keys(DICTIONARIES)) {
				try {
					disposers.push(locale.register(namespace, LANGUAGE.id, DICTIONARIES[namespace]));
				} catch (error) {
					if (!(error instanceof Error) || error.message.indexOf("already") === -1) throw error;
					occupied.add(namespace);
					disposers.push(() => {
						occupied.delete(namespace);
					});
				}
			}
			disposers.push(installPluralForms(locale, occupied));
			disposers.push(installPluginText(locale));
			return () => {
				for (const dispose of disposers.reverse()) dispose();
			};
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.DICTIONARY_DIGEST = DICTIONARY_DIGEST;
		return module.exports;
	}
});
