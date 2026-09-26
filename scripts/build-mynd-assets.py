#!/usr/bin/env python3
"""Build browser meshes from a local checkout of the pinned Teufel MYND sources.

Temporary build tools: cadquery-ocp==8.0.1.0.0 trimesh==5.1.0 numpy==2.5.3
mapbox-earcut==2.1.0 fast-simplification==0.2.0. No CAD conversion or upstream network requests at runtime.
Usage: python scripts/build-mynd-assets.py /path/to/mynd-hardware
Geometry: Teufel MYND, CC-BY-SA-4.0; see docs/mynd-speaker.md.
"""
import collections
import hashlib
import json
import math
import pathlib
import re
import sys

import mapbox_earcut
import numpy as np
import trimesh
from OCP.STEPControl import STEPControl_Reader
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED, TopAbs_SOLID
from OCP.TopLoc import TopLoc_Location

ROOT = pathlib.Path(sys.argv[1])
PROJECT = pathlib.Path(__file__).resolve().parents[1]
OUT = PROJECT / 'public/models/mynd'
OUT.mkdir(parents=True, exist_ok=True)
REVISION = '149d002334b0725fba03499079bdaf2e61c8ff36'
COLORS = {'pcb': '#b5232b', 'pads': '#b5ac7b', 'traces': '#cf3940', 'silk': '#eee6cd',
          'body': '#24282c', 'metal': '#aaaeb1', 'plastic': '#e4dccb', 'rubber': '#242529'}
CACHE = {}
SOURCES = {}


