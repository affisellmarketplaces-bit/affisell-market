import type { LeafPath } from "@/lib/category-browse-shared"

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "pack",
  "set",
  "new",
  "avec",
  "pour",
  "dans",
  "des",
  "les",
  "une",
  "sur",
  "par",
  "est",
  "son",
  "ses",
  "aux",
  "plus",
  "tout",
  "sans",
  "version",
  "modele",
  "model",
  "edition",
  "nouveau",
  "nouvelle",
])

/** Tokens that often create false positives when matched as substrings in breadcrumbs. */
const WEAK_TOKENS = new Set([
  "connect",
  "connec",
  "conne",
  "connected",
  "sommeil",
  "sleep",
  "smart",
  "band",
  "pro",
  "max",
  "mini",
  "lite",
  "plus",
  "noir",
  "black",
  "white",
  "bleu",
  "red",
  "new",
  "voiture",
  "voitures",
  "vehicule",
  "vehicules",
  "auto",
  "car",
  "play",
  "vehicle",
  "vehicles",
  "fil",
  "sans",
])

/** Short tokens must match whole breadcrumb words — avoids "car" inside "carte" / "carplay" noise. */
const SHORT_TOKEN_MAX_LEN = 4

/** When title is a camera product, "voiture" alone must not dominate unrelated leaves. */
const VEHICLE_CONTEXT_WEAK = new Set(["voiture", "voitures", "vehicule", "vehicules", "auto", "car"])

type ProductIntent = {
  id: string
  match: RegExp
  boost: RegExp[]
  penalize: RegExp[]
}

