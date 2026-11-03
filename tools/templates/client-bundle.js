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
		/** Whether the caret fix still waits for the insertion mutation. */
		let caretFixPending = false;
		/** Debounce timer for auto-learning. */
		let learnTimer;

		/** Marks the moment a dictation recording ended; the insertion follows. */
		function markDictationEnded() {
			dictationEndedAt = Date.now();
			clearDictationHighlights();
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
				const result = await postDictionary("/learn", pair);
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

		/** Overlay highlights of the last dictation. */
		let dictationHighlights = [];
		/** Applied replacements of the last dictation: chosen → heard. */
		let lastAppliedReplacements = {};
		/** Hook set by the popover: opens it for the current selection. */
		let openSelectionPopover = () => {};

		/** Clears highlight overlays. */
		function clearDictationHighlights() {
			for (const element of dictationHighlights) {
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

		/** Finds the range of a whole-word occurrence in the editable. */
		function findWordRange(editable, word, occurrence = 0) {
			const needle = String(word).toLowerCase();
			if (needle === "") return undefined;
			let seen = 0;
			for (const node of textNodesOf(editable)) {
				const data = String(node.data ?? "");
				const lower = data.toLowerCase();
				let from = 0;
				while (from <= lower.length - needle.length) {
					const index = lower.indexOf(needle, from);
					if (index === -1) break;
					const before = index === 0 ? " " : data[index - 1];
					const after = index + needle.length >= data.length ? " " : data[index + needle.length];
					const boundary = (character) => /[^\p{L}\p{N}]/u.test(character);
					if (boundary(before) && boundary(after)) {
						if (seen === occurrence) {
							try {
								const range = document.createRange();
								range.setStart(node, index);
								range.setEnd(node, index + needle.length);
								return range;
							} catch (error) {
								return undefined;
							}
						}
						seen += 1;
					}
					from = index + needle.length;
				}
			}
			return undefined;
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
			dictationHighlights.push(element);
		}

		/** Fetches info about the last transcription from the host. */
		async function fetchLastTranscription() {
			for (const port of DICTIONARY_PORTS) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/last-transcription`, { signal: AbortSignal.timeout(1200) });
					if (!response.ok) continue;
					return await response.json();
				} catch (error) {
					// порт не слушается — пробуем следующий
				}
			}
			return undefined;
		}

		/** Highlights applied replacements and suggests terms for suspicious words. */
		async function highlightDictationResult(editable) {
			clearDictationHighlights();
			if (editable === null || editable === undefined) return;
			const info = await fetchLastTranscription();
			const applied = Array.isArray(info?.applied) ? info.applied : [];
			lastAppliedReplacements = {};
			for (const pair of applied) {
				const chosen = String(pair.chosen ?? "");
				if (chosen === "") continue;
				lastAppliedReplacements[chosen.toLowerCase()] = String(pair.heard ?? "");
				const range = findWordRange(editable, chosen);
				if (range !== undefined) drawHighlight(range, "replaced");
			}
			// Подсказки: кириллические слова, похожие на термины словаря.
			const dictionary = await fetchDictionary();
			const seen = new Set();
			for (const node of textNodesOf(editable)) {
				const data = String(node.data ?? "");
				for (const match of data.matchAll(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]{3,}/gu)) {
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
					const range = findWordRange(editable, token);
					if (range !== undefined) drawHighlight(range, "suggestion");
				}
			}
			if (dictationHighlights.length > 0) setTimeout(() => clearDictationHighlights(), 15000);
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
				dictionaryModal.dictionary = await fetchDictionary();
				renderDictionaryModal();
			}
			showToast(added > 0 ? `Добавлено: ${added}` : "Не удалось добавить", added > 0);
			return added;
		}

		/** Fetches the engine settings from the host. */
		async function fetchEngineInfo() {
			for (const port of DICTIONARY_PORTS) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/engine`, { signal: AbortSignal.timeout(1200) });
					if (!response.ok) continue;
					return await response.json();
				} catch (error) {
					// следующий порт
				}
			}
			return undefined;
		}

		/** Saves the engine choice through the host. */
		async function saveEngineChoice(engine, merge) {
			for (const port of DICTIONARY_PORTS) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/engine`, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ engine, merge }),
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

		/** Fetches term suggestions from the host (garbled terms from transcripts). */
		async function fetchSuggestions() {
			for (const port of DICTIONARY_PORTS) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/suggestions`, { signal: AbortSignal.timeout(1500) });
					if (!response.ok) continue;
					const payload = await response.json();
					return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
				} catch (error) {
					// следующий порт
				}
			}
			return [];
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

		/** Renders the modal content: search, add row, words and replacements. */
		function renderDictionaryModal() {
			if (dictionaryModal === undefined) return;
			const { body, addInput, searchInput, dictionary } = dictionaryModal;
			const query = String(searchInput.value ?? "").trim().toLowerCase();
			const words = (dictionary.words ?? []).filter((word) => query === "" || word.toLowerCase().includes(query));
			const pairs = Object.entries(dictionary.replacements ?? {}).filter(([heard, chosen]) => query === "" || `${heard} ${chosen}`.toLowerCase().includes(query));
			while (body.firstChild !== undefined && body.firstChild !== null) body.removeChild(body.firstChild);

			const section = (title, count) => {
				body.appendChild(modalElement("div", "padding:10px 4px 4px;color:#8a8a95;font:600 11px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-transform:uppercase;letter-spacing:.04em", `${title} (${count})`));
			};
			const row = (label, onRemove) => {
				const line = modalElement("div", "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 10px;border-radius:8px;color:#f2f2f5;font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif");
				const text = modalElement("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", label);
				const remove = modalElement("span", "cursor:pointer;color:#8a8a95;padding:0 4px;font-size:15px;line-height:1", "×");
				remove.setAttribute("role", "button");
				remove.addEventListener("click", onRemove);
				line.appendChild(text);
				line.appendChild(remove);
				return line;
			};

			// Движок и стратегия: настройка гибрида «для продвинутых».
			const engineInfo = dictionaryModal.engineInfo;
			if (engineInfo !== undefined) {
				section("Движок", 0);
				const engineRow = modalElement("div", "display:flex;gap:6px;padding:2px 4px 4px;flex-wrap:wrap");
				const engineButtons = [
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
							dictionaryModal.dictionary = await fetchDictionary();
							dictionaryModal.suggestions = await fetchSuggestions();
							renderDictionaryModal();
							showToast(`Запомнено: ${suggestion.heard} → ${suggestion.chosen}`, true);
						} else {
							showToast("Не удалось запомнить", false);
						}
					});
					line.appendChild(remember);
					body.appendChild(line);
				}
			}
			section("Слова", words.length);
			if (words.length === 0) body.appendChild(modalElement("div", "padding:6px 10px;color:#8a8a95;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", query === "" ? "Пока пусто — добавьте слово сверху" : "Ничего не найдено"));
			for (const word of words.slice(0, 200)) {
				body.appendChild(row(word, async () => {
					const result = await postDictionary("/forget", word);
					if (result !== undefined && result.ok) {
						dictionaryCache.at = 0;
						dictionaryModal.dictionary = await fetchDictionary();
						renderDictionaryModal();
						showToast(`Убрано: ${word}`, true);
					} else {
						showToast("Не удалось удалить", false);
					}
				}));
			}
			if (pairs.length > 0) {
				section("Замены", pairs.length);
				for (const [heard, chosen] of pairs.slice(0, 200)) {
					body.appendChild(row(`${heard} → ${chosen}`, async () => {
						const result = await postDictionary("/forget-pair", { heard });
						if (result !== undefined && result.ok) {
							dictionaryCache.at = 0;
							dictionaryModal.dictionary = await fetchDictionary();
							renderDictionaryModal();
							showToast(`Убрана замена: ${heard}`, true);
						} else {
							showToast("Не удалось удалить замену", false);
						}
					}));
				}
			}
			if (addInput.value === undefined) addInput.value = "";
		}

		/** Opens the dictionary modal: search, add field and both lists. */
		async function openDictionaryModal() {
			if (dictionaryModal !== undefined) return;
			const [dictionary, engineInfo, suggestions] = await Promise.all([fetchDictionary(), fetchEngineInfo(), fetchSuggestions()]);
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

			const body = modalElement("div", "flex:1;overflow-y:auto;overscroll-behavior:contain;padding:0 12px 12px;display:flex;flex-direction:column;gap:2px");
			body.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
			panel.appendChild(body);

			const footer = modalElement("div", "display:flex;gap:8px;justify-content:flex-end;padding:10px 16px 14px;border-top:1px solid rgba(255,255,255,.06)");
			const agentButton = modalElement("div", "cursor:pointer;padding:7px 12px;border-radius:9px;background:rgba(80,60,110,.9);color:#f2f2f5;"
				+ "font:500 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "Попросить агента дообучить");
			agentButton.setAttribute("role", "button");
			agentButton.addEventListener("click", () => requestAgentCoaching());
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
			footer.appendChild(agentButton);
			footer.appendChild(clipboardButton);
			footer.appendChild(doneButton);
			panel.appendChild(footer);

			backdrop.appendChild(panel);
			if (document.body !== undefined) document.body.appendChild(backdrop);
			dictionaryModal = { backdrop, panel, body, addInput, searchInput, dictionary, engineInfo, suggestions };
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
				if (String(event.key ?? "").toLowerCase() !== "d") return;
				if (typeof event.preventDefault === "function") event.preventDefault();
				if (!removed) toggleDictionaryModal();
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
				if (dictionaryModal !== undefined) {
					closeDictionaryModal();
					return;
				}
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