def source(path):
    SOURCES[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()


def parse(text):
    root, stack = [], []
    current = root
    for token in re.findall(r'"(?:\\.|[^"\\])*"|[()]|[^\s()]+', text):
        if token == '(':
            child = []; current.append(child); stack.append(current); current = child
        elif token == ')':
            current = stack.pop()
        else:
            current.append(json.loads(token) if token.startswith('"') else token)
    return root[0]


def children(node, key):
    return [x for x in node if isinstance(x, list) and x and x[0] == key]


def child(node, key, default=None):
    return next(iter(children(node, key)), default or [key])


def numbers(node):
    return np.array([float(x) for x in node[1:]])


def translation(v):
    m = np.eye(4); m[:3, 3] = v; return m


def rotation(angle, axis):
    return trimesh.transformations.rotation_matrix(math.radians(angle), axis)


def angle(node):
    return float(node[3]) if len(node) > 3 else 0


def ring_area(ring):
    return sum((ring[i][0]*ring[(i+1) % len(ring)][1]-ring[i][1]*ring[(i+1) % len(ring)][0]) for i in range(len(ring))) / 2


def extrude(rings, thickness, z=0):
    # Earcut uses cumulative ring ends; normals follow a CCW outer and CW holes.
    rings = [np.asarray(r, dtype=np.float64) for r in rings]
    rings = [r if (ring_area(r) > 0) == (i == 0) else r[::-1] for i, r in enumerate(rings)]
    v = np.concatenate(rings); n = len(v)
    triangles = mapbox_earcut.triangulate_float64(v, np.cumsum([len(r) for r in rings], dtype=np.uint32)).reshape(-1, 3)
    vertices = np.concatenate([np.c_[v, np.full(n,z)], np.c_[v,np.full(n,z+thickness)]])
    faces = [triangles[:, ::-1], triangles+n]; start = 0
    sides = []
    for ring in rings:
        for i in range(len(ring)):
            a = start+i; b = start+(i+1)%len(ring); sides.extend([[a,b,b+n],[a,b+n,a+n]])
        start += len(ring)
    faces.append(np.array(sides))
    return trimesh.Trimesh(vertices, np.concatenate(faces), process=False)


def circle(center, radius, count=24):
    a = np.arange(count)*math.tau/count
    return np.c_[np.cos(a),np.sin(a)]*radius+center


def step_mesh(path):
    key = hashlib.sha256(path.read_bytes()).hexdigest(); source(path)
    if key in CACHE:
        return CACHE[key]
    reader=STEPControl_Reader()
    if int(reader.ReadFile(str(path))) != 1: raise ValueError('Cannot read '+str(path))
    reader.TransferRoots(); shape=reader.OneShape()
    BRepMesh_IncrementalMesh(shape,0.12,False,0.4,True)
    explorer=TopExp_Explorer(shape,TopAbs_FACE); vertices=[]; faces=[]
    while explorer.More():
        face=TopoDS.Face(explorer.Current()); location=TopLoc_Location()
        triangulation=BRep_Tool.Triangulation_s(face,location)
        if triangulation:
            start=len(vertices); transform=location.Transformation()
            for i in range(1,triangulation.NbNodes()+1):
                p=triangulation.Node(i).Transformed(transform); vertices.append([p.X(),p.Y(),p.Z()])
            for i in range(1,triangulation.NbTriangles()+1):
                indices=list(triangulation.Triangle(i).Get())
                if face.Orientation()==TopAbs_REVERSED: indices.reverse()
                faces.append([start+j-1 for j in indices])
        explorer.Next()
    if not faces: raise ValueError('No triangles in '+str(path))
    mesh=trimesh.Trimesh(vertices,faces,process=False)
    mesh.merge_vertices(digits_vertex=5)
    if "ALTIUM_EMBEDDED_MODELS" in str(path):
        target=max(300,min(2500,int(max(mesh.extents)*100)))
        if len(mesh.faces)>target: mesh=mesh.simplify_quadric_decimation(face_count=target,aggression=5)
    CACHE[key]=mesh
    return mesh


def arc_points(node):
    a,b,c=[numbers(child(node,k)) for k in ['start','mid','end']]
    center=np.linalg.solve(2*np.array([b-a,c-a]),np.array([np.dot(b,b)-np.dot(a,a),np.dot(c,c)-np.dot(a,a)]))
    angles=[math.atan2(*(p-center)[::-1]) for p in [a,b,c]]
    sweep=(angles[2]-angles[0])%math.tau
    if (angles[1]-angles[0])%math.tau>sweep: sweep-=math.tau
    steps=max(3,math.ceil(abs(sweep)*np.linalg.norm(a-center)/0.5))
    phi=np.linspace(angles[0],angles[0]+sweep,steps+1)
    points=center+np.c_[np.cos(phi),np.sin(phi)]*np.linalg.norm(a-center)
    points[0]=a; points[-1]=c
    return points


def outline(board):
    paths=[]
    for key in ['gr_line','gr_arc','gr_rect','gr_circle']:
        for item in children(board,key):
            if child(item,'layer')[1:] != ['Edge.Cuts']: continue
            if key=='gr_line': paths.append(np.array([numbers(child(item,'start')),numbers(child(item,'end'))]))
            elif key=='gr_arc': paths.append(arc_points(item))
            elif key=='gr_rect':
                a,b=numbers(child(item,'start')),numbers(child(item,'end')); paths.append(np.array([a,[b[0],a[1]],b,[a[0],b[1]],a]))
            else:
                a,b=numbers(child(item,'center')),numbers(child(item,'end')); p=circle(a,np.linalg.norm(b-a)); paths.append(np.vstack([p,p[0]]))
    rings=[]
    while paths:
        ring=paths.pop().tolist()
        while np.linalg.norm(np.array(ring[0])-ring[-1])>0.01:
            found=False
            for i,path in enumerate(paths):
                if np.linalg.norm(np.array(ring[-1])-path[-1])<0.01: path=path[::-1]
                if np.linalg.norm(np.array(ring[-1])-path[0])<0.01:
                    ring.extend(path[1:].tolist()); paths.pop(i); found=True; break
            if not found: raise ValueError('Open PCB outline at '+str(ring[-1]))
        rings.append(np.array(ring[:-1]))
    return sorted(rings,key=lambda ring: abs(ring_area(ring)),reverse=True)


def export(name, groups, metadata):
    scene=trimesh.Scene()
    for material,meshes in groups.items():
        if not meshes: continue
        merged=trimesh.util.concatenate(meshes)
        # Vectorised angle-weighted normals avoid an optional SciPy dependency.
        normals=np.zeros_like(merged.vertices)
        for corner in range(3):
            np.add.at(normals,merged.faces[:,corner],merged.face_normals*merged.face_angles[:,corner,None])
        lengths=np.linalg.norm(normals,axis=1)
        merged.vertex_normals=normals/np.maximum(lengths[:,None],1e-12)
        color=COLORS.get(material,material)
        merged.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=material,baseColorFactor=[int(color[i:i+2],16) for i in [1,3,5]]+[255],metallicFactor=0.65 if material in ['metal','pads'] else 0,roughnessFactor=0.4 if material=='metal' else 0.7))
        scene.add_geometry(merged,node_name=material,geom_name=material)
    data=scene.export(file_type='glb',include_normals=True); (OUT/(name+'.glb')).write_bytes(data)
    metadata.update(file=name+'.glb',bytes=len(data),triangles=sum(len(m.faces) for m in scene.geometry.values()),bounds=scene.bounds.tolist())
    print(name,metadata['triangles'],'triangles',len(data),'bytes',flush=True)
    return metadata


