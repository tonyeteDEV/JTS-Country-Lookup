import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    COUNTRY_CODES,
    findMatchingOption,
    findOptionByCode,
    getCountryOptions,
    normalizeForSearch,
    parseValueFormat,
    resolveStoredValue,
    resolveUserLanguageTag,
} from "../JTSCountryLookup/countries";

describe("COUNTRY_CODES", () => {
    test("every code is a two-letter uppercase ISO 3166-1 alpha-2 code", () => {
        for (const code of COUNTRY_CODES) {
            assert.match(code, /^[A-Z]{2}$/, `"${code}" is not a two-letter uppercase code`);
        }
    });

    test("has no duplicate codes", () => {
        assert.equal(new Set(COUNTRY_CODES).size, COUNTRY_CODES.length);
    });
});

describe("getCountryOptions", () => {
    test("returns one option per country code", () => {
        const options = getCountryOptions("en");
        assert.equal(options.length, COUNTRY_CODES.length);
        assert.deepEqual(
            new Set(options.map((option) => option.code)),
            new Set(COUNTRY_CODES)
        );
    });

    test("sorts options alphabetically by localized name", () => {
        const options = getCountryOptions("en");
        const names = options.map((option) => option.name);
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        assert.deepEqual(names, sorted);
    });

    test("falls back to English for a well-formed but unrecognized language code", () => {
        // Regression test: Intl.DisplayNames doesn't throw for a syntactically valid but unknown
        // tag like a typo'd "sp" - it silently resolves to the runtime's default locale instead,
        // which createRegionDisplayNames must detect and reject rather than trust.
        const fallback = getCountryOptions("en");
        const invalid = getCountryOptions("not-a-real-locale");
        assert.deepEqual(invalid, fallback);
    });

    test("falls back to English for a malformed language code that throws at construction", () => {
        const fallback = getCountryOptions("en");
        const malformed = getCountryOptions("1");
        assert.deepEqual(malformed, fallback);
    });

    test("localizes names differently depending on language", () => {
        const english = getCountryOptions("en");
        const spanish = getCountryOptions("es");
        const englishSpain = english.find((option) => option.code === "ES");
        const spanishSpain = spanish.find((option) => option.code === "ES");
        assert.equal(englishSpain?.name, "Spain");
        assert.equal(spanishSpain?.name, "España");
    });
});

describe("normalizeForSearch", () => {
    test("lowercases and strips diacritics", () => {
        assert.equal(normalizeForSearch("España"), "espana");
        assert.equal(normalizeForSearch("Köln"), "koln");
        assert.equal(normalizeForSearch("ÀÉÎÕÜ"), "aeiou");
    });

    test("leaves plain ASCII text alphanumerics untouched aside from casing", () => {
        assert.equal(normalizeForSearch("United States"), "united states");
    });
});

describe("parseValueFormat", () => {
    test('returns "IsoCode" only for the raw enum value "2"', () => {
        assert.equal(parseValueFormat("2"), "IsoCode");
    });

    test('defaults to "Name" for "1", undefined, or unrecognized values', () => {
        assert.equal(parseValueFormat("1"), "Name");
        assert.equal(parseValueFormat(undefined), "Name");
        assert.equal(parseValueFormat("bogus"), "Name");
    });
});

describe("resolveStoredValue", () => {
    const option = { code: "US", name: "United States" };

    test("returns the ISO code when format is IsoCode", () => {
        assert.equal(resolveStoredValue(option, "IsoCode"), "US");
    });

    test("returns the localized name when format is Name", () => {
        assert.equal(resolveStoredValue(option, "Name"), "United States");
    });
});

describe("findMatchingOption", () => {
    const options = getCountryOptions("en");

    test("matches by ISO code case-insensitively", () => {
        assert.equal(findMatchingOption(options, "us")?.code, "US");
        assert.equal(findMatchingOption(options, "US")?.code, "US");
    });

    test("matches by localized name case-insensitively", () => {
        assert.equal(findMatchingOption(options, "united states")?.code, "US");
    });

    test("returns undefined for null, empty, or unmatched values", () => {
        assert.equal(findMatchingOption(options, null), undefined);
        assert.equal(findMatchingOption(options, undefined), undefined);
        assert.equal(findMatchingOption(options, ""), undefined);
        assert.equal(findMatchingOption(options, "Not A Country"), undefined);
    });
});

describe("findOptionByCode", () => {
    const options = getCountryOptions("en");

    test("finds the option with a matching code", () => {
        assert.equal(findOptionByCode(options, "FR")?.name, "France");
    });

    test("returns undefined when the code is missing or not found", () => {
        assert.equal(findOptionByCode(options, undefined), undefined);
        assert.equal(findOptionByCode(options, "ZZ"), undefined);
    });
});

describe("resolveUserLanguageTag", () => {
    test("maps a known Dataverse LCID to its language tag", () => {
        assert.equal(resolveUserLanguageTag(1034), "es");
        assert.equal(resolveUserLanguageTag(1036), "fr");
    });

    test("falls back to English for null, undefined, or unmapped LCIDs", () => {
        assert.equal(resolveUserLanguageTag(null), "en");
        assert.equal(resolveUserLanguageTag(undefined), "en");
        assert.equal(resolveUserLanguageTag(999999), "en");
    });
});
