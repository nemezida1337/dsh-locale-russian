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
		function tolerateExisting(task) {
			try {
				return task();
			} catch (error) {
				if (error instanceof Error && error.message.indexOf("already") !== -1) return () => {};
				throw error;
			}
		}

		/** Ports the host half listens on for the personal dictionary (see the host template). */
		const DICTIONARY_PORTS = [47118, 47119, 47120, 47121, 47122];

		/**
		 * Adds a "+ в словарь" chip next to a text selection inside an editable
		 * field: the corrected word goes to the personal hotwords dictionary of the
		 * host half, so the engine recognises it next time. The chip is explicit —
		 * nothing is corrected silently.
		 * @returns disposer that removes the chip and its listeners.
		 */
		function installDictionaryChip() {
			if (typeof document === "undefined" || typeof document.addEventListener !== "function") return () => {};
			if (typeof document.createElement !== "function") return () => {};
			let chip;
			let toast;
			let toastTimer;
			let current = "";
			let removed = false;

			/** Removes the chip. */
			function hideChip() {
				if (chip === undefined) return;
				if (typeof chip.remove === "function") chip.remove();
				else if (chip.parentNode) chip.parentNode.removeChild(chip);
				chip = undefined;
			}

			/** Shows a short confirmation below the chip position. */
			function showToast(text, ok) {
				if (toast !== undefined) {
					if (typeof toast.remove === "function") toast.remove();
					toast = undefined;
				}
				if (typeof document.createElement !== "function" || document.body === undefined) return;
				toast = document.createElement("div");
				toast.textContent = text;
				toast.style.cssText = "position:fixed;z-index:2147483647;padding:6px 12px;border-radius:999px;"
					+ "background:" + (ok ? "rgba(28,92,58,.96)" : "rgba(92,28,28,.96)") + ";color:#fff;"
					+ "font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
					+ "box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;transition:opacity .2s";
				toast.style.left = "50%";
				toast.style.transform = "translateX(-50%)";
				toast.style.bottom = "84px";
				document.body.appendChild(toast);
				clearTimeout(toastTimer);
				toastTimer = setTimeout(() => {
					if (toast !== undefined) {
						toast.style.opacity = "0";
						setTimeout(() => {
							if (toast !== undefined && typeof toast.remove === "function") toast.remove();
							toast = undefined;
						}, 220);
					}
				}, 1800);
			}

			/** Sends the phrase to the host half, trying the known ports. */
			async function sendPhrase(phrase) {
				for (const port of DICTIONARY_PORTS) {
					try {
						const response = await fetch(`http://127.0.0.1:${port}/hotwords`, {
							method: "POST",
							body: phrase,
							signal: AbortSignal.timeout(1200),
						});
						if (!response.ok) continue;
						return await response.json();
					} catch (error) {
						// порт не слушается — пробуем следующий
					}
				}
				return undefined;
			}

			/** Places the chip near the selection. */
			function showChip(rect, phrase) {
				current = phrase;
				if (chip !== undefined) return;
				chip = document.createElement("div");
				chip.setAttribute("role", "button");
				chip.setAttribute("data-dsh-locale-ru-dictionary", "");
				chip.textContent = "+ в словарь";
				chip.style.cssText = "position:fixed;z-index:2147483647;padding:5px 10px;border-radius:999px;"
					+ "background:rgba(20,20,22,.96);color:#fff;border:1px solid rgba(122,162,255,.6);"
					+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
					+ "box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:pointer;user-select:none";
				const top = rect.top > 40 ? rect.top - 34 : rect.bottom + 8;
				chip.style.left = `${Math.max(8, rect.left)}px`;
				chip.style.top = `${Math.max(8, top)}px`;
				chip.addEventListener("mousedown", (event) => {
					// Не сбрасываем выделение до клика.
					event.preventDefault();
				});
				chip.addEventListener("click", async () => {
					const phrase = current;
					hideChip();
					if (phrase === "") return;
					const result = await sendPhrase(phrase);
					if (result !== undefined && result.ok) {
						showToast(result.duplicate ? "Уже в словаре" : "Добавлено в словарь", true);
					} else {
						showToast("Не удалось добавить: плагин не активен", false);
					}
				});
				if (document.body !== undefined) document.body.appendChild(chip);
			}

			/** Handles a selection change: shows or hides the chip. */
			function onSelectionChange() {
				if (removed) return;
				let selection;
				try {
					selection = document.getSelection();
				} catch (error) {
					return;
				}
				if (!selection || selection.isCollapsed === true || selection.rangeCount === 0) {
					hideChip();
					return;
				}
				const phrase = String(selection.toString()).replace(/\s+/g, " ").trim();
				if (phrase.length === 0 || phrase.length > 64) {
					hideChip();
					return;
				}
				const anchor = selection.anchorNode;
				let element = null;
				if (anchor !== null && anchor !== undefined) {
					element = anchor.nodeType === 1 ? anchor : anchor.parentElement === undefined ? null : anchor.parentElement;
				}
				if (element === null || typeof element.closest !== "function" || element.closest("[contenteditable=true]") === null) {
					hideChip();
					return;
				}
				let rect;
				try {
					rect = selection.getRangeAt(0).getBoundingClientRect();
				} catch (error) {
					hideChip();
					return;
				}
				showChip(rect, phrase);
			}

			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("mouseup", onSelectionChange);
			document.addEventListener("keyup", onSelectionChange);
			window.addEventListener("scroll", hideChip, true);
			return () => {
				removed = true;
				document.removeEventListener("selectionchange", onSelectionChange);
				document.removeEventListener("mouseup", onSelectionChange);
				document.removeEventListener("keyup", onSelectionChange);
				window.removeEventListener("scroll", hideChip, true);
				clearTimeout(toastTimer);
				hideChip();
				if (toast !== undefined && typeof toast.remove === "function") toast.remove();
				toast = undefined;
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
						recorders.add(recorder);
						recorder.addEventListener("stop", () => {
							recorders.delete(recorder);
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

		function apply(ctx) {
			// Патч диктовки ставится сразу: он должен успеть до монтирования
			// интерфейса голосового ввода. Локаль регистрируем на следующем тике.
			const restoreVoice = installVoiceKeepAlive();
			const restoreChip = installDictionaryChip();
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
				};
			}, "__MODULE_ID__: registration");
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
			disposers.push(tolerateExisting(() => locale.addLanguage(LANGUAGE)));
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
