window.__ModuleLoader__.load({
	// Module id must equal the package name: the client module system matches the
	// resolved package against the registered id.
	id: "__PACKAGE_NAME__",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/**
		 * Language pack for the DeepSeek Harness web client: the language
		 * definition, the translated dictionaries, and plural-form selection.
		 *
		 * Fill DICTIONARIES with the translated namespaces and PLUGIN_TEXT with
		 * translated plugin display strings, then run the pack's test.
		 */
		const LANGUAGE = { id: "__LANG_ID__", label: "__LANG_LABEL__", fallback: "__FALLBACK__" };

		/** namespace → key → translated string (up to three `|`-separated plural forms). */
		const DICTIONARIES = {};

		/** English plugin description or title → translated text. */
		const PLUGIN_TEXT = {};

		/** Parameters that carry a countable value, checked in order. */
		const COUNT_PARAMETERS = ["count", "n", "value", "total", "items"];

		/** Extracts the countable value from the interpolation parameters. */
		function countParameter(params) {
			if (params === undefined || params === null) return undefined;
			for (const name of COUNT_PARAMETERS) {
				const raw = params[name];
				if (raw === undefined || raw === null) continue;
				const number = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.-]/g, ""));
				return Number.isFinite(number) ? { number, text: String(raw) } : undefined;
			}
			return undefined;
		}

		/** CLDR plural rules for this language, created once; undefined when unsupported. */
		let pluralRules;

		/** CLDR plural category of a countable value in this language. */
		function pluralCategory(number) {
			if (pluralRules === undefined && typeof Intl !== "undefined" && typeof Intl.PluralRules === "function") {
				try {
					pluralRules = new Intl.PluralRules(LANGUAGE.id);
				} catch {
					// Некорректный или неподдерживаемый тег языка: остаёмся на простом правиле.
					pluralRules = null;
				}
			}
			if (pluralRules !== undefined && pluralRules !== null) return pluralRules.select(number);
			return number === 1 ? "one" : "other";
		}

		/** Interpolates `{name}` placeholders; `countText` fills a formatted count. */
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

		/** Selects one form out of a `|`-separated plural value. */
		function selectForm(forms, category) {
			if (forms.length === 1) return forms[0];
			if (forms.length === 2) return category === "few" ? forms[0] : forms[1];
			if (category === "one") return forms[0];
			if (category === "few") return forms[1];
			return forms[2];
		}

		/**
		 * Installs plural selection and plugin-text resolution on the locale
		 * prototype. Every bound translate function follows it, and only the active
		 * language takes this path.
		 */
		function installPatches(locale) {
			const prototype = Object.getPrototypeOf(locale);
			const originalTranslate = prototype.translate;
			if (typeof originalTranslate !== "function") return () => {};
			const patchedTranslate = function (ns, key, params) {
				if (locale.getSnapshot().active !== LANGUAGE.id) return originalTranslate.call(this, ns, key, params);
				const raw = originalTranslate.call(this, ns, key, undefined);
				if (typeof raw !== "string" || raw.indexOf("|") === -1) return originalTranslate.call(this, ns, key, params);
				const forms = raw.split("|");
				const count = countParameter(params);
				if (count === undefined) return interpolate(selectForm(forms, "many"), params);
				return interpolate(selectForm(forms, pluralCategory(count.number)), params, count.text);
			};
			const restoreTranslate = () => {
				if (prototype.translate === patchedTranslate) prototype.translate = originalTranslate;
			};
			prototype.translate = patchedTranslate;

			const originalResolveText = prototype.resolveText;
			let restoreResolveText = () => {};
			if (typeof originalResolveText === "function") {
				const patchedResolveText = function (...args) {
					const resolved = originalResolveText.apply(this, args);
					try {
						if (locale.getSnapshot().active !== LANGUAGE.id) return resolved;
						if (typeof resolved !== "string") return resolved;
						return Object.prototype.hasOwnProperty.call(PLUGIN_TEXT, resolved) ? PLUGIN_TEXT[resolved] : resolved;
					} catch {
						return resolved;
					}
				};
				prototype.resolveText = patchedResolveText;
				restoreResolveText = () => {
					if (prototype.resolveText === patchedResolveText) prototype.resolveText = originalResolveText;
				};
			}
			return () => {
				restoreResolveText();
				restoreTranslate();
			};
		}

		/** Registers everything; a slot already taken by the built-in catalog is kept. */
		function registerAll(ctx) {
			const locale = ctx.locale;
			const occupied = new Set();
			const disposers = [];
			try {
				disposers.push(locale.addLanguage(LANGUAGE));
			} catch (error) {
				if (!(error instanceof Error) || error.message.indexOf("already") === -1) throw error;
			}
			for (const namespace of Object.keys(DICTIONARIES)) {
				try {
					disposers.push(locale.register(namespace, LANGUAGE.id, DICTIONARIES[namespace]));
				} catch (error) {
					if (!(error instanceof Error) || error.message.indexOf("already") === -1) throw error;
					occupied.add(namespace);
					disposers.push(() => occupied.delete(namespace));
				}
			}
			disposers.push(installPatches(locale));
			return () => {
				for (const dispose of disposers.reverse()) dispose();
			};
		}

		/**
		 * Registers on the next tick: the locale catalog and the neighbouring client
		 * plugins settle first, and disposal still cancels the timer and the
		 * registrations.
		 */
		function apply(ctx) {
			ctx.effect(() => {
				let dispose = () => {};
				const timer = setTimeout(() => {
					try {
						dispose = registerAll(ctx);
					} catch (error) {
						console.error("[__PACKAGE_NAME__] registration failed", error);
					}
				}, 0);
				return () => {
					clearTimeout(timer);
					dispose();
				};
			}, "__PACKAGE_NAME__: registration");
		}

		/** Required service: the extensible locale catalog. */
		const inject = ["locale"];

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
