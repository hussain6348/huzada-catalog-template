import { useState } from 'react';

export default function AdminProductUpload() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select an image!");

    setStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', 'client-uploads');

      const r2Response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await r2Response.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload image to R2');
      }

      const imagePath = uploadData.filePath;

      // STEP 2: Save everything to Turso
      const dbResponse = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, description, image_path: imagePath })
      });

      const dbData = await dbResponse.json();
      
      if (!dbData.success) {
        throw new Error(dbData.error || 'Failed to save product to database');
      }

      setStatus('success');
      alert(`Product fully published!`);
      
      setName('');
      setPrice('');
      setDescription('');
      setFile(null);

    } catch (error) {
      console.error(error);
      setStatus('error');
      alert(error.message || "Something went wrong during the upload.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Add New Product</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Product Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required 
            className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Price ($)</label>
          <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required 
            className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} 
            className="mt-1 block w-full border border-gray-300 rounded-md p-2" rows="3" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Product Image</label>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} required 
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>

        <button type="submit" disabled={status === 'uploading'}
          className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50">
          {status === 'uploading' ? 'Publishing...' : 'Save Product'}
        </button>
      </form>
    </div>
  );
}
