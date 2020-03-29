function e(e,s){return e[s.name]}function s(e,s){return!!e[s.name]}function i(e,s){return s.every(s=>!!e[s.name])}class t{constructor(e){this.config={},this._systems=[],this._entities=[],this._queries={},this.config=e||{}}makeQueryKey(e){return e.map(e=>e.name).sort().join("-")}queryWithKey(e,s,t){if(this._queries[e])return this._queries[e].entities;var n=this._entities.filter(e=>i(e,s));return t&&(this._queries[e]={components:s,entities:n,callbacks:[]}),n}_handleAddCallbacks(e){Object.values(this._queries).forEach(s=>{s.entities.includes(e)||i(e,s.components)&&(s.entities.push(e),s.callbacks.forEach(e=>e(s.entities)))})}_handleRemoveCallbacks(e){Object.values(this._queries).forEach(s=>{s.entities.includes(e)&&(i(e,s.components)||(s.entities.splice(s.entities.indexOf(e),1),s.callbacks.forEach(e=>e(s.entities))))}),~Object.keys(e).length||this._entities.splice(this._entities.indexOf(e),1)}addComponent(e,s){for(var i=arguments.length,t=new Array(i>2?i-2:0),n=2;n<i;n++)t[n-2]=arguments[n];e[s.name]=new s(...t),this._handleAddCallbacks(e)}addComponents(e,s){~s.length&&(s.forEach(s=>{var[i,...t]=s;e[i.name]=new i(...t)}),this._handleAddCallbacks(e))}createEntity(e){var s={};return e.forEach(e=>{var[i,...t]=e;s[i.name]=new i(...t)}),this._entities.push(s),Object.values(this._queries).forEach(e=>{i(s,e.components)&&e.entities.push(s),e.callbacks.forEach(s=>s(e.entities))}),s}query(e,s){var i=this.makeQueryKey(e);return this.queryWithKey(i,e,s)}register(e,s){var i=this.makeQueryKey(s);this._systems.push([e,i]),this._queries[i]={components:s,entities:[],callbacks:[]}}removeComponent(e,s){s&&(delete e[s.name],this._handleRemoveCallbacks(e))}removeComponents(e,s){s&&~s.length&&(s.forEach(s=>{delete e[s.name]}),this._handleRemoveCallbacks(e))}async run(){for(var e=arguments.length,s=new Array(e),i=0;i<e;i++)s[i]=arguments[i];if(this.config.onBefore&&await this.config.onBefore(...s),this.config.parallel)this._systems.forEach(e=>{var[i,t]=e;s?i(...s,this._queries[t].entities):i(this._queries[t].entities)});else for(var[t,n]of this._systems)s?await t(...s,this._queries[n].entities):await t(this._queries[n].entities);this.config.onAfter&&await this.config.onAfter(...s)}subscribe(e,s,i){var t=this.makeQueryKey(e),n=this.queryWithKey(t,e);return this._queries[t]?this._queries[t].callbacks.push(s):this._queries[t]={components:e,entities:n,callbacks:[s]},i&&s(n),()=>{this._queries[t]&&this._queries[t].callbacks.splice(this._queries[t].callbacks.indexOf(s),1)}}unsubscribe(e,s){var i=this.makeQueryKey(e);this._queries[i]&&this._queries[i].callbacks.splice(this._queries[i].callbacks.indexOf(s),1)}updateComponent(e,s,i){e[s.name]=i(e[s.name])||e[s.name],Object.values(this._queries).forEach(s=>{s.entities.includes(e)&&s.callbacks.forEach(e=>e(s.entities))})}}export{t as World,e as getComponent,s as hasComponent,i as hasComponents};
//# sourceMappingURL=index.modern.js.map
