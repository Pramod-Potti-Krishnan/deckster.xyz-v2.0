'use client';

import { useEffect, useRef } from 'react';
import type { DirectorCharacterState } from './director-character';

type Pose = { breath:number; lean:number; headX:number; headY:number; tilt:number; gazeX:number; gazeY:number; blink:number; browL:number; browR:number; mouth:number; mouthWidth:number; speech:number; gesture:number; handOpen:number; penX:number; penY:number; penAngle:number };
const neutral: Pose = { breath:0,lean:0,headX:0,headY:0,tilt:0,gazeX:0,gazeY:0,blink:1,browL:0,browR:0,mouth:.08,mouthWidth:1,speech:0,gesture:0,handOpen:0,penX:0,penY:0,penAngle:0 };
const units: Record<keyof Pose,string> = {breath:'px',lean:'deg',headX:'px',headY:'px',tilt:'deg',gazeX:'px',gazeY:'px',blink:'',browL:'px',browR:'px',mouth:'',mouthWidth:'',speech:'',gesture:'deg',handOpen:'',penX:'px',penY:'px',penAngle:'deg'};
const names: Record<keyof Pose,string> = {breath:'breath',lean:'lean',headX:'head-x',headY:'head-y',tilt:'tilt',gazeX:'gaze-x',gazeY:'gaze-y',blink:'blink',browL:'brow-l',browR:'brow-r',mouth:'mouth',mouthWidth:'mouth-width',speech:'speech',gesture:'gesture',handOpen:'hand-open',penX:'pen-x',penY:'pen-y',penAngle:'pen-angle'};
const keys = Object.keys(neutral) as (keyof Pose)[];
const bell = (time:number,start:number,duration:number) => time < start || time > start + duration ? 0 : Math.sin(Math.PI * (time-start)/duration) ** 2;
const smooth = (value:number) => {const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
const hold = (time:number,start:number,end:number,edge=.45) => smooth((time-start)/edge)*(1-smooth((time-end)/edge));

/** A small expression rig, not audio-derived visemes. No React updates per frame. */
export function useDirectorMotion(state:DirectorCharacterState,mouthActive:boolean|undefined,paused:boolean,seed:string) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({state,mouthActive,paused});
  latest.current={state,mouthActive,paused};
  const sync = useRef<()=>void>(()=>{});
  useEffect(()=>{
    const node=root.current;if(!node)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const phase=Array.from(seed).reduce((n,c)=>(n*31+c.charCodeAt(0))%997,0)/997;
    const pose={...neutral};
    const lastValues:Partial<Record<keyof Pose,string>>={};
    let frame=0,lastTime=0,time=phase*11,stateTime=0,lastState=latest.current.state,visible=true;
    let pointer={x:0,y:0},blinkStart=-10,nextBlink=2.4+phase*2,blinkCount=0;
    const write=()=>keys.forEach(key=>{const value=pose[key].toFixed(3)+units[key];if(lastValues[key]!==value){node.style.setProperty(`--dch-${names[key]}`,value);lastValues[key]=value;}});
    const canMove=()=>visible&&!document.hidden&&!reduced.matches&&!latest.current.paused;
    const tick=(stamp:number)=>{
      frame=0;if(!canMove())return;
      const dt=lastTime?Math.min((stamp-lastTime)/1000,.05):1/60;lastTime=stamp;time+=dt;stateTime+=dt;
      const mode=latest.current.state;
      if(mode!==lastState){lastState=mode;stateTime=0;nextBlink=time+.24;}
      if(time>=nextBlink){blinkStart=time;blinkCount++;nextBlink=time+[3.7,5.4,4.3,6.1,3.2][blinkCount%5]+phase*.65;}
      const blinkAge=time-blinkStart;
      // Fast close, slightly slower reopen; occasional soft double blink.
      const close=blinkAge<.065?smooth(blinkAge/.065):1-smooth((blinkAge-.065)/.12);
      const double=blinkCount%4===0?bell(blinkAge,.26,.18):0;
      const target:Pose={...neutral,breath:Math.sin(time*1.22)*.75+Math.sin(time*.61)*.2,blink:1-.96*Math.max(close,double)};
      const glance=hold(stateTime%17,6.4,8.2)-.7*hold(stateTime%17,12.4,13.1);
      if(mode==='idle'){
        target.gazeX=glance*1.7+pointer.x;target.gazeY=pointer.y;
        target.tilt=-.4+glance*.7+Math.sin(time*.48)*.3;
        target.headX=pointer.x*.18;target.headY=Math.sin(time*.75)*.3;
      }else if(mode==='listening'){
        const nod=bell(stateTime%5.7,.45,.95)+.65*bell(stateTime%5.7,1.65,.65);
        target.tilt=1.8+nod*.9;target.headY=nod*2.6;target.headX=1.2;target.lean=.35;
        target.gazeX=pointer.x*.55;target.gazeY=.4+pointer.y*.5;target.browR=-1.2;
      }else if(mode==='thinking'){
        const consider=hold(stateTime%8,.1,4.7,.8);
        target.tilt=-2.8*consider;target.headY=-.8*consider;target.gazeX=-2.1*consider;target.gazeY=-1.4*consider;
        target.browL=-1.1;target.browR=.25;target.penAngle=-4.5*consider;target.penY=-1.5*consider;
      }else if(mode==='noting'){
        const cycle=stateTime%3.8,line=Math.min(2,Math.floor(cycle/.85)),lineTime=(cycle-line*.85)/.85;
        const writing=hold(cycle,.08,2.5,.12),progress=smooth(Math.min(1,lineTime/.8)),stroke=Math.sin(stateTime*23);
        const glanceUp=hold(cycle,2.75,3.3,.18);
        target.tilt=2.8*(1-glanceUp);target.headY=4.2*(1-glanceUp);target.gazeX=1.1;target.gazeY=2.7*(1-glanceUp);
        // The nib follows the notebook's three actual lines, lifting between them.
        target.penX=(-6+line*5+progress*(line===2?18:24))*writing;
        target.penY=(-10+line*5+stroke*.5-Math.sin(Math.min(1,lineTime)*Math.PI)*.3)*writing-1.8*glanceUp;
        target.penAngle=stroke*.5*writing-3*glanceUp;target.browL=.3;target.browR=.3;
      }else{
        const phrase=stateTime%5.4,gesture=bell(phrase,.4,2.5),emphasis=bell(phrase,.75,.6)+.5*bell(phrase,2.1,.5);
        const mouthGate=latest.current.mouthActive ?? phrase<4.55;
        // Several syllable shapes, with phrase rests, rather than one repeated oval.
        const shapes=[.16,.62,.28,.48,.08,.76,.35,.57,.12],syllable=stateTime/.145,index=Math.floor(syllable),blend=smooth(syllable-index);
        target.mouth=mouthGate?shapes[index%shapes.length]*(1-blend)+shapes[(index+1)%shapes.length]*blend:.06;
        target.mouthWidth=mouthGate?1.02-target.mouth*.28:.98;
        target.speech=mouthGate?1:0;target.tilt=-.7+gesture*1.8;target.headY=emphasis*1.6;target.headX=gesture*.55;
        target.gazeX=.45*hold(phrase,3.7,4.15,.2);target.browL=-.6-emphasis*.65;target.browR=-.35;
        target.gesture=-7.5*gesture;target.handOpen=smooth(gesture*1.5);target.lean=-gesture*.35;
      }
      target.penY+=target.breath*.65;
      // Damped follow-through: gaze leads the head; hands settle last.
      keys.forEach(key=>{const rate=key==='blink'?90:key==='mouth'||key==='speech'?24:key==='gazeX'||key==='gazeY'?11:key==='gesture'||key==='handOpen'?6:8;pose[key]+=(target[key]-pose[key])*(1-Math.exp(-rate*dt));});
      write();frame=requestAnimationFrame(tick);
    };
    const reconcile=()=>{
      if(!canMove()){
        if(frame)cancelAnimationFrame(frame);frame=0;lastTime=0;node.dataset.motion='paused';
        if(reduced.matches){Object.assign(pose,neutral);write();node.dataset.motion='reduced';}
        else if(latest.current.paused){pose.blink=1;pose.mouth=.08;pose.speech=0;write();}
      }else{node.dataset.motion='active';if(!frame){lastTime=0;frame=requestAnimationFrame(tick);}}
    };
    const pointerMove=(event:PointerEvent)=>{if(event.pointerType==='touch')return;const r=node.getBoundingClientRect();pointer={x:Math.max(-1.35,Math.min(1.35,((event.clientX-r.left)/r.width-.5)*2.7)),y:Math.max(-.8,Math.min(.8,((event.clientY-r.top)/r.height-.45)*1.6))};};
    const pointerLeave=()=>{pointer={x:0,y:0};};
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;reconcile();},{threshold:0});
    observer.observe(node);node.addEventListener('pointermove',pointerMove,{passive:true});node.addEventListener('pointerleave',pointerLeave);
    document.addEventListener('visibilitychange',reconcile);reduced.addEventListener('change',reconcile);sync.current=reconcile;reconcile();
    return()=>{if(frame)cancelAnimationFrame(frame);observer.disconnect();node.removeEventListener('pointermove',pointerMove);node.removeEventListener('pointerleave',pointerLeave);document.removeEventListener('visibilitychange',reconcile);reduced.removeEventListener('change',reconcile);sync.current=()=>{};};
  },[seed]);
  useEffect(()=>sync.current(),[paused]);
  return root;
}
