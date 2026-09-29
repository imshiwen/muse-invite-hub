"""Local-only end-to-end checks. Never points at the production domain."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json,uuid,time,urllib.request,os
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('MUSE_TEST_BASE','http://127.0.0.1:3000')
assert urlparse(BASE).hostname in ['localhost','127.0.0.1']
env={}
for line in (ROOT/'.env.local').read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);env[k]=v.strip().strip('"').strip("'")
assert env.get('APP_ENV')=='local' and env['LOCAL_DB_URL'].startswith('http://127.0.0.1:')
prefix='E2E'+uuid.uuid4().hex[:8].upper()
results=[];errors=[]
def done(name):results.append(name);print('PASS '+name,flush=True)
def db(sql,params=[]):
 req=urllib.request.Request(env['LOCAL_DB_URL'],data=json.dumps({'text':sql,'params':params}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+env['LOCAL_DB_KEY']})
 return json.load(urllib.request.urlopen(req))['rows']
def api(ctx,path,data=None,origin=BASE):
 return ctx.request.get(BASE+path) if data is None else ctx.request.post(BASE+path,data=data,headers={'Origin':origin})
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  ctx=browser.new_context(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write'])
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  for path in ['/','/share','/redeem','/how-to-register','/region-limits','/about','/privacy','/terms','/contact']:
   response=page.goto(BASE+path,wait_until='networkidle');assert response.status==200,path
   expect(page.locator('h1')).to_have_count(1)
   assert page.locator('link[rel=canonical]').get_attribute('href')=='https://museinvitehub.org'+('' if path=='/' else path) or page.locator('link[rel=canonical]').get_attribute('href')=='https://museinvitehub.org'+path
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),path
   page.set_viewport_size({'width':390,'height':844})
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),path+' mobile'
   page.set_viewport_size({'width':1440,'height':1000})
  done('all 9 public routes, canonical tags, desktop/mobile width')
  page.goto(BASE+'/',wait_until='networkidle');expect(page.locator('.code-card')).to_have_count(5)
  assert set(page.locator('.code-full').all_text_contents())=={'CJ5FU3','EWLBR8','2BY20C','FPCGQS','NKUNB7'}
  page.screenshot(path=str(ROOT/'artifacts/home-desktop.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ROOT/'artifacts/home-mobile.png'),full_page=True)
  page.set_viewport_size({'width':1440,'height':1000})
  # Clipboard failure leaves the already-visible code selectable, without a fake copy.
  page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Clipboard blocked'))}})")
  page.locator('.copy-button').first.click()
  expect(page.locator('.code-full').first).to_be_visible();expect(page.locator('.inline-notice')).to_be_visible()
  done('clipboard failure preserves full visible codes and manual copying')
  # Full codes must be readable without JavaScript or a reveal step.
  noscript=browser.new_context(java_script_enabled=False)
  ns=noscript.new_page();ns.goto(BASE+'/',wait_until='networkidle');expect(ns.locator('.code-full')).to_have_count(5);expect(ns.locator('.code-full').first).to_be_visible();noscript.close()
  done('all five full codes visible immediately with JavaScript disabled')
  page.goto(BASE+'/share',wait_until='networkidle');page.get_by_label('Your Muse invite code',exact=True).fill(prefix)
  page.get_by_role('checkbox').check();page.get_by_role('button',name='Share my code',exact=True).click()
  expect(page.get_by_role('heading',name='Save your private management link.')).to_be_visible(timeout=20000)
  assert page.evaluate("sessionStorage.getItem('mih-pending-submit')") is None
  private_link=page.get_by_label('Your private management link').input_value();token=private_link.rsplit('/',1)[1]
  assert len(token)>=43
  done('submission creates a code and returns a private management link')
  page.get_by_role('link',name='Open my management page').click();page.wait_for_load_state('networkidle')
  expect(page.get_by_role('heading',name='Save your private management link.')).to_be_visible()
  assert 'noindex' in page.locator('meta[name=robots]').get_attribute('content')
  assert page.locator('script[src*="googletagmanager"]').count()==0
  managed=api(ctx,'/api/manage/'+token).json()['codes'][0];code_id=managed['id']
  assert managed['status']=='uncertain'
  done('management reminder, private indexing and analytics isolation')
  # 30 copies through the API cannot retire a code; one-hour dedupe counts once.
  for _ in range(30): assert api(ctx,f'/api/codes/{code_id}/copy',{}).status==200
  managed=api(ctx,'/api/manage/'+token).json()['codes'][0]
  assert managed['copy_count']==1 and managed['status']=='uncertain',managed
  for _ in range(3): assert api(ctx,f'/api/codes/{code_id}/report',{'result':'fail'}).status==200
  managed=api(ctx,'/api/manage/'+token).json()['codes'][0];assert managed['status']=='uncertain' and managed['fail_count']==1
  r=api(ctx,f'/api/codes/{code_id}/report',{'result':'success'});assert r.status==200
  managed=api(ctx,'/api/manage/'+token).json()['codes'][0];assert managed['status']=='active' and managed['work_count']==1
  done('30 copies, repeated failure dedupe and corrected success state')
  page.get_by_role('button',name='Pause display').click();expect(page.get_by_role('button',name='Resume display')).to_be_visible()
  assert api(ctx,f'/api/codes/{code_id}').status==404
  page.get_by_role('button',name='Resume display').click();expect(page.get_by_role('button',name='Pause display')).to_be_visible()
  quota=page.get_by_label('Your estimate of remaining redemptions');quota.fill('0');page.get_by_role('button',name='Save estimate').click()
  expect(page.get_by_role('button',name='Resume display')).to_be_visible()
  assert api(ctx,f'/api/manage/{token}',{'action':'resume','id':code_id}).status>=400
  quota.fill('5');page.get_by_role('button',name='Save estimate').click();page.get_by_role('button',name='Resume display').click()
  done('owner pause/resume, zero quota lock and updated estimate')
  # Admin auth, review queue, and approval through actual UI.
  admin=browser.new_context();ap=admin.new_page();assert api(admin,'/api/admin').status==401
  ap.goto(BASE+'/admin',wait_until='networkidle');ap.get_by_label('Local admin key').fill(env['LOCAL_ADMIN_KEY']);ap.get_by_role('button',name='Sign in locally').click()
  expect(ap.get_by_role('heading',name='A useful pool starts here.')).to_be_visible(timeout=15000)
  page.locator('.manage-extra summary').click();page.get_by_label('New code',exact=True).fill(prefix+'B')
  page.locator('.manage-extra').get_by_role('checkbox').check()
  page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Submit replacement').click()
  expect(page.locator('.management-card')).to_have_count(2,timeout=15000)
  rows=api(ctx,'/api/manage/'+token).json()['codes'];new_code=next(c for c in rows if c['code']==prefix+'B')
  assert new_code['moderation']=='pending' and new_code['work_count']==0 and new_code['copy_count']==0
  assert api(ctx,'/api/codes/'+new_code['id']).status==404
  ap.reload(wait_until='networkidle');row=ap.locator('.admin-row').filter(has=ap.get_by_role('heading',name=prefix+'B',exact=True));row.get_by_role('button',name='Approve',exact=True).click()
  expect(row.get_by_role('button',name='Approve',exact=True)).to_have_count(0,timeout=15000)
  assert api(ctx,'/api/codes/'+new_code['id']).status==200
  ap.screenshot(path=str(ROOT/'artifacts/admin-desktop.png'),full_page=True)
  done('admin login, replacement pending queue, clean counters and approval')
  # Management rotation via UI; old link loses access immediately.
  page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Replace management link',exact=True).click()
  page.wait_for_url(lambda u:'/manage/' in u and not u.endswith(token),timeout=15000)
  new_token=page.url.rsplit('/',1)[1];assert api(ctx,'/api/manage/'+token).status==404
  assert api(ctx,'/api/manage/'+new_token).status==200
  old_write=api(ctx,'/api/manage/'+token,{'action':'pause','id':new_code['id']})
  assert old_write.status==404, (old_write.status,old_write.text())
  assert api(ctx,'/api/manage/'+new_token,{'action':'pause','id':new_code['id']},origin='https://evil.example').status==403
  done('token rotation revokes old read/write access and cross-origin writes fail')
  ap.get_by_role('button',name='Sign out',exact=True).click();expect(ap.get_by_label('Local admin key')).to_be_visible(timeout=15000)
  assert api(admin,'/api/admin').status==401
  done('admin logout revokes server session')
  assert not errors,errors
  done('no browser JavaScript errors')
  browser.close()
finally:
 # Remove only the isolated test submissions introduced by this run.
 ids=db('SELECT DISTINCT submission_id FROM codes WHERE code LIKE $1',[prefix+'%'])
 for row in ids:
  db('DELETE FROM codes WHERE submission_id=$1',[row['submission_id']]);db('DELETE FROM submissions WHERE id=$1',[row['submission_id']])
 (ROOT/'artifacts/e2e-results.json').write_text(json.dumps({'passed':results,'browser_errors':errors},indent=2))
