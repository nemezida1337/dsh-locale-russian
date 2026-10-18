#!/usr/bin/env node
/**
 * Builds the installable `dsh-locale-ru` client plugin from the inventory and
 * the translated batches.
 *
 * Outputs: `dictionary/ru.json` (the merged dictionary), `lib/client.js` (the
 * browser bundle in the loader's factory format), `lib/index.js` (the empty
 * host half), and `package.json` for the plugin row.
 *
 * Usage:
 *   node tools/build-package.mjs [--allow-missing]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const allowMissing = process.argv.includes('--allow-missing')

const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
const packageJsonPath = resolve(root, 'package.json')
const existingManifest = existsSync(packageJsonPath)
  ? JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  : {}
const translationsDir = resolve(root, 'translations')

/** Merges every translated batch into `namespace → key → russian`. */
// Batches apply in precedence order, later wins: repository-only keys first,
// then the shipped-build set, then the delta taken from the installed app, which
// carries the newest English text and therefore the authoritative translation.
const precedence = (file) => (file.startsWith('p2-') ? 0 : file.startsWith('p1-') ? 1 : 2)
const batchFiles = readdirSync(translationsDir)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .sort((a, b) => precedence(a) - precedence(b) || a.localeCompare(b))

const dictionary = {}
// Plugin display metadata (package descriptions and human titles) is keyed by
// its English text instead of a namespace: the client resolves those values
// through LocaleRuntime.resolveText, which the generated bundle wraps.
const pluginText = {}
const missing = []
let shadowed = 0
for (const file of batchFiles) {
  const payload = JSON.parse(readFileSync(join(translationsDir, file), 'utf8'))
  if (payload.kind === 'plugin-meta') {
    for (const [source, translated] of Object.entries(payload.translations ?? {})) {
      if (typeof translated === 'string' && translated.length > 0) pluginText[source] = translated
    }
    continue
  }
  const namespace = payload.namespace
  for (const [key, value] of Object.entries(payload.translations ?? {})) {
    if (typeof value !== 'string') continue
    dictionary[namespace] ??= {}
    if (dictionary[namespace][key] !== undefined && dictionary[namespace][key] !== value) shadowed += 1
    dictionary[namespace][key] = value
  }
}
// Editorial decisions recorded after review win over the batch translations.
const overridesPath = resolve(root, 'dictionary/overrides.json')
if (existsSync(overridesPath)) {
  const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'))
  for (const [namespace, keys] of Object.entries(overrides)) {
    if (namespace.startsWith('_')) continue
    for (const [key, value] of Object.entries(keys)) {
      dictionary[namespace] ??= {}
      dictionary[namespace][key] = value
    }
  }
}

for (const [namespace, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    if (dictionary[namespace]?.[key] === undefined) {
      missing.push({ namespace, key, origin: value.origin })
    }
  }
}

const sortedDictionary = Object.fromEntries(
  Object.entries(dictionary)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, keys]) => [namespace, Object.fromEntries(Object.entries(keys).sort(([a], [b]) => a.localeCompare(b)))]),
)