/** Ordered: first matching intent wins. */
const PRODUCT_INTENTS: ProductIntent[] = [
  {
    id: "activity_tracker",
    match:
      /\b(smart\s*bands?|mi\s*bands?|bracelet\s*connect\w*|montre\s*connect\w*|smart\s*watches?|montre\s+intelligente\w*|fitness\s*trackers?|tracker\s*d['']activit\w*|galaxy\s*fit|amazfit|fitbit|oura|whoop|honor\s*bands?|xiaomi\s*(smart\s*)?bands?|podometre\s*connect\w*|activity\s*trackers?)\b/i,
    boost: [
      /moniteurs?\s+d['']activit/i,
      /moniteurs?\s+biometriques?/i,
      /activity\s+monitor/i,
      /accessoires\s+pour\s+moniteurs\s+d['']activit/i,
    ],
    penalize: [
      /connecteur/i,
      /composants?\s+(electroniques|informatiques)/i,
      /plaques?\s+arriere/i,
      /entree.?sortie/i,
      /generateur/i,
      /bruit\s+blanc/i,
      /circuits?\s+imprimes?/i,
      /telephones?\s+mobiles?/i,
      /bijoux\s*>\s*[^>]*montres/i,
      /montres\s+de\s+poche/i,
      /accessoires\s+pour\s+moniteurs\s+d['']activit/i,
    ],
  },
  {
    id: "wrist_watch",
    match:
      /\b(montres?|watches?|wrist\s*watches?|montre\s+(?:homme|femme|luxe|mecanique|automatique|quartz)|montre\s+bracelet|montre\s+de\s+(?:luxe|poche)|chronographe|horlogerie)\b/i,
    boost: [
      /bijoux\s*>\s*montres\b/i,
      /^vetements et accessoires\s*>\s*bijoux\s*>\s*montres$/i,
      /\bmontres\b(?!\s+de\s+poche)/i,
    ],
    penalize: [
      /accessoires\s+pour\s+montres/i,
      /bracelets?\s+de\s+montres/i,
      /kits?\s+de\s+reparation\s+pour\s+montres/i,
      /stickers?\s+et\s+decalcomanies\s+pour\s+montres/i,
      /horloges?\s+(murales|de\s+bureau|de\s+parquet|et\s+pointeuses)/i,
      /pieces?\s+d['']horloges/i,
      /moniteurs?\s+d['']activit/i,
    ],
  },
  {
    id: "electric_scooter",
    match:
      /\b(trottinette\s*electrique|trottinettes?\s*electriques|scooter\s*electrique|e-?scooter|kick\s*scooter|patinette\s*electrique|trottinette\s+tout[- ]terrain)\b/i,
    boost: [
      /trottinettes?/i,
      /loisirs\s+de\s+plein\s+air/i,
      /equipements?\s+sportifs/i,
      /vehicules?\s+electriques?/i,
    ],
    penalize: [
      /stop-?trottoir/i,
      /chevalets?\s+stop/i,
      /signaletique/i,
      /enseignes?\s+publicitaires/i,
      /trotteurs?\s+et\s+tables/i,
      /jouets?\s+pour\s+bebes/i,
      /bebes?\s+et\s+tout-petits/i,
    ],
  },
  {
    id: "smartphone",
    match:
      /\b(iphone|smartphones?|galaxy\s*s\d|pixel\s*\d|oneplus|redmi\s*note|telephones?\s+mobiles?|telephone\s*portable|pro\s+max\s+neufs?|android\s+14)\b/i,
    boost: [
      /telephones?\s+mobiles?/i,
      /smartphones?/i,
      /telephones?\s+portables?/i,
      /telephonie/i,
      /deverrouill/i,
      /sous\s+contrat/i,
    ],
    penalize: [
      /connecteur/i,
      /composant/i,
      /moniteurs?\s+d['']activit/i,
      /brouilleurs?/i,
      /signal/i,
      /cartes?\s+prepayees?/i,
      /cartes?\s+sim/i,
      /forfaits?\s+mobiles?/i,
      /recharge\s+de\s+cartes?/i,
    ],
  },
  {
    id: "gaming_console",
    match:
      /\b(playstation|ps5|ps4|ps3|xbox\s*(?:series|one)?|nintendo\s*switch|switch\s*oled|gamepad|manettes?\s+(?:de\s+)?jeu|playstation\s+portal|portal\s+remote|lecteur\s+(?:a|à)\s+distance\s+(?:pour\s+)?ps|console\s+de\s+jeu|gaming\s+console|dualsense|steam\s*deck|meta\s*quest|oculus)\b/i,
    boost: [
      /accessoires\s+pour\s+consoles?\s+de\s+jeu/i,
      /consoles?\s+de\s+jeu\s+de\s+salon/i,
      /consoles?\s+de\s+jeu\s+portables?/i,
      /accessoires\s+pour\s+manettes?/i,
      /batteries?\s+pour\s+consoles?\s+de\s+jeu/i,
    ],
    penalize: [
      /logiciels\s*>\s*jeux\s+video/i,
      /livres?/i,
      /lecteurs?\s+mp3/i,
      /telephones?\s+mobiles?/i,
      /moniteurs?\s+d['']activit/i,
      /moustiquaire/i,
    ],
  },
  {
    id: "hair_steamer_cap",
    match:
      /\b(bonnet\s+(?:de\s+)?(?:nuit|cheveux|satin)|bonnets?\s+chauffants?|casque\s+(?:a\s+)?vapeur|hair\s+steamer|steam\s+cap|satin\s+cap|cheveux\s+boucles|soin\s+des\s+cheveux)\b/i,
    boost: [/casques?\s+a\s+vapeur/i, /bonnets?\s+chauffants?/i, /soin\s+des\s+cheveux/i],
    penalize: [/decolorants?/i, /colorations?/i, /teintures?/i, /shampooings?/i],
  },
  {
    id: "lip_cosmetics",
    match:
      /\b(gloss(?:\s+a?\s+levres?)?|lip\s*gloss|brillant\s+a?\s+levres?|rouge\s+a?\s+levres?|rouges?\s+a?\s+levres?|crayon\s+a?\s+levres?|baume\s+a?\s+levres?|soin\s+des?\s+levres?|repulpant\s+(?:des?\s+)?levres?|hydratant\s+(?:des?\s+)?levres?|teinte\s+pour\s+levres?)\b/i,
    boost: [
      /maquillage\s+pour\s+les\s+levres/i,
      /brillant\s+a\s+levres/i,
      /rouge\s+a\s+levres/i,
      /crayon\s+a\s+levres/i,
      /apprets?\s+pour\s+les\s+levres/i,
      /soins?\s+des?\s+levres/i,
      /baumes?\s+a\s+levres/i,
      /cosmetiques?/i,
      /maquillage/i,
    ],
    penalize: [
      /slips?\s+de\s+sport/i,
      /cyclisme/i,
      /adhesif/i,
      /colle/i,
      /emballages?/i,
      /papeterie/i,
      /brillant\s+pour\s+le\s+corps/i,
      /paillettes?\s+pour\s+le\s+corps/i,
    ],
  },
  {
    id: "eye_makeup",
    match:
      /\b(mascara|eye-?liner|eyeliner|fard\s+a\s+paupieres?|faux-?cils?|recourbe-?cils?|cils?|sourcils?|brow\s+pencil|ombre\s+a\s+paupieres?)\b/i,
    boost: [
      /maquillage\s+pour\s+les\s+yeux/i,
      /mascara/i,
      /eye-?liner/i,
      /fard\s+a\s+paupieres?/i,
      /faux-?cils?/i,
      /crayons?\s+sourcils/i,
      /apprets?\s+pour\s+cils/i,
    ],
    penalize: [
      /accessoires\s+pour\s+faux\s+cils/i,
      /colle\s+a\s+faux\s+cils/i,
      /dissolvant\s+de\s+colle\s+a\s+faux\s+cils/i,
      /miroirs?\s+de\s+maquillage/i,
      /pinceaux\s+de\s+maquillage/i,
    ],
  },
  {
    id: "face_makeup",
    match:
      /\b(blush|fard\s+a\s+joues?|fond(?:s)?\s+de\s+teint|correcteur(?:s)?\s+de\s+teint|poudre\s+pour\s+visage|highlighter|surligneur|luminizer|base\s+de\s+maquillage|primer)\b/i,
    boost: [
      /maquillage\s+du\s+visage/i,
      /fards?\s+a\s+joues/i,
      /fonds?\s+de\s+teint/i,
      /correcteurs?\s+de\s+teint/i,
      /poudres?\s+pour\s+visage/i,
      /surligneurs?\s+et\s+luminizers?/i,
      /base\s+de\s+maquillage\s+pour\s+le\s+visage/i,
    ],
    penalize: [
      /miroirs?\s+de\s+maquillage/i,
      /eponges?\s+de\s+maquillage/i,
      /pinceaux\s+de\s+maquillage/i,
      /papier\s+matifiant/i,
    ],
  },
  {
    id: "skin_care",
    match:
      /\b(serum|serums|s[eé]rum|s[eé]rums|creme\s+visage|cr[eè]me\s+visage|cr[eè]me\s+hydratante|nettoyant\s+visage|tonique|astringent|anti-?age|anti-?acne|masque\s+visage|gommage|spf|protection\s+solaire|demaquillant)\b/i,
    boost: [
      /soin\s+de\s+la\s+peau/i,
      /cremes?\s+et\s+lotions/i,
      /nettoyants?\s+visage/i,
      /lotions?\s+toniques?\s+et\s+astringentes?/i,
      /masques?\s+et\s+gommages/i,
      /protection\s+solaire/i,
      /traitements?\s+contre\s+l['']acne/i,
      /kits?\s+de\s+soins?\s+anti-?age/i,
      /demaquillants?/i,
    ],
    penalize: [
      /accessoires\s+pour\s+le\s+soin\s+de\s+la\s+peau/i,
      /applicateurs?\s+de\s+lotion/i,
      /rouleaux?\s+pour\s+le\s+soin\s+de\s+la\s+peau/i,
      /sauna\s+facial/i,
      /brosses?\s+pour\s+nettoyer\s+la\s+peau/i,
    ],
  },
  {
    id: "plush_figurine",
    match:
      /\b(figurines?|peluches?|peluche|plush(?:ie|ies|es)?|stuffed\s+animals?|poupees?|poupées?|poupée|doudous?|doudou|marionnettes?|figurine\s+en\s+peluche|peluche\s+collectible|figurine\s+de\s+collection)\b/i,
    boost: [
      /jeux\s+et\s+jouets/i,
      /poupees.*figurines/i,
      /peluches/i,
      /figurines?\s+jouets/i,
      /marionnettes/i,
      /poupees/i,
      /figurines?\s+a\s+tete\s+mobile/i,
      /sets?\s+de\s+jeu/i,
    ],
    penalize: [
      /animaux\s+et\s+articles\s+pour\s+animaux/i,
      /aquarium/i,
      /poissons/i,
      /collerettes/i,
      /accessoires\s+pour\s+(chiens|chats|oiseaux|poissons)/i,
      /jouets\s+pour\s+(chiens|chats|oiseaux)/i,
      /entretien\s+d.?aquarium/i,
      /litiere/i,
      /colliers?\s+pour\s+animaux/i,
    ],
  },
  {
    id: "womens_leggings",
    match:
      /\b(legging|leggings|anti[- ]?cellulite|collant|collants|yoga\s+pants|pantalon\s+gainant|cuissardes?\s+femme)\b/i,
    boost: [
      /collants?/i,
      /vetements?\s+fitness/i,
      /sous-vetements/i,
      /pantalons?\s+de\s+yoga/i,
      /tenues?\s+de\s+cyclisme/i,
    ],
    penalize: [/football\s+americain/i, /football\b/i, /ballons?/i, /jouets?/i],
  },
  {
    id: "laptop",
    match: /\b(macbook|ordinateur\s*portable|laptop|chromebook|thinkpad|ultrabook)\b/i,
    boost: [/ordinateurs?\s+portables?/i, /laptops?/i],
    penalize: [/connecteur/i, /composant/i],
  },
  {
    id: "headphones",
    match: /\b(ecouteurs?|casque|airpods|earbuds|headphones)\b/i,
    boost: [/ecouteurs?/i, /casques?/i, /audio/i],
    penalize: [/connecteur/i, /composant/i],
  },
  {
    id: "car_infotainment",
    match:
      /\b(car\s*play|carplay|android\s*auto|mirrorlink|apple\s*play|adaptateur\s+(auto|vehicule|voiture)|autoradio|poste\s+radio|ecran\s+(auto|vehicule|voiture)|kit\s+multimedia\s+auto|systeme\s+multimedia|lecteur\s+multimedia\s+auto|interface\s+multimedia|boitier\s+carplay|module\s+carplay|sans\s+fil\s+pour\s+(auto|voiture)|wireless\s+carplay)\b/i,
    boost: [
      /electronique\s+pour\s+vehicules/i,
      /lecteurs.*audio.*video.*integres/i,
      /mains.?libres.*vehicules/i,
      /systemes?\s+de\s+navigation\s+gps/i,
      /accessoires\s+pour\s+gps/i,
      /haut.?parleurs?\s+pour\s+vehicules/i,
      /amplificateurs?\s+pour\s+vehicules/i,
    ],
    penalize: [
      /cartes?\s+prepayees?/i,
      /cartes?\s+sim/i,
      /telephonie/i,
      /telephones?\s+mobiles?/i,
      /deverrouill/i,
      /forfaits?\s+mobiles?/i,
      /recharge\s+de\s+cartes?/i,
    ],
  },
  {
    id: "vehicle_camera",
    match:
      /\b(dash\s*cam|dashcam|cam[eé]ra\s+(de\s+)?voiture|camera\s+(de\s+)?voiture|car\s*camera|dvr\s+auto|enregistreur\s+(de\s+)?conduite|triple\s*cam|3\s*canaux|double\s*cam[eé]ra|backup\s*cam|road\s*cam|redtiger|gopro\s+max|front\s*and\s*rear\s*cam)\b/i,
    boost: [
      /cam[eé]ras?\s+de\s+recul/i,
      /electronique\s+pour\s+vehicules/i,
      /cam[eé]ras?\s+video/i,
      /cam[eé]ras?\s+de\s+surveillance/i,
      /appareils\s+photo.*cam[eé]ras/i,
      /cam[eé]ras?\s+embarqu/i,
    ],
    penalize: [
      /animaux/i,
      /animaux de compagnie/i,
      /grille de separation/i,
      /guides?\s+d['']utilisation/i,
      /cabanes.*voiture/i,
      /auvents/i,
      /garages/i,
      /pelouses/i,
      /maison et jardin/i,
      /\bmedias\b/i,
      /jouets/i,
      /vehicules de jeu/i,
    ],
  },
  {
    id: "camera",
    match:
      /\b(cam[eé]ra|camera|webcam|gopro|action\s*cam|mirrorless|reflex|appareil\s+photo\s+num|photographie)\b/i,
    boost: [
      /appareils\s+photo.*cam[eé]ras/i,
      /cam[eé]ras?\s+video/i,
      /cam[eé]ras?\s+de\s+surveillance/i,
      /appareils\s+photo\s+num/i,
    ],
    penalize: [/animaux/i, /guides?\s+d['']utilisation/i, /grille de separation/i, /connecteur/i],
  },
  {
    id: "cookware",
    match:
      /\b(frying\s*pan|skillet|wok|saucepan|cookware|bakeware|marmite|casserole|poele|sauteuse|batterie\s+de\s+cuisine|ustensiles?\s+de\s+cuisine)\b/i,
    boost: [/cookware/i, /bakeware/i, /kitchen/i, /cuisine/i, /ustensiles?/i],
    penalize: [/headphones?/i, /audio/i, /connecteur/i, /telephones?\s+mobiles?/i],
  },
  {
    id: "portable_fan",
    match:
      /\b(ventilateur|ventilateurs|brumisateur|brumisateurs|refroidisseur\s*portable|air\s*cooler|climatiseur\s*portable|fan\s*usb|mini\s*fan|handheld\s*fan)\b/i,
    boost: [
      /ventilateurs?\s+portables?/i,
      /ventilateurs?\s+de\s+table/i,
      /ventilateurs?\s+muraux/i,
      /ventilateurs?/i,
      /brumisateurs?/i,
      /climatisation/i,
      /chauffage\s+et\s+climatisation/i,
    ],
    penalize: [
      /velo/i,
      /cyclisme/i,
      /vitesses?\s+de\s+velo/i,
      /transmission/i,
      /equipements?\s+sportifs/i,
      /football/i,
      /securite\s+a\s+domicile/i,
      /lampes?\s+de\s+securite/i,
      /surveillance/i,
      /enregistrement/i,
      /sport/i,
      /pieces?\s+detachees/i,
    ],
  },
  {
    id: "power_bank",
    match: /\b(power\s*bank|batterie\s+externe|chargeur\s+portable|bank\s*\d+\s*mah|\d+\s*mah)\b/i,
    boost: [/batteries?\s+externes?/i, /chargeurs?\s+portables?/i, /batteries?\s+pour\s+telephones?/i],
    penalize: [/velo/i, /cyclisme/i, /surveillance/i, /securite/i, /football/i],
  },
  {
    id: "furniture_storage",
    match:
      /\b(commode|armoire|etagere|étagère|meuble\s+de\s+rangement|buffet|placard|dressing|nightstand|chevet)\b/i,
    boost: [/meubles?/i, /rangement/i, /commodes?/i, /armoires?/i, /etageres?/i, /mobilier/i],
    penalize: [/velo/i, /sport/i, /electronique/i, /telephonie/i],
  },
  {
    id: "bags_luggage",
    match:
      /\b(sac\s+a\s+dos|sacs?\s+a\s+dos|backpack|valise|valises|sac\s+de\s+voyage|sac\s+bandouliere|sac\s+a\s+main|sac\s+a\s+main|portefeuille|wallet|maroquinerie|sac\s+banane|crossbody|tote\s+bag)\b/i,
    boost: [
      /bagages?\s+et\s+maroquinerie/i,
      /sacs?\s+a\s+dos/i,
      /valises?/i,
      /sacs?\s+de\s+voyage/i,
      /portefeuilles?/i,
      /sacs?\s+banane/i,
    ],
    penalize: [/sacs?\s+a\s+litiere/i, /sacs?\s+pour\s+cadeaux/i, /housses?\s+pour\s+appareils/i],
  },
  {
    id: "footwear",
    match:
      /\b(chaussures?|baskets?|sneakers?|bottines?|bottes?|sandales?|tongs?|mocassins?|escarpins?|running\s+shoes?|chaussures?\s+de\s+sport)\b/i,
    boost: [/chaussures?/i, /baskets?/i, /sandales?/i, /bottes?/i, /vetements?\s+et\s+accessoires/i],
    penalize: [/pieces?\s+detachees/i, /accessoires\s+pour\s+chaussures/i, /cirage/i],
  },
  {
    id: "tablet",
    match:
      /\b(tablette|tablettes|ipad|galaxy\s+tab|android\s+tablet|tablette\s+multimedia|tablet)\b/i,
    boost: [/tablettes?\s+multimedia/i, /ordinateurs?/i, /tablettes?/i],
    penalize: [
      /tablettes?\s+de\s+clavier/i,
      /tablettes?\s+graphiques/i,
      /accessoires\s+pour\s+tablettes/i,
      /housses?\s+pour\s+tablettes/i,
    ],
  },
  {
    id: "home_lighting",
    match:
      /\b(lampe\s+(?:de\s+)?(?:bureau|chevet|salon|led|plafond)|lampadaire|luminaire|applique\s+murale|plafonnier|guirlande\s+lumineuse|ampoule\s+led|lampe\s+led)\b/i,
    boost: [/luminaires?/i, /lampes?/i, /ampoules?/i, /maison\s+et\s+jardin/i],
    penalize: [
      /lampes?\s+de\s+securite/i,
      /lampes?\s+pour\s+armes/i,
      /lampes?\s+studio/i,
      /lampes?\s+de\s+rechange/i,
      /surveillance/i,
    ],
  },
  {
    id: "baby_gear",
    match:
      /\b(poussette|landau|siege\s+auto\s+bebe|siege\s+auto\s+b[eé]b[eé]|baignoire\s+bebe|baignoire\s+b[eé]b[eé]|biberon|couches?\s+bebe|couches?\s+b[eé]b[eé]|tapis\s+d['']eveil|tapis\s+d[''][eé]veil|porte[- ]bebe|porte[- ]b[eé]b[eé])\b/i,
    boost: [
      /bebes?\s+et\s+tout-petits/i,
      /poussettes?/i,
      /sieges?\s+auto/i,
      /biberons?/i,
      /accessoires\s+de\s+bain\s+pour\s+bebes?/i,
      /jouets?\s+pour\s+bebes?/i,
    ],
    penalize: [/jouets?\s+pour\s+chiens/i, /animaux/i, /vetements?\s+fitness/i],
  },
  {
    id: "pet_supplies",
    match:
      /\b(laisse\s+(?:pour\s+)?chien|collier\s+(?:pour\s+)?chien|harnais\s+(?:pour\s+)?chien|croquettes?|litiere\s+(?:pour\s+)?chat|jouet\s+(?:pour\s+)?chien|niche\s+(?:pour\s+)?chien|gamelle\s+(?:pour\s+)?(?:chien|chat)|pet\s+supplies)\b/i,
    boost: [
      /animaux\s+et\s+articles\s+pour\s+animaux/i,
      /accessoires\s+pour\s+chiens/i,
      /accessoires\s+pour\s+chats/i,
      /colliers?\s+et\s+harnais/i,
      /nourriture\s+pour\s+chiens/i,
      /jouets?\s+pour\s+chiens/i,
    ],
    penalize: [/jeux\s+et\s+jouets/i, /peluches/i, /figurines/i, /aquarium/i],
  },
  {
    id: "bedding",
    match:
      /\b(housse\s+de\s+couette|draps?\s+de\s+lit|oreiller|oreillers|couette|couverture|taie\s+d['']oreiller|literie|bedding|parure\s+de\s+lit)\b/i,
    boost: [/literie/i, /linge/i, /housses?\s+de\s+couette/i, /draps?\s+de\s+lit/i, /oreillers?/i],
    penalize: [/literie\s+pour\s+petits\s+animaux/i, /literie\s+medicale/i, /matelas\s+de\s+sieste/i],
  },
  {
    id: "fashion_jewelry",
    match:
      /\b(collier(?!\s+chien)|colliers?(?!\s+et\s+harnais)|bague|bagues|bracelet(?!\s+connect)|bracelets?(?!\s+connect)|boucles?\s+d['']oreilles?|earrings?|necklace|ring\b|bijoux?\s+fantaisie)\b/i,
    boost: [/bijoux/i, /colliers?/i, /bagues?/i, /bracelets?/i, /boucles?\s+d['']oreilles?/i],
    penalize: [
      /montres?/i,
      /moniteurs?\s+d['']activit/i,
      /colliers?\s+et\s+harnais\s+pour\s+animaux/i,
      /colliers?\s+de\s+trepieds/i,
    ],
  },
  {
    id: "mosquito_screen",
    match:
      /\b(moustiquaire|moustiquaires|mosquito\s*net|insect\s*screen|rideau\s*(?:magnetique|anti.?insect|moustiquaire)|filet\s*anti.?moustique|ecran\s*anti.?insect)\b/i,
    boost: [
      /moustiquaire/i,
      /habillages?\s+de\s+fenetre/i,
      /moustiquaires?\s+pour\s+fenetre/i,
      /camping.*moustiquaire/i,
      /moustiquaires?\s+pour\s+parasol/i,
      /loisirs\s+de\s+plein\s+air/i,
    ],
    penalize: [
      /colle/i,
      /adhesif/i,
      /aimant/i,
      /arts?\s*et\s*loisirs/i,
      /artisanat/i,
      /aquarium/i,
      /poisson/i,
      /entretien\s+d.?aquarium/i,
      /thermocoll/i,
      /bande\s+thermocoll/i,
      /desinsectisation.*repulsif/i,
      /pesticide/i,
    ],
  },
]

