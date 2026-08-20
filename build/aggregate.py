import csv, json, re, collections
csv.field_size_limit(10**9)

PLACES = {
 "egypt":("Egypt",26.8,30.8),"nubia":("Nubia (Sudan)",21.5,31.0),"sudan":("Nubia (Sudan)",21.5,31.0),
 "united states":("United States",39.5,-98.0),"america":("United States",39.5,-98.0),"american":("United States",39.5,-98.0),
 "iran":("Iran (Persia)",32.4,53.7),"persian":("Iran (Persia)",32.4,53.7),"sasanian":("Iran (Persia)",32.4,53.7),"achaemenid":("Iran (Persia)",32.4,53.7),"iranian":("Iran (Persia)",32.4,53.7),"elamite":("Iran (Persia)",32.4,53.7),"parthian":("Iran (Persia)",32.4,53.7),"qajar":("Iran (Persia)",32.4,53.7),"safavid":("Iran (Persia)",32.4,53.7),
 "peru":("Peru",-9.2,-75.0),"peruvian":("Peru",-9.2,-75.0),"moche":("Peru",-8.1,-79.0),"paracas":("Peru",-13.8,-76.2),"nasca":("Peru",-14.8,-74.9),"nazca":("Peru",-14.8,-74.9),"chimú":("Peru",-8.1,-79.0),"chimu":("Peru",-8.1,-79.0),"vicús":("Peru",-5.2,-80.6),"vicus":("Peru",-5.2,-80.6),"inca":("Peru",-13.5,-72.0),"wari":("Peru",-13.0,-74.2),"chancay":("Peru",-11.6,-77.3),"lambayeque":("Peru",-6.7,-79.9),"sicán":("Peru",-6.7,-79.9),"cupisnique":("Peru",-7.9,-79.3),"recuay":("Peru",-9.7,-77.5),"tiwanaku":("Bolivia",-16.6,-68.7),
 "france":("France",46.6,2.4),"french":("France",46.6,2.4),"frankish":("France",48.8,2.3),"alsatian":("France",48.3,7.5),"carolingian":("France",48.8,2.3),"merovingian":("France",48.8,2.3),"burgundian":("France",47.0,4.8),
 "mexico":("Mexico",21.0,-100.0),"mexican":("Mexico",21.0,-100.0),"aztec":("Mexico",19.4,-99.1),"maya":("Mexico/Guatemala (Maya)",17.2,-89.6),"olmec":("Mexico",18.0,-94.5),"mixtec":("Mexico",17.1,-97.7),"zapotec":("Mexico",17.0,-96.7),"teotihuacan":("Mexico",19.7,-98.8),"veracruz":("Mexico",19.4,-96.4),"huastec":("Mexico",21.5,-98.5),"toltec":("Mexico",20.1,-99.3),"colima":("Mexico",19.1,-104.0),"jalisco":("Mexico",20.6,-103.6),"nayarit":("Mexico",21.8,-105.2),
 "india":("India",22.4,79.0),"indian":("India",22.4,79.0),
 "indonesia":("Indonesia (Java/Bali)",-7.5,110.0),"javanese":("Indonesia (Java/Bali)",-7.5,110.0),"balinese":("Indonesia (Java/Bali)",-8.4,115.2),
 "england":("Britain",52.6,-1.5),"british":("Britain",52.6,-1.5),"united kingdom":("Britain",52.6,-1.5),"scottish":("Britain",56.5,-4.0),"welsh":("Britain",52.3,-3.7),"great britain":("Britain",52.6,-1.5),
 "china":("China",34.5,110.0),"chinese":("China",34.5,110.0),"tibet":("Tibet",31.5,88.0),"tibetan":("Tibet",31.5,88.0),
 "turkey":("Turkey (Anatolia)",39.0,35.0),"turkish":("Turkey (Anatolia)",39.0,35.0),"anatolia":("Turkey (Anatolia)",39.0,35.0),"hittite":("Turkey (Anatolia)",39.9,34.6),"byzantine":("Byzantium",41.0,28.9),"ottoman":("Turkey (Anatolia)",39.0,35.0),"east greek":("Turkey (Anatolia)",38.4,27.1),"east greek/sardis":("Turkey (Anatolia)",38.5,28.0),"old assyrian trading colony":("Turkey (Anatolia)",39.0,35.5),"phrygian":("Turkey (Anatolia)",39.7,31.8),"lydian":("Turkey (Anatolia)",38.5,28.0),"urartian":("Turkey (Anatolia)",38.5,43.3),
 "papua new guinea":("Papua New Guinea",-6.0,144.0),"asmat":("Papua New Guinea",-5.5,138.4),"kwoma":("Papua New Guinea",-4.2,142.7),"abelam":("Papua New Guinea",-3.7,143.0),"iatmul":("Papua New Guinea",-4.2,143.0),
 "germany":("Germany",51.0,10.3),"german":("Germany",51.0,10.3),
 "nigeria":("Nigeria",9.0,8.0),"yoruba":("Nigeria",7.8,4.5),"edo":("Nigeria (Benin Kingdom)",6.3,5.6),"igbo":("Nigeria",6.0,7.0),"benin kingdom":("Nigeria (Benin Kingdom)",6.3,5.6),
 "italy":("Italy",43.0,12.5),"italian":("Italy",43.0,12.5),"roman":("Italy (Rome)",41.9,12.5),"etruscan":("Italy (Etruria)",42.5,11.5),"italic":("Italy",42.0,13.0),"faliscan":("Italy",42.2,12.4),"south italian":("Italy",40.5,16.5),"sicilian":("Italy",37.5,14.0),"neapolitan":("Italy",40.8,14.3),"venetian":("Italy",45.4,12.3),"florentine":("Italy",43.8,11.3),"roman or byzantine":("Italy (Rome)",41.9,12.5),"langobardic":("Italy",45.0,10.0),"ostrogothic":("Italy",45.0,11.0),
 "democratic republic of the congo":("DR Congo",-2.9,23.6),"kongo":("DR Congo",-5.3,14.0),"luba":("DR Congo",-8.0,26.0),"songye":("DR Congo",-5.5,24.0),"kuba":("DR Congo",-4.8,21.5),
 "syria":("Syria (Levant)",35.0,38.5),"syrian":("Syria (Levant)",35.0,38.5),"phoenician":("Syria (Levant)",34.3,35.7),"canaanite":("Syria (Levant)",33.0,35.3),"lebanon":("Syria (Levant)",33.9,35.9),
 "spain":("Spain",40.2,-3.6),"spanish":("Spain",40.2,-3.6),"catalan":("Spain",41.7,1.7),"iberian":("Spain",39.5,-2.5),
 "iraq":("Iraq (Mesopotamia)",33.0,43.7),"mesopotamia":("Iraq (Mesopotamia)",33.0,43.7),"assyrian":("Iraq (Mesopotamia)",36.3,43.2),"babylonian":("Iraq (Mesopotamia)",32.5,44.4),"sumerian":("Iraq (Mesopotamia)",31.0,46.1),"akkadian":("Iraq (Mesopotamia)",33.1,44.1),
 "canada":("Canada",54.0,-100.0),"inuit":("Arctic (Inuit)",66.0,-95.0),
 "mali":("Mali",14.5,-4.0),"dogon":("Mali",14.4,-3.4),"bamana":("Mali",13.0,-7.5),"djenné":("Mali",13.9,-4.6),
 "colombia":("Colombia",4.6,-74.0),"muisca":("Colombia",5.0,-74.0),"tairona":("Colombia",11.0,-73.8),"quimbaya":("Colombia",4.5,-75.7),"tolita":("Ecuador",1.2,-79.0),
 "côte d'ivoire":("Côte d'Ivoire",7.5,-5.5),"baule":("Côte d'Ivoire",7.8,-5.1),"dan":("Côte d'Ivoire",7.4,-8.0),"senufo":("Côte d'Ivoire",9.5,-5.6),"guro":("Côte d'Ivoire",7.5,-6.1),
 "japan":("Japan",36.5,138.5),"japanese":("Japan",36.5,138.5),
 "cameroon":("Cameroon",5.7,12.7),"bamileke":("Cameroon",5.4,10.3),"bamum":("Cameroon",5.7,10.9),
 "costa rica":("Costa Rica",9.9,-84.1),"guanacaste":("Costa Rica",10.4,-85.3),
 "morocco":("Morocco",31.8,-7.1),
 "uzbekistan":("Central Asia",41.4,64.6),"bactria-margiana archaeological complex":("Central Asia",38.5,63.0),"bactrian":("Central Asia",36.8,66.9),"sogdian":("Central Asia",39.7,67.0),"turkmenistan":("Central Asia",38.5,59.0),
 "bolivia":("Bolivia",-16.7,-64.7),"ecuador":("Ecuador",-1.4,-78.4),"ghana":("Ghana",7.9,-1.2),"asante":("Ghana",6.7,-1.6),"akan":("Ghana",6.5,-1.5),
 "saudi arabia":("Arabia",24.0,45.0),"yemen":("Arabia (Yemen)",15.5,47.5),"south arabian":("Arabia (Yemen)",15.5,47.5),
 "austria":("Austria",47.6,14.1),"austrian":("Austria",47.6,14.1),
 "republic of benin":("Benin (Fon)",9.5,2.3),"fon":("Benin (Fon)",7.2,2.1),
 "panama":("Panama",8.5,-80.1),"coclé":("Panama",8.4,-80.4),
 "guatemala":("Mexico/Guatemala (Maya)",15.6,-90.3),
 "netherlands":("Netherlands",52.2,5.3),"dutch":("Netherlands",52.2,5.3),"netherlandish":("Netherlands",52.2,5.3),"south netherlandish":("Belgium (Flanders)",50.8,4.4),
 "palestine":("Levant (Israel/Palestine)",31.8,35.2),"israel":("Levant (Israel/Palestine)",31.8,35.2),"israeli":("Levant (Israel/Palestine)",31.8,35.2),"jordan":("Levant (Israel/Palestine)",31.2,36.0),
 "burkina faso":("Burkina Faso",12.3,-1.6),"mossi":("Burkina Faso",12.4,-1.5),"bwa":("Burkina Faso",11.9,-3.2),
 "russia":("Russia",55.7,37.6),"russian":("Russia",55.7,37.6),
 "philippines":("Philippines",12.9,122.9),"philippine":("Philippines",12.9,122.9),
 "australia":("Australia",-25.0,134.0),"australian":("Australia",-25.0,134.0),"aboriginal australian":("Australia",-25.0,134.0),
 "algeria":("Algeria",28.0,2.6),"tunisia":("Tunisia (Carthage)",36.8,10.2),
 "czech republic":("Czechia (Bohemia)",49.8,15.5),"bohemian":("Czechia (Bohemia)",49.8,15.5),"czech":("Czechia (Bohemia)",49.8,15.5),"moravian":("Czechia (Bohemia)",49.2,16.6),
 "gabon":("Gabon",-0.6,11.6),"fang":("Gabon",1.5,11.5),"kota":("Gabon",0.5,13.0),
 "afghanistan":("Afghanistan",34.5,66.0),
 "solomon islands":("Solomon Islands",-9.6,160.2),"vanuatu":("Vanuatu",-16.6,168.2),"fiji":("Fiji",-17.8,178.0),"new caledonia":("New Caledonia",-21.3,165.5),"new zealand":("New Zealand (Māori)",-41.0,174.0),"maori":("New Zealand (Māori)",-41.0,174.0),"māori":("New Zealand (Māori)",-41.0,174.0),"hawai'i":("Hawai'i",20.8,-156.3),"hawaii":("Hawai'i",20.8,-156.3),"marquesas islands":("Marquesas",-9.8,-139.0),"caroline islands":("Micronesia",7.5,150.0),
 "thailand":("Thailand",15.8,101.0),"malaysia":("Malaysia",4.2,102.0),"myanmar":("Myanmar (Burma)",19.2,96.5),"burma":("Myanmar (Burma)",19.2,96.5),"cambodia":("Cambodia (Khmer)",13.4,103.9),"khmer":("Cambodia (Khmer)",13.4,103.9),"vietnam":("Vietnam",16.5,107.6),"laos":("Laos",18.0,103.0),
 "switzerland":("Switzerland",46.8,8.2),"swiss":("Switzerland",46.8,8.2),
 "greek":("Greece",38.5,23.5),"greece":("Greece",38.5,23.5),"minoan":("Greece (Crete)",35.2,24.9),"mycenaean":("Greece",37.7,22.8),"attic":("Greece (Attica)",38.0,23.7),"corinthian":("Greece",37.9,22.9),"cycladic":("Greece (Cyclades)",37.1,25.2),"helladic":("Greece",38.0,23.0),"laconian":("Greece",37.1,22.4),"boeotian":("Greece",38.4,23.1),"rhodian":("Greece (Rhodes)",36.4,28.2),
 "cypriot":("Cyprus",35.1,33.2),"cyprus":("Cyprus",35.1,33.2),
 "coptic":("Egypt",26.8,30.8),"egyptian":("Egypt",26.8,30.8),"ptolemaic":("Egypt",31.2,29.9),
 "korea":("Korea",36.5,127.9),"korean":("Korea",36.5,127.9),
 "pakistan":("Pakistan (Gandhara/Indus)",33.0,71.5),"gandhara":("Pakistan (Gandhara/Indus)",33.7,72.8),"indus":("Pakistan (Gandhara/Indus)",27.3,68.1),
 "nepal":("Nepal",27.7,85.3),"nepalese":("Nepal",27.7,85.3),"sri lanka":("Sri Lanka",7.5,80.7),
 "flemish":("Belgium (Flanders)",50.8,4.4),"belgian":("Belgium (Flanders)",50.6,4.5),"belgium":("Belgium (Flanders)",50.6,4.5),
 "irish":("Ireland",53.2,-7.7),"ireland":("Ireland",53.2,-7.7),
 "denmark":("Scandinavia",56.0,10.0),"danish":("Scandinavia",56.0,10.0),"swedish":("Scandinavia",60.0,15.0),"sweden":("Scandinavia",60.0,15.0),"norwegian":("Scandinavia",61.0,9.0),"norway":("Scandinavia",61.0,9.0),"viking":("Scandinavia",59.0,11.0),"finnish":("Scandinavia",63.0,26.0),
 "poland":("Poland",52.0,19.0),"polish":("Poland",52.0,19.0),
 "hungary":("Hungary",47.0,19.5),"hungarian":("Hungary",47.0,19.5),
 "portugal":("Portugal",39.6,-8.0),"portuguese":("Portugal",39.6,-8.0),
 "european":("Europe (unspecified)",48.0,10.0),
 "ethiopia":("Ethiopia",9.0,39.0),"ethiopian":("Ethiopia",9.0,39.0),"madagascar":("Madagascar",-19.0,47.0),"tanzania":("East Africa",-6.0,35.0),"kenya":("East Africa",0.0,37.5),"south africa":("Southern Africa",-29.0,25.0),"zimbabwe":("Southern Africa",-19.0,30.0),"angola":("Angola (Chokwe)",-11.5,17.5),"chokwe":("Angola (Chokwe)",-11.0,20.0),"senegal":("Senegal/Gambia",14.5,-14.5),"sierra leone":("Sierra Leone",8.5,-11.8),"liberia":("Liberia",6.5,-9.5),"guinea":("Guinea",10.4,-11.0),"baga":("Guinea",10.5,-14.4),"gambia":("Senegal/Gambia",13.4,-15.3),"togo":("Togo",8.6,1.0),"niger":("Niger",17.0,8.0),"chad":("Chad",15.0,19.0),"central african republic":("Central Africa",6.6,20.9),"republic of the congo":("DR Congo",-1.0,15.5),"equatorial guinea":("Gabon",1.6,10.4),
 "native american":("North America (Native)",40.0,-105.0),"plains":("North America (Native)",44.0,-102.0),"navajo":("North America (Native)",36.1,-109.2),"diné":("North America (Native)",36.1,-109.2),"lakota":("North America (Native)",44.0,-102.0),"cherokee":("North America (Native)",35.5,-83.5),"haida":("Pacific Northwest (Native)",53.0,-132.0),"tlingit":("Pacific Northwest (Native)",58.0,-135.0),"brazil":("Brazil (Amazonia)",-10.0,-55.0),"argentina":("Argentina",-34.0,-64.0),"chile":("Chile",-33.4,-70.7),"venezuela":("Venezuela",8.0,-66.0),"cuba":("Caribbean",21.5,-79.0),"dominican republic":("Caribbean",19.0,-70.7),"haiti":("Caribbean",19.0,-72.4),"jamaica":("Caribbean",18.1,-77.3),"taino":("Caribbean",19.0,-71.0),"taíno":("Caribbean",19.0,-71.0),
 "ukraine":("Ukraine",49.0,32.0),"romania":("Romania",46.0,25.0),"bulgaria":("Bulgaria",42.7,25.5),"serbia":("Balkans",44.0,21.0),"croatia":("Balkans",45.2,16.4),"greece or bulgaria":("Bulgaria",42.7,25.5),"thracian":("Bulgaria",42.2,24.7),"scythian":("Ukraine (Scythia)",47.5,35.0),"sarmatian":("Ukraine (Scythia)",48.0,40.0),
 "mongolia":("Mongolia",46.9,103.8),"mongol":("Mongolia",46.9,103.8),"kazakhstan":("Central Asia",48.0,67.0),
}
PREFIX_STRIP = re.compile(r'^(probably|possibly|likely|attributed to|present-day|northern|southern|eastern|western|central|north|south|east|west|made in|ancient|the)\s+', re.I)

