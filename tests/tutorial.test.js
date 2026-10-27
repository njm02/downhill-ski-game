import test from 'node:test';
import assert from 'node:assert/strict';
import {WebcamTutorial} from '../src/tutorial.js';
const wrists=y=>({Left:{y},Right:{y}});
const sample={calibrated:true,tracked:true,steering:0,jump:false,wrists:wrists(.6)};
test('quick left right up completes without holds or neutral resets',()=>{
 const t=new WebcamTutorial();
 assert.equal(t.update(.016,{...sample,steering:-.18}),false);assert.equal(t.step,'right');
 assert.equal(t.update(.016,{...sample,steering:.18}),false);assert.equal(t.step,'jump');
 assert.equal(t.update(.016,{...sample,wrists:wrists(.57)}),true);assert.deepEqual(t.completed,['left','right','jump']);
});
test('calibration, tracking, correct order and both upward wrists are required',()=>{
 const t=new WebcamTutorial();t.update(.016,{...sample,calibrated:false,steering:-1});assert.equal(t.step,'calibrate');
 t.update(.016,{...sample,steering:1});assert.equal(t.step,'left');
 t.update(.016,{...sample,steering:-1,tracked:false});assert.equal(t.step,'left');
 t.update(.016,{...sample,steering:-1});t.update(.016,{...sample,steering:1});
 assert.equal(t.update(.016,{...sample,wrists:{Left:{y:.5},Right:{y:.6}}}),false);
 assert.equal(t.update(.016,{...sample,wrists:null}),false);
 assert.equal(t.update(.016,{...sample,wrists:wrists(.4)}),false);
 assert.equal(t.update(.016,{...sample,wrists:wrists(.36)}),true);
 t.reset();assert.equal(t.step,'calibrate');assert.deepEqual(t.completed,[]);
});
test('background frames do not complete practice and game jump event still works',()=>{
 const t=new WebcamTutorial();t.update(0,{...sample,steering:-1});assert.equal(t.step,'calibrate');
 t.update(.016,{...sample,steering:-1});t.update(.016,{...sample,steering:1});
 assert.equal(t.update(.016,{...sample,jump:true}),true);
});
