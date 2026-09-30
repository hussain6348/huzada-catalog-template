import AdminProductUpload from './components/AdminProductUpload';
import AdminProductList from './components/AdminProductList';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-2">Agency Dashboard</h1>
      <p className="text-center text-gray-500 mb-10">Manage your product catalog</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-4">
        <div className="lg:col-span-1">
          <AdminProductUpload />
        </div>
        <div className="lg:col-span-2">
          <AdminProductList />
        </div>
      </div>
    </div>
  );
}

export default App;
