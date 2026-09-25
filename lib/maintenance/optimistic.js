// Small pure helpers for an optimistic edit of one record in a store slice.
//
// The rollback checks object identity before restoring the prior row. That is
// deliberate: if another operation or a refresh replaced the row while this
// request was in flight, that later state is authoritative and a failed older
// request must not overwrite it.

export function applyOptimisticRecordUpdate(data, slice, id, update) {
  const records = data[slice] || [];
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return { data, previous: null, optimistic: null };

  const previous = records[index];
  const optimistic = update(previous);
  const nextRecords = [...records];
  nextRecords[index] = optimistic;

  return {
    data: { ...data, [slice]: nextRecords },
    previous,
    optimistic,
  };
}

export function rollbackOptimisticRecordUpdate(data, slice, id, previous, optimistic) {
  if (!previous || !optimistic) return data;

  const records = data[slice] || [];
  const index = records.findIndex((record) => record.id === id);
  // A later optimistic edit, successful response, or refresh has already
  // replaced this record. Preserve it instead of restoring stale data.
  if (index === -1 || records[index] !== optimistic) return data;

  const nextRecords = [...records];
  nextRecords[index] = previous;
  return { ...data, [slice]: nextRecords };
}

export function applyOptimisticRecordRemoval(data, slice, id) {
  const records = data[slice] || [];
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return { data, previous: null, index: -1 };

  return {
    data: { ...data, [slice]: records.filter((record) => record.id !== id) },
    previous: records[index],
    index,
  };
}

export function rollbackOptimisticRecordRemoval(data, slice, id, previous, index) {
  if (!previous || (data[slice] || []).some((record) => record.id === id)) return data;

  const records = [...(data[slice] || [])];
  records.splice(Math.min(index, records.length), 0, previous);
  return { ...data, [slice]: records };
}
