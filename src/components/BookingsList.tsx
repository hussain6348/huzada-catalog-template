import React, { useState, useEffect } from "react";

export default function BookingsList() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings?page=${page}&limit=50&date=${date}`);
      const data = await res.json();
      setBookings(data || []);
    } catch (error) {
      console.error("Failed to fetch bookings", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [page, date]);

  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Live Customer Bookings (Database)</h2>
          <p className="text-sm text-gray-500 mt-1">Synchronized live from Serverless Environment to Secure Database</p>
        </div>
        
        <div className="flex space-x-2">
          <input 
            type="date" 
            value={date}
            onChange={(e) => { setDate(e.target.value); setPage(1); }}
            className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
          />
          {date && (
            <button 
              onClick={() => { setDate(""); setPage(1); }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="p-0">
        {loading ? (
          <div className="py-12 text-center text-gray-500">Syncing database...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer & Service</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {bookings.length > 0 ? bookings.map((b, i) => (
                  <tr key={i} className="hover:opacity-80 transition-opacity">
                    <td className="p-4">
                      <div className="text-sm font-medium text-gray-900">{b.date}</div>
                      <div className="text-sm text-gray-500">{b.time}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-gray-900">{b.customer_name}</div>
                      <div className="text-sm text-gray-500">{b.service_name || 'Appointment'}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-900">{b.phone}</div>
                      <div className="text-sm text-gray-500">{b.email}</div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="p-12 text-center text-gray-500">No appointments recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
        <button 
          disabled={page === 1} 
          onClick={() => setPage(page - 1)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition shadow-sm"
        >
          &larr; Previous
        </button>
        <span className="text-sm font-medium text-gray-600">Page {page}</span>
        <button 
          disabled={bookings.length < 50} 
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition shadow-sm"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
