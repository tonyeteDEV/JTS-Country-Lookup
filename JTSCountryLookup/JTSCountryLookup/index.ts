import * as React from "react";
import { Root, createRoot } from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { JTSCountryLookupEditor } from "./CountryLookupEditor";
import { parseValueFormat, resolveUserLanguageTag } from "./countries";

export class JTSCountryLookup implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private notifyOutputChanged!: () => void;
    private context!: ComponentFramework.Context<IInputs>;
    private root!: Root;
    private outputValue = "";

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        this.context = context;
        this.outputValue = context.parameters.countryValue.raw ?? "";

        // A single persistent root, created once here and reused for every subsequent
        // updateView() via root.render() - never torn down and recreated. This is React 18's
        // supported pattern for exactly this "re-render the same tree repeatedly" scenario, and
        // is what makes Fluent UI's positioning-based components (the Combobox dropdown here)
        // safe to use - the sibling SharePointDocumentUploader control in this project's other
        // repos had to hand-roll around a real crash caused by the legacy ReactDOM.render()
        // pattern (destroy-and-recreate the whole tree on every render, under React 16) combined
        // with exactly this kind of component; createRoot()/root.render() is the fix for that at
        // the source rather than avoiding the affected components.
        this.root = createRoot(container);
        this.renderControl();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;
        this.outputValue = context.parameters.countryValue.raw ?? "";
        this.renderControl();
    }

    private renderControl(): void {
        const storageLanguageCode = this.context.parameters.languageCode?.raw || "en";
        // The value saved to the database always uses storageLanguageCode - only what's shown/
        // searched on screen switches to the user's own language when this is enabled, so stored
        // data stays consistent across users regardless of who last edited a given record.
        const useUserLanguage = this.context.parameters.useUserLanguage?.raw ?? false;
        const displayLanguageCode = useUserLanguage
            ? resolveUserLanguageTag(this.context.userSettings.languageId)
            : storageLanguageCode;
        const valueFormat = parseValueFormat(this.context.parameters.valueFormat?.raw);
        const isDisabled = this.context.mode.isControlDisabled;
        const getString = (key: string, fallback: string): string =>
            this.context.resources?.getString(key) || fallback;
        const strings = {
            countriesHeader: getString("UI_CountriesHeader", "Countries"),
            clear: getString("UI_Clear", "Clear"),
            searchCountries: getString("UI_SearchCountries", "Search countries"),
            searchPlaceholder: getString("UI_SearchPlaceholder", "Search..."),
            emptyPlaceholder: getString("UI_EmptyPlaceholder", "---"),
            noResults: getString("UI_NoResults", "No countries found"),
            errorPrefix: getString("UI_ErrorPrefix", "Country lookup error"),
        };

        this.root.render(
            React.createElement(
                FluentProvider,
                { theme: webLightTheme, style: { background: "none" } },
                React.createElement(JTSCountryLookupEditor, {
                    value: this.outputValue,
                    displayLanguageCode,
                    storageLanguageCode,
                    valueFormat,
                    disabled: isDisabled,
                    strings,
                    onChange: this.handleChange,
                })
            )
        );
    }

    // Picking a country is a plain field edit, same as typing into any other bound text field -
    // unlike the SharePoint uploader control, there is no server round trip here at all, so the
    // standard notifyOutputChanged()/getOutputs() pattern is exactly right: the platform marks
    // the field dirty and persists it on the form's own next save, same as it would for a native
    // Lookup or text field.
    private readonly handleChange = (newValue: string): void => {
        this.outputValue = newValue;
        // Render the local output immediately so clearing or replacing a country is reflected
        // before the platform's next updateView cycle.
        this.renderControl();
        this.notifyOutputChanged();
    };

    public getOutputs(): IOutputs {
        return { countryValue: this.outputValue };
    }

    public destroy(): void {
        this.root.unmount();
    }
}
