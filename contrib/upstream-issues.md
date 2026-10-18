# Upstream proposals

Two things this language pack would like to see resolved in DeepSeek Harness.
Both are written as ready-to-file reports: the language pack works today, but
each one costs either an internal-API dependency or an untranslatable surface.

The upstream repository disables issues and pull requests and asks for GitHub
Discussions instead (`CONTRIBUTING.md`), so these were posted as ideas:

| Topic | Discussion |
|---|---|
| Public pluralization hook | https://github.com/deepseek-ai/deepseek-harness/discussions/10147 |
| Desktop shell localization | https://github.com/deepseek-ai/deepseek-harness/discussions/10148 |
| Plugin showcase (this pack) | https://github.com/deepseek-ai/deepseek-harness/discussions/10146 |

Verified against DSH `0.2.1-rc.2` (desktop) and `0.2.0-rc.2` (npm CLI release).

---

## 1. Public pluralization hook for language packs

**Summary.** The locale catalog is documented as extensible, but the runtime has
no plural selection, so a language pack cannot render languages whose plural
rules differ from English.

**What happens today.** `LocaleRuntime.translate` resolves exactly one template
per key:

```ts
// packages/client/locale/src/client/index.ts:466
private translate(ns: string, key: string, params?: Record<string, unknown>): string {
  const chain = this.fallbackChain(this.snapshot.active)
  const template = this.lookup(ns, key, chain)
    ?? (ns !== COMMON_NS ? this.lookup(COMMON_NS, key, chain) : undefined)
    ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match)
}
```

Components choose the grammatical form themselves, by English rules — for
example `packages/client/ui-trajectory/src/client/TrajectoryTable.tsx`:

```tsx
t(steps === 1 ? 'summary.steps.one' : 'summary.steps.other', { count: steps })
```

Russian has three categories (1 файл, 2 файла, 5 файлов; 21 файл, 22 файла,
25 файлов), so `count === 1 ? one : other` cannot express it. The `.one`/`.other`
key pairs are already in the dictionaries, but the selection lives in component
code, outside anything a language pack can reach.

**Workaround a language pack needs today.** Wrapping the private prototype
method and encoding up to three `|`-separated forms per dictionary value:

```js
const original = Object.getPrototypeOf(locale).translate
Object.getPrototypeOf(locale).translate = function (ns, key, params) {
  // observe Intl.PluralRules('ru') over params.n/params.count and pick a form
}
```

That works (our pack ships it), but it depends on an internal method name, its
argument order, and its interpolation rules — none of which are part of the
language-pack contract. A rename or a signature change breaks every pack that
supports a language with non-English plural rules, and the failure is silent:
copy keeps rendering, only the agreement degrades.

**Proposal.** Pick one of:

1. A registered plural selector: `ctx.locale.addPluralRules({ id: 'ru', select(count) { … } })`,
   applied inside `translate` for keys whose value carries multiple forms; or
2. Function values in a dictionary (`(count, params) => string`) for keys that
   need agreement; or
3. At minimum, document the `|`-separated multi-form convention as part of the
   public dictionary contract and keep `translate`'s signature stable.

**Compatibility.** Any of the three is additive: English and Chinese dictionaries
keep single-form values and the existing `.one`/`.other` selection keeps working
unchanged.

---

## 2. Russian in the Electron shell copy

**Summary.** A profile plugin cannot localize the desktop shell: the welcome
window, the application menu, and the "Manage dsh Command" dialog keep their own
closed `en`/`zh` dictionary inside `app.asar`.

**What happens today.** `apps/desktop/src/locale.ts` opens with
`/** Typed English and Chinese copy owned by the Electron shell. */` and holds
every shell string (`cliCommandMenu`, `aboutMenu`, `fileMenu`, `quitApplication`, …).
The welcome window receives its locale through the `--dsh-welcome-locale=`
switch handled in `apps/desktop/src/preload-welcome.ts`, and renders copy in
`apps/desktop/src/client/WelcomePage.tsx`.

Meanwhile the browser side uses the extensible catalog: a client plugin calls
`ctx.locale.addLanguage({ id, label, fallback })` and its language appears in
Settings → Language (`packages/client/locale/README.md`, "Registering a language
pack"). So a Russian user installs a language pack, gets a fully Russian web UI —
and still reads English in the first window the application ever shows, plus the
native menu bar.

**Why a plugin cannot fix it.** The shell copy is compiled into the Electron
main/preload bundles inside `app.asar`. Profile plugins run in the host and
browser planes; nothing they can register reaches that dictionary, and editing
`app.asar` is not a supported path (signature, auto-update).

**Proposal.** Either

1. Move the shell copy into the same extensible catalog the browser uses (the
   desktop shell already resolves a locale id at window creation, so the
   plumbing exists), so a language pack adds `ru` for the shell too; or
2. Let the shell read `locale/<id>.json` exported by the desktop package, as the
   plugin display metadata does (`PluginLocalizedMeta` reads exported locale
   JSON); or
3. If the shell set stays closed, say so in the locale README, so language packs
   can state the limitation honestly instead of implying full coverage.

**Scope that stays out.** Nothing here asks for translated model-facing text:
tool descriptions, system prompts, and provider diagnostics should remain
English, and the language pack keeps them verbatim.
