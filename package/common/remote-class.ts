import { cache } from './cache';

export type RemoteIdentifier = string | number;

interface RemoteMembers<T> {
  methods: T;
  properties: T;
}

export interface SerializedRef extends RemoteMembers<string[]> {
  identifier: string | null;
  statics: RemoteMembers<string[]>;
}

type InstanceCache = Map<string, WeakRef<object>>;

interface ConsumerBinding {
  name: string;
  resource: string;
  identifier: SerializedRef['identifier'];
  properties: string[];
  instances: InstanceCache;
}

interface ProviderMetadata extends RemoteMembers<Set<string>> {
  identifier?: string;
  statics: RemoteMembers<Set<string>>;
  instances: InstanceCache;
}

type RemoteRequest =
  | [operation: 'refs']
  | [operation: 'read', id: RemoteIdentifier]
  | [operation: 'read_static', property: string]
  | [operation: 'invoke', id: RemoteIdentifier, method: string, ...args: unknown[]]
  | [operation: 'invoke_static', method: string, ...args: unknown[]];

const remoteExport = '__remote_class';
const providerMetadata = new WeakMap<object, ProviderMetadata>();
const instanceRegistry = new FinalizationRegistry<{
  cache: WeakRef<InstanceCache>;
  id: string;
  ref: WeakRef<object>;
}>(({ cache, id, ref }) => {
  const instances = cache.deref();

  if (instances?.get(id) === ref) instances.delete(id);
});

function getProviderMetadata(prototype: object): ProviderMetadata {
  let metadata = providerMetadata.get(prototype);

  if (!metadata) {
    metadata = {
      methods: new Set(),
      properties: new Set(),
      statics: { methods: new Set(), properties: new Set() },
      instances: new Map(),
    };
    providerMetadata.set(prototype, metadata);
  }

  return metadata;
}

function normalizeId(id: unknown): string {
  if ((typeof id === 'string' && id.length > 0) || (typeof id === 'number' && Number.isFinite(id))) {
    return String(id);
  }

  throw new TypeError('A remote identifier must be a non-empty string or a finite number.');
}

function internInstance<T extends object>(instances: InstanceCache, id: string, create: () => T): T {
  const previousRef = instances.get(id);
  const cached = previousRef?.deref();

  if (cached) return cached as T;

  if (previousRef) {
    instances.delete(id);
    instanceRegistry.unregister(previousRef);
  }

  const instance = create();
  const cachedByFactory = instances.get(id)?.deref();

  if (cachedByFactory) return cachedByFactory as T;

  const ref = new WeakRef(instance);
  instances.set(id, ref);
  instanceRegistry.register(instance, { cache: new WeakRef(instances), id, ref }, ref);

  return instance;
}

type MemberDecorator = (target: object, key: string, descriptor?: PropertyDescriptor) => void;

/**
 * Exposes a provider's method or field. Use `@Remote('id')` to mark the instance identifier.
 */
export function Remote(option: 'id'): MemberDecorator;
export function Remote(target: object, key: string, descriptor?: PropertyDescriptor): void;
export function Remote(target: object | 'id', key?: string, descriptor?: PropertyDescriptor): MemberDecorator | void {
  if (target === 'id') return (target, key, descriptor) => exposeMember(target, key, descriptor, true);

  exposeMember(target, key!, descriptor);
}

function exposeMember(target: object, key: string, descriptor?: PropertyDescriptor, identifier = false) {
  const isStatic = typeof target === 'function';
  const isMethod = typeof descriptor?.value === 'function';
  const metadata = getProviderMetadata(isStatic ? target.prototype : target);

  if (identifier) {
    if (isStatic || isMethod) throw new TypeError("@Remote('id') requires an instance property.");
    if (metadata.identifier !== undefined && metadata.identifier !== key) {
      throw new TypeError('A remote class can only declare one identifier.');
    }

    metadata.identifier = key;
  }

  if (descriptor?.set && !descriptor.get) throw new TypeError(`Remote property '${key}' requires a getter.`);

  const members = isStatic ? metadata.statics : metadata;

  if (isMethod) members.methods.add(key);
  else members.properties.add(key);
}

