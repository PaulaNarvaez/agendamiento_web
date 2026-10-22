import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { once } from 'node:events';

test('asistente OAuth: estado, PKCE, cuenta verificada y guardado privado sin perder configuración', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'camila-oauth-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const mock = join(directory,'mock.mjs');
  await writeFile(mock, `
    import assert from 'node:assert/strict';
    globalThis.fetch = async (url, options) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        assert.ok(options.body.get('code_verifier').length >= 43);
        return Response.json({access_token:'fake-access',refresh_token:'fake-refresh',scope:'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy'});
      }
      assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
      return Response.json({email:process.env.MOCK_ACCOUNT,email_verified:true});
    };
  `);
  for (const account of ['other@example.com', 'pruebacami12@gmail.com']) {
    await writeFile(join(directory,'.env'), 'EXISTING_SETTING=keep-me\n');
    const child = spawn(process.execPath, ['--import',pathToFileURL(mock).href,fileURLToPath(new URL(account==='pruebacami12@gmail.com' ? '../scripts/prepare-dev.js' : '../scripts/connect-google.js',import.meta.url)), ...(account==='pruebacami12@gmail.com' ? ['--account=pruebacami12@gmail.com'] : [])], {
      cwd:directory,env:{...process.env,GOOGLE_CLIENT_ID:'fake-client',GOOGLE_CLIENT_SECRET:'fake-secret',GOOGLE_ACCOUNT_EMAIL:'old@example.com',GOOGLE_CALENDAR_ID:'old@example.com',MOCK_ACCOUNT:account,NO_BROWSER:'1',NODE_OPTIONS:'--import '+pathToFileURL(mock).href,GOOGLE_REFRESH_TOKEN:'fake-old-token',SESSION_DURATION_MINUTES:'50',SESSION_PRICE_CLP:'30000',AVAILABLE_WEEKDAYS:'1,2,3,4,5',AVAILABLE_HOURS:'09:00,10:00'},stdio:['ignore','pipe','pipe'],
    });
    t.after(()=>child.kill());
    const exited=once(child,'exit');
    let output='';child.stdout.on('data',data=>output+=data);
    const authorization=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('No inició asistente OAuth')),5000);
      child.stdout.on('data',()=>{const match=output.match(/https:\/\/accounts.google.com\/\S+/);if(match){clearTimeout(timer);resolve(new URL(match[0]));}});
    });
    assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
    assert.equal(authorization.searchParams.get('login_hint'), account==='pruebacami12@gmail.com' ? account : 'pruebacami12@gmail.com');
    const callback=new URL(authorization.searchParams.get('redirect_uri'));
    callback.search=new URLSearchParams({state:'invalid',code:'fake'}).toString();
    assert.equal((await fetch(callback)).status,400);
    callback.search=new URLSearchParams({state:authorization.searchParams.get('state'),code:'fake'}).toString();
    const response=await fetch(callback);
    await response.text();
    const [exitCode]=await exited;
    const content=await readFile(join(directory,'.env'),'utf8');
    assert.match(content,/EXISTING_SETTING=keep-me/);
    assert.ok(!output.includes('fake-refresh'),'no imprime el token');
    if(account!=='other@example.com'){
      assert.equal(response.status,200);assert.equal(exitCode,0);assert.match(content,/GOOGLE_REFRESH_TOKEN="fake-refresh"/);
      if (account==='pruebacami12@gmail.com') {
        assert.match(content,/GOOGLE_ACCOUNT_EMAIL="pruebacami12@gmail.com"/);
        assert.match(content,/GOOGLE_CALENDAR_ID="pruebacami12@gmail.com"/);
      }
    }else{
      assert.equal(response.status,400);assert.equal(exitCode,1);assert.ok(!content.includes('GOOGLE_REFRESH_TOKEN'));
    }
  }
});
