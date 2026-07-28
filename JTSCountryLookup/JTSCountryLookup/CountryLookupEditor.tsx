import * as React from "react";
import { Button, Combobox, MessageBar, MessageBarBody, Option, OptionGroup } from "@fluentui/react-components";
import { Dismiss16Regular, Earth16Regular, Search16Regular } from "@fluentui/react-icons";
import {
    CountryOption,
    ValueFormat,
    findMatchingOption,
    findOptionByCode,
    getCountryOptions,
    normalizeForSearch,
    resolveStoredValue,
} from "./countries";

export interface IJTSCountryLookupProps {
    value: string;
    displayLanguageCode: string;
    storageLanguageCode: string;
    valueFormat: ValueFormat;
    disabled: boolean;
    strings: ICountryLookupStrings;
    onChange: (newValue: string) => void;
}

export interface ICountryLookupStrings {
    countriesHeader: string;
    clear: string;
    searchCountries: string;
    searchPlaceholder: string;
    emptyPlaceholder: string;
    noResults: string;
    errorPrefix: string;
}

function CountryLookupInner(props: IJTSCountryLookupProps): React.ReactElement {
    const { value, displayLanguageCode, storageLanguageCode, valueFormat, disabled, strings, onChange } = props;

    // Two option lists, both keyed by the same ISO codes: storageOptions is only used to interpret
    // the value already in the database (which is always written in storageLanguageCode) and to
    // resolve what gets written back on a new selection; displayOptions is what's actually rendered
    // and searched, so a user's own language never leaks into what's saved.
    const storageOptions = React.useMemo<CountryOption[]>(() => getCountryOptions(storageLanguageCode), [storageLanguageCode]);
    const displayOptions = React.useMemo<CountryOption[]>(() => getCountryOptions(displayLanguageCode), [displayLanguageCode]);

    const selectedInStorage = React.useMemo(() => findMatchingOption(storageOptions, value), [storageOptions, value]);
    const selectedOption = React.useMemo(
        () => findOptionByCode(displayOptions, selectedInStorage?.code),
        [displayOptions, selectedInStorage]
    );

    const [query, setQuery] = React.useState("");
    // A selected lookup stays a read-only chip even while its popup is open. The Combobox remains
    // mounted behind that chip only as the popup anchor, so opening the list never changes the
    // field into an editable underline-style input.
    const [open, setOpen] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const filteredOptions = React.useMemo(() => {
        if (query.trim().length === 0) return displayOptions;
        const normalizedQuery = normalizeForSearch(query);
        return displayOptions.filter((option) => normalizeForSearch(option.name).includes(normalizedQuery));
    }, [displayOptions, query]);

    const selectCountry = (optionValue: string | undefined): void => {
        if (!optionValue) return;
        // The ISO code is shared by both option lists. Resolve it against storageOptions so the
        // stored value always uses the configured storage language.
        const pickedForStorage = findOptionByCode(storageOptions, optionValue);
        if (pickedForStorage) onChange(resolveStoredValue(pickedForStorage, valueFormat));
        setOpen(false);
        setQuery("");
    };

    const countryOptions = (
        <OptionGroup label={strings.countriesHeader}>
            {filteredOptions.length === 0 ? (
                <Option disabled text={strings.noResults}>
                    {strings.noResults}
                </Option>
            ) : (
                filteredOptions.map((option) => (
                    <Option key={option.code} value={option.code} text={option.name}>
                        <Earth16Regular className="jts-country-lookup__option-icon" />
                        {option.name}
                    </Option>
                ))
            )}
        </OptionGroup>
    );

    if (selectedOption) {
        const openLookup = (): void => {
            if (disabled) return;
            setQuery("");
            setOpen(true);
        };

        const clearLookup = (): void => {
            setOpen(false);
            setQuery("");
            onChange("");
        };

        return (
            <div className="jts-country-lookup jts-country-lookup--selected">
                {open && (
                    <Combobox
                        ref={inputRef}
                        className="jts-country-lookup__popup-anchor"
                        appearance="filled-darker"
                        open
                        readOnly
                        aria-label={strings.searchCountries}
                        value={selectedOption.name}
                        selectedOptions={[selectedOption.code]}
                        positioning={{ position: "below", autoSize: false }}
                        listbox={{
                            className: "jts-country-lookup__listbox",
                            style: { maxHeight: 244 },
                        }}
                        onOpenChange={(_event, data) => setOpen(data.open)}
                        onOptionSelect={(_event, data) => selectCountry(data.optionValue)}
                    >
                        {countryOptions}
                    </Combobox>
                )}
                <div
                    className="jts-country-lookup__chip-row"
                    aria-disabled={disabled}
                    data-open={open}
                >
                    <span className="jts-country-lookup__chip-pill">
                        <Earth16Regular className="jts-country-lookup__chip-icon" />
                        <span className="jts-country-lookup__chip-text">{selectedOption!.name}</span>
                        {!disabled && (
                            <Button
                                className="jts-country-lookup__chip-clear"
                                appearance="subtle"
                                size="small"
                                icon={<Dismiss16Regular />}
                                title={strings.clear}
                                aria-label={strings.clear}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    clearLookup();
                                }}
                            />
                        )}
                    </span>
                    <Button
                        className="jts-country-lookup__chip-search"
                        appearance="subtle"
                        size="small"
                        icon={<Search16Regular />}
                        title={strings.searchCountries}
                        aria-label={strings.searchCountries}
                        aria-expanded={open}
                        disabled={disabled}
                        onClick={openLookup}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="jts-country-lookup">
            {/* appearance="filled-darker" is the Fluent variant that actually sets a background
                (colorNeutralBackground3), matching the flat gray fill this form's native fields
                use at rest - "filled-lighter" has no background-color rule of its own. */}
            <Combobox
                ref={inputRef}
                className="jts-country-lookup__combobox"
                appearance="filled-darker"
                aria-label={strings.searchCountries}
                placeholder={open ? strings.searchPlaceholder : strings.emptyPlaceholder}
                open={open}
                /* Fixed below-anchored placement (no auto-flip to "above") plus a capped,
                   scrollable listbox height on the public listbox slot - without this, the
                   popup's ideal position/height is recalculated on every keystroke as the
                   filtered result count shrinks/grows, which reads as the dropdown "jumping
                   around the screen". A native Lookup's dropdown stays a fixed size with an
                   internal scrollbar instead - see the reference screenshot from Parent Account. */
                positioning={{ position: "below", autoSize: false }}
                listbox={{
                    className: "jts-country-lookup__listbox",
                    style: { maxHeight: 244 },
                }}
                expandIcon={<Search16Regular />}
                value={open ? query : value ?? ""}
                disabled={disabled}
                selectedOptions={[]}
                onOpenChange={(_event, data) => {
                    setOpen(data.open);
                    if (data.open) setQuery("");
                }}
                onInput={(event) => {
                    setQuery((event.target as HTMLInputElement).value);
                    if (!open) setOpen(true);
                }}
                onOptionSelect={(_event, data) => selectCountry(data.optionValue)}
            >
                {countryOptions}
            </Combobox>
        </div>
    );
}

interface IErrorBoundaryState {
    error: Error | null;
}

// Surfaces render-time crashes directly on the form (as text) instead of leaving a blank area -
// a plain try/catch around React.createElement can't catch these, since component functions only
// run later during React's reconciliation, not at element-construction time.
class CountryLookupErrorBoundary extends React.Component<IJTSCountryLookupProps, IErrorBoundaryState> {
    constructor(props: IJTSCountryLookupProps) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): IErrorBoundaryState {
        return { error };
    }

    componentDidUpdate(prevProps: IJTSCountryLookupProps): void {
        if (this.state.error && prevProps.value !== this.props.value) {
            this.setState({ error: null });
        }
    }

    render(): React.ReactElement {
        if (this.state.error) {
            return (
                <MessageBar intent="error">
                    <MessageBarBody>
                        {this.props.strings.errorPrefix}: {this.state.error.message}
                    </MessageBarBody>
                </MessageBar>
            );
        }
        return <CountryLookupInner {...this.props} />;
    }
}

export const JTSCountryLookupEditor = CountryLookupErrorBoundary;
