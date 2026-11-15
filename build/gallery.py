#!/usr/bin/env python3
"""Build the held-out practice gallery (data-src/gallery.json).

Pulls open-access object records from the Cleveland Museum of Art, the Art Institute
of Chicago and (for thin regions only) the Minneapolis Institute of Art -- never the Met -- geocodes the stated place of making
with the gazetteer below, and picks a sample balanced over macro-region x 250-year
era the way the game's pool is (not the museums' raw distribution).

    python3 build/gallery.py              # build (uses cache; fetches what is missing)
    python3 build/gallery.py --no-check   # skip the image URL check
    python3 build/gallery.py --report     # also print unmatched place strings

Raw API responses and image-check results are cached outside the repo (CACHE).
Requests use a generic User-Agent and are rate limited per host.
"""
import collections
import datetime
import hashlib
import json
import os
import random
import re
import sys
import time
import unicodedata

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data-src', 'gallery.json')
CACHE = os.environ.get('GALLERY_CACHE', '/home/ryan-lagasse/.claude/jobs/29aa4f64/tmp/gallery-cache')
UA = {'User-Agent': 'study-tool-prototype/0.1'}

CELL_CAP = 8            # soft cap per (region, era) cell
TARGET_MAX = 700        # trim later-era caps until the total fits
MIN_MID_CAP = 4         # never trim a mid-era cell cap below this
MIN_MODERN_CAP = 6      # ... nor an era 18-19 cell cap below this (unless over MODERN_SHARE)
THIN_REGION = 45        # regions with <= this many objects at full caps are never trimmed
MODERN_SHARE = 0.35     # max share of objects in eras 18-19
PAPER_SHARE = 0.08      # max share of prints / drawings / photographs
MAX_SPAN = 300          # max (latest - earliest) in years

REGIONS = collections.OrderedDict([
    ('eas', 'East Asia'), ('sas', 'South Asia & Himalaya'), ('sea', 'Southeast Asia'),
    ('cas', 'Central Asia & steppe'), ('wan', 'West Asia'), ('egy', 'Egypt, Nubia & North Africa'),
    ('ssa', 'Sub-Saharan Africa'), ('eur_s', 'Southern Europe & Aegean'),
    ('eur_nw', 'Western & Northern Europe'), ('eur_e', 'Eastern Europe, Russia & Byzantium'),
    ('nam', 'North America'), ('mes', 'Mesoamerica & Caribbean'),
    ('and', 'Andes & South America'), ('oce', 'Oceania & Australia')])

# --------------------------------------------------------------------------- fetch
S = requests.Session()
S.headers.update(UA)
_last = {}


def _polite(host, gap):
    dt = time.time() - _last.get(host, 0)
    if dt < gap:
        time.sleep(gap - dt)
    _last[host] = time.time()


def cached(key, host, gap, fn):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, key + '.json')
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    for attempt in range(6):
        _polite(host, gap)
        try:
            r = fn()
            if r.status_code == 200:
                d = r.json()
                with open(p, 'w') as f:
                    json.dump(d, f)
                return d
            print('  http', r.status_code, key, file=sys.stderr)
            if r.status_code == 429:
                time.sleep(45)
        except Exception as e:  # noqa
            print('  err', e, key, file=sys.stderr)
        time.sleep(2 + 3 * attempt)
    raise RuntimeError('fetch failed: ' + key)


CMA_URL = 'https://openaccess-api.clevelandart.org/api/artworks/'
CMA_FIELDS = ('id,accession_number,title,creation_date,creation_date_earliest,creation_date_latest,'
              'culture,technique,type,department,url,images')
# Prints and Photography departments are skipped (works on paper are capped anyway).
CMA_DEPTS = ['African Art', 'Art of the Americas', 'Chinese Art', 'Egyptian and Ancient Near Eastern Art',
             'Greek and Roman Art', 'Indian and Southeast Asian Art', 'Islamic Art', 'Japanese Art', 'Korean Art',
             'Medieval Art', 'Oceania', 'Textiles', 'Decorative Art and Design', 'European Painting and Sculpture',
             'American Painting and Sculpture', 'Drawings', 'Modern European Painting and Sculpture']


def fetch_cma():
    out = []
    for dept in CMA_DEPTS:
        skip = 0
        while True:
            params = {'cc0': 1, 'has_image': 1, 'limit': 500, 'skip': skip, 'department': dept,
                      'fields': CMA_FIELDS}
            key = 'cma_%s_%05d' % (dept.replace(' ', '_').replace('&', 'and'), skip)
            d = cached(key, 'cma', 0.4, lambda: S.get(CMA_URL, params=params, timeout=180))
            out.extend(d['data'])
            skip += 500
            if skip >= d['info']['total'] or not d['data']:
                break
    return out


AIC_URL = 'https://api.artic.edu/api/v1/artworks/search'
AIC_FIELDS = ['id', 'title', 'place_of_origin', 'date_start', 'date_end', 'date_display', 'medium_display',
              'classification_title', 'artwork_type_title', 'department_title', 'image_id', 'style_title']
AIC_DEPTS = ['Arts of Asia', 'Textiles', 'Applied Arts of Europe', 'Arts of the Americas',
             'Arts of Greece, Rome, and Byzantium', 'Painting and Sculpture of Europe', 'Arts of Africa',
             'Modern Art', 'Architecture and Design']
AIC_SKIP_TYPES = ['Print', 'Photograph', 'Coin', 'Medals', 'Architectural Drawing', 'non-art', 'Miniature room']


def _aic_get(dept, a, b, page, limit):
    key = 'aic_%s_%d_%d_p%d_l%d' % (hashlib.md5(dept.encode()).hexdigest()[:6], a, b, page, limit)
    body = {'limit': limit, 'page': page, 'fields': AIC_FIELDS, 'sort': [{'id': 'asc'}],
            'query': {'bool': {
                'filter': [{'term': {'is_public_domain': True}}, {'exists': {'field': 'image_id'}},
                           {'term': {'department_title.keyword': dept}},
                           {'range': {'date_start': {'gte': a, 'lt': b}}}],
                'must_not': [{'terms': {'artwork_type_title.keyword': AIC_SKIP_TYPES}}]}}}
    # AIC allows ~60 anonymous requests/minute
    return cached(key, 'aic', 1.2, lambda: S.post(AIC_URL, json=body, timeout=120))


