
import fs from 'fs';
import path from 'path';

interface LocationMatch {
    city: string;
    town?: string;
}

interface LocationData {
    cities: string[];
    towns: Record<string, string | string[]>;
}

export class LocationDetector {
    private static instance: LocationDetector;
    private locationMap: Map<string, { type: 'CITY' | 'TOWN', parentCity?: string | string[] }> = new Map();
    private regex: RegExp | null = null;
    private isInitialized = false;

    // Property Keywords Map
    private propertyKeywords: Record<string, string[]> = {
        'Villa': ['villa', 'müstakil', 'yalı', 'köşk', 'konak'],
        'Daire': ['daire', 'apartman', 'rezidans', 'residence', 'loft', 'studio', 'stüdyo', '1+1', '2+1', '3+1', '4+1', '5+1'],
        'Arsa': ['arsa', 'tarla', 'arazi', 'parsel', 'imarlı'],
        'Ofis': ['ofis', 'büro', 'plaza', 'iş yeri', 'is yeri', 'dükkan', 'magaza', 'mağaza'],
        'Proje': ['proje', 'lansman', 'topraktan', 'inşaat'],
    };

    private constructor() { }

    public static getInstance(): LocationDetector {
        if (!LocationDetector.instance) {
            LocationDetector.instance = new LocationDetector();
        }
        return LocationDetector.instance;
    }

    private init() {
        if (this.isInitialized) return;

        try {
            const filePath = path.join(process.cwd(), 'turkish_locations_lookup.json');
            const rawData = fs.readFileSync(filePath, 'utf-8');
            const data: LocationData = JSON.parse(rawData);

            // Build Search Map
            // 1. Add Cities
            data.cities.forEach(city => {
                this.locationMap.set(this.normalize(city), { type: 'CITY' });
            });

            // 2. Add Towns
            Object.entries(data.towns).forEach(([town, parentCity]) => {
                this.locationMap.set(this.normalize(town), { type: 'TOWN', parentCity });
            });

            // Compile Master Regex
            // Sort keys by length descending to match longest first (e.g. "Afyonkarahisar" before "Afyon")
            const sortedKeys = Array.from(this.locationMap.keys()).sort((a, b) => b.length - a.length);

            // Escape regex special characters in keys
            const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

            // Create pattern: using word boundaries or start/end of string
            // Note: \b doesn't work well with Turkish chars, so we use a more robust pattern
            // Matches: (start OR whitespace) + KEY + (end OR whitespace OR punctuation)
            this.regex = new RegExp(`(^|[\\s.,!?;:()"]+)(${escapedKeys.join('|')})(?=$|[\\s.,!?;:()"]+)`, 'gi');

            this.isInitialized = true;
            console.log(`[LocationDetector] Initialized with ${sortedKeys.length} locations`);
        } catch (e) {
            console.error('[LocationDetector] Failed to initialize:', e);
        }
    }

    private normalize(text: string): string {
        return text.toLocaleLowerCase('tr-TR');
    }

    public detectLocation(text: string | null | undefined): LocationMatch | null {
        if (!text) return null;
        this.init();
        if (!this.regex) return null;

        const normalizedText = this.normalize(text);
        const matches = Array.from(normalizedText.matchAll(this.regex));

        if (matches.length === 0) return null;

        // Process matches to find the most specific location
        let bestCity: string | null = null;
        let bestTown: string | null = null;

        for (const match of matches) {
            const matchedText = match[2]; // Group 2 is the key
            const meta = this.locationMap.get(matchedText);

            if (!meta) continue;

            const normalizedMatched = this.normalize(matchedText);

            // BLACKLIST: Ignore common words that act as false positives
            if (['bahçe', 'bahce'].includes(normalizedMatched)) {
                continue;
            }

            if (meta.type === 'TOWN') {
                bestTown = this.capitalize(matchedText);
                // Handle ambiguous towns (owned by multiple cities)
                if (Array.isArray(meta.parentCity)) {
                    // Check if any of the parent cities are also mentioned
                    const foundParent = meta.parentCity.find(pc => normalizedText.includes(this.normalize(pc)));
                    bestCity = foundParent || meta.parentCity[0]; // Default to first matches
                } else {
                    bestCity = meta.parentCity as string;
                }
                // Stop on first specific town match
                break;
            } else if (meta.type === 'CITY') {
                // If we found a city and no town yet, keep it, but continue searching for a more specific town
                // UNLESS we want "First Match wins" policy.
                // Given the requirement "Bodrum ... Bahçe", first match "Bodrum" is correct.
                if (!bestCity) {
                    bestCity = this.capitalize(matchedText);
                    // Do not break here. If we find "Istanbul" then "Besiktas", we want Besiktas.
                }
            }
        }

        if (bestCity) {
            return { city: bestCity, town: bestTown || undefined };
        }

        return null;
    }

    public detectPropertyType(text: string): string | null {
        const normalized = this.normalize(text);

        // High level categories (User defined)
        const types: Record<string, string[]> = {
            'Konut': ['daire', 'villa', 'konut', 'ev', 'rezidans', 'residence', 'yalı', 'köşk', '1+1', '2+1', '3+1', '4+1', '5+1', 'stüdyo', 'studio', 'loft'],
            'İş Yeri': ['ofis', 'büro', 'plaza', 'iş yeri', 'is yeri', 'dükkan', 'magaza', 'mağaza', 'depo', 'fabrika'],
            'Arsa': ['arsa', 'tarla', 'arazi', 'parsel', 'imarlı'],
            'Bina': ['bina', 'apartman', 'komple'],
            'Turistik Tesis': ['otel', 'motel', 'pansiyon', 'tatil köyü'],
        };

        for (const [type, keywords] of Object.entries(types)) {
            if (keywords.some(k => normalized.includes(k))) return type;
        }

        // Implicit fallback
        if (normalized.includes('satılık') || normalized.includes('kiralık')) return 'Konut';

        return null;
    }

    public detectPropertySubType(text: string): string | null {
        const normalized = this.normalize(text);

        // Detailed Sub-types (User defined priority)
        const subTypes: Record<string, string[]> = {
            'Villa': ['villa', 'müstakil', 'yalı', 'köşk', 'konak'],
            'Daire': ['daire', 'apartman', '1+1', '2+1', '3+1', '4+1', '5+1'],
            'Rezidans': ['rezidans', 'residence', 'loft', 'studio', 'stüdyo'],
            'Arsa': ['arsa', 'tarla', 'arazi', 'parsel', 'imarlı'],
            'Ofis': ['ofis', 'büro', 'plaza', 'iş yeri', 'is yeri'],
            'Dükkan': ['dükkan', 'magaza', 'mağaza'],
            'Proje': ['proje', 'lansman', 'topraktan', 'inşaat'],
            'Yazlık': ['yazlık'],
        };

        for (const [subType, keywords] of Object.entries(subTypes)) {
            if (keywords.some(k => normalized.includes(k))) return subType;
        }

        return null;
    }

    public detectListingType(text: string): 'Sale' | 'Rent' {
        const normalized = this.normalize(text);
        const rentKeywords = ['kiralık', 'kiralik', 'kirali', 'kira'];

        if (rentKeywords.some(k => normalized.includes(k))) {
            return 'Rent';
        }

        // Default to Sale as per user request
        return 'Sale';
    }

    private capitalize(s: string): string {
        return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1).toLocaleLowerCase('tr-TR');
    }
}
