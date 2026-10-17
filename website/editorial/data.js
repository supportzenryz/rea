// Site content. Studio details, clients, crews and contacts are placeholders:
// replace them with the studio's own. Photographs are from Pexels (free to use
// under the Pexels license) and should be swapped for the studio's own work.

window.STUDIO = {
  name: "Maison Vérane",
  city: "Paris",
  email: "bonjour@example.com",
  phone: "+33 1 00 00 00 00",
  address: ["12 rue de l'Exemple", "75011 Paris, France"],
  instagram: "@maisonverane",
  agents: [
    { city: { fr: "Paris", en: "Paris" }, name: "Claire Dumont", email: "paris@example.com", phone: "+33 6 00 00 00 00" },
    { city: { fr: "Londres", en: "London" }, name: "James Hale", email: "london@example.com", phone: "+44 20 0000 0000" },
    { city: { fr: "New York", en: "New York" }, name: "Nina Brooks", email: "newyork@example.com", phone: "+1 212 000 0000" },
  ],
  clients: ["Revue Opaline", "Maison Ardent", "Joaillerie Solène", "Nocturne", "Atelier Sable", "Littoral", "Éditions Blanche", "Maison Corail"],
};

// r = width / height of each photograph.
const ph = (id, r, alt) => ({ src: `assets/photos/${id}.jpg`, r, alt, credit: `https://www.pexels.com/photo/${id}/` });

