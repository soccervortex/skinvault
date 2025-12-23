"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Loader2, Flag, Search, Eye, CheckCircle, XCircle, MessageSquare, Users, Save } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';

interface Report {
  id: string;
  reporterSteamId: string;
  reporterName: string;
  reportedSteamId: string;
  reportedName: string;
  reportType: 'global' | 'dm';
  dmId?: string;
  conversationLog: Array<{
    steamId: string;
    steamName: string;
    message: string;
    timestamp: Date | string;
  }>;
  createdAt: Date | string;
  status: 'pending' | 'reviewed' | 'resolved';
  adminNotes?: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const toast = useToast();

  // Update adminNotes when report is selected
  useEffect(() => {
    if (selectedReport) {
      setAdminNotes(selectedReport.adminNotes || '');
    } else {
      setAdminNotes('');
    }
  }, [selectedReport]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
    } catch {
      setUser(null);
    }
  }, []);

  const userIsOwner = isOwner(user?.steamId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Wait a bit for user to load
    if (!user) return;
    
    if (!userIsOwner) {
      router.push('/admin');
      return;
    }

    const loadReports = async () => {
      setLoading(true);
      try {
        const url = statusFilter === 'all' 
          ? `/api/chat/report?adminSteamId=${user?.steamId}`
          : `/api/chat/report?adminSteamId=${user?.steamId}&status=${statusFilter}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (error) {
        console.error('Failed to load reports:', error);
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
    const interval = setInterval(loadReports, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [userIsOwner, user?.steamId, statusFilter, router, toast]);

  const handleUpdateStatus = async (reportId: string, newStatus: 'pending' | 'reviewed' | 'resolved') => {
    setUpdating(true);
    try {
      const res = await fetch('/api/chat/report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          adminSteamId: user?.steamId,
          status: newStatus,
          adminNotes: adminNotes || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Report status updated');
        // Update selected report with new status
        if (selectedReport) {
          setSelectedReport({ ...selectedReport, status: newStatus, adminNotes: adminNotes || selectedReport.adminNotes });
        }
        // Don't clear adminNotes if we're just updating status
        // setAdminNotes('');
        // Reload reports
        const url = statusFilter === 'all' 
          ? `/api/chat/report?adminSteamId=${user?.steamId}`
          : `/api/chat/report?adminSteamId=${user?.steamId}&status=${statusFilter}`;
        const reloadRes = await fetch(url);
        if (reloadRes.ok) {
          const data = await reloadRes.json();
          setReports(data.reports || []);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update report');
      }
    } catch (error) {
      console.error('Failed to update report:', error);
      toast.error('Failed to update report');
    } finally {
      setUpdating(false);
    }
  };

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-xl font-bold">Unauthorized</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Chat Reports</h1>
              <p className="text-sm text-gray-400 mt-1">Review and manage user reports</p>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#11141d] border border-white/10 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">All Reports</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Flag size={48} className="mx-auto mb-4 opacity-50" />
              <p>No reports found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-[#11141d] p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Flag className={`${
                          report.status === 'pending' ? 'text-orange-400' :
                          report.status === 'reviewed' ? 'text-blue-400' :
                          'text-emerald-400'
                        }`} size={20} />
                        <div>
                          <p className="font-bold text-white">
                            {report.reporterName} reported {report.reportedName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {report.reportType === 'global' ? (
                              <><MessageSquare size={12} className="inline mr-1" /> Global Chat</>
                            ) : (
                              <><Users size={12} className="inline mr-1" /> Direct Message</>
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">
                        Reporter: {report.reporterSteamId} | Reported: {report.reportedSteamId}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(report.createdAt).toLocaleString()} | {report.conversationLog.length} messages
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      report.status === 'pending' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/40' :
                      report.status === 'reviewed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/40' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      {report.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report Detail Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#11141d] p-6 rounded-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Report Details</h2>
                <button
                  onClick={() => {
                    setSelectedReport(null);
                    setAdminNotes('');
                  }}
                  className="text-gray-500 hover:text-white"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reporter</p>
                    <p className="font-bold">{selectedReport.reporterName}</p>
                    <p className="text-xs text-gray-400">{selectedReport.reporterSteamId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reported User</p>
                    <p className="font-bold">{selectedReport.reportedName}</p>
                    <p className="text-xs text-gray-400">{selectedReport.reportedSteamId}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Report Type</p>
                  <p className="font-bold">{selectedReport.reportType === 'global' ? 'Global Chat' : 'Direct Message'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Created</p>
                  <p>{new Date(selectedReport.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold mb-3">Conversation Log ({selectedReport.conversationLog.length} messages)</h3>
                <div className="bg-[#08090d] p-4 rounded-lg max-h-96 overflow-y-auto custom-scrollbar space-y-2">
                  {selectedReport.conversationLog.map((msg, idx) => (
                    <div key={idx} className="border-b border-white/5 pb-2 last:border-b-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-sm ${
                          msg.steamId === selectedReport.reporterSteamId ? 'text-blue-400' :
                          msg.steamId === selectedReport.reportedSteamId ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {msg.steamName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-gray-500">Admin Notes</label>
                  <button
                    onClick={async () => {
                      if (!selectedReport) return;
                      setUpdating(true);
                      try {
                        const res = await fetch('/api/chat/report', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            reportId: selectedReport.id,
                            adminSteamId: user?.steamId,
                            status: selectedReport.status, // Keep current status
                            adminNotes: adminNotes || undefined,
                          }),
                        });
                        if (res.ok) {
                          toast.success('Admin notes saved');
                          if (selectedReport) {
                            setSelectedReport({ ...selectedReport, adminNotes: adminNotes || undefined });
                          }
                        } else {
                          const errorData = await res.json();
                          toast.error(errorData.error || 'Failed to save notes');
                        }
                      } catch (error) {
                        console.error('Failed to save notes:', error);
                        toast.error('Failed to save notes');
                      } finally {
                        setUpdating(false);
                      }
                    }}
                    disabled={updating}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {updating ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                    Save Notes
                  </button>
                </div>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this report..."
                  className="w-full bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 min-h-[100px]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleUpdateStatus(selectedReport.id, 'pending')}
                  disabled={updating || selectedReport.status === 'pending'}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  Mark Pending
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedReport.id, 'reviewed')}
                  disabled={updating || selectedReport.status === 'reviewed'}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  Mark Reviewed
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                  disabled={updating || selectedReport.status === 'resolved'}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  Resolve
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

