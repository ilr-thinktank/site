import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../auth/src/index.js';
const env={ALLOWED_DOMAINS:'raison-institut.fr,www.raison-institut.fr',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret'};
const request=path=>new Request(`https://ilr-cms-auth.example.workers.dev${path}`);
test('OAuth only redirects approved site hostnames and requests narrow public scope',async()=>{
 const r=await worker.fetch(request('/auth?provider=github&site_id=raison-institut.fr&scope=public_repo'),env);
 assert.equal(r.status,302);
 const url=new URL(r.headers.get('location'));
 assert.equal(url.hostname,'github.com');assert.equal(url.searchParams.get('scope'),'public_repo');
 assert.ok(url.searchParams.get('state'));assert.match(r.headers.get('set-cookie'),/HttpOnly.*Secure/);
 for(const site of ['attacker.example','raison-institut.fr.attacker.example']){
  const denied=await worker.fetch(request('/auth?provider=github&site_id='+site),env);
  assert.equal(denied.headers.get('location'),null);
  assert.match(await denied.text(),/UNSUPPORTED_DOMAIN/);
 }
});
test('unconfigured OAuth client fails safely',async()=>{
 const r=await worker.fetch(request('/auth?provider=github&site_id=raison-institut.fr'),{ALLOWED_DOMAINS:env.ALLOWED_DOMAINS});
 assert.equal(r.headers.get('location'),null);assert.match(await r.text(),/MISCONFIGURED_CLIENT/);
});
test('OAuth callback rejects mismatching CSRF state',async()=>{
 const r=await worker.fetch(new Request('https://auth.example/callback?code=code&state=wrong',{headers:{Cookie:'csrf-token=github_0123456789abcdef0123456789abcdef'}}),env);
 assert.match(await r.text(),/CSRF_DETECTED/);
});
test('callback only sends a token to an HTTPS page on an approved hostname',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({access_token:'test-token'}),{headers:{'Content-Type':'application/json'}});
 try{
  const state='0123456789abcdef0123456789abcdef';
  const r=await worker.fetch(new Request(`https://auth.example/callback?code=code&state=${state}`,{headers:{Cookie:`csrf-token=github_${state}`}}),env);
  const script=(await r.text()).match(/<script>([\s\S]*?)<\/script>/)[1];
  let listener;const sent=[];
  vm.runInNewContext(script,{URL,window:{addEventListener:(_,cb)=>{listener=cb;},opener:{postMessage:(message,origin)=>sent.push({message,origin})}}});
  sent.length=0;
  for(const origin of ['https://attacker.example','http://raison-institut.fr','https://raison-institut.fr.attacker.example'])listener({data:'authorizing:github',origin});
  assert.equal(sent.length,0);
  listener({data:'authorizing:github',origin:'https://raison-institut.fr'});
  assert.equal(sent.length,1);assert.equal(sent[0].origin,'https://raison-institut.fr');assert.match(sent[0].message,/test-token/);
 }finally{globalThis.fetch=originalFetch;}
});
