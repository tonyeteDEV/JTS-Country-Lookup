# Country Lookup (PCF)

A [PowerApps Component Framework](https://learn.microsoft.com/power-apps/developer/component-framework/overview) control for Dataverse that turns a plain text column into a searchable country picker — no new Dataverse table, no plugin, no external service to configure. Bind it to the standard `address1_country`-style column (or any text column) that already exists on your table and it becomes a real lookup: type to search, pick from the list, clear with one click.

## Why

Most tables that carry an address already have a `country` text column, and it's almost always free text — inconsistent values ("Spain", "España", "spain", "ESP"...) that break filtering, grouping, and reporting. This control keeps using that exact same column (no schema change, no data migration) but constrains entry to a real, consistent list.

## How it works

Everything runs entirely client-side, with zero backend dependency:

- **Country names come from `Intl.DisplayNames`**, a browser-native API (part of ECMA-402, shipped in every browser Model-driven Power Apps supports) that returns the localized name of any region code in any language — no external API call, no bundled translation dataset, no network dependency at all.
- **The list of ISO 3166-1 alpha-2 codes is a small static array** bundled with the control (`countries.ts`). This list is for all practical purposes permanent (new country codes are an exceptionally rare event), so there's no freshness cost to not fetching it from anywhere.

Combined, this is more robust than calling a public "list of countries" API at runtime would have been: no rate limits, no uptime dependency on a third party, and nothing for a restrictive corporate network/CSP policy to block — while still requiring zero configuration beyond importing the solution and binding a field.

## Setup

1. Import `JTSCountryLookup/dist/CountryLookupSolution_unmanaged.zip` (or `_managed`).
2. Bind the control to any single-line text column on any table/form — most naturally the standard address country column, but it works on any text field.
3. Optionally set:
   - **Language code** — ISO 639-1 code (`en`, `es`, `fr`, `de`, ...) used to display and search country names. Leave blank for English.
   - **Stored value format** — **Country name** (default) or **ISO code**. Country name is the safer default for an existing address column: it matches what's typically already there, so existing reports/views built around a country name string keep working — the control just makes the values consistent going forward instead of free text. ISO code is better if you want a normalized value for filtering/grouping and don't have existing data/reports depending on the current format.

If the field already has data that doesn't match any known country (legacy free text, a typo, etc.), the control still shows it as-is rather than blanking it — picking a new value from the list is what actually changes it.

## Design notes

**React 18 + `createRoot`, not the legacy `ReactDOM.render()` pattern.** This control uses Fluent UI's `Combobox` for the search/select UI, which — like `Dialog` — relies on `@fluentui/react-positioning` for its dropdown. A sibling PCF project in this author's other repos hit a real, reproducible crash using exactly this class of Fluent component under the legacy `ReactDOM.render()` API (which tears down and rebuilds the whole React tree from scratch on every `updateView()`) combined with React 16 — see that project's README for the full writeup. Rather than avoid Fluent's polished (and more accessible) components again here, this control creates a **single persistent root once, in `init()`**, and calls `root.render()` on that same root for every subsequent `updateView()` — the officially-supported React 18 pattern for repeated re-rendering, and what Fluent UI v9 itself is built and tested against. This should avoid the whole bug class at the source rather than working around individual components, but — like a couple of other things in this project's own history — hasn't been exercised in a live Dataverse form by anyone other than this control's own author yet; flag it if the dropdown ever misbehaves.

**Enum-type manifest properties expose their numeric code, not the `name` attribute, at runtime.** `context.parameters.valueFormat.raw` returns `"1"`/`"2"` (matching the `<value>` element's numeric body in `ControlManifest.Input.xml`), not the string `"Name"`/`"IsoCode"` used for the `name` attribute (which is only the label shown in the form designer's property dropdown). Caught by checking the auto-generated `ManifestTypes.d.ts` rather than assuming — `parseValueFormat` in `countries.ts` does this mapping explicitly.

**Accent-insensitive search.** Typing "espana" matches "España", "koln" matches "Köln" — `normalizeForSearch` runs `String.normalize("NFD")` then strips the combining-diacritic Unicode range before comparing, so search isn't defeated by accents the user didn't bother typing.

## Repository layout

```
JTSCountryLookup/                          the PCF control project
  JTSCountryLookup.pcfproj
  JTSCountryLookup/                        control source (manifest, index.ts, countries.ts, editor, css)
  webpack.config.js / featureconfig.json   react/jsx-runtime bundling fix (needed to bundle Fluent UI v9)
  solutions/
    CountryLookupSolution/                 the one solution: just the control, no plugin/Custom API/entities
  dist/                                    ready-to-import zips
```

No plugin project exists in this repo at all — unlike this author's other PCF projects, there is no server-side component whatsoever.

## Rebuilding from source

```bash
cd JTSCountryLookup && npm install && npm run build -- --buildMode production && cd ..
cd JTSCountryLookup/solutions/CountryLookupSolution && dotnet build -p:PcfBuildMode=production && cd ../../..
```

**Always pass `--buildMode production` / `-p:PcfBuildMode=production` explicitly** — without it, webpack can ship an unminified multi-MB dev bundle instead of the production one.

**Bump `version` in `ControlManifest.Input.xml`** whenever a control change needs to reach an already-imported environment — Dataverse doesn't reliably refresh a custom control's registered resources on `pac solution import` if the manifest version is unchanged from what's already there.

**No live Dataverse round trip is needed to (re)build the solution package itself**, unlike a plugin-backed solution. `solutions/CountryLookupSolution/src/Other/Solution.xml` and `Customizations.xml` are hand-authored (declaring just the solution's own identity and an empty `<CustomControls />` collection), and the `.cdsproj`'s `ProjectReference` to the pcfproj supplies the actual control definition/bundle from a fresh local build automatically when packing — `pac solution export`/`unpack` is never part of this project's normal workflow the way it is for a plugin-backed one.

## License

MIT — see [LICENSE](LICENSE).
