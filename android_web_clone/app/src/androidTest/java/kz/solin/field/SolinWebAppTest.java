package kz.solin.field;

import static org.junit.Assert.*;
import android.app.Activity;
import android.webkit.WebView;
import android.view.View;
import android.view.ViewGroup;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class SolinWebAppTest {
    @Rule public ActivityScenarioRule<MainActivity> scenario =
        new ActivityScenarioRule<>(MainActivity.class);

    private String js(String code) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.getScenario().onActivity(activity -> {
            ViewGroup root = activity.findViewById(android.R.id.content);
            WebView web = (WebView) root.getChildAt(0);
            web.evaluateJavascript("(function(){" + code + "})()", value -> {
                result.set(value);
                latch.countDown();
            });
        });
        assertTrue("WebView evaluateJavascript timed out", latch.await(15, TimeUnit.SECONDS));
        return result.get();
    }

    private void ready() throws Exception {
        long timeout = System.currentTimeMillis() + 30000;
        do {
            if ("true".equals(js("return typeof D !== 'undefined' && !!D && !!D.quarters && Object.keys(D.quarters).length >= 70;"))) return;
            Thread.sleep(350);
        } while (System.currentTimeMillis() < timeout);
        fail("SOLI-N original bundled data did not load while offline");
    }
    private void expect(String expression, String message) throws Exception {
        assertEquals(message, "true", js("return Boolean(" + expression + ");"));
    }

    @Test public void originalWebsiteLoadsWithoutInternet() throws Exception {
        ready();
        expect("document.querySelector('.brand h1').textContent.trim() === 'SOLI-N Field'", "Original app title");
        expect("document.querySelector('.forestTitle h2').textContent.includes('Бугетсайское')", "Original forest details");
        expect("Object.keys(D.quarters).length === 70", "Exactly 70 forest quarters");
        expect("Object.values(D.quarters).reduce((s,q)=>s+q.compartments.length,0) === 471", "Exactly 471 compartments");
        expect("Math.abs(Number(document.querySelector('#area').textContent.replace(/\\s/g,'').replace(',','.'))-6963) < 0.01", "Total area");
        expect("typeof L === 'object' && typeof L.map === 'function'", "Offline Leaflet library");
        expect("document.querySelectorAll('.sectionTab').length===5", "Navigation tabs retained");
        expect("typeof window.SolinAndroid !== 'undefined'", "Android file-save bridge active");
    }

    @Test public void quartersCompartmentsCardsAndReferencesOpen() throws Exception {
        ready();
        expect("document.querySelectorAll('#quarters .quarterCard').length===70", "Quarter list renders");
        expect("typeof openQuarter === 'function'", "Original navigation defined");
        expect("(openQuarter('1'),document.querySelectorAll('#qComps .compCard').length>0)", "Quarter 1 opens");
        expect("(document.querySelector('#qComps .compCard').click(),document.querySelector('#card').classList.contains('active'))", "Compartment card opens");
        expect("document.querySelector('#cardTitle').textContent.includes('Квартал 1')", "Title shows correct quarter");
        expect("document.querySelector('#humanContent .humanField') !== null", "Taxation details rendered");
        expect("(show('refsScreen'),document.querySelectorAll('#friendlyRefs .refCard').length>0)", "References load");
    }

    @Test public void canCreateQuarterAndSaveOffline() throws Exception {
        ready();
        String result=js("openQuarterForm();document.querySelector('#newKV').value='9971';createQuarter();return !!D.quarters['9971'] && !!JSON.parse(localStorage.getItem('solin_user_data_v1')).quarters['9971'];");
        assertEquals("Offline quarter creation persisted", "true", result);
        expect("document.querySelector('#qcount').textContent==='71'", "Count updates");
    }

    @Test public void geoJsonMapImportWorksOffline() throws Exception {
        ready();
        expect("(openMapScreen(), !!fieldMap)", "Leaflet map created");
        js("window.__testImportDone=false;window.__testImportSuccess=false;var geo={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[59.14,50.05]},properties:{name:'check'}}]};var file=new File([JSON.stringify(geo)],'sample.geojson',{type:'application/geo+json'});handleMapFiles({files:[file],value:''}).then(()=>{window.__testImportSuccess=importedMapLayers.some(x=>x.name==='sample.geojson'&&x.count===1);window.__testImportDone=true;}).catch(e=>{window.__testImportError=String(e);window.__testImportDone=true;});return true;");
        long timeout=System.currentTimeMillis()+10000;
        while (System.currentTimeMillis()<timeout) {
            if ("true".equals(js("return window.__testImportDone===true"))) break;
            Thread.sleep(200);
        }
        expect("window.__testImportSuccess===true", "GeoJSON file parsed and rendered offline");
    }
}
