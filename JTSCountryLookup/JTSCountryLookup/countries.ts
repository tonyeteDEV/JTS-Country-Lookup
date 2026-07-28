// ISO 3166-1 alpha-2 codes for every currently-assigned country/territory. This list is
// deliberately static and bundled with the control rather than fetched from anywhere at
// runtime - new country codes are an extremely rare event (the list has barely changed in
// decades), so there is no real freshness cost to this, and it keeps the control's "no external
// dependency" promise absolute: no network call, no API key, no rate limit, no uptime dependency
// on a third party, and nothing for a restrictive corporate network/CSP policy to block.
export const COUNTRY_CODES: readonly string[] = [
    "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
    "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
    "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
    "DE", "DJ", "DK", "DM", "DO", "DZ",
    "EC", "EE", "EG", "EH", "ER", "ES", "ET",
    "FI", "FJ", "FK", "FM", "FO", "FR",
    "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
    "HK", "HM", "HN", "HR", "HT", "HU",
    "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
    "JE", "JM", "JO", "JP",
    "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
    "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
    "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
    "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
    "OM",
    "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
    "QA",
    "RE", "RO", "RS", "RU", "RW",
    "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
    "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
    "UA", "UG", "UM", "US", "UY", "UZ",
    "VA", "VC", "VE", "VG", "VI", "VN", "VU",
    "WF", "WS",
    "YE", "YT",
    "ZA", "ZM", "ZW",
];

export interface CountryOption {
    code: string;
    name: string;
}

const DEFAULT_LANGUAGE_CODE = "en";

// Intl.DisplayNames only throws for a syntactically malformed tag (e.g. "1"). A well-formed but
// unrecognized tag - exactly the realistic typo case, "sp" instead of "es" in the "Language code"
// property - does NOT throw: it silently resolves to whatever locale the current runtime/browser
// defaults to, which is neither the requested language nor DEFAULT_LANGUAGE_CODE. Left unchecked,
// that would make the same typo render (and, worse, store - see storageLanguageCode in
// CountryLookupEditor.tsx) a different language on every user's machine instead of failing
// predictably to English. Comparing the resolved locale's base language subtag against the
// requested one catches that silent mismatch and falls through to the next candidate.
function createRegionDisplayNames(languageCode: string): Intl.DisplayNames | null {
    if (typeof Intl === "undefined" || typeof Intl.DisplayNames === "undefined") {
        // Only realistically hit on very old browsers - Model-driven Power Apps' supported
        // browser matrix (current Edge/Chrome/Firefox/Safari) has shipped this for years.
        return null;
    }
    const candidates = [languageCode?.trim(), DEFAULT_LANGUAGE_CODE].filter((code): code is string => !!code);
    for (const candidate of candidates) {
        try {
            const displayNames = new Intl.DisplayNames([candidate], { type: "region" });
            const requestedLanguage = candidate.split("-")[0].toLowerCase();
            const resolvedLanguage = displayNames.resolvedOptions().locale.split("-")[0].toLowerCase();
            if (requestedLanguage !== resolvedLanguage) continue;
            return displayNames;
        } catch {
            // Malformed locale tag - try the next candidate.
        }
    }
    return null;
}

// Localized name for every known country code, sorted alphabetically by that name (so the list
// reads sensibly regardless of language). Falls back to the bare code if Intl.DisplayNames is
// unavailable or doesn't have a name for a given region.
export function getCountryOptions(languageCode: string): CountryOption[] {
    const displayNames = createRegionDisplayNames(languageCode);
    const options = COUNTRY_CODES.map((code) => ({
        code,
        name: displayNames?.of(code) ?? code,
    }));
    options.sort((a, b) => a.name.localeCompare(b.name));
    return options;
}