const PHRASE_BOOSTS: Array<{ phrase: RegExp; breadcrumb: RegExp; points: number }> = [
  {
    phrase: /playstation|ps5|ps4|playstation\s+portal|lecteur\s+(?:a|à)\s+distance\s+ps/i,
    breadcrumb: /accessoires\s+pour\s+consoles?\s+de\s+jeu\s+de\s+salon/i,
    points: 42,
  },
  {
    phrase: /nintendo\s*switch|steam\s*deck|xbox/i,
    breadcrumb: /consoles?\s+de\s+jeu\s+portables?|accessoires\s+pour\s+consoles?\s+de\s+jeu/i,
    points: 36,
  },
  {
    phrase: /manette|gamepad|dualsense/i,
    breadcrumb: /accessoires\s+pour\s+manettes?/i,
    points: 34,
  },
  {
    phrase: /montre\s+connect|smart\s*watch|montre\s+intelligente/i,
    breadcrumb: /moniteurs?\s+d['']activit/i,
    points: 18,
  },
  {
    /** Plain watch titles — do not fire on "montre connectée" (activity trackers win). */
    phrase: /\bmontres?\b(?!\s*connect)|\bwatches?\b(?!\s*connect)|\bwrist\s*watch/i,
    breadcrumb: /bijoux\s*>\s*montres\b|^vetements et accessoires\s*>\s*bijoux\s*>\s*montres$/i,
    points: 20,
  },
  {
    phrase: /\bmontres?\b|\bwatches?\b/i,
    breadcrumb:
      /accessoires\s+pour\s+montres|bracelets?\s+de\s+montres|kits?\s+de\s+reparation\s+pour\s+montres|stickers?\s+.*montres/i,
    points: -28,
  },
  {
    phrase: /trottinette\s+electrique|scooter\s*electrique|e-?scooter/i,
    breadcrumb: /trottinettes?/i,
    points: 28,
  },
  {
    phrase: /trottinette|scooter\s+electrique/i,
    breadcrumb: /stop-?trottoir|chevalets?\s+stop/i,
    points: -40,
  },
  { phrase: /bracelet\s+connect/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 18 },
  { phrase: /smart\s*band|mi\s*band/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 20 },
  {
    phrase: /telephones?\s+mobiles?|smartphones?/i,
    breadcrumb: /telephones?\s+mobiles?/i,
    points: 48,
  },
  {
    phrase: /telephones?\s+mobiles?|smartphones?/i,
    breadcrumb: /cartes?\s+prepayees?|cartes?\s+sim|forfaits?\s+mobiles?|prepayes?/i,
    points: -50,
  },
  {
    phrase: /telephones?\s+mobiles?\s+17|neufs?,?\s*7[,.]?\d|pro\s+max/i,
    breadcrumb: /deverrouill/i,
    points: 35,
  },
  {
    phrase: /telephones?\s+mobiles?\s+17|neufs?,?\s*7[,.]?\d|pro\s+max/i,
    breadcrumb: /prepayes?|cartes?\s+sim/i,
    points: -60,
  },
  {
    phrase: /telephones?\s+mobiles?|smartphones?/i,
    breadcrumb: /brouilleurs?.*telephone|brouilleurs?\s+de\s+signal/i,
    points: -55,
  },
  {
    phrase: /legging|leggings|anti[- ]?cellulite/i,
    breadcrumb: /collants?/i,
    points: 42,
  },
  {
    phrase: /legging|leggings|anti[- ]?cellulite/i,
    breadcrumb: /football\s+americain|football\b/i,
    points: -45,
  },
  { phrase: /sommeil|sleep/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 4 },
  { phrase: /sommeil|sleep/i, breadcrumb: /aides?\s+au\s+sommeil|bruit\s+blanc/i, points: -25 },
  { phrase: /frying\s*pan|skillet|wok/i, breadcrumb: /cookware|bakeware/i, points: 22 },
  { phrase: /frying\s*pan|skillet/i, breadcrumb: /home\s*&\s*kitchen|kitchen/i, points: 8 },
  {
    phrase: /cam[eé]ra\s+(de\s+)?voiture|dash\s*cam|dashcam|3\s*canaux/i,
    breadcrumb: /cam[eé]ras?\s+de\s+recul/i,
    points: 32,
  },
  {
    phrase: /cam[eé]ra\s+(de\s+)?voiture|dash\s*cam|dashcam/i,
    breadcrumb: /electronique\s+pour\s+vehicules/i,
    points: 14,
  },
  {
    phrase: /cam[eé]ra\s+(de\s+)?voiture|dash\s*cam|dashcam/i,
    breadcrumb: /animaux|grille de separation|guides?\s+d['']utilisation|cabanes|auvents|pelouses/i,
    points: -45,
  },
  {
    phrase: /car\s*play|carplay|android\s*auto/i,
    breadcrumb: /lecteurs.*audio.*video.*integres|electronique\s+pour\s+vehicules/i,
    points: 36,
  },
  {
    phrase: /car\s*play|carplay|android\s*auto|adaptateur.*(?:auto|voiture|vehicule)/i,
    breadcrumb: /cartes?\s+prepayees?|cartes?\s+sim|forfaits?\s+mobiles?/i,
    points: -50,
  },
  {
    phrase: /ventilateur\s+portable|mini\s*fan|handheld\s*fan/i,
    breadcrumb: /ventilateurs?\s+portables?|brumisateurs?/i,
    points: 42,
  },
  {
    phrase: /ventilateur|brumisateur/i,
    breadcrumb: /ventilateurs?|climatisation|chauffage\s+et\s+climatisation/i,
    points: 28,
  },
  {
    phrase: /ventilateur|brumisateur/i,
    breadcrumb: /velo|cyclisme|vitesses?.*velo|securite|surveillance|football|sport/i,
    points: -55,
  },
  {
    phrase: /lumiere|lampe/i,
    breadcrumb: /lampes?\s+de\s+securite|surveillance/i,
    points: -30,
  },
  {
    phrase: /moustiquaire|mosquito\s*net|rideau\s*magnetique/i,
    breadcrumb: /moustiquaire|habillages?\s+de\s+fenetre/i,
    points: 45,
  },
  {
    phrase: /moustiquaire|mosquito\s*net/i,
    breadcrumb: /camping.*moustiquaire|loisirs\s+de\s+plein\s+air/i,
    points: 28,
  },
  {
    phrase: /moustiquaire|mosquito\s*net/i,
    breadcrumb: /colle|adhesif|aimant|aquarium|poisson|artisanat|arts?\s*et\s*loisirs/i,
    points: -55,
  },
  {
    phrase: /figurine|peluche|plush|poupée|poupee|doudou|marionnette/i,
    breadcrumb: /jeux\s+et\s+jouets.*peluches|peluches|figurines?\s+jouets|poupees.*figurines/i,
    points: 48,
  },
  {
    phrase: /figurine|peluche|plush|poupée|poupee|doudou/i,
    breadcrumb: /animaux|aquarium|poissons|collerettes|colliers?\s+pour\s+animaux|jouets\s+pour\s+(chiens|chats)/i,
    points: -65,
  },
  {
    phrase: /gloss\s+a?\s+levres?|lip\s*gloss|brillant\s+a?\s+levres?|rouge\s+a?\s+levres?|crayon\s+a?\s+levres?|baume\s+a?\s+levres?|soin\s+des?\s+levres?/i,
    breadcrumb: /maquillage\s+pour\s+les\s+levres|brillant\s+a\s+levres|rouge\s+a\s+levres|crayon\s+a\s+levres|soins?\s+des?\s+levres|baumes?\s+a\s+levres/i,
    points: 52,
  },
  {
    phrase: /(?:gloss|lip\s*gloss|brillant\s+a?\s+levres?|baume\s+a?\s+levres?|soin\s+des?\s+levres?).*(repulpant|repulpante|hydratant|hydratante)|(repulpant|repulpante|hydratant|hydratante).*(gloss|lip\s*gloss|levres?)/i,
    breadcrumb: /cosmetiques?|maquillage|soins?\s+des?\s+levres/i,
    points: 16,
  },
  {
    phrase: /gloss\s+a?\s+levres?|lip\s*gloss|brillant\s+a?\s+levres?|rouge\s+a?\s+levres?|baume\s+a?\s+levres?/i,
    breadcrumb: /slips?\s+de\s+sport|cyclisme|adhesif|colle|paillettes?\s+pour\s+le\s+corps|decoration\s+du\s+corps/i,
    points: -58,
  },
  {
    phrase: /mascara|eye-?liner|eyeliner|fard\s+a\s+paupieres?|faux-?cils?/i,
    breadcrumb: /maquillage\s+pour\s+les\s+yeux|mascara|eye-?liner|fard\s+a\s+paupieres?|faux-?cils/i,
    points: 48,
  },
  {
    phrase: /mascara|eye-?liner|eyeliner|faux-?cils?/i,
    breadcrumb: /accessoires\s+pour\s+faux\s+cils|colle\s+a\s+faux\s+cils|miroirs?\s+de\s+maquillage|pinceaux\s+de\s+maquillage/i,
    points: -42,
  },
  {
    phrase: /blush|fard\s+a\s+joues?|fond(?:s)?\s+de\s+teint|correcteur(?:s)?\s+de\s+teint|poudre\s+pour\s+visage|highlighter|surligneur/i,
    breadcrumb: /maquillage\s+du\s+visage|fards?\s+a\s+joues|fonds?\s+de\s+teint|correcteurs?\s+de\s+teint|poudres?\s+pour\s+visage|surligneurs?\s+et\s+luminizers?/i,
    points: 46,
  },
  {
    phrase: /serum|s[eé]rum|creme\s+visage|cr[eè]me\s+visage|cr[eè]me\s+hydratante|nettoyant\s+visage|tonique|anti-?age|anti-?acne|spf|protection\s+solaire/i,
    breadcrumb: /soin\s+de\s+la\s+peau|cremes?\s+et\s+lotions|nettoyants?\s+visage|lotions?\s+toniques?|masques?\s+et\s+gommages|protection\s+solaire|traitements?\s+contre\s+l['']acne/i,
    points: 44,
  },
  {
    phrase: /serum|s[eé]rum|creme\s+visage|cr[eè]me\s+visage|cr[eè]me\s+hydratante|nettoyant\s+visage/i,
    breadcrumb: /accessoires\s+pour\s+le\s+soin\s+de\s+la\s+peau|applicateurs?\s+de\s+lotion|rouleaux?\s+pour\s+le\s+soin\s+de\s+la\s+peau|sauna\s+facial/i,
    points: -44,
  },
  {
    phrase: /sac\s+a\s+dos|backpack|valise|portefeuille|sac\s+banane/i,
    breadcrumb: /bagages?\s+et\s+maroquinerie|sacs?\s+a\s+dos|valises?|portefeuilles?/i,
    points: 46,
  },
  {
    phrase: /chaussures?|baskets?|sneakers?|sandales?/i,
    breadcrumb: /chaussures?|baskets?|sandales?/i,
    points: 44,
  },
  {
    phrase: /tablette|ipad|galaxy\s+tab/i,
    breadcrumb: /tablettes?\s+multimedia/i,
    points: 48,
  },
  {
    phrase: /tablette|ipad|galaxy\s+tab/i,
    breadcrumb: /tablettes?\s+de\s+clavier|tablettes?\s+graphiques|housses?\s+pour\s+tablettes/i,
    points: -40,
  },
  {
    phrase: /lampe\s+(?:de\s+)?(?:bureau|chevet|led)|lampadaire|luminaire|ampoule\s+led/i,
    breadcrumb: /luminaires?|lampes?|ampoules?/i,
    points: 42,
  },
  {
    phrase: /lampe\s+(?:de\s+)?(?:bureau|chevet|led)|lampadaire|luminaire/i,
    breadcrumb: /lampes?\s+de\s+securite|surveillance|lampes?\s+pour\s+armes/i,
    points: -50,
  },
  {
    phrase: /poussette|biberon|siege\s+auto\s+bebe|tapis\s+d['']eveil/i,
    breadcrumb: /bebes?\s+et\s+tout-petits|poussettes?|biberons?/i,
    points: 44,
  },
  {
    phrase: /laisse\s+chien|collier\s+chien|croquettes?|litiere\s+chat|jouet\s+pour\s+chien/i,
    breadcrumb: /animaux\s+et\s+articles|accessoires\s+pour\s+chiens|accessoires\s+pour\s+chats/i,
    points: 46,
  },
  {
    phrase: /housse\s+de\s+couette|draps?\s+de\s+lit|oreiller|literie|parure\s+de\s+lit/i,
    breadcrumb: /literie|housses?\s+de\s+couette|draps?\s+de\s+lit|oreillers?/i,
    points: 44,
  },
  {
    phrase: /collier|bague|bracelet|boucles?\s+d['']oreilles/i,
    breadcrumb: /bijoux|colliers?|bagues?|bracelets?|boucles?\s+d['']oreilles/i,
    points: 36,
  },
  {
    phrase: /collier|bague|bracelet/i,
    breadcrumb: /colliers?\s+et\s+harnais\s+pour\s+animaux|montres?|moniteurs?\s+d['']activit/i,
    points: -40,
  },
]

