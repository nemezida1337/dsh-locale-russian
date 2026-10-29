# Разработка и выпуски

Документация для мейнтейнеров. Пользователям — [README](../README.md); тем, кто предлагает правки перевода, — [CONTRIBUTING](../CONTRIBUTING.md).

## Инструменты

```sh
node tools/extract-static.mjs     # словари из установленной сборки DSH
node tools/extract-repo.mjs       # словари из исходников репозитория
node tools/build-inventory.mjs    # объединённый инвентарь строк
node tools/build-batches.mjs      # батчи для перевода
node tools/lint-translations.mjs  # проверка переводов (глоссарий, плейсхолдеры, склонения)
node tools/build-package.mjs      # сборка dictionary/ru.json, lib/ и патча
node tools/verify-package.mjs     # проверка собранного бандла без браузера
node tools/report-drift.mjs       # ключи, у которых английский текст изменился между сборками
node tools/apply-reviews.mjs      # перенос правок рецензентов в dictionary/overrides.json
node tools/extract-asar.mjs       # клиентские пакеты из app.asar установленного приложения
node tools/extract-plugin-meta.mjs # описания пакетов-плагинов для раздела «Встроенные плагины»
node tools/build-plugin-batches.mjs # батчи этих описаний
node tools/build-market.mjs       # индекс маркета плагинов (market/index.json)
node tools/validate-market.mjs    # проверка индекса официальным валидатором DSH
node tools/mark-translated.mjs    # запомнить английский текст, по которому сделан перевод
node tools/refresh.mjs            # вся цепочка обновления одной командой
node tools/gui-sweep.mjs          # обход интерфейса: текст, скриншоты, обрезки
node tools/screenshot-gui.mjs     # снимок одного экрана (для отладки)
node tools/check-imports.mjs      # согласованность импортов node:fs (входит в npm test)
node tools/check-app.mjs          # покрытие на сборке приложения из фида обновлений
node tools/build-dashboard.mjs    # дашборд покрытия для GitHub Pages
node tools/translate-batches.mjs  # черновой перевод дельты провайдером (mock/command/openai)
node tools/scaffold-locale.mjs    # генератор языкового пака из contrib/locale-template
node tools/discussion-report.mjs  # отчёт по ответам в обсуждениях DSH
```

Тесты инструментов входят в `npm test`; каждый — офлайн и без сети: `test-speech-provider`, `test-engine-install`, `test-translate-batches`, `test-dashboard`, `test-check-app`, `test-scaffold`, `test-discussion-report`.

Если вы делаете свой плагин для DSH — практическое руководство со всеми граблями лежит в [contrib/plugin-recipe.md](../contrib/plugin-recipe.md).

## Устройство пакета

Пакет одновременно является **bundle** (`dsh.bundle.patch` — файл `cordis.patch.yml` со строкой `locale-ru`), **клиентским плагином** (`dsh.client` — `lib/client.js`) и **хост-плагином** (`lib/index.js` — провайдер распознавания), поэтому ставится целиком, одной командой.

Клиентский бандл собирается из `tools/templates/client-bundle.js` с плейсхолдерами `__MODULE_ID__`, `__DIGEST__`, `__DICTIONARIES_JSON__`, `__PLUGIN_TEXT_JSON__`; хост-половина — из `tools/templates/host-plugin.js`. Оба шаблона проверяются `node --check`, а `tools/build-package.mjs` только подставляет значения и пишет `lib/`, `package.json` и `cordis.patch.yml`.

Общие помощники лежат в `tools/lib`: `cdp.mjs` — запуск headless Chrome (свободный порт выбирается автоматически) и операции над страницей, `parse-js.mjs` — чтение словарей из бандлов и исходников, `paths.mjs` — сокращение машинных путей в отчётах, `cli.mjs` — разбор аргументов (`--name value` и `--name=value`).

### Откуда берутся строки

Строки снимаются из трёх источников по убыванию приоритета: клиентские пакеты **установленного приложения** (распакованные из `app.asar`), пакеты CLI-сборки и исходники репозитория. Приоритетный источник задаёт английский текст, который видит переводчик; батч `p3` (дельта приложения) перекрывает ранее переведённые ключи, у которых текст изменился.

```sh
node tools/extract-asar.mjs --out .app-packages                       # пакеты приложения из app.asar
DSH_CLIENT_PKG_ROOT="$PWD/.app-packages" node tools/extract-static.mjs --out strings/app.json
node tools/extract-static.mjs                                        # пакеты CLI-сборки
node tools/extract-repo.mjs                                          # исходники репозитория
node tools/build-inventory.mjs                                       # объединить: приложение → CLI → репозиторий
node tools/build-batches.mjs --delta                                 # только новое и изменившееся
```

