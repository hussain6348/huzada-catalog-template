import { useState, useEffect } from 'react';

export default function AdminProductList() {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', description: '', image_path: '' });

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) setProducts(data.products);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    fetchProducts();
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    });
    setEditingId(null);
    fetchProducts();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-10">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Manage Catalog</h2>
      <div className="space-y-4">
        {products.map(p => (
          <div key={p.id} className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row items-start md:items-center justify-between border border-gray-200 gap-4">
            {editingId === p.id ? (
              <form onSubmit={(e) => handleUpdate(e, p.id)} className="flex-1 flex flex-wrap gap-2 w-full">
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="border p-2 rounded flex-1 min-w-[150px]" required />
                <input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} className="border p-2 rounded w-24" required />
                <input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="border p-2 rounded flex-1 min-w-[200px]" />
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="bg-gray-400 text-white px-4 py-2 rounded font-medium hover:bg-gray-500">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                  <p className="text-green-600 font-bold">${p.price}</p>
                  <p className="text-sm text-gray-500">{p.description}</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => { setEditingId(p.id); setEditForm({name: p.name, price: p.price, description: p.description, image_path: p.image_path}); }} className="flex-1 md:flex-none bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded font-medium hover:bg-blue-100">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="flex-1 md:flex-none bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded font-medium hover:bg-red-100">Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
        {products.length === 0 && <p className="text-gray-500 text-center py-8 bg-white rounded-lg border border-dashed">No products uploaded yet.</p>}
      </div>
    </div>
  );
}