const COMPOUND_TERMS: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /\bcar\s*play\b|\bcarplay\b/i, token: "carplay" },
  { pattern: /\bandroid\s*auto\b/i, token: "androidauto" },
  { pattern: /\bplaystation\s+portal\b/i, token: "playstationportal" },
  { pattern: /\bps5\b/i, token: "ps5" },
  { pattern: /\bps4\b/i, token: "ps4" },
  { pattern: /\bmoustiquaire\s+porte\b|\bporte\s+moustiquaire\b/i, token: "moustiquaire" },
  { pattern: /\bmoustiquaire\s+(?:magnetique|fenetre|fenêtre)\b/i, token: "moustiquaire" },
  { pattern: /\blip\s*gloss\b|\bgloss\s+a?\s+levres?\b/i, token: "lipgloss" },
  { pattern: /\brouge\s+a?\s+levres?\b/i, token: "rougealevres" },
  { pattern: /\bbaume\s+a?\s+levres?\b/i, token: "baumealevres" },
]

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function frenchWordForms(word: string): string[] {
  const w = word.toLowerCase()
  const forms = new Set<string>([w])
  if (w.length >= 4 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) {
    forms.add(w.slice(0, -1))
  }
  if (w.length >= 4 && w.endsWith("x")) {
    forms.add(w.slice(0, -1))
  }
  if (w.length >= 5 && w.endsWith("eaux")) {
    forms.add(w.slice(0, -1))
  }
  return [...forms]
}

