import React, { useEffect, useState } from 'react';
import { Video, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { AssetStatusBadge } from './AssetStatusBadge';
import { RecordingPlayer } from './RecordingPlayer';
import { TranscriptViewer } from './TranscriptViewer';
import { dashboardApi } from '../../services/api';

export const AssetCard = ({ interviewId }) => {
  const [assets, setAssets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAssets = async () => {
    try {
      const res = await dashboardApi.getAssets(interviewId);
      setAssets(res.data.data);
      setError(false);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    // Poll every 10 seconds if any asset is not yet UPLOADED or FAILED
    const intervalId = setInterval(() => {
      setAssets(current => {
        const needsPolling = !current || 
          ['PENDING', 'PROCESSING'].includes(current.recording_status) || 
          ['PENDING', 'PROCESSING'].includes(current.transcript_status);
        
        if (needsPolling) {
          fetchAssets();
        }
        return current;
      });
    }, 10000);

    return () => clearInterval(intervalId);
  }, [interviewId]);

  if (loading) {
    return (
      <div className="mt-7 pt-7 border-t border-borderSoft">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="grid grid-cols-2 gap-5">
            <div className="h-48 bg-slate-100 rounded-xl"></div>
            <div className="h-48 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-7 pt-7 border-t border-borderSoft flex items-center justify-between text-rose-600 bg-rose-50 p-4 rounded-[12px] border border-rose-200">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 mr-3" />
          <span className="font-medium text-sm">Failed to load meeting artifacts.</span>
        </div>
        <button onClick={fetchAssets} className="text-xs font-bold uppercase hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="mt-7 pt-7 border-t border-borderSoft">
      <h4 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">Asset Status</h4>
      
      {/* Asset Status Panel */}
      <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-200 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Recording Status</p>
          <AssetStatusBadge status={assets?.recording_status} />
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Transcript Status</p>
          <AssetStatusBadge status={assets?.transcript_status} />
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Last Updated</p>
          <p className="text-sm font-semibold text-slate-700">{assets?.updated_at ? new Date(assets.updated_at).toLocaleString() : 'N/A'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Processing Attempts</p>
          <p className="text-sm font-semibold text-slate-700">{assets?.processing_attempts || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecordingPlayer 
          url={assets?.recording_url} 
          status={assets?.recording_status} 
        />
        <TranscriptViewer 
          url={assets?.transcript_url} 
          status={assets?.transcript_status} 
        />
      </div>
    </div>
  );
};
