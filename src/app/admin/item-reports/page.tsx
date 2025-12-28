"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { ArrowLeft, AlertTriangle, CheckCircle2, X, Loader2, Eye, Plus, Trash2 } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';
import Link from 'next/link';

interface ItemReport {
  id: string;
  itemName: string;
  itemId: string;
  itemImage?: string;
  reason: string;
  existsInAPI: boolean;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export default function ItemReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<ItemReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [selectedReport, setSelectedReport] = useState<ItemReport | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
      setUserLoaded(true);
    } catch {
      setUser(null);
      setUserLoaded(true);
    }
  }, []);

  const userIsOwner = isOwner(user?.steamId);

  useEffect(() => {
    // Wait for user to be loaded before checking ownership
    if (!userLoaded) return;
    
    if (!userIsOwner) {
      router.push('/');
      return;
    }
    loadReports();
  }, [userLoaded, userIsOwner, filter]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/item-reports?status=${filter}`, {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setReports(data.reports || data || []);
      } else {
        console.error('Failed to load reports:', data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: string) => {
    setUpdating(reportId);
    try {
      const res = await fetch('/api/admin/item-reports', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          reportId,
          status,
          reviewedBy: user?.steamId,
        }),
      });

      if (res.ok) {
        await loadReports();
        setSelectedReport(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update report');
      }
    } catch (error) {
      console.error('Error updating report:', error);
      alert('Failed to update report');
    } finally {
      setUpdating(null);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    setUpdating(reportId);
    try {
      const res = await fetch(`/api/admin/item-reports?reportId=${reportId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });

      if (res.ok) {
        await loadReports();
        setSelectedReport(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    } finally {
      setUpdating(null);
    }
  };

  // Show loading state while checking user
  if (!userLoaded) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      </div>
    );
  }

  if (!userIsOwner) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-7xl mx-auto">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Admin
            </Link>

            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                Item Reports
              </h1>
              <div className="flex items-center gap-2">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="px-4 py-2 bg-[#11141d] border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">No reports found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-[#11141d] border border-white/5 rounded-2xl p-4 md:p-6"
                  >
                    <div className="flex items-start gap-4">
                      {report.itemImage && (
                        <img
                          src={report.itemImage}
                          alt={report.itemName}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="text-sm md:text-base font-black text-white mb-1">
                              {report.itemName}
                            </h3>
                            <p className="text-xs text-gray-400">ID: {report.itemId}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {report.existsInAPI ? (
                              <span className="px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-[10px] font-black uppercase text-green-400">
                                In API
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-black uppercase text-red-400">
                                Not in API
                              </span>
                            )}
                            <span
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                report.status === 'pending'
                                  ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                                  : report.status === 'resolved'
                                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                  : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'
                              }`}
                            >
                              {report.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 mb-4">{report.reason}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                          >
                            <Eye size={12} />
                            View Details
                          </button>
                          {!report.existsInAPI && (
                            <button
                              onClick={() => {
                                setSelectedReport(report);
                                setShowAddItemModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                            >
                              <Plus size={12} />
                              Add Item
                            </button>
                          )}
                          {report.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateReportStatus(report.id, 'resolved')}
                                disabled={updating === report.id}
                                className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                              >
                                {updating === report.id ? (
                                  <Loader2 className="animate-spin" size={12} />
                                ) : (
                                  'Resolve'
                                )}
                              </button>
                              <button
                                onClick={() => updateReportStatus(report.id, 'dismissed')}
                                disabled={updating === report.id}
                                className="px-3 py-1.5 rounded-lg bg-gray-500/10 border border-gray-500/20 text-gray-400 hover:bg-gray-500/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => deleteReport(report.id)}
                            disabled={updating === report.id}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-3">
                          Reported: {new Date(report.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {selectedReport && !showAddItemModal && (
        <ViewDetailsModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onAddItem={() => {
            setShowAddItemModal(true);
          }}
          onUpdateStatus={updateReportStatus}
          onDelete={deleteReport}
          updating={updating}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && selectedReport && (
        <AddCustomItemModal
          report={selectedReport}
          onClose={() => {
            setShowAddItemModal(false);
            setSelectedReport(null);
          }}
          onSuccess={() => {
            setShowAddItemModal(false);
            setSelectedReport(null);
            loadReports();
          }}
        />
      )}
    </div>
  );
}

// View Details Modal Component
function ViewDetailsModal({
  report,
  onClose,
  onAddItem,
  onUpdateStatus,
  onDelete,
  updating,
}: {
  report: ItemReport;
  onClose: () => void;
  onAddItem: () => void;
  onUpdateStatus: (reportId: string, status: string) => void;
  onDelete: (reportId: string) => void;
  updating: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Eye className="text-blue-400" size={20} />
            </div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">
              Report Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Item Image */}
          {report.itemImage && (
            <div className="flex justify-center">
              <img
                src={report.itemImage}
                alt={report.itemName}
                className="w-32 h-32 rounded-xl object-cover border border-white/10"
              />
            </div>
          )}

          {/* Item Information */}
          <div className="bg-[#08090d] rounded-xl p-4 border border-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Item Information
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-400 mb-1">Item Name</p>
                <p className="text-sm font-bold text-white">{report.itemName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Item ID</p>
                <p className="text-sm font-mono text-gray-300">{report.itemId}</p>
              </div>
            </div>
          </div>

          {/* Report Information */}
          <div className="bg-[#08090d] rounded-xl p-4 border border-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Report Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">Status:</p>
                <span
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                    report.status === 'pending'
                      ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                      : report.status === 'resolved'
                      ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                      : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'
                  }`}
                >
                  {report.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">API Status:</p>
                {report.existsInAPI ? (
                  <span className="px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-[10px] font-black uppercase text-green-400">
                    Found in API
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-black uppercase text-red-400">
                    Not in API
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Reason</p>
                <p className="text-sm text-gray-300">{report.reason}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Reported</p>
                <p className="text-sm text-gray-300">
                  {new Date(report.createdAt).toLocaleString()}
                </p>
              </div>
              {report.reviewedAt && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Reviewed</p>
                  <p className="text-sm text-gray-300">
                    {new Date(report.reviewedAt).toLocaleString()}
                    {report.reviewedBy && ` by ${report.reviewedBy}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
            {!report.existsInAPI && (
              <button
                onClick={onAddItem}
                className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={14} />
                Add Item
              </button>
            )}
            {report.status === 'pending' && (
              <>
                <button
                  onClick={() => onUpdateStatus(report.id, 'resolved')}
                  disabled={updating === report.id}
                  className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                >
                  {updating === report.id ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Resolve
                    </>
                  )}
                </button>
                <button
                  onClick={() => onUpdateStatus(report.id, 'dismissed')}
                  disabled={updating === report.id}
                  className="px-4 py-2 rounded-lg bg-gray-500/10 border border-gray-500/20 text-gray-400 hover:bg-gray-500/20 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                  Dismiss
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this report?')) {
                  onDelete(report.id);
                  onClose();
                }
              }}
              disabled={updating === report.id}
              className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 bg-black/40 text-gray-400 hover:text-white hover:border-white/20 transition-all text-xs font-black uppercase tracking-widest ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Custom Item Modal Component
function AddCustomItemModal({
  report,
  onClose,
  onSuccess,
}: {
  report: ItemReport;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    id: report.itemId,
    name: report.itemName,
    marketHashName: report.itemId,
    image: report.itemImage || '',
    rarity: '',
    weapon: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/custom-items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          ...formData,
          reportId: report.id,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add item');
      }
    } catch (error) {
      console.error('Error adding custom item:', error);
      alert('Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">
            Add Custom Item
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Item ID *
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Market Hash Name *
              </label>
              <input
                type="text"
                value={formData.marketHashName}
                onChange={(e) => setFormData({ ...formData, marketHashName: e.target.value })}
                className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Item Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Image URL
            </label>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Rarity
              </label>
              <input
                type="text"
                value={formData.rarity}
                onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="e.g., Covert, Classified"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Weapon
              </label>
              <input
                type="text"
                value={formData.weapon}
                onChange={(e) => setFormData({ ...formData, weapon: e.target.value })}
                className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="e.g., AK-47, AWP"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-black/40 text-gray-400 hover:text-white hover:border-white/20 transition-all text-xs font-black uppercase tracking-widest"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Adding...
                </>
              ) : (
                'Add Item'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