// Diacritics range (combining marks left behind by String.normalize("NFD")) built from explicit
// numeric code points (U+0300 - U+036F) rather than literal characters in the source, so there is
// zero ambiguity about which characters this actually matches regardless of how the file is
// viewed/edited - lowercase + strip diacritics means typing "espana" matches "España" and "koln"
// matches "Köln"-style names, which a plain substring match on the raw localized string would
// otherwise miss.
const DIACRITIC_MARKS_PATTERN = new RegExp(`[\\u0300-\\u036f]`, "g");

export function normalizeForSearch(text: string): string {
    return text.normalize("NFD").replace(DIACRITIC_MARKS_PATTERN, "").toLowerCase();
}

export type ValueFormat = "Name" | "IsoCode";

// The "Stored value format" manifest property is an Enum - at runtime its .raw is the numeric
// code as a string ("1"/"2", matching the <value name="..."> entries in ControlManifest.Input.xml),
// not the "name" attribute text. 2 selects IsoCode; anything else (including "1", missing, or an
// unrecognized value) defaults to Name, matching the manifest's own default-value="1".
export function parseValueFormat(rawEnumValue: string | undefined): ValueFormat {
    return rawEnumValue === "2" ? "IsoCode" : "Name";
}

export function resolveStoredValue(option: CountryOption, format: ValueFormat): string {
    return format === "IsoCode" ? option.code : option.name;
}

// Reverse lookup: given whatever is currently stored in the bound column, find the matching
// option so the control can show the right selection on load - matches by code (exact, case-
// insensitive) or by localized name (exact, case-insensitive), covering both configured storage
// formats and both directions if the format is ever switched on an existing field.
export function findMatchingOption(options: CountryOption[], storedValue: string | null | undefined): CountryOption | undefined {
    if (!storedValue) return undefined;
    const normalized = storedValue.trim().toLowerCase();
    return options.find((option) => option.code.toLowerCase() === normalized || option.name.toLowerCase() === normalized);
}

// Looks up an option by its ISO code alone (language-independent) - used to carry a selection
// made against one language's option list (e.g. the display language) over to a lookup in a
// different language's option list (e.g. the storage language), since the code is the only thing
// both lists have in common.
export function findOptionByCode(options: CountryOption[], code: string | undefined): CountryOption | undefined {
    if (!code) return undefined;
    return options.find((option) => option.code === code);
}

// Dataverse reports the current user's UI language as a numeric LCID (via
// context.userSettings.languageId), not a BCP-47/ISO 639-1 tag - this maps the LCIDs of
// Dataverse's own officially supported UI languages to the tag Intl.DisplayNames expects. Not
// exhaustive of every possible Windows LCID, only Dataverse's supported language-pack list (plus
// a few extremely common regional variants) - anything unmapped falls back to English, which is
// always a safe, correct (if untranslated) result rather than a broken one.
const LCID_TO_LANGUAGE_TAG: Readonly<Record<number, string>> = {
    1025: "ar", 1026: "bg", 1027: "ca", 1028: "zh", 1029: "cs", 1030: "da", 1031: "de", 1032: "el",
    1033: "en", 1034: "es", 1035: "fi", 1036: "fr", 1037: "he", 1038: "hu", 1040: "it", 1041: "ja",
    1042: "ko", 1043: "nl", 1044: "nb", 1045: "pl", 1046: "pt", 1048: "ro", 1049: "ru", 1050: "hr",
    1051: "sk", 1053: "sv", 1054: "th", 1055: "tr", 1057: "id", 1058: "uk", 1060: "sl", 1061: "et",
    1062: "lv", 1063: "lt", 1066: "vi", 1069: "eu", 1071: "mk", 1081: "hi", 1086: "ms", 1087: "kk",
    1110: "gl", 2052: "zh", 2058: "es", 2070: "pt", 2074: "sr", 2057: "en", 3082: "es", 3084: "fr",
};

export function resolveUserLanguageTag(languageId: number | null | undefined): string {
    if (!languageId) return DEFAULT_LANGUAGE_CODE;
    return LCID_TO_LANGUAGE_TAG[languageId] ?? DEFAULT_LANGUAGE_CODE;
}
