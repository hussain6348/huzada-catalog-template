import { useEffect, useState } from 'react';

export default function App() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/catalog')
      .then(res => res.json())
      .then(data => {
        if (data.results?.[0]?.response?.result?.rows) {
          setItems(data.results[0].response.result.rows);
        }
      });
  }, []);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Catalog Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        {items.length === 0 ? (
          <p className="text-gray-500">No items found.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="border-b last:border-0 py-3">
              <p className="font-semibold text-lg">{item.name || 'Unnamed Item'}</p>
              <p className="text-gray-700">{item.price || 'No Price'} - {item.status || 'Active'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