def resolve(raw):
    if not raw: return None
    s = raw.split('|')[0].split(';')[0].strip()
    s = re.sub(r'\(.*?\)', '', s).strip()
    s = re.split(r'\s+or\s+|,', s)[0].strip()
    for _ in range(3):
        s2 = PREFIX_STRIP.sub('', s).strip()
        if s2 == s: break
        s = s2
    s = s.rstrip('?').strip().lower()
    if not s: return None
    if s in PLACES: return PLACES[s]
    s1 = re.sub(r'\s+(peoples?|people|culture|artist|tribe)$','',s).strip()
    if s1 in PLACES: return PLACES[s1]
    return None


# --- sub-material taxonomy: (category, key, label, regex) ---
SUBMATS = [
 ("stone","limestone","Limestone", r"limestone"),
 ("stone","marble","Marble", r"marble"),
 ("stone","granite","Granite", r"granite|granodiorite"),
 ("stone","basalt","Basalt / diorite", r"basalt|diorite"),
 ("stone","alabaster","Alabaster (calcite)", r"alabaster|travertine"),
 ("stone","sandstone","Sandstone / quartzite", r"sandstone|quartzite"),
 ("stone","steatite","Steatite (soapstone)", r"steatite|soapstone|chlorite"),
 ("stone","serpentine","Serpentine", r"serpentine"),
 ("stone","schist","Schist / greywacke / slate", r"schist|greywacke|gneiss|slate"),
 ("stone","jade","Jade", r"jade|jadeite|nephrite"),
 ("stone","obsidian","Obsidian", r"obsidian"),
 ("stone","flint","Flint / chert", r"flint|chert"),
 ("stone","quartz","Rock crystal / quartz", r"rock crystal|quartz"),
 ("stone","carnelian","Carnelian / agate / jasper", r"carnelian|agate|chalcedony|onyx|jasper|sard"),
 ("stone","lapis","Lapis lazuli", r"lapis"),
 ("stone","turquoise","Turquoise", r"turquoise"),
 ("stone","porphyry","Porphyry", r"porphyry"),
 ("stone","gems","Gems & pearls", r"amethyst|emerald|sapphire|ruby|diamond|garnet|beryl|topaz|pearl"),
 ("stone","stone_other","Other / unspecified stone", r"stone|calcite|gypsum|marl|tuff|breccia"),
 ("metal","gold","Gold", r"gold"),
 ("metal","electrum","Electrum", r"electrum"),
 ("metal","silver","Silver", r"silver"),
 ("metal","bronze","Bronze", r"bronze"),
 ("metal","copper","Copper", r"copper"),
 ("metal","brass","Brass", r"brass"),
 ("metal","iron","Iron / steel", r"iron|steel"),
 ("metal","lead","Lead / tin / pewter", r"lead|tin|pewter"),
 ("metal","metal_other","Other / unspecified metal", r"metal|platinum"),
 ("perish","papyrus","Papyrus", r"papyrus"),
 ("perish","parchment","Parchment / vellum", r"parchment|vellum"),
 ("perish","paper","Works on paper (prints, drawings, photos)", r"paper|etching|engraving|lithograph|woodcut|woodblock|print|aquatint|mezzotint|drypoint|photograph|albumen|daguerreotype|gelatin|graphite|chalk|charcoal|crayon|pastel|ink|gouache|watercolor|watercolour|monotype|screenprint",),
 ("perish","canvas","Oil on canvas", r"canvas"),
 ("perish","silk","Silk", r"silk"),
 ("perish","wool","Wool / camelid fiber", r"wool|felt|alpaca|camelid|vicuna|vicuña"),
 ("perish","cotton","Cotton", r"cotton"),
 ("perish","linen","Linen (flax)", r"linen|flax"),
 ("perish","fiber","Plant fiber & cordage", r"fib(er|re)|raffia|hemp|reed|straw|palm|bark|cane|grass|gourd|basketr|wicker|rattan|bast|coir|cord(age)?|rope|twine|sedge|rush(es)?|jute|sisal|pandanus|barkcloth|tapa"),
 ("perish","textile","Textile (unspecified weave)", r"textile|cloth|velvet|satin|lace|embroider|tapestry|damask|brocade|ribbon"),
 ("perish","wood","Wood / bamboo", r"wood|bamboo"),
 ("perish","lacquer","Lacquer", r"lacquer"),
 ("perish","leather","Leather / hide / fur", r"leather|hide|fur|buckskin|rawhide|parfleche"),
 ("perish","ivory","Ivory", r"ivory"),
 ("perish","bone","Bone / horn / tortoiseshell", r"bone|horn|antler|tortoiseshell|tortoise shell"),
 ("perish","shell","Shell", r"shell"),
 ("perish","feather","Feathers", r"feather"),
 ("perish","hair","Hair", r"hair"),
 ("other","terracotta","Terracotta / earthenware", r"terracotta|terra cotta|earthenware"),
 ("other","stoneware","Stoneware", r"stoneware"),
 ("other","porcelain","Porcelain", r"porcelain"),
 ("other","faience","Faience", r"faience"),
 ("other","glass","Glass", r"glass"),
 ("other","enamel","Enamel", r"enamel"),
 ("other","plaster","Plaster / stucco / fresco", r"plaster|stucco|fresco|cartonnage"),
 ("other","ceramic","Ceramic (unspecified) / glazed", r"ceramic|pottery|clay|glaze"),
 ("other","unspecified","Unspecified / mixed", r"$^"),
]
SUBC = [(i, cat, re.compile(rx if isinstance(rx,str) else rx[0])) for i,(cat,key,label,rx) in enumerate(SUBMATS)]
CATS = ["stone","metal","perish","other"]
UNSPEC = len(SUBMATS)-1

