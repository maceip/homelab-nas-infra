import React from 'react'
import {render,act} from '@testing-library/react'
import useBottomDock from '../src/pi/useBottomDock'
import {stepJokeTokens,INITIAL_TOKENS} from '../src/pi/useJokeTokens'
function Dock(){useBottomDock();return null}
test('token joke rate limits and accumulation are elapsed-time based',()=>{
 expect(stepJokeTokens({total:INITIAL_TOKENS},10,()=>0)).toEqual({tps:20,spendRate:280,total:INITIAL_TOKENS+2800});
 expect(stepJokeTokens({total:INITIAL_TOKENS},10,()=>1)).toEqual({tps:40,spendRate:400,total:INITIAL_TOKENS+4000});
});
test('mobile starts at bottom, follows resizing there, and lets the visitor scroll away',()=>{
 jest.useFakeTimers();
 const original={width:window.innerWidth,height:window.innerHeight,scroll:window.scrollTo};
 Object.defineProperty(window,'innerWidth',{configurable:true,value:390});
 Object.defineProperty(window,'innerHeight',{configurable:true,value:844});
 Object.defineProperty(document.documentElement,'scrollHeight',{configurable:true,value:2000});
 window.scrollTo=jest.fn(({top})=>{Object.defineProperty(window,'scrollY',{configurable:true,value:Math.min(top,2000-window.innerHeight)})});
 const {unmount}=render(<Dock/>);
 act(()=>jest.advanceTimersByTime(20));expect(window.scrollTo).toHaveBeenCalled();
 window.scrollTo.mockClear();
 Object.defineProperty(window,'innerHeight',{configurable:true,value:700});
 act(()=>{window.dispatchEvent(new Event('resize'));jest.advanceTimersByTime(20)});
 expect(window.scrollTo).toHaveBeenCalled();
 window.scrollTo.mockClear();Object.defineProperty(window,'scrollY',{configurable:true,value:100});
 act(()=>window.dispatchEvent(new Event('scroll')));
 act(()=>{window.dispatchEvent(new Event('resize'));jest.advanceTimersByTime(20)});
 expect(window.scrollTo).not.toHaveBeenCalled();
 unmount();window.scrollTo=original.scroll;
 Object.defineProperty(window,'innerWidth',{configurable:true,value:original.width});Object.defineProperty(window,'innerHeight',{configurable:true,value:original.height});
 delete document.documentElement.scrollHeight;jest.useRealTimers();
});
