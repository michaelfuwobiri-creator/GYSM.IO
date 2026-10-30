// Sample catalogue. Titles, loglines and cast are invented placeholders; the
// streams are public test videos. Replace both with your licensed content
// (or load them from your CMS) before you publish.

const STREAMS = {
  hls1: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  hls2: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  mp4a: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  mp4b: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  mp4c: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  mp4d: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
};

// Each poster is drawn in CSS from `hue` (base colour) and `motif` (pattern).
export const TITLES = [
  { id: "eko-after-dark", title: "Eko After Dark", kind: "series", seasons: 2, year: 2026, rating: "16+", runtime: "8 episodes", genres: ["Thriller", "Crime"], hue: 268, motif: "grid", premium: true, match: 98,
    logline: "A Lagos night-bus driver finds a briefcase of dollars on the last run from Obalende, and every passenger on board wants it back.",
    cast: ["Adaeze Okafor", "Tunde Bakare", "Ifeoma Nnaji"], stream: STREAMS.hls1 },
  { id: "the-palm-wine-heir", title: "The Palm Wine Heir", kind: "movie", year: 2026, rating: "13+", runtime: "1h 52m", genres: ["Drama", "Family"], hue: 32, motif: "adire", premium: false, match: 95,
    logline: "When a village patriarch dies without a will, his London-raised grandson has thirty days to keep the family tapping business alive.",
    cast: ["Chidi Eze", "Ngozi Alabi", "Emeka Obi"], stream: STREAMS.mp4a },
  { id: "aso-ebi", title: "Aso Ebi", kind: "movie", year: 2025, rating: "PG", runtime: "1h 41m", genres: ["Romance", "Comedy"], hue: 330, motif: "waves", premium: false, match: 93,
    logline: "Two rival tailors are hired to dress the same wedding. Only one outfit can make it down the aisle.",
    cast: ["Funke Adeyemi", "Kelechi Uba"], stream: STREAMS.mp4b },
  { id: "kingdom-of-oyo", title: "Kingdom of Ọ̀yọ́", kind: "series", seasons: 1, year: 2026, rating: "16+", runtime: "10 episodes", genres: ["Epic", "History"], hue: 12, motif: "sun", premium: true, match: 97,
    logline: "Crowns, cavalry and betrayal in the court of an empire at the height of its power.",
    cast: ["Babatunde Ojo", "Amaka Udeh", "Segun Arinze"], stream: STREAMS.mp4c },
  { id: "third-mainland", title: "Third Mainland", kind: "movie", year: 2025, rating: "16+", runtime: "1h 58m", genres: ["Action", "Thriller"], hue: 200, motif: "lines", premium: true, match: 91,
    logline: "A traffic cop has one rush hour to stop an armoured convoy before it crosses the longest bridge in Africa.",
    cast: ["Ikenna Ude", "Bisi Coker"], stream: STREAMS.mp4d },
  { id: "mama-put", title: "Mama Put", kind: "series", seasons: 3, year: 2024, rating: "PG", runtime: "24 episodes", genres: ["Comedy", "Family"], hue: 48, motif: "dots", premium: false, match: 89,
    logline: "The busiest roadside kitchen in Surulere, its owner, her five cooks and the customers who never pay on time.",
    cast: ["Yetunde Bello", "Obinna Okeke"], stream: STREAMS.hls2 },
  { id: "spirit-of-the-creek", title: "Spirit of the Creek", kind: "movie", year: 2026, rating: "18+", runtime: "1h 47m", genres: ["Horror", "Mystery"], hue: 160, motif: "waves", premium: true, match: 88,
    logline: "An oil surveyor ignores a fisherman's warning and spends one night too many in the Delta.",
    cast: ["Tari Douglas", "Ebiere Pere"], stream: STREAMS.mp4c },
  { id: "abuja-confidential", title: "Abuja Confidential", kind: "series", seasons: 1, year: 2026, rating: "16+", runtime: "6 episodes", genres: ["Political", "Drama"], hue: 145, motif: "grid", premium: true, match: 94,
    logline: "A junior aide leaks one memo and brings the capital to a standstill.",
    cast: ["Halima Sani", "David Akpan"], stream: STREAMS.hls1 },
  { id: "owambe", title: "Owambe!", kind: "movie", year: 2024, rating: "PG", runtime: "1h 35m", genres: ["Comedy", "Music"], hue: 300, motif: "dots", premium: false, match: 90,
    logline: "A failing DJ crew talks its way into playing the party of the decade. They have never played a wedding.",
    cast: ["Seun Lawal", "Chioma Ike"], stream: STREAMS.mp4a },
  { id: "the-cartographer-of-kano", title: "The Cartographer of Kano", kind: "movie", year: 2025, rating: "13+", runtime: "2h 04m", genres: ["Adventure", "History"], hue: 24, motif: "lines", premium: true, match: 87,
    logline: "A mapmaker crosses the Sahel to deliver a map that two kingdoms would kill to own.",
    cast: ["Musa Danjuma", "Zainab Garba"], stream: STREAMS.mp4b },
  { id: "danfo", title: "Danfo", kind: "series", seasons: 2, year: 2025, rating: "13+", runtime: "16 episodes", genres: ["Comedy", "Drama"], hue: 54, motif: "lines", premium: false, match: 92,
    logline: "One yellow bus, one conductor with big dreams, and every story that climbs aboard.",
    cast: ["Femi Adebayo", "Rita Nwosu"], stream: STREAMS.hls2 },
  { id: "nkiru", title: "Nkiru", kind: "movie", year: 2026, rating: "13+", runtime: "1h 49m", genres: ["Drama", "Romance"], hue: 350, motif: "adire", premium: false, match: 96,
    logline: "A gifted Enugu violinist must choose between a scholarship in Vienna and the man who taught her to play.",
    cast: ["Nkiru Obi", "Uche Madu"], stream: STREAMS.mp4d },
  { id: "black-gold", title: "Black Gold", kind: "series", seasons: 1, year: 2026, rating: "18+", runtime: "8 episodes", genres: ["Crime", "Drama"], hue: 220, motif: "sun", premium: true, match: 93,
    logline: "Three siblings inherit a pipeline-bunkering empire and the war that comes with it.",
    cast: ["Ebuka Ogbu", "Tamara West", "Kunle Ade"], stream: STREAMS.hls1 },
  { id: "jollof-wars", title: "Jollof Wars", kind: "movie", year: 2023, rating: "PG", runtime: "1h 30m", genres: ["Comedy", "Family"], hue: 8, motif: "dots", premium: false, match: 86,
    logline: "A Lagos chef and an Accra chef face off in a televised cook-off with national pride on the plate.",
    cast: ["Kemi Ade", "Kwesi Mensah"], stream: STREAMS.mp4a },
  { id: "iyawo", title: "Ìyàwó", kind: "movie", year: 2025, rating: "13+", runtime: "1h 44m", genres: ["Drama"], hue: 280, motif: "adire", premium: true, match: 90,
    logline: "On the eve of her wedding, a bride receives a letter from the groom's first wife.",
    cast: ["Toyin Ajayi", "Gbenga Ola"], stream: STREAMS.mp4b },
  { id: "the-last-masquerade", title: "The Last Masquerade", kind: "movie", year: 2026, rating: "16+", runtime: "1h 55m", genres: ["Mystery", "Thriller"], hue: 110, motif: "sun", premium: true, match: 92,
    logline: "During a festival no outsider may watch, a masked dancer vanishes, and a detective from the city is sent to find him.",
    cast: ["Obi Nwankwo", "Ada Eze"], stream: STREAMS.mp4c },
];