Готовые переводы лежат в `translations/*.json` по батчам; `dictionary/ru.json` — результат сборки. Отчёты проверок — в `reports/`.

## После выхода новой версии DSH

1. Обновите приложение и склонируйте свежий репозиторий (`git pull`).
2. Запустите `npm run refresh` — одна команда проходит всю цепочку: распаковывает `app.asar`, снимает словари приложения, CLI-сборки и репозитория, пересобирает метаданные плагинов, инвентарь, батчи дельты и отчёт о расхождениях. В конце печатается сводка: сколько строк без перевода, сколько переписано, сколько описаний плагинов не хватает.
3. Переведите файлы `batches/p3-*.json` (строки интерфейса) и `batches/plugin-*.json` (описания плагинов) — вручную или черновиком: `npm run translate -- --provider …` (см. ниже).
4. Отметьте раунд как завершённый: `npm run mark-translated` — команда запоминает, по какому английскому тексту сделан перевод, чтобы дельта не возвращалась.
5. `npm test`; при необходимости расширьте `engines.dsh` в манифесте.

Проверить дельту без правок можно командой `npm run refresh:check`: она вернёт ненулевой код, если остались непереведённые или переписанные строки.

### Черновой перевод провайдером

`npm run translate` читает батчи, отправляет недостающие строки провайдеру и пишет `translations/` со свободными id, проверяя плейсхолдеры, пустоту и длину. Провайдеры: `mock` (тесты), `command` (внешняя программа: JSON на stdin, JSON на stdout) и `openai` (любой OpenAI-совместимый endpoint — DeepSeek API, Ollama, LM Studio):

```sh
npm run translate -- --provider openai --base-url https://api.deepseek.com/v1 \
  --model deepseek-chat --api-key-env DEEPSEEK_API_KEY --limit 100
```

Результат — черновик: его всё равно проходят линтер, `npm test` и вычитка. Инструмент пропускает строки с готовым переводом, чтобы не заменять вычитанные значения.

Правки редакторов и рецензентов хранятся отдельно от батчей — в `dictionary/overrides.json` (строки интерфейса) и `dictionary/plugin-meta-overrides.json` (метаданные плагинов); они применяются поверх переводов при сборке и участвуют в проверках, поэтому не теряются при повторном извлечении строк.

## Проверки и CI

`npm test` — линтер переводов, согласованность импортов, сборка, проверка бандла и семь офлайн-наборов тестов инструментов.

`.github/workflows/ci.yml` содержит три job-а (два из них выполняются на Ubuntu и Windows), а `pages.yml`, `release.yml` и `discussions.yml` публикуют индекс и дашборд, выпускают версии и следят за обсуждениями:

| Job | Когда | Что делает |
|---|---|---|
| `checks` | push, pull request | линтер, сборка пакета, проверка импортов, индекс маркета, проверка бандла, тесты инструментов |
| `dsh-drift` | ежедневно по расписанию и вручную | ставит свежий `@deepseek-ai/dsh` из npm (Ubuntu и Windows) и предрелизы из тегов `next` и `alpha` (Ubuntu), снимает строки и падает при дельте; открывает issue |
| `smoke` | push, pull request | поднимает настоящий сервер `dsh web` с пакетом через строку патча (Ubuntu и Windows), проверяет boot-граф и прогоняет обход интерфейса |
| `app-drift` | ежедневно по расписанию и вручную | скачивает сборку **приложения** из публичного фида обновлений, сверяет sha512, распаковывает `app.asar`, проверяет покрытие; кэширует `app.asar`, при дельте открывает issue |
| `market index` | push с изменениями `market/` | публикует индекс и дашборд на GitHub Pages |
| `release` | тег `v*` | публикует пакет в npm через trusted publishing и создаёт GitHub-релиз |
| `discussions` | понедельник | проверяет ответы в обсуждениях DSH и создаёт или обновляет issue |

## Выпуск версии

```sh
npm version patch          # или minor / major — поднимает версию в package.json
git push --follow-tags     # тег vX.Y.Z запускает workflow release
```

`.github/workflows/release.yml` берёт версию из тега, собирает пакет, прогоняет проверки, публикует в npm с аттестацией происхождения (`--provenance`) и создаёт GitHub-релиз. Если версия уже есть в реестре, публикация пропускается.

Секреты не нужны: публикация идёт через **trusted publishing** (OIDC). На npmjs.com в настройках пакета → *Publishing access* → *Trusted publishing* добавьте издателя:

