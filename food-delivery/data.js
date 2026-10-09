// Static demo data for ChopChop. Menu prices are stored in USD and converted
// to the selected city's currency at render time (rates are approximate).

const CITIES = [
  { id: "freetown", name: "Freetown", country: "Sierra Leone", flag: "🇸🇱", currency: "SLE", rate: 22.5, step: 1 },
  { id: "lagos", name: "Lagos", country: "Nigeria", flag: "🇳🇬", currency: "NGN", rate: 1550, step: 50 },
  { id: "accra", name: "Accra", country: "Ghana", flag: "🇬🇭", currency: "GHS", rate: 12, step: 0.5 },
  { id: "nairobi", name: "Nairobi", country: "Kenya", flag: "🇰🇪", currency: "KES", rate: 129, step: 5 },
  { id: "dakar", name: "Dakar", country: "Senegal", flag: "🇸🇳", currency: "XOF", rate: 600, step: 25 },
  { id: "addis", name: "Addis Ababa", country: "Ethiopia", flag: "🇪🇹", currency: "ETB", rate: 140, step: 5 },
  { id: "kigali", name: "Kigali", country: "Rwanda", flag: "🇷🇼", currency: "RWF", rate: 1400, step: 50 },
  { id: "joburg", name: "Johannesburg", country: "South Africa", flag: "🇿🇦", currency: "ZAR", rate: 18, step: 1 },
];

// Mobile money options offered per country, plus card and cash everywhere.
const PAYMENT_METHODS = {
  freetown: ["Orange Money", "Africell Money"],
  lagos: ["OPay", "MTN MoMo PSB", "Bank transfer"],
  accra: ["MTN MoMo", "Telecel Cash", "AirtelTigo Money"],
  nairobi: ["M-Pesa", "Airtel Money"],
  dakar: ["Wave", "Orange Money"],
  addis: ["telebirr", "M-Pesa Ethiopia"],
  kigali: ["MTN MoMo", "Airtel Money"],
  joburg: ["SnapScan", "Instant EFT"],
};

const CATEGORIES = [
  { id: "rice", label: "Rice dishes", emoji: "🍚" },
  { id: "grill", label: "Grills & suya", emoji: "🍢" },
  { id: "stew", label: "Soups & stews", emoji: "🍲" },
  { id: "street", label: "Street food", emoji: "🌯" },
  { id: "veg", label: "Plant-based", emoji: "🥬" },
  { id: "drinks", label: "Drinks", emoji: "🥤" },
];

