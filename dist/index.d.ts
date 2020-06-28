declare type Entity = {
    [componentName: string]: any;
};
interface IComponent<T> {
    new (...args: any): T;
}
declare type QueryCallback = (entities: Entity[]) => void;
declare type ComponentUpdater<T> = (component: T) => T;
interface Config {
    parallel?: boolean;
    onBefore?: (...args: any[]) => Promise<void>;
    onAfter?: (...args: any[]) => Promise<void>;
}
export declare function getID(entity: Entity): string;
export declare function getComponent<T>(entity: Entity, Component: IComponent<T>): T;
export declare function hasComponent<T>(entity: Entity, components: IComponent<T>): boolean;
export declare function hasComponents(entity: Entity, components: IComponent<unknown>[]): boolean;
declare class _Component<T> {
    constructor(obj?: {});
}
declare type Component<T> = _Component<T> & T;
export declare const Component: new <T>(obj: T) => _Component<T> & T;
export declare class ID extends Component<{
    id: string;
}> {
}
export declare class World {
    protected config: Config;
    private _systems;
    private _entities;
    private _queries;
    constructor(config?: Config);
    protected makeQueryKey(components: IComponent<unknown>[]): string;
    protected queryWithKey(key: string, components: IComponent<unknown>[], persist?: Boolean): Entity[];
    private _handleAddCallbacks;
    private _handleRemoveCallbacks;
    addComponent<T>(entity: Entity, Component: IComponent<T>, ...args: any[]): void;
    addComponents(entity: Entity, components: [IComponent<unknown>, ...any[]][]): void;
    createEntity(components: [IComponent<unknown>, ...any[]][]): Entity;
    get(id: string): Entity;
    query(components: IComponent<unknown>[], persist?: Boolean): Entity[];
    register(system: Function, components: IComponent<unknown>[]): void;
    removeComponent<T>(entity: Entity, component: IComponent<T>): void;
    removeComponents(entity: Entity, components: IComponent<unknown>[]): void;
    run(...args: any[]): Promise<void>;
    subscribe(components: IComponent<unknown>[], callback: QueryCallback, emit?: boolean): Function;
    unsubscribe(components: IComponent<unknown>[], callback: QueryCallback): void;
    updateComponent<T>(entity: Entity, Component: IComponent<T>, update: any | ComponentUpdater<T>): void;
}
export {};
