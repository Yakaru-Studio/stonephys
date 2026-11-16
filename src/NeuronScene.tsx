import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  FrontSide,
  IcosahedronGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
  type Group,
  type Mesh,
} from 'three'

const COOL='#66809e'
type ModelData={surface:BufferGeometry;edges:BufferGeometry;facets:BufferGeometry;interior:BufferGeometry;filaments:BufferGeometry[];filamentHalos:BufferGeometry[];twigs:BufferGeometry[];tips:Vector3[];rootPoints:Vector3[];lightPoints:Vector3[]}

function seeded(seed:number){const value=Math.sin(seed*127.1+311.7)*43758.5453;return value-Math.floor(value)}
function taperedTube(points:Vector3[],rootRadius:number,withGlowGradient=false,tipBlend=.012){
  const curve=new CatmullRomCurve3(points,false,'centripetal')
  const segments=48, radialSegments=7, frames=curve.computeFrenetFrames(segments,false)
  const positions:number[]=[],indices:number[]=[],glowValues:number[]=[],alongValues:number[]=[]
  for(let i=0;i<=segments;i++){
    const t=i/segments,center=curve.getPointAt(t)
    const radius=rootRadius*(tipBlend+(1-tipBlend)*Math.pow(1-t,1.35))
    for(let j=0;j<radialSegments;j++){
      const angle=j/radialSegments*Math.PI*2
      const normal=frames.normals[i].clone().multiplyScalar(Math.cos(angle))
        .add(frames.binormals[i].clone().multiplyScalar(Math.sin(angle)))
      positions.push(center.x+normal.x*radius,center.y+normal.y*radius,center.z+normal.z*radius)
      glowValues.push(.035+.82*Math.pow(1-t,1.15));alongValues.push(t)
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<radialSegments;j++){
    const a=i*radialSegments+j,b=i*radialSegments+(j+1)%radialSegments,c=(i+1)*radialSegments+(j+1)%radialSegments,d=(i+1)*radialSegments+j
    indices.push(a,b,d,b,c,d)
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3))
  if(withGlowGradient){geometry.setAttribute('aGlow',new BufferAttribute(new Float32Array(glowValues),1));geometry.setAttribute('aAlong',new BufferAttribute(new Float32Array(alongValues),1))}
  geometry.setIndex(indices);geometry.computeVertexNormals()
  return geometry
}