def board_asset(folder):
    path=next((ROOT/'PCB_Schematics/KiCad'/folder).glob('*.kicad_pcb'));source(path)
    board=parse(path.read_text()); rings=outline(board); all_points=np.concatenate(rings)
    minimum,maximum=all_points.min(axis=0),all_points.max(axis=0); center=(minimum+maximum)/2
    thickness=float(child(child(board,'general'),'thickness')[1]); groups=collections.defaultdict(list)
    # Board-local coordinates are X right, Y up and component side +Z. Origin is
    # centred on the source outline, with the substrate centred about Z=0.
    local=lambda p: (np.asarray(p)-center)*[1,-1]
    local_rings=[local(r) for r in rings]
    mounts=[]; components=0; missing=[]; model_files=set()
    for footprint in children(board,'footprint'):
        at=child(footprint,'at'); pos=np.array([float(at[1])-center[0],center[1]-float(at[2]),0])
        bottom=child(footprint,'layer')[1]=='B.Cu'; footprint_rotation=rotation(angle(at),[0,0,1])
        fp=translation(pos)@footprint_rotation
        # Pad coordinates already reflect the bottom footprint in the KiCad file.
        for pad in children(footprint,'pad'):
            pad_at=child(pad,'at',['at','0','0']); x,y=map(float,pad_at[1:3])
            size=numbers(child(pad,'size')); drill=child(pad,'drill')
            center_pad=(fp@np.array([x,-y,0,1]))[:2]
            if len(drill)>1 and drill[1] != 'oval' and float(drill[1])>=2:
                radius=float(drill[1])/2
                if not any(np.linalg.norm(center_pad-np.array(m[:2]))<0.02 for m in mounts):
                    mounts.append([*center_pad.tolist(),radius*2]);local_rings.append(circle(center_pad,radius))
            if pad[2]=='np_thru_hole': continue
            layers=child(pad,'layers')[1:]
            if not any(layer in ['F.Cu','B.Cu','*.Cu'] for layer in layers):continue
            w,h=size[:2]
            r=circle([0,0],w/2,12) if pad[3]=='circle' else np.array([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]])
            pad_rings=[r]
            if len(drill)>1 and drill[1] != "oval" and 0<float(drill[1])<min(w,h):
                pad_rings.append(circle([0,0],float(drill[1])/2,16))
            for back in ([False,True] if '*.Cu' in layers else [bottom]):
                mesh=extrude(pad_rings,0.035,(-thickness/2-0.04) if back else thickness/2+0.005)
                mesh.apply_transform(fp@translation([x,-y,0])@rotation(angle(pad_at)-angle(at),[0,0,1]));groups['pads'].append(mesh)
        for model in children(footprint,'model'):
            relative=model[1].replace('${KIPRJMOD}/',''); model_path=path.parent/relative
            if not model_path.is_file(): missing.append(relative);continue
            mesh=step_mesh(model_path).copy(); model_files.add(str(model_path.relative_to(ROOT)))
            orient=numbers(child(child(model,'rotate'),'xyz',['xyz','0','0','0']))
            offset=numbers(child(child(model,'offset'),'xyz',['xyz','0','0','0']));offset[2]+=thickness/2+0.04
            scale=numbers(child(child(model,'scale'),'xyz',['xyz','1','1','1']))
            transform=fp@(rotation(180,[1,0,0]) if bottom else np.eye(4))@translation(offset)
            transform=transform@rotation(-orient[2],[0,0,1])@rotation(-orient[1],[0,1,0])@rotation(-orient[0],[1,0,0])@np.diag([*scale,1])
            mesh.apply_transform(transform)
            filename=model_path.name.lower()
            material='metal' if ('chip.stp' in filename or 'usb' in filename or 'dx07' in filename or 'hdr-' in filename) else 'plastic' if ('6100' in filename or 'a2501' in filename or 'phb-' in filename) else 'body'
            groups[material].append(mesh);components+=1
        for line in children(footprint,'fp_line'):
            layer=child(line,'layer')[1:]
            if layer not in [['F.SilkS'],['B.SilkS']]:continue
            p,q=numbers(child(line,'start')),numbers(child(line,'end'))
            delta=q-p;length=np.linalg.norm(delta)
            if length<0.02:continue
            mid=(p+q)/2;width=float(child(child(line,'stroke'),'width',['width','0.15'])[1])
            mesh=trimesh.creation.box([length,max(width,0.08),0.015])
            mesh.apply_transform(fp@translation([mid[0],-mid[1],(-1 if bottom else 1)*(thickness/2+0.06)])@rotation(-math.degrees(math.atan2(delta[1],delta[0])),[0,0,1]));groups['silk'].append(mesh)
    groups['pcb'].append(extrude(local_rings,thickness,-thickness/2))
    return export('pcb-'+folder.lower().replace('_','-'),groups,{'kind':'source-pcb','source':str(path.relative_to(ROOT)),'outlineSize':(maximum-minimum).tolist(),'sourceOrigin':center.tolist(),'thickness':thickness,'mounts':mounts,'components':components,'missingModels':sorted(set(missing)),'modelFiles':sorted(model_files)})


