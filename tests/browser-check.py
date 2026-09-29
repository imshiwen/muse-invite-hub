from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
 page.screenshot(path=str(root/'artifacts/home-desktop.png'),full_page=True)
 print(json.dumps({'title':page.title(),'h1':page.locator('h1').inner_text(),'cards':page.locator('.code-card').count(),'errors':errors}))
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(root/'artifacts/home-mobile.png'),full_page=True)
 print('mobile overflow',page.evaluate('document.documentElement.scrollWidth > innerWidth'))
 page.goto('http://127.0.0.1:3000/share',wait_until='networkidle')
 page.screenshot(path=str(root/'artifacts/share-mobile.png'),full_page=True)
 browser.close()
