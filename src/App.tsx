import React, { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, Key, Settings2, Download, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import { parseFileToJSON } from './utils/fileParser';
import { processBatchWithAI } from './services/ai';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [supplierFile, setSupplierFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultCsv, setResultCsv] = useState<string | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('xai_api_key') || import.meta.env.VITE_GROQ_API_KEY;
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleKeySave = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    localStorage.setItem('xai_api_key', e.target.value);
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>, type: 'template' | 'supplier') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'template') setTemplateFile(file);
      if (type === 'supplier') setSupplierFile(file);
      setError(null);
    }
  };

  const startProcessing = async () => {
    if (!apiKey) return setError("Please input your API Key first.");
    if (!templateFile || !supplierFile) return setError("Please upload both files.");
    
    setIsProcessing(true);
    setProgress(5);
    setProgressText('Extracting template schema...');
    setError(null);
    setResultCsv(null);

    try {
      // 1. Get Template Headers
      const templateData = await parseFileToJSON(templateFile);
      if (templateData.length === 0) throw new Error("Template file is empty.");
      const templateHeaders = Object.keys(templateData[0]);

      setProgress(15);
      setProgressText('Parsing supplier data...');
      
      // 2. Parse Supplier File
      const supplierData = await parseFileToJSON(supplierFile);
      if (supplierData.length === 0) throw new Error("Supplier file is empty.");

      // Filter out completely empty rows
      const validSupplierData = supplierData.filter(row => Object.keys(row).length > 0);
      
      let finalData: any[] = [];
      
      // 3. Batching
      const BATCH_SIZE = 15;
      const totalBatches = Math.ceil(validSupplierData.length / BATCH_SIZE);
      
      for (let i = 0; i < totalBatches; i++) {
        setProgressText(`Converting batch ${i + 1} of ${totalBatches}...`);
        
        const batch = validSupplierData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        // Retry logic for AI
        let retries = 2;
        let success = false;
        
        while (retries > 0 && !success) {
          try {
            const processedBatch = await processBatchWithAI(apiKey, templateHeaders, batch);
            finalData = [...finalData, ...processedBatch];
            success = true;
          } catch (err: any) {
            retries--;
            if (retries === 0) throw new Error(`AI processing failed: ${err.message}`);
            await new Promise(r => setTimeout(r, 2000)); // wait before retry
          }
        }
        
        const percentage = 15 + Math.round(((i + 1) / totalBatches) * 80);
        setProgress(percentage);
      }

      setProgressText('Compiling final CSV...');
      setProgress(98);

      // 4. Convert to CSV
      const csvOutput = Papa.unparse(finalData, { columns: templateHeaders });
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      setResultCsv(url);
      setProgress(100);
      setProgressText('Complete!');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during processing.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center relative overflow-hidden">
      
      {/* Animated Background Blob */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-[120px] -z-10 animate-blob mix-blend-screen pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10 animate-blob mix-blend-screen pointer-events-none" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-5xl space-y-10 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-md mb-2 relative group transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/20 to-purple-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <FileSpreadsheet className="w-10 h-10 text-brand-400 relative z-10" strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-500 pb-2">
            Universal Converter
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto font-medium tracking-wide">
            Intelligently transform any supplier price list into your target Shopify template using AI. 
            All processing happens securely in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
          
          {/* Settings Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-5 text-white">
                <Settings2 className="w-5 h-5 text-zinc-400" strokeWidth={1.5} /> Configuration
              </h2>
              <div>
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-brand-400" /> API Key (Groq / OpenAI)
                </label>
                <input 
                  type="password" 
                  className="glass-input" 
                  placeholder="gsk-..." 
                  value={apiKey}
                  onChange={handleKeySave}
                />
                <p className="text-xs text-zinc-500 mt-4 leading-relaxed font-medium">
                  Stored locally for privacy. Processing happens directly between your browser and the AI API.
                </p>
              </div>
            </div>
            
            {/* Status Panel if Result exists */}
            {resultCsv && !isProcessing && (
              <div className="glass-panel p-6 border-emerald-500/20 bg-emerald-500/5 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <h3 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2 relative z-10">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  Conversion Complete!
                </h3>
                <a 
                  href={resultCsv} 
                  download="converted_shopify.csv"
                  className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-semibold py-3 px-6 rounded-xl transition-all duration-300 relative z-10"
                >
                  <Download className="w-5 h-5" /> Download CSV
                </a>
              </div>
            )}
          </div>
          
          {/* Main Upload Area */}
          <div className="lg:col-span-8 space-y-6">
            <div className="glass-panel p-6 sm:p-8 md:p-10 space-y-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Template Upload */}
                <div className="group">
                  <label className="block text-sm font-semibold text-zinc-300 mb-3 ml-1 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-[10px] text-brand-400 font-mono">1</span>
                    Target Template (.csv)
                  </label>
                  <label className="drop-zone h-48">
                    <input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileDrop(e, 'template')} />
                    <UploadCloud className={`w-10 h-10 mb-4 transition-all duration-500 group-hover:-translate-y-1 ${templateFile ? 'text-brand-400 scale-110' : 'text-zinc-500'}`} strokeWidth={1.5} />
                    <span className="text-sm text-zinc-200 font-medium text-center px-4 truncate w-full relative z-0">
                      {templateFile ? templateFile.name : "Upload Template File"}
                    </span>
                    <span className="text-xs text-zinc-500 mt-2 font-medium">Provides the target schema</span>
                  </label>
                </div>
                
                {/* Supplier Upload */}
                <div className="group">
                  <label className="block text-sm font-semibold text-zinc-300 mb-3 ml-1 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-[10px] text-brand-400 font-mono">2</span>
                    Supplier Data (.xlsx/.csv)
                  </label>
                  <label className="drop-zone h-48">
                    <input type="file" accept=".csv, .xlsx, .xls" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileDrop(e, 'supplier')} />
                    <FileSpreadsheet className={`w-10 h-10 mb-4 transition-all duration-500 group-hover:-translate-y-1 ${supplierFile ? 'text-brand-400 scale-110' : 'text-zinc-500'}`} strokeWidth={1.5} />
                    <span className="text-sm text-zinc-200 font-medium text-center px-4 truncate w-full relative z-0">
                      {supplierFile ? supplierFile.name : "Upload Raw Data File"}
                    </span>
                    <span className="text-xs text-zinc-500 mt-2 font-medium">Data you want to convert</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm shadow-inner backdrop-blur-md animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} />
                  <p className="leading-relaxed font-medium">{error}</p>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button 
                  onClick={startProcessing} 
                  disabled={isProcessing || !templateFile || !supplierFile}
                  className="btn-primary w-full group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Processing AI... 
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Auto-Convert Data
                    </>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              {isProcessing && (
                <div className="space-y-3 pt-4 border-t border-white/5 animate-in fade-in duration-500">
                  <div className="flex justify-between text-sm text-zinc-300 font-medium tracking-wide">
                    <span className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
                       {progressText}
                    </span>
                    <span className="text-brand-400 tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-300 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
