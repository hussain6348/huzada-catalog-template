import React, { useState } from 'react';

export default function Checkout() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Map the form data to EXACTLY what the API expects
    const data = {
      customer_name: formData.get('name'),
      customer_phone: formData.get('phone'),
      customer_email: formData.get('email'),
      service_name: formData.get('service'),
      booking_date: formData.get('date'),
      booking_time: formData.get('time')
    };

    const response = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) { setIsSubmitted(true); }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      {isSubmitted ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
          <h2 style={{ color: '#28A745', marginBottom: '15px' }}>Booking Submitted! ?</h2>
          <h3 style={{ fontSize: '20px', color: '#003366', fontWeight: 'bold' }}>WE WILL CONTACT YOU SOON</h3>
          <p style={{ color: '#555', marginTop: '10px' }}>Our team will reach out via phone or email shortly to confirm.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h2 style={{ color: '#003366', textAlign: 'center' }}>Book an Appointment</h2>
          <input type="text" name="name" placeholder="Full Name" required style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} />
          <input type="tel" name="phone" placeholder="Phone Number" required style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} />
          <input type="email" name="email" placeholder="Email Address" required style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} />
          <input type="text" name="service" placeholder="Service Needed" required style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="date" name="date" required style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} />
            <input type="time" name="time" required style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} />
          </div>
          <button type="submit" style={{ padding: '12px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>SUBMIT</button>
        </form>
      )}
    </div>
  );
}

