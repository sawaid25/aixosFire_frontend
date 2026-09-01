import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageSquare, Clock, Check, Trash2, AlertTriangle, FileText, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { fetchCustomerInquiries, fetchCustomerQuotations } from '../api/customerPortal';
import { getComplaintUnreadCountForAdmin, getComplaintUnreadCountForUser } from '../api/complaintsApi';
import { Link, useNavigate } from 'react-router-dom';
import { invalidatePartnerProducts } from '../hooks/usePartnerProducts';

const EXPIRY_DAYS = 10;

const NotificationBell = ({ onOpenChat }) => {
    const { user } = useAuth();
    const role = user?.role || localStorage.getItem('role');
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);

    const loadCustomerNotifications = useCallback(async () => {
        if (!user?.id) return;
        const list = [];
        try {
            // Keep consistent with Customer Dashboard inventory source:
            // equipment comes from `inquiry_items` (holds capacity/expiry_date etc).
            const { data: items, error: exErr } = await supabase
                .from('inquiry_items')
                .select('id, type, capacity, expiry_date, extinguisher_id')
                .eq('customer_id', user.id);
            if (!exErr && items?.length) {
                const limit = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
                items.forEach((ex) => {
                    if (!ex?.expiry_date) return;
                    const exp = new Date(ex.expiry_date).getTime();
                    if (exp < Date.now()) return;
                    if (exp <= limit) {
                        const labelId = ex.extinguisher_id ?? ex.id;
                        list.push({
                            id: `exp-${labelId}`,
                            title: 'Expiry alert',
                            message: `${ex.type || 'Unit'} (#${labelId}) expires on ${new Date(ex.expiry_date).toLocaleDateString()}`,
                            type: 'expiry',
                            timestamp: new Date().toISOString(),
                            isRead: false
                        });
                    }
                });
            }
        } catch (e) {
            console.warn('NotificationBell extinguishers:', e);
        }

        try {
            const quotes = await fetchCustomerQuotations();
            (Array.isArray(quotes) ? quotes : []).forEach((q) => {
                const st = (q.status || '').toLowerCase();
                if (st === 'pending' || st === 'submitted' || st === 'sent') {
                    list.push({
                        id: `q-${q.id}`,
                        title: 'Quotation received',
                        message: `Quote ${q.quote_reference || q.id} — review and approve`,
                        type: 'quotation',
                        timestamp: q.created_at || new Date().toISOString(),
                        isRead: false
                    });
                }
            });
        } catch (e) {
            console.warn('NotificationBell quotations:', e);
        }

        try {
            const inqs = await fetchCustomerInquiries();
            (Array.isArray(inqs) ? inqs : []).slice(0, 5).forEach((inq) => {
                list.push({
                    id: `inq-${inq.id}`,
                    title: 'Inquiry update',
                    message: `${inq.inquiry_no || 'Inquiry'} — ${inq.type || inq.inquiry_type || ''} is ${inq.status || 'updated'}`,
                    type: 'inquiry',
                    timestamp: inq.updated_at || inq.created_at || new Date().toISOString(),
                    isRead: true
                });
            });
        } catch (e) {
            console.warn('NotificationBell inquiries:', e);
        }

        try {
            const { data: dbNotifs, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false })
                .limit(15);
            
            if (!error && dbNotifs) {
                dbNotifs.forEach((n) => {
                    const isPartial = n.notification_type === 'partial_accept';
                    list.push({
                        id: `notif-${n.id}`,
                        title: isPartial
                            ? 'Partial refill update'
                            : n.sender_role === 'partner'
                              ? 'Partner Update'
                              : 'New System Alert',
                        message: n.message,
                        type: isPartial ? 'partial_accept' : 'message',
                        timestamp: n.created_at,
                        isRead: n.is_read,
                        relatedId: n.inquiry_id,
                        senderId: n.sender_id,
                        senderRole: n.sender_role
                    });
                });
            }
        } catch (e) {
            console.warn('NotificationBell db fetches:', e);
        }

        try {
            const complaintUnread = await getComplaintUnreadCountForUser(user.id);
            if (complaintUnread > 0) {
                list.unshift({
                    id: `complaint-user-${user.id}`,
                    title: 'Complaint reply',
                    message: `${complaintUnread} unread reply${complaintUnread > 1 ? 'ies' : 'y'} from admin`,
                    type: 'complaint',
                    timestamp: new Date().toISOString(),
                    isRead: false
                });
            }
        } catch (e) {
            console.warn('NotificationBell complaint user:', e);
        }

        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setNotifications(list.slice(0, 15));
        setUnreadCount(list.filter((n) => !n.isRead).length);

        if (import.meta.env.DEV) {
            console.debug('[NotificationBell] customer notifications', list.length);
        }
    }, [user?.id]);

    const loadAgentNotifications = useCallback(async () => {
        if (!user?.id) return;
        const list = [];
        try {
            const { data: dbNotifs, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false })
                .limit(15);

            if (!error && dbNotifs) {
                dbNotifs.forEach((n) => {
                    const isPartial = n.notification_type === 'partial_accept';
                    list.push({
                        id: `notif-${n.id}`,
                        title: isPartial
                            ? 'Partial refill update'
                            : n.sender_role === 'partner'
                              ? 'Partner update'
                              : 'System alert',
                        message: n.message,
                        type: isPartial ? 'partial_accept' : 'message',
                        timestamp: n.created_at,
                        isRead: n.is_read,
                        relatedId: n.inquiry_id,
                        senderId: n.sender_id,
                        senderRole: n.sender_role
                    });
                });
            }
        } catch (e) {
            console.warn('NotificationBell agent db:', e);
        }

        try {
            const complaintUnread = await getComplaintUnreadCountForUser(user.id);
            if (complaintUnread > 0) {
                list.unshift({
                    id: `complaint-agent-${user.id}`,
                    title: 'Complaint reply',
                    message: `${complaintUnread} unread complaint reply from admin`,
                    type: 'complaint',
                    timestamp: new Date().toISOString(),
                    isRead: false
                });
            }
        } catch (e) {
            console.warn('NotificationBell complaint agent:', e);
        }

        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setNotifications(list.slice(0, 15));
        setUnreadCount(list.filter((n) => !n.isRead).length);
    }, [user?.id]);

    const loadGenericNotifications = useCallback(async () => {
        if (!user?.id) return;
        const list = [];
        try {
            const { data: dbNotifs, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false })
                .limit(15);

            if (!error && dbNotifs) {
                dbNotifs.forEach((n) => {
                    const isProductAssigned = n.notification_type === 'product_assigned' || n.type === 'product_assigned';
                    list.push({
                        id: `notif-${n.id}`,
                        title: isProductAssigned ? 'New Product Assigned' : 'System alert',
                        message: n.message,
                        type: isProductAssigned ? 'product_assigned' : 'message',
                        timestamp: n.created_at,
                        isRead: n.is_read
                    });
                });
            }
        } catch (e) {
            console.warn('NotificationBell generic db:', e);
        }

        try {
            if (role === 'admin') {
                // Per-agent complaint notifications so clicking navigates directly to that agent
                const { data: agentMsgs } = await supabase
                    .from('complaints')
                    .select('user_id, message, created_at')
                    .eq('user_role', 'agent')
                    .eq('is_admin', false)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(20);

                const seenAgents = new Set();
                (agentMsgs || []).forEach(msg => {
                    if (!seenAgents.has(msg.user_id)) {
                        seenAgents.add(msg.user_id);
                        list.unshift({
                            id: `agent-complaint-${msg.user_id}`,
                            title: 'Agent Complaint',
                            message: (msg.message || '').slice(0, 80),
                            type: 'agent_complaint',
                            timestamp: msg.created_at,
                            isRead: false,
                            agentId: msg.user_id,
                        });
                    }
                });

                // Fallback: generic count for non-agent (customer/partner) complaints
                if (seenAgents.size === 0) {
                    const adminUnread = await getComplaintUnreadCountForAdmin();
                    if (adminUnread > 0) {
                        list.unshift({
                            id: 'complaint-admin-unread',
                            title: 'Complaint Center',
                            message: `${adminUnread} unread user complaint${adminUnread > 1 ? 's' : ''}`,
                            type: 'complaint',
                            timestamp: new Date().toISOString(),
                            isRead: false,
                        });
                    }
                }
            } else {
                const userUnread = await getComplaintUnreadCountForUser(user.id);
                if (userUnread > 0) {
                    list.unshift({
                        id: `complaint-generic-${user.id}`,
                        title: 'Complaint reply',
                        message: `${userUnread} unread complaint reply from admin`,
                        type: 'complaint',
                        timestamp: new Date().toISOString(),
                        isRead: false
                    });
                }
            }
        } catch (e) {
            console.warn('NotificationBell generic complaint:', e);
        }

        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setNotifications(list.slice(0, 15));
        setUnreadCount(list.filter((n) => !n.isRead).length);
    }, [user?.id, role]);

    useEffect(() => {
        if (!user?.id || !role) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        // Helper: append a new notification row from payload directly (no full refetch)
        const appendNotification = (n, buildItem) => {
            const item = buildItem(n);
            setNotifications((prev) => {
                if (prev.some((x) => x.id === item.id)) return prev;
                return [item, ...prev].slice(0, 15);
            });
            setUnreadCount((prev) => prev + 1);
        };

        const channels = [];

        // ── CUSTOMER ──────────────────────────────────────────────
        if (role === 'customer') {
            loadCustomerNotifications();

            const notifChannel = supabase
                .channel(`notif_customer_${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_id=eq.${user.id}`,
                }, (payload) => {
                    console.log('[NotificationBell] customer notification received:', payload.new);
                    const n = payload.new;
                    appendNotification(n, (n) => ({
                        id: `notif-${n.id}`,
                        title: n.notification_type === 'partial_accept'
                            ? 'Partial refill update'
                            : n.sender_role === 'partner' ? 'Partner Update' : 'New System Alert',
                        message: n.message,
                        type: n.notification_type === 'partial_accept' ? 'partial_accept' : 'message',
                        timestamp: n.created_at,
                        isRead: false,
                        relatedId: n.inquiry_id,
                        senderId: n.sender_id,
                        senderRole: n.sender_role,
                    }));
                })
                .subscribe((status) => {
                    console.log('[NotificationBell] customer notif subscription:', status);
                });

            // Badge update when admin replies to this user's complaint
            const complaintChannel = supabase
                .channel(`complaint_customer_${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'complaints',
                    filter: `user_id=eq.${user.id}`,
                }, (payload) => {
                    if (!payload.new.is_admin) return;
                    console.log('[NotificationBell] customer complaint reply received:', payload.new);
                    loadCustomerNotifications();
                })
                .subscribe((status) => {
                    console.log('[NotificationBell] customer complaint subscription:', status);
                });

            channels.push(notifChannel, complaintChannel);
        }

        // ── AGENT ─────────────────────────────────────────────────
        if (role === 'agent') {
            loadAgentNotifications();

            const notifChannel = supabase
                .channel(`notif_agent_${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_id=eq.${user.id}`,
                }, (payload) => {
                    console.log('[NotificationBell] agent notification received:', payload.new);
                    const n = payload.new;
                    appendNotification(n, (n) => ({
                        id: `notif-${n.id}`,
                        title: n.notification_type === 'partial_accept'
                            ? 'Partial refill update'
                            : n.sender_role === 'partner' ? 'Partner update' : 'System alert',
                        message: n.message,
                        type: n.notification_type === 'partial_accept' ? 'partial_accept' : 'message',
                        timestamp: n.created_at,
                        isRead: false,
                        relatedId: n.inquiry_id,
                        senderId: n.sender_id,
                        senderRole: n.sender_role,
                    }));
                })
                .subscribe((status) => {
                    console.log('[NotificationBell] agent notif subscription:', status);
                });

            const complaintChannel = supabase
                .channel(`complaint_agent_${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'complaints',
                    filter: `user_id=eq.${user.id}`,
                }, (payload) => {
                    if (!payload.new.is_admin) return;
                    console.log('[NotificationBell] agent complaint reply received:', payload.new);
                    loadAgentNotifications();
                })
                .subscribe((status) => {
                    console.log('[NotificationBell] agent complaint subscription:', status);
                });

            channels.push(notifChannel, complaintChannel);
        }

        // ── PARTNER / ADMIN ───────────────────────────────────────
        if (role === 'partner' || role === 'admin') {
            loadGenericNotifications();

            const notifChannel = supabase
                .channel(`notif_generic_${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_id=eq.${user.id}`,
                }, (payload) => {
                    console.log('[NotificationBell] partner/admin notification received:', payload.new);
                    const n = payload.new;
                    const isProductAssigned = n.notification_type === 'product_assigned' || n.type === 'product_assigned';
                    if (isProductAssigned) invalidatePartnerProducts();
                    appendNotification(n, (n) => ({
                        id: `notif-${n.id}`,
                        title: isProductAssigned ? 'New Product Assigned' : 'System alert',
                        message: n.message,
                        type: isProductAssigned ? 'product_assigned' : 'message',
                        timestamp: n.created_at,
                        isRead: false,
                    }));
                })
                .subscribe((status) => {
                    console.log('[NotificationBell] partner/admin notif subscription:', status);
                });

            // Admin needs to know about ALL new complaint messages (any user)
            const complaintChannel = supabase
                .channel(`complaint_generic_${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'complaints',
                }, (payload) => {
                    console.log('[NotificationBell] partner/admin complaint received:', payload.new);
                    loadGenericNotifications();
                })
                .subscribe((status) => {
                    console.log('[NotificationBell] partner/admin complaint subscription:', status);
                });

            channels.push(notifChannel, complaintChannel);
        }

        return () => {
            channels.forEach((ch) => supabase.removeChannel(ch));
        };
    }, [role, user?.id, loadCustomerNotifications, loadAgentNotifications, loadGenericNotifications]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = () => setIsOpen(!isOpen);

    const markAsRead = (id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const markAllAsRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
    };

    const removeNotification = (id, e) => {
        e.stopPropagation();
        const notification = notifications.find((n) => n.id === id);
        if (notification && !notification.isRead) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const handleNotificationClick = (notification) => {
        markAsRead(notification.id);
        if (notification.type === 'partial_accept') {
            setIsOpen(false);
            return;
        }
        if (notification.type === 'agent_complaint') {
            navigate(`/admin/agents/${notification.agentId}?tab=complaints`);
            setIsOpen(false);
            return;
        }
        if (notification.type === 'complaint') {
            navigate('/admin/complaints');
            setIsOpen(false);
            return;
        }
        if (notification.type === 'message' && onOpenChat) {
            onOpenChat(notification.relatedId, {
                senderId: notification.senderId,
                senderRole: notification.senderRole
            });
        }
        if (notification.type === 'product_assigned') {
            invalidatePartnerProducts(); // pull the freshly-assigned product on landing
            navigate('/partner/products');
            setIsOpen(false);
            return;
        }
        setIsOpen(false);
    };

    const formatTimestamp = (isoString) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffInMins = Math.floor((now - date) / (1000 * 60));

        if (diffInMins < 1) return 'Just now';
        if (diffInMins < 60) return `${diffInMins}m ago`;
        if (diffInMins < 1440) return `${Math.floor(diffInMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    const iconFor = (n) => {
        if (n.type === 'expiry') return <AlertTriangle size={18} className="text-amber-600" />;
        if (n.type === 'quotation') return <FileText size={18} className="text-emerald-600" />;
        if (n.type === 'partial_accept') return <Package size={18} className="text-purple-600" />;
        if (n.type === 'product_assigned') return <Package size={18} className="text-teal-600" />;
        if (n.type === 'message') return <MessageSquare size={18} className="text-blue-600" />;
        if (n.type === 'agent_complaint') return <MessageSquare size={18} className="text-orange-600" />;
        return <Clock size={18} className="text-amber-600" />;
    };

    const bubbleClass = (n) => {
        if (n.type === 'expiry') return 'bg-amber-100 text-amber-700';
        if (n.type === 'quotation') return 'bg-emerald-100 text-emerald-700';
        if (n.type === 'partial_accept') return 'bg-purple-100 text-purple-700';
        if (n.type === 'product_assigned') return 'bg-teal-100 text-teal-700';
        if (n.type === 'message') return 'bg-blue-100 text-blue-600';
        if (n.type === 'agent_complaint') return 'bg-orange-100 text-orange-600';
        return 'bg-slate-100 text-slate-600';
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={toggleDropdown}
                className="relative p-2 text-slate-500 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-all duration-200"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllAsRead}
                                className="text-xs text-primary-500 hover:text-primary-600 font-bold flex items-center gap-1"
                            >
                                <Check size={14} /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex gap-3 ${
                                            !notification.isRead ? 'bg-primary-50/30' : ''
                                        }`}
                                    >
                                        <div className={`mt-1 p-2 rounded-xl flex-shrink-0 ${bubbleClass(notification)}`}>
                                            {iconFor(notification)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <p
                                                    className={`text-sm font-bold truncate ${
                                                        !notification.isRead ? 'text-slate-900' : 'text-slate-600'
                                                    }`}
                                                >
                                                    {notification.title}
                                                </p>
                                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                                                    {formatTimestamp(notification.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{notification.message}</p>
                                        </div>
                                        <div className="flex flex-col gap-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={(e) => removeNotification(notification.id, e)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <Bell size={32} />
                                </div>
                                <p className="text-slate-500 font-medium">No notifications</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {role === 'customer'
                                        ? 'Expiry and quotation alerts appear here'
                                        : role === 'agent'
                                          ? 'Inquiry and refill updates appear here'
                                          : 'Alerts will appear when available'}
                                </p>
                            </div>
                        )}
                    </div>

                    {role === 'customer' && (
                        <div className="p-3 bg-slate-50/50 border-t border-slate-50 text-center">
                            <Link
                                to="/customer/dashboard"
                                className="text-xs font-bold text-primary-600 hover:text-primary-700"
                                onClick={() => setIsOpen(false)}
                            >
                                Open dashboard
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
