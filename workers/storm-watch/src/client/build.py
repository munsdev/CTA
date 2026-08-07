#!/usr/bin/env python3
# Assembles the complete Storm Watch client into public/index.html
# Run from the project root:  python3 src/client/build.py
import os
HERE = os.path.dirname(os.path.abspath(__file__))           # src/client
ROOT = os.path.dirname(os.path.dirname(HERE))               # project root
def read(name): return open(os.path.join(HERE, name)).read()

data = read('data.js')
engine = read('engine.js')
engine = '\n'.join(l for l in engine.split('\n')
                   if 'module.exports' not in l and 'typeof module' not in l)
logic = read('sm.js') + '\n' + read('ui.js')                # state machine + UI

HEAD = '''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bird Rebels: Storm Watch</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{font-family:'Barlow Condensed',Impact,sans-serif;-webkit-text-size-adjust:100%}
  .sw[data-theme="dark"]{--bg:#0c0c0c;--panel:#141414;--card:#1e1e1e;--zone:#0d0d0d;--bd:#2a2a2a;--bd2:#333;--tx:#f0f0f0;--dim:#8a8a8a;--dim2:#555;--dim3:#6a6a6a;--ctx:#ececec;--cdim:#9a9a9a;--cbd:#303030;--atx:#f5c800;--head:#0a0a0a}
  .sw[data-theme="light"]{--bg:#e9e5db;--panel:#f7f5ef;--card:#ffffff;--zone:#e2ddcf;--bd:#d2cdbf;--bd2:#bdb7a5;--tx:#201e18;--dim:#6c6757;--dim2:#a8a08c;--dim3:#857f6e;--ctx:#22201a;--cdim:#6a6555;--cbd:#e4e0d4;--atx:#8a6d00;--head:#dcd6c6}
  ::-webkit-scrollbar{height:9px;width:8px;background:transparent}::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:5px}
  button{font-family:inherit;cursor:pointer}button:disabled{cursor:default}input,select{font-family:inherit}
  .bcard{transition:transform .14s ease, box-shadow .14s ease}
  @media (hover:hover){.bcard.sel:hover{transform:translateY(-6px)}}
  .ibtn{transition:background .12s,border-color .12s,color .12s,transform .08s}
  .ibtn:hover{filter:brightness(1.08)}.ibtn:active{transform:scale(.96)}
  .pulse{animation:pulse 1.6s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}
</style></head><body><div id="root"></div>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script>
const {useState,useEffect,useRef}=React; const h=React.createElement;
const Y='#f5c800',AMBER='#c8860a',GREEN='#2a7a3a',RED='#bb1a10',PURPLE='#7a1fa2';
const TBL={surf:'#1b2024',mat:'#0f1316',tx:'#edeae2',dim:'#8b9299',line:'#2d3439',felt:'#171c20'};
const PTC={Draw:"#0d4f9e","Hand size":"#5a1280",Modifier:"#8a3200",Substitute:"#1a5412","Substitute+":"#1a5412","Substitute2":"#155",Count:"#7a5800","Victory Points":"#7a5800"};
'''
TAIL = '''
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
</script></body></html>'''

full = HEAD + data + '\n\n' + engine + '\n\n' + logic + '\n' + TAIL
out = os.path.join(ROOT, 'public', 'index.html')
open(out, 'w').write(full)
print("Built", out, "-", len(full), "bytes")