function buildModel(progress:number):ModelData{
  const level=Math.min(4,Math.round(progress/25))
  const growth=level/4
  const extension=1
  // A low-detail geodesic shell adds subtle triangular facets while keeping
  // the soma rounded and membrane-like.
  const surface=new IcosahedronGeometry(61,1)
  const position=surface.getAttribute('position')
  const colors:number[]=[]
  const anchors:Vector3[]=[]
  const seen=new Set<string>()

  for(let i=0;i<position.count;i++){
    const vertex=new Vector3().fromBufferAttribute(position,i)
    const key=`${vertex.x.toFixed(2)},${vertex.y.toFixed(2)},${vertex.z.toFixed(2)}`
    if(!seen.has(key)){
      seen.add(key)
      const wobble=.985+seeded(Math.round(vertex.x*17+vertex.y*31+vertex.z*43))*.03
      vertex.multiplyScalar(wobble);vertex.x*=1.025;vertex.y*=.97;vertex.z*=1.04
      anchors.push(vertex)
      position.setXYZ(i,vertex.x,vertex.y,vertex.z)
    }else{
      const wobble=.985+seeded(Math.round(vertex.x*17+vertex.y*31+vertex.z*43))*.03
      vertex.multiplyScalar(wobble);vertex.x*=1.025;vertex.y*=.97;vertex.z*=1.04
      position.setXYZ(i,vertex.x,vertex.y,vertex.z)
    }
    const facing=.8+Math.max(0,vertex.z/61)*.26+seeded(i+11)*.1
    colors.push(facing, facing*.88, facing*.68)
  }
  surface.setAttribute('color',new BufferAttribute(new Float32Array(colors),3))
  surface.computeVertexNormals()

  // Sparse, gently curved membrane seams wrap around the soma. Unlike a
  // triangulated front plate, these stay distributed over the 3D surface.
  const shellNodes=[
    new Vector3(-.72,.62,.48),new Vector3(-.12,.92,.37),new Vector3(.62,.67,.42),
    new Vector3(.94,.08,.29),new Vector3(.70,-.62,.36),new Vector3(.08,-.94,.34),
    new Vector3(-.63,-.70,.40),new Vector3(-.96,-.12,.30),new Vector3(-.38,.12,-.92),
    new Vector3(.48,.18,-.86),new Vector3(.36,-.50,-.78),new Vector3(-.25,-.62,-.74),
  ].map((v)=>v.normalize().multiplyScalar(61))
  const links=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[0,2],[2,4],[4,6],[6,0],[8,9],[9,10],[10,11],[11,8],[1,9],[5,10]]
  const edgeValues:number[]=[]
  for(const [ai,bi] of links){
    const a=shellNodes[ai],b=shellNodes[bi],mid=a.clone().add(b).normalize().multiplyScalar(61.5)
    mid.add(new Vector3(seeded(ai*13+bi)*4-2,seeded(bi*17+ai)*4-2,seeded(ai+bi*7)*4-2))
    const curve=new CatmullRomCurve3([a,mid,b],false,'centripetal')
    const samples=curve.getPoints(10)
    for(let i=0;i<samples.length-1;i++)edgeValues.push(...samples[i].toArray(),...samples[i+1].toArray())
  }
  const edges=new BufferGeometry();edges.setAttribute('position',new BufferAttribute(new Float32Array(edgeValues),3))
  const facets=new BufferGeometry()

  // A handful of inward struts suggest depth without turning the shell into a wire cage.
  const interiorValues:number[]=[]
  const anchorIndices=[3,24]
  anchorIndices.forEach((index,i)=>{
    const point=anchors[index%anchors.length]
    const inner=new Vector3(point.x*.37+(i%2?7:-6),point.y*.34,point.z*.31)
    interiorValues.push(point.x,point.y,point.z,inner.x,inner.y,inner.z)
  })
  const interior=new BufferGeometry();interior.setAttribute('position',new BufferAttribute(new Float32Array(interiorValues),3))

  const directions=[
    new Vector3(-.78,.53,.38),new Vector3(-.25,.96,-.16),new Vector3(.48,.74,.53),
    new Vector3(.97,.18,.08),new Vector3(.74,-.34,.61),new Vector3(-.54,-.62,-.55),
    new Vector3(-.95,.12,-.18),new Vector3(.36,-.88,.24),
  ].map(v=>v.normalize()).slice(0,4+level)
  const filaments:BufferGeometry[]=[],filamentHalos:BufferGeometry[]=[],twigs:BufferGeometry[]=[],tips:Vector3[]=[],rootPoints:Vector3[]=[]
  directions.forEach((direction,i)=>{
    const tangent=new Vector3(-direction.z,seeded(i+15)-.5,direction.x).normalize()
    const lateral=direction.clone().cross(tangent).normalize()
    const length=74+seeded(i+71)*58
    const start=direction.clone().multiplyScalar(58)
    rootPoints.push(start.clone())
    const bend1=(seeded(i+2)-.5)*32
    const bend2=bend1*1.1+(seeded(i+3)-.5)*36
    const bend3=bend2*.8+(seeded(i+31)-.5)*30
    const bend4=bend3*.7+(seeded(i+4)-.5)*24
    const sway=(seeded(i+61)-.5)*25
    const lift=new Vector3(0,0,(seeded(i+51)-.5)*26)
    const fullP1=direction.clone().multiplyScalar(75+seeded(i+8)*10).add(tangent.clone().multiplyScalar(bend1)).add(lateral.clone().multiplyScalar(sway*.12)).add(lift.clone().multiplyScalar(.25))
    const fullP2=direction.clone().multiplyScalar(92+length*.34).add(tangent.clone().multiplyScalar(bend2)).add(lateral.clone().multiplyScalar(sway*.68)).add(lift.clone().multiplyScalar(.65))
    const fullP3=direction.clone().multiplyScalar(108+length*.65).add(tangent.clone().multiplyScalar(bend3)).add(lateral.clone().multiplyScalar(sway)).add(lift.clone())
    const fullTip=direction.clone().multiplyScalar(61+length).add(tangent.clone().multiplyScalar(bend4)).add(lateral.clone().multiplyScalar(sway*.55)).add(lift.clone().multiplyScalar(1.2))
    const p1=start.clone().lerp(fullP1,extension),p2=start.clone().lerp(fullP2,extension)
    const p3=start.clone().lerp(fullP3,extension),tip=start.clone().lerp(fullTip,extension)
    const branchPoints=[start,p1,p2,p3,tip]
    const tipBlend=.3-growth*.27
    filaments.push(taperedTube(branchPoints.map(point=>point.clone().sub(start)),4.8-growth*2.6+seeded(i+45)*.2,false,tipBlend))
    filamentHalos.push(taperedTube(branchPoints.map(point=>point.clone().sub(start)),8-growth*1.8,true,tipBlend));tips.push(tip.clone().sub(start))
    if(level>=2&&(i===0||i===2||i===4||i===6)){
      const forkAt=p2.clone().lerp(tip,.18)
      const forkDirection=tangent.clone().multiplyScalar(i%2?1:-1).add(direction.clone().multiplyScalar(.15)).normalize()
      const forkTip=forkAt.clone().add(forkDirection.clone().multiplyScalar(24+seeded(i+57)*24)).add(direction.clone().multiplyScalar(10))
      const forkMid=forkAt.clone().add(forkDirection.clone().multiplyScalar(12)).add(direction.clone().multiplyScalar(7))
      twigs.push(taperedTube([forkAt,forkAt.clone().lerp(forkMid,growth),forkAt.clone().lerp(forkTip,growth)],.16+growth*.22,false,.12))
    }
  })
  const lightPoints=[0,4,9].map(i=>shellNodes[i])
  return {surface,edges,facets,interior,filaments,filamentHalos,twigs,tips,rootPoints,lightPoints}
}

