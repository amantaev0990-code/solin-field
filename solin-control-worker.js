/* Each run owns a separate WASM database and is terminated after its report. */
self.window=self;
importScripts('./vendor/sql-wasm.js','./solin-access-expression.js','./solin-access-sql.js','./solin-control-data.js','./solin-control-engine.js','./solin-native-control-data.js','./solin-native-control-runtime.js','./solin-native-control-engine.js');
self.onmessage=async event=>{
 const {options,validations,routes}=event.data;
 self.SOLIN_AUDIT={validations,routes:{Контроль:routes}};
 try{self.postMessage({report:await self.SolinControlEngine.runLocal(options)});}catch(e){self.postMessage({error:e.message||String(e)});}
};
