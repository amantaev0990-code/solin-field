// Smoke-test the single-button MDB export screen in mobile WebKit.
// This deliberately does not create a file without a selected forest.
import { webkit } from 'playwright';
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8765/solin-field/mdb-wasm-poc/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('button',{name:'Экспорт',exact:true}).waitFor({timeout:90000});
 const buttons=await page.getByRole('button').count();
 if(buttons!==1)throw Error('Expected one Export button, got '+buttons);
 if(errors.length)throw Error('JavaScript errors: '+errors.join('; '));
 console.log('WEBKIT_EXPORT_UI_OK: single Export button, no test/demo controls.');
}finally{
 await browser.close();
}