// `hue` drives the generated cover art so no image assets are needed.
const RESTAURANTS = [
  // Freetown
  { id: "mama-salone", city: "freetown", name: "Mama Salone Kitchen", tagline: "Cassava leaf, potato leaf & groundnut soup", cats: ["stew", "rice"], rating: 4.8, reviews: 1240, eta: [25, 35], fee: 0.9, hue: 22, emoji: "🍲", featured: true,
    menu: [
      { id: "cl", name: "Cassava Leaf & Rice", desc: "Pounded cassava leaves slow-cooked in palm oil with smoked fish and beef.", price: 4.5, cat: "stew", popular: true },
      { id: "pl", name: "Potato Leaf Stew", desc: "Sweet potato greens, fish and palm oil over white rice.", price: 4.2, cat: "stew" },
      { id: "gs", name: "Groundnut Soup", desc: "Creamy peanut soup with chicken, served with rice.", price: 4.8, cat: "stew" },
      { id: "gj", name: "Ginger Beer (500ml)", desc: "Fiery, home-brewed and ice cold.", price: 1.2, cat: "drinks" },
    ] },
  { id: "lumley-grill", city: "freetown", name: "Lumley Beach Grill", tagline: "Fresh catch grilled by the Atlantic", cats: ["grill", "street"], rating: 4.6, reviews: 860, eta: [30, 45], fee: 1.1, hue: 195, emoji: "🐟",
    menu: [
      { id: "gb", name: "Grilled Barracuda", desc: "Whole fish, pepper-lime marinade, fried plantain.", price: 8.5, cat: "grill", popular: true },
      { id: "fp", name: "Fry Fry Plantain", desc: "Ripe plantain fried golden, with pepper sauce.", price: 2.0, cat: "street" },
      { id: "ak", name: "Akara (6 pcs)", desc: "Crispy black-eyed bean fritters.", price: 1.6, cat: "street" },
      { id: "bs", name: "Baobab Smoothie", desc: "Tangy baobab, banana and milk.", price: 2.2, cat: "drinks" },
    ] },

  // Lagos
  { id: "jollof-hq", city: "lagos", name: "Jollof HQ", tagline: "Smoky party jollof, the way it should be", cats: ["rice"], rating: 4.9, reviews: 5320, eta: [20, 30], fee: 0.8, hue: 8, emoji: "🍛", featured: true,
    menu: [
      { id: "pj", name: "Smoky Party Jollof", desc: "Firewood-smoked jollof with fried plantain and coleslaw.", price: 5.0, cat: "rice", popular: true },
      { id: "fr", name: "Nigerian Fried Rice", desc: "Liver, shrimp, mixed veg and curry-thyme rice.", price: 5.2, cat: "rice" },
      { id: "tc", name: "Peppered Turkey", desc: "Fried then tossed in ata dindin pepper sauce.", price: 4.0, cat: "grill" },
      { id: "zb", name: "Zobo (50cl)", desc: "Chilled hibiscus with ginger and pineapple.", price: 1.0, cat: "drinks" },
    ] },
  { id: "suya-spot", city: "lagos", name: "Mallam's Suya Spot", tagline: "Yaji-spiced skewers off the open flame", cats: ["grill", "street"], rating: 4.7, reviews: 2210, eta: [25, 40], fee: 1.0, hue: 30, emoji: "🍢",
    menu: [
      { id: "bs", name: "Beef Suya (wrap)", desc: "Thin-sliced beef, yaji, onions and tomato.", price: 3.5, cat: "grill", popular: true },
      { id: "kk", name: "Kilishi", desc: "Sun-dried spiced beef jerky, 100g.", price: 4.0, cat: "grill" },
      { id: "ck", name: "Chicken Suya", desc: "Charred thigh skewers, extra yaji on the side.", price: 3.8, cat: "grill" },
      { id: "ch", name: "Chapman", desc: "Nigeria's favourite fruity cocktail, non-alcoholic.", price: 1.5, cat: "drinks" },
    ] },

  // Accra
  { id: "waakye-queen", city: "accra", name: "Waakye Queen", tagline: "Accra's morning favourite, all day", cats: ["rice", "street"], rating: 4.8, reviews: 1980, eta: [20, 30], fee: 0.7, hue: 340, emoji: "🍱", featured: true,
    menu: [
      { id: "wk", name: "Waakye Full Combo", desc: "Rice & beans, gari, spaghetti, egg, wele and shito.", price: 3.8, cat: "rice", popular: true },
      { id: "kk", name: "Kelewele", desc: "Spicy ginger-fried plantain cubes with peanuts.", price: 1.8, cat: "street" },
      { id: "rr", name: "Red Red", desc: "Black-eyed bean stew in palm oil with fried plantain.", price: 3.0, cat: "veg" },
      { id: "sb", name: "Sobolo", desc: "Ghanaian hibiscus drink, lightly spiced.", price: 0.9, cat: "drinks" },
    ] },
  { id: "osu-chop-bar", city: "accra", name: "Osu Chop Bar", tagline: "Fufu pounded fresh, soups that hug", cats: ["stew"], rating: 4.6, reviews: 740, eta: [30, 45], fee: 0.9, hue: 140, emoji: "🥣",
    menu: [
      { id: "fl", name: "Fufu & Light Soup", desc: "Goat light soup with freshly pounded fufu.", price: 5.5, cat: "stew", popular: true },
      { id: "bn", name: "Banku & Okro Stew", desc: "Fermented corn dough with seafood okro.", price: 5.0, cat: "stew" },
      { id: "kt", name: "Kontomire Stew", desc: "Cocoyam leaves, egusi and boiled yam.", price: 4.0, cat: "veg" },
    ] },

  // Nairobi
  { id: "nyama-mama", city: "nairobi", name: "Nyama Choma Republic", tagline: "Roast goat, kachumbari & cold drinks", cats: ["grill"], rating: 4.7, reviews: 3100, eta: [30, 45], fee: 1.0, hue: 12, emoji: "🍖", featured: true,
    menu: [
      { id: "ng", name: "Nyama Choma (½kg goat)", desc: "Slow-roasted goat with kachumbari and ugali.", price: 7.5, cat: "grill", popular: true },
      { id: "mk", name: "Mutura", desc: "Kenyan grilled sausage, chilli on the side.", price: 2.5, cat: "street" },
      { id: "ug", name: "Ugali & Sukuma Wiki", desc: "Maize meal with garlicky sautéed collards.", price: 2.8, cat: "veg" },
      { id: "dw", name: "Dawa", desc: "Lime, honey and ginger — 'medicine'.", price: 1.8, cat: "drinks" },
    ] },
  { id: "swahili-pot", city: "nairobi", name: "Swahili Pot", tagline: "Coastal flavours from Mombasa", cats: ["rice", "street"], rating: 4.8, reviews: 1450, eta: [25, 35], fee: 0.8, hue: 45, emoji: "🥘",
    menu: [
      { id: "pl", name: "Beef Pilau", desc: "Fragrant spiced rice cooked with tender beef.", price: 4.0, cat: "rice", popular: true },
      { id: "bk", name: "Biryani ya Kuku", desc: "Mombasa-style chicken biryani.", price: 4.8, cat: "rice" },
      { id: "sm", name: "Samosa (3 pcs)", desc: "Minced beef, crisp pastry, tamarind dip.", price: 1.5, cat: "street" },
      { id: "mh", name: "Mahamri & Chai", desc: "Cardamom coconut doughnuts with spiced tea.", price: 1.6, cat: "street" },
    ] },

  // Dakar
  { id: "chez-fatou", city: "dakar", name: "Chez Fatou", tagline: "Thiéboudienne, yassa & mafé", cats: ["rice", "stew"], rating: 4.9, reviews: 1670, eta: [25, 40], fee: 0.9, hue: 28, emoji: "🐠", featured: true,
    menu: [
      { id: "tb", name: "Thiéboudienne", desc: "Senegal's national dish: broken rice, fish and vegetables.", price: 5.5, cat: "rice", popular: true },
      { id: "yp", name: "Yassa Poulet", desc: "Chicken braised with caramelised onions and lemon.", price: 5.0, cat: "rice" },
      { id: "mf", name: "Mafé", desc: "Rich peanut stew with lamb.", price: 5.2, cat: "stew" },
      { id: "bj", name: "Bissap", desc: "Hibiscus with mint and vanilla.", price: 1.0, cat: "drinks" },
    ] },

  // Addis Ababa
  { id: "habesha-table", city: "addis", name: "Habesha Table", tagline: "Injera platters made for sharing", cats: ["stew", "veg"], rating: 4.8, reviews: 2050, eta: [25, 35], fee: 0.7, hue: 18, emoji: "🫓", featured: true,
    menu: [
      { id: "bt", name: "Beyaynetu (fasting platter)", desc: "Shiro, misir, gomen and atakilt on fresh injera.", price: 4.5, cat: "veg", popular: true },
      { id: "dw", name: "Doro Wat", desc: "Berbere chicken stew with boiled egg.", price: 6.0, cat: "stew" },
      { id: "tb", name: "Tibs", desc: "Sizzling sautéed beef with rosemary and awaze.", price: 5.5, cat: "grill" },
      { id: "bn", name: "Buna (coffee)", desc: "Traditional jebena coffee.", price: 0.8, cat: "drinks" },
    ] },

  // Kigali
  { id: "kigali-brochettes", city: "kigali", name: "Hills Brochettes", tagline: "Goat brochettes & isombe", cats: ["grill", "veg"], rating: 4.7, reviews: 920, eta: [20, 35], fee: 0.8, hue: 160, emoji: "🍡", featured: true,
    menu: [
      { id: "bg", name: "Goat Brochettes (3)", desc: "Skewers with roasted potatoes and pili-pili.", price: 4.2, cat: "grill", popular: true },
      { id: "is", name: "Isombe", desc: "Cassava leaves with eggplant and peanut paste.", price: 3.2, cat: "veg" },
      { id: "ib", name: "Ibihaza & Beans", desc: "Pumpkin and beans in a tomato broth.", price: 2.8, cat: "veg" },
      { id: "ik", name: "Ikivuguto", desc: "Cultured milk, chilled.", price: 1.0, cat: "drinks" },
    ] },

  // Johannesburg
  { id: "kota-king", city: "joburg", name: "Kota King", tagline: "Kotas, bunny chow & shisa nyama", cats: ["street", "grill"], rating: 4.6, reviews: 2780, eta: [20, 30], fee: 1.0, hue: 48, emoji: "🥪", featured: true,
    menu: [
      { id: "kt", name: "Full House Kota", desc: "Quarter loaf, chips, polony, russian, cheese & atchar.", price: 3.5, cat: "street", popular: true },
      { id: "bc", name: "Mutton Bunny Chow", desc: "Durban curry in a hollowed half loaf.", price: 5.0, cat: "street" },
      { id: "sn", name: "Shisa Nyama Platter", desc: "Boerewors, chops, pap and chakalaka.", price: 7.0, cat: "grill" },
      { id: "mg", name: "Mageu", desc: "Fermented maize drink.", price: 1.0, cat: "drinks" },
    ] },
];

const RIDERS = ["Kofi", "Amara", "Juma", "Fatmata", "Chidi", "Awa", "Tesfaye", "Thandi", "Mohamed"];