/** Base class for classes that expose methods and properties to other resources. */
export abstract class RemoteClassProvider {
  static readonly #providers = new Map<string, typeof RemoteClassProvider>();

  /** Looks up an instance by ID. Override this to load missing instances. */
  public static fromId(id: RemoteIdentifier): RemoteClassProvider | undefined {
    return this.getCached(id);
  }

  protected static getCached<T extends RemoteClassProvider>(
    this: { prototype: T },
    id: RemoteIdentifier,
  ): T | undefined {
    return getProviderMetadata(this.prototype).instances.get(normalizeId(id))?.deref() as T | undefined;
  }

  protected static intern<T extends RemoteClassProvider>(
    this: { prototype: T },
    id: RemoteIdentifier,
    create: () => T,
  ): T {
    return internInstance(getProviderMetadata(this.prototype).instances, normalizeId(id), create);
  }

  /** Registers the provider for remote access. */
  public static register(name = this.name) {
    const { identifier, methods, properties } = getProviderMetadata(this.prototype);

    if (identifier === undefined && (methods.size || properties.size)) {
      throw new Error(`${name} requires an @Remote('id') property to expose instance members.`);
    }

    if (!RemoteClassProvider.#providers.size) {
      globalThis.exports(remoteExport, RemoteClassProvider.#dispatchRemoteRequest);
    }

    RemoteClassProvider.#providers.set(name, this);
  }

  static #resolveInstance(
    provider: typeof RemoteClassProvider,
    metadata: ProviderMetadata,
    name: string,
    id: RemoteIdentifier,
  ) {
    const { identifier, instances } = metadata;

    if (identifier === undefined) throw new Error(`${name} does not expose instances.`);

    const key = normalizeId(id);

    return internInstance(instances, key, () => {
      const instance = provider.fromId(key);

      if (!instance) throw new Error(`${name} instance '${key}' not found.`);

      if (normalizeId(Reflect.get(instance, identifier)) !== key) {
        throw new Error(`${name} returned a different identifier for '${key}'.`);
      }

      return instance;
    });
  }

  static #dispatchRemoteRequest(name: string, ...request: RemoteRequest): unknown {
    const provider = RemoteClassProvider.#providers.get(name);

    if (!provider) throw new Error(`Remote class '${name}' is unavailable.`);

    const metadata = getProviderMetadata(provider.prototype);
    const { identifier, methods, properties, statics } = metadata;
    const [operation] = request;

    switch (operation) {
      case 'refs':
        return {
          identifier: identifier ?? null,
          methods: [...methods],
          properties: [...properties],
          statics: { methods: [...statics.methods], properties: [...statics.properties] },
        } satisfies SerializedRef;
      case 'read': {
        const [, id] = request;
        const instance = RemoteClassProvider.#resolveInstance(provider, metadata, name, id);

        return Object.fromEntries([...properties].map((property) => [property, Reflect.get(instance, property)]));
      }
      case 'read_static': {
        const [, property] = request;

        if (!statics.properties.has(property))
          throw new Error(`${name} does not expose static property '${property}'.`);

        return Reflect.get(provider, property);
      }
      case 'invoke': {
        const [, id, method, ...args] = request;

        if (!methods.has(method)) throw new Error(`${name} does not expose '${method}'.`);

        const instance = RemoteClassProvider.#resolveInstance(provider, metadata, name, id);

        return Reflect.apply(Reflect.get(instance, method), instance, args);
      }
      case 'invoke_static': {
        const [, method, ...args] = request;

        if (!statics.methods.has(method)) throw new Error(`${name} does not expose static method '${method}'.`);

        return Reflect.apply(Reflect.get(provider, method), provider, args);
      }
      default:
        throw new Error(`Unknown remote operation '${operation}'.`);
    }
  }
}

