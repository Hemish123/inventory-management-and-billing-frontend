import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export default function Table({ columns, data, onRowClick, rowClassName, selectable, selectedRows = [], onSelectionChange }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    const comp = aVal < bVal ? -1 : 1;
    return sortConfig.direction === 'asc' ? comp : -comp;
  });

  const SortIcon = ({ column }) => {
    if (!column.sortable) return null;
    if (sortConfig.key !== column.key) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
      : <ChevronDown className="w-3.5 h-3.5 text-brand-500" />;
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange(sortedData.map(row => row.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (e, id) => {
    e.stopPropagation();
    if (e.target.checked) {
      onSelectionChange([...selectedRows, id]);
    } else {
      onSelectionChange(selectedRows.filter(rowId => rowId !== id));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            {selectable && (
              <th className="px-4 py-3 text-left w-12">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                  checked={sortedData.length > 0 && selectedRows.length === sortedData.length}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && handleSort(col.key)}
                className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider
                  ${col.sortable ? 'cursor-pointer hover:text-slate-600 select-none' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  {col.label}
                  <SortIcon column={col} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sortedData.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => onRowClick?.(row)}
              className={`transition-colors duration-150 
                ${onRowClick ? 'cursor-pointer hover:bg-brand-50/50' : ''}
                ${rowClassName ? rowClassName(row) : ''}
                ${selectable && selectedRows.includes(row.id) ? 'bg-brand-50/30' : ''}`}
            >
              {selectable && (
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-600 cursor-pointer"
                    checked={selectedRows.includes(row.id)}
                    onChange={(e) => handleSelectRow(e, row.id)}
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm text-slate-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {sortedData.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No data available</p>
        </div>
      )}
    </div>
  );
}
