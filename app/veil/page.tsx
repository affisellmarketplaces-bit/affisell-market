"use client"
import { useEffect, useState } from "react"

const PRODUCTS = [
  { id:1, name:"APPLE IPAD AIR • ROSE • 64GB", price:"€599", grad:"linear-gradient(135deg,#ffc2d6,#ff8fab)", x:-360, y:-18, s:1.02, d:"0s", a:"5.4s" },
  { id:2, name:"WATCH TITANIUM • MIDNIGHT", price:"€429", grad:"radial-gradient(circle at 30% 30%, #e8e8ec, #b8b8c0)", x:-155, y:38, s:0.94, d:"0.4s", a:"6.6s" },
  { id:3, name:"SNEAKER ARCHIVE 01 • WHITE", price:"€185", grad:"linear-gradient(135deg,#ffffff,#e9e7e4)", x:4, y:-12, s:1.08, d:"0.15s", a:"5.9s" },
  { id:4, name:"LAMP GLOW CONE • AMBER", price:"€240", grad:"radial-gradient(circle at 50% 25%, #ffd38a, #ff9e3d 55%, #f5e6d0)", x:195, y:32, s:0.92, d:"0.7s", a:"7.2s" },
  { id:5, name:"BAG CARRY ALL • NOIR", price:"€310", grad:"linear-gradient(180deg,#2a2a30,#15151a)", x:382, y:-10, s:0.96, d:"0.35s", a:"6.2s" },
]

export default function ClairVeil(){
  const [time,setTime]=useState("")
  const [mx,setMx]=useState(0)
  useEffect(()=>{
    const i=setInterval(()=>setTime(new Date().toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour12:false})),1000)
    const onMove=(e:MouseEvent)=>setMx((e.clientX/window.innerWidth-0.5))
    window.addEventListener('mousemove',onMove)
    return ()=>{clearInterval(i);window.removeEventListener('mousemove',onMove)}
  },[])

  return (
    <div style={{width:'100vw',height:'100vh',background:'#fbfaf8',overflow:'hidden',position:'relative',fontFamily:'Inter,system-ui'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400&display=swap'); @keyframes fl{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-22px,0)}}`}</style>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(120% 80% at 50% -10%, #fff 0%, #f7f5f1 40%, #efebe6 75%, #e8e2dc 100%)'}}/>
      <div style={{position:'absolute',width:700,height:700,left:'-8%',top:'-20%',background:'radial-gradient(circle, rgba(255,220,200,0.55), transparent 70%)',filter:'blur(60px)',borderRadius:'50%'}}/>
      <div style={{position:'absolute',width:800,height:500,right:'-10%',top:'5%',background:'radial-gradient(circle, rgba(200,220,255,0.45), transparent 70%)',filter:'blur(60px)',borderRadius:'50%'}}/>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-65%)',fontSize:'22vw',fontWeight:200,letterSpacing:'-0.05em',color:'rgba(0,0,0,0.03)',pointerEvents:'none'}}>AFFISELL</div>

      <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',justifyContent:'space-between',padding:'28px 36px',zIndex:20}}>
        <span style={{fontSize:11,letterSpacing:'0.48em',fontWeight:300,color:'#1a1a1a'}}>AFFISELL</span>
        <span style={{fontSize:10,letterSpacing:'0.16em',color:'rgba(0,0,0,0.32)'}}>PARIS {time} — CLAIR VEIL • LIVE</span>
      </div>

      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',transform:`translate3d(${mx*-18}px,0,0)`,transition:'transform 0.8s ease-out'}}>
        {PRODUCTS.map(p=>(
          <div key={p.id} style={{position:'absolute',left:'50%',top:'50%',transform:`translate3d(${p.x}px, ${p.y}px, 0) scale(${p.s})`,animation:`fl ${p.a} ease-in-out infinite`,animationDelay:p.d}}>
            <div style={{position:'relative'}}>
              <div style={{width:232,height:318,background:'rgba(255,255,255,0.72)',border:'1px solid rgba(0,0,0,0.06)',backdropFilter:'blur(22px)',borderRadius:26,overflow:'hidden',boxShadow:'0 18px 50px rgba(0,0,0,0.06)',display:'flex',flexDirection:'column'}}>
                <div style={{height:'64%',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(249,246,242,0.6))'}}>
                  <div style={{width:'72%',height:'72%',borderRadius:18,background:p.grad,boxShadow:'0 12px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)'}}/>
                </div>
                <div style={{flex:1,padding:'16px 18px 14px',display:'flex',flexDirection:'column',justifyContent:'space-between',background:'rgba(255,255,255,0.55)'}}>
                  <div style={{fontSize:8.2,letterSpacing:'0.20em',color:'rgba(0,0,0,0.38)',lineHeight:1.4}}>{p.name}</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'end'}}><b style={{fontSize:14,fontWeight:300,color:'#111'}}>{p.price}</b><span style={{fontSize:7.5,letterSpacing:'0.16em',color:'rgba(0,0,0,0.28)'}}>LIVE • VERIFIED</span></div>
                </div>
              </div>
              <div style={{position:'absolute',bottom:-18,left:'12%',right:'12%',height:24,background:'radial-gradient(ellipse at center, rgba(0,0,0,0.10), transparent 70%)',filter:'blur(6px)'}}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{position:'absolute',bottom:26,left:'50%',transform:'translateX(-50%)',display:'flex',gap:16,padding:'10px 20px',background:'rgba(255,255,255,0.78)',border:'1px solid rgba(0,0,0,0.06)',backdropFilter:'blur(18px)',borderRadius:999,boxShadow:'0 8px 24px rgba(0,0,0,0.06)',zIndex:20,whiteSpace:'nowrap'}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:'#111'}}/>
        <span style={{fontSize:9.5,letterSpacing:'0.16em',color:'rgba(0,0,0,0.55)',fontWeight:300}}>CLAIR VEIL • 1,247 PRODUITS • FLOTTANTS • DROP FORGE VERIFIED • MOVE TO EXPLORE</span>
      </div>
    </div>
  )
}