/** Base class for classes that use a remote provider. */
export abstract class RemoteClassConsumer {
  static readonly #bindings = new WeakMap<object, ConsumerBinding>();

  /** Binds a consumer class to a provider. */
  public static connect<T extends { name: string; prototype: RemoteClassConsumer }>(
    this: T,
    name?: string,
    resource?: string,
  ): T {
    const binding = RemoteClassConsumer.#bindings.get(this.prototype);

    if (binding) {
      if ((name ?? binding.name) !== binding.name || (resource ?? binding.resource) !== binding.resource) {
        throw new Error(`${this.name} is already bound to '${binding.resource}:${binding.name}'.`);
      }

      return this;
    }

    name ??= this.name;
    resource ??= cache.resource;

    const { identifier, methods, properties, statics } = RemoteClassConsumer.#callRemote<SerializedRef>(
      resource,
      name,
      'refs',
    );

    for (const member of [...methods, ...properties]) {
      if (member in this.prototype) throw new Error(`${this.name} already defines '${member}'.`);
    }

    for (const member of [...statics.methods, ...statics.properties]) {
      if (member in this) throw new Error(`${this.name} already defines static member '${member}'.`);
    }

    if (identifier !== null) {
      for (const method of methods) {
        Object.defineProperty(this.prototype, method, {
          configurable: true,
          writable: true,
          value(this: RemoteClassConsumer, ...args: unknown[]) {
            const id = normalizeId(Reflect.get(this, identifier));
            return RemoteClassConsumer.#callRemote(resource, name, 'invoke', id, method, ...args);
          },
        });
      }
    }

    for (const method of statics.methods) {
      Object.defineProperty(this, method, {
        configurable: true,
        writable: true,
        value: (...args: unknown[]) =>
          RemoteClassConsumer.#callRemote(resource, name, 'invoke_static', method, ...args),
      });
    }

    for (const property of statics.properties) {
      Object.defineProperty(this, property, {
        configurable: true,
        enumerable: true,
        get: () => RemoteClassConsumer.#callRemote(resource, name, 'read_static', property),
      });
    }

    RemoteClassConsumer.#bindings.set(this.prototype, { name, resource, identifier, properties, instances: new Map() });
    return this;
  }

  /** Reuses an existing proxy or creates one with properties from the provider. */
  protected static proxy<T extends RemoteClassConsumer>(
    this: { name: string; prototype: T },
    id: RemoteIdentifier,
    create: () => T,
    name?: string,
    resource?: string,
  ): T {
    const key = normalizeId(id);
    RemoteClassConsumer.connect.call(this, name, resource);

    const {
      name: className,
      resource: providerResource,
      identifier,
      properties,
      instances,
    } = RemoteClassConsumer.#bindings.get(this.prototype)!;

    if (identifier === null) throw new Error(`${className} does not expose instances.`);

    return internInstance(instances, key, () => {
      const snapshot = RemoteClassConsumer.#callRemote<Record<string, unknown>>(
        providerResource,
        className,
        'read',
        key,
      );

      if (!Object.hasOwn(snapshot, identifier) || normalizeId(snapshot[identifier]) !== key) {
        throw new Error(`${className} returned a different identifier for '${key}'.`);
      }

      const instance = create();

      for (const property of properties) {
        Object.defineProperty(instance, property, {
          configurable: true,
          enumerable: true,
          writable: property !== identifier,
          value: Object.hasOwn(snapshot, property) ? snapshot[property] : undefined,
        });
      }

      return instance;
    });
  }

  static #callRemote<T = unknown>(resource: string, name: string, ...request: RemoteRequest): T {
    const resourceExports = globalThis.exports[resource];
    const callback = resourceExports?.[remoteExport];

    if (typeof callback !== 'function') throw new Error(`Remote export '${resource}:${remoteExport}' is unavailable.`);

    return Reflect.apply(callback, resourceExports, [name, ...request]);
  }
}
