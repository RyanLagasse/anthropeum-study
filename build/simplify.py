import json, os, math

def thin(ring, minsp=0.25):
    if len(ring) <= 8: return [[round(x,2), round(y,2)] for x,y in ring]
    out = [ring[0]]
    for p in ring[1:-1]:
        q = out[-1]
        if abs(p[0]-q[0]) + abs(p[1]-q[1]) >= minsp:
            out.append(p)
    out.append(ring[0])
    return [[round(x,2), round(y,2)] for x,y in out]

def bbox_small(ring, t=0.6):
    xs=[p[0] for p in ring]; ys=[p[1] for p in ring]
    return (max(xs)-min(xs)) < t and (max(ys)-min(ys)) < t

def simp_poly(coords):
    rings=[]
    for i,r in enumerate(coords):
        if i>0 and (len(r)<6 or bbox_small(r,1.2)): continue  # drop small holes
        if i==0 or not bbox_small(r):
            rr=thin(r)
            if len(rr)>=4: rings.append(rr)
    return rings if rings else None

result={}
for fn in sorted(os.listdir('basemaps')):
    year = fn.replace('world_','').replace('.geojson','')
    gj = json.load(open(f'basemaps/{fn}'))
    feats=[]
    for f in gj['features']:
        g=f['geometry']; props=f.get('properties') or {}
        name = props.get('NAME') or ''
        sub = props.get('SUBJECTO') or ''
        if not g: continue
        if g['type']=='Polygon':
            polys=[g['coordinates']]
        elif g['type']=='MultiPolygon':
            polys=g['coordinates']
        else: continue
        newpolys=[]
        for poly in polys:
            if not poly or bbox_small(poly[0]):  # drop tiny islands
                continue
            sp=simp_poly(poly)
            if sp: newpolys.append(sp)
        if not newpolys: continue
        geom = {'type':'Polygon','coordinates':newpolys[0]} if len(newpolys)==1 else {'type':'MultiPolygon','coordinates':newpolys}
        feats.append({'type':'Feature','properties':{'n':name,'s':sub},'geometry':geom})
    result[year]={'type':'FeatureCollection','features':feats}
    print(year, len(feats), 'features')

js = 'const BORDERS = ' + json.dumps(result, separators=(',',':')) + ';\n'
open('borders_data.js','w').write(js)
print('total size:', os.path.getsize('borders_data.js'))
