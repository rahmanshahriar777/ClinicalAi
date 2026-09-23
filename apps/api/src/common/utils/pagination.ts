import type { Paginated, PaginationQuery } from '@app/shared';

export function toSkipTake(q: PaginationQuery): { skip: number; take: number } {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function paginate<T>(items: T[], total: number, q: PaginationQuery): Paginated<T> {
  return { items, page: q.page, pageSize: q.pageSize, total };
}