export const byId = (id) => TITLES.find((t) => t.id === id);
const pick = (...ids) => ids.map(byId);
const genre = (g) => TITLES.filter((t) => t.genres.includes(g));

export const FEATURED = pick("eko-after-dark", "kingdom-of-oyo", "nkiru", "black-gold");

export const ROWS = [
  { id: "trending", title: "Trending in Nigeria", items: pick("eko-after-dark", "the-palm-wine-heir", "aso-ebi", "kingdom-of-oyo", "third-mainland", "nkiru", "danfo", "owambe") },
  { id: "top10", title: "Top 10 this week", top10: true, items: pick("kingdom-of-oyo", "eko-after-dark", "nkiru", "abuja-confidential", "mama-put", "black-gold", "aso-ebi", "the-last-masquerade", "danfo", "jollof-wars") },
  { id: "pass", title: "Only with Nollywood Pass", premium: true, items: TITLES.filter((t) => t.premium) },
  { id: "comedy", title: "Laugh out loud", items: genre("Comedy") },
  { id: "drama", title: "Big family drama", items: genre("Drama") },
  { id: "thrill", title: "Edge-of-your-seat thrillers", items: [...genre("Thriller"), ...genre("Horror"), ...genre("Crime")].filter((t, i, a) => a.indexOf(t) === i) },
  { id: "epic", title: "Epics & history", items: [...genre("Epic"), ...genre("History"), ...genre("Adventure")].filter((t, i, a) => a.indexOf(t) === i) },
];