function NeuralVolume({active,pulse,progress}:{active:boolean;pulse:number;progress:number}){
  const group=useRef<Group>(null)
  const wave=useRef<Mesh>(null)
  const branchGroups=useRef<(Group|null)[]>([])
  const growthCurrent=useRef(Math.min(1,Math.round(progress/25)/4))
  const energyBurst=useRef(0)
  const impulse=useRef(0)
  const model=useMemo(()=>buildModel(progress),[progress])
  useEffect(()=>{if(pulse){impulse.current=.32;energyBurst.current=1}},[pulse])
  useEffect(()=>()=>{
    model.surface.dispose();model.edges.dispose();model.facets.dispose();model.interior.dispose()
    model.filaments.forEach(g=>g.dispose());model.filamentHalos.forEach(g=>g.dispose());model.twigs.forEach(g=>g.dispose())
  },[model])
  useFrame(({clock},delta)=>{
    if(!group.current)return
    const t=clock.elapsedTime
    group.current.rotation.x=.2+Math.sin(t*.29)*.045
    group.current.rotation.y=-.16+Math.cos(t*.23)*.06
    group.current.rotation.z=Math.sin(t*.17)*.025
    impulse.current=Math.max(0,impulse.current-delta)
    const swell=impulse.current>0?Math.sin((.32-impulse.current)/.32*Math.PI)*.04:0
    const breath=1+Math.sin(t*.8)*.007+swell
    group.current.scale.set(breath,breath,breath)
    const targetGrowth=Math.min(1,Math.round(progress/25)/4)
    growthCurrent.current+=(targetGrowth-growthCurrent.current)*(1-Math.exp(-4.5*delta))
    branchGroups.current.forEach(branch=>branch?.scale.setScalar(.34+growthCurrent.current*.66))
    energyBurst.current=Math.max(0,energyBurst.current-delta*1.2)
    if(wave.current){
      wave.current.scale.setScalar(1.018+(1-energyBurst.current)*.68)
      energyWaveMaterial.uniforms.uBurst.value=energyBurst.current
      gradientHaloMaterial.uniforms.uBurst.value=energyBurst.current
    }
  })
  const tint=active?'#e5a344':COOL
  const growth=Math.min(1,Math.round(progress/25)/4)
  const shell=useMemo(()=>new MeshBasicMaterial({
    color:active?'#80501e':'#273446',vertexColors:false,transparent:true,opacity:active?.035:.66,
    depthWrite:false,
  }),[active])
  const fresnel=useMemo(()=>new ShaderMaterial({
    uniforms:{uColor:{value:new Color(active?'#ffc45f':'#56657a')},uOpacity:{value:active?(.5+growth*.45):.035}},
    vertexShader:`varying vec3 vViewNormal; varying vec3 vViewDirection; varying vec3 vLocalPosition; void main(){ vec4 viewPosition=modelViewMatrix*vec4(position,1.0); vViewNormal=normalize(normalMatrix*normal); vViewDirection=normalize(-viewPosition.xyz); vLocalPosition=position; gl_Position=projectionMatrix*viewPosition; }`,
    fragmentShader:`uniform vec3 uColor; uniform float uOpacity; varying vec3 vViewNormal; varying vec3 vViewDirection; varying vec3 vLocalPosition; void main(){ float facing=clamp(1.0-abs(dot(normalize(vViewNormal),normalize(vViewDirection))),0.0,1.0); float edge=pow(facing,2.25); float grain=sin(vLocalPosition.x*.16+sin(vLocalPosition.y*.13))*sin(vLocalPosition.z*.17+vLocalPosition.y*.09); float membrane=0.012+edge*.62+grain*.006; gl_FragColor=vec4(uColor,membrane*uOpacity); }`,
    transparent:true,depthWrite:false,side:FrontSide,blending:active?AdditiveBlending:undefined,toneMapped:false,
  }),[active,growth])
  const shellAura=useMemo(()=>new ShaderMaterial({
    uniforms:{uColor:{value:new Color(active?'#ffad3d':'#56657a')},uOpacity:{value:active?.2:.012}},
    vertexShader:`varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform vec3 uColor;uniform float uOpacity;varying vec3 vNormal;varying vec3 vView;void main(){float rim=1.0-abs(dot(normalize(vNormal),normalize(vView)));float halo=pow(clamp(rim,0.0,1.0),1.35);gl_FragColor=vec4(uColor,halo*uOpacity);}`,
    transparent:true,depthWrite:false,side:FrontSide,blending:AdditiveBlending,toneMapped:false,
  }),[active])
  const energyWaveMaterial=useMemo(()=>new ShaderMaterial({
    uniforms:{uColor:{value:new Color('#ffd27c')},uBurst:{value:0}},
    vertexShader:`varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform vec3 uColor;uniform float uBurst;varying vec3 vNormal;varying vec3 vView;void main(){float rim=1.0-abs(dot(normalize(vNormal),normalize(vView)));float glow=pow(clamp(rim,0.0,1.0),2.0);gl_FragColor=vec4(uColor,glow*uBurst*.82);}`,
    transparent:true,depthWrite:false,side:FrontSide,blending:AdditiveBlending,toneMapped:false,
  }),[])
  const membrane=useMemo(()=>new ShaderMaterial({
    uniforms:{uColor:{value:new Color('#b97832')},uOpacity:{value:.9}},
    vertexShader:`varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 uColor;uniform float uOpacity;varying vec3 vNormal;varying vec3 vPosition;float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}vec3 hash3(vec3 p){return vec3(hash(p),hash(p+19.19),hash(p+47.47));}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float cellTexture(vec3 p){vec3 cell=floor(p),local=fract(p);float nearest=10.0,second=10.0;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 offset=vec3(float(x),float(y),float(z));vec3 point=offset+hash3(cell+offset)*.72+.14;float d=length(local-point);if(d<nearest){second=nearest;nearest=d;}else if(d<second){second=d;}}float seam=1.0-smoothstep(.025,.12,second-nearest);return seam;}void main(){float texture=noise(vPosition*.16)*.72+noise(vPosition*.43)*.28;float cells=cellTexture(vPosition*.19);float facing=.5+.5*max(0.0,vNormal.z);float light=.76+texture*.28+cells*.025;float alpha=.032+texture*.045+cells*.012+facing*.018;gl_FragColor=vec4(uColor*light,alpha*uOpacity);}`,
    transparent:true,depthWrite:false,side:FrontSide,toneMapped:false,
  }),[])
  const gradientHaloMaterial=useMemo(()=>new ShaderMaterial({
    uniforms:{uColor:{value:new Color(active?'#ffc76d':'#5b7088')},uEnergy:{value:active?.12+growth*.26:.012},uBurst:{value:0}},
    vertexShader:`attribute float aGlow;attribute float aAlong;varying float vGlow;varying float vAlong;void main(){vGlow=aGlow;vAlong=aAlong;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 uColor;uniform float uEnergy;uniform float uBurst;varying float vGlow;varying float vAlong;void main(){float travel=exp(-pow((vAlong-(1.0-uBurst))*9.0,2.0))*uBurst;vec3 energyColor=mix(uColor,vec3(1.0,.91,.66),clamp(travel,0.0,1.0));gl_FragColor=vec4(energyColor,vGlow*(uEnergy+travel*.9));}`,
    transparent:true,depthWrite:false,blending:AdditiveBlending,toneMapped:false,
  }),[active,growth])
  const filamentMaterial=useMemo(()=>new MeshBasicMaterial({color:tint,transparent:true,opacity:active?.25+growth*.32:.09,depthWrite:false,toneMapped:false}),[active,tint,growth])
  const twigMaterial=useMemo(()=>new MeshBasicMaterial({color:active?'#ffd58a':'#8198b4',transparent:true,opacity:active?.12+growth*.2:.045,depthWrite:false,toneMapped:false}),[active,growth])
  return <group ref={group}>
    <ambientLight intensity={.52}/>
    <pointLight position={[-72,68,105]} color={active?'#ffd58c':'#8199b8'} intensity={active?1.35:.22} distance={320}/>
    <pointLight position={[75,-38,-82]} color={active?'#d98732':'#516987'} intensity={active?.48:.08} distance={250}/>
    <mesh geometry={model.surface} material={active?membrane:shell}/>
    <mesh geometry={model.surface} material={shellAura} scale={1.12}/>
    <mesh geometry={model.surface} material={fresnel} scale={1.018}/>
    {model.rootPoints.map((point,i)=><group key={`r${i}`} position={point}><mesh><sphereGeometry args={[4.6,10,8]}/><meshBasicMaterial color={active?'#ffbd57':'#52657b'} transparent opacity={active?.08+growth*.14:.015} blending={AdditiveBlending} depthWrite={false}/></mesh><mesh><sphereGeometry args={[1.35,8,6]}/><meshBasicMaterial color={active?'#fff0c4':'#7d92aa'} transparent opacity={active?.08+growth*.5:.04} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh></group>)}
    <mesh ref={wave} geometry={model.surface} material={energyWaveMaterial} scale={1.018}/>
    {model.filaments.map((geometry,i)=><group key={`branch-${i}`} ref={el=>{branchGroups.current[i]=el}} position={model.rootPoints[i]} scale={.34+growthCurrent.current*.66}><mesh geometry={model.filamentHalos[i]} material={gradientHaloMaterial}/><mesh geometry={geometry} material={filamentMaterial}/><group position={model.tips[i]}><mesh><sphereGeometry args={[i%3===0?2.4:1.6,8,6]}/><meshBasicMaterial color={active?'#f6af4a':'#7489a4'} transparent opacity={active?.025+growth*.1:.025} blending={AdditiveBlending} depthWrite={false}/></mesh><mesh><sphereGeometry args={[i%3===0?.85:.58,7,5]}/><meshBasicMaterial color={active?'#fff0c8':'#9aaec5'} transparent opacity={active?.04+growth*.82:.17} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh></group></group>)}
    {model.twigs.map((geometry,i)=><mesh key={`t${i}`} geometry={geometry} material={twigMaterial}/>) }
    {model.lightPoints.map((point,i)=><mesh key={`v${i}`} position={point}><sphereGeometry args={[1.1,6,5]}/><meshBasicMaterial color={active?'#ffdda0':'#7b90aa'} transparent opacity={active?.68:.1} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>)}
  </group>
}

export default function NeuronScene({active,pulse,progress}:{active:boolean;pulse:number;progress:number}){
  return <Canvas className="neuron-canvas" orthographic camera={{left:-160,right:160,top:160,bottom:-160,near:.1,far:700,position:[0,0,420]}} dpr={[1,1.5]} gl={{alpha:true,antialias:true,powerPreference:'low-power'}}>
    <NeuralVolume active={active} pulse={pulse} progress={progress}/>
  </Canvas>
}
