"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Play, Info, AlertTriangle, XCircle, RefreshCw, LogOut, Clock, Settings } from 'lucide-react';

export default function Dashboard() {
  const [config, setConfig] = useState({ telegramChannels: [], websites: [], cronTime: "21:00" });
  const [logs, setLogs] = useState([]);
  const [newChannel, setNewChannel] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [testTelegramLoading, setTestTelegramLoading] = useState(false);
  const [testWebLoading, setTestWebLoading] = useState(false);
  const router = useRouter();

  const fetchData = async () => {
    try {
      const gConfig = await fetch('/api/config').then(r => r.json());
      const gLogs = await fetch('/api/logs').then(r => r.json());
      if (!gConfig.error) {
        setConfig(gConfig);
        setLogs(gLogs);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateConfig = async (type, action, value) => {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, action, value })
    });
    fetchData();
    if (type === 'telegram' && action === 'add') setNewChannel('');
    if (type === 'website' && action === 'add') setNewWebsite('');
  };

  const handleTimeChange = (e) => {
    const newValue = e.target.value;
    setConfig({...config, cronTime: newValue});
    updateConfig('time', 'update', newValue);
  };

  const runTest = async (target) => {
    if (target === 'telegram') setTestTelegramLoading(true);
    if (target === 'web') setTestWebLoading(true);

    await fetch('/api/test', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    });

    setTimeout(() => {
      if (target === 'telegram') setTestTelegramLoading(false);
      if (target === 'web') setTestWebLoading(false);
      alert(`Թեստն սկսվել է (${target === 'telegram' ? 'Telegram' : 'Վեբ'}): Ծանոթացեք մատյաններին մանրամասների համար:`);
      fetchData();
    }, 1000);
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 min-h-screen bg-slate-50 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Ադմինիստրատորի վահանակ</h1>
          <p className="text-slate-500 text-sm">Կառավարեք ալիքները և կայքերը, հետևեք մատյաններին:</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-medium shadow-sm transition-colors active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            Ելք
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Settings & Test Control Card */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                 <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Աշխատանքի ժամանակ (Երևանի ժամանակով)</h2>
                <p className="text-sm text-slate-500">Համակարգն ամեն օր ավտոմատ կաշխատի այս ժամին:</p>
              </div>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
                 <Clock className="w-5 h-5 text-slate-400" />
                 <input 
                   type="time" 
                   value={config.cronTime || '21:00'}
                   onChange={handleTimeChange}
                   className="bg-transparent text-lg font-medium text-slate-700 focus:outline-none focus:text-green-600 transition-colors"
                 />
              </div>
              <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runTest('telegram')}
                  disabled={testTelegramLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors active:scale-95 disabled:opacity-70 whitespace-nowrap"
                >
                  {testTelegramLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  Թեստ Telegram
                </button>
                <button
                  onClick={() => runTest('web')}
                  disabled={testWebLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors active:scale-95 disabled:opacity-70 whitespace-nowrap"
                >
                  {testWebLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  Թեստ Վեբ
                </button>
              </div>
           </div>
        </div>

        {/* Telegram Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Telegram Ալիքներ</h2>
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              placeholder="Ալիքի ID (օր. -100...)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-base text-slate-900 focus:outline-none focus:border-green-500 focus:bg-white transition-colors font-mono placeholder:text-slate-400"
            />
            <button
              onClick={() => updateConfig('telegram', 'add', newChannel)}
              className="px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors flex items-center justify-center font-medium shadow-sm"
            >
              <Plus className="w-5 h-5 md:mr-1" />
              <span className="hidden md:inline text-sm">Ավելացնել</span>
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {config.telegramChannels.map(channel => (
              <div key={channel} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg group hover:border-slate-200 transition-colors">
                <span className="font-mono text-base text-slate-800">{channel}</span>
                <button
                  onClick={() => updateConfig('telegram', 'delete', channel)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {config.telegramChannels.length === 0 && (
              <div className="text-center py-4 text-slate-400 text-sm">Ալիքներ դեռ չկան</div>
            )}
          </div>
        </div>

        {/* Websites Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Վեբ Կայքեր</h2>
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newWebsite}
              onChange={(e) => setNewWebsite(e.target.value)}
              placeholder="Կայքի հասցե (օր. example.com)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-base text-slate-900 focus:outline-none focus:border-green-500 focus:bg-white transition-colors font-mono placeholder:text-slate-400"
            />
            <button
              onClick={() => updateConfig('website', 'add', newWebsite)}
              className="px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors flex items-center justify-center font-medium shadow-sm"
            >
              <Plus className="w-5 h-5 md:mr-1" />
              <span className="hidden md:inline text-sm">Ավելացնել</span>
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {config.websites.map(site => (
              <div key={site} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg group hover:border-slate-200 transition-colors">
                <span className="font-mono text-base text-slate-800">{site}</span>
                <button
                  onClick={() => updateConfig('website', 'delete', site)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {config.websites.length === 0 && (
              <div className="text-center py-4 text-slate-400 text-sm">Կայքեր դեռ չկան</div>
            )}
          </div>
        </div>
      </div>

      {/* Logs Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[500px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Մատյաններ (Վերջին 2 շաբաթ)</h2>
          <button onClick={fetchData} className="px-3 py-1.5 flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-green-600 rounded-lg transition-colors border border-transparent hover:border-slate-200">
            <RefreshCw className="w-4 h-4" />
            Թարմացնել
          </button>
        </div>
        <div className="overflow-auto flex-1 custom-scrollbar -mx-6 px-6">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 font-medium text-slate-500">
                <th className="pb-3 px-2 whitespace-nowrap">Ժամանակ</th>
                <th className="pb-3 px-2">Ավտոմատացում</th>
                <th className="pb-3 px-2">Կարգավիճակ</th>
                <th className="pb-3 px-2 w-full">Հաղորդագրություն</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log, i) => (
                <tr key={log.id || i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-2 text-slate-500 tabular-nums whitespace-nowrap align-top">
                    {new Date(log.timestamp).toLocaleString('hy-AM', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3 px-2 font-medium text-slate-800 whitespace-nowrap align-top">
                    {log.automation === 'Telegram' ? 'Telegram' : 'Վեբ'}
                  </td>
                  <td className="py-3 px-2 whitespace-nowrap align-top">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                      ${log.level === 'info' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                      ${log.level === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                      ${log.level === 'error' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                    `}>
                      {log.level === 'info' && <Info className="w-3.5 h-3.5" />}
                      {log.level === 'warning' && <AlertTriangle className="w-3.5 h-3.5" />}
                      {log.level === 'error' && <XCircle className="w-3.5 h-3.5" />}
                      {log.level.toUpperCase()}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-700 break-words max-w-lg align-top">
                    {log.message}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400">Մատյաններ դեռ չկան</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
