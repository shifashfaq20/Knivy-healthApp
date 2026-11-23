import { useQuery } from '@tanstack/react-query';
import type { ListOptions, Repository } from '../db/repository';

/**
 * Reads a local collection. Query keys are value-based, so pass stable bounds
 * (e.g. day boundaries from utils/date) rather than `new Date()` on every render.
 * Writes through a repository invalidate these queries automatically.
 */
export function useRecords<T>(repo: Repository<T>, opts: ListOptions = {}, enabled = true) {
  return useQuery({
    queryKey: ['records', repo.table, opts],
    queryFn: () => repo.list(opts),
    enabled,
  });
}

export function useRecord<T>(repo: Repository<T>, id: string | undefined) {
  return useQuery({
    queryKey: ['records', repo.table, 'one', id],
    queryFn: () => (id ? repo.get(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}