function tokenMatchesSearchWord(token: string, word: string): boolean {
  if (token === word) return true
  const tokenForms = frenchWordForms(token)
  const wordForms = frenchWordForms(word)
  for (const tf of tokenForms) {
    for (const wf of wordForms) {
      if (tf === wf) return true
      if (wf.length >= 6 && tf.length >= 6) {
        const prefixLen = 6
        if (tf.startsWith(wf.slice(0, prefixLen)) || wf.startsWith(tf.slice(0, prefixLen))) {
          return true
        }
      }
      if (wf.length >= 5 && tf.length >= 5 && (tf.startsWith(wf.slice(0, 5)) || wf.startsWith(tf.slice(0, 5)))) {
        /** Block known false friends (collection ↔ collerettes, décorations…). */
        const pair = [tf, wf].sort().join("|")
        if (pair === "collection|collerettes" || pair === "collection|decorations") return false
        return true
      }
    }
  }
  return false
}

function breadcrumbWordTokens(breadcrumb: string): Set<string> {
  return new Set(
    normalizeText(breadcrumb)
      .split(/[^a-z0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
  )
}

/** Whole-word match in breadcrumb; handles FR plurals (ventilateur ↔ ventilateurs). */
export function wordMatchesInBreadcrumb(word: string, breadcrumb: string): boolean {
  const w = word.trim().toLowerCase()
  if (w.length < 2) return false
  const tokens = breadcrumbWordTokens(breadcrumb)
  for (const token of tokens) {
    if (tokenMatchesSearchWord(token, w)) return true
  }

  if (w.length <= SHORT_TOKEN_MAX_LEN) return false

  const b = normalizeText(breadcrumb)
  let idx = 0
  while (idx < b.length) {
    const at = b.indexOf(w, idx)
    if (at < 0) break
    const before = at === 0 ? "" : b[at - 1]!
    const after = at + w.length >= b.length ? "" : b[at + w.length]!
    const isBoundary = (ch: string) => !/[a-z0-9]/.test(ch)
    if (isBoundary(before) && isBoundary(after)) return true
    idx = at + 1
  }
  return false
}

export function extractProductTitleTokens(text: string): string[] {
  const norm = normalizeText(text)
  const out: string[] = []
  const seen = new Set<string>()

  const push = (w: string) => {
    if (w.length < 3 || STOP.has(w) || seen.has(w)) return
    seen.add(w)
    out.push(w)
  }

  for (const { pattern, token } of COMPOUND_TERMS) {
    if (pattern.test(norm)) push(token)
  }

  for (const w of norm.split(/[^a-z0-9]+/)) {
    const t = w.trim()
    if (t.length < 3 || STOP.has(t)) continue
    if (t === "carplay" || t === "androidauto") {
      push(t)
      continue
    }
    if (seen.has("carplay") && (t === "car" || t === "play")) continue
    if (seen.has("androidauto") && (t === "android" || t === "auto")) continue
    push(t)
  }

  return out
}

function activeIntentForText(normText: string): ProductIntent | null {
  for (const intent of PRODUCT_INTENTS) {
    if (intent.match.test(normText)) return intent
  }
  return null
}

/** Leaf paths that match the detected product intent (for AI catalog priming). */
export function leafPathsForDetectedIntent(
  title: string,
  description: string,
  leafPaths: LeafPath[],
  limit = 16
): LeafPath[] {
  const text = `${title} ${description}`.trim()
  if (text.length < 2) return []
  const intent = activeIntentForText(normalizeText(text))
  if (!intent) return []

  const scored = leafPaths
    .map((lp) => {
      const b = normalizeText(lp.breadcrumb)
      let s = 0
      for (const rx of intent.boost) if (rx.test(b)) s += 10
      for (const rx of intent.penalize) if (rx.test(b)) s -= 20
      return { lp, s }
    })
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)

  const out: LeafPath[] = []
  const seen = new Set<string>()
  for (const { lp } of scored) {
    if (out.length >= limit) break
    if (seen.has(lp.leafId)) continue
    seen.add(lp.leafId)
    out.push(lp)
  }
  return out
}

export function isWearableProductText(title: string, description = ""): boolean {
  const text = `${title} ${description}`.trim()
  if (text.length < 2) return false
  return activeIntentForText(normalizeText(text))?.id === "activity_tracker"
}

/** Secondary picks when marketing says "montre" but Google expects activity monitors. */
const WEARABLE_ALTERNATIVE_LEAVES: Array<{
  breadcrumb: RegExp
  reason: string
}> = [
  {
    breadcrumb: /^vetements et accessoires\s*>\s*bijoux\s*>\s*montres$/i,
    reason:
      "Autre interprétation : montre classique (bijouterie). Déconseillé pour bracelets connectés et smart bands.",
  },
]

export type CategoryAlternativeSuggestion = LeafPath & { reason: string }

export function findWearableCategoryAlternatives(
  title: string,
  description: string,
  leafPaths: LeafPath[],
  primarySuggestions: LeafPath[]
): CategoryAlternativeSuggestion[] {
  if (!isWearableProductText(title, description)) return []

  const primaryHasActivity = primarySuggestions.some((lp) =>
    /moniteurs?\s+d['']activit/i.test(lp.breadcrumb)
  )
  if (primarySuggestions.length > 0 && !primaryHasActivity) return []

  const exclude = new Set(primarySuggestions.map((p) => p.leafId))
  const out: CategoryAlternativeSuggestion[] = []

  for (const alt of WEARABLE_ALTERNATIVE_LEAVES) {
    const lp = leafPaths.find((p) => {
      if (exclude.has(p.leafId)) return false
      return alt.breadcrumb.test(normalizeText(p.breadcrumb))
    })
    if (lp) out.push({ ...lp, reason: alt.reason })
  }

  return out
}

/** Score how well product copy matches a taxonomy breadcrumb (higher = better). */
export function scoreProductTextAgainstBreadcrumb(text: string, breadcrumb: string): number {
  const normText = normalizeText(text)
  const b = normalizeText(breadcrumb)
  const words = extractProductTitleTokens(text)
  if (words.length === 0 && normText.length < 2) return 0

  let score = 0
  const intent = activeIntentForText(normText)

  if (intent) {
    for (const rx of intent.boost) {
      if (rx.test(b)) score += 28
    }
    for (const rx of intent.penalize) {
      if (rx.test(b)) score -= 35
    }
  }

  for (const { phrase, breadcrumb: bRx, points } of PHRASE_BOOSTS) {
    if (phrase.test(normText) && bRx.test(b)) score += points
  }

  /** Exact / French-morphology match on the leaf segment (e.g. titre "Montre" → leaf "Montres"). */
  const leafSeg = b.split(">").pop()?.trim() ?? ""
  if (leafSeg.length >= 3) {
    for (const w of words) {
      if (tokenMatchesSearchWord(leafSeg, w)) {
        score += 4
        break
      }
    }
  }

  for (const w of words) {
    if (WEAK_TOKENS.has(w)) {
      if (intent?.id === "vehicle_camera" && VEHICLE_CONTEXT_WEAK.has(w)) {
        const cameraCtx = /camera|dash|dvr|canal|canaux|4k|1080|enregistr|recul|surveillance|video/i
        if (wordMatchesInBreadcrumb(w, b) && !cameraCtx.test(b)) score += 0.15
        continue
      }
      if (intent?.id === "car_infotainment" && (w === "car" || w === "auto" || w === "play")) {
        continue
      }
      if (intent?.id === "gaming_console" && (w === "play" || w === "portal")) {
        continue
      }
      /** Fan titles often mention lumière / power bank as accessories — do not drive security categories. */
      if (intent?.id === "portable_fan" && (w === "lumiere" || w === "power" || w === "bank")) {
        continue
      }
      if (wordMatchesInBreadcrumb(w, b)) score += intent ? 0.2 : 0
      continue
    }
    const lengthBonus = Math.min(w.length, 12) * 0.45
    if (wordMatchesInBreadcrumb(w, b)) {
      score += 3 + lengthBonus
    } else if (w.length >= 6) {
      const stem = w.slice(0, 5)
      if (stem.length >= 5 && wordMatchesInBreadcrumb(stem, b)) score += 0.35
    }
  }

  return score
}

const MIN_SUGGESTION_SCORE = 7

/** Drop suggestions that contradict detected product intent or score too low. */
export function isCategorySuggestionViable(
  text: string,
  breadcrumb: string,
  minScore = MIN_SUGGESTION_SCORE
): boolean {
  const score = scoreProductTextAgainstBreadcrumb(text, breadcrumb)
  if (score < minScore) return false
  const intent = activeIntentForText(normalizeText(text.trim()))
  if (!intent) return true
  const b = normalizeText(breadcrumb)
  for (const rx of intent.penalize) {
    if (rx.test(b) && score < minScore + 12) return false
  }
  return true
}

/**
 * Suggest leaf categories from title + description using intent-aware scoring.
 * Returns nothing when confidence is too low (no arbitrary filler categories).
 * Soft rescue may pass a lower `minScore` — never use that for auto-apply.
 */
export function suggestLeafCategoriesFromProductText(
  title: string,
  description: string,
  leafPaths: LeafPath[],
  limit = 3,
  options?: { minScore?: number }
): LeafPath[] {
  const text = `${title} ${description}`.trim()
  if (text.length < 2) return []
  const floor = options?.minScore ?? MIN_SUGGESTION_SCORE

  const scored = leafPaths
    .map((lp) => ({
      lp,
      s: scoreProductTextAgainstBreadcrumb(text, lp.breadcrumb),
    }))
    .filter(({ s }) => s >= floor)
    .sort((a, b) => b.s - a.s)

  if (scored.length === 0) return []

  const top = scored[0]!.s
  const relativeFloor = top * 0.5

  const picked: LeafPath[] = []
  const seen = new Set<string>()
  for (const { lp, s } of scored) {
    if (picked.length >= limit) break
    if (picked.length > 0 && s < relativeFloor) break
    if (seen.has(lp.leafId)) continue
    seen.add(lp.leafId)
    picked.push(lp)
  }

  return picked
}