const totalKeys = Object.values(sortedDictionary).reduce((sum, keys) => sum + Object.keys(keys).length, 0)
const coverage = {
  generatedAt: new Date().toISOString(),
  namespaces: Object.keys(sortedDictionary).length,
  keys: totalKeys,
  missingKeys: missing.length,
  missingPriority1: missing.filter((item) => item.origin !== 'repo').length,
  missing,
}
mkdirSync(resolve(root, 'reports'), { recursive: true })
writeFileSync(resolve(root, 'reports/coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`)

if (missing.length > 0 && !allowMissing) {
  const priority1 = missing.filter((item) => item.origin !== 'repo')
  console.error(`missing translations: ${missing.length} (of them priority 1: ${priority1.length})`)
  for (const item of missing.slice(0, 20)) console.error(`  - ${item.namespace}/${item.key} (${item.origin})`)
  console.error('run with --allow-missing to build a partial pack')
  process.exit(1)
}

mkdirSync(resolve(root, 'dictionary'), { recursive: true })
writeFileSync(resolve(root, 'dictionary/ru.json'), `${JSON.stringify(sortedDictionary, null, 2)}\n`)

// Editorial corrections to the package copy (terminology unified with the UI
// dictionary) win over the batch translations, keyed by the English text.
const pluginOverridesPath = resolve(root, 'dictionary/plugin-meta-overrides.json')
if (existsSync(pluginOverridesPath)) {
  const pluginOverrides = JSON.parse(readFileSync(pluginOverridesPath, 'utf8'))
  for (const [source, translated] of Object.entries(pluginOverrides)) {
    if (typeof translated === 'string' && translated.length > 0) pluginText[source] = translated
  }
}
const sortedPluginText = Object.fromEntries(
  Object.entries(pluginText).sort(([a], [b]) => a.localeCompare(b)),
)
writeFileSync(resolve(root, 'dictionary/plugin-meta.json'), `${JSON.stringify(sortedPluginText, null, 2)}\n`)
const manifestName = existingManifest.name ?? 'dsh-locale-russian'
const dictionaryJson = JSON.stringify(sortedDictionary)
const pluginTextJson = JSON.stringify(sortedPluginText)
const digest = createHash('sha256').update(dictionaryJson).digest('hex').slice(0, 16)

const clientBundle = `window.__ModuleLoader__.load({
\t// Module id must equal the package name: the client module system matches\n\t// the resolved package against the registered id.\n\tid: "${manifestName}",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

\t\t/**
\t\t * Russian language pack for the web client: the language definition, the
\t\t * translated dictionaries, and Russian plural-form selection.
\t\t *
\t\t * The locale runtime has no plural rules (dictionary lookup returns one
\t\t * template), while components choose the \`.one\`/\`.other\` key by
\t\t * \`count === 1\`. Russian needs three forms, so this pack wraps
\t\t * \`LocaleRuntime.prototype.translate\`: a dictionary value may carry up to
\t\t * three \`|\`-separated forms, and the wrapper picks one through
\t\t * \`Intl.PluralRules('ru')\`. Only the active \`ru\` locale takes this path —
\t\t * every other locale calls the original method unchanged.
\t\t */

\t\t/** Language definition registered into the extensible locale catalog. */
\t\tconst LANGUAGE = { id: "ru", label: "Русский", fallback: "en" };

\t\t/** Dictionary digest, so a running page can be matched to a pack build. */
\t\tconst DICTIONARY_DIGEST = ${JSON.stringify(digest)};

\t\t/** Namespace dictionaries: namespace -> key -> Russian copy. */
\t\tconst DICTIONARIES = ${dictionaryJson};

\t\t/**
\t\t * Plugin display metadata: package descriptions and human titles keyed by
\t\t * their English text. The Host builds those values from each package.json
\t\t * and hands them to the browser as LocalizedText, so official packages
\t\t * arrive English-only; installPluginText resolves them for Russian.
\t\t */
\t\tconst PLUGIN_TEXT = ${pluginTextJson};

\t\t/** Parameter names that carry a countable value, most specific first. */
\t\tconst COUNT_PARAMETERS = ["n", "count", "total", "size"];

\t\t/**
\t\t * Classifies a count by Russian plural rules.
\t\t * @param value - the number the copy agrees with.
\t\t * @returns the CLDR plural category for Russian.
\t\t */
\t\tfunction pluralCategory(value) {
\t\t\tif (typeof Intl !== "undefined" && typeof Intl.PluralRules === "function") {
\t\t\t\treturn new Intl.PluralRules("ru").select(value);
\t\t\t}
\t\t\tconst mod10 = Math.abs(value) % 10;
\t\t\tconst mod100 = Math.abs(value) % 100;
\t\t\tif (mod10 === 1 && mod100 !== 11) return "one";
\t\t\tif (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
\t\t\treturn "many";
\t\t}

\t\t/**
\t\t * Reads a number out of one parameter. Components often pass an already
\t\t * formatted count ("12.5K", "1 234"), which still carries the number the
\t\t * copy has to agree with.
\t\t * @param value - the parameter value.
\t\t * @returns the parsed count, or undefined.
\t\t */
\t\tfunction parseCount(value) {
\t\t\tif (typeof value === "number") return Number.isFinite(value) ? value : undefined;
\t\t\tif (typeof value !== "string") return undefined;
\t\t\tconst normalized = value.replace(/[\\s\\u00a0\\u202f]/g, "").replace(/,/, ".");
\t\t\tconst match = /^\\d+(?:\\.\\d+)?/.exec(normalized);
\t\t\tif (match === null) return undefined;
\t\t\tconst parsed = Number(match[0]);
\t\t\treturn Number.isFinite(parsed) ? parsed : undefined;
\t\t}

\t\t/**
\t\t * Finds the countable parameter of one translate call.
\t\t * @param params - the interpolation parameters.
\t\t * @returns the number used for agreement and the text to interpolate.
\t\t */
\t\tfunction countParameter(params) {
\t\t\tif (params === undefined || params === null) return undefined;
\t\t\tconst candidates = COUNT_PARAMETERS.map((name) => params[name]).concat(Object.values(params));
\t\t\tfor (const value of candidates) {
\t\t\t\tconst number = parseCount(value);
\t\t\t\tif (number !== undefined) return { number, text: String(value) };
\t\t\t}
\t\t\treturn undefined;
\t\t}

\t\t/**
\t\t * Substitutes \`{name}\` placeholders exactly like the locale runtime does,
\t\t * and additionally fills any count placeholder the caller named
\t\t * differently (\`{n}\` against a \`count\` parameter and the reverse).
\t\t * @param template - the selected template.
\t\t * @param params - the interpolation parameters.
\t\t * @param count - the countable value of the call, when it carries one.
\t\t * @returns the rendered string.
\t\t */
\t\tfunction interpolate(template, params, countText) {
\t\t\tif (params === undefined || params === null) {
\t\t\t\treturn countText === undefined ? template : template.replace(/\\{\\w+\\}/g, (match) => match === "{n}" ? countText : match);
\t\t\t}
\t\t\treturn template.replace(/\\{(\\w+)\\}/g, (match, name) => {
\t\t\t\tif (name in params) return String(params[name]);
\t\t\t\tif (countText !== undefined && COUNT_PARAMETERS.indexOf(name) !== -1) return countText;
\t\t\t\treturn match;
\t\t\t});
\t\t}

\t\t/**
\t\t * Selects one form out of a \`|\`-separated plural value.
\t\t * @param forms - one, two (\`few|many\`), or three (\`one|few|many\`) forms.
\t\t * @param category - the CLDR plural category.
\t\t * @returns the selected form.
\t\t */
\t\tfunction selectForm(forms, category) {
\t\t\tif (forms.length === 1) return forms[0];
\t\t\tif (forms.length === 2) return category === "few" ? forms[0] : forms[1];
\t\t\tif (category === "one") return forms[0];
\t\t\tif (category === "few") return forms[1];
\t\t\treturn forms[2];
\t\t}

\t\t/**
\t\t * Installs plural selection on the locale runtime prototype, so every bound
\t\t * translate function — including the framework \`t\` seat — follows it.
\t\t * @param locale - the \`locale\` service instance.
\t\t * @returns the disposer restoring the original method.
\t\t */
\t\tfunction installPluralForms(locale) {
\t\t\tconst prototype = Object.getPrototypeOf(locale);
\t\t\tconst original = prototype.translate;
\t\t\tif (typeof original !== "function") return () => {};
\t\t\tif (typeof prototype.__dshLocaleRuPlural === "function") return prototype.__dshLocaleRuPlural;
\t\t\tconst patched = function (ns, key, params) {
\t\t\t\tif (locale.getSnapshot().active !== LANGUAGE.id) return original.call(this, ns, key, params);
\t\t\t\tconst raw = original.call(this, ns, key, undefined);
\t\t\t\tif (typeof raw !== "string" || raw.indexOf("|") === -1) return original.call(this, ns, key, params);
\t\t\t\tconst forms = raw.split("|");
\t\t\t\tconst count = countParameter(params);
\t\t\t\tif (count === undefined) return interpolate(selectForm(forms, "many"), params);
\t\t\t\tconst category = pluralCategory(count.number);
\t\t\t\tlet template;
\t\t\t\tif (category === "one" && forms.length === 2) {
\t\t\t\t\tconst sibling = key.replace(/\\.other$/, ".one");
\t\t\t\t\ttemplate = sibling !== key ? original.call(this, ns, sibling, undefined) : forms[0];
\t\t\t\t} else {
\t\t\t\t\ttemplate = selectForm(forms, category);
\t\t\t\t}
\t\t\t\tif (typeof template !== "string" || template.indexOf("|") !== -1) template = forms[0];
\t\t\t\treturn interpolate(template, params, count.text);
\t\t\t};
\t\t\tconst restore = () => {
\t\t\t\tif (prototype.translate === patched) {
\t\t\t\t\tprototype.translate = original;
\t\t\t\t\tdelete prototype.__dshLocaleRuPlural;
\t\t\t\t}
\t\t\t};
\t\t\tprototype.translate = patched;
\t\t\tprototype.__dshLocaleRuPlural = restore;
\t\t\treturn restore;
\t\t}

\t\t/**
\t\t * Resolves plugin display metadata for Russian without touching any other
\t\t * locale: \`resolveText\` is the single point every LocalizedText passes
\t\t * through, and only strings present in the table are replaced.
\t\t * @param locale - the \`locale\` service instance.
\t\t * @returns the disposer restoring the original method.
\t\t */
\t\tfunction installPluginText(locale) {
\t\t\tconst prototype = Object.getPrototypeOf(locale);
\t\t\tconst original = prototype.resolveText;
\t\t\tif (typeof original !== "function") return () => {};
\t\t\tif (typeof prototype.__dshLocaleRuMeta === "function") return prototype.__dshLocaleRuMeta;
\t\t\tconst patched = function (text) {
\t\t\t\tconst resolved = original.call(this, text);
\t\t\t\tif (this.getSnapshot().active !== LANGUAGE.id) return resolved;
\t\t\t\treturn Object.prototype.hasOwnProperty.call(PLUGIN_TEXT, resolved) ? PLUGIN_TEXT[resolved] : resolved;
\t\t\t};
\t\t\tconst restore = () => {
\t\t\t\tif (prototype.resolveText === patched) {
\t\t\t\t\tprototype.resolveText = original;
\t\t\t\t\tdelete prototype.__dshLocaleRuMeta;
\t\t\t\t}
\t\t\t};
\t\t\tprototype.resolveText = patched;
\t\t\tprototype.__dshLocaleRuMeta = restore;
\t\t\treturn restore;
\t\t}

\t\t/** Required service: the extensible locale catalog. */
\t\tconst inject = ["locale"];

\t\t/**
\t\t * Registers the Russian language, its dictionaries, and plural selection.
\t\t * @param ctx - client Cordis context carrying the \`locale\` service.
\t\t */
\t\tfunction apply(ctx) {
\t\t\tconst locale = ctx.locale;
\t\t\tctx.effect(() => locale.addLanguage(LANGUAGE), "${manifestName}: language definition");
\t\t\tfor (const namespace of Object.keys(DICTIONARIES)) {
\t\t\t\tctx.effect(
\t\t\t\t\t() => locale.register(namespace, LANGUAGE.id, DICTIONARIES[namespace]),
\t\t\t\t\t"${manifestName}: " + namespace + " dictionary",
\t\t\t\t);
\t\t\t}
\t\t\tctx.effect(() => installPluralForms(locale), "${manifestName}: plural forms");
\t\t\tctx.effect(() => installPluginText(locale), "${manifestName}: plugin display text");
\t\t}

\t\texports.apply = apply;
\t\texports.inject = inject;
\t\texports.DICTIONARY_DIGEST = DICTIONARY_DIGEST;
\t\treturn module.exports;
\t}
});
`

mkdirSync(resolve(root, 'lib'), { recursive: true })
writeFileSync(resolve(root, 'lib/client.js'), clientBundle)

// The bundle patch is generated: its single row must name the installed
// package, so a rename in package.json cannot leave a stale specifier behind.
const patchFile = `# Слой патча пакета-бандла: единственная строка, подключающая языковой пакет.
# Файл генерируется tools/build-package.mjs — имя строки берётся из package.json.
- insert:
    - id: locale-ru
      name: ${manifestName}
`
writeFileSync(resolve(root, 'cordis.patch.yml'), patchFile)
writeFileSync(resolve(root, 'lib/index.js'), `/**
 * Host half of the Russian language pack. Every dictionary lives in the browser
 * half (\`./client\`), which the client module system serves as a plugin bundle,
 * so the host contributes nothing.
 */

/** No-op host registration for the language pack row. */
export function apply() {}
`)

const manifest = {
  ...existingManifest,
  name: existingManifest.name ?? 'dsh-locale-russian',
  version: existingManifest.version ?? '0.1.0',
  description: 'Russian (ru) language pack for the DeepSeek Harness web client',
  type: 'module',
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './icon': './icon.svg',
    './locale/*.json': './locale/*.json',
    './package.json': './package.json',
  },
  files: ['lib', 'dictionary', 'locale/*.json', 'cordis.patch.yml', 'icon.svg', 'README.md', 'CHANGELOG.md', 'LICENSE', 'GLOSSARY.md', 'STYLE.md'],
  dsh: {
    // Both roles: a bundle so a profile installs it as one unit, and a client
    // plugin so the browser half is served. `immediately` registers the
    // language before the shell resolves its initial locale, so a Russian
    // system paints Russian on the first frame.
    bundle: { patch: './cordis.patch.yml' },
    client: {
      inject: ['@deepseek-ai/dsh-client-locale'],
      platform: 'web',
      immediately: true,
    },
  },
  // Verified against these DSH builds; widen the range when a new build ships.
  engines: { dsh: '^0.1.5-rc.1 || ^0.2.1-rc.2' },
  repository: {
    type: 'git',
    url: 'git+https://github.com/nemezida1337/dsh-locale-russian.git',
  },
  homepage: 'https://github.com/nemezida1337/dsh-locale-russian#readme',
  bugs: { url: 'https://github.com/nemezida1337/dsh-locale-russian/issues' },
  keywords: ['dsh', 'deepseek-harness', 'locale', 'localization', 'i18n', 'russian', 'ru', 'plugin'],
  author: 'dsh-locale-ru contributors',
  license: 'MIT',
}
writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`dictionary: ${Object.keys(sortedDictionary).length} namespaces, ${totalKeys} keys (digest ${digest})`)
console.log(`plugin display text: ${Object.keys(sortedPluginText).length} strings`)
console.log(`missing translations: ${missing.length} (priority 1: ${missing.filter((item) => item.origin !== 'repo').length})`)
console.log(`superseded by a newer batch: ${shadowed}`)
console.log(`written: dictionary/ru.json, lib/client.js, lib/index.js, package.json`)
