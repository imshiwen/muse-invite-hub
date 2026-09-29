from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json,time
ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:3001';results=[]
def done(name):results.append(name);print('PASS '+name,flush=True)
def queue(page):return page.evaluate('(window.dataLayer||[]).map(x=>Array.from(x))')
def state(page):
 d={}
 for x in queue(page):
  if len(x)>=3 and x[0]=='consent':d.update(x[2])
 return d
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 def context(country):
  ctx=browser.new_context(viewport={'width':390,'height':844})
  ctx.route('https://www.googletagmanager.com/**',lambda route:route.fulfill(content_type='text/javascript',body='window.__gaStub=true;'))
  ctx.route('https://**google-analytics.com/**',lambda route:route.abort())
  ctx.route('https://**analytics.google.com/**',lambda route:route.abort())
  ctx.route('**/api/geo',lambda route:route.fulfill(json={'country':country,'region':country,'requireConsent':country!='US'}))
  return ctx
 for country in ['DE','GB','CH','NO']:
  ctx=context(country);page=ctx.new_page();page.goto(BASE+'/privacy?test_secret=do-not-track',wait_until='networkidle')
  expect(page.get_by_role('complementary',name='Analytics cookie settings')).to_be_visible()
  s=state(page);assert all(s[k]=='denied' for k in ['analytics_storage','ad_storage','ad_user_data','ad_personalization'])
  q=queue(page);assert q[0][0:2]==['consent','default']
  views=[x for x in q if x[0:2]==['event','page_view']];assert len(views)==1
  assert views[0][2]['page_location']=='https://museinvitehub.org/privacy'
  assert 'do-not-track' not in json.dumps(q,default=str)
  page.get_by_role('button',name='Accept analytics cookies',exact=True).click();assert state(page)['analytics_storage']=='granted'
  assert all(state(page)[k]=='denied' for k in ['ad_storage','ad_user_data','ad_personalization'])
  page.get_by_role('button',name='Cookie settings',exact=True).click();page.get_by_role('button',name='Reject',exact=True).click();assert state(page)['analytics_storage']=='denied'
  if country=='DE':
   ctx.unroute('**/api/geo');ctx.route('**/api/geo',lambda route:route.fulfill(json={'country':'US','requireConsent':False}))
   page.reload(wait_until='networkidle');assert state(page)['analytics_storage']=='denied'
   expect(page.get_by_role('complementary',name='Analytics cookie settings')).to_have_count(0)
  ctx.close()
 done('EEA/UK/Switzerland/Norway default denied, accept/reject/reopen; no ad consent')
 done('exactly one page_view, cleaned URL, saved rejection survives move to US')
 ctx=context('US');page=ctx.new_page();page.goto(BASE+'/about',wait_until='networkidle');assert state(page)['analytics_storage']=='granted';expect(page.get_by_role('complementary',name='Analytics cookie settings')).to_have_count(0);ctx.close()
 done('identified non-consent region permits analytics without banner')
 for failure in [False,True]:
  ctx=context(None)
  if failure:ctx.unroute('**/api/geo');ctx.route('**/api/geo',lambda route:route.abort())
  page=ctx.new_page();page.goto(BASE+'/privacy',wait_until='networkidle');assert state(page)['analytics_storage']=='denied';expect(page.get_by_role('complementary',name='Analytics cookie settings')).to_have_count(0)
  page.get_by_role('button',name='Cookie settings',exact=True).click();expect(page.get_by_role('button',name='Reject',exact=True)).to_be_visible()
  if not failure:page.screenshot(path=str(ROOT/'artifacts/consent-mobile.png'),full_page=False)
  # Full private navigation unloads all analytics state and scripts.
  page.goto(BASE+'/admin',wait_until='networkidle');assert page.locator('script[src*="googletagmanager"]').count()==0;assert page.evaluate('typeof window.gtag')=='undefined'
  ctx.close()
 done('unknown/failed region remains denied; private document has no GA script or state')
 # Regression: a choice made while geolocation is pending must win.
 ctx=context('US');ctx.unroute('**/api/geo');pending=[]
 ctx.route('**/api/geo',lambda route:pending.append(route))
 page=ctx.new_page();page.goto(BASE+'/privacy',wait_until='domcontentloaded')
 for _ in range(30):
  if pending: break
  page.wait_for_timeout(25)
 assert pending
 page.get_by_role('button',name='Cookie settings',exact=True).click()
 page.get_by_role('button',name='Reject',exact=True).click()
 assert pending
 pending[0].fulfill(json={'country':'US','requireConsent':False})
 page.wait_for_load_state('networkidle');assert state(page)['analytics_storage']=='denied'
 ctx.close();done('explicit rejection during pending geolocation wins over US default')
 browser.close()
(ROOT/'artifacts/consent-results.json').write_text(json.dumps({'passed':results,'external_analytics':'All Google endpoints intercepted; real GA receipt not tested.'},indent=2))
