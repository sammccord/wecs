function e(e){return e[a.name].id}function s(e,s){return e[s.name]}function t(e,s){return!!e[s.name]}function i(e,s){return s.every(s=>!!e[s.name])}const n=class{constructor(e={}){Object.assign(this,e)}};class a extends n{}class c{constructor(e={}){this.config={},this._systems=[],this._entities={},this._queries={},this.config=e}makeQueryKey(e){return e.map(e=>e.name).sort().join("-")}queryWithKey(e,s,t){if(this._queries[e])return this._queries[e].entities;const n=Object.values(this._entities).filter(e=>i(e,s));return t&&(this._queries[e]={components:s,entities:n,callbacks:[]}),n}_handleAddCallbacks(e){Object.values(this._queries).forEach(s=>{s.entities.includes(e)||i(e,s.components)&&(s.entities.push(e),s.callbacks.forEach(e=>e(s.entities)))})}_handleRemoveCallbacks(e){Object.values(this._queries).forEach(s=>{s.entities.includes(e)&&(i(e,s.components)||(s.entities.splice(s.entities.indexOf(e),1),s.callbacks.forEach(e=>e(s.entities))))}),1===Object.keys(e).length&&delete this._entities[e.ID.id]}addComponent(e,s,...t){e[s.name]=new s(...t),this._handleAddCallbacks(e)}addComponents(e,s){~s.length&&(s.forEach(([s,...t])=>{e[s.name]=new s(...t)}),this._handleAddCallbacks(e))}createEntity(e){const s={};return e.forEach(([e,...t])=>{s[e.name]=new e(...t)}),s.ID||(s.ID=new a({id:String((new Date).valueOf())})),this._entities[s.ID.id]=s,Object.values(this._queries).forEach(e=>{i(s,e.components)&&e.entities.push(s),e.callbacks.forEach(s=>s(e.entities))}),s}get(e){return this._entities[e]}query(e,s){const t=this.makeQueryKey(e);return this.queryWithKey(t,e,s)}register(e,s){const t=this.makeQueryKey(s);this._systems.push([e,t]),this._queries[t]={components:s,entities:[],callbacks:[]}}removeComponent(e,s){s&&s.name!==a.name&&(delete e[s.name],this._handleRemoveCallbacks(e))}removeComponents(e,s){s&&~s.length&&(s.forEach(s=>{s.name!==a.name&&delete e[s.name]}),this._handleRemoveCallbacks(e))}async run(...e){if(this.config.onBefore&&await this.config.onBefore(...e),this.config.parallel)this._systems.forEach(([s,t])=>{e?s(...e,this._queries[t].entities):s(this._queries[t].entities)});else for(let[s,t]of this._systems)e?await s(...e,this._queries[t].entities):await s(this._queries[t].entities);this.config.onAfter&&await this.config.onAfter(...e)}subscribe(e,s,t){const i=this.makeQueryKey(e),n=this.queryWithKey(i,e);return this._queries[i]?this._queries[i].callbacks.push(s):this._queries[i]={components:e,entities:n,callbacks:[s]},t&&s(n),()=>{this._queries[i]&&this._queries[i].callbacks.splice(this._queries[i].callbacks.indexOf(s),1)}}unsubscribe(e,s){const t=this.makeQueryKey(e);this._queries[t]&&this._queries[t].callbacks.splice(this._queries[t].callbacks.indexOf(s),1)}updateComponent(e,s,t){e[s.name]="function"==typeof t?t(e[s.name])||e[s.name]:t,Object.values(this._queries).forEach(s=>{s.entities.includes(e)&&s.callbacks.forEach(e=>e(s.entities))})}}export{n as Component,a as ID,c as World,s as getComponent,e as getID,t as hasComponent,i as hasComponents};
//# sourceMappingURL=index.modern.js.map