def _aic_range(dept, a, b, out):
    # search results are capped at 1000, so bisect the date range until each slice fits
    total = _aic_get(dept, a, b, 1, 1)['pagination']['total']
    if total == 0:
        return
    if total > 1000 and b - a > 1:
        m = (a + b) // 2
        _aic_range(dept, a, m, out)
        _aic_range(dept, m, b, out)
        return
    for page in range(1, min(10, (total + 99) // 100) + 1):
        out.extend(_aic_get(dept, a, b, page, 100)['data'])


def fetch_aic():
    out = []
    for dept in AIC_DEPTS:
        _aic_range(dept, -4000, 2030, out)
    return out


# Minneapolis Institute of Art: used only to thicken regions the first two sources are thin in
# (Africa, Oceania, Americas outside the US, Central & Southeast Asia). Metadata is CC0; only
# records whose rights_type is "Public Domain" and that have a valid image are requested.
MIA_URL = 'https://search.artsmia.org/'
MIA_QUERIES = (['continent:Africa', 'continent:Oceania', 'continent:Americas department:"Arts of the Americas"'] +
               ['country:"%s"' % c for c in (
                   'Mexico', 'Guatemala', 'Peru', 'Bolivia', 'Canada', 'Costa Rica', 'Colombia', 'Ecuador',
                   'Panama', 'Uzbekistan', 'Afghanistan', 'Turkmenistan', 'Mongolia', 'Kazakhstan', 'Indonesia',
                   'Philippines', 'Thailand', 'Cambodia', 'Vietnam', 'Myanmar')])


def fetch_mia():
    out = {}
    for q in MIA_QUERIES:
        full = q + ' image:valid rights_type:"Public Domain"'
        frm = 0
        while True:
            key = 'mia_%s_%05d' % (hashlib.md5(q.encode()).hexdigest()[:8], frm)
            d = cached(key, 'mia', 0.6,
                       lambda: S.get(MIA_URL + full, params={'size': 100, 'from': frm}, timeout=60))
            hits = d['hits']['hits']
            for h in hits:
                out[h['_source'].get('id')] = h['_source']
            frm += 100
            if not hits or frm >= min(d['hits']['total']['value'], 3000):
                break
    return list(out.values())


_CENT = r'(early|mid|middle|late|first half of the|second half of the|first half|second half)?\s*(\d{1,2})(?:st|nd|rd|th)'


def parse_dated(s):
    """Parse a free-text date ("c. 1890", "12th-15th century", "1820-40", "300-100 BCE") -> (y0, y1)."""
    if not s:
        return None
    t = s.lower().replace('\u2013', '-').replace('\u2014', '-').replace('/', '-')
    if re.search(r'\?|\bor\b|before|after|n\.d|undated|probably|possibly', t):
        return None
    bce = bool(re.search(r'b\.?c\.?e?\.?', t))
    mixed = bce and bool(re.search(r'\bc\.?e\.?\b|a\.?d\.?', re.sub(r'b\.?c\.?e?\.?', '', t)))
    if mixed:
        return None
    circa = bool(re.search(r'\bc\.|\bca\.|circa|about', t))
    out = None
    if 'centur' in t:
        cs = re.findall(_CENT, t)
        if not cs:
            return None
        spans = []
        for mod, n in cs:
            n = int(n)
            a, b = (n - 1) * 100, n * 100 - 1
            if bce:
                a, b = -n * 100, -(n - 1) * 100 - 1
            third = {'early': (0, 33), 'mid': (33, 66), 'middle': (33, 66), 'late': (66, 99),
                     'first half of the': (0, 49), 'first half': (0, 49),
                     'second half of the': (50, 99), 'second half': (50, 99)}.get(mod)
            if third:
                a, b = a + third[0], a + third[1]
            spans.append((a, b))
        out = (min(x[0] for x in spans), max(x[1] for x in spans))
    else:
        m = re.search(r'(\d{1,4})\s*-\s*(\d{1,4})', t)
        if m:
            a, b = m.group(1), m.group(2)
            if len(b) < len(a) and not bce:
                b = a[:len(a) - len(b)] + b
            out = (int(a), int(b))
        else:
            m = re.search(r'\b(\d{3,4})s\b', t)
            if m:
                out = (int(m.group(1)), int(m.group(1)) + 9)
            else:
                m = re.search(r'\b(\d{3,4})\b', t)
                if not m:
                    return None
                y = int(m.group(1))
                out = (y - 10, y + 10) if circa else (y, y)
        if bce:
            out = (-out[0], -out[1])
    if out[0] > out[1]:
        return None
    return out


# ----------------------------------------------------------------------- gazetteer
def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace('’', "'").replace('‘', "'")
    s = re.sub(r"[^a-z0-9']+", ' ', s)
    return ' ' + ' '.join(s.split()) + ' '


SIZE_R = {'s': 150, 'm': 300, 'x': 450, 'l': 600}

# name | lat,lon (populated / cultural centroid) | region | size | aliases
COUNTRIES_TXT = """
China|34,110|eas|l|chinese
Japan|35.5,136.5|eas|m|japanese
Korea|37,127.5|eas|s|south korea;north korea;korean peninsula;korean
Taiwan|24,121|eas|s|
Mongolia|47.9,106.9|cas|x|mongolian
India|23,79|sas|l|mughal india;british india;sultanate india
Pakistan|31,72.5|sas|m|
Bangladesh|23.8,90.3|sas|s|
Nepal|27.7,85.3|sas|s|nepalese
Sri Lanka|7.5,80.7|sas|s|ceylon
Bhutan|27.5,90.5|sas|s|
Afghanistan|34.5,67.5|cas|m|
Uzbekistan|40.3,66.5|cas|m|uzbek
Turkmenistan|38.3,59|cas|m|turkmen;turkoman
Kazakhstan|44.5,72|cas|l|
Tajikistan|38.6,69|cas|s|
Kyrgyzstan|41.5,74.5|cas|s|kyrgyz;kirghiz
Thailand|15,100.5|sea|m|siam;thai
Cambodia|12.5,104.5|sea|s|
Vietnam|17,106.5|sea|x|annam
Myanmar|21,96|sea|m|burma;burmese
Laos|18.5,103|sea|m|
Indonesia|-6,111|sea|l|
Philippines|13.5,122|sea|x|
Malaysia|4,102|sea|m|
Iran|33,53|wan|x|persia;persian
Iraq|33.3,44|wan|m|mesopotamia
Turkey|39,33|wan|x|anatolia
Syria|35,38|wan|m|
Lebanon|33.9,35.7|wan|s|phoenicia;phoenician
Israel/Palestine|31.8,35.1|wan|s|israel;palestine;judea;holy land
Jordan|31.3,36|wan|s|
Saudi Arabia|24,45|wan|l|arabia
Yemen|15.4,44.8|wan|m|south arabia
Oman|22.5,57.5|wan|m|
Armenia|40.2,44.6|wan|s|armenian
Azerbaijan|40.4,48|wan|s|
Cyprus|35,33.2|wan|s|cypriot
Egypt|27.5,31|egy|x|egyptian;ancient egypt
Sudan|17.5,32|egy|x|nubia;nubian
Tunisia|35.6,10|egy|s|
Algeria|36,3.5|egy|x|
Morocco|33,-6.5|egy|m|moroccan
Libya|32,15|egy|x|
Nigeria|8,7|ssa|m|
Ghana|7,-1.3|ssa|m|
Democratic Republic of the Congo|-4.5,22|ssa|l|democratic republic of congo;belgian congo;zaire
Republic of the Congo|-3,15|ssa|m|
Angola|-10.5,17|ssa|x|
Cameroon|5.5,11|ssa|m|
Gabon|-0.7,11.5|ssa|m|
Equatorial Guinea|1.6,10.4|ssa|s|
Cote d'Ivoire|7.3,-5.5|ssa|m|ivory coast
Mali|13.5,-6|ssa|x|
Burkina Faso|12,-1.7|ssa|m|
Sierra Leone|8.5,-12|ssa|s|
Liberia|6.5,-9.5|ssa|s|
Guinea|10.5,-11|ssa|m|
Guinea-Bissau|12,-15|ssa|s|guinea bissau
Senegal|14.5,-15.5|ssa|m|
Togo|8,1.1|ssa|s|
Benin|8,2.3|ssa|s|republic of benin;dahomey
Ethiopia|10.5,39|ssa|x|ethiopian
Kenya|-0.8,37.3|ssa|m|
Tanzania|-6.5,36|ssa|x|
Uganda|1,32.5|ssa|m|
Somalia|4,45.5|ssa|x|
South Africa|-29,28.5|ssa|x|
Zimbabwe|-19,30.5|ssa|m|
Zambia|-14,28|ssa|x|
Mozambique|-17,36|ssa|x|
Madagascar|-19,47|ssa|x|
Central African Republic|6,20|ssa|x|
Lesotho|-29.5,28.2|ssa|s|
Niger|14,6|ssa|x|
Eswatini|-26.5,31.5|ssa|s|swaziland
Chad|12,17|ssa|x|
Rwanda|-2,30|ssa|s|
Italy|42.5,12.5|eur_s|m|italian
Greece|38.5,23|eur_s|m|ancient greece
Spain|40,-3.7|eur_s|m|spanish
Portugal|39.5,-8.5|eur_s|s|portuguese
France|47,2.5|eur_nw|m|french
Germany|50.5,10|eur_nw|m|german
Netherlands|52.2,5.2|eur_nw|s|holland;dutch;north netherlands;northern netherlands
Belgium|50.9,4.2|eur_nw|s|flanders;flemish;south netherlands;southern netherlands
United Kingdom|52.5,-1.5|eur_nw|m|england;great britain;britain;english;british
Ireland|53.3,-7.7|eur_nw|s|irish
Denmark|55.7,10.5|eur_nw|s|danish
Sweden|59,15.5|eur_nw|x|swedish
Norway|60.5,9|eur_nw|x|norwegian
Finland|61.5,25|eur_nw|x|
Switzerland|46.9,8|eur_nw|s|swiss
Austria|47.8,14.5|eur_nw|s|austrian
Russia|55.7,37.6|eur_e|l|russian
Ukraine|49.5,31|eur_e|x|
Poland|52,19.5|eur_e|m|polish
Czech Republic|49.9,15|eur_e|s|bohemia;bohemian;czechoslovakia;czechia;moravia
Hungary|47.2,19.3|eur_e|s|hungarian
Romania|45.8,25|eur_e|m|
Bulgaria|42.7,25.3|eur_e|s|thrace
Serbia|44,20.8|eur_e|s|
Croatia|45.2,16|eur_e|s|dalmatia
United States|40,-80|nam|l|america;american;united states of america;usa
Canada|45.5,-75|nam|l|canadian
Mexico|19.5,-99|mes|x|mexican
Guatemala|15,-90.5|mes|s|
Honduras|14.8,-87.5|mes|s|
Belize|17.2,-88.7|mes|s|
El Salvador|13.7,-89|mes|s|
Nicaragua|12.5,-86|mes|s|
Costa Rica|10,-84.2|mes|s|
Panama|8.5,-80.3|mes|s|republic of panama
Cuba|22,-80|mes|m|
Dominican Republic|18.8,-70.2|mes|s|
Haiti|18.9,-72.5|mes|s|
Puerto Rico|18.2,-66.4|mes|s|
Jamaica|18.1,-77.3|mes|s|
Peru|-11,-76|and|x|peruvian
Colombia|5,-74.5|and|x|
Ecuador|-1.5,-78.7|and|m|
Bolivia|-17,-66.5|and|x|
Chile|-33,-71|and|x|
Argentina|-31,-64|and|l|
Brazil|-20,-45|and|l|
Venezuela|9,-67|and|x|
Australia|-33,147|oce|l|aboriginal
New Zealand|-39.5,175.5|oce|m|maori;aotearoa
Papua New Guinea|-6,145|oce|x|new guinea
Solomon Islands|-9,160|oce|m|
Vanuatu|-16.5,168|oce|m|new hebrides
Fiji|-17.8,178|oce|s|fiji islands
Tonga|-21.1,-175.2|oce|s|tonga islands
Samoa|-13.8,-172|oce|s|
New Caledonia|-21.3,165.5|oce|s|
French Polynesia|-17.6,-149.5|oce|x|tahiti;society islands
Cook Islands|-21.2,-159.8|oce|s|
"""

# kind | display | lat,lon | country | aliases | options (reg=xx, r=NNN)
#   S site (r 75) / C city (r 75) / R sub-national region or homeland ("culture" precision, r 200)
#   W weak: a culture / people / dynasty whose heartland is used only when the record
#     names no more specific place; ignored if the record's stated country differs
#     (unless a V variant line gives the heartland inside that country).
#   E empire-wide label: never trusted on its own, only through V variants.
PLACES_TXT = """
# ---------------- East Asia
C|Jingdezhen|29.29,117.2|China|jingdezhen;jingdezhen kilns;ching te chen
C|Suzhou|31.3,120.6|China|suzhou;soochow
C|Hangzhou|30.25,120.17|China|hangzhou
C|Nanjing|32.06,118.8|China|nanjing;nanking
C|Beijing|39.9,116.4|China|beijing;peking;beijing palace workshops
C|Xi'an|34.27,108.95|China|xi'an;xian;chang'an
C|Luoyang|34.62,112.45|China|luoyang;jincun;longmen
S|Anyang|36.1,114.35|China|anyang
C|Yixing|31.36,119.82|China|yixing
C|Dehua|25.49,118.24|China|dehua
C|Longquan|28.08,119.14|China|longquan;longquan region
C|Changsha|28.2,112.97|China|changsha
C|Guangzhou|23.13,113.26|China|guangzhou
C|Shanghai|31.23,121.47|China|shanghai
C|Yangzhou|32.39,119.42|China|yangzhou
C|Fuzhou|26.07,119.3|China|fuzhou
C|Jiaxing|30.75,120.75|China|jiaxing
S|Dunhuang|40.14,94.66|China|dunhuang|reg=cas
C|Datong|40.08,113.3|China|datong;yungang
S|Quyang|38.62,114.7|China|quyang
S|Xiangtangshan|36.53,114.2|China|xiangtangshan;xiangtangshan caves;northern xiangtangshan caves
S|Yuxian|34.16,113.47|China|yuxian;juntai;junyao
S|Tongchuan|34.9,108.95|China|tongchuan;huangbaozhen;yaozhou
S|Jizhou|27.1,114.98|China|jizhou
R|Jiangxi|27.6,115.8|China|jiangxi;jiangxi province
R|Zhejiang|29.2,120.2|China|zhejiang;zhejiang province
R|Jiangsu|32.5,119.8|China|jiangsu;jiangsu province
R|Henan|34.3,113.5|China|henan;henan province
R|Hebei|38.2,115|China|hebei;hebei province
R|Shaanxi|34.5,108.9|China|shaanxi;shaanxi province
R|Shanxi|37.6,112.4|China|shanxi;shanxi province
R|Fujian|26,118.2|China|fujian;fujian province
R|Guangdong|23.2,113.4|China|guangdong;guangdong province
R|Hunan|27.8,112|China|hunan;hunan province
R|Hubei|30.8,112.5|China|hubei;hubei province
R|Sichuan|30.5,104|China|sichuan;sichuan province|r=300
R|Gansu|36,104|China|gansu;gansu province|r=300
R|Shandong|36.3,118|China|shandong;shandong province
R|Anhui|31.8,117.3|China|anhui;anhui province
R|Yunnan|25,102.7|China|yunnan;yunnan province|r=300
R|Ordos|39.6,109.8|China|ordos;ordos region|reg=cas
R|Inner Mongolia|41,111.7|China|inner mongolia|reg=cas;r=400
R|Xinjiang|41.7,82.9|China|xinjiang;chinese turkestan;kucha;kizil|reg=cas;r=500
S|Khotan|37.1,79.9|China|khotan|reg=cas
S|Turfan|42.95,89.18|China|turfan;turpan|reg=cas
R|Northern China|37.5,113.5|China|northern china;north china|r=400
R|Southern China|26,113|China|southern china;south china|r=450
R|Southeast China|27,118|China|southeast china;southeastern china|r=350
R|Northeast China|42.5,124|China|northeast china;northeastern china;manchuria|r=350
R|Northwest China|36,104|China|northwest china;northwestern china|r=450
R|Tibet|29.65,91.1|China|tibet;tibetan;central tibet;lhasa|reg=sas;r=400
R|Western Tibet|31.5,80|China|western tibet;west tibet;guge|reg=sas;r=300
R|Eastern Tibet|31.5,97.5|China|eastern tibet;kham|reg=sas;r=300
R|Southern Tibet|28.9,89|China|southern tibet|reg=sas;r=300
S|Densatil Monastery|29.3,91.9|China|densatil;densatil monastery|reg=sas
S|Ngor Monastery|29.1,88.9|China|ngor;ngor monastery|reg=sas
S|Derge|31.8,98.6|China|derge;derge school|reg=sas
C|Kyoto|35.01,135.77|Japan|kyoto
C|Tokyo|35.68,139.76|Japan|tokyo;ueno
C|Nara|34.68,135.8|Japan|nara
C|Osaka|34.69,135.5|Japan|osaka
C|Arita|33.19,129.87|Japan|arita;hizen;imari;hizen province
C|Seto|35.22,137.08|Japan|seto
R|Mino|35.4,137.1|Japan|mino;mino province
C|Kutani|36.3,136.3|Japan|kutani;kaga
C|Kagoshima|31.6,130.55|Japan|satsuma;kagoshima
C|Bizen|34.74,134.19|Japan|bizen
C|Shigaraki|34.88,136.06|Japan|shigaraki
C|Karatsu|33.45,129.97|Japan|karatsu
R|Okinawa|26.3,127.8|Japan|okinawa;ryukyu;ryukyu islands
R|Hokkaido|43.2,142.5|Japan|hokkaido;ainu
C|Seoul|37.57,126.98|Korea|seoul
C|Gyeongju|35.85,129.22|Korea|gyeongju;kyongju
C|Pyongyang|39.02,125.75|Korea|pyongyang;lolang;lelang
# ---------------- South Asia & Himalaya
R|Rajasthan|26.6,74.5|India|rajasthan;rajputana
R|Gujarat|22.7,71.8|India|gujarat
R|Kutch|23.3,69.7|India|kutch;kachchh
R|Bihar|25.4,85.5|India|bihar;bihar state
R|Bengal|23.3,88.2|India|bengal;west bengal
R|Uttar Pradesh|26.8,80.9|India|uttar pradesh
R|Madhya Pradesh|23.5,78.5|India|madhya pradesh
R|Tamil Nadu|10.9,78.7|India|tamil nadu
R|Karnataka|14.5,76|India|karnataka
R|Andhra Pradesh|16,80|India|andhra pradesh
R|Kerala|10.3,76.4|India|kerala
R|Odisha|20.4,85.3|India|odisha;orissa
R|Pahari hills|32.1,76.5|India|pahari;pahari kingdoms;pahari region;pahari hills;punjab hills;himachal pradesh
R|Punjab|31,75.3|India|punjab
R|Kashmir|34.1,74.8|India|kashmir;jammu and kashmir;srinagar;harwan
R|Ladakh|34.15,77.58|India|ladakh
R|Deccan|17.5,77|India|deccan;north east deccan;northern deccan|r=350
R|Malwa|23.2,76|India|malwa
R|Mewar|24.58,73.7|India|mewar;udaipur;kingdom of mewar
R|Marwar|26.28,73.02|India|marwar;jodhpur
C|Jaipur|26.92,75.8|India|jaipur;amber;kingdom of jaipur;kingdom of amber
C|Bikaner|28.02,73.3|India|bikaner;kingdom of bikaner
C|Kota|25.18,75.83|India|kota;kotah;kingdom of kota
C|Bundi|25.44,75.64|India|bundi;kingdom of bundi
C|Kishangarh|26.57,74.87|India|kishangarh;kingdom of kishangarh
C|Nathdwara|24.93,73.82|India|nathdwara
C|Sirohi|24.88,72.86|India|sirohi
C|Basohli|32.5,75.82|India|basohli;kingdom of basohli
C|Kangra|32.1,76.27|India|kangra;kingdom of kangra;guler
C|Chamba|32.55,76.13|India|chamba
C|Delhi|28.65,77.22|India|delhi
C|Agra|27.18,78|India|agra;fatehpur sikri
C|Lucknow|26.85,80.95|India|lucknow;avadh;oudh;awadh
C|Murshidabad|24.18,88.27|India|murshidabad
C|Kolkata|22.57,88.36|India|kolkata;calcutta;kalighat
C|Patna|25.6,85.1|India|patna
C|Varanasi|25.32,83|India|varanasi;benares;sarnath
C|Allahabad|25.44,81.85|India|allahabad
C|Mathura|27.49,77.67|India|mathura
S|Bharhut|24.45,80.87|India|bharhut
S|Sanchi|23.48,77.74|India|sanchi
S|Amaravati|16.57,80.36|India|amaravati
S|Nagarjunakonda|16.52,79.24|India|nagarjunakonda
S|Khajuraho|24.85,79.92|India|khajuraho
C|Hyderabad|17.38,78.48|India|hyderabad;golconda
C|Bijapur|16.83,75.71|India|bijapur
C|Bidar|17.91,77.52|India|bidar
C|Aurangabad|19.88,75.34|India|aurangabad
C|Mysore|12.3,76.65|India|mysore
C|Madurai|9.92,78.12|India|madurai
C|Thanjavur|10.79,79.14|India|thanjavur;tanjore
C|Nagapattinam|10.77,79.84|India|nagapattinam
C|Kodumbalur|10.55,78.52|India|kodumbalur
C|Visakhapatnam|17.7,83.3|India|visakhapatnam;visakhapatnam district;vizagapatam
S|Chandraketugarh|22.7,88.69|India|chandraketugarh;chandraketugarh area
C|Ahmedabad|23.03,72.58|India|ahmedabad
C|Surat|21.17,72.83|India|surat
R|Coromandel Coast|13,80.2|India|coromandel coast
R|Northern India|27.5,79|India|northern india;north india|r=450
R|Eastern India|24.5,87|India|eastern india;east india;northeastern india;northeast india|r=350
R|Western India|23,72.5|India|western india;west india|r=400
R|Southern India|12,78|India|southern india;south india|r=400
R|Central India|23.5,78.5|India|central india|r=350
R|Northwestern India|28,74|India|northwestern india;northwest india|r=400
W|Agra-Delhi court region|27.9,77.6|India|mughal;mughal dynasty;mughal court;mughal school|r=250
W|Thanjavur region|10.79,79.14|India|chola
W|Bihar-Bengal|25,87|India|pala
C|Lahore|31.55,74.34|Pakistan|lahore
R|Gandhara|34.2,72|Pakistan|gandhara;gandharan
R|Swat|35.2,72.4|Pakistan|swat;buner;buner area
S|Taxila|33.75,72.82|Pakistan|taxila;sirkap
S|Mohenjo-daro|27.33,68.14|Pakistan|mohenjo daro;indus valley civilization;indus valley
C|Kathmandu Valley|27.7,85.32|Nepal|kathmandu;kathmandu valley;patan;bhaktapur
C|Kandy|7.29,80.63|Sri Lanka|kandy
# ---------------- Central Asia & steppe
S|Hadda|34.36,70.47|Afghanistan|hadda;tape shotor
S|Begram|34.99,69.3|Afghanistan|begram
S|Bamiyan|34.83,67.82|Afghanistan|bamiyan
C|Herat|34.35,62.2|Afghanistan|herat
C|Kabul|34.53,69.17|Afghanistan|kabul
R|Bactria|36.76,66.9|Afghanistan|bactria;balkh;bactrian
C|Samarkand|39.65,66.96|Uzbekistan|samarkand;samarqand
C|Bukhara|39.77,64.42|Uzbekistan|bukhara;bokhara
R|Sogdiana|39.6,66.9|Uzbekistan|sogdia;soghdia;sogdiana;sogdian
C|Khiva|41.38,60.36|Uzbekistan|khiva
S|Merv|37.66,62.19|Turkmenistan|merv
R|Southern Siberia|53.5,91.5|Russia|southern siberia;siberia;minusinsk|reg=cas;r=500
R|Altai|50.7,86.5|Russia|altai|reg=cas;r=300
W|Pontic steppe|47.5,34.5|Ukraine|scythian|reg=cas;r=450
# ---------------- West Asia
S|Nimrud|36.1,43.33|Iraq|nimrud;calah;kalhu
S|Nineveh|36.36,43.15|Iraq|nineveh
S|Khorsabad|36.51,43.23|Iraq|khorsabad
S|Babylon|32.54,44.42|Iraq|babylon
S|Ur|30.96,46.1|Iraq|ur
S|Uruk|31.32,45.64|Iraq|uruk;warka
S|Nippur|32.13,45.23|Iraq|nippur
S|Khafajah|33.35,44.56|Iraq|khafajah;khafaje
S|Girsu|31.56,46.18|Iraq|girsu;tello;lagash
C|Baghdad|33.32,44.4|Iraq|baghdad
C|Mosul|36.34,43.13|Iraq|mosul
S|Samarra|34.2,43.87|Iraq|samarra
S|Ctesiphon|33.09,44.58|Iraq|ctesiphon;seleucia
W|Sumer|31.3,45.8|Iraq|sumerian;neo sumerian;sumer
W|Babylonia|32.6,44.5|Iraq|babylonian;old babylonian;neo babylonian
W|Assyria|36.2,43.2|Iraq|assyrian;neo assyrian
C|Isfahan|32.65,51.67|Iran|isfahan
C|Shiraz|29.6,52.54|Iran|shiraz
C|Tabriz|38.08,46.29|Iran|tabriz
C|Kashan|33.98,51.43|Iran|kashan
C|Rayy|35.58,51.44|Iran|rayy;rey;rhages
C|Nishapur|36.21,58.8|Iran|nishapur
S|Susa|32.19,48.26|Iran|susa
S|Persepolis|29.93,52.89|Iran|persepolis
R|Luristan|33.5,48.4|Iran|luristan;lorestan
R|Gilan|37,49.9|Iran|amlash;marlik;gilan;rasht
C|Hamadan|34.8,48.52|Iran|hamadan;ecbatana
C|Sultanabad|34.09,49.69|Iran|sultanabad;soltanabad;arak
C|Saveh|35.02,50.36|Iran|saveh
C|Varamin|35.32,51.65|Iran|varamin;veramin
C|Kirman|30.28,57.08|Iran|kirman;kerman
C|Yazd|31.9,54.37|Iran|yazd
C|Qazvin|36.27,50|Iran|qazvin
C|Mashhad|36.3,59.6|Iran|mashhad
R|Khurasan|35.5,59|Iran|khurasan;khorasan
C|Gurgan|37.25,55.17|Iran|gurgan;jurjan
C|Amol|36.47,52.35|Iran|amol
C|Tehran|35.69,51.39|Iran|tehran
C|Maragha|37.39,46.24|Iran|maragah;marageh;maragha
C|Burujird|33.9,48.75|Iran|burudjird;burujird
R|Northwestern Iran|37.5,46.5|Iran|northwestern iran;northwest iran
W|Fars|29.9,52.9|Iran|achaemenid
W|Isfahan region|32.65,51.67|Iran|safavid
C|Istanbul|41.01,28.98|Turkey|istanbul
C|Constantinople|41.01,28.98|Turkey|constantinople|reg=eur_e
C|Iznik|40.43,29.72|Turkey|iznik
C|Bursa|40.19,29.06|Turkey|bursa
C|Kutahya|39.42,29.98|Turkey|kutahya
C|Konya|37.87,32.49|Turkey|konya
C|Ushak|38.68,29.4|Turkey|ushak;usak
S|Ephesus|37.94,27.34|Turkey|ephesus
S|Pergamon|39.13,27.18|Turkey|pergamon;pergamum;bergama
C|Smyrna|38.42,27.14|Turkey|smyrna;izmir
S|Myrina|38.85,26.97|Turkey|myrina
S|Hattusa|40.02,34.61|Turkey|hattusa;bogazkoy
R|Central Anatolia|39.8,34.2|Turkey|hittite|r=300
R|Southeastern Anatolia|37.2,37.2|Turkey|neo hittite;syro hittite;carchemish;zincirli|r=250
R|Phrygia|39.6,31.9|Turkey|phrygia;phrygian;gordion
R|Lydia|38.49,28.04|Turkey|lydia;lydian;sardis
R|Lycia|36.5,29.8|Turkey|lycia
R|Ionia|38.2,27.3|Turkey|ionia
R|Western Anatolia|38.5,28.5|Turkey|western anatolia
R|Eastern Anatolia|39,41|Turkey|eastern anatolia;eastern turkey;urartian;urartu
C|Antioch|36.2,36.16|Turkey|antioch
C|Damascus|33.51,36.29|Syria|damascus
C|Aleppo|36.2,37.16|Syria|aleppo
S|Palmyra|34.55,38.27|Syria|palmyra
C|Raqqa|35.95,39.01|Syria|raqqa
S|Dura-Europos|34.75,40.73|Syria|dura europos
R|Northern Syria|36.2,37.5|Syria|northern syria;north syria
C|Jerusalem|31.78,35.22|Israel/Palestine|jerusalem
S|Jericho|31.87,35.44|Israel/Palestine|jericho
S|Petra|30.33,35.44|Jordan|petra
R|Nabataea|30.4,35.5|Jordan|nabataean;nabatean
R|Daghestan|42.5,47|Russia|daghestan;dagestan|reg=wan
# ---------------- Egypt, Nubia, North Africa
S|Thebes|25.7,32.64|Egypt|thebes;luxor;karnak;deir el bahri;valley of the kings;wadi qubbanet el qirud
S|Memphis|29.85,31.25|Egypt|memphis
S|Saqqara|29.87,31.22|Egypt|saqqara
S|Giza|29.98,31.13|Egypt|giza
S|Abydos|26.18,31.92|Egypt|abydos
S|Amarna|27.65,30.9|Egypt|amarna;tell el amarna;el amarna
C|Alexandria|31.2,29.92|Egypt|alexandria
C|Cairo|30.04,31.24|Egypt|cairo;old cairo;fustat;fostat
R|Fayum|29.31,30.84|Egypt|fayum;faiyum;al fayyum;hawara
S|Meir|27.45,30.75|Egypt|meir
S|Asyut|27.18,31.18|Egypt|asyut;assiut
S|Deir el-Bersha|27.75,30.9|Egypt|deir el bersha;bersha
S|Beni Hasan|27.93,30.88|Egypt|beni hasan
S|Dendera|26.14,32.67|Egypt|dendera
S|Akhmim|26.56,31.75|Egypt|akhmim;panopolis
S|Antinoe|27.81,30.88|Egypt|antinoe;antinoopolis
S|Haraga|29.2,30.95|Egypt|haraga;lahun
S|Lisht|29.57,31.23|Egypt|lisht
S|Naqada|25.9,32.72|Egypt|naqada site
S|Oxyrhynchus|28.54,30.66|Egypt|oxyrhynchus;al bahnasa
S|Meroe|16.94,33.75|Sudan|meroe
R|Meroitic Nubia|17.5,33|Sudan|meroitic|r=300
S|Kerma|19.6,30.41|Sudan|kerma
S|Carthage|36.85,10.32|Tunisia|carthage
C|Fez|34.03,-5|Morocco|fez;fes
C|Marrakesh|31.63,-8|Morocco|marrakesh;marrakech
C|Rabat-Sale|34.03,-6.83|Morocco|rabat;sale
C|Azemmour|33.29,-8.34|Morocco|azemmour
C|Tetouan|35.57,-5.37|Morocco|tetouan
R|Djerba|33.8,10.85|Tunisia|djerba
# ---------------- Sub-Saharan Africa
C|Benin City|6.34,5.62|Nigeria|benin kingdom;kingdom of benin;edo peoples;edo people;court of benin;benin city
C|Ife|7.47,4.56|Nigeria|ife
W|Yorubaland|7.8,4.5|Nigeria|yoruba
W|Igboland|5.9,7.3|Nigeria|igbo
W|Nok region|9.5,8|Nigeria|nok
W|Cross River|5.8,8.6|Nigeria|ibibio;ekoi;ejagham
W|Niger Delta|5,6|Nigeria|ijo;ijaw;urhobo
W|Asante region|6.7,-1.62|Ghana|asante;ashanti;akan;kumasi;asante empire
W|Baule region|7.5,-5|Cote d'Ivoire|baule
W|Senufo region|9.5,-5.6|Cote d'Ivoire|senufo
W|Dan region|7.4,-8|Cote d'Ivoire|dan
W|Guro region|7,-6|Cote d'Ivoire|guro;yaure
W|Dogon country|14.4,-3.4|Mali|dogon
W|Bamana region|12.9,-7|Mali|bamana;bambara
R|Inland Niger Delta (Djenne)|13.9,-4.55|Mali|djenne;jenne;djenne jeno|r=150
W|Mossi plateau|12.4,-1.5|Burkina Faso|mossi
W|Bwa region|11.8,-3.5|Burkina Faso|bwa;bobo;nuna;gurunsi
W|Lobi region|10.3,-3.2|Burkina Faso|lobi
W|Mende region|7.9,-11.2|Sierra Leone|mende;temne;sapi
W|Baga coast|10.3,-14.3|Guinea|baga
R|Grassfields|6,10.5|Cameroon|grassfields;grassfields region;bamum;bamoun;bamileke;bangwa;kom;babessi;bamessing
W|Fang region|0.5,11.5|Gabon|fang
W|Kota region|-0.5,13.5|Gabon|kota style;kota people;kota peoples
W|Punu region|-2.5,11|Gabon|punu
W|Kongo region|-5.3,14.3|Democratic Republic of the Congo|kongo;yombe
R|Cabinda|-5.2,12.3|Angola|cabinda
W|Teke region|-3,15.5|Republic of the Congo|teke
W|Kuba kingdom|-4.8,21.5|Democratic Republic of the Congo|kuba style;kuba people;kuba peoples;kuba kingdom;kuba
W|Luba region|-8,26.5|Democratic Republic of the Congo|luba
W|Songye region|-6,25|Democratic Republic of the Congo|songye
W|Pende region|-6.2,19.5|Democratic Republic of the Congo|pende
W|Chokwe region|-9.5,20.5|Angola|chokwe
W|Lega region|-3,27.5|Democratic Republic of the Congo|lega
W|Uele region|3.2,27.8|Democratic Republic of the Congo|mangbetu;zande;azande
W|Ubangi region|3.8,20.5|Democratic Republic of the Congo|ngbandi;ngbaka;ngombe
W|Kwango region|-6.5,17.5|Democratic Republic of the Congo|yaka;suku
W|Hemba region|-5.8,27.6|Democratic Republic of the Congo|hemba;tabwa
W|Lulua region|-6,22.5|Democratic Republic of the Congo|lulua;luluwa;lele
S|Aksum|14.13,38.72|Ethiopia|aksum;axum
C|Gondar|12.6,37.47|Ethiopia|gondar
W|Makonde plateau|-10.7,39.3|Tanzania|makonde
W|Swahili coast|-4.05,39.67|Kenya|swahili
R|Antananarivo highlands|-18.9,47.5|Madagascar|merina;antananarivo
W|KwaZulu-Natal|-28.5,31|South Africa|zulu;nguni
W|Eastern Cape|-32,27.5|South Africa|xhosa;southeast cape region
W|Ndebele region|-25.5,29|South Africa|ndebele
W|Shona region|-19,31|Zimbabwe|shona
# ---------------- Southern Europe & Aegean
C|Rome|41.9,12.5|Italy|rome
C|Florence|43.77,11.25|Italy|florence;florentine
C|Venice|45.44,12.33|Italy|venice;venetian;murano;burano
C|Siena|43.32,11.33|Italy|siena;sienese
C|Milan|45.46,9.19|Italy|milan;milanese
C|Naples|40.85,14.27|Italy|naples;neapolitan;capodimonte
C|Bologna|44.49,11.34|Italy|bologna;bolognese
C|Padua|45.41,11.88|Italy|padua
C|Verona|45.44,10.99|Italy|verona
C|Brescia|45.54,10.22|Italy|brescia
C|Ferrara|44.84,11.62|Italy|ferrara
C|Mantua|45.16,10.79|Italy|mantua
C|Urbino|43.73,12.64|Italy|urbino
C|Faenza|44.29,11.88|Italy|faenza
C|Deruta|42.98,12.42|Italy|deruta
C|Gubbio|43.35,12.58|Italy|gubbio
C|Castelli|42.49,13.71|Italy|castelli
C|Montelupo|43.73,11.02|Italy|montelupo
C|Pesaro|43.91,12.91|Italy|pesaro
C|Genoa|44.41,8.93|Italy|genoa;genoese
C|Turin|45.07,7.69|Italy|turin
C|Lucca|43.84,10.5|Italy|lucca
C|Pisa|43.72,10.4|Italy|pisa
C|Perugia|43.11,12.39|Italy|perugia
C|Ravenna|44.42,12.2|Italy|ravenna
C|Pescocostanzo|41.89,14.07|Italy|pescocostanzo
R|Umbria|43,12.5|Italy|umbria;umbrian
R|Tuscany|43.4,11.2|Italy|tuscany;tuscan
R|Lombardy|45.6,9.7|Italy|lombardy;lombard
R|Abruzzo|42.2,13.8|Italy|abruzzi;abruzzo
R|Emilia|44.6,11|Italy|emilia
R|Northern Italy|45.3,10.5|Italy|northern italy;north italy;north italian
R|Sicily|37.6,14.2|Italy|sicily;sicilian;palermo;syracuse
R|Sardinia|40,9|Italy|sardinia;sardinian
R|Apulia|41,16.5|Italy|apulia;apulian;canosa;canosa di puglia;canosan;daunian;taranto;taras;gnathia
R|Campania|40.9,14.5|Italy|campania;campanian;paestum;paestan;capua;cumae;nola;cales
S|Pompeii|40.75,14.49|Italy|pompeii;herculaneum;boscoreale
R|Southern Italy|40.6,16.2|Italy|south italian;south italy;southern italy;lucanian;lucania;magna graecia|r=250
R|Etruria|42.6,11.8|Italy|etruscan;etruria;vulci;cerveteri;caere;tarquinia;chiusi;orvieto;faliscan;villanovan|r=150
C|Athens|37.98,23.73|Greece|athens;attic;attica;athenian
C|Corinth|37.91,22.88|Greece|corinth;corinthian
R|Boeotia|38.37,23.1|Greece|boeotia;boeotian;tanagra
R|Laconia|37.07,22.43|Greece|sparta;laconia;laconian
S|Mycenae|37.73,22.76|Greece|mycenae
R|Argolid|37.7,22.8|Greece|mycenaean
R|Crete|35.2,24.9|Greece|crete;kriti;cretan;minoan;knossos
R|Cyclades|37,25.2|Greece|cyclades;cycladic;cyclades islands;naxos;amorgos;paros;melos
R|Rhodes|36.2,28|Greece|rhodes;rhodian;rodhos;dodecanese islands
R|Thessaly|39.5,22.3|Greece|thessaly;thessalia
R|Macedonia|40.6,22.6|Greece|macedonia;macedonian;northern greece;thessaloniki
R|Epirus|39.6,20.8|Greece|epirus;yaninna;ioannina
R|Sporades|39.1,24|Greece|sporades islands;skyros
R|Ionian Islands|38.5,20.6|Greece|ionian islands
R|East Greece (Ionia)|38.2,27.3|Turkey|east greek;eastern greece
W|Greek mainland|38.2,23.2|Greece|greek|r=250
C|Toledo|39.86,-4.02|Spain|toledo
C|Seville|37.39,-5.99|Spain|seville;sevilla
C|Granada|37.18,-3.6|Spain|granada;granada province;nasrid;alhambra
C|Cordoba|37.89,-4.78|Spain|cordoba;spanish umayyad
C|Valencia|39.47,-0.38|Spain|valencia;manises;paterna
C|Barcelona|41.39,2.17|Spain|barcelona
R|Catalonia|41.8,1.5|Spain|catalonia;catalan
C|Madrid|40.42,-3.7|Spain|madrid
C|Talavera de la Reina|39.96,-4.83|Spain|talavera de la reina;talavera
C|Alcora|40.07,-0.2|Spain|alcora
R|Castile|41.2,-4|Spain|castile;kingdom of castile and leon;castilian;villalcazar de sirga;burgos;leon
R|Aragon|41.6,-0.9|Spain|aragon;teruel;zaragoza
R|Andalusia|37.4,-4.8|Spain|andalusia;southern spain;huelva
C|Almeria|36.84,-2.46|Spain|almeria
C|Malaga|36.72,-4.42|Spain|malaga
C|Lisbon|38.72,-9.14|Portugal|lisbon
# ---------------- Western & Northern Europe
C|Paris|48.86,2.35|France|paris;parisian;sevres;saint cloud;vincennes;versailles;gobelins;ile de france
C|Limoges|45.83,1.26|France|limoges;limousin
C|Lyon|45.76,4.84|France|lyon;lyons
C|Rouen|49.44,1.1|France|rouen
C|Nevers|46.99,3.16|France|nevers
C|Moustiers|43.85,6.22|France|moustiers
C|Marseille|43.3,5.37|France|marseille;marseilles
C|Strasbourg|48.57,7.75|France|strasbourg
C|Beauvais|49.43,2.08|France|beauvais
C|Aubusson|45.96,2.17|France|aubusson
C|Tours|47.39,0.69|France|tours
C|Reims|49.26,4.03|France|reims
C|Toulouse|43.6,1.44|France|toulouse
C|Avignon|43.95,4.81|France|avignon
C|Chantilly|49.19,2.47|France|chantilly
C|Alencon|48.43,0.09|France|alencon;argentan
C|Valenciennes|50.36,3.52|France|valenciennes
C|Arras|50.29,2.78|France|arras
C|Metz|49.12,6.18|France|metz
C|Jouy-en-Josas|48.77,2.17|France|jouy;jouy en josas
R|Burgundy|47.3,4.8|France|burgundy;burgundian;dijon
R|Normandy|49.2,0.3|France|normandy
R|Champagne|48.6,4.2|France|champagne;troyes
R|Lorraine|48.7,6.2|France|lorraine;nancy
R|Southern France|43.8,3.5|France|southern france;languedoc;provence|r=250
R|Southwest France|44.3,0.3|France|southwest france;southwestern france;bordeaux
R|Northern France|50,2.8|France|northern france;picardy;amiens;northeastern france
R|Auvergne|45.7,3.1|France|auvergne
R|Meuse valley|50.6,5.6|Belgium|mosan;meuse valley;valley of the meuse;liege
C|Amsterdam|52.37,4.9|Netherlands|amsterdam
C|Delft|52.01,4.36|Netherlands|delft
C|Haarlem|52.38,4.64|Netherlands|haarlem
C|The Hague|52.08,4.3|Netherlands|the hague
C|Utrecht|52.09,5.12|Netherlands|utrecht
C|Leiden|52.16,4.49|Netherlands|leiden
C|Antwerp|51.22,4.4|Belgium|antwerp
C|Brussels|50.85,4.35|Belgium|brussels
C|Bruges|51.21,3.22|Belgium|bruges;ghent and bruges
C|Ghent|51.05,3.72|Belgium|ghent
C|Tournai|50.61,3.39|Belgium|tournai
C|Mechelen|51.03,4.48|Belgium|mechelen;malines
C|Binche|50.41,4.17|Belgium|binche
R|Brabant|50.9,4.6|Belgium|brabant
C|Meissen|51.16,13.47|Germany|meissen
C|Dresden|51.05,13.74|Germany|dresden
C|Nuremberg|49.45,11.08|Germany|nuremberg
C|Augsburg|48.37,10.9|Germany|augsburg
C|Cologne|50.94,6.96|Germany|cologne
C|Munich|48.14,11.58|Germany|munich;nymphenburg
C|Landshut|48.54,12.15|Germany|landshut
C|Berlin|52.52,13.4|Germany|berlin;potsdam
C|Frankfurt|50.11,8.68|Germany|frankfurt;hochst;hanau
C|Hamburg|53.55,10|Germany|hamburg
C|Regensburg|49.02,12.1|Germany|regensburg
C|Ulm|48.4,9.99|Germany|ulm
C|Hildesheim|52.15,9.95|Germany|hildesheim
C|Brunswick|52.27,10.52|Germany|brunswick;braunschweig
C|Trier|49.75,6.64|Germany|trier
C|Mainz|50,8.27|Germany|mainz
C|Aachen|50.78,6.08|Germany|aachen
C|Solingen|51.17,7.08|Germany|solingen
C|Lubeck|53.87,10.69|Germany|lubeck
C|Leipzig|51.34,12.37|Germany|leipzig
R|Rhineland|50.6,7.2|Germany|rhineland;rhenish;rhine valley;middle rhine;westerwald;siegburg
R|Lower Rhine|51.5,6.5|Germany|lower rhine;lower rhine valley
R|Upper Rhine|48.3,7.8|Germany|upper rhine
R|Saxony|51.1,13.3|Germany|saxony
R|Lower Saxony|52.6,9.8|Germany|lower saxony
R|Bavaria|48.8,11.6|Germany|bavaria;bavarian
R|Swabia|48.4,9.8|Germany|swabia;swabian
R|Franconia|49.6,10.9|Germany|franconia
R|Thuringia|50.9,11|Germany|thuringia
R|Westphalia|51.9,8|Germany|westphalia
R|Southern Germany|48.5,10.5|Germany|south germany;southern germany;south german
R|Northern Germany|53,10|Germany|north germany;northern germany
C|Vienna|48.21,16.37|Austria|vienna;viennese
C|Salzburg|47.8,13.04|Austria|salzburg
R|Tyrol|47.25,11.4|Austria|tyrol;innsbruck
R|Styria|47.07,15.44|Austria|styria;graz
C|Zurich|47.37,8.54|Switzerland|zurich
C|Basel|47.56,7.59|Switzerland|basel
C|Geneva|46.2,6.14|Switzerland|geneva
C|London|51.51,-0.13|United Kingdom|london;chelsea;lambeth;southwark;spitalfields;merton abbey
R|Staffordshire|53,-2.18|United Kingdom|staffordshire;burslem;stoke on trent
C|Worcester|52.19,-2.22|United Kingdom|worcester
C|Derby|52.92,-1.48|United Kingdom|derby
C|Bristol|51.45,-2.59|United Kingdom|bristol
C|Liverpool|53.41,-2.98|United Kingdom|liverpool
C|Birmingham|52.48,-1.9|United Kingdom|birmingham
C|Sheffield|53.38,-1.47|United Kingdom|sheffield
C|Nottingham|52.95,-1.15|United Kingdom|nottingham
R|Scotland|56.2,-3.8|United Kingdom|scotland;scottish;edinburgh;glasgow
C|Dublin|53.35,-6.26|Ireland|dublin
C|Copenhagen|55.68,12.57|Denmark|copenhagen
C|Stockholm|59.33,18.07|Sweden|stockholm
# ---------------- Eastern Europe, Russia, Byzantium
C|Moscow|55.75,37.62|Russia|moscow
C|St. Petersburg|59.94,30.31|Russia|st petersburg;saint petersburg
C|Novgorod|58.52,31.27|Russia|novgorod
R|Nizhny Novgorod province|56.3,44|Russia|nizhny novgorod province;nizhny novgorod
R|Tambov province|52.7,41.4|Russia|tambov province;tambov
C|Kyiv|50.45,30.52|Ukraine|kyiv;kiev
R|Crimea|45.2,34.5|Ukraine|crimea;kerch
C|Prague|50.08,14.44|Czech Republic|prague
C|Budapest|47.5,19.04|Hungary|budapest
C|Krakow|50.06,19.94|Poland|krakow;cracow
C|Gdansk|54.35,18.65|Poland|gdansk;danzig
R|Silesia|51,16.8|Poland|silesia;breslau;wroclaw
R|Transylvania|46.5,24.5|Romania|transylvania
W|Constantinople|41.01,28.98|Turkey|byzantium|reg=eur_e;r=400
# ---------------- North America
C|New York City|40.71,-74|United States|new york city;manhattan;brooklyn
R|New York|41.3,-74.3|United States|new york|r=250
C|Boston|42.36,-71.06|United States|boston
R|Massachusetts|42.3,-71.6|United States|massachusetts;salem
C|Philadelphia|39.95,-75.17|United States|philadelphia
R|Pennsylvania|40.5,-77|United States|pennsylvania|r=250
R|Connecticut|41.6,-72.7|United States|connecticut;hartford;new haven
R|Rhode Island|41.6,-71.4|United States|rhode island;newport;providence
R|New Hampshire|43.3,-71.5|United States|new hampshire
R|New Jersey|40.2,-74.6|United States|new jersey;trenton
C|Baltimore|39.29,-76.61|United States|baltimore;maryland
R|Virginia|37.5,-78.5|United States|virginia|r=250
C|Charleston|32.78,-79.93|United States|charleston;south carolina
R|New England|42.8,-71.8|United States|new england|r=250
R|Ohio|40.2,-82.8|United States|ohio;zanesville;east liverpool|r=250
C|Cleveland|41.5,-81.69|United States|cleveland
C|Cincinnati|39.1,-84.51|United States|cincinnati
C|Chicago|41.88,-87.63|United States|chicago
C|New Orleans|29.95,-90.07|United States|new orleans;louisiana
R|California|36.8,-120|United States|california|r=400
R|Northern California|39.5,-122.5|United States|northern california
C|Pittsburgh|40.44,-80|United States|pittsburgh
C|Sandwich, Massachusetts|41.76,-70.49|United States|sandwich
C|Bennington|42.88,-73.2|United States|bennington
C|San Francisco|37.77,-122.42|United States|san francisco
R|Pomo homeland|39.1,-123.1|United States|pomo;alexander valley;wappo
R|Death Valley|36.5,-117|United States|death valley;timbisha shoshone;timbisha
R|San Joaquin Valley|36.2,-119.3|United States|tulare;yokuts
R|Lake Tahoe|39,-119.9|United States|washoe
R|Klamath River|41.3,-123.8|United States|yurok;hupa;karuk
R|Southern California|33.6,-117.2|United States|mission;gabrielino;cahuilla;chumash
R|New Mexico|35.3,-106.5|United States|new mexico;pueblo|r=250
S|Zuni Pueblo|35.07,-108.85|United States|zuni;zuni pueblo
S|Acoma Pueblo|34.9,-107.58|United States|acoma
R|Hopi mesas|35.85,-110.5|United States|hopi;sikyatki
S|San Ildefonso Pueblo|35.89,-106.12|United States|san ildefonso;santa clara
S|Zia Pueblo|35.5,-106.72|United States|zia;cochiti;santo domingo
R|Mimbres valley|32.8,-107.9|United States|mimbres
R|Four Corners|36.5,-108.5|United States|ancestral pueblo;anasazi;ancestral puebloan
R|Navajo Nation|36.2,-109.5|United States|navajo;dine
R|Apache lands|33.5,-109.8|United States|apache
R|Gila River|33.1,-111.9|United States|akimel o'odham;pima;tohono o'odham;papago;hohokam
R|Arizona|34,-111.5|United States|arizona|r=300
R|American Southwest|35,-108.5|United States|southwest|r=400
R|Great Plains|43.5,-101|United States|plains;central plains;northern plains;lakota;sioux;tsitsistas;cheyenne;crow;apsaalooke|r=500
R|Southern Plains|35,-98.5|United States|kiowa;gaigwu;comanche|r=300
R|Mississippi Valley|36,-89.5|United States|mississippian|r=500
R|Spiro (Oklahoma)|35.3,-94.6|United States|spiro;spiro mississippian;caddo
R|St. Lawrence Island|63.4,-170.3|United States|punuk;old bering sea;okvik
R|Cibola (Zuni region)|34.6,-109|United States|cibola;tularosa
R|Salado (Tonto Basin)|33.6,-110.9|United States|salado
R|Great Basin|39.5,-116.5|United States|great basin;paiute;shoshone|r=400
R|Southeast Alaska|57.5,-134.5|United States|tlingit;chilkat
R|Haida Gwaii|53.2,-132.1|Canada|haida
R|Northern British Columbia coast|54.5,-129.5|Canada|tsimshian
R|Vancouver Island|49.8,-126|Canada|vancouver island;kwakwaka'wakw;kwakiutl;nuu chah nulth;nootka
R|Olympic Peninsula|48.37,-124.6|United States|makah;cape flattery;salish
R|Alaska|61.5,-152|United States|alaska;yup'ik;inupiaq|r=600
R|Aleutian Islands|53.9,-166.5|United States|aleut;attu;aleutian;unangan|r=400
R|Great Lakes|45.5,-86|United States|great lakes region;great lakes;anishinaabe;ojibwe;chippewa;northeast woodlands|r=450
R|Iroquoia|43,-76|United States|iroquois;haudenosaunee;seneca
R|Hawaii|20.8,-156.5|United States|hawaii;hawaiian;hawaiian islands|reg=oce;r=300
C|Quebec|46.8,-71.2|Canada|quebec
C|Montreal|45.5,-73.57|Canada|montreal
# ---------------- Mesoamerica & Caribbean
S|Teotihuacan|19.69,-98.84|Mexico|teotihuacan
C|Mexico City|19.43,-99.13|Mexico|mexico city;tenochtitlan
R|Central Mexico|19.4,-99|Mexico|central mexico;valley of mexico;tlatilco;aztec;mexica;central highlands
R|Oaxaca|17.06,-96.72|Mexico|oaxaca;oaxaca state;zapotec;monte alban
R|Mixteca|17.5,-97.5|Mexico|mixtec;mixteca
R|Veracruz|19.5,-96.9|Mexico|veracruz;veracruz state;classic veracruz;remojadas;totonac;gulf coast;southern veracruz
S|El Tajin|20.45,-97.38|Mexico|el tajin
R|Huasteca|22,-98.3|Mexico|huastec;huasteca
R|Olmec heartland|17.9,-94.6|Mexico|olmec
R|Guerrero|17.8,-99.8|Mexico|guerrero;guerrero state;mezcala;xochipala;ichcatiopan
R|West Mexico|20.3,-104|Mexico|west mexico;western mexico|r=300
R|Colima|19.24,-103.72|Mexico|colima;comala;colima state
R|Nayarit|21.5,-104.9|Mexico|nayarit;chinesco;nayarit state
R|Jalisco|20.6,-103.6|Mexico|jalisco;jalisco state;ameca;tonala;guadalajara
R|Michoacan|19.6,-101.6|Mexico|michoacan;michoacan state;tarascan;purepecha
R|Guanajuato|20.5,-100.9|Mexico|guanajuato;guanajuato state;chupicuaro
C|Puebla|19.04,-98.2|Mexico|puebla;cholula
R|Yucatan|20.5,-89|Mexico|yucatan
R|Campeche|19.3,-90.5|Mexico|campeche;campeche state;jaina;jaina island;jaina island region
R|Chiapas|16.75,-92.6|Mexico|chiapas;palenque;palenque region
S|Xochicalco|18.8,-99.3|Mexico|xochicalco
R|Tula region|20.06,-99.34|Mexico|toltec;tula
C|Saltillo|25.42,-101|Mexico|saltillo;saltillo region;coahuila state;coahuila
R|Peten|16.9,-89.9|Guatemala|peten;peten region;tikal
R|Guatemalan highlands|15.03,-91.15|Guatemala|quiche;k'iche';san juan cotzal
R|Ulua Valley|15.3,-87.9|Honduras|ulua valley;ulua
S|Copan|14.84,-89.14|Honduras|copan
R|Nicoya|10.3,-85.4|Costa Rica|nicoya;guanacaste;southern nicoya region;pataky
R|Atlantic Watershed|10.1,-83.6|Costa Rica|atlantic watershed;atlantic watershed region;limon
R|Diquis|8.9,-83.4|Costa Rica|diquis;diquis region
R|Cocle|8.3,-80.4|Panama|cocle;conte;parita;azuero peninsula;central panama
R|Veraguas-Chiriqui|8.4,-81.8|Panama|veraguas;chiriqui;western panama
R|Guna Yala|9.3,-78.5|Panama|gunayala comarca;guna;kuna
W|Maya lowlands|16.9,-89.9|Guatemala|maya|r=300
W|Greater Antilles|18.8,-70.2|Dominican Republic|taino
# ---------------- Andes & South America
R|North Coast|-7.5,-79.3|Peru|north coast;peruvian north coast;north coast of peru;santa valley
R|Moche valleys|-8,-79|Peru|moche;mochica;moche valley
R|Chimu heartland|-8.1,-79.07|Peru|chimu;chan chan
R|Lambayeque|-6.7,-79.9|Peru|lambayeque;sican;lambayeque valley;chongoyape
R|Cupisnique|-7.6,-79.3|Peru|cupisnique
R|Vicus|-5.1,-80.1|Peru|vicus
S|Chavin de Huantar|-9.59,-77.18|Peru|chavin de huantar
R|North Highlands|-8.5,-77.8|Peru|chavin;north highlands;recuay;pacopampa;cajamarca
R|Central Coast|-11.8,-77.1|Peru|central coast;peruvian central coast;chancay;lima;pachacamac;paramonga;nieveria
R|South Coast|-14.4,-75.6|Peru|south coast;peruvian south coast;nasca;nazca;nazca valley;southern peru;paracas;ocucaje;ica;ica valley;paracas necropolis
R|Ayacucho|-13.06,-74.2|Peru|wari;huari
C|Cusco|-13.52,-71.97|Peru|cusco;cuzco
S|Chuquibamba|-15.84,-72.65|Peru|chuquibamba
W|Cusco region|-13.52,-71.97|Peru|inca;inka
R|Tiwanaku|-16.55,-68.67|Bolivia|tiwanaku;tiahuanaco|r=150
C|Potosi|-19.58,-65.75|Bolivia|potosi
R|Muisca highlands|5.2,-73.8|Colombia|muisca
R|Quimbaya|4.6,-75.7|Colombia|quimbaya
R|Calima|3.9,-76.5|Colombia|calima;yotoco;calima region
R|Tairona|11.1,-74|Colombia|tairona
R|Sinu|8.7,-75.7|Colombia|sinu;zenu
R|Tolima|4.1,-75.2|Colombia|tolima
R|Narino|1.2,-77.5|Colombia|narino;highland narino region
R|Ecuadorian coast|-1,-80.4|Ecuador|valdivia;chorrera;jama coaque;manteno;bahia
C|Quito|-0.22,-78.51|Ecuador|quito
R|Northwest Argentina|-28,-66.5|Argentina|aguada;la aguada;condorhuasi;santa maria culture;catamarca|r=300
R|Marajo|-0.9,-49.6|Brazil|marajo;marajoara
# ---------------- Oceania
R|Sepik|-4.2,143.5|Papua New Guinea|sepik;iatmul;abelam;sawos;tshuosh;middle sepik;lower sepik;sepik river
R|New Ireland|-3.3,152|Papua New Guinea|new ireland;malagan
R|New Britain|-5.5,150.5|Papua New Guinea|new britain;baining;tolai;sulka
R|Papuan Gulf|-7.6,144.8|Papua New Guinea|papuan gulf;elema;gulf province
R|Massim|-8.8,151|Papua New Guinea|massim;massim area;trobriand;trobriand islands
R|Admiralty Islands|-2.1,147|Papua New Guinea|admiralty islands;manus
R|Asmat|-5.5,138.5|Indonesia|asmat|reg=oce
R|Lake Sentani|-2.6,140.5|Indonesia|lake sentani;irian jaya;west papua|reg=oce
R|Marquesas Islands|-9.4,-140|French Polynesia|marquesas;marquesas islands
R|Austral Islands|-23.4,-149.5|French Polynesia|austral islands
S|Mangaia|-21.92,-157.92|Cook Islands|mangaia
R|Arnhem Land|-12.5,134|Australia|arnhem land;western arnhem land;eastern arnhem land|r=300
R|Easter Island|-27.1,-109.35|Chile|easter island;rapa nui;rapa nui easter island|reg=oce
# ---------------- Southeast Asia
S|Angkor|13.43,103.86|Cambodia|angkor;angkor wat;angkor thom;bayon;baphuon
W|Angkor region|13.43,103.86|Cambodia|khmer
C|Ayutthaya|14.35,100.57|Thailand|ayutthaya
C|Sukhothai|17.02,99.7|Thailand|sukhothai
C|Sawankhalok|17.43,99.79|Thailand|sawankhalok;si satchanalai;sawankhalok ware
S|Ban Chiang|17.41,103.24|Thailand|ban chiang
C|Lopburi|14.8,100.65|Thailand|lopburi
C|Bangkok|13.75,100.5|Thailand|bangkok
C|Chiang Mai|18.79,98.98|Thailand|chiang mai;lan na
R|Central Thailand|14.5,100.3|Thailand|central thailand;dvaravati;mon dvaravati
R|Northeastern Thailand|16,103|Thailand|northeastern thailand;northeast thailand
R|Java|-7.5,110.5|Indonesia|java;javanese|r=300
R|Central Java|-7.6,110.2|Indonesia|central java;borobudur;prambanan
R|Eastern Java|-7.75,112.5|Indonesia|eastern java;east java;majapahit
R|Bali|-8.4,115.2|Indonesia|bali;balinese
R|Sumatra|-0.5,101.5|Indonesia|sumatra|r=500
C|Palembang|-2.98,104.76|Indonesia|palembang
R|Batak highlands|2.6,98.8|Indonesia|batak
R|Borneo|0.5,114|Indonesia|borneo;kalimantan;dayak|r=500
R|Sulawesi|-2.5,120.5|Indonesia|sulawesi;toraja;celebes|r=300
R|Sumba|-9.7,119.9|Indonesia|sumba
S|Bagan|21.17,94.86|Myanmar|pagan;bagan
C|Mandalay|21.97,96.08|Myanmar|mandalay
R|Southern Myanmar|16.8,96.5|Myanmar|southern myanmar
R|Northern Vietnam|21,105.8|Vietnam|northern vietnam;north vietnam;hanoi;dong son|r=250
R|Central Vietnam|15.8,108.2|Vietnam|central vietnam;champa;cham;hue|r=250
R|Mindanao|7.8,124.8|Philippines|mindanao|r=250
R|Luzon|16,121|Philippines|luzon|r=250
"""

# variants: alias | country | lat,lon | display  (heartland of a W/E label inside another country)
VARIANTS_TXT = """
maya|Mexico|18.8,-90.3|Maya lowlands (Yucatan Peninsula)
maya|Honduras|14.84,-89.14|Copan region
maya|Belize|17.2,-88.8|Belize lowlands
khmer|Thailand|15,102.8|Khorat Plateau
yoruba|Benin|7.4,2.5|Yoruba region
senufo|Mali|11.3,-5.7|Senufo region
senufo|Burkina Faso|10.7,-5|Senufo region
dan|Liberia|7.2,-8.8|Dan region
akan|Cote d'Ivoire|6.5,-3.5|Akan region
lobi|Ghana|10.2,-2.7|Lobi region
lobi|Cote d'Ivoire|9.6,-3.3|Lobi region
fang|Cameroon|2.8,11.5|Fang region
fang|Equatorial Guinea|1.6,10.4|Fang region
kongo|Angola|-6.3,14.2|Kongo region
kongo|Republic of the Congo|-4.4,13|Kongo region
yombe|Republic of the Congo|-4.5,12.5|Mayombe
teke|Democratic Republic of the Congo|-4,16|Teke region
chokwe|Democratic Republic of the Congo|-8,21.5|Chokwe region
makonde|Mozambique|-11.5,39.7|Makonde plateau
swahili|Tanzania|-6.16,39.2|Swahili coast
inca|Bolivia|-16.5,-68.7|Lake Titicaca basin
inka|Bolivia|-16.5,-68.7|Lake Titicaca basin
tiwanaku|Peru|-16.6,-70.2|Southern highlands
taino|Puerto Rico|18.2,-66.4|Puerto Rico
taino|Cuba|20.5,-76|Eastern Cuba
taino|Haiti|18.9,-72.5|Hispaniola
mughal|Pakistan|31.55,74.34|Lahore region
ottoman|Turkey|40.6,29.2|Istanbul-Bursa region
seljuk|Turkey|37.87,32.49|Konya region
seljuq|Turkey|37.87,32.49|Konya region
mamluk|Egypt|30.04,31.24|Cairo
fatimid|Egypt|30.04,31.24|Cairo
ayyubid|Egypt|30.04,31.24|Cairo
tulunid|Egypt|30.04,31.24|Cairo
mamluk|Syria|33.51,36.29|Damascus
ayyubid|Syria|33.6,36.4|Damascus region
timurid|Uzbekistan|39.65,66.96|Samarkand
timurid|Afghanistan|34.35,62.2|Herat
qajar|Iran|35.69,51.39|Tehran
sasanian|Iraq|33.09,44.58|Ctesiphon
sassanian|Iraq|33.09,44.58|Ctesiphon
ptolemaic|Egypt|31.2,29.92|Alexandria
roman|Italy|41.9,12.5|Rome
goryeo|Korea|37.97,126.55|Kaesong region
silla|Korea|35.85,129.22|Gyeongju
baekje|Korea|36.3,126.9|Buyeo region
joseon|Korea|37.57,126.98|Seoul region
inuit|Canada|63.7,-80|Canadian Arctic|600
eskimo|Canada|63.7,-80|Canadian Arctic|600
inuit|United States|62,-160|Western Alaska|500
eskimo|United States|62,-160|Western Alaska|500
"""

GEN_SKIP = set('africa west central east eastern western southern northern north south asia europe european '
               'mesoamerica andes americas america oceania pacific islands melanesia polynesia micronesia native '
               'american mediterranean isthmian region intermediate area unassigned arctic near '
               'southeast southwest northwest northeast style pre columbian yugoslavia the caucasus balkans'.split())

# phrases removed before matching (not places of making, or ambiguous period names)
BLOCK_RE = re.compile(
    r' (nara|kamakura|edo|asuka|momoyama|muromachi|heian|han|song|tang|ming|qing|jin|sui|liao|yuan|zhou|shang) '
    r'(period|dynasty|era) | (central|south|north|latin|meso) america(n)? | native north american? '
    r'| new kingdom | middle kingdom | old kingdom | late period | roman (period|empire) | (new|mount) lebanon ')
REJECT_RE = re.compile(r' (or|probably|possibly|perhaps|attributed|forgery|imitation|after|unassigned|modern copy'
                       r'|in the style of) ')

COUNTRIES = {}      # name -> dict
ALIASES = {}        # normalized alias -> entry dict
VARIANTS = collections.defaultdict(dict)


def _build_gazetteer():
    for line in COUNTRIES_TXT.strip().splitlines():
        name, ll, reg, size, al = line.split('|')
        lat, lon = map(float, ll.split(','))
        e = dict(kind='K', disp=name, lat=lat, lon=lon, country=name, reg=reg, r=SIZE_R[size], prec='country')
        COUNTRIES[name] = e
        for a in [name] + [x for x in al.split(';') if x]:
            ALIASES[norm(a).strip()] = e
    for line in PLACES_TXT.strip().splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        parts = line.split('|')
        kind, disp, ll, country, al = parts[:5]
        opts = dict(o.split('=') for o in parts[5].split(';')) if len(parts) > 5 else {}
        lat, lon = map(float, ll.split(','))
        assert country in COUNTRIES, line
        prec = {'S': 'site', 'C': 'city'}.get(kind, 'culture')
        e = dict(kind=kind, disp=disp, lat=lat, lon=lon, country=country,
                 reg=opts.get('reg', COUNTRIES[country]['reg']),
                 r=int(opts.get('r', 75 if kind in 'SC' else 200)), prec=prec)
        for a in al.split(';'):
            a = norm(a).strip()
            assert a and (a not in ALIASES or ALIASES[a]['kind'] != 'K' or kind == 'K'), (a, line)
            ALIASES[a] = e
    for line in VARIANTS_TXT.strip().splitlines():
        a, country, ll, disp = line.split('|')[:4]
        rr = int(line.split('|')[4]) if line.count('|') > 3 else 200
        lat, lon = map(float, ll.split(','))
        assert country in COUNTRIES, line
        a = norm(a).strip()
        VARIANTS[a][country] = dict(kind='V', disp=disp, lat=lat, lon=lon, country=country,
                                    reg=COUNTRIES[country]['reg'], r=rr, prec='culture')
        if a not in ALIASES:   # empire-wide label: only usable through its variants
            ALIASES[a] = dict(kind='E', disp=a, country=None)


_build_gazetteer()
_ALIAS_RE = re.compile(' (' + '|'.join(re.escape(a) for a in sorted(ALIASES, key=len, reverse=True)) + r")(?:'s)?(?= )")
PREC_RANK = {'site': 3, 'city': 3, 'culture': 2, 'country': 1}


def find_aliases(text):
    """All gazetteer aliases in normalized text, longest match first, in order."""
    out, pos = [], 0
    while True:
        m = _ALIAS_RE.search(text, pos)
        if not m:
            return out
        out.append(m.group(1))
        pos = m.end()


def geocode(place_text, weak_text=''):
    """-> (entry, country, note) or (None, None, reason)."""
    t = norm(place_text)
    if '?' in (place_text or '') or REJECT_RE.search(t):
        return None, None, 'uncertain'
    t = BLOCK_RE.sub('  ', BLOCK_RE.sub('  ', t))
    names = find_aliases(t)
    wnames = find_aliases(BLOCK_RE.sub('  ', norm(weak_text))) if weak_text else []
    strong = [ALIASES[a] for a in names if ALIASES[a]['kind'] in 'KSCR']
    weak = [(a, ALIASES[a]) for a in names + wnames if ALIASES[a]['kind'] in 'WE']
    countries = []
    for e in strong:
        if e['country'] not in countries:
            countries.append(e['country'])
    if len(countries) > 1:
        return None, None, 'conflict'
    if countries:
        c = countries[0]
        best = max(strong, key=lambda e: (PREC_RANK[e['prec']], -e['r']))
        for a in wnames:           # style label naming a tighter place inside the stated region
            e = ALIASES[a]
            if (best['kind'] == 'R' and e['kind'] in 'SCR' and e['country'] == c
                    and (e['kind'] in 'SC' or e['r'] < best['r'])):
                return e, c, 'style'
        if best['prec'] == 'country':
            for a in wnames:       # a culture/style label that is itself a place in this country
                e = ALIASES[a]
                if e['kind'] in 'SCR' and e['country'] == c:
                    return e, c, 'style'
            for a, e in weak:
                if c in VARIANTS.get(a, {}):
                    return VARIANTS[a][c], c, 'variant'
                if e['kind'] == 'W' and e['country'] == c:
                    return e, c, 'weak'
        return best, c, 'strong'
    for a, e in weak:
        if e['kind'] == 'W' and a in names:    # culture named in the place text itself
            return e, e['country'], 'weak-only'
    return None, None, 'unresolved'


# ------------------------------------------------------------------- normalization
TYPE_RULES = [
    ('Print', r'\bprint|woodblock|engraving|etching|lithograph'),
    ('Photograph', r'photograph'),
    ('Drawing', r'\bdrawing|watercolor|portfolio'),
    ('Mask', r'\bmask'),
    ('Arms & Armor', r'\barms\b|armor|sword|dagger|helmet'),
    ('Jewelry', r'jewel|amulet|scarab|necklace|pendant|\bring\b|earring|ornament'),
    ('Manuscript', r'manuscript|bound volume|\bbook|calligraphy|folio|miniature painting'),
    ('Painting', r'painting|scroll|screen|thangka|icon\b|mosaic'),
    ('Textile', r'textile|lace|embroidery|garment|velvet|tapestry|carpet|\brug\b|costume|sampler|knitting|'
                r'coverings|weaving|tunic|kimono|robe'),
    ('Ceramic', r'ceramic|pottery|porcelain|earthenware|stoneware|terracotta|vessel|vase|\bjar\b|\bbowl\b|tile'),
    ('Glass', r'glass'),
    ('Lacquer', r'lacquer'),
    ('Jade & Hardstone', r'\bjade|glyptic|\bseals?\b|hardstone|netsuke'),
    ('Ivory & Bone', r'ivory|\bbone\b'),
    ('Furniture', r'furniture|furnishing|\bchair|\btable\b|\bchest\b|cabinet|\bstool\b|headrest|neckrest'),
    ('Metalwork', r'metalwork|silver|\bgold\b|bronze|enamel|\bcoins?\b|medal|brass|copper|iron'),
    ('Sculpture', r'sculpture|statue|figure|relief|funerary|stela|architectural|\bstone\b|\bwood\b|religious|'
                  r'ritual'),
]


GENERIC_TYPES = ('vessel', 'vessels', 'religious/ritual object', 'funerary object', 'funerary equipment',
                 'miscellaneous', 'decorative arts', 'tools and equipment', 'cosmetic objects', 'equipment',
                 'container', 'plaque', 'furnishings', 'costume and accessories', 'stone', 'wood', 'woodwork')
MEDIUM_RULES = [
    ('Ceramic', r'ceramic|pottery|porcelain|earthenware|stoneware|terracotta|terra cotta|clay|faience|fritware'),
    ('Textile', r'silk|wool|cotton|linen|camelid|fiber|feather|barkcloth|tapa'),
    ('Glass', r'glass'),
    ('Lacquer', r'lacquer'),
    ('Jade & Hardstone', r'jade|nephrite|agate|rock crystal|carnelian|lapis'),
    ('Ivory & Bone', r'ivory|\bbone\b|horn\b'),
    ('Metalwork', r'bronze|silver|gold|copper|brass|iron|pewter|tin\b|lead\b|steel|metal|electrum'),
    ('Sculpture', r'stone|wood|marble|limestone|alabaster|granite|basalt|gypsum|steatite|schist|travertine'),
]


def norm_type(*texts):
    if (texts[0] or '').lower() in GENERIC_TYPES:
        med = (texts[-1] or '').lower()
        for name, rx in MEDIUM_RULES:
            if re.search(rx, med):
                return name
    for t in texts:
        t = (t or '').lower()
        for name, rx in TYPE_RULES:
            if re.search(rx, t):
                return name
    return 'Other'


TYPE_SCORE = {'Sculpture': 10, 'Mask': 10.5, 'Ceramic': 9, 'Metalwork': 9, 'Arms & Armor': 9, 'Textile': 8,
              'Jewelry': 8, 'Furniture': 8.5, 'Glass': 8.5, 'Manuscript': 8.5, 'Painting': 8.5, 'Lacquer': 8.5,
              'Jade & Hardstone': 8, 'Ivory & Bone': 8.5, 'Other': 6.5, 'Drawing': 3, 'Print': 2, 'Photograph': 1}
PAPER = {'Print', 'Drawing', 'Photograph'}
DULL_RE = re.compile(r'fragment|sherd|shard|\bbeads?\b|\bcoin\b|spindle whorl|\bnail\b|\bpin\b|\bweight\b|'
                     r'\bseal impression|\bsample|\bborder\b|\binsertion\b|\bedging\b|\bband\b|\bleaf from|'
                     r'\bblade\b|\bpoint\b|\bflake\b|\btool\b|\bneedle', re.I)
SMALL_RE = re.compile(r'amulet|scarab|\bseal\b|\bbutton\b|\btsuba\b|sword guard|\bring\b|\bnetsuke|\binro\b|'
                      r'\bkozuka|\bmenuki|\bfuchi', re.I)

PERIOD_WORDS = ('dynasty period kingdom empire century reign ming qing tang song han yuan zhou shang edo meiji '
                'momoyama muromachi kamakura heian nara joseon goryeo silla ptolemaic coptic islamic ottoman '
                'safavid qajar mughal rajput gothic romanesque renaissance baroque rococo medieval viking '
                'carolingian ottonian merovingian frankish visigothic celtic hellenistic archaic classical '
                'geometric neolithic bronze age iron age predynastic pharaoh pharaonic buddha buddhist bodhisattva '
                'hindu shiva vishnu ganesha krishna jain quran qur\'an koran torah samurai kimono netsuke inro '
                'kachina totem tsuba noh kabuki daimyo shogun pagoda mandarin emperor louis napoleon tudor '
                'georgian victorian colonial federal shaker amish mosque church cathedral saint st madonna '
                'virgin christ crucifixion apostle angel athena zeus apollo aphrodite herakles hercules dionysos '
                'osiris isis horus anubis amun sekhmet bastet ushabti shabti canopic sarcophagus mummy pharaoh '
                'kylix amphora krater hydria lekythos oinochoe skyphos kouros sphinx centaur satyr '
                'kero stirrup spout chacmool hacha palma yoke kente nkisi reliquary guardian oba tankard stein '
                'majolica maiolica faience delftware celadon blue and white famille sancai raku imari satsuma '
                'cloisonne thangka mandala stupa lingam yaksha yakshi tirthankara lama vajra dragon phoenix '
                'samovar kovsh icon menorah hanukkah kiddush amitabha guanyin avalokiteshvara shakyamuni maitreya '
                'tara durga parvati lakshmi hanuman rama nataraja moctezuma quetzalcoatl tlaloc kannon jizo '
                'fudo daruma bes hathor ptah thoth sobek nefertiti akhenaten ramesses tutankhamun gilgamesh '
                'ishtar eros nike hermes artemis poseidon venus jupiter mars minerva bacchus cupid mithras '
                'ashurnasirpal sargon darius xerxes shah sultan caliph tsar czar kaiser rajah maharaja nawab '
                'cartonnage shawabty shawabti scarab akhenaton cartouche papyrus daedalic alabastron aryballos '
                'pyxis pyx dotaku haniwa serape aquamanile antiphonary gospel gospels psalter bible missal '
                'breviary magi lady kubera apsara apsaras nefertem santa kandila kast altar chalice crucifix '
                'cross monstrance triptych diptych sutra mihrab stela stele tiraz olla kero tapa moai tekoteko '
                'kachina katsina').split()
_LEAK_WORDS = set(w for w in PERIOD_WORDS if w)
_LEAK_WORDS.update(('book of the dead', 'cylinder seal', 'book of hours'))
for _a in ALIASES:
    if _a not in ('ur', 'dan', 'kom', 'ife', 'nok', 'mission', 'plains', 'southwest', 'pueblo', 'mino', 'kota',
                  'ica', 'lima', 'bahia', 'cham', 'hue', 'tours', 'derby', 'sale', 'amber', 'bali'):
        _LEAK_WORDS.add(_a)
_LEAK_RE = re.compile(' (' + '|'.join(re.escape(w) for w in sorted(_LEAK_WORDS, key=len, reverse=True)) +
                      r")(?:'s|s|n|ns|an|ian|ese)?(?= )")


PAREN_OK = set('one of a an pair set the two three four five six part lid cover recto verso front back left '
               'right fragment fragments top bottom detail and with from base stand box pieces side obverse '
               'reverse interior exterior model study sketch copy'.split())


def title_leaks(title):
    t = norm(title)
    for par in re.findall(r'\(([^)]*)\)', title or ''):   # vernacular object names: "(Jue)", "(kundu)"
        w = norm(par).split()
        if w and len(w) <= 3 and not any(x in PAREN_OK or x.isdigit() for x in w):
            return True
    return bool(_LEAK_RE.search(t) or re.search(r' \d{3,4} | \d+(st|nd|rd|th) ', t))


def date_label(y0, y1):
    def one(y):
        return '%d BCE' % -y if y < 0 else '%d CE' % y
    if y0 == y1:
        return one(y0)
    if y1 < 0:
        return '%d–%d BCE' % (-y0, -y1)
    if y0 < 0:
        return '%d BCE–%d CE' % (-y0, y1)
    return '%d–%d CE' % (y0, y1)


def era_of(y0, y1):
    return max(0, min(19, int(((y0 + y1) / 2 + 3000) // 250)))


JUNK_CULT = re.compile(r'unknown|unidentified|maker|weaver|carver|artist|embroiderer|goldsmith|silversmith|'
                       r'guild|made for|made in|excavat|minted|near |from |workshop|tomb|cemetery|court of|'
                       r'ceramicist|blacksmith|woman|\d', re.I)
CULT_KEY = re.compile(r'dynasty|period|kingdom|empire|style|culture|people|sultanate|school|horizon|phase', re.I)


def cma_culture_label(cstr, country):
    s = re.sub(r'\([^)]*\)', '', cstr)
    cands = []
    for tok in s.split(','):
        tok = ' '.join(tok.split())
        if not tok or JUNK_CULT.search(tok):
            continue
        n = norm(tok)
        rest = _ALIAS_RE.sub(lambda m: ' ' if ALIASES[m.group(1)]['kind'] in 'KSCR' else m.group(0), n)
        words = [w for w in rest.split() if w not in GEN_SKIP]
        if not words:
            continue
        cands.append(tok)
    for c in cands:
        if CULT_KEY.search(c):
            return c[:48]
    return cands[0][:48] if cands else ''


def place_label(entry, country):
    if entry['prec'] == 'country' or entry['disp'] == country:
        return country
    return '%s, %s' % (country, entry['disp'])


def base_record(src, oid, title, entry, country, y0, y1, **kw):
    rec = collections.OrderedDict()
    rec['id'] = '%s-%s' % (src, oid)
    rec['src'] = src
    rec['title'] = ' '.join((title or '').split())
    rec.update(img=kw['img'], thumb=kw['thumb'], url=kw['url'])
    rec['place'] = place_label(entry, country)
    cul = kw.get('culture') or ''
    rec['culture'] = '' if ALIASES.get(norm(cul).strip(), {}).get('kind') == 'K' else cul
    rec['country'] = country
    rec['region'] = entry['reg']
    rec['lat'] = round(entry['lat'], 2)
    rec['lon'] = round(entry['lon'], 2)
    rec['geoPrecision'] = entry['prec']
    rec['r_km'] = entry['r']
    rec['y0'], rec['y1'] = y0, y1
    rec['era'] = era_of(y0, y1)
    rec['dateLabel'] = date_label(y0, y1)
    rec['dateText'] = ' '.join((kw.get('date_text') or '').split())
    rec['medium'] = ' '.join((kw.get('medium') or '').split())[:140]
    rec['type'] = kw['type']
    rec['credit'] = kw['credit']
    rec['titleLeaks'] = title_leaks(rec['title'])
    rec['_placeRaw'] = kw.get('place_raw', '')
    return rec


COPY_RE = re.compile(r'\b(replica|reproduction|copy|cast of|facsimile|forgery|fake|souvenir|tourist|coins?|'
                     r'tetradrachm|drachm|stater|denarius|obol|solidus|dinar|dirham)\b', re.I)


def date_ok(y0, y1):
    return (isinstance(y0, int) and isinstance(y1, int) and y0 <= y1 and y1 - y0 <= MAX_SPAN
            and (y0 + y1) / 2 >= -3000 and y1 <= 2000)


def paren_dates_conflict(cstr, y0, y1, tol=60):
    """CMA culture strings often carry the period's own dates, e.g. "Ming dynasty (1368-1644)".
    If such ranges are present and none overlaps the object's dates, the record is inconsistent
    (usually a BCE/CE sign slip) and is dropped."""
    spans = []
    for par in re.findall(r'\(([^)]*\d[^)]*)\)', cstr):
        m = re.search(r'(\d{1,4})\s*(BCE|BC|CE|AD)?\s*[\u2013\u2014-]\s*(\d{1,4})\s*(BCE|BC|CE|AD)?', par)
        if not m:
            continue
        a, ea, b, eb = int(m.group(1)), m.group(2), int(m.group(3)), m.group(4)
        if eb in ('BCE', 'BC'):
            b = -b
            if ea not in ('CE', 'AD'):
                a = -a
        elif ea in ('BCE', 'BC'):
            a = -a
        if a <= b:
            spans.append((a, b))
    return bool(spans) and not any(a - tol <= y1 and y0 <= b + tol for a, b in spans)


def norm_cma(r, stats):
    y0, y1 = r.get('creation_date_earliest'), r.get('creation_date_latest')
    web = ((r.get('images') or {}).get('web') or {}).get('url')
    cult = (r.get('culture') or [''])[0] or ''
    if not web or not r.get('title') or not date_ok(y0, y1) or COPY_RE.search(r['title']):
        stats['cma:nodate/img'] += 1
        return None
    if r.get('type') in ('Coins', 'Forgery', 'Spindle Whorl', 'Portfolio', 'Photograph'):
        stats['cma:type'] += 1
        return None
    if paren_dates_conflict(cult, y0, y1):
        stats['cma:date-conflict'] += 1
        return None
    entry, country, note = geocode(cult)
    if not entry:
        stats['cma:' + note] += 1
        stats.setdefault('_unres', collections.Counter())[cult[:70]] += (note == 'unresolved')
        return None
    typ = norm_type(r.get('type'), r.get('technique'))
    return base_record('cma', r['id'], r['title'], entry, country, y0, y1, img=web, thumb=web,
                       url=r.get('url') or 'https://clevelandart.org/art/%s' % r.get('accession_number'),
                       culture=cma_culture_label(cult, country), date_text=r.get('creation_date'),
                       medium=(r.get('technique') or '').capitalize(), type=typ,
                       credit='Cleveland Museum of Art (CC0)', place_raw=cult)


# A sub-national AIC place must fall in a region its curatorial department plausibly covers;
# this catches homonyms (Toledo OH vs Spain, Cambridge MA vs UK, "Uri canton" vs Canton).
AIC_DEPT_REGIONS = {
    'Arts of the Americas': {'nam', 'mes', 'and', 'oce'},
    'Applied Arts of Europe': {'eur_s', 'eur_nw', 'eur_e'},
    'Painting and Sculpture of Europe': {'eur_s', 'eur_nw', 'eur_e'},
    'Arts of Africa': {'egy', 'ssa'},
    'Arts of Asia': {'eas', 'sas', 'sea', 'cas', 'wan'},
    'Arts of Greece, Rome, and Byzantium': {'eur_s', 'eur_e', 'wan', 'egy'},
}


def norm_aic(r, stats):
    y0, y1 = r.get('date_start'), r.get('date_end')
    place = r.get('place_of_origin') or ''
    if (not r.get('image_id') or not r.get('title') or not date_ok(y0, y1) or not place
            or COPY_RE.search(r['title'])):
        stats['aic:nodate/img/place'] += 1
        return None
    dept = r.get('department_title') or ''
    if norm(place).strip() == 'thebes' and 'Greece' in dept:
        stats['aic:ambiguous'] += 1
        return None
    style = r.get('style_title') or ''
    entry, country, note = geocode(place, style)
    if not entry:
        stats['aic:' + note] += 1
        stats.setdefault('_unres', collections.Counter())['AIC ' + place[:60]] += (note == 'unresolved')
        return None
    ok_regs = AIC_DEPT_REGIONS.get(dept)
    if ok_regs and entry['prec'] != 'country' and entry['reg'] not in ok_regs:
        stats['aic:dept-mismatch'] += 1     # e.g. "Toledo" (Ohio glass) or "New Lebanon" (Shaker, NY)
        return None
    typ = norm_type(r.get('artwork_type_title'), r.get('classification_title'), r.get('medium_display'))
    cul = re.sub(r'\s*\([^)]*\)', '', style).strip()
    if norm(cul).strip() in ('', 'pre columbian', 'south asian', 'southeast asian', 'himalayan',
                             'arts of the islamic world', 'islamic', 'medieval') or re.search(r'\d', cul):
        cul = ''
    elif cul == cul.lower():
        cul = cul.title()
    iiif = 'https://www.artic.edu/iiif/2/%s/full/%%s,/0/default.jpg' % r['image_id']
    return base_record('aic', r['id'], r['title'], entry, country, y0, y1, img=iiif % 843, thumb=iiif % 400,
                       url='https://www.artic.edu/artworks/%d' % r['id'], culture=cul,
                       date_text=r.get('date_display'), medium=r.get('medium_display'), type=typ,
                       credit='Art Institute of Chicago (CC0)', place_raw=place)


def norm_mia(r, stats):
    yy = parse_dated(r.get('dated'))
    place = r.get('country') or ''
    if COPY_RE.search(r.get('title') or '') or (yy and yy[0] > 1700 and 'ancient' in (r.get('culture') or '').lower()):
        stats['mia:copy'] += 1
        return None
    if (r.get('image') != 'valid' or r.get('rights_type') != 'Public Domain' or not r.get('title') or not yy
            or not date_ok(*yy) or not place or not r.get('id')):
        stats['mia:nodate/img/place'] += 1
        return None
    cul = r.get('culture') or ''
    entry, country, note = geocode(place, cul)
    if not entry:
        stats['mia:' + note] += 1
        stats.setdefault('_unres', collections.Counter())['MIA ' + place[:60]] += (note == 'unresolved')
        return None
    typ = norm_type(r.get('classification'), r.get('object_name'), r.get('medium'))
    oid = int(r['id'])
    img = 'https://%d.api.artsmia.org/%%s%d.jpg' % (oid % 7, oid)
    return base_record('mia', oid, r['title'], entry, country, yy[0], yy[1], img=img % '800/', thumb=img % '400/',
                       url='https://collections.artsmia.org/art/%d' % oid, culture=cul if len(cul) < 48 else '',
                       date_text=r.get('dated'), medium=r.get('medium'), type=typ,
                       credit='Minneapolis Institute of Art (public domain)', place_raw=place + ' / ' + cul)


# ------------------------------------------------------------------------ selection
def jitter(oid):
    return int(hashlib.md5(oid.encode()).hexdigest()[:6], 16) / 0xFFFFFF


def base_score(r):
    s = TYPE_SCORE.get(r['type'], 6)
    s += {'site': 2, 'city': 2, 'culture': 1.5, 'country': 0}[r['geoPrecision']]
    span = r['y1'] - r['y0']
    s += 1 if span <= 50 else 0.5 if span <= 100 else -1 if span > 200 else 0
    if DULL_RE.search(r['title']):
        s -= 7
    elif SMALL_RE.search(r['title']):
        s -= 2.5
    if not r['titleLeaks']:
        s += 0.5
    return s + 1.5 * jitter(r['id'])


def pick_cell(cands, cap, paper_left):
    chosen = []
    cnt = collections.Counter()
    pool = sorted(cands, key=lambda r: -r['_score'])[:400]
    while pool and len(chosen) < cap:
        def eff(r):
            title_key = ' '.join(norm(r['title']).split()[:2])
            return (r['_score'] - 3.0 * cnt['t:' + r['type']] - 2.5 * cnt['c:' + (r['culture'] or '-')]
                    - 2.0 * cnt['p:' + r['place']] - 2.0 * cnt['k:' + r['country']] - 0.8 * cnt['s:' + r['src']]
                    - 4.0 * cnt['w:' + title_key])
        best = max(pool, key=eff)
        pool.remove(best)
        if best['type'] in PAPER:
            if paper_left[0] <= 0 or cnt['paper']:
                continue
            paper_left[0] -= 1
            cnt['paper'] += 1
        if best['_score'] < 2 and len(chosen) >= 3:   # only dull leftovers remain
            break
        chosen.append(best)
        for k in ('t:' + best['type'], 'c:' + (best['culture'] or '-'), 'p:' + best['place'],
                  'k:' + best['country'], 's:' + best['src'],
                  'w:' + ' '.join(norm(best['title']).split()[:2])):
            cnt[k] += 1
    return chosen


def select(cands):
    cells = collections.defaultdict(list)
    for r in cands:
        r['_score'] = base_score(r)
        cells[(r['region'], r['era'])].append(r)

    def run(cap_of):
        paper_left = [int(PAPER_SHARE * 600)]
        out = []
        for key in sorted(cells, key=lambda k: (k[1], k[0])):
            out.extend(pick_cell(cells[key], cap_of(*key), paper_left))
        return out

    # Regions the sources barely cover keep the full cap everywhere.
    full = collections.Counter(r['region'] for r in run(lambda reg, e: CELL_CAP))
    thin = {reg for reg in REGIONS if full[reg] <= THIN_REGION}
    # Sparse early eras (before 1000 BCE) keep the full cap. From there on, the era with the
    # most objects is trimmed one notch at a time until the total fits, which flattens the
    # distribution over time; the two modern eras are floored higher (MIN_MODERN_CAP) and are
    # only trimmed below that to respect MODERN_SHARE.
    caps = {e: CELL_CAP for e in range(20)}
    floor = lambda e: MIN_MODERN_CAP if e >= 18 else MIN_MID_CAP  # noqa
    while True:
        out = run(lambda reg, e: CELL_CAP if reg in thin else caps[e])
        n_era = collections.Counter(r['era'] for r in out)
        if n_era[18] + n_era[19] > MODERN_SHARE * len(out) and caps[18] > 3:
            caps[18] -= 1
            caps[19] -= 1
            continue
        if len(out) > TARGET_MAX:
            late = [e for e in range(8, 20) if caps[e] > floor(e)]
            if late:
                caps[max(late, key=lambda e: (n_era[e], caps[e]))] -= 1
                continue
        return out, caps, sorted(thin)


# ---------------------------------------------------------------------- image check
def check_images(objs, sample=None):
    """GET (first bytes) each img/thumb URL; results are cached. Returns {url: ok}."""
    p = os.path.join(CACHE, 'imgcheck.json')
    res = json.load(open(p)) if os.path.exists(p) else {}
    urls = []
    for o in objs:
        for u in (o['img'], o['thumb']):
            if u not in res and u not in urls:
                urls.append(u)
    if sample:
        random.Random(7).shuffle(urls)
        urls = urls[:sample]
    for i, u in enumerate(urls):
        host = u.split('/')[2]
        _polite(host, 0.4)
        ok = False
        try:
            r = S.get(u, stream=True, timeout=40)
            head = b''
            if r.status_code == 200:
                for chunk in r.iter_content(2048):
                    head += chunk
                    if len(head) >= 4:
                        break
            ok = head[:2] == b'\xff\xd8' or head[:4] == b'\x89PNG'
            r.close()
        except Exception as e:  # noqa
            print('  img err', u, e, file=sys.stderr)
        res[u] = ok
        if i % 50 == 49:
            json.dump(res, open(p, 'w'))
            print('  checked %d/%d images' % (i + 1, len(urls)), file=sys.stderr)
    json.dump(res, open(p, 'w'))
    return res


# ----------------------------------------------------------------------------- main
def matrix(objs):
    m = collections.Counter((o['region'], o['era']) for o in objs)
    lines = ['        ' + ' '.join('%3d' % e for e in range(20)) + '   tot']
    for reg in REGIONS:
        row = [m[(reg, e)] for e in range(20)]
        lines.append('%-7s ' % reg + ' '.join('%3s' % (v or '.') for v in row) + '  %4d' % sum(row))
    tot = [sum(m[(reg, e)] for reg in REGIONS) for e in range(20)]
    lines.append('%-7s ' % 'total' + ' '.join('%3d' % v for v in tot) + '  %4d' % sum(tot))
    return '\n'.join(lines)


def main():
    args = sys.argv[1:]
    stats = collections.Counter()
    print('fetching (cached) ...', file=sys.stderr)
    cma, aic, mia = fetch_cma(), fetch_aic(), fetch_mia()
    cands, seen = [], set()
    for raw, fn in ((cma, norm_cma), (aic, norm_aic), (mia, norm_mia)):
        for r in raw:
            rec = fn(r, stats)
            if rec and rec['id'] not in seen:
                seen.add(rec['id'])
                cands.append(rec)
    unres = stats.pop('_unres', collections.Counter())
    print('raw: cma %d, aic %d, mia %d -> %d geocoded candidates' % (len(cma), len(aic), len(mia), len(cands)))
    print('dropped:', dict(stats))
    if '--report' in args:
        print('top unresolved place strings:')
        for k, v in unres.most_common(150):
            if v:
                print('   %4d  %s' % (v, k))
        m = collections.Counter((o['region'], o['era']) for o in cands)
        print('candidate matrix (all geocoded):')
        print(matrix(cands))

    objs, caps, thin = select(cands)
    if '--no-check' not in args:
        for _ in range(4):     # drop failures and refill until stable
            res = check_images(objs)
            bad = {o['id'] for o in objs if not (res.get(o['img']) and res.get(o['thumb']))}
            if not bad:
                break
            print('dropping %d objects with failing images' % len(bad))
            cands = [c for c in cands if c['id'] not in bad]
            objs, caps, thin = select(cands)
    objs.sort(key=lambda o: (list(REGIONS).index(o['region']), o['era'], o['id']))
    for o in objs:
        o.pop('_score', None)
        o.pop('_placeRaw', None)

    by = lambda k: dict(collections.Counter(o[k] for o in objs).most_common())  # noqa
    meta = collections.OrderedDict([
        ('built', datetime.date.today().isoformat()),
        ('count', len(objs)),
        ('sources', {'cma': 'Cleveland Museum of Art Open Access API (CC0)',
                     'aic': 'Art Institute of Chicago API (CC0 data, public-domain images)',
                     'mia': 'Minneapolis Institute of Art collection search (CC0 data, public-domain images)'}),
        ('note', 'Held-out practice set. Contains no Metropolitan Museum objects.'),
        ('regions', REGIONS),
        ('eraFormula', 'era = clamp(floor(((y0+y1)/2 + 3000) / 250), 0, 19)'),
        ('bySource', by('src')), ('byRegion', by('region')),
        ('byEra', {str(e): sum(1 for o in objs if o['era'] == e) for e in range(20)}),
        ('byType', by('type')), ('byGeoPrecision', by('geoPrecision')),
        ('titleLeaks', sum(1 for o in objs if o['titleLeaks'])),
        ('cellCaps', {str(e): c for e, c in caps.items()}),
        ('untrimmedRegions', thin),
        ('matrix', {reg: [sum(1 for o in objs if o['region'] == reg and o['era'] == e) for e in range(20)]
                    for reg in REGIONS}),
    ])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump({'meta': meta, 'objects': objs}, f, ensure_ascii=False, indent=0, separators=(',', ':'))
    n = len(objs)
    print('\nwrote %s: %d objects' % (os.path.normpath(OUT), n))
    print(matrix(objs))
    print('by source:', meta['bySource'])
    print('by type:', meta['byType'])
    print('geoPrecision:', {k: '%d (%.0f%%)' % (v, 100 * v / n) for k, v in meta['byGeoPrecision'].items()})
    print('eras 18-19 share: %.1f%%' % (100 * sum(1 for o in objs if o['era'] >= 18) / n))
    print('paper share: %.1f%%' % (100 * sum(1 for o in objs if o['type'] in PAPER) / n))
    print('titleLeaks: %d (%.0f%%)' % (meta['titleLeaks'], 100 * meta['titleLeaks'] / n))
    print('cell caps by era:', caps, '| never trimmed:', thin)


if __name__ == '__main__':
    main()
