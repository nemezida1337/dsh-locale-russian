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
		/** Shared toast element and its timer. */
		let sharedToast;
		let sharedToastTimer;

		/** Shows a short confirmation at the bottom of the window. */
		function showToast(text, ok) {
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
				+ "box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;transition:opacity .2s";
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
			}, 1800);
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
			const text = String(editable.innerText ?? "").toLowerCase();
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
		/** Whether the caret fix still waits for the insertion mutation. */
		let caretFixPending = false;
		/** Debounce timer for auto-learning. */
		let learnTimer;

		/** Marks the moment a dictation recording ended; the insertion follows. */
		function markDictationEnded() {
			dictationEndedAt = Date.now();
			caretFixPending = true;
			dictationInsertion = null;
			dictationBeforeText = lastComposer === null ? null : String(lastComposer.innerText ?? "");
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
					pairs.push({ heard, chosen });
				}
				return pairs;
			}
			// Пользователь склеил два слова в одно («гит хаб» → GitHub) или наоборот.
			if (left.length === 2 && right.length === 1) {
				const heard = `${trimWord(left[0])} ${trimWord(left[1])}`;
				const chosen = trimWord(right[0]);
				if (heard.length > 2 && chosen.length > 1 && similarity(heard, chosen) >= 0.6 && !LEARN_NOISE.test(chosen)) {
					pairs.push({ heard, chosen });
				}
				return pairs;
			}
			if (left.length === 1 && right.length === 2) {
				const heard = trimWord(left[0]);
				const chosen = `${trimWord(right[0])} ${trimWord(right[1])}`;
				if (heard.length > 1 && chosen.length > 2 && similarity(heard, chosen) >= 0.6 && !LEARN_NOISE.test(heard)) {
					pairs.push({ heard, chosen });
				}
				return pairs;
			}
			return [];
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
			const learned = [];
			for (const pair of pairs) {
				const result = await postDictionary("/learn", pair);
				if (result !== undefined && result.ok) learned.push(pair);
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
			for (const port of DICTIONARY_PORTS) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/dictionary`, { signal: AbortSignal.timeout(1200) });
					if (!response.ok) continue;
					const data = await response.json();
					dictionaryCache = {
						at: Date.now(),
						words: Array.isArray(data.words) ? data.words : [],
						replacements: data.replacements !== null && typeof data.replacements === "object" ? data.replacements : {},
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
			for (const port of DICTIONARY_PORTS) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}${path}`, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(payload),
						signal: AbortSignal.timeout(1500),
					});
					if (!response.ok) continue;
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

			/** Builds a dictionary row: the word and a remove button. */
			function buildWordRow(word, dictionary, rect) {
				const row = document.createElement("div");
				row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;"
					+ "padding:6px 10px;border-radius:8px;color:#f2f2f5;"
					+ "font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
				const label = document.createElement("span");
				label.textContent = word;
				label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
				const remove = document.createElement("span");
				remove.setAttribute("role", "button");
				remove.textContent = "×";
				remove.style.cssText = "cursor:pointer;color:#8a8a95;padding:0 4px;font-size:15px;line-height:1";
				remove.addEventListener("mousedown", (event) => {
					event.preventDefault();
				});
				remove.addEventListener("click", async () => {
					const result = await postDictionary("/forget", word);
					if (result !== undefined && result.ok) {
						dictionaryCache.at = 0;
						dictionaryCache.words = dictionaryCache.words.filter((entry) => entry !== word);
						showDictionaryList(rect, { ...dictionary, words: dictionary.words.filter((entry) => entry !== word) });
						showToast(`Убрано из словаря: ${word}`, true);
					} else {
						showToast("Не удалось удалить", false);
					}
				});
				row.appendChild(label);
				row.appendChild(remove);
				return row;
			}

			/** Shows the whole personal dictionary with remove buttons. */
			function showDictionaryList(rect, dictionary) {
				hidePanel();
				panelPhrase = "__dictionary__";
				panel = document.createElement("div");
				panel.setAttribute("data-dsh-locale-ru-dictionary", "");
				panel.style.cssText = "position:fixed;z-index:2147483647;min-width:180px;max-width:280px;"
					+ "padding:6px;border-radius:12px;background:rgba(20,20,22,.97);"
					+ "border:1px solid rgba(122,162,255,.35);box-shadow:0 6px 22px rgba(0,0,0,.45);"
					+ "display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto";
				panel.addEventListener("mousedown", (event) => {
					event.preventDefault();
				});
				const words = dictionary.words ?? [];
				const title = document.createElement("div");
				title.textContent = `Словарь (${words.length})`;
				title.style.cssText = "padding:2px 8px 4px;color:#8a8a95;font:500 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
				panel.appendChild(title);
				if (words.length === 0) {
					const empty = document.createElement("div");
					empty.textContent = "Пока пусто — добавьте слово через выделение";
					empty.style.cssText = "padding:6px 10px;color:#8a8a95;font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
					panel.appendChild(empty);
				}
				for (const word of words.slice(0, 80)) panel.appendChild(buildWordRow(word, dictionary, rect));
				const top = rect.top > 320 ? rect.top - 8 - Math.min(60 + words.length * 30, 320) : rect.bottom + 8;
				panel.style.left = `${Math.max(8, Math.min(rect.left, (window.innerWidth ?? 1200) - 300))}px`;
				panel.style.top = `${Math.max(8, top)}px`;
				if (document.body !== undefined) document.body.appendChild(panel);
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
				const words = dictionary.words ?? [];
				if (words.length > 0) {
					panel.appendChild(buildRow(`Словарь (${words.length})`, async () => {
						showDictionaryList(rect, dictionary);
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

			const onDocumentMouseDown = (event) => {
				if (panel === undefined) return;
				const target = event !== null && event !== undefined ? event.target : null;
				if (target === null || target === undefined) return;
				const inside = typeof panel.contains === "function" ? panel.contains(target) : false;
				if (!inside) hidePanel();
			};
			const onKeyDown = (event) => {
				if (event !== null && event !== undefined && (event.key === "Escape" || event.keyCode === 27)) hidePanel();
			};
			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("mouseup", onSelectionChange);
			document.addEventListener("keyup", onSelectionChange);
			document.addEventListener("keydown", onKeyDown);
			document.addEventListener("mousedown", onDocumentMouseDown);
			window.addEventListener("scroll", hidePanel, true);
			return () => {
				removed = true;
				clearTimeout(selectionTimer);
				document.removeEventListener("selectionchange", onSelectionChange);
				document.removeEventListener("mouseup", onSelectionChange);
				document.removeEventListener("keyup", onSelectionChange);
				document.removeEventListener("keydown", onKeyDown);
				document.removeEventListener("mousedown", onDocumentMouseDown);
				window.removeEventListener("scroll", hidePanel, true);
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
			const observer = new MutationObserver(() => {
				if (removed) return;
				if (Date.now() - dictationEndedAt > DICTATION_INSERT_WINDOW_MS) return;
				const active = document.activeElement;
				const editable = active !== null && active !== undefined && typeof active.closest === "function"
					? active.closest("[contenteditable=true]")
					: null;
				const target = editable === null ? lastComposer : editable;
				if (target === null) return;
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
							}
						}
					}
					void notifyReplacements(target);
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
							markDictationEnded();
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
			const restoreCaret = installDictationCaretFix();
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