window.SERIES = [
  {
    id: "cote-rouge",
    title: "Côte rouge",
    cat: "editorial",
    client: "Revue Opaline",
    year: 2026,
    place: { fr: "Littoral atlantique", en: "Atlantic coast" },
    text: {
      fr: "Un tailleur écarlate face à l'Atlantique. Pieds nus, roche noire, ciel blanc.",
      en: "A scarlet suit facing the Atlantic. Bare feet, black rock, white sky.",
    },
    crew: { styling: "Inès Laurent", hair: "Paul Mercier", makeup: "Sofia Renard", casting: "Studio Vérane" },
    photos: [
      ph(13991656, 0.638, "Woman in a red suit seated on a stool among rocks on a beach, cliffs behind"),
      ph(13991649, 0.563, "Woman in a red suit on a stool on the sand, waves breaking behind her"),
      ph(13991674, 1.778, "Wide view of a figure in red on a rocky shore under a grey sky"),
    ],
  },
  {
    id: "dunes",
    title: "Dunes",
    cat: "campaign",
    client: "Maison Ardent — AH 26",
    year: 2026,
    place: { fr: "Désert, Espagne", en: "Desert, Spain" },
    text: {
      fr: "Deux silhouettes en trench sur les crêtes. Une campagne écrite par le vent.",
      en: "Two silhouettes in trench coats along the ridges. A campaign written by the wind.",
    },
    crew: { styling: "Margaux Bel", hair: "Yanis Roche", makeup: "Lou Garnier", casting: "Agence Nord" },
    photos: [
      ph(5120186, 0.667, "Two models in long beige trench coats against a clear sky, seen from below"),
      ph(5119416, 0.667, "Model in a trench coat in the foreground, a second model blurred behind"),
      ph(5120187, 1.5, "Two models in trench coats kneeling on a sandy crest"),
      ph(5119521, 0.667, "Two figures in trench coats standing on rounded desert hills"),
    ],
  },
  {
    id: "nuit-rouge",
    title: "Nuit rouge",
    cat: "editorial",
    client: "Nocturne",
    year: 2025,
    place: { fr: "Paris, 9e", en: "Paris, 9th" },
    text: {
      fr: "Robe rouge, pavés mouillés, lumière des réverbères. Paris après minuit.",
      en: "Red dress, wet cobblestones, streetlight glow. Paris after midnight.",
    },
    crew: { styling: "Inès Laurent", hair: "Nora Petit", makeup: "Sofia Renard", casting: "Studio Vérane" },
    photos: [
      ph(38748656, 0.667, "Woman in a red halter dress posing by a lit doorway at night"),
      ph(38748647, 0.667, "Woman in a red dress standing on a city street at night"),
      ph(38748660, 0.667, "Woman in a red dress crouching on a pavement among city lights"),
    ],
  },
  {
    id: "mouvement",
    title: "Mouvement",
    cat: "portrait",
    client: { fr: "Série personnelle", en: "Personal series" },
    year: 2025,
    place: { fr: "Studio, Paris 11e", en: "Studio, Paris 11th" },
    text: {
      fr: "Noir et blanc. Le geste avant la pose, la chemise blanche comme seule matière.",
      en: "Black and white. Gesture before pose, a white shirt as the only material.",
    },
    crew: { styling: "Margaux Bel", hair: "Paul Mercier", makeup: "Lou Garnier", casting: "Studio Vérane" },
    photos: [
      ph(5792043, 0.561, "Black and white portrait of a woman in a white shirt, arms raised, eyes closed"),
      ph(5792038, 0.561, "Black and white image of a woman in motion, hand across her face"),
      ph(31305929, 0.8, "Black and white portrait of a model wearing a white glove, hand raised"),
      ph(35291708, 0.8, "Model kneeling on a white floor, face hidden by a wide black hat"),
    ],
  },
  {
    id: "palais",
    title: "Palais",
    cat: "campaign",
    client: "Joaillerie Solène",
    year: 2025,
    place: { fr: "Hôtel particulier", en: "Private mansion" },
    text: {
      fr: "Satin rouge et façades classiques. Une campagne de joaillerie tout en retenue.",
      en: "Red satin against classical facades. A restrained jewellery campaign.",
    },
    crew: { styling: "Héloïse Vidal", hair: "Nora Petit", makeup: "Sofia Renard", casting: "Agence Nord" },
    photos: [
      ph(14814802, 0.8, "Woman in a long red satin gown before an ornate historic facade"),
      ph(14814797, 0.8, "Close portrait in a red dress and pearls, adjusting round sunglasses"),
      ph(31755145, 0.667, "Model in sheer red holding a golden fan among wooden pillars"),
    ],
  },
  {
    id: "gants",
    title: "Gants",
    cat: "editorial",
    client: "Littoral",
    year: 2024,
    place: { fr: "Côte méditerranéenne", en: "Mediterranean coast" },
    text: {
      fr: "Gants de cuir sur le sable, manteau noir face à la mer grise.",
      en: "Leather gloves on sand, a black coat facing a grey sea.",
    },
    crew: { styling: "Héloïse Vidal", hair: "Yanis Roche", makeup: "Lou Garnier", casting: "Studio Vérane" },
    photos: [
      ph(9213843, 0.667, "Model in a patterned outfit and long black gloves seated on sand"),
      ph(9213841, 0.667, "Model in black gloves lying on the sand, looking at the camera"),
      ph(7539737, 0.667, "Model in a black coat standing with one foot on a chair by the sea"),
    ],
  },
  {
    id: "atelier",
    title: "Atelier",
    cat: "portrait",
    client: { fr: "Portraits", en: "Portraits" },
    year: 2024,
    place: { fr: "Studio, Paris 11e", en: "Studio, Paris 11th" },
    text: {
      fr: "Le studio, ses fonds peints et une seule source de lumière.",
      en: "The studio, its painted backdrops and a single source of light.",
    },
    crew: { styling: "Inès Laurent", hair: "Paul Mercier", makeup: "Nora Petit", casting: "Studio Vérane" },
    photos: [
      ph(37233404, 1.5, "Model in black seated on a block before a red backdrop, studio lights around"),
      ph(7935409, 0.8, "Man in a dark blazer holding a black hat against a dark backdrop"),
      ph(16564570, 0.668, "Model in a beige blazer beside a lamp on a stool before a painted backdrop"),
      ph(33847264, 0.667, "Model in an oversized leather jacket seated on a wooden stool"),
    ],
  },
  {
    id: "rive-droite",
    title: "Rive droite",
    cat: "editorial",
    client: "Éditions Blanche",
    year: 2026,
    place: { fr: "Paris, 1er", en: "Paris, 1st" },
    text: {
      fr: "La rue comme plateau : lamé doré, cuir noir et pierre de taille.",
      en: "The street as a set: gold lamé, black leather and dressed stone.",
    },
    crew: { styling: "Margaux Bel", hair: "Nora Petit", makeup: "Sofia Renard", casting: "Agence Nord" },
    photos: [
      ph(38934854, 0.667, "Model in a gold jacket and pleated skirt on a sunny Paris street"),
      ph(20900565, 0.667, "Portrait in glasses and a black leather jacket on a Paris crosswalk"),
      ph(20900467, 0.667, "Black and white portrait in sunglasses and a dark coat beside a stone column"),
      ph(14142370, 0.667, "Woman in a houndstooth hat and trench coat in a Paris arcade"),
    ],
  },
];
