'use client';

import React, {useId} from 'react';
import './director-character.css';
import {useDirectorMotion} from './use-director-motion';

export type DirectorCharacterState = 'idle' | 'listening' | 'thinking' | 'noting' | 'speaking';

const descriptions: Record<DirectorCharacterState, string> = {
  idle: 'Your Director, a creative teammate in a cap, sitting at a desk with a notebook and ready to listen',
  listening: 'Your Director leans in and listens to you',
  thinking: 'Your Director considers your ideas',
  noting: 'Your Director takes notes in a notebook',
  speaking: 'Your Director talks with you',
};

/** An illustrative local character. The motion reflects the preview state, not live microphone activity. */
export function DirectorCharacter({state = 'idle', portrait = false, withBackground = true, mouthActive, paused = false, className, label}: {state: DirectorCharacterState; portrait?:boolean; withBackground?:boolean; mouthActive?:boolean; paused?:boolean; className?:string; label?:string}) {
  const id = `director-${useId().replace(/:/g, '')}`;
  const motion = useDirectorMotion(state, mouthActive, paused, id);
  const paint = (name: string) => `url(#${id}-${name})`;
  return <div ref={motion} className={`director-character dch-${state}${withBackground ? '' : ' dch-person-only'}${className ? ` ${className}` : ''}`} role="img" aria-label={label ?? (!withBackground && state === 'idle' ? 'Your Director, a creative teammate in a cap with a notebook, ready to listen' : descriptions[state])}>
    <svg viewBox={portrait ? "137 23 207 224" : withBackground ? "35 20 410 350" : "130 22 222 344"} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-room`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e4ece5"/><stop offset=".65" stopColor="#d4e3d9"/><stop offset="1" stopColor="#c2d4c9"/></linearGradient>
        <radialGradient id={`${id}-light`} cx=".35" cy=".18" r=".9"><stop stopColor="#fffaf0"/><stop offset="1" stopColor="#eef0e5" stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-skin`} x1=".1" y1=".15" x2=".92" y2=".82"><stop stopColor="#f6d0ae"/><stop offset=".46" stopColor="#e5b28e"/><stop offset="1" stopColor="#bc7f60"/></linearGradient>
        <radialGradient id={`${id}-cheek`}><stop stopColor="#c98470" stopOpacity=".52"/><stop offset="1" stopColor="#c98470" stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-cap`} x1=".1" y1=".05" x2=".9" y2=".95"><stop stopColor="#bd9677"/><stop offset=".38" stopColor="#987357"/><stop offset="1" stopColor="#614b3d"/></linearGradient>
        <linearGradient id={`${id}-brim`} x1="0" y1="0" x2=".25" y2="1"><stop stopColor="#ae8767"/><stop offset="1" stopColor="#68523f"/></linearGradient>
        <linearGradient id={`${id}-jacket`} x1=".08" y1="0" x2=".85" y2="1"><stop stopColor="#91aa95"/><stop offset=".34" stopColor="#64846f"/><stop offset="1" stopColor="#375f52"/></linearGradient>
        <linearGradient id={`${id}-sleeve`} x1="0" y1="0" x2="1" y2=".8"><stop stopColor="#8fa68e"/><stop offset="1" stopColor="#49705f"/></linearGradient>
        <linearGradient id={`${id}-desk`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff6e7"/><stop offset="1" stopColor="#dec9ad"/></linearGradient>
        <linearGradient id={`${id}-mug`} x1="0" y1="0" x2="1" y2=".25"><stop stopColor="#bd7660"/><stop offset=".35" stopColor="#d29a7c"/><stop offset="1" stopColor="#a86551"/></linearGradient>
        <linearGradient id={`${id}-chair`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#829285"/><stop offset="1" stopColor="#4a6458"/></linearGradient>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffef4"/><stop offset="1" stopColor="#ece6d5"/></linearGradient>
        <radialGradient id={`${id}-shadow`}><stop stopColor="#365446" stopOpacity=".2"/><stop offset="1" stopColor="#365446" stopOpacity="0"/></radialGradient>
        <filter id={`${id}-soft`} x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
        <linearGradient id={`${id}-body-fade`} gradientUnits="userSpaceOnUse" x1="0" y1="298" x2="0" y2="324"><stop stopColor="#fff"/><stop offset="1" stopColor="#000"/></linearGradient>
        <mask id={`${id}-body-mask`} maskUnits="userSpaceOnUse" x="130" y="0" width="230" height="340"><rect x="130" width="230" height="340" fill={paint('body-fade')}/></mask>
        <clipPath id={`${id}-eyes`}><path d="M199 134q11-11 24-1-11 10-24 1ZM253 133q11-10 23 1-11 8-23-1Z"/></clipPath>
      </defs>

      {withBackground && <g className="dch-room">
        <path d="M85 175C85 81 142 19 240 19s155 62 155 156v157H85Z" fill={paint('room')}/>
        <path d="M86 175C86 81 142 20 240 20s154 61 154 155" stroke="#fff" strokeOpacity=".6" fill="none"/>
        <ellipse cx="182" cy="124" rx="133" ry="133" fill={paint('light')}/>
        <path d="M110 291V178c0-72 45-132 122-138" stroke="#fff" strokeOpacity=".27" fill="none"/>
        <path d="M103 332h274" stroke="#628974" strokeOpacity=".16"/>
        <g opacity=".75">
          <rect x="324" y="105" width="45" height="62" rx="4" fill="#f4f0e5" stroke="#b9c9bc"/>
          <path d="M333 151v-18l9-10 10 14 8-5v19Z" fill="#aebdaf"/>
          <circle cx="355" cy="119" r="5" fill="#d3ab86"/>
          <rect x="316" y="166" width="61" height="5" rx="2.5" fill="#9eac9a"/>
        </g>
        <g className="dch-plant">
          <path d="M103 259c4-25 3-49-2-66" fill="none" stroke="#78947c" strokeWidth="2.5"/>
          <path d="M103 219c-14-1-20-10-17-20 12 2 16 10 17 20Z" fill="#8aa68d"/>
          <path d="M104 232c15-4 20-13 15-24-11 5-15 13-15 24Z" fill="#698b75"/>
          <path d="M102 207c7-11 5-20-4-25-6 11-3 20 4 25Z" fill="#799c81"/>
          <path d="m90 253 3 29h22l4-29Z" fill="#d5bb99"/>
          <ellipse cx="104" cy="253" rx="15" ry="3.5" fill="#bfa27e"/>
          <path d="M97 260v16" stroke="#f0dbc0" strokeWidth="2" strokeLinecap="round"/>
        </g>
      </g>}

      {withBackground && <g><ellipse cx="242" cy="357" rx="186" ry="22" fill={paint('shadow')}/>
      <path d="M140 323V231c0-44 28-64 54-64h98c29 0 48 23 48 65v91Z" fill={paint('chair')}/>
      <path d="M149 251v-18c0-39 25-56 47-56h91" fill="none" stroke="#c1cdc0" strokeOpacity=".34" strokeWidth="3"/></g>}

      <g className="dch-person" mask={withBackground ? undefined : paint('body-mask')}>
        <path d="M157 320c-3-37-1-78 25-94l33-16h51l32 16c24 15 28 56 24 94Z" fill={paint('jacket')}/>
        <path d="m223 197-3 25 20 19 23-21-4-29Z" fill={paint('skin')}/>
        <path d="m218 217 22 18 25-20 13 105h-70Z" fill="#f3ecda"/>
        <path d="m218 213-20 10-7 38 17-4 15 63 4-80Z" fill="#98ac94"/>
        <path d="m265 213 19 11 7 36-18-5-15 65-4-80Z" fill="#77947c"/>
        <path d="m224 234 15 11 17-12" fill="none" stroke="#d5cbb7" strokeWidth="1.5"/>
        <path d="M277 272h23v17h-23Z" fill="#436957" opacity=".5"/>
        <path d="M278 273h20" stroke="#b1c0a7" strokeOpacity=".6" strokeWidth="1.5"/>
        <path d="m290 273 2-14" stroke="#d6c3a2" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="250" cy="274" r="2.2" fill="#bcab90"/>
        <circle cx="250" cy="298" r="2.2" fill="#bcab90"/>

        <g className="dch-head">
          <path d="M186 117c-12 0-14 16-6 28 3 4 7 5 11 3M285 118c12-2 16 13 10 25-3 6-8 8-12 5" fill="#c98c69"/>
          <path d="M186 121c-6 1-7 9-3 14M287 123c6-1 7 7 3 12" fill="none" stroke="#ad7158" strokeWidth="2" strokeLinecap="round"/>
          <path d="M185 100c0-30 27-47 53-47 30 0 52 22 52 49l-5 53c-3 31-24 52-47 52-25 0-46-23-49-52Z" fill={paint('skin')}/>
          <path d="M191 95c-2 8-1 19-4 27l-5-16c-4-17 2-40 22-48l16 4Z" fill="#59483e"/>
          <path d="M281 91c7 9 3 24 5 31l5-17c4-17-1-25-10-33Z" fill="#493c34"/>
          <ellipse cx="206" cy="156" rx="21" ry="15" fill={paint('cheek')}/>
          <ellipse cx="270" cy="155" rx="18" ry="14" fill={paint('cheek')}/>
          <path className="dch-brow dch-brow-left" d="M198 121q12-9 25-3" stroke="#645044" strokeWidth="4.3" strokeLinecap="round" fill="none"/>
          <path className="dch-brow dch-brow-right" d="M253 118q12-5 23 3" stroke="#645044" strokeWidth="4.1" strokeLinecap="round" fill="none"/>
          <g className="dch-eyes">
            <path d="M199 134q11-11 24-1-11 10-24 1Z" fill="#fff6e9"/>
            <path d="M253 133q11-10 23 1-11 8-23-1Z" fill="#fff6e9"/>
            <g clipPath={paint('eyes')}><g className="dch-gaze"><ellipse cx="213" cy="133" rx="5.6" ry="6.8" fill="#414338"/><ellipse cx="263" cy="133" rx="5.6" ry="6.8" fill="#414338"/><circle cx="214" cy="134" r="3.4" fill="#263129"/><circle cx="264" cy="134" r="3.4" fill="#263129"/><circle cx="211.5" cy="130.5" r="1.7" fill="#fff"/><circle cx="261.5" cy="130.5" r="1.7" fill="#fff"/></g></g>
            <path d="M198 133q11-10 25-1M253 131q11-8 24 3" stroke="#715244" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
          </g>
          <path d="m239 132-5 21q5 4 12 0" stroke="#bf8567" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M225 175q14 9 29-3" stroke="#bb8167" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <g className="dch-smile"><path d="M222 166q16 8 32-1-15 18-32 1Z" fill="#8d5446"/><path d="M226 167q11 4 23-1" stroke="#fff3df" strokeWidth="3" strokeLinecap="round" fill="none"/></g>
          <g className="dch-speaking-mouth"><ellipse cx="239" cy="170" rx="11" ry="7" fill="#774d41"/><path d="M231 165q8 3 16-1" stroke="#fff2df" strokeWidth="3" strokeLinecap="round" fill="none"/><ellipse cx="240" cy="175" rx="6" ry="2" fill="#c67f72"/></g>
          <path d="M214 190q25 13 49-3" stroke="#855940" strokeOpacity=".11" strokeWidth="7" strokeLinecap="round" fill="none"/>
          <g className="dch-cap">
            <path d="M177 98c-7-20 7-52 37-61 26-8 64-3 78 18 9 13 9 33 4 47l-20 6-90-1Z" fill={paint('cap')}/>
            <path d="M183 93c29-16 73-15 109 6l-1 11c-33-18-73-18-107-6Z" fill="#795c46"/>
            <path d="M174 98c13-16 42-21 69-18 22 2 39 12 49 23-11 9-30 15-54 15-27 0-54-8-66-13-3-2-2-5 2-7Z" fill={paint('brim')}/>
            <path d="M176 101c35 17 78 20 112 4" fill="none" stroke="#cba585" strokeOpacity=".48" strokeWidth="1.5"/>
            <path d="M235 35c-14 6-22 20-24 45M240 35c20 7 31 22 33 54" fill="none" stroke="#d1ae8e" strokeOpacity=".3" strokeWidth="1.4"/>
            <path d="M184 81c4-18 14-28 31-34" fill="none" stroke="#e9c6a2" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round"/>
            <ellipse cx="238" cy="35" rx="6" ry="3.5" fill="#8b694e"/>
            <path d="m281 77 9 4-3 7-9-4Z" fill="#d2ba91"/>
          </g>
        </g>

        <g className="dch-resting-arm"><path d="M181 232c-19 2-24 19-25 33l-5 40c-1 12 9 18 20 15l31-8-8-21-19 4 11-36Z" fill={paint('sleeve')}/><path d="m192 291 9-3 10 23-9 4Z" fill="#ebe3cc"/><g className="dch-resting-fingers"><path d="M202 293c7-6 17-3 23 1l10 8c4 4 1 8-4 7l-6-3 7 6c2 4-1 6-4 5l-12-4c-6 1-14-3-15-8Z" fill={paint('skin')}/><path d="m213 299 12 7m-15-2 13 7" stroke="#bf8260" strokeWidth="1.3" strokeLinecap="round"/></g><g className="dch-open-hand"><path d="M202 293c1-7 3-9 6-9l3-12c1-5 4-5 5-1l1 13 4-17c1-5 5-4 5 0l-1 20 5-15c2-4 6-2 5 2l-4 19 4-7c3-4 7-1 5 3l-7 13c-4 9-11 15-21 13l-9-5Z" fill={paint('skin')}/><path d="m207 294 7 8m3-13-2 14m10-13-5 15" fill="none" stroke="#bf8260" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/></g></g>
        <path d="M289 230c20 3 27 22 31 44l5 21c2 11-4 18-14 20l-28-1 1-23 18-4-14-29Z" fill={paint('sleeve')}/>
        <path d="M302 265c5 7 7 15 8 24" fill="none" stroke="#bfd0b5" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round"/>
      </g>

      {withBackground && <g><ellipse cx="242" cy="341" rx="180" ry="13" fill="#526552" opacity=".08" filter={paint('soft')}/>
      <path d="M82 304h316c7 0 12 3 16 9l16 24c3 5-1 11-8 11H58c-7 0-11-6-8-11l17-24c4-6 9-9 15-9Z" fill="#c4ad8a"/>
      <path d="M82 301h316c7 0 12 3 16 9l16 24c3 5-1 9-8 9H58c-7 0-11-4-8-9l17-24c4-6 9-9 15-9Z" fill={paint('desk')}/>
      <path d="M78 305h320" stroke="#fffdf5" strokeOpacity=".68" strokeWidth="2" strokeLinecap="round"/>
      <path d="M58 342h364" stroke="#ab9273" strokeOpacity=".35"/></g>}

      <g className="dch-notebook">
        <path d="m217 299 83 4 27 26-83-3-45-13Z" fill="#8fa29a" opacity=".26"/>
        <path d="m212 297 81 4 27 24-84-4-36-11Z" fill="#8b9c83"/>
        <path d="m214 294 78 4 24 24-78-4-37-11Z" fill={paint('paper')}/>
        <path d="m249 296 27 24" stroke="#c6c3ae" strokeWidth="1.3"/>
        <path d="m219 300 24 2m-19 3 23 2m-18 3 22 2" stroke="#c5c7b4" strokeWidth="1.2" strokeLinecap="round"/>
        <path className="dch-note-line dch-note-line-one" d="m260 303 25 2" stroke="#8c9c86" strokeWidth="1.5" strokeLinecap="round"/>
        <path className="dch-note-line dch-note-line-two" d="m265 308 28 2" stroke="#8c9c86" strokeWidth="1.5" strokeLinecap="round"/>
        <path className="dch-note-line dch-note-line-three" d="m270 313 19 1.5" stroke="#8c9c86" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="m214 294-13 13" stroke="#84927b" strokeWidth="2" strokeLinecap="round"/>
      </g>

      <g className="dch-writing-hand">
        <path d="m292 286-8 1-5 20 10 3Z" fill="#e8dfc6"/>
        <path d="M284 288c-7-5-13-4-17 0l-12 10c-3 3-1 7 3 6l8-4c-1 6 4 9 9 6l11-9Z" fill={paint('skin')}/>
        <path d="m266 296 6-4 5 1" stroke="#ba7d5d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <g className="dch-pen"><path d="m266 307 12-36" stroke="#3c564b" strokeWidth="4.5" strokeLinecap="round"/><path d="m276 277 3-8" stroke="#d1b08a" strokeWidth="4.5" strokeLinecap="round"/><path d="m266 307-2 6 4-5Z" fill="#8d7150"/><path d="m264 313 1-2" stroke="#354c44" strokeWidth="1.5" strokeLinecap="round"/></g>
        <path d="M275 288c-5-5-10-5-13-1-2 3 1 8 6 9l7 1" fill={paint('skin')}/>
        <path d="m262 290 6 4 6 1" stroke="#c18a69" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      </g>

      {withBackground && <g className="dch-coffee">
        <ellipse cx="131" cy="321" rx="26" ry="7" fill="#947a58" opacity=".13"/>
        <path d="M148 288h7c14 0 14 22-1 23h-7v-6h7c6 0 6-11 0-11h-6Z" fill="#a96c53"/>
        <path d="M113 285h37v24c0 14-37 14-37 0Z" fill={paint('mug')}/>
        <ellipse cx="131.5" cy="285" rx="18.5" ry="5.5" fill="#e0b08d"/>
        <ellipse cx="131.5" cy="285" rx="14.5" ry="3.4" fill="#6d5140"/>
        <path d="M118 292v15c0 4 4 6 8 7" stroke="#efc0a0" strokeWidth="2.4" strokeLinecap="round" opacity=".42" fill="none"/>
        <g className="dch-steam" stroke="#f9fbf4" strokeWidth="2.5" fill="none" strokeLinecap="round"><path d="M126 273c-6-7 5-10 1-17"/><path d="M137 273c-6-7 5-10 1-17"/></g>
      </g>}

      {withBackground && <g className="dch-creative-cards" transform="translate(349 272) rotate(7)">
        <rect x="0" y="1" width="40" height="31" rx="3" fill="#6d8072"/>
        <rect x="2" y="-5" width="39" height="10" rx="2" fill="#edf0df"/>
        <path d="m5-5 7 10m4-10 7 10m4-10 7 10" stroke="#718578" strokeWidth="4"/>
        <path d="M8 14h24M8 20h17" stroke="#dce3ce" strokeWidth="1.5" opacity=".7"/>
      </g>}

      <g className="dch-listen-rings" fill="none" stroke="#739988" strokeWidth="2" strokeLinecap="round"><path d="M307 135q8 8 0 16"/><path d="M314 128q15 15 0 30"/></g>
      <g className="dch-thoughts"><circle cx="310" cy="94" r="4" fill="#aebd9f"/><circle cx="323" cy="81" r="5.5" fill="#c0cbaa"/><circle cx="340" cy="63" r="8" fill="#f3e8ca"/></g>
      <g className="dch-speech-waves" fill="none" stroke="#9ba883" strokeWidth="2.5" strokeLinecap="round"><path d="M311 157v9"/><path d="M319 151v22"/><path d="M327 155v14"/><path d="M335 159v7"/></g>
    </svg>
  </div>;
}

export default DirectorCharacter;
