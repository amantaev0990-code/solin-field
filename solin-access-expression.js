/* Restricted Access expressions, shared by field rules and direct SQL controls.
 * No eval, VBA, DOM lookup, unknown functions, or implicit missing-field values.
 */
(()=>{'use strict';
const nil=v=>v===null||v===undefined;
function number(v){if(nil(v))return null;if(typeof v==='boolean')return v?-1:0;
 if(typeof v==='number'&&Number.isFinite(v))return v;
 if(typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())&&Number.isFinite(Number(v)))return Number(v);
 throw Error('Ожидалось число');}
const truth=v=>nil(v)?null:typeof v==='boolean'?v:number(v)!==0;
const bool=v=>v===null?null:v?-1:0;
function compare(op,a,b){if(nil(a)||nil(b))return null;
 if(typeof a==='number'||typeof b==='number'||typeof a==='boolean'||typeof b==='boolean'){a=number(a);b=number(b);}
 else{a=String(a).toLocaleUpperCase('ru-RU');b=String(b).toLocaleUpperCase('ru-RU');}
 return bool({'=':a===b,'<>':a!==b,'<':a<b,'>':a>b,'<=':a<=b,'>=':a>=b}[op]);}
function arithmetic(op,a,b){if(nil(a)||nil(b))return null;a=number(a);b=number(b);
 if(op==='/'&&b===0)throw Error('Деление на ноль');
 return {'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b}[op]();}
function round(v,p=0){if(nil(v)||nil(p))return null;v=number(v);p=number(p);
 const scale=10**p,x=v*scale,f=Math.floor(x),fraction=x-f;
 return (fraction===.5?(f%2===0?f:f+1):Math.round(x))/scale;}
function val(v){if(nil(v))throw Error('Val(NULL)');const s=String(v).replace(/[\t\n\r ]/g,'');
 const m=s.match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);return m?Number(m[0]):0;}
function tokenize(source){const out=[];let i=0;source=source.replace(/\\+"/g,'"');
 while(i<source.length){const c=source[i];if(/\s/.test(c)){i++;continue;}
 if(c==='"'||c==="'"){const quote=c;let s='',closed=false;i++;while(i<source.length){if(source[i]===quote){if(source[i+1]===quote){s+=quote;i+=2;continue;}i++;closed=true;break;}s+=source[i++];}if(!closed)throw Error('Незакрытая строка');out.push({type:'literal',value:s});continue;}
 if(c==='['){const end=source.indexOf(']',i+1);if(end<0)throw Error('Незакрытое имя поля');out.push({type:'name',value:source.slice(i+1,end)});i=end+1;continue;}
 const n=source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);if(n){out.push({type:'literal',value:Number(n[0])});i+=n[0].length;continue;}
 const name=source.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u);if(name){out.push({type:'name',value:name[0]});i+=name[0].length;continue;}
 const op=source.slice(i).match(/^(?:<=|>=|<>|[=<>+*/(),.!-])/);if(op){out.push({type:'op',value:op[0]});i+=op[0].length;continue;}
 throw Error('Неподдерживаемый символ: '+c);
 }return out;
}
const literal=value=>({kind:'literal',value});
const valueRef=()=>({kind:'ref',path:['$value']});
function parse(source,validation=false){const tokens=tokenize(source);let i=0;
 const peek=()=>tokens[i]?.value,word=w=>tokens[i]?.type!=='literal'&&String(peek()).toLowerCase()===w.toLowerCase();
 const eat=w=>{if(word(w)){i++;return true;}return false;};
 const expect=w=>{if(!eat(w))throw Error('Ожидалось '+w);};
 const binary=(op,left,right)=>({kind:'binary',op,left,right});
 function atom(implicit){if(eat('(')){const n=or(implicit);expect(')');return n;}
 const t=tokens[i++];if(!t)throw Error('Ожидалось выражение');if(t.type==='literal')return literal(t.value);
 if(t.type!=='name')throw Error('Ожидалось значение');
 const w=t.value.toLowerCase();if(w==='null')return literal(null);if(w==='yes'||w==='true')return literal(-1);if(w==='no'||w==='false')return literal(0);
 if(eat('(')){const args=[];if(!eat(')')){do{args.push(or(false));}while(eat(','));expect(')');}return {kind:'call',name:w,args};}
 const path=[t.value];while(eat('.')||eat('!')){const next=tokens[i++];if(next?.type!=='name')throw Error('Ожидалось имя поля');path.push(next.value);}return {kind:'ref',path};
 }
 function unary(implicit){if(eat('-'))return {kind:'unary',op:'-',arg:unary(implicit)};if(eat('+'))return unary(implicit);return atom(implicit);}
 function mul(implicit){let n=unary(implicit);while(['*','/'].includes(peek())){const op=tokens[i++].value;n=binary(op,n,unary(implicit));}return n;}
 function add(implicit){let n=mul(implicit);while(['+','-'].includes(peek())){const op=tokens[i++].value;n=binary(op,n,mul(implicit));}return n;}
 function cmp(implicit){let n;
 if(implicit&&(['=','<>','<','>','<=','>='].includes(peek())||word('is')))n=valueRef();else n=add(implicit);
 if(['=','<>','<','>','<=','>='].includes(peek())){const op=tokens[i++].value;return binary(op,n,add(false));}
 if(eat('is')){const not=eat('not');expect('null');return {kind:'isnull',not,arg:n};}
 if(implicit&&n.kind==='literal')return binary('=',valueRef(),n);return n;
 }
 function not(implicit){if(eat('not'))return {kind:'unary',op:'not',arg:not(implicit)};return cmp(implicit);}
 function and(implicit){let n=not(implicit);while(eat('and'))n=binary('and',n,not(implicit));return n;}
 function or(implicit){let n=and(implicit);while(eat('or'))n=binary('or',n,and(implicit));return n;}
 const ast=or(validation);if(i!==tokens.length)throw Error('Неподдерживаемое выражение около '+peek());return ast;
}
function field(row,name){const key=Object.keys(row||{}).find(k=>k.toLowerCase()===name.toLowerCase());if(key===undefined)throw Error('Нет контекста '+name);return row[key];}
function call(name,args){switch(name){
 case 'nz':if(args.length<1||args.length>2)break;return nil(args[0])?(args.length===2?args[1]:0):args[0];
 case 'iif':if(args.length!==3)break;return truth(args[0])?args[1]:args[2];
 case 'int':if(args.length!==1)break;return nil(args[0])?null:Math.floor(number(args[0]));
 case 'abs':if(args.length!==1)break;return nil(args[0])?null:Math.abs(number(args[0]));
 case 'round':if(args.length<1||args.length>2)break;return round(args[0],args[1]??0);
 case 'val':if(args.length!==1)break;return val(args[0]);
 case 'left':if(args.length!==2)break;if(nil(args[0])||nil(args[1]))return null;if(number(args[1])<0)throw Error('Отрицательная длина Left');return String(args[0]).slice(0,Math.trunc(number(args[1])));
 default:throw Error('Функция не перенесена: '+name);
 }throw Error('Число аргументов '+name);
}
function evaluate(ast,resolve){switch(ast.kind){
 case 'literal':return ast.value;
 case 'ref':return resolve(ast.path);
 case 'call':return call(ast.name,ast.args.map(a=>evaluate(a,resolve)));
 case 'isnull':return bool(ast.not?!nil(evaluate(ast.arg,resolve)):nil(evaluate(ast.arg,resolve)));
 case 'unary':{const a=evaluate(ast.arg,resolve);return ast.op==='not'?bool(nil(a)?null:!truth(a)):nil(a)?null:-number(a);}
 case 'binary':{const a=evaluate(ast.left,resolve),b=evaluate(ast.right,resolve);if(ast.op==='and'){const x=truth(a),y=truth(b);return bool(x===false||y===false?false:x===null||y===null?null:true);}if(ast.op==='or'){const x=truth(a),y=truth(b);return bool(x===true||y===true?true:x===null||y===null?null:false);}if(['+','-','*','/'].includes(ast.op))return arithmetic(ast.op,a,b);return compare(ast.op,a,b);}
 default:throw Error('Неизвестный узел');
}}
const cache=new Map();
function rule(expression,value,row,parent=row){const key='rule:'+expression;let ast=cache.get(key);if(!ast){ast=parse(expression,true);cache.set(key,ast);}
 const result=evaluate(ast,path=>{
 if(path[0]==='$value')return value;
 if(path.length===3&&path[0].toLowerCase()==='forms'&&path[1]==='ВыделВ')return field(parent,path[2]);
 if(path.length===1)return field(row,path[0]);throw Error('Нет контекста '+path.join('.'));
 });return result===null?null:truth(result);
}
const quote=s=>'"'+String(s).replace(/"/g,'""')+'"';
function sql(ast,resolve){switch(ast.kind){
 case 'literal':return nil(ast.value)?'NULL':typeof ast.value==='number'?String(ast.value):"'"+ast.value.replace(/'/g,"''")+"'";
 case 'ref':return resolve(ast.path);
 case 'isnull':return '('+sql(ast.arg,resolve)+(ast.not?' IS NOT NULL':' IS NULL')+')';
 case 'unary':return ast.op==='not'?'(NOT '+sql(ast.arg,resolve)+')':'ac_neg('+sql(ast.arg,resolve)+')';
 case 'call':{const arity={nz:[1,2],iif:[3],int:[1],abs:[1],round:[1,2],val:[1],left:[2]}[ast.name];if(!arity?.includes(ast.args.length))throw Error('Функция не перенесена: '+ast.name);const args=[...ast.args];if(['nz','round'].includes(ast.name)&&args.length===1)args.push(literal(0));return 'ac_'+ast.name+'('+args.map(a=>sql(a,resolve)).join(',')+')';}
 case 'binary':{const a=sql(ast.left,resolve),b=sql(ast.right,resolve);if(['and','or'].includes(ast.op))return '('+a+' '+ast.op.toUpperCase()+' '+b+')';const fn={'+':'add','-':'sub','*':'mul','/':'div','=':'eq','<>':'ne','<':'lt','>':'gt','<=':'le','>=':'ge'}[ast.op];if(!fn)throw Error('Оператор не перенесён');return 'ac_'+fn+'('+a+','+b+')';}
 default:throw Error('Неизвестный узел');
}}
function register(db){for(const [name,op]of Object.entries({eq:'=',ne:'<>',lt:'<',gt:'>',le:'<=',ge:'>='}))db.create_function('ac_'+name,(a,b)=>compare(op,a,b));
 for(const [name,op]of Object.entries({add:'+',sub:'-',mul:'*',div:'/'}))db.create_function('ac_'+name,(a,b)=>arithmetic(op,a,b));
 db.create_function('ac_neg',a=>nil(a)?null:-number(a));db.create_function('ac_nz',(a,b)=>call('nz',[a,b]));db.create_function('ac_iif',(a,b,c)=>call('iif',[a,b,c]));db.create_function('ac_round',(a,b)=>round(a,b));
 db.create_function('ac_left',(a,b)=>call('left',[a,b]));
 for(const name of ['int','abs','val'])db.create_function('ac_'+name,a=>call(name,[a]));
}
window.SolinAccessExpression={parse,evaluate,sql,rule,register,quote,number,compare,round,val};
})();
