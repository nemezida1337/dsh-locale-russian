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
		/** Version of this installed package, for the update notice. */
		const PACKAGE_VERSION = "__PACKAGE_VERSION__";

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
		/** Ended-at markers of dictations whose text actually reached a composer. */
		const insertedDictationEnds = new Set();
		const insertedDictationOrder = [];
		/** Remembers that the current dictation was inserted, even if the field is cleared later. */
		function noteDictationInserted() {
			if (dictationEndedAt === 0) return;
			if (!insertedDictationEnds.has(dictationEndedAt)) {
				insertedDictationEnds.add(dictationEndedAt);
				insertedDictationOrder.push(dictationEndedAt);
			}
			while (insertedDictationOrder.length > 20) insertedDictationEnds.delete(insertedDictationOrder.shift());
		}
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
				noteDictationInserted();
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
		 * True when a dictation's transcript never reached a composer.
		 * An observed insertion wins over the current field: the user may have
		 * already sent the message, so an empty draft is not proof of loss.
		 */
		function recoveryMissed(entry) {
			if (insertedDictationEnds.has(entry.endedAt)) return false;
			const text = typeof entry?.transcript?.text === "string" ? entry.transcript.text : "";
			return !composerContainsText(text);
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
					// Вставка могла случиться и уже уйти в отправленное сообщение:
					// пустое поле — не доказательство потери.
					const observedInsertion = insertedDictationEnds.has(entry.endedAt);
					if (recoveryMissed(entry)) {
						enqueueRecovery({
							text: entry.transcript.text,
							at: entry.transcript.at,
							endedAt: entry.endedAt,
							session: entry.session,
						});
					} else if (!observedInsertion && entry.endedAt === dictationEndedAt && typeof entry.beforeText === "string") {
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
				void processPendingRecoveries().catch(() => {});
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
			// Тестовый шов: позволяет проверять эвристики на реальном бандле.
			if (globalThis.__dshLocaleRuDebug === true) {
				globalThis.__dshLocaleRuDebugApi = {
					composerContainsText,
					composerWithText,
					assignTranscriptsToPending,
					splitInsertion,
					checkUpdate: (force = false) => checkPluginUpdate(force),
					recoveryMissed,
					noteDictationInserted,
					setDictationEndedAt: (value) => { dictationEndedAt = value; },
					insertedDictationEnds: () => [...insertedDictationEnds],
				};
			}
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

		/** Update notice: a quiet chip in the corner, never a full-page modal. */
		const UPDATE_SNOOZE_KEY = "dsh-locale-ru-update-snooze";
		const UPDATE_SKIP_KEY = "dsh-locale-ru-update-skip";
		const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
		const UPDATE_CHECK_START_MS = 2500;
		const UPDATE_COMMAND = "npx dsh-locale-russian-install --desktop";
		let updateCheckTimer;
		let updateNotice;
		let updatePanel;
		let updateInfo;
		/** Client Cordis context, kept for optional native update calls. */
		let pluginContext;

		/** Small DOM helper for the update chip/panel. */
		function updateElement(tag, style, text) {
			const element = document.createElement(tag);
			if (style !== undefined && style !== "") element.style.cssText = style;
			if (text !== undefined) element.textContent = text;
			return element;
		}

		/** Reads a JSON value from localStorage, tolerating corrupted entries. */
		function readUpdateStorage(key) {
			try {
				const raw = localStorage.getItem(key);
				return raw === null || raw === "" ? undefined : JSON.parse(raw);
			} catch (error) {
				return undefined;
			}
		}

		/** Writes a JSON value to localStorage. */
		function writeUpdateStorage(key, value) {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch (error) {
				// localStorage недоступен
			}
		}

		/** True when this exact version is snoozed or skipped. */
		function updateSuppressed(latest) {
			const snooze = readUpdateStorage(UPDATE_SNOOZE_KEY);
			if (snooze?.version === latest && Number(snooze.until) > Date.now()) return true;
			const skipped = readUpdateStorage(UPDATE_SKIP_KEY);
			const versions = Array.isArray(skipped) ? skipped : typeof skipped === "string" ? [skipped] : [];
			return versions.includes(latest);
		}

		/** Fetches update info from the host half. */
		async function fetchUpdateInfo(force) {
			for (const port of hostPortOrder()) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/update-check${force ? "?refresh=1" : ""}`, { signal: AbortSignal.timeout(4000) });
					if (!response.ok) continue;
					markHostPort(port);
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Removes the chip and its expanded panel. */
		function removeUpdateUi() {
			if (updatePanel !== undefined) {
				updatePanel.remove?.();
				if (updatePanel.parentNode) updatePanel.parentNode.removeChild(updatePanel);
				updatePanel = undefined;
			}
			if (updateNotice !== undefined) {
				updateNotice.remove?.();
				if (updateNotice.parentNode) updateNotice.parentNode.removeChild(updateNotice);
				updateNotice = undefined;
			}
		}

		/** Opens the changelog URL in a new tab, when allowed. */
		function openUpdateChangelog(info) {
			const url = typeof info?.changelogUrl === "string" && info.changelogUrl !== "" ? info.changelogUrl : "https://github.com/nemezida1337/dsh-locale-russian/releases";
			try {
				if (typeof window !== "undefined" && typeof window.open === "function") {
					window.open(url, "_blank", "noopener");
					return;
				}
			} catch (error) {
				// ниже — копирование
			}
			try {
				void navigator.clipboard.writeText(url);
				showToast("Ссылка на изменения скопирована", true);
			} catch (error) {
				showToast("Не удалось открыть ссылку", false);
			}
		}

		/** Tries the native plugin manager update; falls back to the installer command. */
		async function applyPluginUpdate(info) {
			const manager = pluginContext?.remote?.pluginManager
				?? (typeof pluginContext?.get === "function" ? pluginContext.get("remote")?.pluginManager : undefined);
			if (manager !== undefined && typeof manager.updateBundle === "function") {
				showToast(`Обновляем до ${info.latest}…`, true);
				try {
					const answer = await manager.updateBundle("dsh-locale-russian", info.latest, {});
					const value = answer?.ok === true ? answer.value : answer;
					const application = value?.application;
					removeUpdateUi();
					if (application === "restart-required") {
						showToast("Обновлено. Перезапустите DeepSeek Harness", true);
					} else if (application === "applied") {
						showToast("Плагин обновлён", true);
					} else {
						showToast("Обновление запущено", true);
					}
					return;
				} catch (error) {
					showToast("Нативное обновление не удалось — команда скопирована", false);
				}
			}
			try {
				await navigator.clipboard.writeText(UPDATE_COMMAND);
				showToast("Команда обновления скопирована", true);
			} catch (error) {
				showToast("Не удалось скопировать команду", false);
			}
		}

		/** Hides the notice for 24 hours. */
		function snoozeUpdate(info) {
			writeUpdateStorage(UPDATE_SNOOZE_KEY, { version: info.latest, until: Date.now() + 24 * 60 * 60 * 1000 });
			removeUpdateUi();
			showToast("Напомним позже", true);
		}

		/** Never reminds about this exact version again. */
		function skipUpdate(info) {
			const skipped = readUpdateStorage(UPDATE_SKIP_KEY);
			const versions = Array.isArray(skipped) ? skipped : typeof skipped === "string" ? [skipped] : [];
			if (!versions.includes(info.latest)) versions.push(info.latest);
			writeUpdateStorage(UPDATE_SKIP_KEY, versions);
			removeUpdateUi();
			showToast("Эта версия больше не будет предлагаться", true);
		}

		/** Renders the expanded card: versions, notes and actions. */
		function renderUpdatePanel(info) {
			if (updatePanel !== undefined) {
				updatePanel.remove?.();
				if (updatePanel.parentNode) updatePanel.parentNode.removeChild(updatePanel);
				updatePanel = undefined;
			}
			const panel = updateElement("div", "position:fixed;left:16px;bottom:56px;z-index:2147483646;width:min(380px,calc(100vw - 32px));max-height:min(70vh,560px);overflow:auto;"
				+ "display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;background:rgba(18,20,23,.98);border:1px solid rgba(122,162,255,.4);"
				+ "box-shadow:0 16px 48px rgba(0,0,0,.5);color:#f2f3f5;font:500 12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
			panel.setAttribute("data-dsh-locale-ru-update-panel", "");
			const head = updateElement("div", "display:flex;align-items:center;justify-content:space-between;gap:8px");
			head.appendChild(updateElement("div", "font:600 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", info.critical === true ? "Критичное обновление" : "Доступно обновление"));
			const close = updateElement("div", "cursor:pointer;color:#8a8a95;font-size:17px;line-height:1;padding:0 4px", "×");
			close.setAttribute("role", "button");
			close.addEventListener("click", () => renderUpdatePanelCollapse());
			head.appendChild(close);
			panel.appendChild(head);
			panel.appendChild(updateElement("div", "color:#b6c0d2", `Установлено ${info.installed ?? PACKAGE_VERSION} → доступно ${info.latest}`));
			if (info.requiresRestart !== false) panel.appendChild(updateElement("div", "color:#d8b26a", "После обновления потребуется перезапуск приложения."));
			const sections = [
				["Новое", info.notes?.new],
				["Исправлено", info.notes?.fixed],
				["Безопасность", info.notes?.security],
			];
			let hasNotes = false;
			for (const [title, entries] of sections) {
				if (!Array.isArray(entries) || entries.length === 0) continue;
				hasNotes = true;
				panel.appendChild(updateElement("div", "margin-top:2px;color:#8a8a95;font:600 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-transform:uppercase;letter-spacing:.04em", title));
				for (const entry of entries.slice(0, 5)) {
					const row = updateElement("div", "display:flex;gap:8px;align-items:flex-start");
					row.appendChild(updateElement("span", "color:#9fe6b4;flex:none", "•"));
					row.appendChild(updateElement("span", "color:#d8dce4;min-width:0;overflow-wrap:anywhere", String(entry)));
					panel.appendChild(row);
				}
			}
			if (!hasNotes) panel.appendChild(updateElement("div", "color:#8a8a95", "Список изменений — в CHANGELOG и GitHub Release."));
			const actions = updateElement("div", "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px");
			const later = updateElement("div", "cursor:pointer;padding:6px 10px;border-radius:8px;background:rgba(60,60,66,.9);color:#f2f2f5;font-weight:600", "Позже");
			later.setAttribute("role", "button");
			later.addEventListener("click", () => snoozeUpdate(info));
			const skip = updateElement("div", "cursor:pointer;padding:6px 10px;border-radius:8px;background:rgba(60,60,66,.65);color:#b6c0d2;font-weight:600", "Пропустить версию");
			skip.setAttribute("role", "button");
			skip.addEventListener("click", () => skipUpdate(info));
			const changes = updateElement("div", "cursor:pointer;padding:6px 10px;border-radius:8px;background:rgba(60,60,66,.65);color:#b6c0d2;font-weight:600", "Все изменения");
			changes.setAttribute("role", "button");
			changes.addEventListener("click", () => openUpdateChangelog(info));
			const apply = updateElement("div", "cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(40,60,110,.95);color:#fff;font-weight:600", "Обновить");
			apply.setAttribute("role", "button");
			apply.addEventListener("click", () => void applyPluginUpdate(info));
			actions.appendChild(later);
			actions.appendChild(skip);
			actions.appendChild(changes);
			actions.appendChild(apply);
			panel.appendChild(actions);
			if (document.body !== undefined) document.body.appendChild(panel);
			updatePanel = panel;
		}

		/** Collapses only the expanded card, keeping the quiet chip. */
		function renderUpdatePanelCollapse() {
			if (updatePanel === undefined) return;
			updatePanel.remove?.();
			if (updatePanel.parentNode) updatePanel.parentNode.removeChild(updatePanel);
			updatePanel = undefined;
		}

		/** Renders the corner chip when an update is available. */
		function renderUpdateNotice(info) {
			removeUpdateUi();
			if (info === null || info === undefined || info.ok !== true || info.upToDate === true) return;
			const latest = typeof info.latest === "string" ? info.latest : undefined;
			if (latest === undefined || latest === "") return;
			const order = latest === PACKAGE_VERSION ? 0 : 1;
			if (order === 0) return;
			if (updateSuppressed(latest)) return;
			updateInfo = info;
			const chip = updateElement("div", "position:fixed;left:16px;bottom:16px;z-index:2147483646;cursor:pointer;display:flex;align-items:center;gap:7px;padding:7px 11px;"
				+ "border-radius:999px;background:rgba(18,20,23,.97);border:1px solid " + (info.critical === true ? "rgba(230,150,120,.7)" : "rgba(122,162,255,.4)") + ";"
				+ "box-shadow:0 6px 22px rgba(0,0,0,.4);color:#f2f3f5;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
			chip.setAttribute("data-dsh-locale-ru-update", "");
			chip.setAttribute("role", "button");
			chip.setAttribute("title", "Проверить обновление плагина");
			const dot = updateElement("span", "width:7px;height:7px;border-radius:50%;flex:none;background:" + (info.critical === true ? "#e6a07a" : "#9fe6b4"), "");
			chip.appendChild(dot);
			chip.appendChild(updateElement("span", "", info.critical === true ? `Критично: обновление ${latest}` : `Обновление ${latest}`));
			chip.addEventListener("click", () => {
				if (updatePanel !== undefined) renderUpdatePanelCollapse();
				else renderUpdatePanel(info);
			});
			if (document.body !== undefined) document.body.appendChild(chip);
			updateNotice = chip;
		}

		/** Checks the host for a newer package version. */
		async function checkPluginUpdate(force = false) {
			if (clientDisposed === true) return undefined;
			const info = await fetchUpdateInfo(force);
			if (clientDisposed === true || info === undefined) return undefined;
			updateInfo = info;
			renderUpdateNotice(info);
			return info;
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
						if (dictationBeforeText === null) {
							// Поле не было захвачено до вставки, но мутация в окне
							// диктовки — достаточный признак, что текст доехал.
							if (after !== "") noteDictationInserted();
						}
						if (dictationBeforeText !== null && after !== dictationBeforeText) {
							const insertion = splitInsertion(dictationBeforeText, after);
							if (insertion !== undefined) {
								dictationInsertion = insertion;
								dictationInsertedAt = Date.now();
								noteDictationInserted();
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
			pluginContext = ctx;
			const restoreChip = installDictionaryChip();
			const restoreCaret = installDictationCaretFix();
			const restoreHighlights = installHighlightMaintenance();
			ctx.effect(() => () => {
				clientDisposed = true;
				clearTimeout(recoveryTimer);
				clearTimeout(learnTimer);
				clearInterval(updateCheckTimer);
				removeUpdateUi();
				clearDictationHighlights();
				hideRecoveryPanel();
				closeAllModalWindows();
			});
			setTimeout(() => {
				if (clientDisposed !== true) restoreStoredRecovery();
			}, 2000);
			setTimeout(() => {
				if (clientDisposed !== true) void checkPluginUpdate(false);
			}, UPDATE_CHECK_START_MS);
			updateCheckTimer = setInterval(() => {
				if (clientDisposed !== true) void checkPluginUpdate(false);
			}, UPDATE_CHECK_INTERVAL_MS);
			// В Node-тестах длинный интервал не должен держать процесс живым.
			updateCheckTimer?.unref?.();
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
