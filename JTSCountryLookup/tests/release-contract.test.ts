// Guards the handful of things that must stay in lockstep across this repo's release artifacts
// but that TypeScript/ESLint have no way to check on their own: the version number appearing in
// three unrelated file formats, and every localization key the manifest/control code reference
// actually having a translation in both shipped languages.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// process.cwd() rather than __dirname/import.meta.url - "npm test" always runs from the project
// root (where package.json lives), and this way the file's module kind doesn't matter to tsx/tsc.
const ROOT = process.cwd();

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
const manifestXml = readFileSync(join(ROOT, "JTSCountryLookup", "ControlManifest.Input.xml"), "utf8");
const solutionXml = readFileSync(
    join(ROOT, "solutions", "CountryLookupSolution", "src", "Other", "Solution.xml"),
    "utf8"
);
const indexTs = readFileSync(join(ROOT, "JTSCountryLookup", "index.ts"), "utf8");

function extractAll(text: string, pattern: RegExp): string[] {
    return [...text.matchAll(pattern)].map((match) => match[1]);
}

describe("version consistency", () => {
    test("package.json version matches the control version in ControlManifest.Input.xml", () => {
        const manifestVersion = manifestXml.match(/<control[^>]*\sversion="([^"]+)"/)?.[1];
        assert.equal(manifestVersion, packageJson.version);
    });

    test("package.json version matches the Solution.xml version (ignoring the trailing build segment)", () => {
        const solutionVersion = solutionXml.match(/<Version>([^<]+)<\/Version>/)?.[1];
        assert.equal(solutionVersion, `${packageJson.version}.0`);
    });
});

describe("localization coverage", () => {
    const resxKeyPattern = /<data name="([^"]+)"/g;
    const englishResx = readFileSync(join(ROOT, "JTSCountryLookup", "strings", "JTSCountryLookup.1033.resx"), "utf8");
    const spanishResx = readFileSync(join(ROOT, "JTSCountryLookup", "strings", "JTSCountryLookup.1034.resx"), "utf8");
    const englishKeys = new Set(extractAll(englishResx, resxKeyPattern));
    const spanishKeys = new Set(extractAll(spanishResx, resxKeyPattern));

    // Every *-key attribute in the manifest (control/property display+description keys, plus each
    // enum <value>'s display-name-key) names a resx entry the platform resolves at import/design
    // time - a typo here silently shows the raw key name in the maker UI instead of real text.
    const manifestKeys = new Set([
        ...extractAll(manifestXml, /(?:display-name-key|description-key)="([^"]+)"/g),
    ]);

    // Every getString("Key", fallback) call in index.ts names a resx entry resolved at runtime via
    // context.resources.getString - the fallback masks a missing key in English, but not in Spanish.
    const runtimeKeys = new Set(extractAll(indexTs, /getString\("([^"]+)"/g));

    test("the manifest references at least the properties/enum values we expect", () => {
        assert.ok(manifestKeys.size >= 10, "expected the manifest to declare multiple *-key attributes");
    });

    test("every manifest *-key has an English translation", () => {
        const missing = [...manifestKeys].filter((key) => !englishKeys.has(key));
        assert.deepEqual(missing, []);
    });

    test("every manifest *-key has a Spanish translation", () => {
        const missing = [...manifestKeys].filter((key) => !spanishKeys.has(key));
        assert.deepEqual(missing, []);
    });

    test("every runtime getString key has an English translation", () => {
        const missing = [...runtimeKeys].filter((key) => !englishKeys.has(key));
        assert.deepEqual(missing, []);
    });

    test("every runtime getString key has a Spanish translation", () => {
        const missing = [...runtimeKeys].filter((key) => !spanishKeys.has(key));
        assert.deepEqual(missing, []);
    });
});

describe("packaged solution artifacts", () => {
    const managedZip = join(ROOT, "dist", "CountryLookupSolution_managed.zip");
    const unmanagedZip = join(ROOT, "dist", "CountryLookupSolution_unmanaged.zip");

    test("both managed and unmanaged solution zips exist and are non-empty", () => {
        for (const zipPath of [managedZip, unmanagedZip]) {
            assert.ok(existsSync(zipPath), `missing ${zipPath}`);
            assert.ok(statSync(zipPath).size > 0, `${zipPath} is empty`);
        }
    });
});