manifest={'repository':'https://github.com/teufelaudio/mynd-hardware','revision':REVISION,'license':'CC-BY-SA-4.0','units':'mm','assets':{}}
for folder in ['Main','Amp','Bluetooth','UI','Jack_USB','Jack_Line_In','Conn_Bat','Conn_Amp','Conn_Baffle']:
    manifest['assets'][folder]=board_asset(folder)
# Retain source assembly coordinates; placements explicitly convert X,Y,Z to
# scene X,Z,-Y instead of silently recentering independent mechanical parts.
for name,id in [('PR Frame','radiator-frames'),('Port housing','port-housing'),('HMI cover','hmi-cover'),('Rubber HMI pad','hmi-pad')]:
    path=ROOT/('CAD/STP/MYND Print parts '+name+'.stp')
    mesh=step_mesh(path).copy()
    manifest['assets'][id]=export(id,{'rubber' if name.startswith('Rubber') else 'body':[mesh]},{'kind':'source-mechanical','source':str(path.relative_to(ROOT))})
manifest['sourceSha256']=SOURCES
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'README.txt').write_text('Teufel MYND hardware, CC-BY-SA-4.0\nhttps://github.com/teufelaudio/mynd-hardware/tree/'+REVISION+'\nConverted by Acryl508: tessellated STEP component and mechanical models; PCB outlines, pads and silkscreen from KiCad. Simplified display materials. Millimetres. See manifest.json and docs/mynd-speaker.md for provenance and placement limitations.\n')
(OUT/'LICENSE.txt').write_bytes((PROJECT/'docs/mynd-hardware-LICENSE.txt').read_bytes())
