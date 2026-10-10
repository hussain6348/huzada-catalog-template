import React, { useState, useEffect } from 'react';

export default function AdminProductList() {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', description: '', image_path: '' });

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProducts();
      }
    } catch (err) {
      console.error('Failed to delete product', err);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm })
      });
      if (res.ok) {
        setEditingId(null);
        fetchProducts();
      }
    } catch (err) {
      console.error('Failed to update product', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Inventory Registry</h2>
      <div className="space-y-4">
        {products.map((p) => (
          <div key={p.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 gap-4">
            {editingId === p.id ? (
              <form onSubmit={handleUpdate} className="flex-1 space-y-3 w-full">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Product Name"
                  className="w-full border p-2 rounded"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  placeholder="Price"
                  className="w-full border p-2 rounded"
                  required
                />
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Description"
                  className="w-full border p-2 rounded"
                />
                <input
                  type="text"
                  value={editForm.image_path}
                  onChange={(e) => setEditForm({ ...editForm, image_path: e.target.value })}
                  placeholder="Image URL"
                  className="w-full border p-2 rounded"
                />
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="bg-gray-400 text-white px-4 py-2 rounded font-medium hover:bg-gray-500">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  {(p.image || p.image_path || (Array.isArray(p.images) && p.images[0])) ? (
                    <img
                      src={p.image || p.image_path || p.images[0]}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                      No img
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                    <p className="text-green-600 font-bold">${p.price}</p>
                    <p className="text-sm text-gray-500">{p.description}</p>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setEditForm({
                        name: p.name,
                        price: p.price,
                        description: p.description,
                        image_path: p.image_path || p.image || (Array.isArray(p.images) ? p.images[0] : '')
                      });
                    }}
                    className="flex-1 md:flex-none bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded font-medium hover:bg-blue-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="flex-1 md:flex-none bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded font-medium hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-gray-500 text-center py-8 bg-white rounded-lg border border-dashed">
            No products uploaded yet.
          </p>
        )}
      </div>
    </div>
  );
}
