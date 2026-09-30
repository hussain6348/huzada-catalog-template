import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, LoaderCircle, ShoppingBag, User, Phone, MapPin, ShieldCheck, Truck, CheckCircle2, ExternalLink, MessageCircle, FileText } from 'lucide-react';
import { clientConfig } from '../config/client';
export function CheckoutModal({ isOpen, onClose, items, total, onComplete }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [confirmedOrder, setConfirmedOrder] = useState(null);
    if (!isOpen)
        return null;
    const handleClose = () => {
        if (confirmedOrder) {
            onComplete();
            setConfirmedOrder(null);
        }
        setError(null);
        onClose();
    };
    const submit = async (e) => {
        e.preventDefault();
        if (items.length === 0) {
            setError('Your shopping bag is empty.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    customerAddress: address.trim(),
                    items,
                    total,
                    notes: notes.trim() || undefined,
                }),
            });
            const data = await res.json();
            const orderId = data.orderId || `ORD-${Date.now()}`;
            const itemsSummary = items
                .map(i => `• ${i.name} (x${i.quantity}) - ${clientConfig.currencySymbol} ${(i.price * i.quantity).toLocaleString()}`)
                .join('\n');
            const msg = [
                `*NEW ORDER - ${clientConfig.businessName}*`,
                `────────────────────────`,
                `*Order ID:* ${orderId}`,
                ``,
                `*Customer Details:*`,
                `• Name: ${name.trim()}`,
                `• WhatsApp: ${phone.trim()}`,
                `• Delivery Address: ${address.trim()}`,
                notes.trim() ? `• Instructions: ${notes.trim()}` : null,
                ``,
                `*Items Ordered:*`,
                itemsSummary,
                ``,
                `*Total Amount:* ${clientConfig.currencySymbol} ${total.toLocaleString()}`,
                `*Payment Method:* Cash on Delivery (COD)`,
                `────────────────────────`,
                `Please confirm my order and share delivery timing. Thank you!`,
            ]
                .filter(Boolean)
                .join('\n');
            const waUrl = `https://wa.me/${clientConfig.whatsappNumber}?text=${encodeURIComponent(msg)}`;
            // Attempt popup/redirect
            window.open(waUrl, '_blank', 'noopener,noreferrer');
            // Set confirmed state inside modal so user always has the link and receipt
            setConfirmedOrder({ id: orderId, waUrl });
        }
        catch {
            setError('Unable to save order right now. Please check your connection and try again.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-fade-in", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-auto", children: [_jsxs("div", { className: "px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ShoppingBag, { className: "w-5 h-5 text-emerald-400" }), _jsx("h2", { className: "text-lg font-semibold tracking-tight", children: confirmedOrder ? 'Order Initiated' : 'Quick Checkout' })] }), _jsxs("p", { className: "text-xs text-slate-300 mt-0.5 flex items-center gap-1.5", children: [_jsx(ShieldCheck, { className: "w-3.5 h-3.5 text-emerald-400" }), "Instant WhatsApp confirmation \u00B7 Cash on Delivery"] })] }), _jsx("button", { onClick: handleClose, className: "text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors hover:bg-white/10", "aria-label": "Close modal", children: _jsx(X, { className: "w-5 h-5" }) })] }), confirmedOrder ? (
                /* Order Confirmed / WhatsApp Launch Screen */
                _jsxs("div", { className: "p-6 sm:p-8 text-center space-y-6", children: [_jsx("div", { className: "w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm", children: _jsx(CheckCircle2, { className: "w-10 h-10" }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-xl font-bold text-slate-900", children: "Your Order is Ready to Send!" }), _jsxs("p", { className: "text-sm text-slate-600 max-w-sm mx-auto", children: ["We generated Order ID ", _jsx("span", { className: "font-semibold text-slate-900 font-mono", children: confirmedOrder.id }), ". Tap below to send your order directly to our WhatsApp store team."] })] }), _jsxs("div", { className: "bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left space-y-2.5 text-xs text-slate-700", children: [_jsxs("div", { className: "flex justify-between items-center text-slate-500 pb-2 border-b border-slate-200", children: [_jsx("span", { children: "Total Due on Delivery" }), _jsxs("span", { className: "font-bold text-base text-slate-900 tabular-nums", children: [clientConfig.currencySymbol, " ", total.toLocaleString()] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Recipient:" }), _jsx("span", { className: "font-medium text-slate-900", children: name })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-slate-500", children: "WhatsApp:" }), _jsx("span", { className: "font-medium text-slate-900", children: phone })] }), _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsx("span", { className: "text-slate-500 shrink-0", children: "Address:" }), _jsx("span", { className: "font-medium text-slate-900 text-right truncate", children: address })] })] }), _jsxs("div", { className: "space-y-3 pt-2", children: [_jsxs("a", { href: confirmedOrder.waUrl, target: "_blank", rel: "noopener noreferrer", className: "w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all text-sm", children: [_jsx(MessageCircle, { className: "w-5 h-5 fill-current" }), _jsx("span", { children: "Open WhatsApp to Confirm" }), _jsx(ExternalLink, { className: "w-4 h-4 ml-0.5 opacity-80" })] }), _jsx("button", { onClick: handleClose, className: "w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors", children: "Done / Back to Catalog" })] })] })) : (
                /* Checkout Form & Order Summary */
                _jsxs("form", { onSubmit: submit, className: "p-6 space-y-5", children: [error && (_jsx("div", { className: "p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-center gap-2", children: _jsx("span", { children: error }) })), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500", children: [_jsxs("span", { children: ["Order Summary (", items.reduce((s, i) => s + i.quantity, 0), " items)"] }), _jsx("span", { className: "text-slate-700 font-normal", children: "Cash on Delivery" })] }), _jsx("div", { className: "bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 max-h-40 overflow-y-auto divide-y divide-slate-200/50", children: items.length === 0 ? (_jsx("p", { className: "text-xs text-slate-500 py-3 text-center", children: "Your bag is empty." })) : (items.map(item => (_jsxs("div", { className: "py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [item.image && (_jsx("img", { src: item.image, alt: item.name, referrerPolicy: "no-referrer", className: "w-10 h-10 rounded-lg object-cover bg-slate-200 shrink-0 border border-slate-200/60" })), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium text-slate-800 text-xs truncate", children: item.name }), _jsxs("p", { className: "text-[11px] text-slate-500", children: [clientConfig.currencySymbol, " ", item.price.toLocaleString(), " \u00D7 ", item.quantity] })] })] }), _jsxs("span", { className: "font-semibold text-xs text-slate-900 tabular-nums shrink-0", children: [clientConfig.currencySymbol, " ", (item.price * item.quantity).toLocaleString()] })] }, item.id)))) })] }), _jsxs("div", { className: "space-y-3 pt-1", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5", children: [_jsx(User, { className: "w-3.5 h-3.5 text-slate-500" }), "Your Full Name"] }), _jsx("input", { required: true, type: "text", placeholder: "e.g. Muhammad Ali", className: "w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors", value: name, onChange: e => setName(e.target.value) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5", children: [_jsx(Phone, { className: "w-3.5 h-3.5 text-slate-500" }), "WhatsApp Contact Number"] }), _jsx("div", { className: "relative", children: _jsx("input", { required: true, type: "tel", placeholder: "e.g. 0332 2264855", className: "w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors", value: phone, onChange: e => setPhone(e.target.value) }) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-slate-500" }), "Complete Delivery Address"] }), _jsx("textarea", { required: true, rows: 2, placeholder: "House/Apartment #, Street, Area / Sector, City", className: "w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none", value: address, onChange: e => setAddress(e.target.value) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5", children: [_jsx(FileText, { className: "w-3.5 h-3.5 text-slate-400" }), "Delivery Notes ", _jsx("span", { className: "text-slate-400 text-[11px] font-normal", children: "(Optional)" })] }), _jsx("input", { type: "text", placeholder: "e.g. Deliver after 4 PM, landmark near mosque", className: "w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors", value: notes, onChange: e => setNotes(e.target.value) })] })] }), _jsxs("div", { className: "bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Truck, { className: "w-4 h-4 text-emerald-600 shrink-0" }), _jsx("span", { children: "Standard Doorstep Delivery" })] }), _jsx("span", { className: "font-semibold text-emerald-700", children: "Free" })] }), _jsxs("div", { className: "pt-2 border-t border-slate-100 space-y-3", children: [_jsxs("div", { className: "flex justify-between items-baseline", children: [_jsx("span", { className: "text-sm font-medium text-slate-600", children: "Total Payable:" }), _jsxs("span", { className: "text-xl font-bold text-slate-900 tabular-nums", children: [clientConfig.currencySymbol, " ", total.toLocaleString()] })] }), _jsxs("button", { type: "submit", disabled: loading || items.length === 0, className: "w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-between shadow-lg shadow-emerald-600/20 transition-all text-sm group", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MessageCircle, { className: "w-5 h-5 fill-current" }), _jsx("span", { children: loading ? 'Preparing WhatsApp Order...' : 'Complete Order on WhatsApp' })] }), loading ? (_jsx(LoaderCircle, { className: "w-5 h-5 animate-spin" })) : (_jsxs("span", { className: "bg-emerald-700/60 px-2.5 py-0.5 rounded-lg text-xs font-medium tabular-nums", children: [clientConfig.currencySymbol, " ", total.toLocaleString()] }))] })] })] }))] }) }));
}
