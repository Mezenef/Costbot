interface DataTableProps {
  data: Record<string, unknown>[];
}

export default function DataTable({ data }: DataTableProps) {
  if (!data || data.length === 0) return null;
  const columns = Object.keys(data[0]);

  return (
    <div className="w-full overflow-x-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 my-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {typeof row[col] === "number" ? (row[col] as number).toLocaleString("tr-TR") : String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}