| Поле | Значение |
|---|---|
| Owner | `nemezida1337` |
| Repository | `dsh-locale-russian` |
| Workflow | `release.yml` |
| Environment | пусто |

Ручной выпуск тоже работает — `npm publish --access public` из локального терминала (там подтверждение отпечатком проходит через браузер).

## Обход интерфейса

```sh
npm run sweep -- --url "http://127.0.0.1:5610/?token=…"   # пройти по экранам
npm run sweep:check -- --url "…"                          # сравнить с эталоном и упасть при обрезке
```

Обход открывает главный экран, все разделы настроек, новый диалог и меню ввода `/` и `@`, сохраняет текст и скриншот каждого экрана в `reports/sweep/`, и сообщает об элементах, чей текст обрезан контейнером. Это тот класс дефектов, который иначе находится случайно: например, подпись «Встроенные плагины» не помещалась в боковой панели и превращалась в «Встроенные п…».

Сводка обхода (`reports/sweep/summary.json`) служит эталоном: `--compare` показывает, где обрезки стало больше, `--fail-on-clip` падает при обрезке **нашей** копии. Строки данных хоста (описания навыков из `SKILL.md`, имена пакетов, моделей и команд) в провал не идут: они не переводятся — так же ведёт себя и китайская локаль, — и обход помечает их отдельно.

В CI этот шаг входит в job `smoke`, который выполняется на **Ubuntu и Windows**: шрифтовые метрики различаются, и Linux уже находил обрезки, которых нет на macOS. Снимки экранов уходят артефактом.

## Имя пакета

Имя `dsh-locale-ru` в npm **уже занято** другим автором: там лежит пакет `dsh-locale-ru@0.1.1` — тоже русская локализация DSH, но меньшего охвата (31 namespace / 1048 строк, без русских склонений, целевая версия DSH `0.1.1-rc.2`). Наш пакет называется `dsh-locale-russian` и покрывает 75 namespace / 3929 строк, включая сборку `0.2.1-rc.3`, и умеет склонения.

Смена имени — одна правка в `package.json`:

```sh
# 1. выберите свободное имя, например @ваш-скоуп/dsh-locale-ru
node -e "const f='package.json',p=require('./'+f);p.name='@ваш-скоуп/dsh-locale-ru';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
# 2. пересоберите: id бандла и строка патча подставятся автоматически
node tools/build-package.mjs && node tools/build-market.mjs
```

Сборка генерирует `cordis.patch.yml` и `id` бандла из имени манифеста, поэтому рассинхронизации не будет: имя пакета, id модуля и строка патча всегда совпадают.

## Индекс маркета

`node tools/build-market.mjs` собирает каталог `market/`: `index.json` (формат 1), `icon.svg` и `index.html` (дашборд покрытия). Индекс публикуется workflow-ом `pages.yml`:

```
https://nemezida1337.github.io/dsh-locale-russian/index.json
```

Пользователи добавляют этот адрес на странице **Плагины → Обзор** (в английском интерфейсе — *Discover*). Индекс отдаёт название, описание, иконку, автора, версии и требуемый диапазон DSH, поэтому список рисуется без обращения к npm. Установка из «Обзора» идёт через `plugin_manager` с подтверждением и требует, чтобы в профиле был включён bundle рынка `@deepseek-ai/dsh-experimental-plugin-market-bundle` (в поставке он выключен).

## Диапазон совместимости

`engines.dsh` в манифесте (`^0.1.5-rc.1 || ^0.2.1-rc.2 || ^0.2.2-alpha.2`) перечисляет сборки, на которых пакет проверен. Диапазон выглядит необычно, потому что semver не считает pre-release версию подходящей произвольному диапазону: `>=0.1.5-rc.1 <0.3.0` не совпал бы с `0.2.1-rc.3`. Если DSH обновится, DSH может отклонить пакет по этому полю — тогда расширьте диапазон и выпустите новую версию. Генератор манифеста сохраняет `engines` из `package.json`, а `verify` проверяет, что диапазон покрывает линию 0.2.2.

## Языковые паки для сообщества

`contrib/locale-template` — рабочий каркас языкового пака, `tools/scaffold-locale.mjs` — генератор:

```sh
node tools/scaffold-locale.mjs --id de --label Deutsch --package dsh-locale-german
```

Сгенерированный пакет объявляет язык, устойчив к занятым слотам каталога, умеет склонения через `Intl.PluralRules` и проходит собственный самотест (`node test.mjs`). Проверяется в `npm test` (`test-scaffold`).
