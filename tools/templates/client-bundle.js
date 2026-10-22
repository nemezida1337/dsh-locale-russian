window.__ModuleLoader__.load({
	// Module id must equal the package name: the client module system matches
	// the resolved package against the registered id.
	id: "__MODULE_ID__",
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
		const DICTIONARY_DIGEST = "__DIGEST__";

		/** Namespace dictionaries: namespace -> key -> Russian copy. */
		const DICTIONARIES = __DICTIONARIES_JSON__;

		/**
		 * Plugin display metadata: package descriptions and human titles keyed by
		 * their English text. The Host builds those values from each package.json
		 * and hands them to the browser as LocalizedText, so official packages
		 * arrive English-only; installPluginText resolves them for Russian.
		 */
		const PLUGIN_TEXT = __PLUGIN_TEXT_JSON__;

		/** Parameter names that carry a countable value, most specific first. */
		const COUNT_PARAMETERS = ["n", "count", "total", "size"];

		/**
		 * Classifies a count by Russian plural rules.
		 * @param value - the number the copy agrees with.
		 * @returns the CLDR plural category for Russian.
		 */
		function pluralCategory(value) {
			if (typeof Intl !== "undefined" && typeof Intl.PluralRules === "function") {
				return new Intl.PluralRules("ru").select(value);
			}
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
		function installPluralForms(locale) {
			const prototype = Object.getPrototypeOf(locale);
			const original = prototype.translate;
			if (typeof original !== "function") return () => {};
			if (typeof prototype.__dshLocaleRuPlural === "function") return prototype.__dshLocaleRuPlural;
			const patched = function (ns, key, params) {
				if (locale.getSnapshot().active !== LANGUAGE.id) return original.call(this, ns, key, params);
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
			if (typeof prototype.__dshLocaleRuMeta === "function") return prototype.__dshLocaleRuMeta;
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
		function apply(ctx) {
			const locale = ctx.locale;
			ctx.effect(() => locale.addLanguage(LANGUAGE), "__MODULE_ID__: language definition");
			for (const namespace of Object.keys(DICTIONARIES)) {
				ctx.effect(
					() => locale.register(namespace, LANGUAGE.id, DICTIONARIES[namespace]),
					"__MODULE_ID__: " + namespace + " dictionary",
				);
			}
			ctx.effect(() => installPluralForms(locale), "__MODULE_ID__: plural forms");
			ctx.effect(() => installPluginText(locale), "__MODULE_ID__: plugin display text");
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.DICTIONARY_DIGEST = DICTIONARY_DIGEST;
		return module.exports;
	}
});
