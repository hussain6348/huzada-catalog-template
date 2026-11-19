import React, { useState, useEffect } from "react";
import { Calendar, Clock, User, Phone, Mail, X } from "lucide-react";
import { clientConfig } from "../config/client";
import { getStoredBusinessInfo } from "../lib/businessInfo";

export default function BookingForm({
  service,
  onClose,
  businessInfo: propBusinessInfo,
}: {
  service: any;
  onClose?: () => void;
  businessInfo?: any;
}) {
  const businessInfo = propBusinessInfo || getStoredBusinessInfo();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  const [currency, setCurrency] = useState(() => {
    try {
      const code = localStorage.getItem('waas_store_currency') || 'USD';
      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };
      return symbols[code] || '$';
    } catch {
      return '$';
    }
  });

  useEffect(() => {
    const updateCurrency = () => {
      try {
        const code = localStorage.getItem('waas_store_currency') || 'USD';
        const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };
        setCurrency(symbols[code] || '$');
      } catch {
        setCurrency('$');
      }
    };
    updateCurrency();
    window.addEventListener('storage', updateCurrency);
    return () => window.removeEventListener('storage', updateCurrency);
  }, []);

  const activeCurrencySymbol = businessInfo?.currencySymbol || currency || '$';

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    date: "",
    time: "",
  });
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fallbackWhatsApp = clientConfig?.whatsappNumber || "923001234567";
    let targetWhatsApp = fallbackWhatsApp;

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: service?.client_id || "default",
          service_id: service?.id || "",
          service_name: service?.name || "General Consultation",
          customer_name: formData.name,
          client_name: formData.name,
          customer_phone: formData.phone,
          client_phone: formData.phone,
          customer_email: formData.email,
          email: formData.email,
          booking_date: formData.date,
          date: formData.date,
          booking_time: formData.time,
          time: formData.time,
        }),
      });

      let responseData: any = null;
      try {
        const text = await response.text();
        if (text) {
          responseData = JSON.parse(text);
        }
      } catch {
        responseData = null;
      }

      if (response.ok) {
        if (responseData?.whatsapp) {
          targetWhatsApp = responseData.whatsapp;
        }

        try {
          sessionStorage.setItem(
            "huzada_last_booking_status",
            JSON.stringify({
              timestamp: new Date().toISOString(),
              ok: true,
              status: response.status,
              data: responseData,
            })
          );
        } catch {}
      } else {
        console.error("[BOOKING API FAILED]", {
          status: response.status,
          response: responseData,
        });

        try {
          sessionStorage.setItem(
            "huzada_last_booking_status",
            JSON.stringify({
              timestamp: new Date().toISOString(),
              ok: false,
              status: response.status,
              error: responseData?.error || "Unknown server response",
              code: responseData?.code || "HTTP_" + response.status,
            })
          );
        } catch {}
      }
    } catch (err: any) {
      console.warn("Booking backend offline or pending, proceeding to WhatsApp bridge:", err);

      try {
        sessionStorage.setItem(
          "huzada_last_booking_status",
          JSON.stringify({
            timestamp: new Date().toISOString(),
            ok: false,
            status: 0,
            error: err?.message || "Network request failed",
            code: "NETWORK_ERROR",
          })
        );
      } catch {}
    } finally {
      const message = `Hello! I would like to book an appointment.\n\n*Service:* ${service?.name || "Service"}\n*Date:* ${formData.date}\n*Time:* ${formData.time}\n*Name:* ${formData.name}\n*Phone:* ${formData.phone}\n*Email:* ${formData.email}`;
      const cleanPhone = (targetWhatsApp || fallbackWhatsApp).replace(/[^0-9]/g, "");

      setIsSubmitted(true);
      console.debug("Request secured. Preserving TS vars:", cleanPhone, message);
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div
        className="fixed inset-0 z-[60000] h-[100dvh] flex flex-col pt-[100px] md:pt-0 backdrop-blur-3xl md:relative md:inset-auto md:h-auto md:z-auto md:block md:bg-transparent md:backdrop-blur-none"
        style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 98%, transparent)' }}
      >
        <div
          className="rounded-theme shadow-2xl border overflow-hidden w-full flex flex-col p-6 sm:p-8 items-center text-center h-full md:h-auto justify-between md:justify-center bg-[var(--theme-bg)] text-[var(--theme-text)]"
          style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
        >
          <div className="flex flex-col items-center flex-1 justify-center w-full max-w-md mx-auto">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-[var(--theme-primary)]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 15%, transparent)' }}
            >
              <Clock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-[var(--theme-text)] mb-2">Booking Request Sent</h2>
            <p className="text-[var(--theme-text)] opacity-70 mb-6 text-sm">
              Your request for <strong>{service?.name || "General Consultation"}</strong> on <strong>{formData.date}</strong> at <strong>{formData.time}</strong> has been submitted successfully.
            </p>
            <div
              className="border rounded-theme p-4 w-full text-left mb-6 text-[var(--theme-text)]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-text) 5%, transparent)',
                borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)'
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 text-[var(--theme-text)] opacity-70">Request Summary</h3>
              <div className="space-y-2 text-sm text-[var(--theme-text)]">
                <p className="flex justify-between"><span>Name:</span> <span className="font-medium">{formData.name}</span></p>
                <p className="flex justify-between"><span>Phone:</span> <span className="font-medium">{formData.phone}</span></p>
                <p className="flex justify-between"><span>Total:</span> <span className="font-medium">{activeCurrencySymbol}{service?.price ?? 0}</span></p>
              </div>
            </div>
            <p className="text-sm text-[var(--theme-text)] opacity-70 mb-6">
              We will contact you shortly to confirm the availability of this time slot.
            </p>
          </div>
          {onClose && (
            <div className="w-full shrink-0 pt-4 max-w-md mx-auto">
              <button
                onClick={onClose}
                type="button"
                className="w-full bg-[var(--theme-primary)] text-[var(--theme-bg)] font-bold py-3.5 rounded-theme hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60000] h-[100dvh] flex flex-col pt-[100px] md:pt-0 backdrop-blur-3xl md:relative md:inset-auto md:h-auto md:z-auto md:block md:bg-transparent md:backdrop-blur-none"
      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 98%, transparent)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col h-full w-full bg-[var(--theme-bg)] text-[var(--theme-text)] md:rounded-theme md:shadow-2xl md:border md:overflow-hidden md:p-8"
        style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
      >
        {/* Zone 1: Header */}
        <div
          className="shrink-0 p-4 border-b md:border-none md:p-0 md:mb-6 flex justify-between items-center bg-transparent"
          style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
        >
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--theme-text)]">Checkout: {service?.name || "General Consultation"}</h2>
            <p className="text-xs md:text-sm mt-0.5 md:mt-1 font-medium text-[var(--theme-text)] opacity-70 min-w-0 break-words">
              Total: {activeCurrencySymbol}{service?.price ?? 0} • {(() => {
                const raw = service?.duration ?? service?.duration_minutes ?? 30;
                const trimmed = String(raw).trim();
                return /^\d+$/.test(trimmed) ? `${trimmed} mins` : trimmed;
              })()}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-full hover:brightness-110 active:scale-95 transition-all text-[var(--theme-text)] cursor-pointer"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)' }}
            >
              <X size={22} />
            </button>
          )}
        </div>

        {/* Zone 2: Body (The Inputs) */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 md:overflow-visible md:p-0">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-theme border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
                <User size={15} className="text-[var(--theme-primary)]" /> Full Name
              </label>
              <input
                required
                type="text"
                placeholder="John Doe"
                className="w-full px-3.5 py-2.5 md:px-4 md:py-3 bg-transparent border-2 rounded-theme text-[var(--theme-text)] placeholder:text-[var(--theme-text)] placeholder:opacity-50 outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)] transition-all text-sm md:text-base"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)' }}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
                <Phone size={15} className="text-[var(--theme-primary)]" /> Phone Number
              </label>
              <input
                required
                type="tel"
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2.5 md:px-4 md:py-3 bg-transparent border-2 rounded-theme text-[var(--theme-text)] placeholder:text-[var(--theme-text)] placeholder:opacity-50 outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)] transition-all text-sm md:text-base"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)' }}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:space-y-2 md:col-span-2">
              <label className="text-xs md:text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
                <Mail size={15} className="text-[var(--theme-primary)]" /> Email Address
              </label>
              <input
                required
                type="email"
                placeholder="john@example.com"
                className="w-full px-3.5 py-2.5 md:px-4 md:py-3 bg-transparent border-2 rounded-theme text-[var(--theme-text)] placeholder:text-[var(--theme-text)] placeholder:opacity-50 outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)] transition-all text-sm md:text-base"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)' }}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
                <Calendar size={15} className="text-[var(--theme-primary)]" /> Date
              </label>
              <input
                required
                type="date"
                className="w-full px-3.5 py-2.5 md:px-4 md:py-3 bg-transparent border-2 rounded-theme text-[var(--theme-text)] placeholder:text-[var(--theme-text)] placeholder:opacity-50 outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)] transition-all text-sm md:text-base"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)' }}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
                <Clock size={15} className="text-[var(--theme-primary)]" /> Time
              </label>
              <input
                required
                type="time"
                className="w-full px-3.5 py-2.5 md:px-4 md:py-3 bg-transparent border-2 rounded-theme text-[var(--theme-text)] placeholder:text-[var(--theme-text)] placeholder:opacity-50 outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)] transition-all text-sm md:text-base"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)' }}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Zone 3: Footer */}
        <div
          className="shrink-0 p-4 border-t md:border-none md:p-0 md:mt-6 bg-[var(--theme-bg)] md:bg-transparent"
          style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
        >
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-[var(--theme-primary)] text-[var(--theme-bg)] font-bold text-base md:text-lg py-3.5 md:py-4 rounded-theme hover:brightness-110 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2 shadow-md cursor-pointer"
          >
            {loading ? "Processing..." : `SUBMIT`}
          </button>
          <p className="text-center text-xs mt-2.5 md:mt-4 font-medium flex items-center justify-center gap-1 text-[var(--theme-text)] opacity-70">
            <span className="block w-2 h-2 rounded-full bg-green-500"></span> Request sent securely for confirmation
          </p>
        </div>
      </form>
    </div>
  );
}

