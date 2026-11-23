import type { CollectionName } from './collections';

type Listener = (collection: CollectionName) => void;
const listeners = new Set<Listener>();

export function onCollectionChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitCollectionChange(collection: CollectionName) {
  listeners.forEach((l) => l(collection));
}
