function e(e,i){return e[i.name]}function i(e){for(var i=arguments.length,t=new Array(i>1?i-1:0),s=1;s<i;s++)t[s-1]=arguments[s];return t.every(i=>!!e[i.name])}export default class{constructor(e){void 0===e&&(e={}),this.config={},this._systems=[],this._entities=[],this._queries={},this.config=e}makeQueryKey(){for(var e=arguments.length,i=new Array(e),t=0;t<e;t++)i[t]=arguments[t];return i.map(e=>e.name).sort().join("-")}queryWithKey(e){for(var i=arguments.length,t=new Array(i>1?i-1:0),s=1;s<i;s++)t[s-1]=arguments[s];return this._queries[e]?this._queries[e].entities:this._entities.filter(e=>t.every(i=>!!e[i.name]))}register(e){for(var i=arguments.length,t=new Array(i>1?i-1:0),s=1;s<i;s++)t[s-1]=arguments[s];var r=this.makeQueryKey(...t);this._systems.push([e,r]),this._queries[r]={components:t,entities:[],callbacks:[]}}query(){for(var e=arguments.length,i=new Array(e),t=0;t<e;t++)i[t]=arguments[t];var s=this.makeQueryKey(...i);return this.queryWithKey(s,...i)}subscribe(e,i,t){void 0===t&&(t=!1);var s=this.makeQueryKey(...e),r=this.queryWithKey(s,...e);return this._queries[s]?this._queries[s].callbacks.push(i):this._queries[s]={components:e,entities:r,callbacks:[i]},t&&i(r),()=>{this._queries[s]&&this._queries[s].callbacks.splice(this._queries[s].callbacks.indexOf(i),1)}}unsubscribe(e,i){var t=this.makeQueryKey(...e);this._queries[t]&&this._queries[t].callbacks.splice(this._queries[t].callbacks.indexOf(i),1)}createEntity(){for(var e={},i=arguments.length,t=new Array(i),s=0;s<i;s++)t[s]=arguments[s];return t.forEach(i=>{var[t,...s]=i;e[t.name]=new t(...s)}),this._entities.push(e),Object.values(this._queries).forEach(i=>{i.components.every(i=>!!e[i.name])&&i.entities.push(e),i.callbacks.forEach(e=>e(i.entities))}),e}addComponent(e){for(var i=arguments.length,t=new Array(i>1?i-1:0),s=1;s<i;s++)t[s-1]=arguments[s];~t.length&&(t.forEach(i=>{var[t,...s]=i;e[t.name]=new t(...s)}),Object.values(this._queries).forEach(i=>{i.entities.includes(e)||i.components.every(i=>!!e[i.name])&&(i.entities.push(e),i.callbacks.forEach(e=>e(i.entities)))}))}removeComponent(e){for(var i=arguments.length,t=new Array(i>1?i-1:0),s=1;s<i;s++)t[s-1]=arguments[s];~t.length&&(t.forEach(i=>{delete e[i.name]}),Object.values(this._queries).forEach(i=>{i.entities.includes(e)&&(i.components.every(i=>!!e[i.name])||(i.entities.splice(i.entities.indexOf(e),1),i.callbacks.forEach(e=>e(i.entities))))}),~Object.keys(e).length||this._entities.splice(this._entities.indexOf(e),1))}async run(){for(var e=this,i=arguments.length,t=new Array(i),s=0;s<i;s++)t[s]=arguments[s];if(this.config.onBefore&&await this.config.onBefore(...t),this.config.parallel)this._systems.forEach(e=>{var[i,s]=e;t?i(...t,this._queries[s].entities):i(this._queries[s].entities),this._queries[s].callbacks.forEach(e=>e(this._queries[s].entities))});else{var r=async function(i,s){t?await i(...t,e._queries[s].entities):await i(e._queries[s].entities),e._queries[s].callbacks.forEach(i=>i(e._queries[s].entities))};for(var[n,a]of this._systems)await r(n,a)}this.config.onAfter&&await this.config.onAfter(...t)}}export{e as getComponent,i as hasComponent};
//# sourceMappingURL=index.modern.js.map