def matcat(medium):
    if not medium: return "other", UNSPEC
    m = medium.lower()
    m = re.sub(r"gilt|gilded|gilding", " ", m)
    best, bestpos = None, 10**9
    for i, cat, rx in SUBC:
        mm = rx.search(m)
        if mm and mm.start() < bestpos:
            best, bestpos = (cat, i), mm.start()
    return best if best else ("other", UNSPEC)

ERAS = list(range(-3000, 2000, 250))  # 20 buckets
def era_idx(b, e):
    try: b = int(b); e = int(e)
    except: return None
    if b == 0 and e == 0: return None
    mid = (b + e) / 2
    if mid < -3000: mid = -3000
    if mid > 1999: mid = 1999
    return int((mid + 3000) // 250)

placelist, pidx = [], {}
def pid(p):
    if p[0] not in pidx:
        pidx[p[0]] = len(placelist); placelist.append(p)
    return pidx[p[0]]

Z = lambda: [[0]*7 for _ in range(20)]
data = collections.defaultdict(Z)
topobj = collections.defaultdict(collections.Counter)
topinstr = collections.defaultdict(collections.Counter)
topcul = collections.defaultdict(collections.Counter)
gtot = [[0]*7 for _ in range(20)]
subd = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
gsub = collections.defaultdict(collections.Counter)
n = resolved = dated = 0

with open('MetObjects.csv', encoding='utf-8-sig', newline='') as f:
    for row in csv.DictReader(f):
        n += 1
        p = resolve(row['Country']) or resolve(row['Culture']) or resolve(row['Artist Nationality'])
        if not p: continue
        resolved += 1
        ei = era_idx(row['Object Begin Date'], row['Object End Date'])
        if ei is None: continue
        dated += 1
        i = pid(p); cat, sid = matcat(row['Medium']); ci = 1 + CATS.index(cat)
        subd[i][ei][sid] += 1; gsub[ei][sid] += 1
        cell = data[i][ei]; cell[0] += 1; cell[ci] += 1
        gtot[ei][0] += 1; gtot[ei][ci] += 1
        if row['Department'] in ('Drawings and Prints','Photographs'):
            cell[6] += 1; gtot[ei][6] += 1
        isin = row['Department'] == 'Musical Instruments'
        if isin:
            cell[5] += 1; gtot[ei][5] += 1
            if row['Object Name']: topinstr[i][row['Object Name'].strip().lower()] += 1
        if row['Object Name']: topobj[i][row['Object Name'].strip().split('|')[0].lower()] += 1
        cul = (row['Culture'] or '').split('|')[0].split(',')[0].strip()
        if cul: topcul[i][cul] += 1

out = {
 "meta": {"rows": n, "resolved": resolved, "dated": dated, "eras": ERAS, "cats": ["total"]+CATS+["instruments","worksOnPaper"], "submats": [{"cat":c,"key":k,"label":l} for c,k,l,_ in SUBMATS]},
 "places": [{"name": nm, "lat": la, "lon": lo,
             "total": sum(c[0] for c in data[pidx[nm]]),
             "top": [f"{k} ({v})" for k,v in topobj[pidx[nm]].most_common(6)],
             "cultures": [k for k,_ in topcul[pidx[nm]].most_common(4)],
             "instr": [f"{k} ({v})" for k,v in topinstr[pidx[nm]].most_common(5)],
             "sub": {str(e): sorted(subd[pidx[nm]][e].items(), key=lambda kv:-kv[1]) for e in sorted(subd[pidx[nm]])},
             "counts": data[pidx[nm]]} for (nm,la,lo) in placelist],
 "global": gtot,
 "gsub": {str(e): sorted(gsub[e].items(), key=lambda kv:-kv[1]) for e in sorted(gsub)},
}
out["places"].sort(key=lambda p: -p["total"])
with open('aggregate.json','w') as f: json.dump(out, f)
print(f"rows={n} resolved={resolved} ({resolved/n:.0%}) dated={dated} places={len(placelist)}")
print("size:", __import__('os').path.getsize('aggregate.json'))
import itertools
print("top20:", [(p['name'], p['total']) for p in out['places'][:20]])
