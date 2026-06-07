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

  if (!assets) {
    return (
      <div className="mt-7 pt-7 border-t border-borderSoft flex items-center text-amber-600 font-medium text-sm bg-amber-50 p-4 rounded-[12px] border border-amber-200">
        <RefreshCw className="w-4 h-4 mr-3 animate-spin" />
        Meeting in progress or processing not started...
      </div>
    );
  }

  return (
    <div className="mt-7 pt-7 border-t border-borderSoft">
      <h4 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">Meeting Artifacts</h4>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recording Section */}
        <div className="bg-slate-50 rounded-[16px] p-5 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-700 flex items-center">
              <Video className="w-4 h-4 mr-2 text-primary-500" />
              Recording
            </span>
            <AssetStatusBadge status={assets.recording_status} />
          </div>
          <div className="flex-1">
            <RecordingPlayer url={assets.recording_url} status={assets.recording_status} />
          </div>
        </div>

        {/* Transcript Section */}
        <div className="bg-slate-50 rounded-[16px] p-5 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-700 flex items-center">
              <FileText className="w-4 h-4 mr-2 text-primary-500" />
              Transcript
            </span>
            <AssetStatusBadge status={assets.transcript_status} />
          </div>
          <div className="flex-1">
            <TranscriptViewer url={assets.transcript_url} status={assets.transcript_status} />
          </div>
        </div>
      </div>
    </div>
  );
};
