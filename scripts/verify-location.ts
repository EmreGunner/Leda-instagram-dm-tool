
import { LocationDetector } from '../src/lib/server/location-detector';

async function test() {
    const detector = LocationDetector.getInstance();

    const cases = [
        {
            text: "Bodrum Yalıkavak'ta satılık lüks villa... bahçe katı...",
            expectedCity: "Muğla", // Bodrum is a Town in Muğla
            expectedTown: "Bodrum",
            shouldNotMatch: "Bahçe"
        },
        {
            text: "Satılık daire Istanbul Beşiktaş",
            expectedCity: "Istanbul",
            expectedTown: "Besiktas"
        },
        {
            text: "Harika bir bahçe katı, deniz manzaralı.", // Should NOT match "Bahçe" as town (Osmaniye)
            expectedCity: undefined,
            expectedTown: undefined
        }
    ];

    console.log("Running Location Detector Tests...\n");
    let passed = 0;

    for (const c of cases) {
        const result = detector.detectLocation(c.text);
        console.log(`Text: "${c.text.substring(0, 50)}..."`);
        console.log(`Detected: City=${result?.city}, Town=${result?.town}`);

        const cityMatch = result?.city === c.expectedCity;
        // Town matching might be tricky if it returns "Yalikavak" vs "Yalıkavak", let's be loose or specific if needed.
        // The detector capitalizes output.

        let townMatch = true;
        if (c.expectedTown) {
            townMatch = result?.town === c.expectedTown;
        }

        const notMatchCheck = c.shouldNotMatch ? (result?.town !== c.shouldNotMatch && result?.city !== c.shouldNotMatch) : true;

        if (cityMatch && townMatch && notMatchCheck) {
            console.log("✅ PASS");
            passed++;
        } else {
            console.log("❌ FAIL");
            console.log(`   Expected City: ${c.expectedCity}, Got: ${result?.city}`);
            console.log(`   Expected Town: ${c.expectedTown}, Got: ${result?.town}`);
            if (c.shouldNotMatch) console.log(`   Should NOT match: ${c.shouldNotMatch}`);
        }
        console.log("---");
    }

    console.log(`\nResult: ${passed}/${cases.length} passed.`);
}

test();
